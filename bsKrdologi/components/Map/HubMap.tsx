'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { useNearbyDrivers } from '@/hooks/useDriverTracking';
import { Users, Search, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_HUB_LOCATION: [number, number] = [24.8607, 67.0011]; // Sample Hub (Karachi Center)

let L: any = null;
let DriverIcon: any = null;
let HubIcon: any = null;

if (typeof window !== 'undefined') {
  L = require('leaflet');

  DriverIcon = L.divIcon({
    className: 'driver-marker',
    html: `<div style="background-color: #f59e0b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px #f59e0b;"></div>`,
    iconSize: [12, 12],
  });

  HubIcon = L.divIcon({
    className: 'hub-marker',
    html: `<div style="background-color: #10b981; width: 16px; height: 16px; border-radius: 4px; border: 2px solid white; box-shadow: 0 0 10px #10b981;"></div>`,
    iconSize: [16, 16],
  });
}

interface HubMapProps {
  hubLocation: { lat: number; lng: number } | null;
  radiusKm?: number;
}

export default function HubMap({ hubLocation, radiusKm = 5 }: HubMapProps) {
  const [radius, setRadius] = useState(radiusKm); // km
  const currentHubLocation = hubLocation ? [hubLocation.lat, hubLocation.lng] as [number, number] : DEFAULT_HUB_LOCATION;
  const { drivers, loading } = useNearbyDrivers(currentHubLocation, radius);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
      {/* Overlay Controls */}
      <div className="absolute top-4 right-4 z-[1000] w-64 space-y-3">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> nearby Drivers
            </h3>
            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20">
              {drivers.length} Found
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Radius Range</span>
              <span className="text-emerald-500 font-bold">{radius} km</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
        >
          <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Live Fleet</h4>
          <div className="space-y-2">
            {drivers.map(driver => (
              <div key={driver.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[11px] font-bold truncate">Driver {driver.id.slice(0, 6)}</p>
                  <p className="text-slate-500 text-[9px]">Active now</p>
                </div>
              </div>
            ))}
            {drivers.length === 0 && (
              <p className="text-slate-500 text-center py-4 text-[10px]">No drivers in range</p>
            )}
          </div>
        </motion.div>
      </div>

      <MapContainer 
        center={currentHubLocation} 
        zoom={13} 
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <Marker position={currentHubLocation} icon={HubIcon}>
          <Popup>
            <div className="text-slate-900 font-bold">Your Hub</div>
          </Popup>
        </Marker>

        <Circle 
          center={currentHubLocation} 
          radius={radius * 1000} 
          pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }} 
        />

        {drivers.map(driver => (
          <Marker key={driver.id} position={[driver.lat, driver.lng]} icon={DriverIcon}>
            <Popup>
              <div className="text-slate-900 font-bold">Driver Presence</div>
              <div className="text-slate-500 text-xs">ID: {driver.id}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
}
