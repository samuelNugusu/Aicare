import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Type, Sparkles, Brain, Database, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeLabResult, AIProvider } from '../../services/aiService';
import { db, auth } from '../../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../firebase/errorHandlers';
import { cn } from '../../utils/utils';
import AnalysisResults from './AnalysisResults';

const CLINICAL_PRESETS = [
  {
    name: "Complete Blood Count (CBC)",
    description: "Hemoglobin, Hematocrit, White Blood Cells, Platelets",
    text: `LABORATORY DIAGNOSTIC REPORT
Patient: Clinical Intake
Test: Complete Blood Count (CBC) with Differential
- White Blood Cell (WBC): 6.8 x10^3/uL (Ref: 4.5 - 11.0) - NORMAL
- Red Blood Cell (RBC): 4.90 x10^6/uL (Ref: 4.35 - 5.65) - NORMAL
- Hemoglobin (Hb): 14.5 g/dL (Ref: 13.5 - 17.5) - NORMAL
- Hematocrit (Hct): 43.0 % (Ref: 38.8 - 50.0) - NORMAL
- Platelet Count: 260 x10^3/uL (Ref: 150 - 450) - NORMAL
- Mean Corpuscular Volume (MCV): 87.8 fL (Ref: 80.0 - 100.0) - NORMAL
- Neutrophils: 58 % (Ref: 40 - 70) - NORMAL
- Lymphocytes: 32 % (Ref: 20 - 45) - NORMAL`
  },
  {
    name: "Comprehensive Metabolic Panel (CMP)",
    description: "Fasting Glucose, HbA1c, Creatinine, eGFR, ALT, AST",
    text: `CLINICAL BIOCHEMISTRY REPORT
Panel: Comprehensive Metabolic Panel (CMP)
- Fasting Serum Glucose: 94 mg/dL (Ref: 70 - 99) - NORMAL
- Hemoglobin A1c: 5.4 % (Ref: < 5.7) - NORMAL
- Blood Urea Nitrogen (BUN): 15 mg/dL (Ref: 7 - 20) - NORMAL
- Serum Creatinine: 0.94 mg/dL (Ref: 0.70 - 1.30) - NORMAL
- Estimated GFR (eGFR): >90 mL/min/1.73m2 (Ref: >60) - NORMAL
- Sodium: 140 mEq/L (Ref: 135 - 145) - NORMAL
- Potassium: 4.4 mEq/L (Ref: 3.5 - 5.0) - NORMAL
- Chloride: 102 mEq/L (Ref: 96 - 106) - NORMAL
- ALT (Alanine Aminotransferase): 22 U/L (Ref: 7 - 56) - NORMAL
- AST (Aspartate Aminotransferase): 20 U/L (Ref: 10 - 40) - NORMAL`
  },
  {
    name: "Cardiovascular Lipid & hs-CRP",
    description: "Total Cholesterol, HDL, LDL, Triglycerides, hs-CRP",
    text: `LIPID & CARDIOMETABOLIC PANEL
Test: Fasting Advanced Lipid Profile
- Total Cholesterol: 198 mg/dL (Ref: < 200) - NORMAL
- HDL ("Good") Cholesterol: 60 mg/dL (Ref: > 40) - NORMAL
- LDL ("Bad") Cholesterol: 118 mg/dL (Ref: < 100) - BORDERLINE ELEVATED
- Triglycerides: 105 mg/dL (Ref: < 150) - NORMAL
- Total / HDL Ratio: 3.3 (Ref: < 4.5) - OPTIMAL
- High Sensitivity CRP (hs-CRP): 0.8 mg/L (Ref: < 1.0) - LOW RISK`
  }
];

