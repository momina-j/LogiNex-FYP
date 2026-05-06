'use client';

import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Navigation, Clock, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { getFullGoogleMapsUrl } from '@/lib/googleMapsUrlBuilder';

interface RouteLegCardProps {
  leg: {
    originName: string;
    destinationName: string;
    originCoords: { lat: number; lng: number };
    destinationCoords: { lat: number; lng: number };
    distanceMeters: number;
    mlPredictedEtaMinutes: number;
    status: 'pending' | 'in_progress' | 'completed';
    type: string;
  };
  onNavigate: () => void;
}

export const RouteLegCard: React.FC<RouteLegCardProps> = ({ leg, onNavigate }) => {
  const isCompleted = leg.status === 'completed';
  const isInProgress = leg.status === 'in_progress';
  const distanceKm = (leg.distanceMeters / 1000).toFixed(1);

  const fullUrl = getFullGoogleMapsUrl(leg.originCoords, leg.destinationCoords);

  // Traffic indicator color based on (this is a mock logic for the UI)
  const trafficColor = leg.mlPredictedEtaMinutes > (leg.distanceMeters / 500) ? '#f43f5e' : '#10b981';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative p-5 rounded-2xl border transition-all duration-300 ${
        isCompleted 
          ? 'bg-slate-900/40 border-slate-800' 
          : isInProgress 
            ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-900/20' 
            : 'bg-[#171432] border-white/5'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <div className="bg-emerald-500/20 p-1.5 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          ) : (
            <div className={`p-1.5 rounded-full border ${isInProgress ? 'bg-orange-500/20 border-orange-500/40' : 'bg-slate-800 border-slate-700'}`}>
              <Navigation className={`w-4 h-4 ${isInProgress ? 'text-orange-500' : 'text-slate-400'}`} />
            </div>
          )}
          <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-500' : isInProgress ? 'text-orange-500' : 'text-slate-500'}`}>
            Leg: {leg.type.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
             <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: trafficColor }} />
             <span className="text-[9px] font-bold text-slate-300 uppercase">Traffic</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">From</p>
          <p className="text-white font-bold truncate">{leg.originName}</p>
        </div>
        <div className="flex flex-col items-center">
          <ArrowRight className="w-4 h-4 text-orange-500/50" />
          <div className="h-px w-12 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent my-1" />
        </div>
        <div className="flex-1 text-right">
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">To</p>
          <p className="text-white font-bold truncate">{leg.destinationName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-400" />
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase">ML Predicted</p>
            <p className="text-xs text-white font-black">{Math.round(leg.mlPredictedEtaMinutes)} MINS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-orange-400" />
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase">Distance</p>
            <p className="text-xs text-white font-black">{distanceKm} KM</p>
          </div>
        </div>
      </div>

      {!isCompleted && (
        <div className="flex gap-2 mt-6">
          <button
            onClick={onNavigate}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black py-2.5 rounded-xl transition-all active:scale-95"
          >
            <Navigation className="w-3.5 h-3.5" />
            NAVIGATE LEG
          </button>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </motion.div>
  );
};
