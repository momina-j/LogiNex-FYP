'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navbar } from '@/components/layout/Navbar';
import { RouteLegCard } from '@/components/RouteLegCard';
import { NavigationModal } from '@/components/NavigationModal';
import { LocationTracker } from '@/components/LocationTracker';
import { useAppStore } from '@/lib/store';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { Truck, MapPin, Package, CheckCircle, BarChart3, AlertCircle } from 'lucide-react';
import ActiveTrip from './ActiveTrip';

export default function DriverDashboard() {
 const { currentUser } = useAppStore();
 const [activeRoute, setActiveRoute] = useState<any>(null);
 const [selectedLeg, setSelectedLeg] = useState<any>(null);
 const [isNavModalOpen, setIsNavModalOpen] = useState(false);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!currentUser?.id) return;

 // Listen for driver's active route
 const unsubDriver = onSnapshot(doc(db, 'drivers', currentUser.id), (docSnap) => {
 const driverData = docSnap.data();
 if (driverData?.currentRouteId) {
 // Fetch the route details
 const unsubRoute = onSnapshot(doc(db, 'routes', driverData.currentRouteId), (routeSnap) => {
 if (routeSnap.exists()) {
 setActiveRoute({ id: routeSnap.id, ...routeSnap.data() });
 }
 setLoading(false);
 });
 return () => unsubRoute();
 } else {
 setActiveRoute(null);
 setLoading(false);
 }
 });

 return () => unsubDriver();
 }, [currentUser?.id]);

 const handleLegCompleted = async (legIndex: number) => {
 if (!activeRoute) return;

 const updatedLegs = [...activeRoute.legs];
 updatedLegs[legIndex].status = 'completed';
 updatedLegs[legIndex].actualArrivalTime = new Date().toISOString();

 // If there's a next leg, set it to in_progress
 if (legIndex + 1 < updatedLegs.length) {
 updatedLegs[legIndex + 1].status = 'in_progress';
 }

 try {
 await updateDoc(doc(db, 'routes', activeRoute.id), {
 legs: updatedLegs,
 currentLegIndex: legIndex + 1,
 status: legIndex + 1 === updatedLegs.length ? 'completed' : 'active'
 });

 // Update driver status if all legs done
 if (legIndex + 1 === updatedLegs.length) {
 await updateDoc(doc(db, 'drivers', currentUser!.id), {
 currentRouteId: null,
 status: 'online'
 });
 }
 } catch (err) {
 console.error('Error updating leg status:', err);
 }
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-[#050410] flex items-center justify-center">
 <div className="flex flex-col items-center gap-4">
 <Truck className="w-12 h-12 text-orange-600 animate-pulse"/>
 <p className="text-orange-200/50 font-bold uppercase tracking-widest text-xs">Syncing Terminal...</p>
 </div>
 </div>
 );
 }

 return (
 <main className="min-h-screen bg-[#050410] dark text-white pb-20">
 <Navbar />
 
 <div className="max-w-[1400px] mx-auto px-4 pt-24">
 {/* Header Section */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
 <div>
 <motion.h1 
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 className="text-4xl md:text-5xl font-black uppercase tracking-tighter"
 >
 Driver <span className="text-orange-600">Console</span>
 </motion.h1>
 <p className="text-slate-400 font-medium mt-1">Logged in as {currentUser?.name || 'Authorized Personnel'}</p>
 </div>
 
 <LocationTracker 
 driverId={currentUser?.id || ''} 
 activeRouteId={activeRoute?.id} 
 />
 </div>

 {!activeRoute ? (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="bg-[#171432] border border-white/20 rounded-[2rem] p-12 text-center"
 >
 <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
 <Package className="w-10 h-10 text-orange-500"/>
 </div>
 <h2 className="text-3xl font-black uppercase mb-4">No Active Routes</h2>
 <p className="text-slate-400 max-w-md mx-auto mb-8">
 Your terminal is currently offline. Please wait for a dispatcher to assign a package route or visit the terminal hub for updates.
 </p>
 <button className="bg-orange-600 hover:bg-orange-500 text-white font-black px-8 py-3 rounded-xl transition-all uppercase tracking-widest text-sm shadow-orange-900/20">
 Request Assignment
 </button>
 </motion.div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Left Column: Active Trip View */}
 <div className="lg:col-span-2 space-y-8">
 <ActiveTrip route={activeRoute} />
 
 <div className="space-y-4">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-1 h-8 bg-orange-600 rounded-full"/>
 <h3 className="text-xl font-black uppercase tracking-wider">Route Segments</h3>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {activeRoute.legs.map((leg: any, index: number) => (
 <RouteLegCard 
 key={index}
 leg={leg}
 onNavigate={() => {
 setSelectedLeg({ ...leg, index });
 setIsNavModalOpen(true);
 }}
 />
 ))}
 </div>
 </div>
 </div>

 {/* Right Column: Stats & Notifications */}
 <div className="space-y-6">
 <div className="bg-[#171432] border border-white/20 rounded-3xl p-6">
 <h4 className="font-black uppercase tracking-widest text-xs text-orange-500 mb-6">Trip Intelligence</h4>
 
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <BarChart3 className="w-5 h-5 text-slate-400"/>
 <span className="text-sm font-bold text-slate-300">Total Distance</span>
 </div>
 <span className="text-lg font-black">{(activeRoute.totalDistanceMeters / 1000).toFixed(1)} KM</span>
 </div>
 
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <CheckCircle className="w-5 h-5 text-slate-400"/>
 <span className="text-sm font-bold text-slate-300">Net ML ETA</span>
 </div>
 <span className="text-lg font-black text-orange-500">{activeRoute.totalMlEtaMinutes} MINS</span>
 </div>
 </div>

 <div className="mt-8 pt-8 border-t border-white/20">
 <div className="flex items-start gap-3 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20">
 <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5"/>
 <div>
 <p className="text-[10px] font-black uppercase text-orange-500 mb-1">Dispatch Alert</p>
 <p className="text-xs text-slate-300 leading-relaxed">
 Heavy congestion reported near {activeRoute.legs[0]?.destinationName}. Dynamic rerouting active in embed window.
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Support Card */}
 <div className="bg-gradient-to-br from-[#ea580c]/20 to-transparent border border-orange-500/20 rounded-3xl p-6">
 <h4 className="font-black uppercase tracking-widest text-[10px] text-white/50 mb-4">Emergency Protocols</h4>
 <p className="text-sm text-slate-200 mb-6 font-medium">Encountered an issue during transit? Connect with our global coordination team immediately.</p>
 <button className="w-full bg-[#e0000a] text-white backdrop-blur-md text-[#ea580c] font-black py-3 rounded-xl uppercase text-xs tracking-widest hover:bg-orange-50 transition-colors">
 Contact Dispatch
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Navigation Modal */}
 {selectedLeg && (
 <NavigationModal 
 isOpen={isNavModalOpen}
 onClose={() => setIsNavModalOpen(false)}
 origin={selectedLeg.originCoords}
 destination={selectedLeg.destinationCoords}
 distanceMeters={selectedLeg.distanceMeters}
 mlEtaMinutes={selectedLeg.mlPredictedEtaMinutes}
 onLegCompleted={() => handleLegCompleted(selectedLeg.index)}
 />
 )}
 </main>
 );
}
