'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '@/lib/cartStore';
import { useAppStore } from '@/lib/store';
import { 
  X, ShoppingBag, Trash2, Plus, Minus, 
  CreditCard, Truck, User, Mail, MapPin,
  CheckCircle2, Loader2, ArrowRight, ShieldCheck
} from 'lucide-react';

const API = '/api-proxy/hubpartner';

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, clearCart } = useCartStore();
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', address: '', city: '' });

  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const tax = subtotal * 0.12;
  const shipping = subtotal > 5000 ? 0 : 250;
  const total = subtotal + tax + shipping;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trigger Global Payment Modal
    useAppStore.getState().triggerPayment({
      amount: total,
      description: `Store Order for ${formData.name}`,
      onSuccess: async () => {
        setLoading(true);
        try {
          const partnerIds = Array.from(new Set(items.map(i => i.partnerId)));
          
          for (const pid of partnerIds) {
            const partnerItems = items.filter(i => i.partnerId === pid);
            const partnerAmount = partnerItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
            
            await fetch(`${API}/orders`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partnerId: pid || 'hp1',
                customerName: formData.name,
                customerEmail: formData.email,
                customerAddress: `${formData.address}, ${formData.city}`,
                amount: partnerAmount,
                items: partnerItems,
                status: 'paid'
              })
            });
          }

          setStep('success');
          setLoading(false);
          setTimeout(() => {
             clearCart();
             setIsOpen(false);
             setStep('cart');
          }, 5000);
        } catch (err) {
          console.error(err);
          setLoading(false);
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        {/* Backdrop */}
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={() => setIsOpen(false)}
           className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Drawer Content */}
        <motion.div
           initial={{ x: '100%' }}
           animate={{ x: 0 }}
           exit={{ x: '100%' }}
           transition={{ type: 'spring', damping: 25, stiffness: 200 }}
           className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <ShoppingBag className="w-5 h-5 text-orange-600" />
               <h2 className="text-xl font-black text-slate-900">Your Hub Cart</h2>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
               <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {step === 'cart' && (
              <>
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <ShoppingBag className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Cart is empty</h3>
                    <p className="text-slate-500 text-sm max-w-[200px] mt-2">Looks like you haven't added anything yet!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {items.map((item) => (
                      <motion.div key={item.id} layout className="flex gap-4 group">
                        <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                           {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-slate-300" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-slate-900 truncate pr-4 text-sm">{item.name}</h4>
                              <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                           <p className="text-xs text-slate-400 mb-3">Partner ID: {item.partnerId || 'Elite Hub'}</p>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-100">
                                 <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 hover:text-orange-600"><Minus className="w-3.5 h-3.5" /></button>
                                 <span className="text-xs font-black text-slate-900 w-4 text-center">{item.quantity}</span>
                                 <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 hover:text-orange-600"><Plus className="w-3.5 h-3.5" /></button>
                              </div>
                              <p className="font-black text-slate-900 text-sm">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                           </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 'checkout' && (
              <form onSubmit={handleCheckout} className="space-y-6 py-2">
                <div className="space-y-4">
                   <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-4">
                      <User className="w-4 h-4 text-orange-600" /> Customer Information
                   </h3>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600/30" placeholder="John Doe" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Email Address</label>
                      <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600/30" placeholder="john@example.com" />
                   </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-4">
                      <Truck className="w-4 h-4 text-orange-600" /> Shipping Details
                   </h3>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Address</label>
                      <input required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600/30" placeholder="123 Street St." />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">City</label>
                      <input required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600/30" placeholder="London" />
                   </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-3xl bg-orange-50 border border-orange-100/50 text-xs text-orange-700 font-bold">
                   <ShieldCheck className="w-5 h-5" />
                   <div>
                      <p>Secure Checkout</p>
                      <p className="text-[10px] font-medium opacity-70">Payment will be processed via our unified secure gateway.</p>
                   </div>
                </div>

                <div className="pt-4">
                   <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-orange-600 text-white font-black shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm & Pay"}
                   </button>
                   <button type="button" onClick={() => setStep('cart')} className="w-full py-3 text-xs font-bold text-slate-400 mt-2 hover:text-orange-600 transition-colors">Back to Cart</button>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 text-emerald-600">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Order Placed!</h3>
                <p className="text-slate-500 text-sm mb-8">Thank you for shopping! Your order has been placed successfully and will be processed soon.</p>
                <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-2 mb-8">
                   <div className="flex justify-between text-xs"><span className="text-slate-400 font-medium">Order ID</span><span className="font-bold text-slate-900">#HUB-{Math.floor(Math.random()*100000)}</span></div>
                   <div className="flex justify-between text-xs"><span className="text-slate-400 font-medium">Total Paid</span><span className="font-bold text-orange-600">Rs. {total.toLocaleString()}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Footer (Price Summary) */}
          {items.length > 0 && step === 'cart' && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
              <div className="space-y-3 mb-6">
                 <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>Subtotal</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>GST (12%)</span>
                    <span>Rs. {tax.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between text-sm text-slate-500 font-medium">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `Rs. ${shipping}`}</span>
                 </div>
                 <div className="pt-3 border-t border-slate-200 flex justify-between">
                    <span className="text-lg font-black text-slate-900">Grand Total</span>
                    <span className="text-lg font-black text-orange-600">Rs. {total.toLocaleString()}</span>
                 </div>
              </div>
              <button 
                onClick={() => setStep('checkout')}
                className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
              >
                Checkout Now <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
