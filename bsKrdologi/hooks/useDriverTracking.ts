'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';

export interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  geohash: string;
  updatedAt: any;
}

export function useDriverTracking(driverId?: string) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    const unsub = onSnapshot(doc(db, 'locations', driverId), (docSnap) => {
      if (docSnap.exists()) {
        setLocation({ id: docSnap.id, ...docSnap.data() } as DriverLocation);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [driverId]);

  return { location, loading };
}

export function useNearbyDrivers(center: [number, number], radiusInKm: number) {
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bounds = geohashQueryBounds(center, radiusInKm * 1000);
    const promises = [];

    // Note: This is a simplified version. For a production app,
    // we would need more complex logic to combine results from multiple bounds.
    // However, for this prototype, we'll listen to the 'locations' collection.
    
    // In a real GeoFire implementation, you'd query specific geohash ranges.
    // For now, let's just fetch all and filter client-side for simplicity in the prototype.
    const q = collection(db, 'locations');
    
    const unsub = onSnapshot(q, (snapshot) => {
      const nearbyDocs: DriverLocation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as DriverLocation;
        const distance = distanceBetween([data.lat, data.lng], center);
        if (distance <= radiusInKm) {
          nearbyDocs.push({ ...data, id: doc.id });
        }
      });
      setDrivers(nearbyDocs);
      setLoading(false);
    });

    return () => unsub();
  }, [center[0], center[1], radiusInKm]);

  return { drivers, loading };
}
