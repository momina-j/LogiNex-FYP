'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
import { Store, MapPin, Package, Truck, Users, Zap, CheckCircle2, QrCode, Navigation, DollarSign, AlertTriangle, ChevronRight, Search, LayoutGrid, FileText, Bot, Loader2, X } from 'lucide-react';
import { translations } from '@/lib/translations';

const HubMap = dynamic<any>(() => import('@/components/Map/HubMap'), { 
 ssr: false,
 loading: () => <div className="h-full w-full bg-[#62161aff] text-white backdrop-blur-md animate-pulse flex items-center justify-center text-white font-bold uppercase tracking-widest">Loading Satellite...</div>
});

export default function HubHolderDashboard() {
 const { currentUser, language } = useAppStore();
 const t = translations[language as keyof typeof translations];
 const [isAutoAllocation, setIsAutoAllocation] = useState(true);
 const [scanTrackingId, setScanTrackingId] = useState('');

 // ── AI Driver Assignment State ──
 const [assigningParcelId, setAssigningParcelId] = useState<string | null>(null);
 const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

 const showToast = (type: 'success' | 'error', msg: string) => {
 setToast({ type, msg });
 setTimeout(() => setToast(null), 4000);
 };

 // ── Real-time Location & Socket ──
 const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
 const [socket, setSocket] = useState<Socket | null>(null);
 const [locationError, setLocationError] = useState<string | null>(null);

 // ── Socket Connection ──
 useEffect(() => {
 const s = io('/');
 setSocket(s);

 if (currentUser?.id) {
 s.emit('joinRoom', currentUser.id);
 }

 return () => { s.disconnect(); };
 }, [currentUser?.id]);

 // ── Real-time Location Tracking ──
 useEffect(() => {
 if (!socket || !currentUser?.id) return;

 if (!navigator.geolocation) {
 setLocationError('Geolocation not supported');
 return;
 }

 const watchId = navigator.geolocation.watchPosition(
 (pos) => {
 const { latitude, longitude } = pos.coords;
 const newLoc = { lat: latitude, lng: longitude };
 setCurrentLocation(newLoc);
 setLocationError(null);
 socket.emit('updateLocation', { userId: currentUser.id, ...newLoc });
 },
 (err) => {
 if (err.code !== 3) {
 console.error('WatchPosition Error:', err);
 }
 setLocationError(err.code === 1 ? 'Permission Denied' : 'GPS Unavailable');
 },
 { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
 );

 return () => navigator.geolocation.clearWatch(watchId);
 }, [socket, currentUser?.id]);

 // ── Hub Details State ──
 const [hubDetails, setHubDetails] = useState({
 name: 'Loading...',
 type: 'Warehouse',
 location: '',
 status: 'Loading...',
 acceptingParcels: true,
 stats: {
 incomingToday: 45, // Mock stat
 readyForRiders: 32, // Mock stat
 delivered: 156, // Mock stat
 storageUsed: 0,
 storageTotal: 100,
 }
 });

 const [showSettings, setShowSettings] = useState(false);
 const [settingsForm, setSettingsForm] = useState({
 storageTotal: 100,
 acceptingParcels: true,
 location: ''
 });

 const fetchHubProfile = useCallback(async () => {
 if (!currentUser?.id) return;
 try {
 const res = await fetch(`/api-proxy/hubholder/profile/${currentUser.id}`);
 if (res.ok) {
 const data = await res.json();
 setHubDetails(prev => ({
 ...prev,
 name: data.name || 'My Hub',
 type: data.type || 'Warehouse',
 location: data.location || '',
 status: data.status || (data.acceptingParcels === false ? 'FULL/Offline' : 'Active Hub'),
 acceptingParcels: data.acceptingParcels ?? true,
 stats: {
 ...prev.stats,
 storageUsed: data.storageUsed || 0,
 storageTotal: data.storageTotal || 100
 }
 }));
 setSettingsForm({
 storageTotal: data.storageTotal || 100,
 acceptingParcels: data.acceptingParcels ?? true,
 location: data.location || ''
 });
 }
 } catch (err) {
 console.error(err);
 }
 }, [currentUser?.id]);

 useEffect(() => {
 fetchHubProfile();
 }, [fetchHubProfile]);

 const handleSaveSettings = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const res = await fetch('/api-proxy/hubholder/profile', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 hubId: currentUser?.id || 'h1',
 storageTotal: settingsForm.storageTotal,
 acceptingParcels: settingsForm.acceptingParcels,
 location: settingsForm.location
 })
 });
 if (res.ok) {
 setShowSettings(false);
 fetchHubProfile();
 }
 } catch (err) {
 console.error(err);
 }
 };

 const incomingBatches = [
 { id: 'B-240201', source: 'City Warehouse', parcels: 23, zones: 'Block A, B, C', eta: '15 mins', driver: 'Ahmed', vehicle: 'Truck' },
 { id: 'B-240202', source: 'Hub Partner Store', parcels: 15, zones: 'Block D, E', eta: '32 mins', driver: 'Bilal', vehicle: 'Van' },
 { id: 'B-240203', source: 'Shipper Direct', parcels: 8, zones: 'Block F', eta: '45 mins', driver: 'Sana', vehicle: 'Pickup' },
 ];

 const sortedZones = [
 { name: 'Zone A (Gulshan Block 1-5)', parcels: 15, sampleAddresses: ['22-A Street 5', '45-B Block 2', '78-C Block 3'] },
 { name: 'Zone B (Gulshan Block 6-10)', parcels: 10, sampleAddresses: ['112-D Block 7', '34-E Block 8'] },
 { name: 'Zone C (Commercial Area)', parcels: 7, sampleAddresses: ['Shop 5, Market', 'Office 12, Tower'] },
 ];

 const localRiders = [
 { name: 'Usman', vehicle: 'Motorcycle', status: 'Available', zone: 'A', completed: 23, rating: 4.9, suggestedZone: 'A', waiting: 12 },
 { name: 'Fatima', vehicle: 'Bicycle', status: 'On Delivery', zone: 'B', completed: 15, rating: 5.0, eta: '20 mins', nextSuggested: 'C' },
 { name: 'Ali', vehicle: 'Van', status: 'Available', zone: 'Commercial', completed: 18, rating: 4.8, suggestedZone: 'Commercial', waiting: 5 },
 ];

 const activeDeliveries = [
 { tracking: 'LNX-2402-01', zone: 'A', rider: 'Usman', status: 'Out', eta: '10 mins' },
 { tracking: 'LNX-2402-02', zone: 'A', rider: 'Usman', status: 'Out', eta: '12 mins' },
 { tracking: 'LNX-2402-15', zone: 'B', rider: 'Fatima', status: 'Out', eta: '18 mins' },
 { tracking: 'LNX-2402-24', zone: 'Comm', rider: 'Ali', status: 'Delivered', eta: 'Done' },
 ];

 const handleReceiveBatch = async () => {
 if (!scanTrackingId) {
 alert('Please enter a tracking ID first');
 return;
 }

 try {
 const response = await fetch('/api-proxy/hubholder/scan-batch', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 hubId: currentUser?.id || 'h1',
 trackingId: scanTrackingId
 })
 });

 if (!response.ok) {
 const errorData = await response.json();
 alert(errorData.error || 'Failed to receive batch');
 return;
 }

 const data = await response.json();
 alert(data.message);
 setScanTrackingId('');
 fetchHubProfile();
 } catch (err) {
 console.error(err);
 alert('Network error communicating with the server.');
 }
 };

 const handleAssignRider = async (zoneName: string, parcelCount: number) => {
 try {
 const response = await fetch('/api-proxy/hubholder/assign-rider', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 hubId: currentUser?.id || 'h1',
 riderId: 'r1', // mock rider
 zone: zoneName,
 parcelIds: Array(parcelCount).fill('p_mock_id') // Sending dummy parcel IDs
 })
 });

 if (!response.ok) {
 const errorData = await response.json();
 alert(errorData.error || 'Failed to assign rider');
 return;
 }

 const data = await response.json();
 alert(data.message);
 } catch (err) {
 console.error(err);
 alert('Network error communicating with the server.');
 }
 };

 const handleAIAssignDriver = async (parcelId: string, trackingLabel?: string) => {
 setAssigningParcelId(parcelId);
 try {
 const res = await fetch('/api-proxy/parcels/assign-driver', {
 method : 'POST',
 headers: { 'Content-Type': 'application/json' },
 body : JSON.stringify({ parcelId }),
 });

 const data = await res.json();

 if (res.ok && data.success) {
 showToast('success',
 `✅ AI assigned ${data.assigned_driver?.name || data.assigned_driver?.id} ` +
 `to ${trackingLabel || parcelId} (score: ${data.assigned_driver?.score?.toFixed(3) ?? 'N/A'})`
 );
 } else {
 showToast('error', `❌ Assignment failed: ${data.error || 'Unknown error'}`);
 }
 } catch (err) {
 showToast('error', '❌ Network error — check Flask server is running.');
 } finally {
 setAssigningParcelId(null);
 }
 };

 return (
 <div className="space-y-6">
 {/* ── Toast Notification ──────────────────────────────────────────── */}
 <AnimatePresence>
 {toast && (
 <motion.div
 key="toast"
 initial={{ opacity: 0, y: -24, scale: 0.96 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -16, scale: 0.96 }}
 className={`fixed top-6 right-6 z-[2000] flex items-start gap-3 px-5 py-4 card-outer text-sm font-medium max-w-sm ${
 toast.type === 'success'
 ? 'text-white'
 : 'text-red-200'
 }`}
 >
 {toast.type === 'success'
 ? <CheckCircle2 className="w-5 h-5 text-white shrink-0 mt-0.5"/>
 : <AlertTriangle className="w-5 h-5 text-white shrink-0 mt-0.5"/>}
 <span className="leading-snug">{toast.msg}</span>
 <button onClick={() => setToast(null)} className="ml-auto shrink-0">
 <X className="w-4 h-4 opacity-60 hover:opacity-100"/>
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Settings Modal */}
 {showSettings && (
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
 <div className="card-outer w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
 <div className="p-6 border-b border-white/20 bg-[#62161aff] text-white backdrop-blur-md">
 <h2 className="text-xl font-bold text-white">Hub Configuration</h2>
 <p className="text-sm text-white mt-1">Setup limits and active status</p>
 </div>
 <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
 <div>
 <label className="text-xs font-bold text-white uppercase tracking-widest mb-1 block">Max Storage Capacity (Parcels)</label>
 <input required type="number"min="1"value={settingsForm.storageTotal} onChange={e => setSettingsForm({...settingsForm, storageTotal: Number(e.target.value)})} className="w-full bg-[#62161aff] text-white backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 transition-colors"/>
 </div>
 <div>
 <label className="text-xs font-bold text-white uppercase tracking-widest mb-1 block">Current Location / Address</label>
 <div className="flex gap-2">
 <input required type="text"value={settingsForm.location} onChange={e => setSettingsForm({...settingsForm, location: e.target.value})} placeholder="e.g. 24.86, 67.12"className="flex-1 card-inner px-3 py-2 text-white outline-none focus:border-emerald-500 transition-colors text-sm font-mono"/>
 <button type="button"onClick={() => setSettingsForm({...settingsForm, location: currentLocation ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}` : 'Wait for GPS...'})} className="card-inner hover:bg-[#1A1A1A] text-white px-3 rounded-lg text-xs font-bold transition-colors">
 Get GPS
 </button>
 </div>
 </div>
 <label className="flex items-center gap-3 bg-[#62161aff] text-white backdrop-blur-md border border-white/20 p-4 rounded-xl cursor-pointer">
 <input type="checkbox"className="w-5 h-5 accent-emerald-500"checked={settingsForm.acceptingParcels} onChange={e => setSettingsForm({...settingsForm, acceptingParcels: e.target.checked})} />
 <div>
 <h4 className="text-sm font-bold text-white">Accepting Parcels</h4>
 <p className="text-xs text-white leading-tight">Turn off to temporarily stop incoming routing</p>
 </div>
 </label>
 
 <div className="flex justify-end gap-3 pt-2">
 <button type="button"onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-white hover:text-white transition-colors">Cancel</button>
 <button type="submit"className="bg-[#1A1A1A] hover:bg-[#1A1A1A] text-white px-5 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95">Save Config</button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Header Section */}
 <motion.div 
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 className="card-outer p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
 >
 <div>
 <div className="flex items-center gap-3 mb-2">
 <div className="w-10 h-10 rounded-full bg-[#1A1A1A]/20 flex items-center justify-center">
 <Store className="w-5 h-5 text-white"/>
 </div>
 <div>
 <h1 className="text-2xl font-bold text-white uppercase tracking-wider">HUB: {hubDetails.name}</h1>
 <p className="text-white text-sm">Type: {hubDetails.type} | Location: {hubDetails.location}</p>
 </div>
 </div>
 <div className="flex gap-2">
 <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${hubDetails.acceptingParcels ? 'card-inner text-[#FDFBF7] ' : 'card-inner text-[#FDFBF7] '}`}>
 <span className={`w-2 h-2 rounded-full animate-pulse ${hubDetails.acceptingParcels ? 'bg-[#1A1A1A]' : 'bg-[#E53935]'}`} /> {hubDetails.status}
 </div>
 <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#62161aff] text-white backdrop-blur-md text-white hover:text-white transition-colors">
 ⚙️ Settings
 </button>
 </div>
 </div>
 <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
 <div className="card-inner px-6 py-3 rounded-xl text-center">
 <p className="text-xs text-white uppercase tracking-wider mb-1">{t.dashboard.hubHolder.stats.incomingToday}</p>
 <p className="text-2xl font-bold text-white">{hubDetails.stats.incomingToday}</p>
 </div>
 <div className="card-inner px-6 py-3 rounded-xl text-center">
 <p className="text-xs text-white uppercase tracking-wider mb-1">{t.dashboard.hubHolder.stats.readyForRiders}</p>
 <p className="text-2xl font-bold text-white">{hubDetails.stats.readyForRiders}</p>
 </div>
 <div className="card-inner px-6 py-3 rounded-xl text-center">
 <p className="text-xs text-white uppercase tracking-wider mb-1">{t.dashboard.hubHolder.stats.delivered}</p>
 <p className="text-2xl font-bold text-white">{hubDetails.stats.delivered}</p>
 </div>
 </div>
 <div className={`card-inner px-4 py-2 rounded-lg text-center min-w-[120px] ${hubDetails.stats.storageUsed >= hubDetails.stats.storageTotal ? 'border-white/20' : 'border-white/20'}`}>
 <p className="text-white text-xs mb-1 font-medium">{t.dashboard.hubHolder.stats.storageUsed}</p>
 <p className="text-white font-bold">{hubDetails.stats.storageUsed} / {hubDetails.stats.storageTotal} {t.dashboard.hubHolder.labels.parcelsCode}</p>
 <div className="w-full h-1 mt-1 bg-[#62161aff] text-white backdrop-blur-md rounded-full overflow-hidden">
 <div className={`h-full transition-all duration-500 ${hubDetails.stats.storageUsed >= hubDetails.stats.storageTotal ? 'bg-[#E53935]' : 'bg-[#1A1A1A]'}`} style={{ width: `${Math.min((hubDetails.stats.storageUsed / hubDetails.stats.storageTotal) * 100, 100)}%` }} />
 </div>
 </div>
 </motion.div>

 {/* Top Section */}
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="card-outer p-6 h-[400px] flex flex-col"
 >
 <div className="flex justify-between items-center mb-4">
 <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
 <MapPin className="w-5 h-5 text-[#E53935]"/> {t.dashboard.driver.labels.liveRoute}
 </h2>
 <div className="flex gap-2">
 <div className="card-inner px-3 py-1.5 rounded-lg flex items-center gap-2">
 <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-[#1A1A1A] shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#E53935]'}`} />
 <span className="text-[10px] font-bold text-white uppercase tracking-widest whitespace-nowrap">
 {socket?.connected 
 ? (language === 'en' ? 'Live Tracking Active' : 'براہ راست ٹریکنگ فعال ہے') 
 : (language === 'en' ? 'Connecting...' : 'رابطہ ہو رہا ہے...')}
 </span>
 </div>
 {locationError && (
 <div className="bg-[#E53935]/20 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
 <AlertTriangle className="w-3 h-3 text-white"/>
 <span className="text-[10px] font-bold text-red-200">
 {locationError}
 </span>
 </div>
 )}
 </div>
 </div>
 
 <div className="flex-1 card-inner rounded-xl overflow-hidden relative">
 <HubMap 
 hubLocation={currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null}
 radiusKm={10}
 />
 {/* Legend */}
 <div className="absolute bottom-4 right-4 z-[1000] card-inner rounded-lg p-3 text-xs space-y-2">
 <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#1A1A1A] rounded-full"/> <span className="text-white">Your Hub</span></div>
 <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#E53935] rounded-full"/> <span className="text-white">Local Riders</span></div>
 <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#E53935]/30 rounded-full border border-rose-500"/> <span className="text-white">Delivery Zones</span></div>
 </div>
 </div>
 </motion.div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Left Column - Incoming Bulk Shipments */}
 <motion.div 
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.2 }}
 className="card-outer p-6 flex flex-col gap-4"
 >
 <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
 <Truck className="w-6 h-6 text-white"/> {t.dashboard.hubHolder.labels.incomingBatches}
 </h2>
 
 <div className="space-y-4 overflow-y-auto pr-2 max-h-[600px]">
 {incomingBatches.map((batch, i) => (
 <div key={i} className="card-inner p-4 hover:border-white/20 transition-colors">
 <div className="flex justify-between items-start mb-3">
 <div>
 <span className="card-inner text-[#E53935] text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Batch #{batch.id}</span>
 <p className="text-sm text-white mt-2">From: <span className="text-white">{batch.source}</span></p>
 </div>
 <div className="text-right">
 <p className="text-2xl font-bold text-white">{batch.parcels}</p>
 <p className="text-xs text-white uppercase">{t.dashboard.hubHolder.labels.parcelsCode}</p>
 </div>
 </div>
 <div className="space-y-1 mb-4 text-sm">
 <p className="text-white flex justify-between"><span>Dest Zones:</span> <span className="text-white font-medium">{batch.zones}</span></p>
 <p className="text-white flex justify-between"><span>ETA to Hub:</span> <span className="text-white font-bold">{batch.eta}</span></p>
 <p className="text-white flex justify-between"><span>Driver:</span> <span className="text-white">{batch.driver} ({batch.vehicle})</span></p>
 </div>
 <div className="flex gap-2">
 <button className="flex-1 card-inner text-[#E53935] py-2 rounded-lg text-xs font-bold transition-colors">Track Batch</button>
 <button className="flex-1 bg-[#E53935] hover:bg-[#C62828] text-white py-2 rounded-lg text-xs font-bold transition-colors">Prepare Receiving</button>
 </div>
 {/* AI Assign Driver Button */}
 <button
 onClick={() => handleAIAssignDriver(batch.id, `Batch #${batch.id}`)}
 disabled={assigningParcelId === batch.id}
 className="w-full mt-2 flex items-center justify-center gap-2 bg-[#E53935] hover:bg-[#C62828] disabled:opacity-60 disabled:cursor-wait text-white py-2 rounded-lg text-xs font-bold transition-colors"
 >
 {assigningParcelId === batch.id
 ? <Loader2 className="w-3.5 h-3.5 animate-spin"/>
 : <Bot className="w-3.5 h-3.5"/>}
 {assigningParcelId === batch.id ? 'Assigning via AI...' : 'Assign Driver (AI)'}
 </button>
 </div>
 ))}
 </div>
 </motion.div>

 {/* Middle Column - Receive & Sort Interface */}
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3 }}
 className="card-outer p-6 flex flex-col gap-6"
 >
 <h2 className="text-lg font-bold text-white flex items-center gap-2">
 <Package className="w-5 h-5 text-white"/> Receive & Sort Parcels
 </h2>
 
 {/* Scan Incoming */}
 <div className="card-inner p-4">
 <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
 <QrCode className="w-4 h-4"/> Scan Incoming Batch
 </h3>
 <div className="space-y-3">
 <input 
 type="text"
 placeholder={language === 'en' ?"Tracking ID or Scan QR...":"ٹریکنگ آئی ڈی یا کیو آر اسکین کریں..."}
 value={scanTrackingId}
 onChange={(e) => setScanTrackingId(e.target.value)}
 className="w-full card-inner px-4 py-3 text-white focus:outline-none focus:border-red-500 font-mono text-center tracking-widest"
 />
 <div className="flex gap-2">
 <button className="flex-1 card-inner py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2">
 <QrCode className="w-4 h-4"/> Scan Camera
 </button>
 <button 
 onClick={handleReceiveBatch}
 className="flex-1 bg-[#1A1A1A] hover:bg-[#1A1A1A] text-white py-2.5 rounded-lg text-sm font-bold transition-colors">
 Receive All
 </button>
 </div>
 </div>
 </div>

 {/* AI Sorted Zones */}
 <div className="flex-1 card-inner p-4 flex flex-col">
 <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-2">
 <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sort by Delivery Zone</h3>
 <span className="bg-[#E53935]/10 text-white text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1">
 <Zap className="w-3 h-3"/> AI Suggested
 </span>
 </div>
 
 <div className="flex-1 overflow-y-auto space-y-4 pr-2">
 {sortedZones.map((zone, i) => (
 <div key={i} className="card-inner p-3">
 <div className="flex justify-between items-center mb-2">
 <h4 className="font-bold text-white text-sm">{zone.name}</h4>
 <span className="card-inner text-white text-xs px-2 py-0.5 rounded-full">{zone.parcels} {t.dashboard.hubHolder.labels.parcelsCode}</span>
 </div>
 <ul className="text-xs text-white space-y-1 mb-3 pl-2 border-l-2 border-white/20">
 {zone.sampleAddresses.map((addr, j) => (
 <li key={j}>• {addr}</li>
 ))}
 <li className="italic text-white">+ {zone.parcels - zone.sampleAddresses.length} more parcels</li>
 </ul>
 <button 
 onClick={() => handleAssignRider(zone.name, zone.parcels)}
 className="w-full card-inner py-1.5 rounded text-xs font-bold transition-colors">
 {t.dashboard.hubHolder.actions.assignRider}
 </button>
 </div>
 ))}
 </div>
 
 <div className="mt-4 pt-3 border-t border-white/20 text-xs text-white flex items-start gap-2">
 <Zap className="w-4 h-4 text-white shrink-0"/>
 <p>AI Auto-Sort Enabled. Parcels automatically grouped by zone based on address analysis.</p>
 </div>
 </div>
 </motion.div>

 {/* Right Column - Local Riders Management */}
 <motion.div 
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.4 }}
 className="bg-[#62161aff] text-white backdrop-blur-md border border-white/20 rounded-2xl p-6 flex flex-col gap-6"
 >
 <h2 className="text-lg font-bold text-white flex items-center gap-2">
 <Users className="w-5 h-5 text-white"/> {t.dashboard.hubHolder.labels.localRiders}
 </h2>
 
 <div className="space-y-4 overflow-y-auto pr-2 max-h-[350px]">
 {localRiders.map((rider, i) => (
 <div key={i} className="card-inner p-4">
 <div className="flex justify-between items-start mb-2">
 <div>
 <h3 className="font-bold text-white text-sm">{rider.name} - {rider.vehicle}</h3>
 <p className="text-xs text-white mt-0.5">Rating: {rider.rating}⭐ | Completed Today: {rider.completed}</p>
 </div>
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
 rider.status === 'Available' ? 'card-inner text-white ' : 'card-inner text-white '
 }`}>
 {rider.status === 'Available' ? t.dashboard.hubHolder.labels.waiting : t.dashboard.hubHolder.labels.onDelivery}
 </span>
 </div>
 
 <div className="card-inner p-2 mt-3 mb-3 text-xs">
 {rider.status === 'Available' ? (
 <p className="text-white">Suggested: <strong className="text-white">Zone {rider.suggestedZone}</strong> ({rider.waiting} parcels waiting)</p>
 ) : (
 <p className="text-white">Current: Zone {rider.zone} | ETA: <strong className="text-white">{rider.eta}</strong></p>
 )}
 </div>
 
 <div className="flex gap-2">
 <button className="flex-1 bg-[#E53935] hover:bg-[#C62828] text-white py-1.5 rounded text-xs font-bold transition-colors">
 {rider.status === 'Available' ? `Assign Zone ${rider.suggestedZone}` : `Pre-assign Zone ${rider.nextSuggested}`}
 </button>
 {rider.status === 'Available' && (
 <button className="flex-1 card-inner py-1.5 rounded text-xs font-bold transition-colors">View Route</button>
 )}
 </div>
 </div>
 ))}
 </div>
 
 <div className="flex gap-2">
 <button className="flex-1 border border-white/20 hover:bg-[#e0000a] text-white backdrop-blur-md text-white py-2 rounded-lg text-xs font-bold transition-colors">Register New Rider</button>
 <button className="flex-1 border border-white/20 hover:bg-[#e0000a] text-white backdrop-blur-md text-white py-2 rounded-lg text-xs font-bold transition-colors">View All on Map</button>
 </div>

 {/* AI Allocation Panel */}
 <div className="mt-auto rounded-xl p-4 relative overflow-hidden"style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)' }}>
 <div className="absolute top-0 right-0 p-2 opacity-20">
 <Zap className="w-16 h-16 text-white"/>
 </div>
 <div className="flex justify-between items-center mb-4 relative z-10">
 <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
 <Zap className="w-4 h-4"/> AI Rider Allocation
 </h3>
 <button 
 onClick={() => setIsAutoAllocation(!isAutoAllocation)}
 className={`w-10 h-5 rounded-full transition-all duration-200 relative ${isAutoAllocation ? 'bg-[#E53935]' : 'bg-[#dbd2d1]'}`}
 >
 <motion.div animate={{ x: isAutoAllocation ? 20 : 2 }} className="w-4 h-4 bg-[#62161aff] text-white backdrop-blur-md rounded-full absolute top-0.5 shadow-sm"/>
 </button>
 </div>
 
 <div className="space-y-2 text-xs text-white relative z-10">
 <p>Currently processing:</p>
 <ul className="list-disc list-inside space-y-1 text-white ml-1">
 <li>23 parcels for Zone A → Assigning to Usman</li>
 <li>15 parcels for Zone B → Assigning to Fatima</li>
 <li>8 parcels for Commercial → Assigning to Ali</li>
 </ul>
 <p className="mt-2 text-white font-medium">Optimization: Minimizing distance & time</p>
 </div>
 
 <div className="flex gap-2 mt-4 relative z-10">
 <button className="flex-1 bg-[#e0000a] text-white backdrop-blur-md hover:bg-[#e0000a] text-white backdrop-blur-md text-white py-1.5 rounded text-xs font-bold transition-colors border border-white/20">{language === 'en' ? 'Adjust Settings' : 'ترتیبات درست کریں'}</button>
 <button className="flex-1 bg-[#E53935] hover:bg-[#C62828] text-white py-1.5 rounded text-xs font-bold transition-colors">{language === 'en' ? 'Run Manual' : 'دستی طور پر چلائیں'}</button>
 </div>
 </div>
 </motion.div>
 </div>

 {/* Bottom Section - Delivery Status & Tracking */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.5 }}
 className="lg:col-span-2 card-outer p-6"
 >
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-lg font-bold text-white flex items-center gap-2">
 <Navigation className="w-5 h-5 text-[#E53935]"/> {t.dashboard.hubHolder.labels.activeDeliveries}
 </h2>
 <button className="text-sm text-white hover:text-white font-medium">{t.dashboard.hubHolder.actions.viewAll}</button>
 </div>
 
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm text-white">
 <thead className="text-xs uppercase card-inner text-white border-b border-white/20">
 <tr>
 <th className={`px-4 py-3 font-medium ${language === 'ur' ? 'text-right' : 'text-left'}`}>{language === 'en' ? 'Tracking' : 'ٹریکنگ'}</th>
 <th className={`px-4 py-3 font-medium ${language === 'ur' ? 'text-right' : 'text-left'}`}>{t.dashboard.hubHolder.labels.zones}</th>
 <th className={`px-4 py-3 font-medium ${language === 'ur' ? 'text-right' : 'text-left'}`}>{t.dashboard.hubHolder.labels.driver}</th>
 <th className={`px-4 py-3 font-medium ${language === 'ur' ? 'text-right' : 'text-left'}`}>{language === 'en' ? 'Status' : 'حالت'}</th>
 <th className={`px-4 py-3 font-medium ${language === 'ur' ? 'text-left' : 'text-right'}`}>{t.dashboard.hubHolder.labels.eta}</th>
 </tr>
 </thead>
 <tbody>
 {activeDeliveries.map((del, i) => (
 <tr key={i} className="border-b border-white/20 card-inner transition-colors">
 <td className="px-4 py-3 font-medium text-white">{del.tracking}</td>
 <td className="px-4 py-3">{del.zone}</td>
 <td className="px-4 py-3">{del.rider}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
 del.status === 'Delivered' ? 'card-inner text-white ' : 'card-inner text-white '
 }`}>
 {del.status === 'Delivered' ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-2 h-2 rounded-full bg-[#E53935] animate-pulse"/>}
 {del.status}
 </span>
 </td>
 <td className="px-4 py-3 text-right font-medium text-white">{del.eta}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </motion.div>

 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.6 }}
 className="card-outer p-6 flex flex-col"
 >
 <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
 <Zap className="w-5 h-5 text-white"/> {t.dashboard.hubHolder.actions.autoAllocation}
 </h2>
 
 <div className="space-y-4 mb-6">
 <div className="card-inner p-4">
 <p className="text-xs text-white uppercase tracking-wider mb-1">Hub Holding Fees Today</p>
 <p className="text-2xl font-bold text-white">Rs. 2,450</p>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="card-inner p-4">
 <p className="text-xs text-white uppercase tracking-wider mb-1">Paid to Riders</p>
 <p className="text-lg font-bold text-white">Rs. 8,300</p>
 </div>
 <div className="bg-[#62161aff] text-white backdrop-blur-md border border-white/20 rounded-xl p-4">
 <p className="text-xs text-white uppercase tracking-wider mb-1">COD Handled</p>
 <p className="text-lg font-bold text-white">Rs. 45,000</p>
 </div>
 </div>
 </div>
 
 <div className="mt-auto pt-4 border-t border-white/20">
 <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3">{t.dashboard.hubHolder.actions.scanParcel}</h3>
 <ul className="text-sm text-white space-y-2">
 <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white"/> Cash on Delivery (for riders)</li>
 <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white"/> Online Payment (hub fee)</li>
 <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white"/> JazzCash / Easypaisa</li>
 </ul>
 </div>
 </motion.div>
 </div>
 </div>
 );
}
