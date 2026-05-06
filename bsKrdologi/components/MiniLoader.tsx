'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Truck, Car, Bike } from 'lucide-react';
import { useState, useEffect } from 'react';

const RickshawIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M6 15h12v-5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v5Z" />
    <path d="M13 8V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
    <path d="M6 15H3" />
  </svg>
);

const transportIcons = [
  { icon: RickshawIcon },
  { icon: Bike },
  { icon: Car },
  { icon: Truck },
];

export const MiniLoader = () => {
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % transportIcons.length);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const ActiveIcon = transportIcons[iconIndex].icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className="fixed top-6 right-10 z-[100] flex items-center gap-4 bg-[#111111]/80 backdrop-blur-xl border border-white/[0.05] rounded-2xl px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
    >
      <div className="flex flex-col gap-1.5">
         <div className="flex justify-between items-center px-0.5">
            <span className="text-red-600 font-black text-[7px] uppercase tracking-[0.3em]">Synching Grid</span>
            <div className="flex gap-0.5">
               <span className="w-1 h-1 rounded-full bg-red-600 animate-pulse" />
               <span className="w-1 h-1 rounded-full bg-red-600 animate-pulse delay-75" />
               <span className="w-1 h-1 rounded-full bg-red-600 animate-pulse delay-150" />
            </div>
         </div>
         <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden relative">
            <motion.div 
               className="absolute top-0 left-0 h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
               animate={{ 
                  width: ["0%", "100%", "0%"],
                  left: ["0%", "0%", "100%"] 
               }}
               transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
               }}
            />
         </div>
      </div>

      <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center relative overflow-hidden group">
         <div className="absolute inset-0 bg-red-600/5 blur-md" />
         <AnimatePresence mode="wait">
            <motion.div
               key={iconIndex}
               initial={{ y: 10, opacity: 0, scale: 0.8 }}
               animate={{ y: 0, opacity: 1, scale: 1 }}
               exit={{ y: -10, opacity: 0, scale: 0.8 }}
               transition={{ duration: 0.3 }}
               className="text-red-600 relative z-10"
            >
               <ActiveIcon className="w-5 h-5" />
            </motion.div>
         </AnimatePresence>
      </div>
    </motion.div>
  );
};
