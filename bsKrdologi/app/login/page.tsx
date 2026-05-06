'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Loader2, ArrowRight, ShieldCheck, Zap, AlertTriangle, Package } from 'lucide-react';
import { translations } from '@/lib/translations';

import { LoadingScreen } from '@/components/LoadingScreen';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const { login, language } = useAppStore();
  const t = translations[language as keyof typeof translations];
  
  const searchParams = useSearchParams();
  const selectedRole = searchParams.get('role');
  
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    
    try {
      console.log(`[Login Diagnostic] Attempting login for: ${formData.identifier}`);
      
      const response = await fetch('/api-proxy/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: formData.identifier,
          password: formData.password,
        }),
      });

      console.log(`[Login Diagnostic] Status: ${response.status} ${response.statusText}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Login Diagnostic] Expected JSON but received:', text);
        setStatus('error');
        setErrorMsg('Server error: Received non-JSON response. Check console logs.');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('[Login Diagnostic] Login failed:', data);
        setStatus('error');
        setErrorMsg(data.error || (language === 'en' ? 'Login failed. Please try again.' : 'لاگ ان ناکام رہا۔ دوبارہ کوشش کریں۔'));
        return;
      }

      console.log('[Login Diagnostic] Success:', data);
      setStatus('success');
      
      setTimeout(() => {
        login(data.user);
        
        const rolePathMap: Record<string, string> = {
          'shipper': 'shipper',
          'driver': 'driver',
          'hub_holder': 'hub-holder',
          'hub_partner': 'hub-partner',
          'admin': 'hub-holder',
          'brand': 'brand-delivery',
        };

        const userRoles = data.user.roles || ['customer'];
        let targetRole = userRoles[0];

        if (selectedRole && userRoles.includes(selectedRole)) {
          targetRole = selectedRole;
        } else if (!selectedRole && userRoles.includes('shipper')) {
          targetRole = 'shipper';
        }

        const dashboardRole = rolePathMap[targetRole] || targetRole.replace(/_/g, '-');
        router.push(`/dashboard/${dashboardRole}`);
      }, 800);
    } catch (error: any) {
      console.error('[Login Diagnostic] Connection error:', error);
      setStatus('error');
      setErrorMsg(language === 'en' ? 'Could not connect to the server' : 'سرور سے رابطہ نہیں ہو سکا');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #62161aff 0%, #2a080aff 100%)' }}>
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
      </div>

      <header className="absolute top-10 left-0 right-0 z-50 px-10">
        <Link href="/">
          <div className="flex items-center gap-3 justify-center md:justify-start">
             <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                 <div className="w-2.5 h-2.5 bg-white rounded-full opacity-80" />
             </div>
             <div className="text-2xl font-[900] tracking-tighter uppercase italic">
                <span className="text-white">LOGIN</span>
                <span className="text-red-600">EX</span>
             </div>
          </div>
        </Link>
      </header>

      {!mounted || status === 'success' ? (
         <LoadingScreen />
      ) : (
        <div className="w-full max-w-7xl px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center z-10">
          {/* Left Column: Login Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full max-w-lg mx-auto lg:mx-0"
          >
            <div className="bg-[#111111]/60 backdrop-blur-2xl border border-white/[0.05] rounded-[3rem] p-10 md:p-14 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
              <div className="mb-10">
                 <div className="flex items-center gap-3 text-red-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-4">
                    <ShieldCheck className="w-4 h-4" /> Secure Access
                 </div>
                 <h2 className="text-4xl md:text-5xl font-[900] text-white uppercase italic tracking-tighter mb-4">
                    {t.auth.loginTitle}
                 </h2>
                 <p className="text-neutral-500 text-sm font-medium tracking-wide">
                    {t.auth.loginSubtitle}
                 </p>
              </div>
  
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">{t.auth.emailPhone}</label>
                  <div className="relative group">
                    <input 
                      required
                      type="text" 
                      value={formData.identifier}
                      onChange={e => setFormData({...formData, identifier: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-3xl px-8 py-5 text-white font-medium focus:outline-none focus:border-red-600/30 transition-all placeholder:text-neutral-700"
                      placeholder="Enter Credential"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-neutral-600 group-focus-within:text-red-500 transition-colors">
                       <Zap className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{t.auth.password}</label>
                    <Link href="#" className="text-[10px] font-black text-red-600 hover:text-red-500 uppercase tracking-widest transition-colors">
                      {t.auth.forgotPassword}
                    </Link>
                  </div>
                  <input 
                    required
                    type="password" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-3xl px-8 py-5 text-white font-medium focus:outline-none focus:border-red-600/30 transition-all placeholder:text-neutral-700"
                    placeholder="••••••••"
                  />
                </div>
  
                {status === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-red-600/10 border border-red-600/20 px-6 py-4 rounded-2xl flex items-center gap-4"
                  >
                     <AlertTriangle className="w-5 h-5 text-red-600" />
                     <span className="text-red-500 text-xs font-bold">{errorMsg}</span>
                  </motion.div>
                )}
  
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-[900] py-6 rounded-3xl uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-red-900/40 disabled:opacity-50 flex items-center justify-center gap-4"
                >
                  {status === 'loading' ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> processing</>
                  ) : (
                    <>Initialize Login <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </form>
  
              <div className="mt-10 pt-10 border-t border-white/[0.03] text-center">
                 <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">
                    Not Registered? <Link href="/register" className="text-white hover:text-red-500 transition-colors ml-2">Request Access</Link>
                 </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Information Panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:block space-y-8"
          >
            <div className="relative group overflow-hidden rounded-[3rem] aspect-video border border-white/5 shadow-2xl">
               <img 
                 src="/loginex-hero.png" 
                 alt="Logistics Future" 
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-[#2a080a] via-transparent to-transparent pointer-events-none" />
               <div className="absolute bottom-8 left-8 right-8">
                  <div className="bg-red-600/20 backdrop-blur-md border border-red-600/30 px-4 py-2 rounded-full inline-flex items-center gap-2 mb-4">
                     <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Neural Grid Active</span>
                  </div>
                  <h3 className="text-3xl font-[900] text-white uppercase italic tracking-tighter">
                     Redefining <span className="text-red-600">Intelligence</span>
                  </h3>
               </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[3rem] p-12 space-y-6">
               <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-red-500">
                     <Package className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                     <h4 className="text-white font-black uppercase text-sm tracking-wider">PAKISTAN'S PREMIER NETWORK</h4>
                     <p className="text-neutral-500 text-xs font-medium leading-relaxed">
                        Join the most resilient and reliable logistics ecosystem, specifically engineered for the high-demand e-commerce landscape.
                     </p>
                  </div>
               </div>
               
               <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-red-500">
                     <Zap className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                     <h4 className="text-white font-black uppercase text-sm tracking-wider">AI-DRIVEN ORCHESTRATION</h4>
                     <p className="text-neutral-500 text-xs font-medium leading-relaxed">
                        Leverage neural network optimizations for route planning, asset management, and real-time shipment transparency.
                     </p>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="absolute bottom-10 text-[9px] font-black text-neutral-700 uppercase tracking-[0.4em] text-center">
         &copy; 2026 LOGINEX LOGISTICS SYSTEM • GLOBAL NODE ADM-01
      </footer>
    </div>
  );
}

