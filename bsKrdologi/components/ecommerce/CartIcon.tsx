'use client';

import { useCartStore } from '@/lib/cartStore';
import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CartIcon() {
  const { items, setIsOpen } = useCartStore();
  const count = items.reduce((acc, item) => acc + item.quantity, 0);

  if (count === 0) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => setIsOpen(true)}
      className="fixed bottom-8 right-8 z-[60] flex items-center justify-center w-16 h-16 rounded-full bg-orange-600 text-white shadow-2xl cursor-pointer"
      style={{ boxShadow: '0 10px 40px rgba(79,70,229,0.4)' }}
    >
      <ShoppingCart className="w-7 h-7" />
      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-rose-500 text-[11px] font-black border-2 border-white">
        {count}
      </span>
    </motion.div>
  );
}
