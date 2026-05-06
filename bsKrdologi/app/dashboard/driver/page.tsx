'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
import { useDemoStore } from '@/lib/demo-store';
import { 
  MapPin, Navigation, DollarSign, CheckCircle2, Clock, AlertTriangle, 
  Package, RefreshCw, Zap, Search, Bell, MoreVertical, Star, ArrowUpRight
} from 'lucide-react';
import { translations } from '@/lib/translations';
import { getRouteETA } from '@/lib/etaService';
import { calculateHaversineDistance } from '@/lib/map-utils';
import { ParcelStatus } from '@/lib/demo-store';

import { NavigationModal } from '@/components/NavigationModal';
import { MapLocation } from '@/lib/googleMapsUrlBuilder';

const DriverMap = dynamic(() => import('@/components/Map/DriverMap'), { 
 ssr: false,
 loading: () => <div className="h-full w-full bg-[#111111] animate-pulse flex items-center justify-center text-white font-bold">Loading Satellite...</div>
});

export default function DriverDashboard() {
 const { currentUser, language } = useAppStore();
 const t = translations[language as keyof typeof translations];
 const { parcels, drivers, updateParcelStatus } = useDemoStore();
 const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
 const [socket, setSocket] = useState<Socket | null>(null);
 const [locationError, setLocationError] = useState<string | null>(null);
 const [fullScreenNav, setFullScreenNav] = useState(false);
 const [navigatingJobId, setNavigatingJobId] = useState<string | null>(null);

 type NavTarget = {
 origin: MapLocation;
 dest: MapLocation;
 waypoints?: MapLocation[];
 eta?: number;
 distKm?: number;
 confidence?: { min: number; max: number };
 triggers?: string[];
 };
 const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
 const [activeJobs, setActiveJobs] = useState<any[]>([]);
 const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'delayed'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [delayedJobs, setDelayedJobs] = useState<any[]>([]);

 const driverProfile = drivers.find(d => d.id === currentUser?.id) || {
 id: currentUser?.id || 'd1', name: currentUser?.name || 'Driver', vehicleType: 'Motorcycle', rating: 4.8, status: 'available', pricePerKm: 150
 };

 const fetchMyParcels = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const resDriver = await fetch(`/api-proxy/parcels/driver/${driverProfile.id}`);
      if (resDriver.ok) {
        const data = await resDriver.json();
        setActiveJobs(data.filter((p: any) => ['assigned', 'in_transit', 'shipped', 'pending_dispatch'].includes(p.status)));
        setDelayedJobs(data.filter((p: any) => p.status === 'delayed'));
        setCompletedJobs(data.filter((p: any) => p.status === 'delivered'));
      }
      const resPending = await fetch(`/api-proxy/parcels/pending`);
      if (resPending.ok) {
        const pendingData = await resPending.json();
        setRequests(pendingData);
      }
    } catch (err) {
      console.error('Fetch My Parcels Error:', err);
    }
  }, [currentUser?.id, driverProfile.id]);

 useEffect(() => {
 fetchMyParcels();
 }, [fetchMyParcels]);

 useEffect(() => {
 const socketHost = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5001` : 'http://localhost:5001';
 const s = io(socketHost); 
 setSocket(s);
 if (currentUser?.id) {
 s.emit('joinRoom', currentUser.id);
 s.emit('joinDriversRoom');
      s.on('newRideRequest', () => { fetchMyParcels(); });
    }
    return () => { s.disconnect(); };
  }, [currentUser?.id, fetchMyParcels]);

 useEffect(() => {
 if (!socket || !currentUser?.id || !navigator.geolocation) return;
    // THROTTLED LOCATION UPDATES (5 MINUTES)
    const lastUpdateRef = { current: 0 };
    const THROTTLE_INTERVAL = 5 * 60 * 1000; // 5 mins in ms

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newLoc = { lat: latitude, lng: longitude };
        setCurrentLocation(newLoc);

        const now = Date.now();
        if (now - lastUpdateRef.current > THROTTLE_INTERVAL) {
          console.log('[TELEMETRY] 5-minute sync triggered:', latitude, longitude);
          socket.emit('updateLocation', { userId: currentUser.id, ...newLoc });
          lastUpdateRef.current = now;
        }
      },
      (err) => console.warn('Geolocation error:', err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
 }, [socket, currentUser?.id]);

 const codCollected = completedJobs.filter(p => p.parcels?.[0]?.paymentMethod?.toUpperCase() === 'COD').reduce((acc, p) => acc + (p.parcels?.[0]?.codAmount || 0), 0);
 const onlinePayments = completedJobs.filter(p => p.parcels?.[0]?.paymentMethod?.toUpperCase() === 'ONLINE').reduce((acc, p) => acc + (p.parcels?.[0]?.unitPrice || 0), 0);

 const handleStatusUpdate = async (parcelId: string, status: ParcelStatus) => {
 try {
 const response = await fetch('/api-proxy/driver/update-status', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ driverId: driverProfile.id, parcelId, status })
 });
 if (response.ok) {
 updateParcelStatus(parcelId, status);
 fetchMyParcels();
 }
 } catch (err) {
 console.error(err);
 }
 };

 const handleStartNavigation = async () => {
 if (!currentLocation || activeJobs.length === 0) return;
 const job = activeJobs[0];
 const destMatch = (job.receiverAddress || '').match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
 const destCoords = (job.receiverLat && job.receiverLng)
 ? { lat: Number(job.receiverLat), lng: Number(job.receiverLng) }
 : destMatch ? { lat: parseFloat(destMatch[1]), lng: parseFloat(destMatch[2]) } : null;

 setNavTarget({
 origin: currentLocation,
 dest: destCoords || job.receiverAddress || 'Consignee Address',
 eta: job.estimatedDelivery || 30,
 distKm: 5
 });
 setFullScreenNav(true);
  };

  return (
    <main className="space-y-12 pb-20 overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="card-outer p-6 flex flex-col lg:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">Overview</h1>
          <div className="bg-[#E53935]/10 border border-[#E53935]/20 text-[#E53935] text-[10px] font-black px-4 py-1.5 rounded-full backdrop-blur-md tracking-widest uppercase">
            185 GB DATA
          </div>
        </div>

        <div className="flex-1 max-w-xl relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9d0406] transition-all"/>
          <input 
            type="text"
            placeholder="Search something..."
            className="w-full bg-white rounded-xl py-4 pl-14 pr-8 text-black text-xs font-bold focus:outline-none border-2 border-[#62161aff] focus:border-[#e0000a] transition-all placeholder:text-gray-400 shadow-md"
          />
        </div>

        <div className="flex items-center gap-4">
          <button className="w-12 h-12 card-inner flex items-center justify-center relative text-white border-white/5 hover:border-red-600/30 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-black/20 group">
            <Bell className="w-5 h-5 group-hover:text-red-600 transition-colors"/>
            <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#e0000a] text-white border-2 border-[#1A1A1A] text-[8px] font-black flex items-center justify-center">7</div>
          </button>
          <button className="w-12 h-12 card-inner flex items-center justify-center text-white border-white/5 hover:bg-[#e0000a]/10 hover:border-red-600/30 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-black/20 group">
            <ArrowUpRight className="w-5 h-5 group-hover:text-red-600 transition-colors"/>
          </button>
          <button className="bg-[#e0000a] hover:bg-[#c62828] text-white font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/20 whitespace-nowrap">
            Upgrade Plan
          </button>
        </div>
      </motion.div>

      {/* ── TOP GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* New Request Card */}
        <motion.div 
          whileHover={{ y: -4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
          className="aspect-square flex flex-col items-center justify-center gap-5 card-outer transition-all cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-xl border border-white/20 flex items-center justify-center text-white group-hover:text-white group-hover:border-white transition-all">
            <span className="text-2xl font-light">+</span>
          </div>
          <p className="text-white font-bold text-sm group-hover:text-white transition-colors">New Request</p>
        </motion.div>

        {/* Driver Stats Card */}
        <div className="aspect-square bg-[#62161aff] text-white backdrop-blur-md border border-white/20 rounded-2xl p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#62161aff] text-white backdrop-blur-md rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
          
          <div className="flex items-center justify-between mb-10 relative z-10">
            <h3 className="text-white font-bold text-[11px]">Driver Stats</h3>
            <MoreVertical className="w-5 h-5 text-white cursor-pointer hover:text-white transition-colors"/>
          </div>
          
          <div className="flex items-center gap-5 mb-auto relative z-10">
            <div className="w-16 h-16 rounded-xl card-inner flex items-center justify-center text-white font-bold text-2xl shadow-black/20">
              {currentUser?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-none tracking-tight">{currentUser?.name}</p>
              <p className="text-white text-xs mt-2 flex items-center gap-2 font-bold">
                Motorcycle • 4.8 <Star className="w-3.5 h-3.5 fill-[#ffffff] text-white"/>
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/20/30 relative z-10">
            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-white">
              <div>Jobs Today <br/><span className="text-white text-lg font-bold">23</span></div>
              <div className="text-right">Earnings <br/><span className="text-white text-lg font-bold">Rs 9k+</span></div>
            </div>
          </div>
        </div>

        {/* ── JOBS QUEUE (Requests, Active, Delayed) ── */}
        <div className="card-outer text-white backdrop-blur-md rounded-2xl p-6 flex flex-col relative overflow-hidden group lg:col-span-2 shadow-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#62161aff] text-white backdrop-blur-md rounded-full blur-[80px]"/>
          
          <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4 relative z-10 w-full overflow-x-auto custom-scrollbar">
            {[
              { id: 'requests', label: 'Ride Requests', count: requests.length },
              { id: 'active', label: 'Active', count: activeJobs.length },
              { id: 'delayed', label: 'Delayed', count: delayedJobs.length }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#e0000a] text-white shadow-lg shadow-red-900/40' : 'card-inner text-white/70 hover:text-white'} hover:scale-[1.02] active:scale-95`}
              >
                {tab.label} {tab.count > 0 && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="space-y-4 flex-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
            {(activeTab === 'requests' ? requests : activeTab === 'active' ? activeJobs : delayedJobs).length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-white/40 text-[10px] uppercase font-bold tracking-widest italic py-12">
                  <Package className="w-8 h-8 mb-2 opacity-30" />
                  No {activeTab} parcels available.
               </div>
            ) : (activeTab === 'requests' ? requests : activeTab === 'active' ? activeJobs : delayedJobs).map(job => (
               <div key={job.id} className="card-inner p-4 flex flex-col gap-4 rounded-2xl transition-colors hover:border-white/20">
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-[10px] text-[#e0000a] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                           <Package className="w-3 h-3"/> {job.trackingId}
                        </p>
                        <p className="text-sm font-bold text-white max-w-[200px] leading-tight truncate">{job.receiverAddress || job.city || 'N/A'}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] text-white/70 uppercase tracking-widest font-black mb-1">{job.paymentMethod || 'COD'}</p>
                        <p className="text-base font-black text-white bg-[#e0000a] px-3 py-1 rounded-lg">Rs.{job.parcels?.[0]?.codAmount || job.parcels?.[0]?.unitPrice || 0}</p>
                     </div>
                  </div>
                  
                  <div className="flex gap-2 mt-auto pt-2 border-t border-white/10">
                     {activeTab === 'requests' && (
                        <button onClick={() => handleStatusUpdate(job.id, 'assigned')} className="flex-1 bg-green-500 border border-green-400/30 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-green-900/40">
                           Accept Ride
                        </button>
                     )}
                     {activeTab === 'active' && (
                        <>
                           <button onClick={() => handleStatusUpdate(job.id, 'delivered')} className="flex-1 card-inner border-white/5 border text-emerald-400 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95">
                              Deliver
                           </button>
                           <button onClick={() => handleStatusUpdate(job.id, 'delayed')} className="flex-1 card-inner border-white/5 border text-orange-400 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500/10 hover:border-orange-500/30 transition-all hover:scale-[1.02] active:scale-95">
                              Delay
                           </button>
                        </>
                     )}
                     {activeTab === 'delayed' && (
                        <button onClick={() => handleStatusUpdate(job.id, 'delivered')} className="flex-1 card-inner border-emerald-500/30 text-emerald-400 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/10 transition-all hover:scale-[1.02] active:scale-95">
                           Resolve Delivery
                        </button>
                     )}
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-12">
        {/* Live Route Map */}
        <div className="lg:col-span-2 card-outer p-6 flex flex-col min-h-[550px] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"/>
          
          <h2 className="text-2xl font-bold text-white mb-10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#880305]/60 border border-white/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white"/>
            </div>
            Live Route Satellite
          </h2>

          <div className="flex-1 flex flex-col md:flex-row gap-12">
            <div className="md:w-3/5 rounded-2xl overflow-hidden border border-white/20 relative group">
              <DriverMap />
              <div className="absolute bottom-6 left-6 z-[1000]">
                <div className="card-inner px-5 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"/>
                  <span className="text-[10px] font-bold text-white">Signal Priority High</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-between py-2">
              <div className="space-y-10">
                <div>
                  <p className="text-white text-[10px] font-bold mb-6">Active Logistics</p>
                  <div className="space-y-8 relative">
                    <div className="absolute left-1.5 top-2 bottom-2 w-px bg-[#62161aff] text-white backdrop-blur-md"/>
                    
                    <div className="flex items-start gap-6 relative group">
                      <div className="w-3 h-3 rounded-full bg-[#62161aff] text-white backdrop-blur-md mt-2 shadow-[0_0_15px_rgba(255,255,255,0.6)] z-10 transition-transform group-hover:scale-125"/>
                      <div className="flex-1">
                        <p className="text-white text-[9px] font-bold mb-1">Origin Point</p>
                        <p className="text-white font-bold leading-tight text-sm">F Block Satellite Society, Lahore</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-6 relative group">
                      <div className="w-3 h-3 rounded-full bg-[#62161aff] text-white backdrop-blur-md/30 border border-white/200 mt-2 z-10"/>
                      <div className="flex-1">
                        <p className="text-white text-[9px] font-bold mb-1">Destination Target</p>
                        <p className="text-white font-bold leading-tight text-sm">Main Boulevard, Gulberg III</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-10">
                <button 
                  onClick={handleStartNavigation}
                  className="w-full card-inner font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-4 transform hover:-translate-y-1 active:translate-y-0"
                >
                  <Navigation className="w-5 h-5 fill-[#9d0406]"/> Initiate Route
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => alert('Analyzing...')}
                    className="card-inner py-2.5 hover:bg-[#880305]/40 transition-all text-[9px]"
                  >
                    Optimize
                  </button>
                  <button 
                    onClick={() => activeJobs[0] && handleStatusUpdate(activeJobs[0].id, 'delivered')}
                    className="card-inner text-emerald-300 py-2.5 hover:bg-[#880305]/40 transition-all text-[9px]"
                  >
                    Arrived
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Earnings */}
        <div className="card-outer p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#62161aff] text-white backdrop-blur-md rounded-full blur-[100px]"/>
          
          <div className="flex items-center justify-between mb-12 relative z-10">
            <h2 className="text-2xl font-bold text-white flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#880305]/60 border border-white/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white"/>
              </div>
              Revenue
            </h2>
            <div className="p-3 card-inner transition-colors cursor-pointer">
              <RefreshCw className="w-4 h-4"/>
            </div>
          </div>

          <div className="space-y-8 relative z-10">
            <div className="card-inner p-6 transform transition-transform group-hover:scale-[1.02] group-hover:-rotate-1">
              <p className="text-[#E53935]/60 text-[10px] font-bold mb-3">Live Collected (COD)</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-[#E53935] tracking-tighter drop-shadow-sm">Rs.{codCollected.toLocaleString()}</p>
                <div className="mb-1.5 w-2 h-2 rounded-full bg-[#62161aff] text-white backdrop-blur-md opacity-40 animate-pulse"/>
              </div>
            </div>
            
            <div className="card-inner p-6 group-hover:bg-[#880305]/40 transition-colors">
              <p className="text-white text-[10px] font-bold mb-3">Digital Settlements</p>
              <p className="text-2xl font-bold text-white tracking-tighter">Rs.{onlinePayments.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="mt-auto pt-10 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-[9px] font-bold mb-1">Performance Index</p>
                <p className="text-white font-bold text-lg">+12.4% <span className="text-white text-xs font-medium ml-1">Weekly</span></p>
              </div>
              <div className="w-20 h-8 flex items-end gap-1">
                {[30, 45, 25, 60, 40, 80, 55].map((h, i) => (
                  <div key={i} className="flex-1 bg-[#62161aff] text-white backdrop-blur-md/20 rounded-t-sm group-hover:bg-[#e0000a] text-white backdrop-blur-md/40 transition-all duration-500" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {fullScreenNav && navTarget && (
        <NavigationModal
          isOpen={fullScreenNav}
          onClose={() => { setFullScreenNav(false); setNavTarget(null); }}
          origin={navTarget.origin}
          destination={navTarget.dest}
          waypoints={navTarget.waypoints}
          distanceMeters={(navTarget.distKm || 5) * 1000}
          mlEtaMinutes={navTarget.eta || 30}
          onLegCompleted={() => {
            if (navigatingJobId) {
              updateParcelStatus(navigatingJobId, 'delivered');
              fetchMyParcels();
            }
          }}
        />
      )}
    </main>
  );
}
