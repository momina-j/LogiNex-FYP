'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import dynamic from 'next/dynamic';

const PredictForm = dynamic(() => import('@/components/PredictForm').then(mod => mod.PredictForm), { 
  ssr: false,
  loading: () => (
    <div className="w-full max-w-4xl mx-auto p-1 bg-gradient-to-br from-red-600 via-red-800 to-black rounded-[2.5rem] shadow-2xl animate-pulse">
      <div className="bg-[#0a0a0a] h-[400px] rounded-[2.4rem] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
      </div>
    </div>
  )
});

import { Package, Truck, Store, BarChart3, ArrowRight, Zap, Shield, Globe, Star, Calculator, ShoppingBag, Loader2, ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/translations';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function Home() {
  const router = useRouter();
  const { language, user, isAuthenticated } = useAppStore();
  const t = translations[language as keyof typeof translations];
  const [mounted, setMounted] = useState(false);

  const [loadingComplete, setLoadingComplete] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setLoadingComplete(true), 2800);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || !loadingComplete) return <LoadingScreen />;

  return (
    <main 
      className="dark flex flex-col min-h-screen relative overflow-x-hidden selection:bg-red-600/30 selection:text-red-200 bg-[#0a0a0a]" 
    >
      <Navbar transparent />

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
        {/* Cinematic Background Image Layer */}
        <div className="absolute inset-0 z-0">
          <motion.img 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.85 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            src="/pak-delivery-hero.jpg" 
            alt="Pak Delivery Hero" 
            className="w-full h-full object-cover" 
          />
          {/* Multi-stop Gradient Overlay for Legibility - Extremely Reduced Intensity */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-transparent to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-[#0a0a0a]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/40 via-transparent to-transparent" />
        </div>

        {/* Ambient background glows */}
        <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[800px] h-[800px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #dc2626 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #7f1d1d 0%, transparent 70%)' }} />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-12 w-full max-w-[1600px] mx-auto py-24 md:py-32">

          <div className="max-w-5xl">
            {/* Main Heading */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-[900] text-white leading-[0.85] tracking-tighter uppercase italic mb-8">
                Welcome To
                <br />
                <span className="text-red-600 relative">
                  LOGINEX
                  <div className="absolute -bottom-4 left-0 w-1/3 h-2 bg-red-600/20 blur-xl" />
                </span>
              </h1>
              <p className="text-lg md:text-xl max-w-2xl leading-relaxed text-neutral-400 font-medium mb-12">
                {t.hero.description}
              </p>

              <div className="flex flex-wrap gap-8 items-center">
                 <Link href="/login">
                    <button className="bg-red-600 hover:bg-red-700 text-white font-[900] px-12 py-6 rounded-3xl text-sm uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_rgba(220,38,38,0.25)] flex items-center gap-4">
                       Enter System <ArrowRight className="w-5 h-5" />
                    </button>
                 </Link>
                 
                 <div className="flex gap-10 items-center">
                    {[
                      { label: 'Active Nodes', value: '1.2k' },
                      { label: 'Uptime Index', value: '99.9%' },
                    ].map(stat => (
                      <div key={stat.label}>
                         <p className="text-white font-black text-2xl tracking-tighter">{stat.value}</p>
                         <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">{stat.label}</p>
                      </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          </div>

          {/* Role Grid Preview */}
          <div className="mt-32">
             <div className="flex items-center justify-between mb-12">
                <div>
                   <h3 className="text-white font-[900] text-2xl uppercase italic tracking-tighter">Operational Portals</h3>
                   <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-2">Select your deployment unit</p>
                </div>
                <div className="hidden md:flex gap-4">
                   <div className="w-12 h-12 rounded-2xl border border-white/[0.05] flex items-center justify-center text-neutral-600 hover:text-white transition-colors cursor-pointer">
                      <BarChart3 className="w-5 h-5" />
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <DashboardCard title="Shipper" roleKey="shipper" icon={Package} description="Dispatch Control" />
                <DashboardCard title="Brand" roleKey="brand" icon={ShoppingBag} description="Batch Logistics" />
                <DashboardCard title="Driver" roleKey="driver" icon={Truck} description="Fleet Terminal" />
                <DashboardCard title="Carrier" roleKey="hub_holder" icon={BarChart3} description="Warehouse Node" />
                <DashboardCard title="Partner" roleKey="hub_partner" icon={Store} description="Local Hub" />
             </div>
          </div>
        </div>
      </section>

      {/* SYSTEM ARCHITECTURE SECTION */}
      <section className="relative py-40 bg-[#080808] border-y border-white/[0.03]">
         <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
         
         <div className="max-w-[1600px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
            <div className="space-y-12">
               <div>
                  <div className="text-red-600 font-bold text-[10px] uppercase tracking-[0.4em] mb-6">Vector Analysis</div>
                  <h2 className="text-5xl md:text-7xl font-[900] text-white uppercase italic tracking-tighter leading-none">
                     Autonomous <br/><span className="text-red-600">Route Flow</span>
                  </h2>
               </div>
               <p className="text-neutral-400 text-lg leading-relaxed max-w-xl">
                  Loginex deployes high-bandwidth neural networks to map every logistics node in Pakistan. Experience zero-latency tracking and dynamic route optimization at the speed of command.
               </p>
               <div className="grid grid-cols-2 gap-8">
                  <div className="p-8 rounded-[2.5rem] bg-[#121212] border border-white/[0.03] hover:border-red-600/20 transition-all">
                     <p className="text-white font-black text-4xl mb-2">&lt;2s</p>
                     <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest leading-tight">Data Sync<br/>Latency</p>
                  </div>
                  <div className="p-8 rounded-[2.5rem] bg-[#121212] border border-white/[0.03] hover:border-red-600/20 transition-all">
                     <p className="text-white font-black text-4xl mb-2">98%</p>
                     <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest leading-tight">Prediction<br/>Accuracy</p>
                  </div>
               </div>
            </div>

            <div className="relative group">
               <div className="absolute inset-0 bg-red-600/5 blur-[120px] rounded-full group-hover:bg-red-600/10 transition-all" />
               <div className="rounded-[3.5rem] overflow-hidden border border-white/[0.05] shadow-[0_40px_80px_rgba(0,0,0,0.6)] aspect-video relative">
                  <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1200" alt="Tech" className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute top-10 right-10 w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white font-black">
                     <Zap className="w-8 h-8 fill-white" />
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* PREDICTION SECTION */}
      <section className="py-40 px-6">
        <div className="max-w-[1200px] mx-auto text-center mb-24">
           <div className="text-red-500 font-bold text-[10px] uppercase tracking-[0.3em] mb-4">Neural Engine</div>
           <h2 className="text-5xl md:text-7xl font-[900] text-white uppercase italic tracking-tighter mb-8">Logistics Forecast</h2>
           <p className="text-neutral-500 max-w-2xl mx-auto font-medium">Quantify your delivery vectors with our integrated prediction terminal.</p>
        </div>
        <PredictForm />
      </section>

      {/* FOOTER */}
      <footer className="bg-[#050505] border-t border-white/[0.03] pt-32 pb-16 px-8">
         <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-32">
               <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-10">
                    <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-white rounded-full opacity-80" />
                    </div>
                    <div className="text-3xl font-[900] tracking-tighter uppercase italic">
                       <span className="text-white">LOGIN</span>
                       <span className="text-red-600">EX</span>
                    </div>
                  </div>
                  <p className="text-neutral-500 font-medium max-w-sm leading-relaxed text-lg">
                    Re-engineering the logistics landscape of Pakistan through sovereign data control and connected autonomous networks.
                  </p>
               </div>
               
               <div className="space-y-8">
                  <h4 className="text-white font-black uppercase tracking-widest text-xs">Navigation</h4>
                  <ul className="space-y-4">
                     <li><Link href="/login" className="text-neutral-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider">Access Node</Link></li>
                     <li><Link href="/store" className="text-neutral-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider">Public Registry</Link></li>
                     <li><Link href="/login" className="text-neutral-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider">Secure Portal</Link></li>
                  </ul>
               </div>

               <div className="space-y-8">
                  <h4 className="text-white font-black uppercase tracking-widest text-xs">Security</h4>
                  <ul className="space-y-4">
                     <li><span className="text-neutral-500 text-sm font-bold uppercase tracking-wider">End-to-End Encryption</span></li>
                     <li><span className="text-neutral-500 text-sm font-bold uppercase tracking-wider">Node Integrity Check</span></li>
                     <li><span className="text-neutral-500 text-sm font-bold uppercase tracking-wider">L-EX Protocol v3</span></li>
                  </ul>
               </div>
            </div>

            <div className="pt-16 border-t border-white/[0.03] flex flex-col md:flex-row justify-between items-center gap-10">
               <p className="text-neutral-700 text-[10px] font-black uppercase tracking-[0.4em]">© 2026 LOGINEX GLOBAL LOGISTICS INFRASTRUCTURE • ALL RIGHTS RESERVED</p>
               <div className="flex gap-10">
                  <Star className="text-neutral-800 w-5 h-5" />
                  <Globe className="text-neutral-800 w-5 h-5" />
                  <Shield className="text-neutral-800 w-5 h-5" />
               </div>
            </div>
         </div>
      </footer>
    </main>
  );
}

function DashboardCard({ title, roleKey, icon: Icon, description }: { title: string; roleKey: string; icon: any; description: string }) {
  const { isAuthenticated, user } = useAppStore();
  const rolePathMap: Record<string, string> = {
    'shipper': 'shipper',
    'driver': 'driver',
    'hub_holder': 'hub-holder',
    'hub_partner': 'hub-partner',
    'brand': 'brand-delivery',
  };
  const rolePath = rolePathMap[roleKey] || roleKey.replace('_', '-');
  const isDirectAccess = isAuthenticated && user?.roles?.includes(roleKey as any);
  const href = isDirectAccess ? `/dashboard/${rolePath}` : `/login?role=${roleKey}`;

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
        className="bg-[#0f0f0f] border border-white/[0.03] rounded-[2.5rem] p-8 h-64 flex flex-col justify-between group transition-all cursor-pointer relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl group-hover:bg-red-600/10 transition-colors" />
        
        <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-neutral-600 group-hover:text-red-500 group-hover:border-red-500/30 transition-all">
           <Icon className="w-6 h-6" />
        </div>

        <div>
           <p className="text-neutral-600 text-[10px] font-black uppercase tracking-widest mb-1">{description}</p>
           <h4 className="text-white font-black text-2xl uppercase italic tracking-tighter mb-4">{title}</h4>
           <div className="flex items-center gap-2 text-white/40 group-hover:text-white transition-all">
              <span className="text-[10px] font-black uppercase tracking-widest">Connect</span>
              <ArrowUpRight className="w-4 h-4" />
           </div>
        </div>
      </motion.div>
    </Link>
  );
}