export default function LabUpload() {
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>('gemini');

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError("Please upload an image file of your lab result.");
      return;
    }
    setError(null);
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (uploadMode === 'file' && !preview) return;
    if (uploadMode === 'text' && !rawText.trim()) return;

    setIsProcessing(true);
    setError(null);
    try {
      const payload = uploadMode === 'file' ? { base64Image: preview! } : { text: rawText.trim() };
      const analysisJson = await analyzeLabResult(payload, provider);
      setResult(analysisJson);
      
      // Save to Firebase if user is logged in
      if (auth.currentUser) {
        const path = `users/${auth.currentUser.uid}/lab_results`;
        try {
          await addDoc(collection(db, path), {
            fileName: uploadMode === 'file' ? (file?.name || 'Lab_Report.png') : 'Clinical_Text_Panel.txt',
            uploadDate: serverTimestamp(),
            status: 'completed',
            analysis: analysisJson,
            previewUrl: uploadMode === 'file' ? '...' : null
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
    } catch (err: any) {
      console.error("Lab Upload Error:", err);
      setError(err.message || "Failed to analyze health data. Please check your document and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setRawText('');
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8 text-center sm:text-left">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Analysis Report</h2>
          <button onClick={reset} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-4 py-2 rounded-xl transition-all">
            Upload Another
          </button>
        </div>
        <AnalysisResults data={result} />
      </div>
    );
  }

  return (
    <section id="upload" className="py-16 bg-white dark:bg-gray-950/50 relative transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
           <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">Upload Your Lab Results</h2>
           <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Real AI diagnostic synthesis and clinical biomarker extraction.</p>
           
           <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
             <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
               <button
                 type="button"
                 onClick={() => setUploadMode('file')}
                 className={cn(
                   "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                   uploadMode === 'file' ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                 )}
               >
                 <Upload className="w-3.5 h-3.5" />
                 Upload Image / Scan
               </button>
               <button
                 type="button"
                 onClick={() => setUploadMode('text')}
                 className={cn(
                   "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                   uploadMode === 'text' ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                 )}
               >
                 <Type className="w-3.5 h-3.5" />
                 Paste Lab Text / Presets
               </button>
             </div>

             <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
               <button
                 type="button"
                 onClick={() => setProvider('gemini')}
                 className={cn(
                   "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                   provider === 'gemini' ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                 )}
               >
                 <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                 Gemini 3.7
               </button>
               <button
                 type="button"
                 onClick={() => setProvider('openai')}
                 className={cn(
                   "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                   provider === 'openai' ? "bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                 )}
               >
                 <Brain className="w-3.5 h-3.5 text-emerald-500" />
                 GPT-4o
               </button>
             </div>
           </div>
        </div>

        {uploadMode === 'text' && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Choose Real Clinical Preset or Paste Text:
              </label>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CLINICAL_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRawText(preset.text)}
                  className="p-3 text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-all text-xs active:scale-[0.98]"
                >
                  <div className="font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center justify-between">
                    <span>{preset.name}</span>
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw lab values or click one of the presets above..."
              rows={8}
              className="w-full p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />

            {error && (
              <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/30">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={processFile}
              disabled={isProcessing || !rawText.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl py-3.5 font-bold disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-500/20 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Real Health Data...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Clinical Data with {provider === 'gemini' ? 'Gemini AI' : 'OpenAI'}
                </>
              )}
            </button>
          </div>
        )}

        {uploadMode === 'file' && (
          <div className="relative">
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    "border-2 border-dashed rounded-3xl sm:rounded-[3rem] p-8 sm:p-12 transition-all flex flex-col items-center justify-center text-center gap-5 sm:gap-6 cursor-pointer",
                    isDragging ? "border-blue-600 bg-blue-50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-800 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  )}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Select a lab scan or drag and drop</p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 uppercase tracking-widest font-bold">Image (JPG, PNG, WebP)</p>
                  </div>
                  <input 
                    type="file" 
                    id="file-input" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={onFileChange} 
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gray-50 dark:bg-gray-900 rounded-3xl sm:rounded-[3rem] p-4 lg:p-8 border border-gray-100 dark:border-gray-800 flex flex-col items-center"
                >
                   <div className="relative w-full max-w-lg mb-6 sm:mb-8 group">
                     <img src={preview!} alt="Preview" className="w-full rounded-2xl sm:rounded-[2rem] shadow-lg border border-white dark:border-gray-800 max-h-96 object-contain" />
                     <button 
                      onClick={reset}
                      className="absolute top-4 right-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur shadow-md p-2 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                     >
                       <X className="w-5 h-5" />
                     </button>
                   </div>
                   
                   <div className="w-full max-w-lg space-y-4 sm:space-y-6">
                      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        {isProcessing ? (
                          <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-6 h-6 text-green-500 dark:text-green-400 flex-shrink-0" />
                        )}
                      </div>

                      {error && (
                        <div className="flex items-start gap-2.5 text-rose-300 text-xs font-medium p-4 bg-rose-500/10 rounded-2xl border border-rose-500/30">
                          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold text-rose-200">Analysis Notice:</span>
                            <p className="leading-relaxed">{error}</p>
                          </div>
                        </div>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={processFile}
                        disabled={isProcessing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-2xl py-3.5 sm:py-4 font-bold disabled:opacity-50 flex items-center justify-center gap-2 text-base sm:text-lg shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Analyzing Clinical Data...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Extract & Analyze with {provider === 'gemini' ? 'Gemini AI' : 'OpenAI'}
                          </>
                        )}
                      </motion.button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

