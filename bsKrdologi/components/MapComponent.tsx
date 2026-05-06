'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
let L: any = null;
let ShipperIcon: any = null;
let ReceiverIcon: any = null;

if (typeof window !== 'undefined') {
  L = require('leaflet');

  // --- Fix for Leaflet default icons in Next.js ---
  const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // Custom icons for Shipper and Receiver
  ShipperIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #f97316; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px #f97316;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  ReceiverIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #f43f5e; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px #f43f5e;"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  L.Marker.prototype.options.icon = DefaultIcon;
}

// --- Map Setup Component ---
// This sub-component helps with auto-fitting the map bounds
function ChangeView({ center, zoom, route }: { center: [number, number], zoom: number, route?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, map, route]);
  return null;
}

interface MapComponentProps {
  shipperLocation: { lat: number; lng: number; name: string } | null;
  receiverLocations: { lat: number; lng: number; id: string; name: string }[];
  route?: [number, number][]; // New prop for optimized route
}

export default function MapComponent({ shipperLocation, receiverLocations, route }: MapComponentProps) {
  // Default center (Karachi, Pakistan)
  const defaultCenter: [number, number] = [24.8607, 67.0011];
  const center: [number, number] = shipperLocation 
    ? [shipperLocation.lat, shipperLocation.lng] 
    : defaultCenter;

  return (
    <div className="h-full w-full">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        {/* We use a bright-themed tile layer (CartoDB Voyager) for better visibility */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <ChangeView center={center} zoom={shipperLocation ? 15 : 12} route={route} />

        {/* --- Optimized Route Polyline --- */}
        {route && route.length > 0 && (
          <Polyline 
            positions={route} 
            pathOptions={{ 
              color: '#f97316', 
              weight: 5, 
              opacity: 0.7,
              lineJoin: 'round',
              dashArray: '10, 10',
              dashOffset: '0'
            }} 
          />
        )}

        {/* --- Shipper Marker --- */}
        {shipperLocation && (
          <Marker position={[shipperLocation.lat, shipperLocation.lng]} icon={ShipperIcon}>
            <Popup className="custom-popup">
              <div className="text-slate-900 font-bold">{shipperLocation.name} (You)</div>
            </Popup>
          </Marker>
        )}

        {/* --- Receiver Markers --- */}
        {receiverLocations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={ReceiverIcon}>
            <Popup className="custom-popup">
              <div className="text-slate-900 font-bold">{loc.name}</div>
              <div className="text-slate-500 text-xs">Awaiting Parcel</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>


      <style jsx global>{`
        .leaflet-container {
          background: #f8fafc !important; /* matches slate-50 */
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: #f8fafc;
          border-radius: 8px;
          padding: 2px;
        }
        .custom-popup .leaflet-popup-tip {
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
