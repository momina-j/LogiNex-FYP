'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/translations';

export function Navbar({ transparent = false }: { transparent?: boolean } = {}) {
  const { language, setLanguage } = useAppStore();
  const t = translations[language as keyof typeof translations];

  const bgClass = transparent 
    ? 'bg-black/10 backdrop-blur-xl border-b border-white/[0.05] text-white' 
    : 'bg-[#0d0d0d] text-white border-b border-white/[0.05]';

  const linkHoverClass = "px-5 py-2.5 rounded-2xl transition-all duration-500 text-[11px] font-[900] uppercase tracking-[0.2em] hover:bg-white/[0.03] hover:text-red-500";

  return (
    <header className={`absolute top-0 left-0 right-0 z-50 transition-all ${bgClass}`}>
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 py-6 flex justify-between items-center">
        
        {/* Logo Block */}
        <Link href="/">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
               <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                 <div className="w-2 h-2 bg-white rounded-full opacity-80" />
               </div>
               <div className="text-2xl font-[900] tracking-tighter uppercase italic">
                 <span className="text-white">LOGIN</span>
                 <span className="text-red-600">EX</span>
               </div>
            </div>
          </motion.div>
        </Link>

        {/* Center Nav Block */}
        <nav className="hidden lg:flex items-center space-x-2">
          <Link href="/store" className={`${linkHoverClass} flex items-center gap-3 text-red-500`}>
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
            Live Store
          </Link>
          <Link href="#about" className={linkHoverClass}>Strategy</Link>
          <Link href="#services" className={linkHoverClass}>Network</Link>
          <Link href="#blog" className={linkHoverClass}>Intelligence</Link>
          <Link href="#contact" className={linkHoverClass}>Secure Portal</Link>
        </nav>

        {/* Right Nav Block */}
        <div className="flex items-center gap-6">
          <Link href="/login" className="hidden sm:block">
            <motion.div 
              whileHover={{ y: -1 }}
              className="text-[11px] font-[900] uppercase tracking-[0.2em] text-neutral-400 hover:text-white transition-colors"
            >
              Contact Support
            </motion.div>
          </Link>

          <button 
            onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
            className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-[10px] font-black text-white hover:bg-white/[0.06] transition-all"
          >
            {language === 'en' ? 'EN' : 'UR'}
          </button>

          <Link href="/dashboard">
             <button className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-[900] uppercase tracking-[0.2em] px-8 py-3.5 rounded-2xl shadow-2xl shadow-red-900/20 transition-all hover:scale-105 active:scale-95">
                Dashboard
             </button>
          </Link>
        </div>

      </div>
    </header>
  );
}


