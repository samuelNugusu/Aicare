import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle, Paperclip, X, Image as ImageIcon, Activity, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, Terminal, Key, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHealthAssistantResponse, runGeminiDiagnostics, DiagnosticResult, AIProvider, getStoredApiKey, setStoredApiKey } from '../../services/aiService';
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
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState(() => getStoredApiKey());
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Diagnostic utility function to test connection to the Gemini API using the provided key.
   * Logs response status, model metrics, and detailed error messages to the browser console.
   */
  const testGeminiConnection = useCallback(async (customKey?: string) => {
    setIsRunningDiagnostics(true);
    console.group("🔍 [AiCare Gemini API Connection Diagnostics]");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Key Under Test:", customKey ? `${customKey.substring(0, 6)}...${customKey.substring(Math.max(0, customKey.length - 4))} (length: ${customKey.length})` : "Using server environment GEMINI_API_KEY");

    try {
      const report = await runGeminiDiagnostics(customKey);
      setDiagnosticReport(report);

      console.log("🔑 Key Analysis:", {
        configured: report.hasKey,
        masked: report.maskedKey,
        length: report.keyLength,
        hasStandardAIzaSyPrefix: report.hasStandardPrefix,
        formatStatus: report.hasStandardPrefix ? "Valid format (AIzaSy...)" : "⚠️ Non-standard format (Should start with AIzaSy...)"
      });

      console.log("📡 Connection Status:", report.success ? "🟢 200 OK - Gemini Connected Successfully" : "🔴 Connection Failed");
      console.log("⚡ Latency:", `${report.latencyMs}ms`);
      console.log("🤖 Active Model:", report.activeModel || "None");

      if (report.testResponseSnippet) {
        console.log("💬 Test Output:", report.testResponseSnippet);
      }

      console.log("📊 Model Candidate Test Results:");
      console.table(report.modelResults);

      if (report.diagnostics && report.diagnostics.length > 0) {
        console.warn("⚠️ Diagnostic Notices / Actionable Advice:");
        report.diagnostics.forEach((d, idx) => console.warn(`  [${idx + 1}] ${d}`));
      }

      if (!report.success) {
        console.error("❌ Failure Breakdown per Model:");
        report.modelResults.forEach(m => {
          if (!m.success) {
            console.error(`  - Model [${m.model}]: Status [${m.statusCode}] -> Error: ${m.errorMessage}`);
          }
        });
      }

      return report;
    } catch (err: any) {
      console.error("❌ Diagnostic Request Error:", err?.message || err);
      throw err;
    } finally {
      console.groupEnd();
      setIsRunningDiagnostics(false);
    }
  }, []);

  // Run initial diagnostic check on mount to log Gemini API status to console
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
        provider,
        customKeyInput || undefined
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
      const errorMessage = err.message || "I'm having trouble connecting to my brain. Please try again.";
      setMessages(prev => [...prev, { role: 'model', content: `⚠️ Error: ${errorMessage}` }]);
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
                    {/* Diagnostics Button */}
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticPanel(!showDiagnosticPanel)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                        diagnosticReport?.success
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/20"
                      )}
                      title="Run Gemini API connection diagnostics"
                    >
                      <Activity className={cn("w-3.5 h-3.5", isRunningDiagnostics && "animate-spin")} />
                      <span className="hidden sm:inline">Diagnostics</span>
                      {showDiagnosticPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

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

                {/* Collapsible Diagnostic Panel */}
                <AnimatePresence>
                  {showDiagnosticPanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3 pt-3 border-t border-white/10 text-xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/[0.03] p-3 rounded-xl border border-white/10">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="font-mono text-gray-300">Gemini Connection Status:</span>
                          {isRunningDiagnostics ? (
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Testing models...
                            </span>
                          ) : diagnosticReport?.success ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Connected ({diagnosticReport.activeModel}) - {diagnosticReport.latencyMs}ms
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Error (Check console for full log)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isRunningDiagnostics}
                          onClick={() => testGeminiConnection(customKeyInput || undefined)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-xs flex-shrink-0"
                        >
                          <RefreshCw className={cn("w-3 h-3", isRunningDiagnostics && "animate-spin")} />
                          Run Diagnostics
                        </button>
                      </div>

                      {/* Key Test & Application Input */}
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="password"
                            value={customKeyInput}
                            onChange={(e) => {
                              setCustomKeyInput(e.target.value);
                              setKeySaveMessage(null);
                            }}
                            placeholder="Enter Gemini API key (AIzaSy...)"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 font-mono focus:outline-none focus:ring-1 focus:ring-purple-400"
                          />
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setStoredApiKey(customKeyInput);
                                setKeySaveMessage("Key saved locally as active key!");
                                await testGeminiConnection(customKeyInput);
                              }}
                              disabled={!customKeyInput.trim() || isRunningDiagnostics}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              title="Save key for active session and test connectivity"
                            >
                              <Key className="w-3 h-3" />
                              Save & Test
                            </button>

                            {customKeyInput && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStoredApiKey('');
                                  setCustomKeyInput('');
                                  setKeySaveMessage("Custom key cleared; using server environment.");
                                  testGeminiConnection(undefined);
                                }}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 rounded-lg text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1"
                                title="Clear stored key"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {keySaveMessage && (
                          <div className="text-[11px] text-purple-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-purple-400" />
                            {keySaveMessage}
                          </div>
                        )}
                      </div>

                      {/* Detailed Diagnostic Results */}
                      {diagnosticReport && (
                        <div className="bg-black/60 p-3 rounded-xl border border-white/10 font-mono text-[11px] space-y-1.5 text-gray-300">
                          <div className="flex justify-between text-gray-400">
                            <span>Key Masked: {diagnosticReport.maskedKey} ({diagnosticReport.keyLength} chars)</span>
                            <span>Prefix: {diagnosticReport.hasStandardPrefix ? "✅ Standard (AIzaSy)" : "❌ Non-standard"}</span>
                          </div>

                          {diagnosticReport.diagnostics.length > 0 && (
                            <div className="pt-1 space-y-1">
                              {diagnosticReport.diagnostics.map((diag, idx) => (
                                <div key={idx} className="text-amber-300/90 leading-tight">
                                  ⚠️ {diag}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="pt-1 border-t border-white/10 text-gray-400">
                            💡 Open browser Developer Tools (<kbd className="bg-white/10 px-1 rounded text-[10px]">F12</kbd> / Console tab) to view full HTTP payloads and error dumps.
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
