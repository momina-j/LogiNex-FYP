import { create } from 'zustand';

export type ParcelStatus = 'pending' | 'ready' | 'assigned' | 'in_transit' | 'delivered' | 'delayed' | 'cancelled';
export type PaymentMethod = 'cod' | 'online';

export interface Parcel {
  id: string;
  trackingId: string;
  shipperId: string;
  driverId?: string;
  receiverName: string;
  receiverPhone: string;
  pickupAddress: string;
  dropAddress: string;
  city: string;
  weight: number;
  description: string;
  paymentMethod: PaymentMethod;
  codAmount: number;
  status: ParcelStatus;
  createdAt: string;
  updatedAt: string;
  eta?: string;
  delayReason?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  rating: number;
  status: 'available' | 'on_delivery' | 'break';
  location: { lat: number; lng: number };
  city: string;
  pricePerKm: number;
}

export interface Hub {
  id: string;
  name: string;
  city: string;
  location: { lat: number; lng: number };
  capacity: number;
  currentLoad: number;
}

interface DemoState {
  parcels: Parcel[];
  drivers: Driver[];
  hubs: Hub[];
  addParcel: (parcel: Parcel) => void;
  updateParcelStatus: (id: string, status: ParcelStatus) => void;
  assignDriver: (parcelId: string, driverId: string) => void;
}

// Generate some initial demo data
const generateDemoParcels = (): Parcel[] => {
  const parcels: Parcel[] = [];
  for (let i = 1; i <= 50; i++) {
    parcels.push({
      id: `p${i}`,
      trackingId: `LNX-2024-${i.toString().padStart(4, '0')}`,
      shipperId: 's1',
      receiverName: `Customer ${i}`,
      receiverPhone: `+92 300 12345${i.toString().padStart(2, '0')}`,
      pickupAddress: 'Saddar, Karachi',
      dropAddress: `DHA Phase ${Math.floor(Math.random() * 8) + 1}, Karachi`,
      city: 'Karachi',
      weight: Math.random() * 5 + 0.5,
      description: 'Electronics',
      paymentMethod: Math.random() > 0.5 ? 'cod' : 'online',
      codAmount: Math.floor(Math.random() * 5000) + 500,
      status: ['pending', 'ready', 'in_transit', 'delivered', 'delayed'][Math.floor(Math.random() * 5)] as ParcelStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return parcels;
};

const generateDemoDrivers = (): Driver[] => {
  const drivers: Driver[] = [];
  for (let i = 1; i <= 10; i++) {
    drivers.push({
      id: `d${i}`,
      name: `Driver ${i}`,
      phone: `+92 333 12345${i.toString().padStart(2, '0')}`,
      vehicleType: ['Motorcycle', 'Van', 'Truck'][Math.floor(Math.random() * 3)],
      rating: 4 + Math.random(),
      status: ['available', 'on_delivery', 'break'][Math.floor(Math.random() * 3)] as any,
      location: { lat: 24.8607 + (Math.random() - 0.5) * 0.1, lng: 67.0011 + (Math.random() - 0.5) * 0.1 },
      city: 'Karachi',
      pricePerKm: Math.floor(Math.random() * 100) + 50,
    });
  }
  return drivers;
};

export const useDemoStore = create<DemoState>((set) => ({
  parcels: generateDemoParcels(),
  drivers: generateDemoDrivers(),
  hubs: [
    { id: 'h1', name: 'Karachi Main Hub', city: 'Karachi', location: { lat: 24.8607, lng: 67.0011 }, capacity: 1000, currentLoad: 450 },
    { id: 'h2', name: 'Lahore Central', city: 'Lahore', location: { lat: 31.5204, lng: 74.3587 }, capacity: 800, currentLoad: 600 },
    { id: 'h3', name: 'Islamabad Hub', city: 'Islamabad', location: { lat: 33.6844, lng: 73.0479 }, capacity: 500, currentLoad: 200 },
  ],
  addParcel: (parcel) => set((state) => ({ parcels: [...state.parcels, parcel] })),
  updateParcelStatus: (id, status) => set((state) => ({
    parcels: state.parcels.map((p) => (p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p)),
  })),
  assignDriver: (parcelId, driverId) => set((state) => ({
    parcels: state.parcels.map((p) => (p.id === parcelId ? { ...p, driverId, status: 'in_transit', updatedAt: new Date().toISOString() } : p)),
  })),
}));
