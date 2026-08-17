import { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, CheckCircle2, Info, ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, Stethoscope, UserCheck, Clock, FileCheck } from 'lucide-react';
import { cn } from '../../utils/utils';
import { LabAnalysisData } from '../../../shared/types';

interface AnalysisResultsProps {
  data: LabAnalysisData;
  isDoctor?: boolean;
  status?: string;
  verifiedByDoctorName?: string;
  doctorSpecialty?: string;
  doctorNotes?: string;
  verifiedAt?: any;
  onVerify?: (notes?: string) => void;
  isVerifying?: boolean;
}

export default function AnalysisResults({ 
  data, 
  isDoctor, 
  status, 
  verifiedByDoctorName,
  doctorSpecialty,
  doctorNotes,
  verifiedAt,
  onVerify, 
  isVerifying 
}: AnalysisResultsProps) {
  const [clinicalNotesInput, setClinicalNotesInput] = useState(doctorNotes || '');

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'verified': return { icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-100 dark:border-emerald-900/40', label: 'Verified' };
      case 'critical': return { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-100 dark:border-red-900/40', label: 'Critical' };
      case 'high': return { icon: ArrowUpRight, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-100 dark:border-orange-900/40', label: 'High' };
      case 'low': return { icon: ArrowDownRight, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-100 dark:border-blue-900/40', label: 'Low' };
      default: return { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-100 dark:border-green-900/40', label: 'Normal' };
    }
  };

  const formattedDate = verifiedAt?.toDate 
    ? new Date(verifiedAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (verifiedAt ? new Date(verifiedAt).toLocaleDateString() : 'Recently');

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Physician Verification Seal / Official Certification Banner */}
      {status === 'verified' ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 rounded-2xl p-5 sm:p-6 border border-emerald-200 dark:border-emerald-800/50 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    Certified Clinical Review
                  </h3>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-emerald-600 text-white rounded-full">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mt-0.5 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Attending Physician: {verifiedByDoctorName || 'Staff Medical Officer'}</span>
                  {doctorSpecialty && <span className="opacity-75">• {doctorSpecialty}</span>}
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Certified on {formattedDate}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Physician Clinical Notes & Instructions:
            </span>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-800 dark:text-gray-200 bg-white/80 dark:bg-gray-900/60 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 leading-relaxed font-sans">
              {doctorNotes || "AI extracted biometric parameters have been reviewed and verified against clinical thresholds. All indicators align with standard diagnostic evaluation."}
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-pulse" />
            <div>
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                AI Diagnostic Extraction — Awaiting Physician Sign-Off
              </span>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Automated biomarkers are processed. Pending formal physician certification.
              </p>
            </div>
          </div>

          <span className="self-start sm:self-auto text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
            Queue Status: Pending Review
          </span>
        </div>
      )}

      {/* Doctor Action Panel (when viewing as Doctor and not yet verified) */}
      {isDoctor && status !== 'verified' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50/60 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <Stethoscope className="w-4 h-4" />
              Doctor Diagnostic Review & Notes
            </div>
            <span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
              Clinical Action Required
            </span>
          </div>

          <textarea
            value={clinicalNotesInput}
            onChange={(e) => setClinicalNotesInput(e.target.value)}
            placeholder="Add clinical observations, medication adjustments, or patient guidance here..."
            className="w-full p-3 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[80px]"
          />

          <div className="flex justify-end">
            <button
              onClick={() => onVerify && onVerify(clinicalNotesInput)}
              disabled={isVerifying}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isVerifying ? 'Certifying Diagnosis...' : 'Sign & Certify Verification'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-md transition-colors relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">AI Health Summary</h3>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm sm:text-base">
          {data.summary}
        </p>
        <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30 transition-colors">
           <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
           <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
             AI generated diagnostic extraction. Certified by participating healthcare providers.
           </p>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {data.keyMetrics.map((metric, i) => {
          const config = getStatusConfig(metric.status);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "bg-white dark:bg-gray-900 p-5 rounded-2xl border relative overflow-hidden group hover:shadow-md transition-all",
                config.border
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Biomarker</span>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{metric.marker}</p>
                </div>
                <div className={cn("p-1.5 rounded-lg", config.bg, config.color)}>
                  <config.icon className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{metric.unit}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100 dark:border-gray-800 transition-colors">
                <span className="text-gray-500 italic">Ref Range: {metric.referenceRange}</span>
                <span className={cn("font-semibold uppercase tracking-wider", config.color)}>{config.label}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recommendations & Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-md transition-colors">
          <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-500 dark:text-green-400 w-4 h-4" />
            Recommendations
          </h4>
          <ul className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-md transition-colors">
          <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500 dark:text-orange-400 w-4 h-4" />
            Predictive Insights
          </h4>
          <ul className="space-y-3">
            {data.predictiveAlerts.map((alert, i) => (
              <li key={i} className="flex gap-2.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 bg-orange-50/40 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30 transition-colors">
                <Minus className="text-orange-500 dark:text-orange-400 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
