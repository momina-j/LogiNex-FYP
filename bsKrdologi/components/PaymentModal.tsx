'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/translations';
import { 
  X, CreditCard, Lock, ShieldCheck, 
  Loader2, CheckCircle2, AlertTriangle,
  Info, Landmark
} from 'lucide-react';

export default function PaymentModal() {
  const { 
    isPaymentModalOpen, 
    paymentData, 
    closePayment, 
    language,
    currentUser 
  } = useAppStore();

  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [card, setCard] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    pin: '',
    cardHolderName: currentUser?.name || ''
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isPaymentModalOpen) {
      setSuccess(false);
      setError(null);
      setLoading(false);
      setCard({
        cardNumber: '',
        expiry: '',
        cvv: '',
        pin: '',
        cardHolderName: currentUser?.name || ''
      });
    }
  }, [isPaymentModalOpen, currentUser]);

  const fmtCard = (val: string) => {
    const v = val.replace(/\D/g, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) return parts.join(' ');
    return v;
  };

  const fmtExpiry = (val: string) => {
    const v = val.replace(/\D/g, '');
    if (v.length >= 2) return v.substring(0, 2) + '/' + v.substring(2, 4);
    return v;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api-proxy/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          amount: paymentData?.amount,
          description: paymentData?.description,
          cardNumber: card.cardNumber,
          cvv: card.cvv,
          expiry: card.expiry,
          pin: card.pin,
          cardHolderName: card.cardHolderName,
          trackingId: paymentData?.trackingId,
          parcelId: paymentData?.parcelId
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Server returned an invalid or HTML response.');
      }
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      setSuccess(true);
      if (paymentData?.onSuccess) paymentData.onSuccess();
      
      // Auto close after 3 seconds
      setTimeout(() => {
        closePayment();
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  if (!isPaymentModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closePayment}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal Panel */}
        <motion.div
           initial={{ opacity: 0, scale: 0.9, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.9, y: 20 }}
           className="relative bg-slate-900 border border-slate-700 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          {/* Visual Header */}
          <div className="bg-gradient-to-br from-orange-600 to-rose-700 p-8 text-white relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
             <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                         <Landmark className="w-6 h-6" />
                      </div>
                      <span className="font-black tracking-widest text-sm uppercase">Secure Pay</span>
                   </div>
                   <button onClick={closePayment} className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/40 transition-all">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="space-y-1">
                   <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Payable Amount</p>
                   <h2 className="text-4xl font-black">Rs. {paymentData?.amount?.toLocaleString()}</h2>
                   <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest pt-2">{paymentData?.description}</p>
                </div>
             </div>
          </div>

          <div className="p-8">
             <AnimatePresence mode="wait">
                {success ? (
                   <motion.div 
                     key="success"
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="py-10 text-center space-y-6"
                   >
                      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                         <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                      </div>
                      <div>
                         <h3 className="text-2xl font-black text-white">Payment Successful!</h3>
                         <p className="text-slate-400 text-sm mt-2">Your transaction has been processed and saved to the secure vault.</p>
                      </div>
                      <div className="pt-4">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Closing automatically...</p>
                      </div>
                   </motion.div>
                ) : (
                   <motion.form 
                     key="form"
                     onSubmit={handleSubmit}
                     className="space-y-5"
                   >
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.dashboard.shipper.form.cardNumber}</label>
                         <div className="relative">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input 
                               required
                               type="text"
                               placeholder="0000 0000 0000 0000"
                               maxLength={19}
                               value={card.cardNumber}
                               onChange={(e) => setCard({...card, cardNumber: fmtCard(e.target.value)})}
                               className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/30 transition-all"
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.dashboard.shipper.form.expiryDate}</label>
                            <input 
                               required
                               type="text"
                               placeholder="MM/YY"
                               maxLength={5}
                               value={card.expiry}
                               onChange={(e) => setCard({...card, expiry: fmtExpiry(e.target.value)})}
                               className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/30 transition-all"
                            />
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.dashboard.shipper.form.cvv}</label>
                            <input 
                               required
                               type="password"
                               placeholder="***"
                               maxLength={4}
                               value={card.cvv}
                               onChange={(e) => setCard({...card, cvv: e.target.value.replace(/\D/g, '')})}
                               className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/30 transition-all"
                            />
                         </div>
                      </div>

                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.dashboard.shipper.form.pin}</label>
                         <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input 
                               required
                               type="password"
                               placeholder="Security PIN"
                               maxLength={6}
                               value={card.pin}
                               onChange={(e) => setCard({...card, pin: e.target.value.replace(/\D/g, '')})}
                               className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/30 transition-all"
                            />
                         </div>
                      </div>

                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.dashboard.shipper.form.cardHolder}</label>
                         <input 
                            required
                            type="text"
                            placeholder="John Doe"
                            value={card.cardHolderName}
                            onChange={(e) => setCard({...card, cardHolderName: e.target.value.toUpperCase()})}
                            className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/30 transition-all"
                         />
                      </div>

                      {error && (
                         <motion.div 
                           initial={{ opacity: 0, height: 0 }}
                           animate={{ opacity: 1, height: 'auto' }}
                           className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3 text-rose-500 text-xs font-bold"
                         >
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                         </motion.div>
                      )}

                      <button 
                         type="submit"
                         disabled={loading}
                         className="w-full py-5 rounded-[1.5rem] bg-white text-slate-900 font-black text-lg shadow-xl shadow-slate-950/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                         {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                         ) : (
                            <>
                               <ShieldCheck className="w-6 h-6" />
                               {t.dashboard.shipper.form.payNow}
                            </>
                         )}
                      </button>

                      <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                         <Lock className="w-3 h-3" /> Encrypted Endpoint Verified
                      </div>
                   </motion.form>
                )}
             </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
