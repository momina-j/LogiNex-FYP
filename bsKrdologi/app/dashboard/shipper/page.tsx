'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import {
 Package, Truck, Clock, AlertTriangle, CheckCircle2,
 MapPin, Navigation, Plus, Minus, X, Loader2,
 ChevronDown, CreditCard, Banknote, RefreshCw, Lock, ShieldCheck,
 LocateFixed, Scale, Maximize, Search, History, ArrowRight, Copy, ClipboardCheck
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { LOGISTICS_CONFIG } from '@/lib/logistics-config';
import { translations } from '@/lib/translations';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
 ssr: false,
 loading: () => (
 <div className="h-full w-full card-inner animate-pulse rounded-2xl flex items-center justify-center">
 <Loader2 className="w-8 h-8 text-white animate-spin"/>
 </div>
 )
});

const TrackingMap = dynamic<any>(() => import('@/components/Map/TrackingMap'), { 
 ssr: false,
 loading: () => (
 <div className="h-full w-full card-inner animate-pulse rounded-2xl flex items-center justify-center">
 <Loader2 className="w-8 h-8 text-white animate-spin"/>
 </div>
 )
});

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParcelEntry {
 id: string;
 description: string;
 paymentMethod: 'COD' | 'ONLINE';
 codAmount: string;
 weight: string; // In kg
 length: string; // In cm
 width: string; // In cm
 height: string; // In cm
 unitPrice: number; // Calculated price
}

interface BookingRecord {
 id: string;
 trackingId: string;
 receiverName: string;
 receiverPhone: string;
 receiverAddress: string;
 city: string;
 status: string;
 vehicleType?: string;
 driverId: string | null;
 parcels: ParcelEntry[];
 createdAt: string;
}

interface PendingBooking {
 trackingId: string;
 parcelId: string;
 totalAmount: number;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, language }: { status: string, language: string }) => {
 const t = translations[language as keyof typeof translations];
 const cfg: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
 pending: { cls: 'bg-[#ede8e0] text-[#62161aff] font-bold', icon: <Clock className="w-3 h-3"/>, label: t.dashboard.statuses.pending },
 assigned: { cls: 'bg-[#f5efef] text-[#62161aff] font-bold', icon: <Truck className="w-3 h-3"/>, label: t.dashboard.statuses.assigned },
 in_transit: { cls: 'bg-[#f5efef] text-[#62161aff] font-bold', icon: <Truck className="w-3 h-3"/>, label: t.dashboard.statuses.inTransit },
 delivered: { cls: 'bg-[#f5efef] text-[#62161aff] font-bold', icon: <CheckCircle2 className="w-3 h-3"/>, label: t.dashboard.statuses.delivered },
 delayed: { cls: 'bg-[#f5efef] text-[#62161aff] font-bold', icon: <AlertTriangle className="w-3 h-3"/>, label: t.dashboard.statuses.delayed },
 };
 const s = cfg[status] ?? cfg['pending'];
 return (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
 {s.icon}{s.label}
 </span>
 );
};

// ─── Blank parcel template ────────────────────────────────────────────────────
const newEntry = (): ParcelEntry => ({
 id: crypto.randomUUID(),
 description: '',
 paymentMethod: 'COD',
 codAmount: '',
 weight: '1',
 length: '10',
 width: '10',
 height: '10',
 unitPrice: 0,
});

// ─── Card number formatter ────────────────────────────────────────────────────
const fmtCard = (v: string) =>
 v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

