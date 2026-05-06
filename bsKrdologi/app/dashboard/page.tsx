'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { motion } from 'motion/react';
import { Package, Truck, BarChart3, Store, ArrowRight, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

const ROLE_INFO: Record<string, any> = {
  shipper: { title: 'Shipper Dashboard', path: 'shipper', icon: Package, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500' },
  driver: { title: 'Driver Dashboard', path: 'driver', icon: Truck, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500' },
  hub_holder: { title: 'Hub Holder Dashboard', path: 'hub-holder', icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500' },
  hub_partner: { title: 'Hub Partner Dashboard', path: 'hub-partner', icon: Store, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500' },
  brand: { title: 'Brand Portal', path: 'brand-delivery', icon: ShoppingBag, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500' },
};

export default function DashboardIndex() {
  const { currentUser } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (currentUser?.roles.length === 1) {
      const targetPath = currentUser.roles[0].replace('_', '-');
      router.push(`/dashboard/${targetPath}`);
    }
  }, [currentUser, router]);

  if (!currentUser) return <div />;

  if (currentUser.roles.length === 1) {
    return <div className="flex items-center justify-center h-full">Redirecting...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-white mb-4">Welcome back, {currentUser.name}</h1>
        <p className="text-slate-400 text-lg">Select a dashboard to continue</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {currentUser.roles.map((role, i) => {
          const info = ROLE_INFO[role as keyof typeof ROLE_INFO];
          if (!info) return null;
          
          return (
            <Link key={role} href={`/dashboard/${info.path}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                className={`bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center text-center group cursor-pointer hover:${info.border} transition-colors h-full`}
              >
                <div className={`w-20 h-20 rounded-full ${info.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <info.icon className={`w-10 h-10 ${info.color}`} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{info.title}</h3>
                <div className="mt-auto flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors font-medium">
                  Enter Dashboard <ArrowRight className="w-5 h-5" />
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
