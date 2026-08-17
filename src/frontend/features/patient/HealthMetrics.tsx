import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthProvider';
import { db } from '../../firebase/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  deleteDoc,
  doc,
  limit
} from 'firebase/firestore';
import { Activity, Plus, TrendingUp, TrendingDown, Scale, Heart, Droplet, Ruler, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MetricEntry {
  id: string;
  type: string;
  value: number;
  unit: string;
  timestamp: any;
}

interface HealthMetricsProps {
  userId?: string;
  readOnly?: boolean;
}

const METRIC_CONFIG: Record<string, { label: string; icon: any; unit: string; color: string; bg: string }> = {
  weight: { label: 'Weight', icon: Scale, unit: 'kg', color: 'text-amber-400', bg: 'bg-[#0a0a0a] border-white/10' },
  blood_pressure_sys: { label: 'Sys BP', icon: Activity, unit: 'mmHg', color: 'text-rose-400', bg: 'bg-[#0a0a0a] border-white/10' },
  heart_rate: { label: 'Heart Rate', icon: Heart, unit: 'bpm', color: 'text-pink-400', bg: 'bg-[#0a0a0a] border-white/10' },
  glucose: { label: 'Glucose', icon: Droplet, unit: 'mg/dL', color: 'text-emerald-400', bg: 'bg-[#0a0a0a] border-white/10' },
  height: { label: 'Height', icon: Ruler, unit: 'cm', color: 'text-blue-400', bg: 'bg-[#0a0a0a] border-white/10' },
};

const HealthMetrics: React.FC<HealthMetricsProps> = ({ userId, readOnly }) => {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.uid;
  
  const [metrics, setMetrics] = useState<Record<string, MetricEntry>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newMetric, setNewMetric] = useState({ type: 'weight', value: '' });

  useEffect(() => {
    if (!effectiveUserId) return;

    const q = query(
      collection(db, `users/${effectiveUserId}/metrics`),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snap) => {
      const latest: Record<string, MetricEntry> = {};
      snap.docs.forEach(docSnap => {
        const data = docSnap.data() as Omit<MetricEntry, 'id'>;
        if (!latest[data.type]) {
          latest[data.type] = { id: docSnap.id, ...data };
        }
      });
      setMetrics(latest);
    });
  }, [effectiveUserId]);

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId || !newMetric.value || readOnly) return;

    try {
      await addDoc(collection(db, `users/${effectiveUserId}/metrics`), {
        type: newMetric.type,
        value: parseFloat(newMetric.value),
        unit: METRIC_CONFIG[newMetric.type]?.unit || '',
        timestamp: serverTimestamp()
      });
      setIsAdding(false);
      setNewMetric({ type: 'weight', value: '' });
    } catch (err) {
      console.error("Error adding metric:", err);
    }
  };

  const deleteMetric = async (id: string) => {
    if (!effectiveUserId || readOnly || !window.confirm("Are you sure you want to delete this recording?")) return;
    try {
      await deleteDoc(doc(db, `users/${effectiveUserId}/metrics`, id));
    } catch (err) {
      console.error("Error deleting metric:", err);
    }
  };

  const calculateBMI = () => {
    const weight = metrics['weight']?.value;
    const height = metrics['height']?.value;
    if (weight && height) {
      const heightInM = height / 100;
      return (weight / (heightInM * heightInM)).toFixed(1);
    }
    return null;
  };

  const bmi = calculateBMI();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base sm:text-lg font-bold text-white">Vital Biometric Stats</h2>
        {!readOnly && (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAdding(true)}
            className="px-3.5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 flex items-center gap-1.5 font-semibold text-xs tracking-tight"
          >
            <Plus className="w-4 h-4" />
            Log Data
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {Object.entries(METRIC_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          const data = metrics[type];
          return (
            <motion.div 
              key={type}
              layout
              className={`group relative p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border ${config.bg} shadow-md hover:border-white/20 transition-all overflow-hidden`}
            >
              {data && !readOnly && (
                <button 
                  onClick={() => deleteMetric(data.id)}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-800 text-gray-400 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm pointer-events-auto z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg bg-white/5 border border-white/5 shadow-sm ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{config.label}</div>
                <div className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {data ? `${data.value}` : '--'}
                  <span className="text-[10px] ml-1 font-semibold text-gray-400 uppercase">{config.unit}</span>
                </div>
                {data && (
                  <div className="text-[10px] text-gray-400 font-medium truncate">
                    {new Date(data.timestamp?.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* BMI Card */}
        {bmi && (
           <motion.div 
            layout
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-500/30 bg-blue-950/30 transition-all col-span-2 relative overflow-hidden flex flex-col justify-between shadow-lg"
          >
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-600/15 blur-2xl" />
             <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-white/10 text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px] text-blue-300 font-bold uppercase tracking-wider border border-blue-500/30">
                  BMI
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-medium text-blue-300 uppercase tracking-wider">Body Mass Index</div>
                <div className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {bmi}
                  <span className="text-xs ml-2 font-medium text-blue-300 uppercase">
                    {parseFloat(bmi) < 18.5 ? 'Underweight' : parseFloat(bmi) < 25 ? 'Healthy' : 'Overweight'}
                  </span>
                </div>
              </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-[#0a0a0a] border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden text-white"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Manual Log</h3>
                  <p className="text-xs text-gray-400 font-medium">Record a new health data point.</p>
                </div>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMetric} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-0.5">Stat Type</label>
                  <select 
                    value={newMetric.type}
                    onChange={(e) => setNewMetric({ ...newMetric, type: e.target.value })}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-xs sm:text-sm text-white appearance-none pr-10"
                  >
                    {Object.entries(METRIC_CONFIG).map(([type, config]) => (
                      <option key={type} value={type} className="bg-neutral-900 text-white">{config.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-0.5">Recorded Value ({METRIC_CONFIG[newMetric.type]?.unit})</label>
                  <input 
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={newMetric.value}
                    onChange={(e) => setNewMetric({ ...newMetric, value: e.target.value })}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 text-lg font-bold text-white placeholder:text-gray-600 shadow-inner"
                    autoFocus
                  />
                </div>

                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-xs sm:text-sm uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                >
                  Save Entry
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HealthMetrics;
