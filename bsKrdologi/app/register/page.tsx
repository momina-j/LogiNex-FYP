'use client';

import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Truck, BarChart3, Store, CheckCircle2, AlertCircle, Loader2, ArrowRight, ShoppingBag } from 'lucide-react';
import { useAppStore, Role } from '@/lib/store';
import { translations } from '@/lib/translations';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const { login, language } = useAppStore();
  const t = translations[language as keyof typeof translations];

  const ROLES_CONFIG = [
    { id: 'shipper', title: t.roles.shipper, icon: Package, desc: t.roles.shipperDesc, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500' },
    { id: 'brand', title: 'Brand', icon: ShoppingBag, desc: 'Individual brand portal for batch deliveries', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500' },
    { id: 'driver', title: t.roles.driver, icon: Truck, desc: t.roles.driverDesc, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500' },
    { id: 'hub_holder', title: t.dashboard.navigation.hubHolder, icon: BarChart3, desc: t.roles.managerDesc, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500' },
    { id: 'hub_partner', title: t.roles.hubPartner, icon: Store, desc: t.roles.hubPartnerDesc, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500' },
  ];
  
  const [step, setStep] = useState(1);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    gender: 'Male',
    cnic: '',
    phone: '',
    address: '',
    warehouseLocation: '',
    city: 'Karachi',
    email: '',
    password: '',
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev => 
      prev.includes(roleId as Role) 
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId as Role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      alert(language === 'en' ? 'Please select at least one role' : 'براہ کرم کم از کم ایک کردار منتخب کریں');
      return;
    }
    
    setStatus('loading');
    setErrorMsg('');
    
    try {
      const response = await fetch('/api-proxy/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          roles: selectedRoles,
        }),
      });

      if (!response.ok) {
        const textResponse = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(textResponse);
        } catch (e) {
          console.error(`Register failed with HTML/text response [${response.status}]:`, textResponse);
          setStatus('error');
          setErrorMsg(`Server error: ${response.status}. Please check backend logs.`);
          return;
        }

        setStatus('error');
        setErrorMsg(errorData.error || (language === 'en' ? 'Registration failed' : 'رجسٹریشن ناکام رہی'));
        return;
      }

      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        setStatus('error');
        setErrorMsg('Invalid response from server.');
        return;
      }

      setStatus('success');
      
      setTimeout(() => {
        login(data.user);
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Registration error:', error);
      setStatus('error');
      setErrorMsg(language === 'en' ? 'Could not connect to the server' : 'سرور سے رابطہ نہیں ہو سکا');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'linear-gradient(135deg, #0d0b1e 0%, #13112e 60%, #0d0b1e 100%)' }}>
      <header className="p-6 border-b" style={{ borderColor: 'rgba(79,70,229,0.15)' }}>
        <Link href="/">
          <div className="text-2xl font-bold tracking-tighter flex items-center justify-center">
            <span className="text-white">LOGIN</span>
            <span style={{ color: '#f59e0b' }}>EX</span>
          </div>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          
          <div className="flex items-center justify-center mb-12">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'text-white' : 'text-slate-400'} font-bold transition-colors`} style={{ background: step >= 1 ? 'linear-gradient(135deg, #ea580c, #e11d48)' : 'rgba(37,33,80,0.6)' }}>1</div>
            <div className="w-24 h-1 transition-colors" style={{ background: step >= 2 ? '#ea580c' : 'rgba(37,33,80,0.6)' }} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'text-white' : 'text-slate-400'} font-bold transition-colors`} style={{ background: step >= 2 ? 'linear-gradient(135deg, #ea580c, #e11d48)' : 'rgba(37,33,80,0.6)' }}>2</div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: language === 'ur' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: language === 'ur' ? -20 : 20 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2">{t.auth.selectRoles}</h2>
                  <p className="text-slate-400">{t.auth.rolesSubtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {ROLES_CONFIG.map((role) => {
                    const isSelected = selectedRoles.includes(role.id as Role);
                    return (
                      <motion.div
                        key={role.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRoleToggle(role.id)}
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                          isSelected 
                            ? `${role.border} ${role.bg}` 
                            : ''
                        }`}
                        style={{
                           background: isSelected ? undefined : 'rgba(37,33,80,0.4)',
                           borderColor: isSelected ? undefined : 'rgba(79,70,229,0.15)'
                        }}
                      >
                        <div className={`w-12 h-12 rounded-full ${role.bg} flex items-center justify-center shrink-0`}>
                          <role.icon className={`w-6 h-6 ${role.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white">{role.title}</h3>
                          <p className="text-sm text-slate-400">{role.desc}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className={`w-6 h-6 ${role.color}`} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                <div className={`flex ${language === 'ur' ? 'justify-start' : 'justify-end'}`}>
                  <button
                    onClick={() => {
                      if (selectedRoles.length > 0) setStep(2);
                      else alert(language === 'en' ? 'Please select at least one role' : 'براہ کرم کم از کم ایک کردار منتخب کریں');
                    }}
                    className="text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #ea580c, #e11d48)', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}
                    disabled={selectedRoles.length === 0}
                  >
                    {t.auth.continue} <ArrowRight className={`w-5 h-5 ${language === 'ur' ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (status === 'idle' || status === 'error') && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: language === 'ur' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: language === 'ur' ? -20 : 20 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2">{t.auth.personalDetails}</h2>
                  <p className="text-slate-400">{t.auth.personalSubtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.fullName}</label>
                      <input 
                        required
                        type="text" 
                        value={formData.fullName}
                        onChange={e => setFormData({...formData, fullName: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.emailAddress}</label>
                      <input 
                        required
                        type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.phoneNumber}</label>
                      <input 
                        required
                        type="tel" 
                        placeholder="+92 3XX XXXXXXX"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.cnicNumber}</label>
                      <input 
                        required
                        type="text" 
                        placeholder="XXXXX-XXXXXXX-X"
                        value={formData.cnic}
                        onChange={e => setFormData({...formData, cnic: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.age}</label>
                      <input 
                        required
                        type="number" 
                        value={formData.age}
                        onChange={e => setFormData({...formData, age: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.gender}</label>
                      <select 
                        value={formData.gender}
                        onChange={e => setFormData({...formData, gender: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      >
                        <option value="Male">{t.auth.genderMale}</option>
                        <option value="Female">{t.auth.genderFemale}</option>
                        <option value="Other">{t.auth.genderOther}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.city}</label>
                      <select 
                        value={formData.city}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      >
                        <option>Karachi</option>
                        <option>Lahore</option>
                        <option>Islamabad</option>
                        <option>Rawalpindi</option>
                        <option>Peshawar</option>
                        <option>Quetta</option>
                        <option>Multan</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t.auth.password}</label>
                      <input 
                        required
                        type="password" 
                        minLength={6}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">{t.auth.fullAddress}</label>
                    <textarea 
                      required
                      rows={3}
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
                    />
                  </div>

                  {selectedRoles.includes('brand' as Role) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                      <label className="text-sm font-medium text-amber-400">Brand Warehouse Location</label>
                      <textarea 
                        required
                        rows={2}
                        placeholder="Complete address of your warehouse point"
                        value={formData.warehouseLocation}
                        onChange={e => setFormData({...formData, warehouseLocation: e.target.value})}
                        className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                      />
                    </motion.div>
                  )}

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-slate-400 hover:text-white px-6 py-3 font-medium transition-colors"
                    >
                      {t.auth.back}
                    </button>
                    <button
                      type="submit"
                      className="text-white px-8 py-3 rounded-lg font-bold transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #ea580c, #e11d48)', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}
                    >
                      {t.auth.submitRegistration}
                    </button>
                  </div>
                  
                  {status === 'error' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 mt-4 bg-red-500/10 border border-red-500/50 rounded-lg"
                    >
                      <p className="text-red-500 text-sm text-center font-medium">
                        {errorMsg}
                      </p>
                    </motion.div>
                  )}
                </form>
              </motion.div>
            )}

            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-12 shadow-2xl flex flex-col items-center justify-center text-center"
              >
                <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">{t.auth.submitting}</h2>
                <p className="text-slate-400">{t.auth.processing}</p>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-12 shadow-2xl flex flex-col items-center justify-center text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">{t.auth.registrationSuccess}</h2>
                <p className="text-slate-400 mb-8">{t.auth.redirecting}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          {step === 1 && (
            <div className="text-center mt-8">
              <p className="text-slate-400">
                {t.auth.alreadyHaveAccount} <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium">{t.auth.loginHere}</Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
