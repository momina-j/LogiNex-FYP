'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Truck, MapPin, Navigation, X, Play, Square, LocateFixed, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'leaflet/dist/leaflet.css';

let L: any = null;
let DriverIcon: any = null;
let PickupIcon: any = null;
let DestIcon: any = null;

if (typeof window !== 'undefined') {
  L = require('leaflet');

  DriverIcon = L.divIcon({
    className: 'nav-driver-icon',
    html: `<div style="background-color:#f97316;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 20px rgba(249,115,22,0.8);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  PickupIcon = L.divIcon({
    className: 'nav-pickup-icon',
    html: `<div style="background-color:#f59e0b;width:16px;height:16px;border-radius:4px;border:2px solid white;box-shadow:0 0 10px rgba(245,158,11,0.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  DestIcon = L.divIcon({
    className: 'nav-dest-icon',
    html: `<div style="background-color:#ef4444;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(239,68,68,0.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function RecenterMap({ position, zoom = 16 }: { position: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, zoom, { animate: true, duration: 1.2 });
  }, [position, zoom, map]);
  return null;
}

// ── OSRM public routing API (free, no key needed) ──────────────────────────
async function fetchOSRMRoute(
  from: [number, number],
  to: [number, number],
  via?: [number, number]
): Promise<[number, number][]> {
  const waypoints = via
    ? `${from[1]},${from[0]};${via[1]},${via[0]};${to[1]},${to[0]}`
    : `${from[1]},${from[0]};${to[1]},${to[0]}`;

  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?geometries=geojson&overview=full`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
  const data = await res.json();

  if (!data.routes?.[0]?.geometry?.coordinates) throw new Error('No route in OSRM response');

  // OSRM returns [lng, lat] — Leaflet needs [lat, lng]
  return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
}

// ── Generate instructions from route progress ────────────────────────────────
function getInstruction(idx: number, total: number, language: 'en' | 'ur'): string {
  const pct = idx / total;
  if (pct < 0.05) return language === 'en' ? 'Head towards pickup location' : 'پک اپ مقام کی طرف جائیں';
  if (pct < 0.30) return language === 'en' ? 'Continue on current road' : 'موجودہ سڑک پر جاری رہیں';
  if (pct < 0.50) return language === 'en' ? 'Approaching pickup point – prepare to stop' : 'پک اپ پوائنٹ کے قریب – رکنے کے لیے تیار ہوں';
  if (pct < 0.60) return language === 'en' ? 'Proceed to delivery destination' : 'ڈیلیوری منزل کی طرف جائیں';
  if (pct < 0.85) return language === 'en' ? 'Continue toward destination' : 'منزل کی طرف جاری رہیں';
  if (pct < 0.95) return language === 'en' ? 'Almost there – prepare to deliver' : 'تقریباً پہنچ گئے – ڈیلیوری کے لیے تیار ہوں';
  return language === 'en' ? 'Destination reached — deliver parcel!' : 'منزل پر پہنچ گئے — پارسل پہنچائیں!';
}

export interface NavigationMapProps {
  startPos: [number, number];
  pickupPos?: [number, number] | null;
  destPos: [number, number];
  onClose: () => void;
  language: 'en' | 'ur';
  /** Pakistan-refined ETA from /predict_route */
  etaMinutes?: number;
  distKm?: number;
  confidenceBand?: { min: number; max: number };
  buffersTriggered?: string[];
}

export default function NavigationMap({
  startPos,
  pickupPos,
  destPos,
  onClose,
  language,
  etaMinutes,
  distKm,
  confidenceBand,
  buffersTriggered = [],
}: NavigationMapProps) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number]>(startPos);
  const [isNavigating, setIsNavigating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [remainingMin, setRemainingMin] = useState(etaMinutes ?? 0);
  const [remainingKm, setRemainingKm] = useState(distKm ?? 0);

  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchRoute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const via = pickupPos ?? undefined;
      const pts = await fetchOSRMRoute(startPos, destPos, via ?? undefined);
      setRoute(pts);
      setInstruction(language === 'en' ? 'Route calculated — ready to navigate' : 'راستہ حساب کر لیا گیا — نیویگیشن کے لیے تیار');
    } catch (err) {
      console.error('[NavigationMap] OSRM error:', err);
      setError(language === 'en' ? 'Could not load route. Check internet connection.' : 'راستہ لوڈ نہیں ہو سکا۔ انٹرنیٹ چیک کریں۔');
      // Fallback: straight line
      const fallback: [number, number][] = [startPos];
      if (pickupPos) fallback.push(pickupPos);
      fallback.push(destPos);
      setRoute(fallback);
    } finally {
      setLoading(false);
    }
  }, [startPos, pickupPos, destPos, language]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  // Sync ETA props
  useEffect(() => {
    if (etaMinutes) setRemainingMin(etaMinutes);
    if (distKm) setRemainingKm(distKm);
  }, [etaMinutes, distKm]);

  const startSimulation = () => {
    if (route.length === 0) return;
    setIsNavigating(true);
    let idx = 0;
    const totalSegments = route.length;
    const totalEta = etaMinutes ?? 20;
    const totalDist = distKm ?? 5;

    simulationInterval.current = setInterval(() => {
      if (idx >= totalSegments - 1) {
        setIsNavigating(false);
        if (simulationInterval.current) clearInterval(simulationInterval.current);
        setInstruction(language === 'en' ? '✅ Destination Reached! Deliver the parcel.' : '✅ منزل مقصود پر پہنچ گئے! پارسل پہنچائیں۔');
        setRemainingMin(0);
        setRemainingKm(0);
        return;
      }

      idx++;
      setProgress(idx);
      setCurrentPos(route[idx]);
      setInstruction(getInstruction(idx, totalSegments, language));

      // Decrement ETA proportionally
      const fracDone = idx / totalSegments;
      setRemainingMin(Math.round(totalEta * (1 - fracDone)));
      setRemainingKm(parseFloat((totalDist * (1 - fracDone)).toFixed(1)));
    }, 400);
  };

  const stopSimulation = () => {
    setIsNavigating(false);
    if (simulationInterval.current) clearInterval(simulationInterval.current);
  };

  useEffect(() => {
    return () => { if (simulationInterval.current) clearInterval(simulationInterval.current); };
  }, []);

  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shadow-xl z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-500/30">
            <Navigation className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">
              {language === 'en' ? 'Live Navigation' : 'براہ راست نیویگیشن'}
            </h2>
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {language === 'en' ? 'OSRM · OpenStreetMap' : 'اوپن سٹریٹ میپ'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 rounded-xl flex items-center justify-center text-slate-400 transition-all border border-slate-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Pakistan ETA Banner (if buffers raised) ─────────────────────── */}
      {buffersTriggered.length > 0 && (
        <div className="bg-rose-900/40 border-b border-rose-500/30 px-4 py-2 flex items-center gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-rose-300 text-xs font-bold uppercase tracking-wide">Delay Alert:</span>
          {buffersTriggered.map((t, i) => (
            <span key={i} className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20 font-black uppercase">
              {t.split(':')[0].replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-20">
            <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4" />
            <p className="text-white font-bold animate-pulse">Calculating route via OSRM…</p>
            <p className="text-slate-500 text-xs mt-1">OpenStreetMap · No API key required</p>
          </div>
        ) : (
          <MapContainer
            center={currentPos}
            zoom={15}
            className="h-full w-full z-0"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <RecenterMap position={currentPos} zoom={16} />

            {route.length > 1 && (
              <>
                {/* Glow outer line */}
                <Polyline positions={route} color="#f97316" weight={8} opacity={0.25} lineJoin="round" />
                {/* Main route line */}
                <Polyline positions={route} color="#f97316" weight={4} opacity={0.9} lineJoin="round" />
                {/* Inner highlight */}
                <Polyline positions={route} color="#fed7aa" weight={1.5} opacity={0.8} />
              </>
            )}

            {/* Driver marker (current position) */}
            <Marker position={currentPos} icon={DriverIcon}>
              <Popup>📍 {language === 'en' ? 'You are here' : 'آپ یہاں ہیں'}</Popup>
            </Marker>

            {/* Pickup marker */}
            {pickupPos && (
              <Marker position={pickupPos} icon={PickupIcon}>
                <Popup>📦 {language === 'en' ? 'Pickup Point' : 'پک اپ مقام'}</Popup>
              </Marker>
            )}

            {/* Destination marker */}
            <Marker position={destPos} icon={DestIcon}>
              <Popup>🏁 {language === 'en' ? 'Delivery Destination' : 'ڈیلیوری منزل'}</Popup>
            </Marker>
          </MapContainer>
        )}

        {/* ── Floating Instruction Card ──────────────────────────────────── */}
        <AnimatePresence>
          {instruction && !loading && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-4 left-4 right-4 z-10"
            >
              <div className="bg-slate-900/95 backdrop-blur-xl border border-orange-500/20 p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-2xl mx-auto">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                  <Navigation className="w-7 h-7 text-white rotate-45" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest mb-0.5">
                    {language === 'en' ? 'Turn-by-Turn' : 'قدم بقدم ہدایات'}
                  </p>
                  <p className="text-white font-bold text-sm leading-tight">{instruction}</p>
                  {error && <p className="text-rose-400 text-[10px] mt-0.5">⚠ {error}</p>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom controls card ────────────────────────────────────────── */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-5 shadow-2xl">
            {/* ETA + Distance row */}
            <div className="flex items-stretch justify-between mb-4 gap-3">
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-0.5">ETA</p>
                <p className="text-2xl font-black text-orange-400 leading-none">
                  {remainingMin}
                  <span className="text-sm font-bold text-slate-400 ml-1">min</span>
                </p>
                {confidenceBand && (
                  <p className="text-[9px] text-slate-600 mt-0.5">
                    {Math.round(confidenceBand.min)}–{Math.round(confidenceBand.max)} min range
                  </p>
                )}
              </div>
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Distance</p>
                <p className="text-2xl font-black text-white leading-none">
                  {remainingKm.toFixed(1)}
                  <span className="text-sm font-bold text-slate-400 ml-1">km</span>
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">via OSRM</p>
              </div>
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Progress</p>
                <p className="text-2xl font-black text-emerald-400 leading-none">
                  {route.length > 0 ? Math.round((progress / route.length) * 100) : 0}
                  <span className="text-sm font-bold text-slate-400 ml-0.5">%</span>
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">
                  {isNavigating ? (
                    <span className="text-emerald-500">● Live</span>
                  ) : 'Paused'}
                </p>
              </div>
            </div>

            {/* ML badge row */}
            {etaMinutes && (
              <div className="flex items-center gap-1.5 mb-3 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                <Zap className="w-3 h-3" />
                Pakistan ML Engine · OSRM Routing
              </div>
            )}

            {/* Start / Stop button */}
            <button
              onClick={isNavigating ? stopSimulation : startSimulation}
              disabled={route.length === 0 || loading}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                isNavigating
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
              }`}
            >
              {isNavigating ? (
                <><Square className="w-5 h-5 fill-current" /> {language === 'en' ? 'Stop Navigation' : 'نیویگیشن روکیں'}</>
              ) : (
                <><Play className="w-5 h-5 fill-current" /> {language === 'en' ? 'Start Navigation' : 'نیویگیشن شروع کریں'}</>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .leaflet-container { background: #020617 !important; }
        .nav-driver-icon, .nav-pickup-icon, .nav-dest-icon {
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>
    </div>
  );
}
