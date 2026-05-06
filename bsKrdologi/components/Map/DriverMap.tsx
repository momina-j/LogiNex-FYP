'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useAppStore } from '@/lib/store';
import { Truck, Navigation, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import 'leaflet/dist/leaflet.css';
let L: any = null;
let DriverIcon: any = null;

if (typeof window !== 'undefined') {
  L = require('leaflet');

  // Custom Driver Icon
  DriverIcon = L.divIcon({
    className: 'custom-driver-icon',
    html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function RecenterMap({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 15);
  }, [position, map]);
  return null;
}

export default function DriverMap() {
  const { user } = useAppStore();
  const [position, setPosition] = useState<[number, number]>([24.8607, 67.0011]); // Default Karachi
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!isTracking) return;

    const updateLocation = async (lat: number, lng: number) => {
      if (!user?.id) return;
      try {
        await fetch('http://127.0.0.1:5001/api/driver/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: user.id,
            lat,
            lng
          })
        });
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Location update failed', err);
      }
    };

    // Simulate movement for prototype if geolocation is unavailable
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setPosition([latitude, longitude]);
            updateLocation(latitude, longitude);
          },
          (err) => {
            // Fallback: slight random jitter for simulation
            setPosition(prev => {
              const next: [number, number] = [prev[0] + (Math.random() - 0.5) * 0.001, prev[1] + (Math.random() - 0.5) * 0.001];
              updateLocation(next[0], next[1]);
              return next;
            });
          }
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isTracking, user?.id]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0d0d]">
      <div className="absolute top-4 left-4 z-[1000] space-y-2">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <h3 className="font-bold text-white text-sm">Tracking Status</h3>
          </div>
          <p className="text-slate-400 text-xs mb-3">
            {isTracking ? `Updating every 5 seconds` : 'Location updates paused'}
          </p>
          <button
            onClick={() => setIsTracking(!isTracking)}
            className={`w-full py-2 rounded-lg font-bold text-xs transition-all ${
              isTracking ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50' : 'bg-emerald-500 text-white'
            }`}
          >
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </button>
        </motion.div>

        {lastUpdate && (
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-700 text-[10px] text-slate-500"
          >
            Last update: {lastUpdate.toLocaleTimeString()}
          </motion.div>
        )}
      </div>

      <MapContainer 
        center={position} 
        zoom={15} 
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <RecenterMap position={position} />
        <Marker position={position} icon={DriverIcon}>
          <Popup>
            <div className="text-slate-900 font-bold">You are here</div>
            <div className="text-slate-500 text-xs">Driver ID: {user?.id}</div>
          </Popup>
        </Marker>
      </MapContainer>

      <style jsx global>{`
        .leaflet-container { background: #0f172a !important; }
        .custom-driver-icon { display: flex; align-items: center; justify-content: center; }
      `}</style>
    </div>
  );
}
