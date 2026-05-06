'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
 Package, MapPin, Truck, CheckCircle2, Save, Trash2, Plus, AlertCircle, Loader2, RefreshCw, Zap, ChevronDown, LayoutGrid
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/translations';

interface ParcelEntry {
 id: string;
 receiverName: string;
 receiverPhone: string;
 receiverAddress: string;
 city: string; // Added city field
 description: string;
 weight: number;
 paymentMethod: 'COD' | 'ONLINE' | 'PREPAID';
 codAmount: string;
}

const STORAGE_KEY = 'loginex_brand_draft_parcels';

export default function BrandDeliveryDashboard() {
 const { currentUser, language } = useAppStore();
 const t = translations[language as keyof typeof translations];

 // ── Auto vs Manual Mode ──
 const [vehicleMode, setVehicleMode] = useState<'auto'|'manual'>('auto');
 const [manualVehicle, setManualVehicle] = useState<'bike'|'car'|'van'|'rickshaw'|'truck'>('car');

 // ── Form State ──
 const newEntry = (): ParcelEntry => ({
 id: crypto.randomUUID(),
 receiverName: '',
 receiverPhone: '',
 receiverAddress: '',
 city: 'Karachi', // Default city
 description: '',
 weight: 1,
 paymentMethod: 'COD',
 codAmount: '0'
 });

 const [parcels, setParcels] = useState<ParcelEntry[]>([]);
 const [isClient, setIsClient] = useState(false);

 // ── Load Drafts ──
 useEffect(() => {
 setIsClient(true);
 const saved = localStorage.getItem(STORAGE_KEY);
 if (saved) {
 try {
 const parsed = JSON.parse(saved);
 if (Array.isArray(parsed) && parsed.length > 0) {
 setParcels(parsed);
 return;
 }
 } catch (e) {
 console.error('Failed to load parcel drafts', e);
 }
 }
 setParcels([newEntry()]);
 }, []);

 // ── Auto Save every 30s ──
 const [lastSaved, setLastSaved] = useState<Date | null>(null);

 useEffect(() => {
 if (!isClient || parcels.length === 0) return;
 const interval = setInterval(() => {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(parcels));
 setLastSaved(new Date());
 }, 30000);
 return () => clearInterval(interval);
 }, [parcels, isClient]);

 // ── Helpers ──
 const updateParcel = (id: string, field: keyof ParcelEntry, value: any) => {
 setParcels(p => p.map(e => e.id === id ? { ...e, [field]: value } : e));
 };
 const addParcel = () => setParcels(p => [...p, newEntry()]);
 const removeParcel = (id: string) => setParcels(p => p.length > 1 ? p.filter(e => e.id !== id) : p);

 // ── Vehicle Assigner ──
 const resolveVehicleDetails = (weight: number) => {
 if (vehicleMode === 'manual') return manualVehicle;
 if (weight <= 5) return 'bike';
 if (weight <= 15) return 'rickshaw';
 if (weight <= 40) return 'car';
 if (weight <= 100) return 'van';
 return 'truck';
 };

 const getVehicleTotalWeight = () => parcels.reduce((acc, p) => acc + (p.weight || 0), 0);

 // ── Submission State ──
 const [submitting, setSubmitting] = useState(false);
 const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
 const [submitMsg, setSubmitMsg] = useState('');

 // ── Ledger State ──
 const [ledger, setLedger] = useState<any[]>([]);
 const [loadingLedger, setLoadingLedger] = useState(false);

 const fetchLedger = useCallback(async () => {
 if (!currentUser?.id) return;
 setLoadingLedger(true);
 try {
 const res = await fetch(`/api-proxy/parcels/brand-ledger/${currentUser.id}`);
 if (!res.ok) throw new Error('Proxy error');
 const data = await res.json();
 setLedger(Array.isArray(data) ? data : []);
 } catch {
 console.warn('Could not load ledger.');
 } finally {
 setLoadingLedger(false);
 }
 }, [currentUser?.id]);

 useEffect(() => { fetchLedger(); }, [fetchLedger]);

 // ── Save Bookings Logic ──
 const handleSaveBookings = async () => {
 if (!currentUser?.id) return;

 setSubmitting(true);
 setSubmitStatus('idle');

 const finalWarehouseLocation = currentUser.warehouseLocation || (currentUser as any).address || 'Central Warehouse (Default)';

 // Filter out rows that are entirely empty
 const validParcels = parcels.filter(p => p.receiverName && p.receiverPhone && p.receiverAddress);
 
 if (validParcels.length === 0) {
 setSubmitStatus('error');
 setSubmitMsg('No valid parcels to save. Please fill out details.');
 setSubmitting(false);
 return;
 }

 let successCount = 0;
 
 // Process them sequentially to avoid spamming the backend
 for (const p of validParcels) {
 const vehicleChoice = resolveVehicleDetails(p.weight);
 
 const payload = {
 userId: currentUser.id,
 shipperName: currentUser.name,
 shipperPhone: currentUser.phone,
 shipperAddress: finalWarehouseLocation,
 receiverName: p.receiverName,
 receiverPhone: p.receiverPhone,
 receiverAddress: p.receiverAddress,
 city: p.city || currentUser.city || 'Karachi', // Use selected city
 vehicleType: vehicleChoice,
 parcels: [{
 description: p.description || 'Brand Batch Item',
 paymentMethod: p.paymentMethod,
 codAmount: Number(p.codAmount),
 weight: p.weight,
 length: 10, width: 10, height: 10, // Defaults for dimension
 unitPrice: 500, // Estimate fallback
 }]
 };

 try {
 const res = await fetch('/api-proxy/parcels/brand-create', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 if (res.ok) {
 successCount++;
 } else {
 console.error(`Failed to submit parcel for ${p.receiverName}`);
 }
 } catch (err) {
 console.error('Fetch error on parcel:', err);
 }
 }

 if (successCount > 0) {
 setSubmitStatus('success');
 setSubmitMsg(`Successfully dispatched ${successCount} booking(s). Vehicles assigned.`);
 // Clear drafts
 setParcels([newEntry()]);
 localStorage.removeItem(STORAGE_KEY);
 fetchLedger();
 } else {
 setSubmitStatus('error');
 setSubmitMsg('Failed to process bookings. Check console logs.');
 }
 
 setSubmitting(false);
 };

 const manualTriggerSave = () => {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(parcels));
 setLastSaved(new Date());
 alert('Draft saved manually!');
 };

 if (!isClient) return null;

 return (
 <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 relative z-10 p-2 md:p-6 text-white font-sans">
 <div className="card-internal flex flex-col md:flex-row items-start md:items-center justify-between mb-8 p-6">
 <div>
 <h1 className="text-3xl md:text-4xl font-black tracking-tight text-black">
 Brand <span className="text-[#62161aff]">Delivery</span>
 </h1>
 <p className="text-gray-700 mt-2 font-medium">
 Batch submission portal. Enter parcels below and dispatch instantly.
 </p>
 </div>
 <div className="flex items-center gap-4 mt-4 md:mt-0">
 <div className="flex items-center gap-2 text-xs font-bold px-4 py-3 border-2 border-[#62161aff] rounded-xl bg-gray-50">
 <MapPin className="w-4 h-4 text-[#62161aff]"/>
 <span className="text-gray-600 uppercase tracking-wider">Warehouse:</span> 
 <span className="text-black font-black">{currentUser?.warehouseLocation || 'Not set'}</span>
 </div>
 </div>
 </div>

 <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-start">
 {/* LEFT COLUMN: Large Form Area */}
 <div className="space-y-6">
 <div className="card-outer overflow-hidden">
 <div className="p-4 md:p-6 border-b border-white/20 flex justify-between items-center">
 <h2 className="text-xl font-bold flex items-center gap-2">
 <Package className="w-5 h-5 text-white"/> Parcel Form
 </h2>
 <div className="flex items-center gap-3">
 <span className="text-xs text-white">
 {lastSaved ? `Draft Saved: ${lastSaved.toLocaleTimeString()}` : 'Not saved yet'}
 </span>
 <button onClick={manualTriggerSave} className="text-xs px-3 py-1.5 rounded-lg card-inner transition-colors flex items-center gap-1 font-medium">
 <Save className="w-3.5 h-3.5"/> Save Draft
 </button>
 </div>
 </div>

 <div className="p-4 space-y-8">
 {/* Grouping parcels by city for"Clustering"UI */}
 {Object.entries(parcels.reduce((acc, p) => {
 const city = p.city || 'Karachi';
 if (!acc[city]) acc[city] = [];
 acc[city].push(p);
 return acc;
 }, {} as Record<string, ParcelEntry[]>)).map(([city, cityParcels]) => (
 <div key={city} className="space-y-4">
 <div className="flex items-center gap-2 pb-2 border-b border-white/20/50">
 <LayoutGrid className="w-4 h-4 text-white"/>
 <h3 className="text-sm font-bold uppercase tracking-widest text-white">
 {t.dashboard.shipper.form.cities[city.toLowerCase() as keyof typeof t.dashboard.shipper.form.cities] || city} Cluster
 </h3>
 <span className="card-inner text-white text-[10px] px-2 py-0.5 rounded-full border border-red-500/20 font-bold">
 {cityParcels.length} Unit(s)
 </span>
 </div>

 {cityParcels.map((p) => {
 const globalIdx = parcels.findIndex(item => item.id === p.id);
 return (
 <div key={p.id} className="relative rounded-xl border border-white/20 p-4 transition-all card-inner">
 <div className="absolute top-2 left-2 w-6 h-6 rounded-full card-inner flex items-center justify-center text-xs font-bold font-mono">
 {globalIdx + 1}
 </div>
 {parcels.length > 1 && (
 <button onClick={() => removeParcel(p.id)} className="absolute top-2 right-2 text-white hover:text-white">
 <Trash2 className="w-4 h-4"/>
 </button>
 )}
 
 <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
 <div className="md:col-span-3 space-y-2">
 <label className="text-[10px] uppercase font-bold text-white tracking-wider">Receiver Detail</label>
 <input 
 type="text"required placeholder="Name"
 value={p.receiverName} onChange={e => updateParcel(p.id, 'receiverName', e.target.value)}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 <input 
 type="tel"required placeholder="Phone"
 value={p.receiverPhone} onChange={e => updateParcel(p.id, 'receiverPhone', e.target.value)}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 <div className="relative">
 <select 
 value={p.city} onChange={e => updateParcel(p.id, 'city', e.target.value)}
 className="w-full appearance-none card-inner border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-all cursor-pointer font-bold"
 >
 <option value="Karachi" className="bg-[#62161aff]">Karachi</option>
 <option value="Lahore" className="bg-[#62161aff]">Lahore</option>
 <option value="Islamabad" className="bg-[#62161aff]">Islamabad</option>
 <option value="Rawalpindi" className="bg-[#62161aff]">Rawalpindi</option>
 <option value="Peshawar" className="bg-[#62161aff]">Peshawar</option>
 <option value="Quetta" className="bg-[#62161aff]">Quetta</option>
 <option value="Multan" className="bg-[#62161aff]">Multan</option>
 <option value="Faisalabad" className="bg-[#62161aff]">Faisalabad</option>
 </select>
 <ChevronDown className="w-3.5 h-3.5 text-white absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"/>
 </div>
 </div>
 
 <div className="md:col-span-4">
 <label className="text-[10px] uppercase font-bold text-white tracking-wider">Address & Notes</label>
 <textarea 
 required placeholder="Full delivery address"rows={3}
 value={p.receiverAddress} onChange={e => updateParcel(p.id, 'receiverAddress', e.target.value)}
 className="w-full mt-1 bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all resize-none h-[116px]"
 />
 </div>

 <div className="md:col-span-2 space-y-3">
 <div>
 <label className="text-[10px] uppercase font-bold text-white tracking-wider">Wt. (kg)</label>
 <input 
 type="number"min="0.1"step="0.1"required
 value={p.weight} onChange={e => updateParcel(p.id, 'weight', parseFloat(e.target.value) || 1)}
 className="w-full mt-1 bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 </div>
 <div className="text-xs font-medium text-white card-inner px-2 py-1 rounded inline-block mt-1">
 Vehicle: {resolveVehicleDetails(p.weight).toUpperCase()}
 </div>
 </div>

 <div className="md:col-span-3 space-y-3">
 <div>
 <label className="text-[10px] uppercase font-bold text-white tracking-wider">Payment</label>
 <select 
 value={p.paymentMethod} onChange={e => updateParcel(p.id, 'paymentMethod', e.target.value)}
 className="w-full mt-1 bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all cursor-pointer"
 >
 <option value="COD">COD (Collection)</option>
 <option value="PREPAID">Already Paid</option>
 </select>
 </div>
 {p.paymentMethod === 'COD' && (
 <div>
 <label className="text-[10px] uppercase font-bold text-white tracking-wider">Amount (Rs)</label>
 <input 
 type="number"min="0"required
 value={p.codAmount} onChange={e => updateParcel(p.id, 'codAmount', e.target.value)}
 className="w-full bg-white border-2 border-[#62161aff] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#62161aff] transition-all"
 />
 </div>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 ))}
 
 <button onClick={addParcel} className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white hover:text-white hover:border-red-500 card-inner transition-all flex justify-center items-center gap-2 font-bold focus:outline-none">
 <Plus className="w-5 h-5"/> Add Another Parcel
 </button>
 </div>
 </div>
 </div>

 {/* RIGHT COLUMN: Settings & Action Panel */}
 <div className="space-y-6">
 <div className="card-outer p-6  relative overflow-hidden">
 {/* Decor */}
 <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#62161aff] text-white backdrop-blur-md blur-3xl rounded-full"/>
 
 <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
 <Truck className="w-5 h-5 text-white"/> Vehicle Assignment
 </h3>

 <div className="space-y-4 relative z-10">
 <div className="flex card-inner p-1">
 <button 
 onClick={() => setVehicleMode('auto')} 
 className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${vehicleMode === 'auto' ? 'bg-[#E53935] text-[#FDFBF7] ' : 'text-[#FDFBF7] hover:text-[#FDFBF7]'}`}
 >
 Auto Select
 </button>
 <button 
 onClick={() => setVehicleMode('manual')}
 className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${vehicleMode === 'manual' ? 'card-inner text-white ' : 'text-white hover:text-white'}`}
 >
 Manual Override
 </button>
 </div>

 {vehicleMode === 'auto' ? (
 <div className="card-inner text-white text-sm p-4 rounded-xl flex items-start gap-3">
 <Zap className="w-5 h-5 shrink-0 mt-0.5"/>
 <p>System automatically assigns Bike, Rickshaw, Car, Van, or Truck per parcel based on its raw weight log to optimize efficiency.</p>
 </div>
 ) : (
 <div className="space-y-2">
 <label className="text-sm font-medium text-white tracking-tight">Force Vehicle Type (All Parcels)</label>
 <select 
 value={manualVehicle} 
 onChange={(e: any) => setManualVehicle(e.target.value)}
 className="w-full appearance-none card-inner border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-all cursor-pointer font-bold"
 >
 <option value="bike" className="bg-[#62161aff]">Motorbike (Fast, Local)</option>
 <option value="rickshaw" className="bg-[#62161aff]">Rickshaw (Mid-size, Local)</option>
 <option value="car" className="bg-[#62161aff]">Car (Secure, Moderate volume)</option>
 <option value="van" className="bg-[#62161aff]">Van (Large batch)</option>
 <option value="truck" className="bg-[#62161aff]">Truck (Heavy/Bulk freight)</option>
 </select>
 </div>
 )}
 </div>

 <div className="mt-8 pt-6 border-t border-white/20 space-y-4">
 <div className="flex justify-between items-center text-sm">
 <span className="text-white">Total Parcels</span>
 <span className="font-bold text-white text-lg">{parcels.length}</span>
 </div>
 <div className="flex justify-between items-center text-sm">
 <span className="text-white">Est. Total Wt.</span>
 <span className="font-bold text-white">{getVehicleTotalWeight().toFixed(1)} kg</span>
 </div>

 <div className="pt-4">
 <button
 onClick={handleSaveBookings}
 disabled={submitting}
 className="w-full h-14 rounded-xl font-bold text-white flex items-center justify-center gap-2 glow-brand transition-all hover:scale-[1.02] disabled:opacity-50"
 style={{ background: 'linear-gradient(135deg, #dc2626 0%, #e11d48 100%)' }}
 >
 {submitting ? (
 <Loader2 className="w-6 h-6 animate-spin"/>
 ) : (
 <>Save Bookings <CheckCircle2 className="w-5 h-5"/></>
 )}
 </button>
 {submitStatus !== 'idle' && (
 <motion.p 
 initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} 
 className={`text-sm text-center mt-3 font-semibold ${submitStatus === 'success' ? 'text-white' : 'text-white '}`}
 >
 {submitMsg}
 </motion.p>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* LEDGER SECTION */}
 <div className="mt-8 card-outer overflow-hidden">
 <div className="p-5 border-b border-white/20 flex justify-between items-center">
 <h2 className="text-lg font-bold flex items-center gap-2">
 Record Ledger (Dispatched)
 </h2>
 <button onClick={fetchLedger} className="text-white hover:text-white transition-colors"title="Refresh Ledger">
 <RefreshCw className={`w-4 h-4 ${loadingLedger ? 'animate-spin' : ''}`} />
 </button>
 </div>
 <div className="p-0 overflow-x-auto">
 <table className="w-full text-left border-collapse min-w-[800px]">
 <thead>
 <tr className="bg-white/5 border-b border-white/20">
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider">Tracking #</th>
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider">Date</th>
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider">Receiver</th>
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider">City</th>
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider">Vehicle</th>
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider">Assigned Driver</th>
 <th className="py-3 px-5 text-xs font-bold text-white uppercase tracking-wider text-right">Status</th>
 </tr>
 </thead>
 <tbody className="text-sm">
 {!loadingLedger && ledger.length === 0 && (
 <tr>
 <td colSpan={6} className="py-8 text-center text-white font-medium">
 No parcels dispatched yet.
 </td>
 </tr>
 )}
 {ledger.map((item: any) => (
 <tr key={item.id} className="border-b border-white/20 card-inner transition-colors">
 <td className="py-4 px-5 font-mono text-xs text-white font-medium tracking-wide">
 {item.trackingId || item.id.substring(0,8)}
 </td>
 <td className="py-4 px-5 text-white">
 {new Date(item.createdAt?._seconds * 1000 || Date.now()).toLocaleDateString()}
 </td>
 <td className="py-4 px-5 text-white font-medium">
 {item.receiverName}
 <div className="text-xs text-white truncate max-w-[200px]">{item.receiverAddress}</div>
 </td>
 <td className="py-4 px-5">
 <span className="text-white font-bold card-inner px-2 py-1 rounded text-[10px] uppercase">
 {item.city || 'Karachi'}
 </span>
 </td>
 <td className="py-4 px-5">
 <span className="capitalize px-2 py-1 rounded card-inner text-white text-xs font-bold tracking-wider">
 {item.vehicleType}
 </span>
 </td>
 <td className="py-4 px-5 text-white">
 {item.assignedDriverName || <span className="text-[#b0aaa4] italic">Pending assignment</span>}
 </td>
 <td className="py-4 px-5 text-right">
 <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase
 ${item.status === 'delivered' ? 'card-inner text-[#FDFBF7]' : 
 item.status === 'pending' ? 'card-inner text-[#FDFBF7]' : 
 item.status === 'delayed' ? 'card-inner text-[#FDFBF7]' : 
 'card-inner text-blue-400'}`}>
 {item.status.replace('_', ' ')}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
}
