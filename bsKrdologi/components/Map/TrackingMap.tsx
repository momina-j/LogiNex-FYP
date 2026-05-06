'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import 'leaflet/dist/leaflet.css';
let L: any = null;
let ShipperIcon: any = null;
let DriverIcon: any = null;

if (typeof window !== 'undefined') {
  L = require('leaflet');

  // Icons
  ShipperIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #f97316; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px #f97316;"></div>`,
    iconSize: [12, 12],
  });

  DriverIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
    iconSize: [14, 14],
  });
}

function MapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
}

interface TrackingMapProps {
  driverId: string | null;
  shipperPos: [number, number];
  receiverPos: [number, number];
}

export default function TrackingMap({ driverId, shipperPos, receiverPos }: TrackingMapProps) {
  const { location: driverLoc } = useDriverTracking(driverId || undefined);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    if (driverLoc && receiverPos) {
      // Call our cloud function for live ETA
      const fetchEta = async () => {
        try {
          // Haversine distance
          const R = 6371;
          const dLat = (receiverPos[0] - driverLoc.lat) * Math.PI / 180;
          const dLon = (receiverPos[1] - driverLoc.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(driverLoc.lat * Math.PI / 180) * Math.cos(receiverPos[0] * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          const res = await fetch('https://us-central1-loginex-749ec.cloudfunctions.net/predict_eta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ distance, weight: 5, volume: 0.5 }) 
          });
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (data.success) setEta(data.prediction);
          }
        } catch (e) {
          console.error('ETA Prediction failed', e);
        }
      };
      fetchEta();
    }
  }, [driverLoc, receiverPos]);

  const points: [number, number][] = [shipperPos, receiverPos];
  if (driverLoc) points.push([driverLoc.lat, driverLoc.lng]);

  return (
    <div className="h-full w-full relative">
      <MapContainer center={shipperPos} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapBounds points={points} />
        
        <Marker position={shipperPos} icon={ShipperIcon}>
          <Popup>Pickup Point</Popup>
        </Marker>

        <Marker position={receiverPos}>
          <Popup>Delivery Destination</Popup>
        </Marker>

        {driverLoc && (
          <Marker position={[driverLoc.lat, driverLoc.lng]} icon={DriverIcon}>
            <Popup>
              <div className="text-slate-900 font-bold">Driver is here</div>
              {eta && <div className="text-blue-600 text-xs font-bold">Estimated Arrival: {Math.round(eta)} mins</div>}
            </Popup>
          </Marker>
        )}

        <Polyline positions={points} pathOptions={{ color: '#f97316', weight: 4, opacity: 0.5, dashArray: '5, 5' }} />
      </MapContainer>

      {/* Live ETA Overlay */}
      {driverLoc && eta && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-blue-500/30 shadow-2xl">
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">Live ETA</p>
          <p className="text-2xl font-bold text-white leading-none">
            {Math.round(eta)} <span className="text-sm font-normal text-slate-400">minutes</span>
          </p>
          <div className="mt-2 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}
    </div>
  );
}
