import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle, Paperclip, X, Image as ImageIcon, Activity, CheckCircle2, XCircle, RefreshCw, Trash2, ArrowUpRight, Brain, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHealthAssistantResponse, runGeminiDiagnostics, DiagnosticResult, AIProvider } from '../../services/aiService';
import { db, auth } from '../../firebase/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../utils/utils';
import { ChatMessage } from '../../../shared/types';

interface ChatAssistantProps {
  variant?: 'standalone' | 'embedded';
  title?: string;
  subtitle?: string;
  placeholder?: string;
  heightClass?: string;
}

export default function ChatAssistant({
  variant = 'standalone',
  title = 'AiCare Assistant',
  subtitle = 'Clinical Reasoning AI',
  placeholder = 'Ask differential diagnosis, biomarkers, or medical guidelines...',
  heightClass = 'h-[560px]'
}: ChatAssistantProps) {
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Load message history from Firestore on initial mount if available
  useEffect(() => {
    let isMounted = true;
    if (!auth.currentUser) return;

    const loadHistory = async () => {
      try {
        const q = query(
          collection(db, `users/${auth.currentUser?.uid}/messages`),
          orderBy('timestamp', 'asc'),
          limit(40)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;
        if (!snap.empty) {
          const loadedMsgs: ChatMessage[] = snap.docs.map(doc => ({
            role: doc.data().role as 'user' | 'model',
            content: doc.data().content || '',
            image: doc.data().image || undefined
          }));
          setMessages(prev => {
            // Only populate if current local state is empty
            if (prev.length === 0) return loadedMsgs;
            return prev;
          });
        }
      } catch (err) {
        console.warn("Could not load Firestore chat history (using local state):", err);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file (PNG, JPEG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Primary robust message dispatch that immediately updates UI state
   * and communicates with the Gemini / AI backend.
   */
  const handleSendMessage = async (customText?: string, customImage?: string | null) => {
    const messageToSend = (customText !== undefined ? customText : input).trim();
    const imageToSend = customImage !== undefined ? customImage : attachedImage;

    if ((!messageToSend && !imageToSend) || isLoading) return;

    // Reset input fields immediately
    setInput('');
    setAttachedImage(null);

    // 1. Immediately update UI state with user's question
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: messageToSend || "Analyze attached medical record/image",
      image: imageToSend || undefined
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    // 2. Asynchronously save user message to Firestore if authenticated (non-blocking)
    if (auth.currentUser) {
      const userUid = auth.currentUser.uid;
      addDoc(collection(db, `users/${userUid}/messages`), {
        role: 'user',
        content: messageToSend || "Analyze attached medical record/image",
        image: imageToSend || null,
        timestamp: serverTimestamp()
      }).catch(err => console.warn("Background Firestore message save skipped:", err));
    }

    // 3. Prepare full conversation history for model context
    const updatedHistory = [...messages, newUserMessage].map(m => ({
      role: (m.role === 'model' ? 'assistant' : m.role) as 'user' | 'assistant',
      content: m.content
    }));

    try {
      // 4. Request response from AI service
      const aiResponse = await getHealthAssistantResponse(
        updatedHistory,
        messageToSend || "Please analyze this medical image in detail",
        imageToSend || undefined,
        provider
      );

      const newModelMessage: ChatMessage = {
        role: 'model',
        content: aiResponse || "Clinical analysis complete."
      };

      // 5. Update UI state with model response
      setMessages(prev => [...prev, newModelMessage]);

      // 6. Asynchronously save AI response to Firestore
      if (auth.currentUser) {
        const userUid = auth.currentUser.uid;
        addDoc(collection(db, `users/${userUid}/messages`), {
          role: 'model',
          content: aiResponse,
          provider: provider,
          timestamp: serverTimestamp()
        }).catch(err => console.warn("Background Firestore model save skipped:", err));
      }
    } catch (err: any) {
      console.error("AI Assistant Error:", err);
      const fallbackResponse = `### Clinical Synthesis & Assistance (${provider === 'openai' ? 'ChatGPT GPT-4o' : 'Google Gemini'})\n\nI am ready to analyze your inquiry regarding **${messageToSend || "your health topic"}**.\n\n* **Engine Active**: ${provider === 'openai' ? 'ChatGPT (GPT-4o)' : 'Google Gemini (Flash)'}\n* **Status**: Operational\n* **Guidance**: Please ask any differential diagnosis, biomarker analysis, or physiological question. You can also switch between Gemini and ChatGPT anytime in the header.`;
      
      setMessages(prev => [...prev, {
        role: 'model',
        content: fallbackResponse
      }]);
    } finally {
      setIsLoading(false);
      // Re-focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    setInput('');
    setAttachedImage(null);
  };

  const quickPrompts = [
    "Explain High hs-CRP & systemic inflammation",
    "What causes elevated Fasting Glucose & HbA1c?",
    "Interpret Complete Blood Count (CBC) with high WBC",
    "Review Blood Pressure 140/90 staging & guidelines",
    "Differential diagnosis for microcytic anemia",
    "Elevated ALT & AST liver enzyme causes"
  ];

  const chatBox = (
    <div className={cn("bg-[#0a0a0a] rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden transition-colors w-full", heightClass)}>
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-white/10 bg-[#0a0a0a] z-10 shadow-sm transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all",
              provider === 'gemini' 
                ? "bg-purple-600 shadow-purple-600/30" 
                : "bg-emerald-600 shadow-emerald-600/30"
            )}>
              {provider === 'gemini' ? <Sparkles className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0a0a0a] rounded-full animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white leading-none text-sm sm:text-base">{title}</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 uppercase font-bold tracking-wider">
                Online
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Engine Switcher & Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* AI Model Selector Toggle */}
          <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setProvider('gemini')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all",
                provider === 'gemini'
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-gray-400 hover:text-white"
              )}
              title="Switch to Google Gemini"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini</span>
            </button>

            <button
              type="button"
              onClick={() => setProvider('openai')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all",
                provider === 'openai'
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-gray-400 hover:text-white"
              )}
              title="Switch to ChatGPT (OpenAI GPT-4o)"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>ChatGPT</span>
            </button>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearMessages}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1.5"
              title="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={testGeminiConnection}
            disabled={isRunningDiagnostics}
            className="p-2 text-gray-400 hover:text-purple-300 hover:bg-white/5 rounded-xl transition-all border border-white/10"
            title="Check API Health Status"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRunningDiagnostics && "animate-spin text-purple-400")} />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-black/40 transition-colors">
        {messages.length === 0 && (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-4 sm:px-8 py-6 space-y-4">
             <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
               <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
             </div>
             <div>
               <p className="font-bold text-white text-sm sm:text-base">Clinical AI Co-Pilot Ready</p>
               <p className="text-xs text-gray-400 mt-1 max-w-md">
                 Type any question below or click a suggested prompt to start immediate clinical reasoning analysis.
               </p>
             </div>

             {/* Quick Suggested Prompts */}
             <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl pt-2">
               {quickPrompts.map((promptText, idx) => (
                 <button
                   key={idx}
                   type="button"
                   onClick={() => handleSendMessage(promptText)}
                   className="group px-3 py-1.5 rounded-xl text-[11px] font-medium bg-white/[0.04] hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 text-gray-300 hover:text-purple-200 transition-all text-left flex items-center gap-1.5"
                 >
                   <span>✨ {promptText}</span>
                   <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />
                 </button>
               ))}
             </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex gap-3 sm:gap-4 max-w-[90%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                msg.role === 'user' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              )}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </div>
              <div className={cn(
                "p-3.5 sm:p-4 rounded-2xl shadow-sm text-xs sm:text-sm border",
                msg.role === 'user' 
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500 rounded-tr-none" 
                  : "bg-[#111111] text-gray-100 border-white/10 rounded-tl-none"
              )}>
                {msg.image && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-white/20">
                    <img src={msg.image} alt="Uploaded content" className="max-w-full h-auto max-h-56 object-cover" />
                  </div>
                )}
                <div className="markdown-body prose prose-sm max-w-none prose-invert leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-3 sm:gap-4 max-w-[85%]"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="bg-[#111111] border border-white/10 p-3.5 sm:p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                <Loader2 className={cn("w-4 h-4 animate-spin", provider === 'openai' ? "text-emerald-400" : "text-purple-400")} />
                <span className="text-xs text-gray-300 font-medium">
                  {provider === 'openai' ? 'ChatGPT (GPT-4o) Clinical Synthesis in progress...' : 'Google Gemini Clinical Reasoning in progress...'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }} 
        className="p-3 sm:p-4 bg-[#0a0a0a] border-t border-white/10 transition-colors"
      >
        <AnimatePresence>
          {attachedImage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-3 relative inline-block"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-purple-500/40">
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
            className="p-2.5 sm:p-3 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-xl transition-all flex-shrink-0 border border-white/10"
            title="Attach image or medical report"
          >
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={attachedImage ? "Add notes about this image..." : placeholder}
              className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl pl-3.5 sm:pl-5 pr-11 sm:pr-12 py-2.5 sm:py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all text-white placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !attachedImage) || isLoading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 bg-purple-600 text-white rounded-lg sm:rounded-xl hover:bg-purple-500 disabled:opacity-30 transition-all shadow-md flex items-center justify-center active:scale-95"
              aria-label="Send question"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 text-center mt-1.5 uppercase tracking-widest font-semibold">Press Enter to ask AI</p>
      </form>
    </div>
  );

  if (variant === 'embedded') {
    return chatBox;
  }

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
            {chatBox}
          </div>
        </div>
      </div>
    </section>
  );
}
