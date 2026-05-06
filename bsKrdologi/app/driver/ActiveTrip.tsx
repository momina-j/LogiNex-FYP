'use client';

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, MapPin, Loader2 } from 'lucide-react';

interface ActiveTripProps {
  route: {
    legs: Array<{
      status: 'pending' | 'in_progress' | 'completed';
      originName: string;
      destinationName: string;
    }>;
    totalDistanceMeters: number;
    totalMlEtaMinutes: number;
    predictedDelayMinutes?: number;
  };
}

const ActiveTrip: React.FC<ActiveTripProps> = ({ route }) => {
  const completedLegs = route.legs.filter(l => l.status === 'completed').length;
  const progressPercent = (completedLegs / route.legs.length) * 100;

  return (
    <div className="bg-[#171432] border border-white/5 rounded-3xl p-8 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 blur-[100px] pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1 block">Live Operations</span>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Current Assignment Progress</h2>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-white">{Math.round(progressPercent)}%</span>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Completed</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-white/5 rounded-full mb-10 overflow-hidden border border-white/5 p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_15px_rgba(234,88,12,0.4)]"
          />
        </div>

        {/* Status Line */}
        <div className="flex justify-between items-center px-2">
          {route.legs.map((leg, index) => {
            const isCompleted = leg.status === 'completed';
            const isInProgress = leg.status === 'in_progress';
            
            return (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center gap-3 relative">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                    isCompleted 
                      ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                      : isInProgress
                        ? 'bg-orange-600 border-orange-500 animate-pulse shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                        : 'bg-slate-800 border-slate-700'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : isInProgress ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <span className="text-sm font-black text-slate-500">{index + 1}</span>
                    )}
                  </div>
                  <div className="absolute top-12 whitespace-nowrap">
                     <p className={`text-[9px] font-black uppercase tracking-tighter ${isInProgress ? 'text-orange-500' : 'text-slate-500'}`}>
                        {index === 0 ? 'Pickup' : index === route.legs.length - 1 ? 'Dropoff' : `Hub ${index}`}
                     </p>
                  </div>
                </div>
                {index < route.legs.length - 1 && (
                  <div className="flex-1 h-px bg-white/10 mx-4 mt-[-20px] relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: isCompleted ? '100%' : '0%' }}
                      className="absolute inset-0 bg-emerald-500/50"
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      {/* Bottom context block */}
      <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-white/5">
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
               <MapPin className="w-4 h-4" />
            </div>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase">Current Node</p>
               <p className="text-xs font-black uppercase tracking-tight text-white">
                  {route.legs.find(l => l.status === 'in_progress')?.originName || 'Complete'}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
               <Clock className="w-4 h-4" />
            </div>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase">Total Timing</p>
               <div className="flex flex-col">
                  <p className="text-xs font-black uppercase tracking-tight text-white">{route.totalMlEtaMinutes} Minutes</p>
                  {route.predictedDelayMinutes && (
                    <p className="text-[9px] font-black uppercase text-orange-500">+{Math.round(route.predictedDelayMinutes)}m Likely Delay</p>
                  )}
               </div>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
               <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase">Security Hash</p>
               <p className="text-[10px] font-mono text-emerald-500 font-bold">LX-{Math.random().toString(36).substring(7).toUpperCase()}</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ActiveTrip;
