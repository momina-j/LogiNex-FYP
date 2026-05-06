'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import {
  Package, Truck, BarChart3, Store, Bell, MapPin, ShoppingBag,
  Settings, LogOut, Menu, X, Search, MessageSquare, Mic,
  ChevronRight, Zap, Loader2, Send, ShieldCheck, Cpu
} from 'lucide-react';
import { translations } from '@/lib/translations';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MiniLoader } from '@/components/MiniLoader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout, language, setLanguage, theme, setTheme } = useAppStore();
  const router = useRouter();
  const pathname = usePathname() || '';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Copilot States
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Identity Verified. System Online. How can I assist your logistics operation today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);
  
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // Text-To-Speech Output
  const speakResponse = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanedText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = langCode;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    const availableVoices = window.speechSynthesis.getVoices();
    if (langCode.includes('ur')) {
      const urduVoice = availableVoices.find(v => v.lang.toLowerCase().includes('ur'));
      if (urduVoice) utterance.voice = urduVoice;
    } else {
      const engVoice = availableVoices.find(v => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-gb'));
      if (engVoice) utterance.voice = engVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => { setChatInput(event.results[0][0].transcript); };
    recognition.onend = () => { setIsListening(false); };
    recognition.start();
  };

  const handleChatSubmit = (e?: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>, overrideMsg?: string) => {
    if (e && e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    const finalInput = overrideMsg || chatInput;
    if (!finalInput.trim()) return;
    const userMsg = finalInput.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    
    // Simulate AI Response logic... (keeping existing logic but updating content)
    setTimeout(() => {
        const reply = "Operational data retrieved. System is performing at peak efficiency. All logistics vectors are currently synced to your current role.";
        setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        speakResponse(reply, 'en-US');
    }, 600);
  };

  const t = translations[language as keyof typeof translations];

  useEffect(() => {
    if (isMounted && !currentUser) {
       router.replace('/login');
    }
  }, [currentUser, router, isMounted]);

  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (isMounted) {
      const timer = setTimeout(() => setLoadingComplete(true), 2800); // Wait for bar animation
      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  // Handle Route Transitions
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  if (!isMounted || !loadingComplete) return <LoadingScreen />;
  if (!currentUser) return null;

  const navigation = [
    { name: t.dashboard.navigation.shipper,    href: '/dashboard/shipper',       icon: Package,    show: true },
    { name: 'Brand',                           href: '/dashboard/brand-delivery', icon: ShoppingBag, show: true },
    { name: t.dashboard.navigation.driver,     href: '/dashboard/driver',         icon: Truck,      show: true },
    { name: t.dashboard.navigation.hubHolder,  href: '/dashboard/hub-holder',     icon: BarChart3,  show: true },
    { name: t.dashboard.navigation.hubPartner, href: '/dashboard/hub-partner',    icon: Store,      show: true },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen flex flex-col md:flex-row selection:bg-red-600/30"style={{ background: 'linear-gradient(135deg, #f5efef 0%, #e2dbdb 100%)' }}>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-md"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-72 flex flex-col transition-transform duration-500 ease-[0.16, 1, 0.3, 1] bg-[#0a0a0a] border-r border-white/[0.03] rounded-r-[3rem] shadow-2xl shadow-black/20
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="p-10 flex items-center justify-between">
          <Link href="/" onClick={() => setIsSidebarOpen(false)}>
            <div className="flex items-center gap-3">
               <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                 <div className="w-2 h-2 bg-white rounded-full opacity-80" />
               </div>
               <div className="text-2xl font-[900] tracking-tighter uppercase italic">
                 <span className="text-white">LOGIN</span>
                 <span className="text-red-600">EX</span>
               </div>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-8 mb-10">
           <div className="bg-[#111111] border border-white/[0.03] rounded-[2rem] p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-red-900/40">
                 {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                 <p className="text-white font-black uppercase text-sm truncate leading-tight">{currentUser.name}</p>
                 <p className="text-red-600 text-[9px] font-black uppercase tracking-widest mt-1 italic flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" /> High Clearance
                 </p>
              </div>
           </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] px-6 mb-4">Operations Center</p>
          
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                onClick={() => {
                  if (!isActive) setIsNavigating(true);
                  setIsSidebarOpen(false);
                }}
              >
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 relative group cursor-pointer ${
                    isActive ? 'bg-red-600/5 text-white' : 'text-white hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-red-600' : 'group-hover:text-white transition-colors'}`} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{item.name}</span>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                  )}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                  )}
                </motion.div>
              </Link>
            );
          })}

          <div className="pt-10">
             <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] px-6 mb-4">System Nodes</p>
             <Link href="/store" onClick={() => setIsSidebarOpen(false)}>
                <div className="flex items-center gap-4 px-6 py-4 rounded-2xl text-white hover:text-white hover:bg-white/[0.02] transition-all">
                   <ShoppingBag className="w-5 h-5" />
                   <span className="text-[11px] font-black uppercase tracking-widest">Public Store</span>
                </div>
             </Link>
          </div>
        </nav>

        {/* Action Footer */}
        <div className="p-6 space-y-2">
           <button 
             onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
             className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-[10px] font-black text-white hover:text-white transition-all"
           >
              <span className="uppercase tracking-widest">Protocol Language</span>
              <span className="text-red-600 uppercase italic">{language}</span>
           </button>
           <button
             onClick={() => { logout(); router.push('/login'); }}
             className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-red-600/60 hover:text-red-500 hover:bg-red-500/5 transition-all text-[10px] font-black uppercase tracking-[0.2em]"
           >
             <LogOut className="w-4 h-4" />
             Exit Session
           </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col h-screen relative">
        <AnimatePresence>
          {isNavigating && <MiniLoader />}
        </AnimatePresence>
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-8 py-6 bg-[#0a0a0a] border-b border-white/[0.05]">
           <button onClick={() => setIsSidebarOpen(true)} className="text-white">
              <Menu className="w-6 h-6" />
           </button>
           <div className="text-xl font-[900] tracking-tighter uppercase italic">
              <span className="text-white">LOGIN</span>
              <span className="text-red-600">EX</span>
           </div>
           <div className="w-6" />
        </div>

        {/* Page Content Viewport */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-16 custom-scrollbar scroll-smooth">
           {children}
        </div>

        {/* System Status Ticker */}
        <div className="bg-[#0a0a0a] border border-white/[0.05] mx-8 mb-6 mt-2 px-10 py-4 flex items-center justify-between rounded-full shadow-lg shadow-black/20">
           <div className="flex items-center gap-8">
              {[
                { label: 'DELIVERED', val: 1242, color: 'text-emerald-500' },
                { label: 'IN TRANSIT', val: 84, color: 'text-red-600' },
                { label: 'NODES ACTIVE', val: 512, color: 'text-white' }
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-3">
                   <div className={`w-1.5 h-1.5 rounded-full ${stat.color.replace('text', 'bg')} pulse-dot`} />
                   <div className="text-[9px] font-black tracking-widest uppercase">
                      <span className="text-white mr-2">{stat.label}</span>
                      <span className="text-white">{stat.val}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* AI Chatbot Terminal */}
        <div className="fixed bottom-10 right-10 z-50">
           <AnimatePresence>
             {isChatOpen && (
               <motion.div
                 initial={{ opacity: 0, y: 30, scale: 0.9 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 30, scale: 0.9 }}
                 className="absolute bottom-20 right-0 w-[400px] h-[600px] bg-[#111111]/80 backdrop-blur-3xl border border-white/[0.05] rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden mb-4"
               >
                  <div className="p-8 border-b border-white/[0.05] bg-[#151515]/50 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-red-600/10 flex items-center justify-center">
                           <Cpu className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                           <h3 className="text-white font-[900] text-sm uppercase italic tracking-tighter">AI Copilot</h3>
                           <p className="text-emerald-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Matrix Synced
                           </p>
                        </div>
                     </div>
                     <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
                     {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                           <div className={`max-w-[85%] p-6 rounded-[2rem] text-xs font-medium leading-relaxed ${
                              msg.role === 'assistant' 
                                ? 'bg-[#1a1a1a] text-white border border-white/[0.03] rounded-tl-none' 
                                : 'bg-red-600 text-white shadow-xl shadow-red-900/30 rounded-tr-none'
                           }`}>
                              {msg.text}
                           </div>
                        </div>
                     ))}
                     <div ref={chatEndRef} />
                  </div>

                  <div className="p-8 border-t border-white/[0.05] bg-[#f5efef]">
                     <div className="relative group">
                        <input 
                           type="text" 
                           value={chatInput}
                           onChange={e => setChatInput(e.target.value)}
                           onKeyDown={handleChatSubmit}
                           className="w-full bg-[#151515] border border-white/[0.05] rounded-3xl px-8 py-5 text-white text-xs font-medium focus:outline-none focus:border-red-600/30 transition-all placeholder:text-white"
                           placeholder="Command Input..."
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                           <button onClick={startVoiceRecognition} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-600 text-white' : 'bg-white/[0.03] text-white hover:text-white'}`}>
                              <Mic className="w-4 h-4" />
                           </button>
                           <button onClick={() => handleChatSubmit()} className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/20 active:scale-95 transition-all">
                              <Send className="w-4 h-4" />
                           </button>
                        </div>
                     </div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

           <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="w-16 h-16 rounded-[2rem] bg-red-600 flex items-center justify-center text-white shadow-[0_20px_40px_rgba(220,38,38,0.3)] hover:bg-red-700 transition-all"
           >
              {isChatOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8 fill-white" />}
           </motion.button>
        </div>
      </main>
    </div>
  );
}

