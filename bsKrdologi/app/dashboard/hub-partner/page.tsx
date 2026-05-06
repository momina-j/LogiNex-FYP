'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import {
 Package, ShoppingBag, TrendingUp, BarChart2,
 X, Check, AlertCircle, Truck, RefreshCw, Star, Activity, MapPin
} from 'lucide-react';

const API = '/api-proxy/hubpartner';

/* ─────────────────── Types ─────────────────── */
interface Store { storeName: string; status: string; createdAt: string; currency: string; }
interface Order { id: string; customerName: string; amount: number; status: string; createdAt: string; address?: string; items?: any[]; }
interface Rider { id: string; name: string; phone: string; status: string; }
interface Analytics { revenueChart: { day: string; revenue: number }[]; totalRevenue: number; totalOrders: number; topProducts: { id: string; name: string; price: number; stock: number }[]; }

/* ─────────────────── Toast ─────────────────── */
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
 useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
 return (
 <motion.div
 initial={{ opacity: 0, y: 40, scale: 0.9 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 40, scale: 0.9 }}
 className={`fixed bottom-24 right-6 z-[100] flex items-center gap-3 px-5 py-3 card-outer text-sm font-semibold`}
 style={{
 color: type === 'success' ? '#34d399' : '#f87171',
 }}
 >
 {type === 'success' ? <Check className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
 {msg}
 <button onClick={onClose}><X className="w-3.5 h-3.5 opacity-60 hover:opacity-100"/></button>
 </motion.div>
 );
}

/* ─────────────────── Section Header ─────────────────── */
function SectionTitle({ icon: Icon, title, accent = '#dc2626' }: { icon: any; title: string; accent?: string }) {
 return (
 <div className="flex items-center gap-3 mb-5">
 <div className="w-9 h-9 rounded-xl flex items-center justify-center"style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
 <Icon className="w-4 h-4"style={{ color: accent }} />
 </div>
 <h2 className="text-base font-bold text-white">{title}</h2>
 </div>
 );
}

