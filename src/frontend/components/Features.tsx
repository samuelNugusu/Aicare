import { Search, Brain, MessageSquare, Microscope, Clock, Shield } from 'lucide-react';
import { motion } from 'motion/react';

const features = [
  {
    icon: Microscope,
    title: "Smart Lab Analysis",
    description: "Upload PDF or photos of your blood work. Our AI extracts and explains every marker in simple terms.",
    color: "bg-blue-500"
  },
  {
    icon: Brain,
    title: "Predictive Diagnostics",
    description: "Identify potential health risks before they become symptoms using advanced genetic and biomarker modeling.",
    color: "bg-indigo-500"
  },
  {
    icon: MessageSquare,
    title: "24/7 Health Assistant",
    description: "Get instant answers to medical questions, medication info, and wellness tips from our expert AI coach.",
    color: "bg-purple-500"
  },
  {
    icon: Clock,
    title: "Trend Tracking",
    description: "Visualize your health over time with automated tracking of your historical lab results and vitals.",
    color: "bg-teal-500"
  },
  {
    icon: Shield,
    title: "Doctor Verification",
    description: "Easily share reports with your physician through our secure, encrypted health portal.",
    color: "bg-rose-500"
  },
  {
    icon: Search,
    title: "Intelligent Recommendations",
    description: "Personalized diet, exercise, and supplement advice tailored specifically to your unique biological data.",
    color: "bg-orange-500"
  }
];

export default function Features() {
  return (
    <section id="features" className="py-16 sm:py-20 bg-[#050505] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 px-4">
          <span className="text-blue-400 font-semibold uppercase tracking-wider text-xs">Features</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mt-2.5 mb-3.5 tracking-tight">
            Advanced AI Health Features
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Our platform combines cutting-edge machine learning with verified medical knowledge 
            to provide you with accurate, real-time health insights.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4 }}
              className="bg-white/[0.03] p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-white/10 shadow-lg hover:border-blue-500/30 hover:bg-white/[0.05] transition-all"
            >
              <div className={`w-11 h-11 sm:w-12 sm:h-12 ${feature.color} rounded-xl sm:rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-black/40`}>
                <feature.icon className="text-white w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed text-xs sm:text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
