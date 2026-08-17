import { Activity, Mail, Phone, MapPin, Twitter, Github, Linkedin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16 px-4">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Activity className="text-white w-6 h-6" />
              </div>
              <span className="font-sans font-bold text-2xl tracking-tight">AiCare</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Empowering individuals with advanced AI health diagnostics and professional-grade insights at home.
            </p>
            <div className="flex items-center gap-4">
               {[Twitter, Github, Linkedin].map((Icon, i) => (
                 <a key={i} href="#" className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center hover:bg-blue-600 hover:border-blue-600 transition-all">
                   <Icon className="w-5 h-5" />
                 </a>
               ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Quick Links</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
               <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
               <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
               <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
               <li><a href="#assistant" className="hover:text-white transition-colors">AI Assistant</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Services</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
               <li><a href="#" className="hover:text-white transition-colors">Lab Analysis</a></li>
               <li><a href="#" className="hover:text-white transition-colors">Predictive Modeling</a></li>
               <li><a href="#" className="hover:text-white transition-colors">Trend Visualization</a></li>
               <li><a href="#" className="hover:text-white transition-colors">Doctor Referral</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Contact Us</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
               <li className="flex items-center gap-3">
                 <Mail className="w-4 h-4 text-blue-500" />
                 support@aicare.ai
               </li>
               <li className="flex items-center gap-3">
                 <Phone className="w-4 h-4 text-blue-500" />
                 +1 (555) 000-HEALTH
               </li>
               <li className="flex items-center gap-3">
                 <MapPin className="w-4 h-4 text-blue-500" />
                 Silicon Valley, CA
               </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-10 flex flex-col md:flex-row items-center justify-between gap-6 px-4">
           <p className="text-gray-500 text-xs text-center md:text-left">
             © 2026 AiCare Intelligence Inc. All rights reserved. 
             Medical Disclaimer: AiCare provides information, not professional medical advice, diagnosis, or treatment.
           </p>
           <div className="flex gap-6 text-xs text-gray-500">
             <a href="#" className="hover:text-white">Privacy Policy</a>
             <a href="#" className="hover:text-white">Terms of Service</a>
             <a href="#" className="hover:text-white">Cookie Settings</a>
           </div>
        </div>
      </div>
    </footer>
  );
}
