import { create } from 'zustand';

export type Role = 'shipper' | 'driver' | 'hub_holder' | 'hub_partner' | 'hubpartner' | 'brand' | 'admin' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: Role[];
  role?: string; // single active role shorthand (used by root page)
  city: string;
  warehouseLocation?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface AppState {
  currentUser: User | null;
  user: User | null;           // alias for root page compatibility
  isAuthenticated: boolean;   // derived flag
  language: 'en' | 'ur';
  theme: 'light' | 'dark';
  isPaymentModalOpen: boolean;
  paymentData: { 
    amount: number; 
    description: string; 
    trackingId?: string;
    parcelId?: string;
    onSuccess?: () => void;
  } | null;
  login: (user: User) => void;
  logout: () => void;
  setLanguage: (lang: 'en' | 'ur') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  triggerPayment: (data: AppState['paymentData']) => void;
  closePayment: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  user: null,
  isAuthenticated: false,
  language: 'en',
  theme: 'dark',
  isPaymentModalOpen: false,
  paymentData: null,
  login: (user) =>
    set({
      currentUser: user,
      user: { ...user, role: user.roles?.[0] },
      isAuthenticated: true,
    }),
  logout: () => set({ currentUser: null, user: null, isAuthenticated: false }),
  setLanguage: (lang) => set({ language: lang }),
  setTheme: (theme) => set({ theme }),
  triggerPayment: (data) => set({ isPaymentModalOpen: true, paymentData: data }),
  closePayment: () => set({ isPaymentModalOpen: false, paymentData: null }),
}));
