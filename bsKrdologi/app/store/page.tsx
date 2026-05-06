'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '@/lib/cartStore';
import { Navbar } from '@/components/layout/Navbar';
import { 
  ShoppingBag, Search, Filter, Star, 
  ShoppingCart, ArrowRight, Package,
  Trash2, Plus, Minus, Check, Heart,
  Zap, Globe, Shield, Truck,
  ChevronRight, LayoutGrid, List
} from 'lucide-react';

const API = '/api-proxy/hubpartner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
}

export default function PublicStore() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const addItem = useCartStore((state) => state.addItem);

  const categories = ['All', 'Electronics', 'Fashion', 'Footwear', 'Accessories'];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch(`${API}/products/hp1`),
        fetch(`${API}/products/hp2`)
      ]);
      
      let allProducts: Product[] = [];
      if (res1.ok) {
        const d1 = await res1.json();
        allProducts = [...allProducts, ...(d1.products || [])];
      }
      if (res2.ok) {
        const d2 = await res2.json();
        allProducts = [...allProducts, ...(d2.products || [])];
      }

      setProducts(allProducts);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-orange-500/20">
      <Navbar />
      
      {/* Light Hero Section */}
      <section className="relative pt-32 pb-24 px-6 bg-white border-b border-slate-200 overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ea580c 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-orange-100 text-orange-600 mb-6 uppercase border border-orange-200">
                <Package className="w-3 h-3" /> Original Storefront
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 mb-6">
                Fresh <span className="text-orange-600">Arrivals</span>
              </h1>
              <p className="text-lg text-slate-500 max-w-xl mx-auto font-medium">
                High-quality items from our verified hub partners, delivered with Loginex efficiency.
              </p>
            </motion.div>
          </div>

          {/* Search & Tabs - Fixed Hydration Error */}
          <div className="max-w-4xl mx-auto">
             <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row gap-2">
                <div className="flex-1 relative">
                   <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                   {/* Normal input without complex motion props to avoid hydration mismatch */}
                   <input 
                      type="text" 
                      placeholder="Search original catalog..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500/30 transition-all font-bold text-sm text-slate-900"
                   />
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 px-1 scrollbar-hide">
                   {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                          activeCategory === cat 
                            ? 'bg-slate-900 text-white shadow-lg' 
                            : 'bg-white text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-16">
           <div>
              <h2 className="text-4xl font-black tracking-tight text-slate-900">Original <span className="text-orange-600">Collection</span></h2>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Verified partner listings</p>
           </div>
           
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm">
                 <LayoutGrid className="w-4 h-4 text-orange-600" />
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-100 text-slate-300">
                 <List className="w-4 h-4" />
              </div>
           </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="aspect-[3/4] rounded-3xl bg-white animate-pulse border border-slate-100 shadow-sm" />
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((p, idx) => (
                <ProductCard key={p.id} product={p} index={idx} onAdd={() => addItem(p)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-900">Catalogue Unreachable</h3>
            <p className="text-slate-400 mt-1 font-bold text-xs uppercase tracking-widest">Adjust your search or category filter</p>
            <button onClick={() => { setActiveCategory('All'); setSearchQuery(''); }} className="mt-8 px-6 py-2.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-200">Reset Filters</button>
          </div>
        )}
      </section>

      {/* Trust Badges - Simplified for White Theme */}
      <section className="border-t border-slate-200 bg-white py-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
           {[
             { icon: Truck, title: "Swift fulfillment", desc: "Automated routing ensuring the fastest partner hub allocation." },
             { icon: Shield, title: "3D-Secure Payments", desc: "Every transaction is end-to-end encrypted for your safety." },
             { icon: Globe, title: "Network Verified", desc: "Rigorous quality checks across our entire operational network." }
           ].map((item, i) => (
             <div key={i} className="flex gap-6">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                   <item.icon className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                   <h4 className="font-black text-slate-900 uppercase tracking-tight mb-1">{item.title}</h4>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
             </div>
           ))}
        </div>
      </section>
      
      <div className="text-center py-12 text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">
         Loginex Operational Store &copy; 2026
      </div>
    </div>
  );
}

function ProductCard({ product, index, onAdd }: { product: Product; index: number; onAdd: () => void }) {
  const [isAdded, setIsAdded] = useState(false);

  const handleAdd = () => {
    onAdd();
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      whileHover={{ y: -8 }}
      className="group bg-white rounded-3xl border border-slate-200 hover:border-orange-500/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-orange-900/5 flex flex-col overflow-hidden"
    >
      <div className="aspect-[4/5] relative overflow-hidden bg-slate-50 border-b border-slate-100">
        <img 
          src={product.imageUrl} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        <div className="absolute top-4 right-4 translate-x-12 group-hover:translate-x-0 transition-all duration-300 opacity-0 group-hover:opacity-100">
           <button className="w-9 h-9 rounded-full bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
             <Heart className="w-4 h-4 transition-colors" />
           </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 translate-y-16 group-hover:translate-y-0 transition-all duration-300">
           <button 
             onClick={handleAdd}
             className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
               isAdded ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-orange-600'
             }`}
           >
             {isAdded ? <Check className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
             {isAdded ? 'Added to Cart' : 'Acquire Item'}
           </button>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">
            {product.category}
          </span>
          <span className="text-[10px] font-bold text-slate-300">ID: {product.id.slice(0, 5)}</span>
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2 truncate group-hover:text-orange-600 transition-colors">{product.name}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 font-medium leading-relaxed mb-4">{product.description}</p>
        
        <div className="mt-auto pt-4 flex items-center justify-between">
            <p className="text-xl font-black text-slate-900 tracking-tight">Rs. {product.price.toLocaleString()}</p>
            <div className="flex gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
               {[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-2.5 h-2.5 text-orange-400 fill-orange-400" />)}
            </div>
        </div>
      </div>
    </motion.div>
  );
}