// ─── Expiry formatter ─────────────────────────────────────────────────────────
const fmtExpiry = (v: string) => {
 const d = v.replace(/\D/g, '').slice(0, 4);
 return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function ShipperDashboard() {
 const { currentUser, language } = useAppStore();
 const t = translations[language as keyof typeof translations];

 // ── Bookings ──
 const [bookings, setBookings] = useState<BookingRecord[]>([]);
 const [loadingData, setLoadingData] = useState(false);

 // ── Ledger ──
 const [ledger, setLedger] = useState<any[]>([]);
 const [loadingLedger, setLoadingLedger] = useState(false);

 // ── Booking modal ──
 const [showModal, setShowModal] = useState(false);

 // ── Booking form ──
 const [receiver, setReceiver] = useState({
 receiverName: '', receiverPhone: '', receiverAddress: '', city: 'Karachi',
 });
 const [parcelList, setParcelList] = useState<ParcelEntry[]>([newEntry()]);
 const [submitting, setSubmitting] = useState(false);
 const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
 const [submitMsg, setSubmitMsg] = useState('');
 const [vehicleType, setVehicleType] = useState<'bike' | 'van' | 'truck' | 'car' | 'rickshaw'>('car');

 // ── Payment modal ──
 const [showPayment, setShowPayment] = useState(false);
 const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);

 // ── Card form ──
 const [cardStatus, setCardStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
 const [cardMsg, setCardMsg] = useState('');

 // ── Status Buckets ──
 const [assignedLog, setAssignedLog] = useState<any[]>([]);
 const [completedLog, setCompletedLog] = useState<any[]>([]);
 const [delayedLog, setDelayedLog] = useState<any[]>([]);
 const [loadingBuckets, setLoadingBuckets] = useState(false);
 const [ledgerError, setLedgerError] = useState<string | null>(null);
 const [bucketsError, setBucketsError] = useState<string | null>(null);

 // ── Success modal after booking ──
 const [showSuccessModal, setShowSuccessModal] = useState(false);
 const [lastTrackingId, setLastTrackingId] = useState('');

 // ── Tracking Search ──
 const [trackSearchId, setTrackSearchId] = useState('');
 const [trackResult, setTrackResult] = useState<any>(null);
 const [trackLoading, setTrackLoading] = useState(false);
 const [trackError, setTrackError] = useState<string | null>(null);
 const [showTrackModal, setShowTrackModal] = useState(false);

 const handleTrackSearch = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!trackSearchId.trim()) return;
 setTrackLoading(true);
 setTrackError(null);
 setTrackResult(null);
 try {
 const res = await fetch(`/api-proxy/parcels/track/${trackSearchId.trim().toUpperCase()}`);
 const data = await res.json();
 if (!res.ok || !data.found) {
 setTrackError(data.error || 'Tracking ID not found.');
 } else {
 setTrackResult(data);
 setShowTrackModal(true);
 }
 } catch {
 setTrackError('Could not connect to server. Please try again.');
 } finally {
 setTrackLoading(false);
 }
 };

 // ── Copy-to-clipboard state ──
 const [copiedId, setCopiedId] = useState<string | null>(null);
 const handleCopy = (id: string) => {
 navigator.clipboard.writeText(id).then(() => {
 setCopiedId(id);
 setTimeout(() => setCopiedId(null), 2000);
 });
 };

 // ── Real-time Location & Socket ──
 const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
 const [socket, setSocket] = useState<Socket | null>(null);
 const [fetchingLoc, setFetchingLoc] = useState(false);
 const [locationError, setLocationError] = useState<string | null>(null);

 // ── Pricing Logic Stats ──
 const [estimatedDistance, setEstimatedDistance] = useState<number>(5); // default 5km

 // -- Haversine Distance helper --
 const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
 const R = 6371; // km
 const dLat = (lat2 - lat1) * Math.PI / 180;
 const dLon = (lon2 - lon1) * Math.PI / 180;
 const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
 Math.sin(dLon / 2) * Math.sin(dLon / 2);
 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
 return R * c;
 };

 // ── Fetch bookings ──
 const fetchBookings = useCallback(async () => {
 if (!currentUser?.id) return;
 setLoadingData(true);
 try {
 const res = await fetch(`/api-proxy/parcels/user/${currentUser.id}`);
 
 if (!res.ok) {
 const text = await res.text();
 console.error(`Fetch Bookings failed with status ${res.status}:`, text);
 return;
 }

 try {
 const data = await res.json();
 setBookings(Array.isArray(data) ? data : []);
 } catch (jsonErr) {
 console.error('Fetch Bookings: Invalid JSON response', jsonErr);
 }
 } catch (err) {
 console.error('Fetch Bookings Error:', err);
 } finally { 
 setLoadingData(false); 
 }
 }, [currentUser?.id]);

 useEffect(() => { fetchBookings(); }, [fetchBookings]);

 // ── Fetch Ledger ──
 const fetchLedger = useCallback(async () => {
 if (!currentUser?.id) return;
 setLoadingLedger(true);
 setLedgerError(null);
 try {
 const res = await fetch(`/api-proxy/parcels/ledger/${currentUser.id}`);
 
 if (!res.ok) {
 const text = await res.text();
 console.error(`Fetch Ledger failed with status ${res.status}:`, text);
 setLedgerError(`Server error (${res.status}). Activity log may be temporarily unavailable.`);
 return;
 }

 try {
 const data = await res.json();
 setLedger(Array.isArray(data) ? data : []);
 } catch (jsonErr) {
 console.error('Fetch Ledger: Invalid JSON response', jsonErr);
 setLedgerError('Server returned an invalid format.');
 }
 } catch (err) { 
 console.error('Fetch Ledger Error:', err);
 setLedgerError('Could not connect to the server.');
 } finally { 
 setLoadingLedger(false); 
 }
 }, [currentUser?.id]);

 useEffect(() => { fetchLedger(); }, [fetchLedger]);

 // ── Fetch Status Buckets ──
 const fetchStatusBuckets = useCallback(async () => {
 if (!currentUser?.id) return;
 setLoadingBuckets(true);
 setBucketsError(null);
 try {
 const [assignedRes, completedRes, delayedRes] = await Promise.all([
 fetch(`/api-proxy/parcels/assigned/${currentUser.id}`),
 fetch(`/api-proxy/parcels/completed/${currentUser.id}`),
 fetch(`/api-proxy/parcels/delayed/${currentUser.id}`)
 ]);
 
 const parseSafe = async (res: Response, bucketName: string) => {
 if (!res.ok) {
 const text = await res.text();
 console.error(`Bucket ${bucketName} failed with status ${res.status}:`, text);
 return null;
 }
 try {
 return await res.json();
 } catch (err) {
 console.error(`Bucket ${bucketName} returned invalid JSON:`, err);
 return null;
 }
 };

 const [assigned, completed, delayed] = await Promise.all([
 parseSafe(assignedRes, 'assigned'),
 parseSafe(completedRes, 'completed'),
 parseSafe(delayedRes, 'delayed')
 ]);

 if (assigned !== null) setAssignedLog(assigned);
 else setBucketsError(prev => prev || 'Failed to sync assigned activity.');

 if (completed !== null) setCompletedLog(completed);
 else setBucketsError(prev => prev || 'Failed to sync completed activity.');

 if (delayed !== null) setDelayedLog(delayed);
 else setBucketsError(prev => prev || 'Failed to sync delayed activity.');
 
 } catch (err) {
 console.error('Fetch Buckets Error:', err);
 setBucketsError('Could not connect to activity server.');
 } finally {
 setLoadingBuckets(false);
 }
 }, [currentUser?.id]);

 useEffect(() => { fetchStatusBuckets(); }, [fetchStatusBuckets]);

 // ── Socket Connection ──
 useEffect(() => {
 const s = io('/'); // Socket.io can usually use common origin or specific proxy
 setSocket(s);

 if (currentUser?.id) {
 s.emit('joinRoom', currentUser.id);

 s.on('rideAccepted', (data) => {
 console.log('Ride accepted:', data);
 fetchBookings();
 fetchStatusBuckets();
 });

 s.on('statusUpdated', (data) => {
 console.log('Status updated:', data);
 fetchBookings();
 fetchLedger();
 fetchStatusBuckets();
 });
 }

 return () => { s.disconnect(); };
 }, [currentUser?.id, fetchBookings, fetchLedger, fetchStatusBuckets]);

 // ── Real-time Location Tracking ──
 useEffect(() => {
 if (!socket || !currentUser?.id) return;

 if (!navigator.geolocation) {
 setLocationError('Geolocation is not supported by your browser.');
 return;
 }

 const options: PositionOptions = { 
 enableHighAccuracy: true, 
 timeout: 30000, 
 maximumAge: 60000 // Allow cached positions up to 1 minute
 };

 const watchId = navigator.geolocation.watchPosition(
 (pos) => {
 const { latitude, longitude } = pos.coords;
 const newLoc = { lat: latitude, lng: longitude };
 setCurrentLocation(newLoc);
 setLocationError(null);
 socket.emit('updateLocation', { userId: currentUser.id, ...newLoc });
 },
 (err) => {
 let msg = 'Unknown location error';
 if (err.code === 1) msg = 'Location permission denied. Please enable it in browser settings.';
 else if (err.code === 2) msg = 'Position unavailable. Check your GPS.';
 else if (err.code === 3) msg = 'Location request timed out.';
 
 // Log as warning since position errors are often expected user choices or environment issues
 console.warn('WatchPosition Info:', msg, err);
 setLocationError(msg);
 },
 options
 );

 return () => navigator.geolocation.clearWatch(watchId);
 }, [socket, currentUser?.id]);

 const fetchCurrentLocation = () => {
 if (!navigator.geolocation) return;
 setFetchingLoc(true);

 const options: PositionOptions = { 
 enableHighAccuracy: true, 
 timeout: 20000 
 };

 const handleSuccess = (pos: GeolocationPosition) => {
 const { latitude, longitude } = pos.coords;
 setReceiver(prev => ({ 
 ...prev, 
 receiverAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` 
 }));
 setFetchingLoc(false);
 setLocationError(null);
 };

 const handleError = (err: GeolocationPositionError) => {
 // Fallback: If high accuracy fails, try low accuracy once
 if (options.enableHighAccuracy && (err.code === 3 || err.code === 2)) {
 console.warn('High accuracy failed, trying low accuracy...', err);
 navigator.geolocation.getCurrentPosition(
 handleSuccess,
 (e) => {
 console.warn('Geolocation failed after fallback:', e);
 setFetchingLoc(false);
 },
 { enableHighAccuracy: false, timeout: 10000 }
 );
 } else {
 console.warn('Geolocation error:', err);
 setFetchingLoc(false);
 }
 };

 navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
 };

 // ── Stats ──
 const total = bookings.length;
 const active = bookings.filter(b => ['pending', 'assigned', 'in_transit'].includes(b.status)).length;
 const delivered = bookings.filter(b => b.status === 'delivered').length;
 const delayed = bookings.filter(b => b.status === 'delayed').length;
 const activeBookingList = bookings.filter(b => b.status !== 'delivered');

 // ── Parcel helpers ──
 const addParcel = () => setParcelList(p => [...p, newEntry()]);
 const removeParcel = (id: string) => setParcelList(p => p.length > 1 ? p.filter(e => e.id !== id) : p);
 const updateParcel = (id: string, field: keyof ParcelEntry, value: string) =>
 setParcelList(p => p.map(e => e.id === id ? { ...e, [field]: value } : e));

 // ── Open booking modal ──
 // ── Update Price when dependencies change ──
 useEffect(() => {
 // 1. Detect distance if coordinates are in receiverAddress
 const coordsMatch = receiver.receiverAddress.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
 let dist = 5; // Fallback
 if (coordsMatch && currentLocation) {
 const destLat = parseFloat(coordsMatch[1]);
 const destLng = parseFloat(coordsMatch[2]);
 dist = getDistance(currentLocation.lat, currentLocation.lng, destLat, destLng);
 setEstimatedDistance(dist);
 }

 // 2. Calculate price for each parcel
 const vCfg = LOGISTICS_CONFIG.vehicles[vehicleType as keyof typeof LOGISTICS_CONFIG.vehicles];
 const fuelPrice = vCfg.fuelType === 'diesel' ? LOGISTICS_CONFIG.fuelPrices.diesel : LOGISTICS_CONFIG.fuelPrices.petrol;

 const newList = parcelList.map(p => {
 const w = parseFloat(p.weight) || 1;
 const l = parseFloat(p.length) || 1;
 const wi = parseFloat(p.width) || 1;
 const h = parseFloat(p.height) || 1;
 
 // Volumetric weight check
 const volWeight = (l * wi * h) / LOGISTICS_CONFIG.surcharges.volumetricDivisor;
 const chargeableWeight = (vehicleType === 'van' || vehicleType === 'truck') ? Math.max(w, volWeight) : w;

 const fuelCost = (dist / vCfg.fuelAvg) * fuelPrice;
 const baseCost = vCfg.baseRate;
 const ratePerKg = vCfg.ratePerKg;
 
 // Weight-Scaler Logic: (Base + 1kg_Rate + Fuel) * Multiplier
 // Ensures if 1kg = X, 2kg = 2X
 let unitPrice1Kg = baseCost + ratePerKg + fuelCost;
 let subTotal = unitPrice1Kg * chargeableWeight;
 
 // Add Fuel Surcharge and Service Fee
 subTotal += (subTotal * (LOGISTICS_CONFIG.surcharges.fuelSurchargePercentage / 100));
 subTotal += LOGISTICS_CONFIG.surcharges.serviceFee;

 const finalPrice = Math.ceil(subTotal);
 
 return { 
 ...p, 
 unitPrice: finalPrice, 
 codAmount: p.paymentMethod === 'COD' ? finalPrice.toString() : p.codAmount 
 };
 });

 // Check if anything actually changed to prevent infinite loop
 const hasChanged = JSON.stringify(newList) !== JSON.stringify(parcelList);
 if (hasChanged) {
 setParcelList(newList);
 }
 }, [vehicleType, receiver.receiverAddress, currentLocation, parcelList.length]); // Added parcelList.length to trigger on add/remove but not on change

 const openModal = () => {
 setReceiver({ 
 receiverName: '', 
 receiverPhone: '', 
 receiverAddress: '', 
 city: 'Karachi',
 });
 // Initialize shipper address from profile if available
 setShipperDetails({
 shipperAddress: currentUser?.city || '',
 });
 setParcelList([newEntry()]);
 setVehicleType('car');
 setSubmitStatus('idle');
 setSubmitMsg('');
 setShowModal(true);
 };

 const [shipperDetails, setShipperDetails] = useState({
 shipperAddress: '',
 });

 // ── Submit booking → if ONLINE present, open payment modal instead of finishing ──
 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!currentUser?.id) {
 setSubmitStatus('error');
 setSubmitMsg('You must be logged in to book a parcel.');
 return;
 }

 setSubmitting(true);
 setSubmitStatus('idle');
 setSubmitMsg('');

 const hasOnline = parcelList.some(p => p.paymentMethod === 'ONLINE');

 // Extract coordinates if present in receiverAddress (e.g. from map picker)
 const coordsMatch = receiver.receiverAddress.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
 const receiverLat = coordsMatch ? parseFloat(coordsMatch[1]) : null;
 const receiverLng = coordsMatch ? parseFloat(coordsMatch[2]) : null;

 const payload = {
 userId: currentUser.id,
 shipperName: currentUser.name,
 shipperPhone: currentUser.phone,
 shipperAddress: shipperDetails.shipperAddress,
 shipperLat: currentLocation?.lat || null,
 shipperLng: currentLocation?.lng || null,
 receiverName: receiver.receiverName,
 receiverPhone: receiver.receiverPhone,
 receiverAddress: receiver.receiverAddress,
 receiverLat: receiverLat,
 receiverLng: receiverLng,
 city: receiver.city,
 vehicleType: vehicleType,
 parcels: parcelList.map(p => ({
 description: p.description,
 paymentMethod: p.paymentMethod,
 codAmount: p.paymentMethod === 'COD' ? Number(p.codAmount) : 0,
 weight: p.weight,
 length: p.length,
 width: p.width,
 height: p.height,
 unitPrice: p.unitPrice,
 })),
 };

 try {
 const res = await fetch('/api-proxy/parcels/create', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 
 if (!res.ok) {
 const textResponse = await res.text();
 let errorData;
 try {
 errorData = JSON.parse(textResponse);
 } catch (e) {
 console.error(`Submit failed with HTML/text response [${res.status}]`);
 setSubmitStatus('error');
 setSubmitMsg(`Server error: ${res.status}. Please check backend logs.`);
 setSubmitting(false);
 return;
 }
 setSubmitStatus('error');
 setSubmitMsg(errorData.error || 'Failed to book parcel.');
 setSubmitting(false);
 return;
 }
 
 let data;
 const textResponse = await res.text();
 try {
 data = JSON.parse(textResponse);
 } catch (e) {
 setSubmitStatus('error');
 setSubmitMsg('Invalid response from server.');
 setSubmitting(false);
 return;
 }

 // Refresh list immediately
 fetchBookings();

 if (hasOnline) {
 // ... (existing online logic)
 // Store booking info, open payment popup
 const onlineTotal = parcelList
 .filter(p => p.paymentMethod === 'ONLINE')
 .reduce((sum, p) => sum + (Number(p.codAmount) || 0), 0);

 setPendingBooking({
 trackingId: data.trackingId,
 parcelId: data.parcel?.id || '',
 totalAmount: onlineTotal,
 });
 
 setShowModal(false);
 useAppStore.getState().triggerPayment({
 amount: onlineTotal,
 description: `Booking Payment for ${data.trackingId}`,
 trackingId: data.trackingId,
 parcelId: data.parcel?.id,
 onSuccess: async () => {
 await fetchBookings();
 setPendingBooking(null);
 }
 });
 } else {
 // Success for COD
 setLastTrackingId(data.trackingId);
 setShowModal(false);
 setShowSuccessModal(true);
 setSubmitting(false);
 // Refresh ledger as well
 fetchLedger();
 }
 } catch {
 setSubmitStatus('error');
 setSubmitMsg('Could not connect to the server.');
 } finally {
 setSubmitting(false);
 }
 };


 // ─────────────────────────────────────────────────────────────────────────
 return (
 <div className="space-y-6">

 {/* ── Header ──────────────────────────────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 className="card-outer p-6 flex flex-col md:flex-row justify-between items-center gap-4"
 >
 <div>
 <h1 className="text-2xl font-bold text-white">
 {language === 'en' ? `Welcome back, ${currentUser?.name || 'Shipper'}` : `${currentUser?.name || 'بھیجنے والا'}، خوش آمدید`}
 </h1>
 <p className="text-white">{t.auth.city}: {currentUser?.city}</p>
 
 {/* Top Tracking Search Bar */}
 <form onSubmit={handleTrackSearch} className="mt-4 relative max-w-md group">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9d0406] transition-colors"/>
          <input
            type="text"
            value={trackSearchId}
            onChange={(e) => setTrackSearchId(e.target.value)}
            placeholder="Quick Track ID Search..."
            className="w-full bg-white rounded-xl py-3 pl-10 pr-4 text-black text-sm focus:outline-none border-2 border-[#62161aff] focus:border-[#e0000a] transition-colors placeholder:text-gray-400 shadow-md"
          
 />
 <button 
 type="submit"
 className="absolute right-1.5 top-1.5 bottom-1.5 bg-[#E53935] hover:bg-[#C62828] text-white text-[10px] font-bold px-3 rounded-lg flex items-center gap-1 transition-colors"
 >
 {trackLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <ArrowRight className="w-3 h-3"/>}
 Track
 </button>
 </form>
 </div>
 <div className="flex items-center gap-4">
 {[
 { label: t.dashboard.shipper.stats.totalParcels, value: total, color: 'text-white' },
 { label: t.dashboard.shipper.stats.activeBookings, value: active, color: 'text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]' },
 { label: t.dashboard.shipper.stats.delivered, value: delivered, color: 'text-emerald-400' },
 { label: t.dashboard.shipper.stats.delayed, value: delayed, color: 'text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]' },
 ].map(s => (
 <div key={s.label} className="card-inner px-4 py-2 rounded-lg text-center">
 <p className="text-xs text-white uppercase tracking-wider">{s.label}</p>
 <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
 </div>
 ))}
 <motion.button
 whileHover={{ scale: 1.04 }}
 whileTap={{ scale: 0.96 }}
 onClick={openModal}
 className="flex items-center gap-2 bg-[#E53935] hover:bg-[#C62828] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
 >
 <Plus className="w-4 h-4"/> {t.dashboard.shipper.actions.createParcel}
 </motion.button>
 </div>
 </motion.div>

 {/* ── Real-time Operations Insights (New!) ────────────────────────── */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {[
 { title: 'Recently Assigned', data: assignedLog, icon: <Truck className="w-4 h-4 text-white"/>, color: 'rose' },
 { title: 'Newly Completed', data: completedLog, icon: <CheckCircle2 className="w-4 h-4 text-white"/>, color: 'emerald' },
 { title: 'Recent Delays', data: delayedLog, icon: <AlertTriangle className="w-4 h-4 text-white"/>, color: 'orange' },
 ].map(bucket => (
 <motion.div
 key={bucket.title}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="card-outer p-4 flex flex-col h-[200px]"
 >
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
 {bucket.icon} {bucket.title}
 </h3>
 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-${bucket.color}-500/15 text-${bucket.color}-400`}>
 {bucket.data.length}
 </span>
 </div>
 
 <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
 {bucket.data.length === 0 ? (
 <div className="h-full flex items-center justify-center text-[10px] text-white italic">
 No recent activity found
 </div>
 ) : (
 bucket.data.map((item: any) => (
 <div key={item.id} className="card-internal p-2 flex items-center justify-between group hover:border-[#62161aff] transition-all">
 <div className="min-w-0">
 <p className="font-mono text-[10px] font-bold text-black truncate">{item.trackingId}</p>
 <p className="text-[9px] text-black truncate">{item.receiverName}</p>
 </div>
 <button 
 onClick={() => {
 setTrackSearchId(item.trackingId);
 handleTrackSearch({ preventDefault: () => {} } as any);
 }}
 className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md card-inner transition-all"
 >
 <Search className="w-3 h-3"/>
 </button>
 </div>
 ))
 )}
 </div>
 {bucket.data.length > 0 && (
 <div className="mt-2 pt-2 border-t border-white/20 flex justify-between items-center text-[9px] text-white">
 <span>Latest Update</span>
 <span className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 )}
 </motion.div>
 ))}
 </div>

 {/* ── Active Shipments Tracker Panel ───────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.05 }}
 className="card-outer p-5"
 >
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-base font-bold text-white flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-[#E53935] animate-pulse"/>
 {language === 'en' ? 'Active Shipments' : 'فعال ترسیلات'}
 <span className="bg-[#E53935]/15 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
 {activeBookingList.length}
 </span>
 </h2>
 <button
 onClick={fetchBookings}
 className="text-xs text-white hover:text-white transition-colors flex items-center gap-1"
 >
 <RefreshCw className={`w-3 h-3 ${loadingData ? 'animate-spin' : ''}`} />
 {language === 'en' ? 'Refresh' : 'ریفریش'}
 </button>
 </div>

 {activeBookingList.length === 0 ? (
 <div className="flex items-center gap-3 py-4 px-4 card-inner text-sm">
 <CheckCircle2 className="w-5 h-5 text-white shrink-0"/>
 {language === 'en' ? 'All parcels delivered — no active shipments.' : 'تمام پارسل پہنچا دیے گئے — کوئی فعال ترسیل نہیں۔'}
 </div>
 ) : (
 <div className="flex flex-wrap gap-2">
 {activeBookingList.map((b, i) => {
 const statusColor =
 b.status === 'delayed' ? 'border-red-500/50 bg-[#f5efef] text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.4)]' :
 b.status === 'in_transit' ? 'border-rose-500/50 bg-[#f5efef] text-white' :
 b.status === 'assigned' ? 'border-emerald-500/40 bg-[#f5efef] text-white' :
 'border-[#dbd2d1] bg-[#ede8e0]/60 text-white';
 const icon =
 b.status === 'delayed' ? '⚠️' :
 b.status === 'in_transit' ? '🚚' :
 b.status === 'assigned' ? '✅' : '📦';
 return (
 <motion.button
 key={b.id}
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: i * 0.04 }}
 whileHover={{ scale: 1.04, y: -2 }}
 whileTap={{ scale: 0.97 }}
 onClick={() => {
 setTrackSearchId(b.trackingId);
 setTrackError(null);
 setTrackResult({
 found: true,
 trackingId: b.trackingId,
 status: b.status,
 currentLocation: b.city || 'N/A',
 estimatedDelivery: null,
 assignedDriver: b.driverId || null,
 assignedHub: null,
 statusHistory: [{ status: 'Booking Confirmed', timestamp: b.createdAt, note: 'Booked by shipper' }],
 receiver: {
 name: b.receiverName,
 phone: b.receiverPhone || '',
 address: b.receiverAddress,
 },
 vehicleType: (b as any).vehicleType,
 });
 setShowTrackModal(true);
 }}
 className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer bg-white border-[#62161aff] text-[#1A1A1A] shadow-sm hover:scale-[1.02]`}
 >
 <span>{icon}</span>
 <div className="text-left">
 <div className="font-mono tracking-tight text-black">{b.trackingId}</div>
 <div className="text-[10px] font-normal text-black/70 mt-0.5">{b.receiverName} · {b.city}</div>
 </div>
 </motion.button>
 );
 })}
 </div>
 )}
 </motion.div>

 {/* ── Tracking Map ─────────────────────────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, scale: 0.98 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.1 }}
 className="grid grid-cols-1 lg:grid-cols-3 gap-6"
 >
 <div className="lg:col-span-2 h-[400px] card-outer overflow-hidden relative">
 <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
 <div className="card-inner px-3 py-1.5 rounded-lg flex items-center gap-2">
 <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-[#1A1A1A] shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#E53935]'}`} />
 <span className="text-[10px] font-bold text-white uppercase tracking-widest">
 {socket?.connected 
 ? (language === 'en' ? 'Live Tracking Active' : 'براہ راست ٹریکنگ فعال ہے') 
 : (language === 'en' ? 'Connecting...' : 'رابطہ ہو رہا ہے...')}
 </span>
 </div>
 {currentLocation && (
 <div className="card-inner px-3 py-1.5 rounded-lg flex items-center gap-2">
 <Navigation className="w-3 h-3 text-white"/>
 <span className="text-[10px] font-mono text-white">
 {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
 </span>
 </div>
 )}
 {locationError && (
 <div className="bg-[#E53935]/20 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-lg flex items-center gap-2 max-w-[200px]">
 <AlertTriangle className="w-3 h-3 text-white shrink-0"/>
 <span className="text-[9px] font-bold text-white leading-tight">
 {locationError}
 </span>
 </div>
 )}
 </div>
 {trackResult && trackResult.assignedDriver && trackResult.receiver?.address?.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ? (
 <TrackingMap 
 key="live-tracking-map"
 driverId={trackResult.assignedDriver}
 shipperPos={currentLocation ? [currentLocation.lat, currentLocation.lng] : [24.8607, 67.0011]}
 receiverPos={[
 parseFloat(trackResult.receiver.address.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/)[1]),
 parseFloat(trackResult.receiver.address.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/)[2])
 ]}
 />
 ) : (
 <MapComponent 
 key="standard-shipper-map"
 shipperLocation={currentLocation ? { ...currentLocation, name: currentUser?.name || 'Shipper' } : null}
 receiverLocations={bookings
 .map(b => {
 const coords = b.receiverAddress?.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
 if (coords) {
 return { 
 lat: parseFloat(coords[1]), 
 lng: parseFloat(coords[2]), 
 id: b.id, 
 name: b.receiverName 
 };
 }
 return null;
 })
 .filter((loc): loc is { lat: number; lng: number; id: string; name: string } => loc !== null)
 }
 />
 )}
 </div>

 <div className="card-outer p-6 flex flex-col justify-between">
 <div>
 <h3 className="text-white font-bold mb-2 flex items-center gap-2">
 <Navigation className="w-5 h-5 text-white"/> Real-time Logistics
 </h3>
 <p className="text-sm text-white leading-relaxed">
 Your dashboard map shows your current location and active shipments. 
 Turn on location services for accurate tracking and route planning.
 </p>
 
 <div className="mt-6 space-y-4">
 <div className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-full card-inner flex items-center justify-center shrink-0">
 <MapPin className="w-4 h-4 text-white"/>
 </div>
 <div>
 <p className="text-sm font-medium text-white">Live Status</p>
 <p className="text-xs text-white">{currentLocation ? 'Transmitting coordinates' : 'Waiting for GPS signal...'}</p>
 </div>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-full card-inner flex items-center justify-center shrink-0">
 <Truck className="w-4 h-4 text-white"/>
 </div>
 <div>
 <p className="text-sm font-medium text-white">Route Optimization</p>
 <p className="text-xs text-white">Auto-calculating ETA based on your movement.</p>
 </div>
 </div>
 </div>
 </div>
 
 <div className="pt-6 border-t border-white/20 mt-auto">
 <button 
 onClick={() => {
 if ('geolocation' in navigator) {
 navigator.geolocation.getCurrentPosition(() => {});
 }
 }}
 className="w-full card-inner hover:card-inner text-[#E53935] py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
 >
 <RefreshCw className="w-3 h-3"/> Calibrate Tracking
 </button>
 </div>
 </div>
 </motion.div>

 {/* ── Tracking Search Panel ──────────────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.12 }}
 className="card-outer p-6"
 >
 <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
 <Search className="w-5 h-5 text-white"/>
 {language === 'en' ? 'Track a Parcel' : 'پارسل ٹریک کریں'}
 </h2>
 <form onSubmit={handleTrackSearch} className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white"/>
 <input
 type="text"
 value={trackSearchId}
 onChange={e => setTrackSearchId(e.target.value)}
 placeholder={language === 'en' ? 'Enter Tracking ID e.g. 1G-A4F2-00001-847561' : 'ٹریکنگ آئی ڈی درج کریں...'}
 className="w-full card-inner pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/40 focus:outline-none focus:border-red-500 transition-colors"
 />
 </div>
 <button
 type="submit"
 disabled={trackLoading}
 className="flex items-center gap-2 bg-[#E53935] hover:bg-[#C62828] disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shrink-0"
 >
 {trackLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowRight className="w-4 h-4"/>}
 {language === 'en' ? 'Track' : 'ٹریک'}
 </button>
 </form>
 {trackError && (
 <p className="mt-3 text-sm text-white flex items-center gap-1.5">
 <AlertTriangle className="w-4 h-4 shrink-0"/> {trackError}
 </p>
 )}
 </motion.div>

 {/* ── All Tracking IDs Reference Box ──────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15 }}
 className="card-outer p-6"
 >
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-base font-bold text-white flex items-center gap-2">
 <Copy className="w-4 h-4 text-white"/>
 {language === 'en' ? 'All Tracking IDs' : 'تمام ٹریکنگ آئی ڈیز'}
 <span className="card-inner text-white text-xs font-bold px-2 py-0.5 rounded-full">
 {bookings.length}
 </span>
 </h2>
 <p className="text-xs text-white">
 {language === 'en' ? 'Click to copy or paste into search' : 'کاپی کریں یا سرچ میں پیسٹ کریں'}
 </p>
 </div>

 {bookings.length === 0 ? (
 <p className="text-white text-sm py-3 text-center">No bookings yet.</p>
 ) : (
 <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
 {bookings.map((b) => (
 <div
 key={b.id}
 className="flex items-center justify-between card-internal px-4 py-2.5 group"
 >
 {/* Left: tracking info */}
 <div className="flex items-center gap-3 min-w-0">
 <div className={`w-2 h-2 rounded-full shrink-0 ${
 b.status === 'delivered' ? 'bg-[#1A1A1A]' :
 b.status === 'in_transit' ? 'bg-[#E53935]' :
 b.status === 'assigned' ? 'bg-blue-400' :
 b.status === 'delayed' ? 'bg-[#E53935]' :
 'bg-neutral-500'
 }`} />
 <div className="min-w-0">
 <p className="font-mono text-sm font-bold text-black tracking-tight truncate">
 {b.trackingId}
 </p>
 <p className="text-[10px] text-black/70 truncate">
 {b.receiverName} &middot; {b.city} &middot; <span className="capitalize">{b.status}</span>
 </p>
 </div>
 </div>

 {/* Right: action buttons */}
 <div className="flex items-center gap-1.5 shrink-0 ml-3">
 {/* Paste into search bar */}
 <button
 onClick={() => setTrackSearchId(b.trackingId)}
 title="Paste into search bar"
 className="text-[10px] font-bold text-white hover:text-white card-inner hover:card-inner border border-white/20 hover:border-red-500/40 px-2 py-1 rounded-lg transition-all"
 >
 {language === 'en' ? 'Paste' : 'پیسٹ'}
 </button>
 {/* Copy to clipboard */}
 <button
 onClick={() => handleCopy(b.trackingId)}
 title="Copy tracking ID"
 className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
 copiedId === b.trackingId
 ? 'bg-[#1A1A1A]/15 border-white/20 text-[#FDFBF7]'
 : 'card-inner border-white/20 text-[#FDFBF7] hover:text-[#FDFBF7] hover:bg-[#dbd2d1]'
 }`}
 >
 {copiedId === b.trackingId
 ? <ClipboardCheck className="w-3.5 h-3.5"/>
 : <Copy className="w-3.5 h-3.5"/>}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </motion.div>

 {/* ── Shipping History Ledger (Requested by User) ────────────────── */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.12 }}
 className="card-outer overflow-hidden"
 >
 <div className="p-6 border-b border-white/20 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 card-inner rounded-xl flex items-center justify-center">
 <History className="w-5 h-5 text-white"/>
 </div>
 <div>
 <h2 className="text-lg font-bold text-white">Shipping History Ledger</h2>
 <p className="text-xs text-white font-medium uppercase tracking-tight">Permanent record of all generated tracking IDs</p>
 </div>
 </div>
 <button 
 onClick={fetchLedger}
 className="flex items-center gap-2 text-xs font-bold text-white hover:text-white transition-colors card-inner px-3 py-1.5 rounded-lg border border-white/20"
 >
 <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin' : ''}`} /> Sync Ledger
 </button>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-[#E53935]/10 text-[10px] font-bold uppercase tracking-widest text-white border-b border-white/20">
 <tr>
 <th className="px-6 py-4">Status</th>
 <th className="px-6 py-4">Tracking ID</th>
 <th className="px-6 py-4">Receiver & Contact</th>
 <th className="px-6 py-4">Vehicle & Weight</th>
 <th className="px-6 py-4">Destination</th>
 <th className="px-6 py-4">Total Price</th>
 <th className="px-6 py-4">Date</th>
 <th className="px-6 py-4 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#dbd2d1]/50">
 {loadingLedger && ledger.length === 0 ? (
 <tr>
 <td colSpan={6} className="px-6 py-12 text-center text-white italic">
 <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-20"/>
 Synchronizing ledger records...
 </td>
 </tr>
 ) : ledger.length === 0 ? (
 <tr>
 <td colSpan={6} className="px-6 py-12 text-center text-white italic">
 No shipping history found in the ledger.
 </td>
 </tr>
 ) : (
 ledger.map((entry, idx) => (
 <motion.tr 
 key={entry.id}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: idx * 0.02 }}
 className="group border-b border-white/20 card-inner transition-colors"
 >
 <td className="px-6 py-4">
 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
 entry.status === 'pending' ? 'card-inner text-white' : 'card-inner text-white'
 }`}>
 <div className={`w-1.5 h-1.5 rounded-full ${entry.status === 'pending' ? 'bg-neutral-500' : 'bg-[#1A1A1A]'}`} />
 {entry.status}
 </span>
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center gap-2">
 <span className="font-mono text-sm font-bold text-white card-inner px-2 py-1 rounded border border-white/20 group-hover:border-white/20 transition-colors">
 {entry.trackingId}
 </span>
 <button 
 onClick={() => handleCopy(entry.trackingId)}
 className="opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-white"
 >
 <Copy className="w-3.5 h-3.5"/>
 </button>
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="text-white font-bold">{entry.receiverName}</div>
 <div className="text-[10px] text-white font-mono">{entry.receiverPhone || 'No Phone'}</div>
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center gap-2">
 <span className="capitalize text-white font-medium">{entry.vehicleType}</span>
 {entry.totalWeight && (
 <span className="text-[10px] card-inner px-1.5 py-0.5 rounded text-white font-bold">
 {entry.totalWeight}Kg
 </span>
 )}
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="text-white font-medium">{entry.city}</div>
 <div className="text-[9px] text-white max-w-[120px] truncate">{entry.receiverAddress}</div>
 </td>
 <td className="px-6 py-4">
 <div className="text-white font-black text-xs">
 Rs. {entry.totalPrice?.toLocaleString() || '0'}
 </div>
 <div className="text-[9px] text-white uppercase font-black tracking-tighter">
 {entry.paymentMethod || 'Prepaid'}
 </div>
 </td>
 <td className="px-6 py-4 text-[11px] font-mono text-white">
 {entry.createdAt ? (entry.createdAt._seconds ? new Date(entry.createdAt._seconds * 1000).toLocaleString() : new Date(entry.createdAt).toLocaleString()) : 'N/A'}
 </td>
 <td className="px-6 py-4 text-right">
 <button 
 onClick={() => {
 setTrackSearchId(entry.trackingId);
 handleTrackSearch({ preventDefault: () => {} } as any);
 }}
 className="text-[11px] font-bold text-white hover:text-white card-inner border border-red-500/20 px-3 py-1.5 rounded-lg transition-all"
 >
 Track Detailed
 </button>
 </td>
 </motion.tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 <div className="p-4 card-inner border-t border-white/20 flex items-center justify-between">
 <p className="text-[11px] text-white italic">Showing last {ledger.length} tracking records</p>
 <div className="flex gap-2">
 <div className="w-2 h-2 rounded-full bg-[#1A1A1A]"/>
 <div className="w-2 h-2 rounded-full bg-[#dbd2d1]"/>
 <div className="w-2 h-2 rounded-full bg-[#dbd2d1]"/>
 </div>
 </div>
 </motion.div>

 <AnimatePresence>
 {showTrackModal && trackResult && (
 <motion.div
 key="track-backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
 onClick={e => { if (e.target === e.currentTarget) setShowTrackModal(false); }}
 >
 <motion.div
 key="track-panel"
 initial={{ opacity: 0, scale: 0.93, y: 24 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.93, y: 24 }}
 transition={{ type: 'spring', damping: 22, stiffness: 280 }}
 className="card-outer w-full max-w-lg overflow-hidden"
 >
 {/* Modal Header */}
 <div className="flex items-center justify-between p-5 border-b border-white/20 card-inner">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 card-inner rounded-xl flex items-center justify-center">
 <Search className="w-4 h-4 text-white"/>
 </div>
 <div>
 <h3 className="text-white font-bold text-sm">Parcel Tracking Details</h3>
 <p className="text-white text-xs font-mono">{trackResult.trackingId}</p>
 </div>
 </div>
 <button onClick={() => setShowTrackModal(false)} className="w-8 h-8 rounded-lg card-inner hover:bg-[#dbd2d1] flex items-center justify-center text-white hover:text-white transition-colors">
 <X className="w-4 h-4"/>
 </button>
 </div>
 <div className="p-5 space-y-4">
 {/* Status Banner */}
 <div className={`flex items-center gap-3 p-4 rounded-xl border ${
 trackResult.status === 'delivered' ? 'card-inner border-white/20' :
 trackResult.status === 'pending' ? 'card-inner/80 border-white/20' :
 'card-inner border-white/20'
 }`}>
 <div className={`w-3 h-3 rounded-full animate-pulse ${
 trackResult.status === 'delivered' ? 'bg-[#1A1A1A]' :
 trackResult.status === 'pending' ? 'bg-neutral-400' : 'bg-[#E53935]'
 }`} />
 <div>
 <p className="text-white font-bold text-sm capitalize">{trackResult.status.replace('_', ' ')}</p>
 <p className="text-xs text-white">Current Location: <strong className="text-white">{trackResult.currentLocation || 'N/A'}</strong></p>
 {trackResult.estimatedDelivery && (
 <p className="text-xs text-white mt-1 flex items-center gap-1">
 <Clock className="w-3 h-3"/> Estimated Delivery: <strong>{trackResult.estimatedDelivery}</strong>
 </p>
 )}
 {trackResult.predictedDelay && (
 <p className="text-xs text-white mt-1 flex items-center gap-1">
 <AlertTriangle className="w-3 h-3"/> Predicted Delay: <strong>{trackResult.predictedDelay}</strong>
 </p>
 )}
 </div>
 {trackResult.vehicleType && (
 <span className="ml-auto text-xs font-bold uppercase card-inner text-white px-2 py-1 rounded-lg tracking-wider">
 {trackResult.vehicleType === 'bike' ? '🏍 Bike' :
 trackResult.vehicleType === 'rickshaw' ? '🛺 Rickshaw' :
 trackResult.vehicleType === 'car' ? '🚗 Car' :
 trackResult.vehicleType === 'van' ? '🚐 Van' : '🚚 Truck'}
 </span>
 )}
 </div>
 {/* Receiver Info */}
 {trackResult.receiver && (
 <div className="card-inner p-4 space-y-1.5">
 <p className="text-xs font-bold text-white uppercase tracking-widest mb-2">Receiver Details</p>
 <p className="text-sm text-white font-medium">{trackResult.receiver.name}</p>
 <p className="text-xs text-white">{trackResult.receiver.phone}</p>
 <p className="text-xs text-white flex items-start gap-1">
 <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-white"/>{trackResult.receiver.address}
 </p>
 </div>
 )}
 {/* Status History Timeline */}
 {trackResult.statusHistory && trackResult.statusHistory.length > 0 && (
 <div>
 <p className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-1.5">
 <History className="w-3 h-3"/> Journey Timeline
 </p>
 <div className="space-y-2">
 {trackResult.statusHistory.map((s: any, i: number) => (
 <div key={i} className="flex gap-3">
 <div className="flex flex-col items-center">
 <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
 i === 0 ? 'bg-[#E53935]' : 'bg-neutral-600'
 }`} />
 {i < trackResult.statusHistory.length - 1 && (
 <div className="w-px flex-1 card-inner my-1"/>
 )}
 </div>
 <div className="pb-2">
 <p className="text-sm text-white font-medium">{s.status}</p>
 {s.note && <p className="text-xs text-white">{s.note}</p>}
 <p className="text-[10px] text-white mt-0.5">{new Date(s.timestamp).toLocaleString()}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 {/* Assigned Driver */}
 {trackResult.assignedDriver && (
 <div className="flex items-center gap-2 card-inner border border-emerald-500/20 rounded-xl p-3">
 <Truck className="w-4 h-4 text-white"/>
 <p className="text-sm text-white">Assigned Driver: <strong>{trackResult.assignedDriver}</strong></p>
 </div>
 )}
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15 }}
 className="card-outer p-6"
 >
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-lg font-bold text-white flex items-center gap-2">
 <Package className="w-5 h-5 text-white"/> My Parcel Bookings
 </h2>
 <button
 onClick={fetchBookings}
 className="flex items-center gap-1.5 text-sm text-white hover:text-white transition-colors"
 >
 <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} /> Refresh
 </button>
 </div>

 {bookings.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="w-16 h-16 card-inner rounded-full flex items-center justify-center mb-4">
 <Package className="w-8 h-8 text-white"/>
 </div>
 <p className="text-white text-sm">No bookings yet.</p>
 <button onClick={openModal} className="mt-4 text-white hover:text-white text-sm font-medium">
 Create your first parcel →
 </button>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm text-white">
 <thead className="text-xs uppercase bg-[#E53935]/10 text-white border-b border-white/20">
 <tr>
 <th className="px-4 py-3 font-medium">{language === 'en' ? 'Tracking ID' : 'ٹریکنگ آئی ڈی'}</th>
 <th className="px-4 py-3 font-medium">{t.dashboard.shipper.form.receiverName}</th>
 <th className="px-4 py-3 font-medium">{t.dashboard.shipper.form.city}</th>
 <th className="px-4 py-3 font-medium">{language === 'en' ? 'Parcels' : 'پارسلز'}</th>
 <th className="px-4 py-3 font-medium">{language === 'en' ? 'Status' : 'حالت'}</th>
 <th className="px-4 py-3 font-medium">{t.dashboard.navigation.driver}</th>
 <th className="px-4 py-3 font-medium">{language === 'en' ? 'Est. Delivery' : 'متوقع ترسیل'}</th>
 <th className="px-4 py-3 font-medium">{language === 'en' ? 'Date' : 'تاریخ'}</th>
 </tr>
 </thead>
 <tbody>
 {bookings.map((b, i) => (
 <motion.tr
 key={b.id}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.04 }}
 className="border-b border-white/20 hover:card-inner transition-colors"
 >
 <td className="px-4 py-3 font-mono font-medium text-white text-xs">{b.trackingId}</td>
 <td className="px-4 py-3">
 <p className="text-white font-medium">{b.receiverName}</p>
 <p className="text-xs text-white truncate max-w-[160px]">{b.receiverAddress}</p>
 </td>
 <td className="px-4 py-3">{b.city}</td>
 <td className="px-4 py-3">
 <span className="card-inner text-white text-xs px-2 py-0.5 rounded-full font-medium">
 {b.parcels?.length ?? 1} item{(b.parcels?.length ?? 1) > 1 ? 's' : ''}
 </span>
 </td>
 <td className="px-4 py-3"><StatusBadge status={b.status} language={language} /></td>
 <td className="px-4 py-3">
 {b.driverId
 ? <span className="text-white text-xs font-medium">{t.dashboard.statuses.assigned} ✓</span>
 : <span className="text-white text-xs">{language === 'en' ? 'Unassigned' : 'غیر مختص'}</span>}
 </td>
 <td className="px-4 py-3 text-xs">
 {new Date(b.createdAt).toLocaleDateString(language === 'en' ? 'en-PK' : 'ur-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
 </td>
 </motion.tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </motion.div>

 {/* ══════════════════════════════════════════════════════════════════
 MODAL — Create Parcel
 ══════════════════════════════════════════════════════════════════ */}
 <AnimatePresence>
 {showModal && (
 <motion.div
 key="modal-backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
 onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
 >
 <motion.div
 key="modal-panel"
 initial={{ opacity: 0, scale: 0.92, y: 24 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.92, y: 24 }}
 transition={{ type: 'spring', damping: 22, stiffness: 280 }}
 className="card-outer w-full max-w-2xl max-h-[92vh] overflow-y-auto"
 >
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-white/20 sticky top-0 card-inner z-10">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 card-inner rounded-xl flex items-center justify-center">
 <Package className="w-5 h-5 text-white"/>
 </div>
 <div>
 <h2 className="text-lg font-bold text-white">{t.dashboard.shipper.actions.createParcel}</h2>
 <p className="text-xs text-white">Fill in receiver info and add one or more parcels</p>
 </div>
 </div>
 <button
 onClick={() => setShowModal(false)}
 className="w-9 h-9 rounded-lg card-inner hover:bg-[#dbd2d1] flex items-center justify-center text-white hover:text-white transition-colors"
 >
 <X className="w-5 h-5"/>
 </button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 space-y-6">
 
 {/* Pickup Information */}
 <div>
 <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
 <Truck className="w-3.5 h-3.5"/> {language === 'en' ? 'Pickup Details' : 'پک اپ کی تفصیلات'}
 </h3>
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-white">{language === 'en' ? 'Pickup Address' : 'پک اپ ایڈریس'} <span className="text-white">*</span></label>
 <input required type="text"placeholder="Your current location or warehouse"
 value={shipperDetails.shipperAddress}
 onChange={e => setShipperDetails({ ...shipperDetails, shipperAddress: e.target.value })}
 className="w-full card-inner px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-red-500 transition-colors"
 />
 </div>
 </div>

 {/* Receiver Information */}
 <div>
 <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
 <MapPin className="w-3.5 h-3.5"/> {t.dashboard.shipper.form.receiverDetails}
 </h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-white">{t.dashboard.shipper.form.receiverName} <span className="text-white">*</span></label>
 <input required type="text"placeholder="e.g. Ali Khan"
 value={receiver.receiverName}
 onChange={e => setReceiver({ ...receiver, receiverName: e.target.value })}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-white">{t.dashboard.shipper.form.receiverPhone} <span className="text-white">*</span></label>
 <input required type="tel"placeholder="+92 3XX XXXXXXX"
 value={receiver.receiverPhone}
 onChange={e => setReceiver({ ...receiver, receiverPhone: e.target.value })}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 </div>
 <div className="space-y-1.5 sm:col-span-2">
 <div className="flex items-center justify-between">
 <label className="text-xs font-medium text-white">{t.dashboard.shipper.form.receiverAddress} <span className="text-white">*</span></label>
 <button
 type="button"
 onClick={fetchCurrentLocation}
 disabled={fetchingLoc}
 className="flex items-center gap-1 text-[10px] font-bold text-white hover:text-white transition-colors uppercase tracking-wider"
 >
 {fetchingLoc ? <Loader2 className="w-3 h-3 animate-spin"/> : <LocateFixed className="w-3 h-3"/>}
 {fetchingLoc ? t.dashboard.shipper.actions.fetchingLocation : t.dashboard.shipper.actions.turnOnLocation}
 </button>
 </div>
 <input required type="text"placeholder="Street, Area, Landmark"
 value={receiver.receiverAddress}
 onChange={e => setReceiver({ ...receiver, receiverAddress: e.target.value })}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-white">{t.dashboard.shipper.form.city} <span className="text-white">*</span></label>
 <div className="relative">
 <select
 value={receiver.city}
 onChange={e => setReceiver({ ...receiver, city: e.target.value })}
 className={`w-full appearance-none bg-white border-2 border-[#62161aff] rounded-lg ${language === 'ur' ? 'pr-3 pl-8' : 'px-3 pr-8'} py-2.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all cursor-pointer font-bold`}
 >
 <option value="Karachi">{t.dashboard.shipper.form.cities.karachi}</option>
 <option value="Lahore">{t.dashboard.shipper.form.cities.lahore}</option>
 <option value="Islamabad">{t.dashboard.shipper.form.cities.islamabad}</option>
 <option value="Rawalpindi">{t.dashboard.shipper.form.cities.rawalpindi}</option>
 <option value="Peshawar">{t.dashboard.shipper.form.cities.peshawar}</option>
 <option value="Quetta">{t.dashboard.shipper.form.cities.quetta}</option>
 <option value="Multan">{t.dashboard.shipper.form.cities.multan}</option>
 <option value="Faisalabad">{t.dashboard.shipper.form.cities.faisalabad}</option>
 </select>
 <ChevronDown className={`w-4 h-4 text-[#62161aff] absolute ${language === 'ur' ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 pointer-events-none`} />
 </div>
 </div>
 </div>
 </div>

 {/* Vehicle Selection */}
 <div>
 <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
 <Truck className="w-3.5 h-3.5"/> {language === 'en' ? 'Select Vehicle Type' : 'گاڑی کی قسم منتخب کریں'}
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 {[
 { id: 'bike', img: '/icons/bike.png' , label: language === 'en' ? 'Bike' : 'بائیک' },
 { id: 'rickshaw', img: '/icons/rickshaw.png', label: language === 'en' ? 'Rickshaw' : 'رکشہ' },
 { id: 'car', img: '/icons/car.png' , label: language === 'en' ? 'Car' : 'کار' }, 
 { id: 'van', img: '/icons/van.png' , label: language === 'en' ? 'Van' : 'وین' },
 { id: 'truck', img: '/icons/truck.png', label: language === 'en' ? 'Truck' : 'ٹرک' },
 ].map((v) => (
 <button
 key={v.id}
 type="button"
 onClick={() => setVehicleType(v.id as any)}
 className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
 vehicleType === v.id
 ? 'card-inner border-red-500 text-white '
 : 'card-inner text-white hover:border-white/20 hover:card-inner'
 }`}
 >
 <div className="w-12 h-12 flex items-center justify-center">
 <img src={v.img} alt={v.id} className="w-full h-full object-contain"/>
 </div>
 <span className="text-[10px] font-bold uppercase tracking-wider">{v.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Parcel Entries */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
 <Package className="w-3.5 h-3.5"/> {language === 'en' ? `Parcels (${parcelList.length})` : `پارسلز (${parcelList.length})`}
 </h3>
 <motion.button
 type="button"whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
 onClick={addParcel}
 className="flex items-center gap-1.5 text-xs font-semibold text-white hover:text-white card-inner px-3 py-1.5 rounded-lg transition-all"
 >
 <Plus className="w-3.5 h-3.5"/> {t.dashboard.shipper.form.addParcel}
 </motion.button>
 </div>

 <div className="space-y-3">
 <AnimatePresence>
 {parcelList.map((parcel, idx) => (
 <motion.div
 key={parcel.id}
 initial={{ opacity: 0, height: 0, y: -10 }}
 animate={{ opacity: 1, height: 'auto', y: 0 }}
 exit={{ opacity: 0, height: 0, y: -10 }}
 transition={{ duration: 0.2 }}
 className="card-inner p-4 overflow-hidden"
 >
 <div className="flex items-center justify-between mb-3">
 <span className="text-xs font-semibold text-white uppercase tracking-wider">{language === 'en' ? `Parcel #${idx + 1}` : `پارسل #${idx + 1}`}</span>
 {parcelList.length > 1 && (
 <motion.button
 type="button"whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
 onClick={() => removeParcel(parcel.id)}
 className="w-6 h-6 rounded-md bg-[#E53935]/10 hover:bg-[#E53935]/20 text-white flex items-center justify-center transition-colors"
 >
 <Minus className="w-3.5 h-3.5"/>
 </motion.button>
 )}
 </div>

 <div className="space-y-3">
 <div className="space-y-1.5">
 <label className="text-xs font-medium text-white">{t.dashboard.shipper.form.parcelDescription} <span className="text-white">*</span></label>
 <input required type="text"placeholder="e.g. Clothes, Electronics, Documents"
 value={parcel.description}
 onChange={e => updateParcel(parcel.id, 'description', e.target.value)}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 </div>

 {/* Weight & Dimensions */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 card-inner p-3 rounded-lg border border-white/20">
 <div className="space-y-1">
 <label className="text-[10px] font-bold text-white uppercase flex items-center gap-1"><Scale className="w-2.5 h-2.5"/> Weight (kg)</label>
 <input type="number"min="0.1"step="0.1"value={parcel.weight} onChange={e => updateParcel(parcel.id, 'weight', e.target.value)}
 className="w-full bg-white border border-[#62161aff] rounded-md px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"/>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-bold text-white uppercase flex items-center gap-1"><Maximize className="w-2.5 h-2.5"/> Length (cm)</label>
 <input type="number"min="1"value={parcel.length} onChange={e => updateParcel(parcel.id, 'length', e.target.value)}
 className="w-full bg-white border border-[#62161aff] rounded-md px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"/>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-bold text-white uppercase flex items-center gap-1">Width (cm)</label>
 <input type="number"min="1"value={parcel.width} onChange={e => updateParcel(parcel.id, 'width', e.target.value)}
 className="w-full bg-white border border-[#62161aff] rounded-md px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"/>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-bold text-white uppercase flex items-center gap-1">Height (cm)</label>
 <input type="number"min="1"value={parcel.height} onChange={e => updateParcel(parcel.id, 'height', e.target.value)}
 className="w-full bg-white border border-[#62161aff] rounded-md px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"/>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-white">{t.dashboard.shipper.form.paymentMethod} <span className="text-white">*</span></label>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => updateParcel(parcel.id, 'paymentMethod', 'COD')}
 className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border transition-all ${
 parcel.paymentMethod === 'COD'
 ? 'card-inner border-red-500 text-white '
 : 'card-inner border-white/20 text-white hover:border-white/20'
 }`}
 >
 <Banknote className="w-4 h-4"/> COD
 </button>
 <button
 type="button"
 onClick={() => updateParcel(parcel.id, 'paymentMethod', 'ONLINE')}
 className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border transition-all ${
 parcel.paymentMethod === 'ONLINE'
 ? 'card-inner border-rose-500 text-white '
 : 'card-inner border-white/20 text-white hover:border-white/20'
 }`}
 >
 <CreditCard className="w-4 h-4"/> {language === 'en' ? 'Online' : 'آن لائن'}
 </button>
 </div>
 </div>

 {/* COD Amount */}
 <AnimatePresence>
 {parcel.paymentMethod === 'COD' && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="space-y-1.5 overflow-hidden"
 >
 <label className="text-xs font-medium text-white">COD Amount (Rs.) <span className="text-white">*</span></label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black text-sm font-bold">Rs.</span>
 <input
 required={parcel.paymentMethod === 'COD'}
 type="number"min="1"placeholder="0"
 value={parcel.codAmount}
 onChange={e => updateParcel(parcel.id, 'codAmount', e.target.value)}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg pl-12 pr-3 py-2 text-sm text-black font-bold placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white font-bold uppercase">Auto-Calculated</div>
 </div>
 <p className="text-[10px] text-white mt-1 italic">Price based on {estimatedDistance.toFixed(1)}km distance and {vehicleType} rates.</p>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Online hint */}
 <AnimatePresence>
 {parcel.paymentMethod === 'ONLINE' && (
 <motion.p
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="text-xs text-white flex items-center gap-1.5 bg-[#E53935]/5 border border-rose-500/20 rounded-lg px-3 py-2"
 >
 <CreditCard className="w-3 h-3"/>
 {language === 'en' ? 'Card details will be collected after booking' : 'کارڈ کی تفصیلات بکنگ کے بعد لی جائیں گی'}
 </motion.p>
 )}
 </AnimatePresence>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 </div>

 {/* Status message */}
 <AnimatePresence>
 {submitStatus !== 'idle' && (
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 8 }}
 className={`p-4 rounded-xl border text-sm font-medium ${
 submitStatus === 'success'
 ? 'card-inner border-white/20 text-[#FDFBF7]'
 : 'bg-[#E53935]/10 border-red-500/40 text-[#FDFBF7] '
 }`}
 >
 {submitStatus === 'success' && <CheckCircle2 className="w-4 h-4 inline mr-2"/>}
 {submitMsg}
 </motion.div>
 )}
 </AnimatePresence>

 {/* Actions */}
 <div className="flex justify-between items-center pt-2 border-t border-white/20">
 <button type="button"onClick={() => setShowModal(false)}
 className="text-white hover:text-white text-sm font-medium px-4 py-2 transition-colors"
 >
 {t.dashboard.shipper.form.cancel}
 </button>
 <motion.button
 type="submit"disabled={submitting}
 whileHover={{ scale: submitting ? 1 : 1.02 }}
 whileTap={{ scale: submitting ? 1 : 0.97 }}
 className="flex items-center gap-2 bg-[#E53935] hover:bg-[#C62828] disabled:bg-[#E53935]/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
 >
 {submitting
 ? <><Loader2 className="w-4 h-4 animate-spin"/> {t.dashboard.shipper.form.booking}</>
 : <><Package className="w-4 h-4"/> {t.dashboard.shipper.form.bookParcel}</>
 }
 </motion.button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* ══════════════════════════════════════════════════════════════════
 SUCCESS MODAL
 ══════════════════════════════════════════════════════════════════ */}
 <AnimatePresence>
 {showSuccessModal && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[10000] flex items-center justify-center p-4 card-inner backdrop-blur-md"
 >
 <motion.div
 initial={{ scale: 0.9, opacity: 0, y: 20 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 0.9, opacity: 0, y: 20 }}
 className="card-inner border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] relative overflow-hidden text-center"
 >
 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#1A1A1A]/5 blur-[80px] -z-10"/>

 <div className="w-20 h-20 bg-[#1A1A1A]/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20">
 <CheckCircle2 className="w-10 h-10 text-white"/>
 </div>

 <h2 className="text-2xl font-bold text-white mb-2">
 {language === 'en' ? 'Booking Confirmed!' : 'بکنگ کی تصدیق ہوگئی!'}
 </h2>
 <p className="text-white text-sm mb-8">
 {language === 'en' 
 ? 'Your parcel has been registered. You can track it using the ID below.' 
 : 'آپ کا پارسل رجسٹر ہو گیا ہے۔ آپ نیچے دی گئی آئی ڈی کا استعمال کر کے اسے ٹریک کر سکتے ہیں۔'}
 </p>

 <div className="card-inner p-4 mb-8 flex items-center justify-between group">
 <div className="text-left">
 <p className="text-[10px] uppercase tracking-widest text-white font-bold mb-1">Tracking ID</p>
 <p className="text-lg font-mono font-bold text-white">{lastTrackingId}</p>
 </div>
 <button 
 onClick={() => handleCopy(lastTrackingId)}
 className="p-3 card-inner hover:bg-[#dbd2d1] rounded-xl transition-colors"
 >
 {copiedId === lastTrackingId ? <ClipboardCheck className="w-5 h-5 text-white"/> : <Copy className="w-5 h-5 text-white"/>}
 </button>
 </div>

 <button
 onClick={() => setShowSuccessModal(false)}
 className="w-full bg-[#E53935] hover:bg-[#C62828] text-white py-4 rounded-xl font-bold transition-all"
 >
 {language === 'en' ? 'Go to My Shipments' : 'میری ترسیلات پر جائیں'}
 </button>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 <style jsx global>{`
 .leaflet-container { background: #0f172a !important; border-radius: 1rem; }
 ::-webkit-scrollbar { width: 6px; }
 ::-webkit-scrollbar-track { background: transparent; }
 ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
 ::-webkit-scrollbar-thumb:hover { background: #475569; }
 `}</style>
 </div>
 );
}
