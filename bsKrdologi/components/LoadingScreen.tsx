'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Truck, Car, Bike, Package, Zap } from 'lucide-react';

const icons = [
  { icon: Bike, label: 'Express Node' },
  { icon: Zap, label: 'Rickshaw Vector' },
  { icon: Car, label: 'Field Unit' },
  { icon: Truck, label: 'Logistics Van' },
  { icon: Package, label: 'Heavy Hauler' },
];

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
  { icon: RickshawIcon, label: 'Rickshaw' },
  { icon: Bike, label: 'Bike' },
  { icon: Car, label: 'Car' },
  { icon: Truck, label: 'Van' },
  { icon: Truck, label: 'Heavy Truck' },
];

interface LoadingScreenProps {
  onComplete?: () => void;
}

export const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [currentIconIndex, setCurrentIconIndex] = useState(0);

  useEffect(() => {
    const duration = 2500; // 2.5 seconds
    const interval = 20; // 20ms steps
    const increment = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          if (onComplete) setTimeout(onComplete, 400); 
          return 100;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  useEffect(() => {
    // Cycle icon every 20% progress
    const index = Math.min(Math.floor((progress / 100) * transportIcons.length), transportIcons.length - 1);
    setCurrentIconIndex(index);
  }, [progress]);

  const ActiveIcon = transportIcons[currentIconIndex].icon;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8" style={{ background: 'linear-gradient(135deg, #62161aff 0%, #2a080aff 100%)' }}>
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-4xl relative">
        {/* Status Text */}
        <div className="flex justify-between items-end mb-16">
          <div className="space-y-4">
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 font-black text-xs uppercase tracking-[0.5em]"
            >
              System Initialization
            </motion.p>
            <h2 className="text-white font-[900] text-5xl md:text-6xl uppercase italic tracking-tighter">
                WELCOME TO <span className="text-white">LOGINEX</span>
            </h2>
          </div>
          <div className="text-right">
             <p className="text-white font-black text-6xl md:text-7xl italic tracking-tighter">
                {Math.round(progress)}<span className="text-red-600">%</span>
             </p>
          </div>
        </div>

        {/* Loading Bar Container */}
        <div className="h-3 w-full bg-white/[0.05] rounded-full relative overflow-visible shadow-inner">
          {/* Main Progress Bar */}
          <motion.div 
            className="absolute top-0 left-0 h-full bg-red-600 rounded-full shadow-[0_0_40px_rgba(220,38,38,0.7)]"
            style={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          />

          {/* Leading Icon Container */}
          <motion.div 
            className="absolute top-[-80px] flex flex-col items-center"
            style={{ left: `${progress}%`, translateX: '-50%' }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIconIndex}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                className="relative"
              >
                {/* Vehicle Glow */}
                <div className="absolute inset-0 bg-red-600/30 blur-3xl rounded-full" />
                
                {/* Active Vehicle Icon */}
                <motion.div
                  animate={{ 
                    y: [0, -8, 0],
                    rotate: [0, 3, -3, 0]
                  }}
                  transition={{ 
                    duration: 0.4, 
                    repeat: Infinity,
                    ease: "easeInOut" 
                  }}
                  className="relative z-10 text-white"
                >
                  <ActiveIcon className="w-14 h-14 md:w-20 md:h-20 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
                </motion.div>
              </motion.div>
            </AnimatePresence>
            
            {/* Lead Pointer */}
            <div className="w-0.5 h-16 bg-gradient-to-t from-red-600 to-transparent mt-4 opacity-50" />
          </motion.div>
        </div>

        {/* Console Logs Simulation */}
        <div className="mt-20 space-y-3">
           <div className="flex gap-4 text-[10px] font-mono tracking-[0.3em] uppercase">
              <span className="text-red-500/50">NODE_AUTH:</span>
              <span className="text-neutral-400 font-bold">
                {progress < 20 ? 'Initializing Secure Handshake...' : 
                 progress < 40 ? 'Verifying Neural Grid Nodes...' :
                 progress < 70 ? 'Synching Logistics Core...' :
                 'Establishing Connection Protocol...'}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};
