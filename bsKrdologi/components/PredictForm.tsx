'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Calculator, ArrowRight, Loader2, Sparkles, MapPin, Truck, Bike, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
import { calculateHaversineDistance, formatEta } from '@/lib/map-utils';
import { useMapEvents } from 'react-leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });

// Leaflet markers fix
import 'leaflet/dist/leaflet.css';
let L: any = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');

  // Fix for default marker icons
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const LocationPicker = ({ onPick }: { onPick: (pos: [number, number]) => void }) => {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

export const PredictForm = () => {
  const [formData, setFormData] = useState({
    distance: '',
    weight: '1',
    volume: '0.01',
    vehicleType: 'bike'
  });
  
  const [pickup, setPickup] = useState<[number, number] | null>(null);
  const [dropoff, setDropoff] = useState<[number, number] | null>(null);
  const [prediction, setPrediction] = useState<{ eta: number; cost: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<'map' | 'details'>('map');

  // Sync distance when map points change
  useEffect(() => {
    if (pickup && dropoff) {
      const dist = calculateHaversineDistance(pickup[0], pickup[1], dropoff[0], dropoff[1]);
      setFormData(prev => ({ ...prev, distance: dist.toFixed(2) }));
    }
  }, [pickup, dropoff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPrediction(null);

    try {
      // Cost prediction (based on LOGISTICS_CONFIG logic usually, but here we can mock or use a similar logic)
      const costResponse = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance: parseFloat(formData.distance),
          weight: parseFloat(formData.weight),
          volume: parseFloat(formData.volume),
          vehicleType: formData.vehicleType
        })
      });

      const contentType = costResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError('Server returned an invalid response (500 Internal Server Error).');
        setLoading(false);
        return;
      }

      const data = await costResponse.json();
      if (data.success) {
        setPrediction({
          eta: data.prediction,
          cost: parseFloat(formData.distance) * 25 + parseFloat(formData.weight) * 10 + 200 // Mock cost logic based on dist
        });
      } else {
        setError(data.error || 'Failed to get prediction');
      }
    } catch (err) {
      setError('Connection error. Is the Flask server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-1 bg-gradient-to-br from-orange-500 via-rose-600 to-indigo-600 rounded-[2.5rem] shadow-2xl">
      <div className="bg-[#0a081e] rounded-[2.4rem] overflow-hidden relative">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          
          {/* Left Side: Map Selection */}
          <div className="h-[400px] lg:h-auto relative bg-slate-900 border-r border-white/5">
            <MapContainer 
              center={[24.8607, 67.0011]} 
              zoom={12} 
              className="h-full w-full z-0"
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <LocationPicker onPick={(pos) => {
                if (!pickup) setPickup(pos);
                else if (!dropoff) setDropoff(pos);
                else {
                  setPickup(pos);
                  setDropoff(null);
                }
              }} />
              
              {pickup && <Marker position={pickup} icon={L.divIcon({ className: 'bg-orange-500 w-4 h-4 rounded-full border-2 border-white shadow-lg shadow-orange-500/50' })} />}
              {dropoff && <Marker position={dropoff} icon={L.divIcon({ className: 'bg-rose-500 w-4 h-4 rounded-full border-2 border-white shadow-lg shadow-rose-500/50' })} />}
              {pickup && dropoff && (
                <Polyline positions={[pickup, dropoff]} pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '10, 10' }} />
              )}
            </MapContainer>

            {/* Map Overlay info */}
            <div className="absolute top-4 left-4 z-[1000] space-y-2">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white text-xs font-bold flex items-center gap-2">
                <MapPin className="w-3 h-3 text-orange-500" />
                {!pickup ? 'Select Pickup Point' : !dropoff ? 'Select Dropoff Point' : 'Route Ready'}
              </div>
            </div>

            {formData.distance && (
              <div className="absolute bottom-4 left-4 z-[1000]">
                <div className="bg-orange-600 text-white px-4 py-2 rounded-xl font-black text-sm shadow-xl">
                  {formData.distance} KM
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Form & Results */}
          <div className="p-8 md:p-10 relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                Smart <span className="text-orange-500">Predictor</span>
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vehicle</label>
                  <select 
                    className="w-full bg-[#171432] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 text-sm font-bold appearance-none"
                    value={formData.vehicleType}
                    onChange={e => setFormData({...formData, vehicleType: e.target.value})}
                  >
                    <option value="bike">Bike (Fast)</option>
                    <option value="rickshaw">Rickshaw</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                    <option value="truck">Truck</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Weight (kg)</label>
                  <input
                    type="number" required
                    className="w-full bg-[#171432] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 text-sm font-bold"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !formData.distance}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-30 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg group uppercase tracking-widest text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Calculate ETA & Price</>}
              </button>
            </form>

            <AnimatePresence>
              {prediction && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-center">
                      <p className="text-[10px] font-black text-orange-500/60 uppercase tracking-widest mb-1 text-nowrap">Est. Arrival</p>
                      <p className="text-2xl font-black text-white">{formatEta(prediction.eta)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-center">
                      <p className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest mb-1 text-nowrap">Est. Cost</p>
                      <p className="text-2xl font-black text-white">Rs. {Math.round(prediction.cost)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Navigation className="w-3 h-3 text-orange-500" /> {formData.distance} km route</span>
                    <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-blue-500" /> {formData.vehicleType}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold text-center uppercase tracking-widest">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
