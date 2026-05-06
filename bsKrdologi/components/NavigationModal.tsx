'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, CheckCircle, Clock, MapPin, Navigation, Loader2, Zap, Truck, Package } from 'lucide-react';
import { getEmbedMapUrl, getFullGoogleMapsUrl, MapLocation } from '@/lib/googleMapsUrlBuilder';
import { getML_ETA, getRouteETA, RouteETAResponse } from '@/lib/etaService';
import './MapModal.css';

interface NavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Driver's current GPS location */
  origin: MapLocation;
  /** Final delivery destination (consignee) */
  destination: MapLocation;
  /** Intermediate waypoints — waypoints[0] is the SHIPPER (pickup) location */
  waypoints?: MapLocation[];
  distanceMeters: number;   // kept for compat
  mlEtaMinutes: number;     // initial rough ETA (superseded after 5s)
  onLegCompleted: () => void;
}

/** Parse a MapLocation into {lat, lng} or null. */
function extractCoords(loc: MapLocation): { lat: number; lng: number } | null {
  if (!loc) return null;
  if (typeof loc === 'object' && 'lat' in loc) return loc as { lat: number; lng: number };
  if (typeof loc === 'string') {
    const m = loc.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

/** Haversine straight-line distance in km. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Road km ≈ crow-fly × detour factor (decreases for longer trips). */
function roadKm(crowKm: number): number {
  const detour = crowKm < 15 ? 1.45 : crowKm < 40 ? 1.35 : crowKm < 80 ? 1.25 : 1.15;
  return parseFloat((crowKm * detour).toFixed(1));
}

interface LegResult {
  etaMin: number;
  distKm: number;
  confidence?: { min: number; max: number };
  triggers?: string[];
}

/** Call Flask ML for a single leg. Falls back to a physics heuristic on error. */
async function fetchLegETA(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<LegResult> {
  const crow = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const road = roadKm(crow);

  try {
    const result = await getRouteETA({
      origin: from,
      destination: to,
    });
    
    if (result && result.success) {
      return { 
        etaMin: Math.round(result.eta_minutes), 
        distKm: result.distance_km,
        confidence: result.confidence_band,
        triggers: result.buffers_triggered
      };
    }
  } catch (_) { /* fall through to old ML or heuristic */ }

  try {
    const eta = await getML_ETA({
      pickup_lat:  from.lat,
      pickup_lng:  from.lng,
      dropoff_lat: to.lat,
      dropoff_lng: to.lng,
    });
    if (eta !== null) return { etaMin: Math.round(eta), distKm: road };
  } catch (_) { /* fall through to heuristic */ }

  // Physics fallback: 30 km/h urban + 8 min handling
  const heuristic = Math.round((road / 30) * 60 + 8);
  return { etaMin: heuristic, distKm: road };
}

export const NavigationModal: React.FC<NavigationModalProps> = ({
  isOpen,
  onClose,
  origin,
  destination,
  waypoints,
  distanceMeters,
  mlEtaMinutes,
  onLegCompleted,
}) => {
  const [mounted, setMounted] = useState(false);

  // Two-leg breakdown
  const [leg1, setLeg1] = useState<LegResult | null>(null); // Driver → Shipper
  const [leg2, setLeg2] = useState<LegResult | null>(null); // Shipper → Consignee
  const [etaLoading, setEtaLoading] = useState(false);
  const [etaReady, setEtaReady] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // ── Two-leg ETA fetch — triggered 5 s after modal opens ──────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Reset on open
    setLeg1(null);
    setLeg2(null);
    setEtaReady(false);
    setEtaLoading(false);

    timerRef.current = setTimeout(async () => {
      setEtaLoading(true);
      try {
        const driverCoords  = extractCoords(origin);
        const shipperCoords = waypoints?.[0] ? extractCoords(waypoints[0]) : null;
        const consigneeCoords = extractCoords(destination);

        // ── Leg 1: Driver → Shipper (pickup leg) ────────────────────────────
        let result1: LegResult;
        if (driverCoords && shipperCoords) {
          result1 = await fetchLegETA(driverCoords, shipperCoords);
        } else if (driverCoords && consigneeCoords) {
          // No shipper coords — treat straight driver→consignee as leg 1 only
          result1 = await fetchLegETA(driverCoords, consigneeCoords);
          setLeg1(result1);
          setLeg2(null);
          return;
        } else {
          // Absolute fallback
          const roadFallback = roadKm((distanceMeters / 1000));
          result1 = { etaMin: mlEtaMinutes, distKm: roadFallback };
        }
        setLeg1(result1);

        // ── Leg 2: Shipper → Consignee (delivery leg) ───────────────────────
        if (shipperCoords && consigneeCoords) {
          const result2 = await fetchLegETA(shipperCoords, consigneeCoords);
          setLeg2(result2);
        } else if (driverCoords && consigneeCoords && !shipperCoords) {
          // Already handled above
        } else {
          setLeg2(null);
        }
      } catch (err) {
        console.warn('[NavigationModal] ETA refresh failed:', err);
      } finally {
        setEtaLoading(false);
        setEtaReady(true);
      }
    }, 5000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const embedUrl = getEmbedMapUrl(origin, destination, waypoints);
  const fullUrl  = getFullGoogleMapsUrl(origin, destination, waypoints);

  // Totals
  const totalEta  = leg1 && leg2 ? leg1.etaMin + leg2.etaMin : leg1?.etaMin ?? Math.round(mlEtaMinutes);
  const totalDist = leg1 && leg2 ? parseFloat((leg1.distKm + leg2.distKm).toFixed(1)) : leg1?.distKm ?? parseFloat(((distanceMeters / 1000) * 1.35).toFixed(1));

  const readyClass = etaReady ? 'text-emerald-300 font-black' : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Navigation className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="modal-title">Live Navigation</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Full Door-to-Door Route
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── ETA Banner ─────────────────────────────────────────────────── */}
        <div className="eta-banner" style={{ position: 'relative' }}>

          {/* Summary row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {etaLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Calculating…</span>
                </span>
              ) : (
                <span className={readyClass}>{totalEta} MINS TOTAL</span>
              )}
            </div>

            <div className="w-px h-4 bg-white/30" />

            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {etaLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>…</span>
                </span>
              ) : (
                <span className={readyClass}>{totalDist} KM TOTAL</span>
              )}
            </div>

            {/* ML Ready badge */}
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-80 ml-auto">
              {etaLoading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> ML Computing…</>
              ) : etaReady ? (
                <><Zap className="w-3 h-3 text-emerald-300" /><span className="text-emerald-300">ML ETA Ready</span></>
              ) : (
                'Secure Transit Mode'
              )}
            </div>
          </div>

          {/* Two-leg breakdown — shown after ML finishes */}
          {etaReady && leg1 && (
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginTop: '0.5rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                opacity: 0.85,
              }}
            >
              {/* Leg 1: Driver → Shipper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Truck style={{ width: '0.75rem', height: '0.75rem' }} />
                <span>DRIVER→PICKUP:</span>
                <span style={{ color: '#fb923c' }}>{leg1.etaMin} min · {leg1.distKm} km</span>
              </div>

              {/* Leg 2: Shipper → Consignee */}
              {leg2 && (
                <>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Package style={{ width: '0.75rem', height: '0.75rem' }} />
                    <span>PICKUP→DELIVERY:</span>
                    <span style={{ color: '#34d399' }}>{leg2.etaMin} min · {leg2.distKm} km</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Confidence Bands & Triggers */}
          {etaReady && (leg1?.confidence || leg2?.confidence || (leg1?.triggers?.length ?? 0) > 0 || (leg2?.triggers?.length ?? 0) > 0) && (
            <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-2">
              {(leg1?.confidence || leg2?.confidence) && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-200">
                  <Zap className="w-3 h-3 text-orange-400" />
                  <span>CONFIDENCE BAND: {
                    leg1 && leg2 && leg1.confidence && leg2.confidence 
                    ? `${Math.round(leg1.confidence.min + leg2.confidence.min)} - ${Math.round(leg1.confidence.max + leg2.confidence.max)}`
                    : leg1?.confidence 
                    ? `${Math.round(leg1.confidence.min)} - ${Math.round(leg1.confidence.max)}`
                    : '±15%'
                  } MIN</span>
                </div>
              )}
              
              {[...(leg1?.triggers ?? []), ...(leg2?.triggers ?? [])].map((trigger, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>{trigger.replace(/_/g, ' ').toUpperCase()} ACTIVE</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Map iframe ──────────────────────────────────────────────────── */}
        <div className="iframe-container">
          <iframe
            title="Google Maps Route"
            src={embedUrl}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="modal-footer">
          <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
            <ExternalLink className="w-5 h-5" />
            <span>Open Full App</span>
          </a>

          <button
            className="btn-primary"
            onClick={() => { onLegCompleted(); onClose(); }}
          >
            <CheckCircle className="w-5 h-5" />
            <span>Mark as Reached</span>
          </button>
        </div>
      </div>
    </div>
  );
};
