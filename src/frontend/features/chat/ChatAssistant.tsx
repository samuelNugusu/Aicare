import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle, Paperclip, X, Image as ImageIcon, Activity, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHealthAssistantResponse, runGeminiDiagnostics, DiagnosticResult, AIProvider } from '../../services/aiService';
import { db, auth } from '../../firebase/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../utils/utils';
import { ChatMessage } from '../../../shared/types';

export default function ChatAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>('gemini');
  
  // Diagnostics State
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticResult | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const testGeminiConnection = useCallback(async () => {
    setIsRunningDiagnostics(true);
    try {
      const report = await runGeminiDiagnostics();
      setDiagnosticReport(report);
      return report;
    } catch (err: any) {
      console.warn("AI Diagnostics Notice:", err?.message || err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    testGeminiConnection();
  }, [testGeminiConnection]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/messages`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        role: doc.data().role as 'user' | 'model',
        content: doc.data().content,
        image: doc.data().image
      }));
      setMessages(msgs);
    });
  }, [auth.currentUser]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMessage = input.trim();
    const currentImage = attachedImage;
    
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      // Optimistic update if not logged in
      if (!auth.currentUser) {
        setMessages(prev => [...prev, { 
          role: 'user', 
          content: userMessage || "Sent an image", 
          image: currentImage || undefined 
        }]);
      } else {
        try {
          await addDoc(collection(db, `users/${auth.currentUser.uid}/messages`), {
            role: 'user',
            content: userMessage || "Sent an image",
            image: currentImage,
            timestamp: serverTimestamp()
          });
        } catch (dbErr) {
          console.error("Failed to save message to DB:", dbErr);
          setMessages(prev => [...prev, { role: 'user', content: userMessage, image: currentImage || undefined }]);
        }
      }

      const updatedHistory = messages.map(m => ({ 
        role: (m.role === 'model' ? 'assistant' : m.role) as 'user' | 'assistant', 
        content: m.content 
      }));
      const response = await getHealthAssistantResponse(
        updatedHistory, 
        userMessage || "Tell me about this image", 
        currentImage || undefined,
        provider
      );

      if (auth.currentUser) {
        try {
          await addDoc(collection(db, `users/${auth.currentUser.uid}/messages`), {
            role: 'model',
            content: response,
            timestamp: serverTimestamp()
          });
        } catch (dbErr) {
          console.error("Failed to save model response to DB:", dbErr);
          setMessages(prev => [...prev, { role: 'model', content: response }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'model', content: response }]);
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      const fallbackMsg = "I am ready to analyze your symptoms, medications, or lab panels. How can I help you today?";
      setMessages(prev => [...prev, { role: 'model', content: fallbackMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="assistant" className="py-24 bg-[#050505] overflow-hidden transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          <div className="lg:col-span-2 space-y-8">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              AiCare Assistant
            </div>
            <h2 className="text-4xl md:text-5xl font-sans font-bold text-white tracking-tight leading-[1.1]">
              Your Personal AI <br />
              <span className="text-purple-400">Health Specialist</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Ask anything about your health, lab results, medications, or wellness routines. 
              Our AI is trained on vast medical data to provide instant, reliable information.
            </p>
            <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/10 shadow-lg transition-colors">
               <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center text-orange-400">
                  <AlertCircle className="w-5 h-5" />
               </div>
               <p className="text-xs text-gray-400 italic">Always consult a physical doctor for formal medical diagnosis.</p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col h-[600px] overflow-hidden transition-colors">
              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-[#0a0a0a] z-10 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0a0a0a] rounded-full" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white leading-none text-sm sm:text-base">AiCare Assistant</h4>
                        <span className="text-[10px] text-green-400 uppercase font-bold tracking-widest">Online</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">Clinical Reasoning AI</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Pill */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                        diagnosticReport?.success
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-purple-500/10 text-purple-300 border-purple-500/20"
                      )}
                    >
                      <Activity className={cn("w-3.5 h-3.5", isRunningDiagnostics && "animate-spin")} />
                      <span className="hidden sm:inline">
                        {isRunningDiagnostics ? "Connecting..." : diagnosticReport?.success ? "Gemini 3.7 Online" : "AI Clinical Engine"}
                      </span>
                    </div>

                    <div className="flex p-0.5 bg-white/5 border border-white/10 rounded-xl transition-colors">
                      <button 
                        onClick={() => setProvider('gemini')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all",
                          provider === 'gemini' ? "bg-white/15 text-blue-400 shadow-sm" : "text-gray-400"
                        )}
                      >
                        Gemini
                      </button>
                      <button 
                        onClick={() => setProvider('openai')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all",
                          provider === 'openai' ? "bg-white/15 text-green-400 shadow-sm" : "text-gray-400"
                        )}
                      >
                        GPT-4o
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/40 transition-colors">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 px-12">
                     <Bot className="w-16 h-16 mb-4 text-purple-400" />
                     <p className="font-bold text-white">How can I help you today?</p>
                     <p className="text-sm text-gray-400">"What does a high CRP mean?" or "Give me a 3-day detox plan."</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex gap-4 max-w-[85%]",
                        msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                        msg.role === 'user' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      )}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl shadow-sm text-sm border",
                        msg.role === 'user' 
                          ? "bg-blue-600 text-white border-blue-500 rounded-tr-none" 
                          : "bg-white/[0.05] text-gray-100 border-white/10 rounded-tl-none"
                      )}>
                        {msg.image && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                            <img src={msg.image} alt="Uploaded content" className="max-w-full h-auto max-h-48 object-cover" />
                          </div>
                        )}
                        <div className="markdown-body prose prose-sm max-w-none prose-invert">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex gap-4 max-w-[85%]"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        <span className="text-xs text-gray-400 font-medium">AiCare Thinking...</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Input Area */}
              <form onSubmit={handleSend} className="p-4 bg-[#0a0a0a] border-t border-white/10 transition-colors">
                <AnimatePresence>
                  {attachedImage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mb-3 relative inline-block"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-purple-500/40">
                        <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setAttachedImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 sm:p-3 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-xl transition-all flex-shrink-0 border border-white/5"
                    title="Attach image or report"
                  >
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={attachedImage ? "Add a message about this image..." : "Ask AiCare anything..."}
                      className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl pl-3.5 sm:pl-5 pr-11 sm:pr-12 py-3 sm:py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all text-white placeholder:text-gray-500"
                    />
                    <button
                      type="submit"
                      disabled={(!input.trim() && !attachedImage) || isLoading}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 bg-purple-600 text-white rounded-lg sm:rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-all shadow-md flex items-center justify-center"
                      aria-label="Send message"
                    >
                      <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 text-center mt-2 uppercase tracking-widest font-bold">Press enter to send</p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
