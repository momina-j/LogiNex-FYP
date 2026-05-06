'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, MapPin, AlertTriangle } from 'lucide-react';

interface LocationTrackerProps {
  driverId: string;
  activeRouteId?: string;
}

export const LocationTracker: React.FC<LocationTrackerProps> = ({ driverId, activeRouteId }) => {
  const [status, setStatus] = useState<'requesting' | 'active' | 'error'>('requesting');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!driverId) return;

    let watchId: number;

    const startTracking = () => {
      if (!navigator.geolocation) {
        setStatus('error');
        setErrorText('Geolocation not supported');
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, speed, heading } = position.coords;
          
          try {
            const driverRef = doc(db, 'drivers', driverId);
            await updateDoc(driverRef, {
              currentLocation: {
                lat: latitude,
                lng: longitude,
                speed: speed || 0,
                heading: heading || 0,
                timestamp: serverTimestamp()
              },
              status: activeRouteId ? 'on_trip' : 'online'
            });

            // Also update the global locations collection for real-time fleet map
            const locationRef = doc(db, 'locations', driverId);
            await updateDoc(locationRef, {
              lat: latitude,
              lng: longitude,
              updatedAt: serverTimestamp()
            });

            setStatus('active');
          } catch (err) {
            console.error('Firestore update error:', err);
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          setStatus('error');
          setErrorText(err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000
        }
      );
    };

    startTracking();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [driverId, activeRouteId]);

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-500 ${
      status === 'active' 
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
        : status === 'error'
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
          : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
    }`}>
      {status === 'active' ? (
        <>
          <Shield className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">Tracking Active</span>
        </>
      ) : status === 'error' ? (
        <>
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">GPS Error: {errorText}</span>
        </>
      ) : (
        <>
          <MapPin className="w-4 h-4 animate-bounce" />
          <span className="text-xs font-black uppercase tracking-widest">Initializing GPS...</span>
        </>
      )}
    </div>
  );
};