/* ─────────────────── Card ─────────────────── */
function Card({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
 return (
 <div className={`card-outer p-5 ${className}`}>
 {children}
 </div>
 );
}

/* ─────────────────── Status Badge ─────────────────── */
function StatusBadge({ status }: { status: string }) {
 const s = status?.toLowerCase();
 return (
 <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full badge-${s}`}>
 {status}
 </span>
 );
}

/* ─────────────────── Parcel Modal ─────────────────── */
function ParcelModal({
 onClose, onConfirm, order
}: {
 onClose: () => void;
 onConfirm: (data: any) => void;
 order: Order;
}) {
 const [form, setForm] = useState({
 weight: '1kg',
 type: 'Standard',
 notes: ''
 });
 const [loading, setLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 await onConfirm(form);
 setLoading(false);
 };

 return (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
 onClick={onClose}
 >
 <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
 onClick={e => e.stopPropagation()}
 className="w-full max-w-md card-outer overflow-hidden"
 >
 <div className="flex items-center justify-between p-5 border-b border-white/20 card-inner">
 <div className="flex items-center gap-2 text-white">
 <Truck className="w-5 h-5 text-white"/>
 <h3 className="text-base font-bold">Generate Logistics Parcel</h3>
 </div>
 <button onClick={onClose} className="text-white hover:text-white"><X className="w-5 h-5"/></button>
 </div>

 <form onSubmit={handleSubmit} className="p-5 space-y-4">
 <div className="p-3 card-inner mb-4">
 <p className="text-[10px] uppercase font-bold text-red-300 mb-1">Order Details</p>
 <p className="text-sm font-bold text-white">{order.customerName}</p>
 <p className="text-[10px] text-white">{order.address || 'No Address Provided'}</p>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-xs font-semibold text-white mb-1 block">Est. Weight</label>
 <select value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
 className="w-full px-3 py-2.5 card-inner text-sm text-white focus:outline-none"
 >
 {['Under 1kg', '1-2kg', '2-5kg', 'Over 5kg'].map(w => <option key={w} value={w}>{w}</option>)}
 </select>
 </div>
 <div>
 <label className="text-xs font-semibold text-white mb-1 block">Service Type</label>
 <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
 className="w-full px-3 py-2.5 card-inner text-sm text-white focus:outline-none"
 >
 {['Standard', 'Express', 'Fragile', 'Bulk'].map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 </div>

 <div>
 <label className="text-xs font-semibold text-white mb-1 block">Special Instructions</label>
 <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
 placeholder="Any specific delivery instructions..."
 rows={2}
 className="w-full px-3 py-2.5 card-inner text-sm text-white focus:outline-none resize-none"
 />
 </div>

 <div className="flex gap-3 pt-2">
 <button type="button"onClick={onClose}
 className="flex-1 py-2.5 card-inner text-sm font-semibold text-white hover:text-white transition-colors"
 >Cancel</button>
 <button type="submit"disabled={loading}
 className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-700 to-red-600"
 >
 {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto"/> : 'Create Parcel'}
 </button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 );
}

/* ══════════════════════════════════════════════════════
 MAIN DASHBOARD COMPONENT
══════════════════════════════════════════════════════ */
export default function HubPartnerDashboard() {
 const { currentUser } = useAppStore();
 const partnerId = currentUser?.id || 'hp1';

 // Toast
 const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
 const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

 // ── Riders State ──
 const [riders, setRiders] = useState<Rider[]>([]);
 const [ridersLoading, setRidersLoading] = useState(false);

 // ── Orders State ──
 const [orders, setOrders] = useState<Order[]>([]);
 const [ordersLoading, setOrdersLoading] = useState(false);
 const [selectedOrderForParcel, setSelectedOrderForParcel] = useState<Order | null>(null);

 // ── Analytics State ──
 const [analytics, setAnalytics] = useState<Analytics | null>(null);

 // ── Stats ──
 const [stats, setStats] = useState({ totalRevenue: 'Rs. 0', totalOrders: 0, activeDrivers: 0, hubCapacityUsed: '0%' });

 /* ─── Fetch All Data On Mount ─── */
 useEffect(() => {
 if (!partnerId) return;
 fetchOrders();
 fetchRiders();
 fetchAnalytics();
 fetchStats();
 }, [partnerId]);

 const fetchRiders = async () => {
 setRidersLoading(true);
 try {
 const r = await fetch('/api-proxy/admin/drivers');
 if (r.ok) {
 const d = await r.json();
 setRiders(d || []);
 }
 } catch {} finally { setRidersLoading(false); }
 };

 const fetchAnalytics = async () => {
 try {
 const r = await fetch(`${API}/analytics/${partnerId}`);
 if (r.ok) { const d = await r.json(); setAnalytics(d.analytics); }
 } catch {}
 };

 const fetchStats = async () => {
 try {
 const r = await fetch(`${API}/stats/${partnerId}`);
 if (r.ok) { const d = await r.json(); setStats(d.stats); }
 } catch {}
 };

 const fetchOrders = async () => {
 setOrdersLoading(true);
 try {
 const r = await fetch(`${API}/orders/${partnerId}`);
 if (r.ok) { const d = await r.json(); setOrders(d.orders || []); }
 } catch {} finally { setOrdersLoading(false); }
 };

 /* ─── Generate Parcel ─── */
 const handleGenerateParcel = async (data: any) => {
 if (!selectedOrderForParcel) return;
 try {
 const r = await fetch(`${API}/orders/${selectedOrderForParcel.id}/generate-parcel`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ partnerId, ...data }),
 });
 if (r.ok) {
 showToast('📦 Parcel generated & assigned to logistics!');
 fetchOrders();
 fetchStats();
 } else {
 showToast('Failed to generate parcel', 'error');
 }
 } catch {
 showToast('Network error', 'error');
 } finally {
 setSelectedOrderForParcel(null);
 }
 };

 /* ─── Update Order Status ─── */
 const handleOrderStatus = async (orderId: string, status: string) => {
 try {
 const r = await fetch(`${API}/orders/${orderId}/status`, {
 method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
 });
 if (r.ok) { showToast(`Order marked as ${status}`); fetchOrders(); fetchAnalytics(); }
 } catch { showToast('Failed to update order', 'error'); }
 };

 const maxRevenue = analytics?.revenueChart
 ? Math.max(...analytics.revenueChart.map(d => d.revenue), 1)
 : 1;

 /* ══════════════════ RENDER ══════════════════ */
 return (
 <div className="space-y-6 max-w-7xl mx-auto pb-20">
 <AnimatePresence>
 {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
 </AnimatePresence>

 <AnimatePresence>
 {selectedOrderForParcel && (
 <ParcelModal
 order={selectedOrderForParcel}
 onClose={() => setSelectedOrderForParcel(null)}
 onConfirm={handleGenerateParcel}
 />
 )}
 </AnimatePresence>

  <motion.div 
    initial={{ opacity: 0, y: -20 }} 
    animate={{ opacity: 1, y: 0 }} 
    className="card-outer p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
  >
    <div>
      <h1 className="text-2xl font-black text-white">Hub Operations Command</h1>
      <p className="text-sm mt-1" style={{ color: 'rgba(163,163,163,0.7)' }}>
        Monitoring <span className="text-white font-semibold">{currentUser?.name}&apos;s</span> Logistics & Sales Performance
      </p>
    </div>
    <div className="flex flex-wrap gap-4 text-sm">
      {[
        { label: 'Revenue', value: stats.totalRevenue, color: '#10b981' },
        { label: 'Shipments', value: stats.totalOrders, color: '#f43f5e' },
        { label: 'Capacity', value: stats.hubCapacityUsed, color: '#dc2626' },
      ].map(s => (
        <div key={s.label} className="text-center px-6 py-3 card-inner min-w-[120px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white mb-1.5 opacity-60">{s.label}</p>
          <p className="text-lg font-black" style={{ color: s.color }}>
            {s.label === 'Revenue' ? `Rs. ${s.value.toLocaleString()}` : s.value}
          </p>
        </div>
      ))}
    </div>
  </motion.div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 space-y-6">
 <Card className="h-full">
 <div className="flex items-center justify-between mb-6">
 <SectionTitle icon={BarChart2} title="7-Day Performance Insight"accent="#e11d48"/>
 <div className="px-3 py-1 card-inner text-[10px] font-bold text-white">LIVE FEED</div>
 </div>
 <div className="h-[280px] flex items-end justify-between gap-2 px-2 pb-2">
 {analytics?.revenueChart.map((d, i) => {
 const h = (d.revenue / maxRevenue) * 100;
 return (
 <div key={d.day} className="flex-1 flex flex-col items-center group">
 <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity card-inner text-[9px] font-bold text-white px-2 py-0.5 -translate-y-1">
 {d.revenue.toLocaleString()}
 </div>
 <motion.div
 initial={{ height: 0 }}
 animate={{ height: `${Math.max(h, 4)}%` }}
 transition={{ delay: i * 0.05, duration: 0.5 }}
 className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-red-700/80 to-red-600 relative group-hover:from-red-600 group-hover:to-red-500 transition-colors"
 />
 <p className="text-[10px] font-bold text-white mt-3">{d.day}</p>
 </div>
 );
 })}
 {!analytics && (
 <div className="w-full h-full flex flex-col items-center justify-center opacity-40 italic text-sm text-white">
 <TrendingUp className="w-8 h-8 mb-2"/>
 Calculating analytics...
 </div>
 )}
 </div>
 </Card>
 </div>

 <div className="lg:col-span-1">
 <Card className="h-full overflow-hidden flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <SectionTitle icon={Truck} title="Active Riders"accent="#f43f5e"/>
 <button onClick={fetchRiders} className="p-1.5 rounded-lg hover:bg-[#e0000a] text-white backdrop-blur-md/5 transition-colors">
 <RefreshCw className={`w-3.5 h-3.5 text-white ${ridersLoading ? 'animate-spin' : ''}`} />
 </button>
 </div>
 <div className="flex-1 space-y-3 overflow-y-auto pr-1 max-h-[320px] custom-scrollbar">
 {riders.length > 0 ? riders.map((r, i) => (
 <motion.div key={r.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
 className="p-3 card-inner flex items-center gap-3 transition-all"
 >
 <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold card-inner border border-red-500/15">
 {r.name.charAt(0)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-white truncate">{r.name}</p>
 <p className="text-[10px] text-white">{r.phone}</p>
 </div>
 <div className={`px-2 py-0.5 card-inner text-[9px] font-black uppercase tracking-tighter`}>
 {r.status || 'OFFLINE'}
 </div>
 </motion.div>
 )) : (
 <div className="h-full flex flex-col items-center justify-center py-10 opacity-30 text-white">
 <Activity className="w-10 h-10 mb-2"/>
 <p className="text-xs">No active riders found</p>
 </div>
 )}
 </div>
 <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
 <span className="text-[10px] text-white">Total Fleet: {riders.length}</span>
 <button className="text-[10px] font-bold text-white hover:text-red-300">View All Dynamics</button>
 </div>
 </Card>
 </div>

 <div className="lg:col-span-2">
 <Card>
 <div className="flex items-center justify-between mb-5">
 <SectionTitle icon={ShoppingBag} title="Incoming Orders (Awaiting Dispatch)"accent="#10b981"/>
 <button onClick={fetchOrders} className="text-white hover:text-white transition-colors">
 <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
 </button>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="card-inner border-b border-white/20">
 {['Order Ref', 'Customer', 'Region', 'Status', 'Dispatch'].map(h => (
 <th key={h} className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-white">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {orders.map((o, i) => (
 <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
 className="transition-all card-inner border-b last:border-0"
 >
 <td className="py-4 px-3 font-mono text-[10px] text-white font-bold">#{o.id.slice(0, 8)}</td>
 <td className="py-4 px-3">
 <p className="font-bold text-white text-xs">{o.customerName}</p>
 <p className="text-[9px] text-white block break-all max-w-[150px]">{o.address || 'Standard Shipping'}</p>
 </td>
 <td className="py-4 px-3">
 <span className="text-[10px] font-bold text-white flex items-center gap-1.5 font-sans">
 {o.address?.split(',').pop() || 'Local Hub'}
 </span>
 </td>
 <td className="py-4 px-3"><StatusBadge status={o.status} /></td>
 <td className="py-4 px-3">
 <button
 disabled={o.status === 'shipped'}
 onClick={() => setSelectedOrderForParcel(o)}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${o.status === 'shipped' ? 'card-inner cursor-not-allowed opacity-50' : 'card-inner hover:bg-[#E53935] active:scale-95'}`}
 >
 {o.status === 'shipped' ? <Check className="w-3 h-3"/> : <Package className="w-3 h-3"/>}
 {o.status === 'shipped' ? 'Dispatch Done' : 'Ship Now'}
 </button>
 </td>
 </motion.tr>
 ))}
 {orders.length === 0 && !ordersLoading && (
 <tr><td colSpan={5} className="py-10 text-center text-white text-xs italic">All orders dispatched or no new orders.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </Card>
 </div>

 <div className="lg:col-span-1">
 <Card className="h-full bg-gradient-to-br from-slate-900 to-[#111111] relative overflow-hidden">
 <SectionTitle icon={MapPin} title="Operational Reach"accent="#dc2626"/>
 <div className="mt-4 space-y-6 relative z-10">
 <div className="p-4 card-inner">
 <div className="flex items-center justify-between mb-4">
 <h4 className="text-xs font-bold text-white uppercase tracking-widest">Top Destinations</h4>
 </div>
 <div className="space-y-4">
 {['Lahore', 'Karachi', 'Islamabad', 'Faisalabad'].map((city, idx) => (
 <div key={city} className="flex items-center gap-3">
 <div className="text-[10px] font-black text-white w-4">0{idx+1}</div>
 <div className="flex-1">
 <div className="flex justify-between mb-1.5">
 <span className="text-[11px] font-bold text-white">{city}</span>
 <span className="text-[10px] font-bold text-white">{85 - idx*15}% Load</span>
 </div>
 <div className="h-1.5 w-full card-inner overflow-hidden">
 <motion.div initial={{ width: 0 }} animate={{ width: `${85 - idx*15}%` }} transition={{ delay: 1+idx*0.2, duration: 1 }}
 className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"/>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 <div className="flex items-center justify-center h-28 border border-dashed border-white/20 rounded-2xl opacity-40">
 <p className="text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse text-white">Global Map Sync Pending...</p>
 </div>
 </div>
 <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full"style={{ background: 'rgba(220,38,38,0.06)', filter: 'blur(80px)' }} />
 <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full"style={{ background: 'rgba(220,38,38,0.04)', filter: 'blur(60px)' }} />
 </Card>
 </div>
 </div>
 </div>
 );
}
