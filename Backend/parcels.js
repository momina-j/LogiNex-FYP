const express = require('express');
const router  = express.Router();
const { db, admin } = require('./firebase-config');
const { predictETA } = require('./services/etaService');

// Flask ML backend base URL
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';

// ─── City coordinate map (used when exact lat/lng not in payload) ───────────
const CITY_COORDS = {
  karachi   : { lat: 24.8607, lng: 67.0011 },
  lahore    : { lat: 31.5204, lng: 74.3587 },
  islamabad : { lat: 33.6844, lng: 73.0479 },
  rawalpindi: { lat: 33.5651, lng: 73.0169 },
  faisalabad: { lat: 31.4180, lng: 73.0790 },
  peshawar  : { lat: 34.0151, lng: 71.5249 },
  multan    : { lat: 30.1575, lng: 71.5249 },
};

/**
 * autoAssignDriver
 * ----------------
 * Calls the Flask ML pipeline (/assign_driver) to select the best driver
 * for a parcel booking. Returns { driverId, driverName } or null on failure.
 *
 * This is the ONLY driver assignment mechanism — no random/manual selection.
 *
 * @param {string} city         – Delivery city (used for coordinate lookup)
 * @param {string} vehicleType  – Required vehicle type
 * @param {Array}  parcels      – Parcel array (for total weight)
 * @param {number} [lat]        – Override order latitude
 * @param {number} [lng]        – Override order longitude
 * @returns {Promise<{driverId:string, driverName:string, score:number}|null>}
 */
async function autoAssignDriver(city, vehicleType, parcels, lat, lng) {
  try {
    // 1. Get order coordinates
    const cityKey    = (city || '').toLowerCase().trim();
    const cityCoords = CITY_COORDS[cityKey] || CITY_COORDS.karachi;
    const orderLat   = lat  || cityCoords.lat;
    const orderLng   = lng  || cityCoords.lng;

    // 2. Fetch all drivers from Firestore
    const driversSnap = await db.collection('drivers').get();
    if (driversSnap.empty) {
      console.warn('[autoAssignDriver] No drivers in Firestore – parcel stays pending.');
      return null;
    }
    const driversList = driversSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id            : doc.id,
        name          : d.name || d.fullname,
        lat           : d.currentLocation?.lat || d.lat || cityCoords.lat,
        lng           : d.currentLocation?.lng || d.lng || cityCoords.lng,
        vehicleType   : d.vehicleType || 'car',
        rating        : Number(d.rating) || 4.5,
        active_orders : Number(d.active_orders || d.activeOrders) || 0
      };
    });

    // 3. Build order payload
    const totalWeight = (parcels || []).reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    const orderPayload = {
      lat        : orderLat,
      lng        : orderLng,
      vehicleType: vehicleType || 'car',
      totalWeight,
    };

    // 4. Call Flask ML pipeline
    const flaskRes = await fetch(`${FLASK_URL}/assign_driver`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ order: orderPayload, drivers: driversList }),
    });

    if (!flaskRes.ok) {
      console.warn(`[autoAssignDriver] Flask returned ${flaskRes.status} – parcel stays pending.`);
      return null;
    }

    const assignData = await flaskRes.json();
    if (assignData.success && assignData.assigned_driver) {
      const d = assignData.assigned_driver;
      console.log(`[autoAssignDriver] Assigned driver: ${d.name || d.id} (score=${d.score})`);
      return { driverId: d.id, driverName: d.name || d.id, score: d.score };
    }

    console.warn('[autoAssignDriver] Flask succeeded but no driver returned.');
    return null;

  } catch (err) {
    console.warn('[autoAssignDriver] Error calling Flask ML pipeline:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// TRACKING ID GENERATOR
// Format:  SVC-SHP-SEQNO-RAND
// Example: 1Z-A4F2-00023-847561
//
// SERVICE CODES (fixed constants):
//   1Z = Express Delivery
//   1G = Ground Delivery
//   1E = Economy Delivery
//
// SHIPPER ID: First 4 uppercase hex chars of userId
// SEQUENCE NO: Auto-incremented per shipper, zero-padded to 5 digits
// RANDOM SUFFIX: 6-digit random number
// ─────────────────────────────────────────────────────────
const SERVICE_CODES = { bike: '1Z', rickshaw: '1Z', car: '1G', van: '1G', truck: '1E' };

async function generateTrackingId(userId, vehicleType) {
  const serviceCode = SERVICE_CODES[vehicleType] || '1G';

  // Derive a stable 4-char shipper code from userId
  const shipperCode = userId
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase()
    .padEnd(4, 'X');

  // Auto-increment per shipper using a Firestore counter doc
  const counterRef = db.collection('shipperCounters').doc(userId);
  const counterDoc = await counterRef.get();
  const currentSeq = counterDoc.exists ? (counterDoc.data().seq || 0) : 0;
  const nextSeq = currentSeq + 1;
  await counterRef.set({ seq: nextSeq }, { merge: true });

  const seqStr  = String(nextSeq).padStart(5, '0');
  const randSuffix = String(Math.floor(100000 + Math.random() * 900000));

  return `${serviceCode}-${shipperCode}-${seqStr}-${randSuffix}`;
}

/**
 * @route   POST /api/parcels/create
 * @desc    Create a new parcel booking with vehicle preference
 * @access  Public (for demo purposes)
 */
router.post('/create', async (req, res) => {
  const { 
    userId, 
    receiverName, 
    receiverPhone, 
    receiverAddress, 
    city, 
    vehicleType, // New field from shipper
    parcels 
  } = req.body;

  // Basic validation
  if (!userId || !receiverName || !receiverPhone || !receiverAddress || !city || !parcels) {
    return res.status(400).json({ error: 'Missing required fields (userId, receiverName, receiverPhone, receiverAddress, city, parcels).' });
  }

  try {
    // Generate structured tracking ID
    const trackingId = await generateTrackingId(userId, vehicleType);

    const newBooking = {
      userId,
      trackingId,
      receiverName,
      receiverPhone,
      receiverAddress,
      shipperName:    req.body.shipperName   || 'N/A',
      shipperPhone:   req.body.shipperPhone  || 'N/A',
      shipperAddress: req.body.shipperAddress || 'N/A',
      city,
      vehicleType: vehicleType || 'car', // Default to car if not provided
      status: 'pending',
      driverId: null,
      shipperLat: Number(req.body.shipperLat) || null,
      shipperLng: Number(req.body.shipperLng) || null,
      receiverLat: Number(req.body.receiverLat) || null,
      receiverLng: Number(req.body.receiverLng) || null,
      parcels: parcels.map(p => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        description: p.description,
        paymentMethod: p.paymentMethod || 'COD',
        codAmount: Number(p.codAmount) || 0,
        weight: Number(p.weight) || 0,
        length: Number(p.length) || 0,
        width: Number(p.width) || 0,
        height: Number(p.height) || 0,
        unitPrice: Number(p.unitPrice) || 0,
      })),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // --- INTEGRATE ETA PREDICTION ---
    // Get coordinates for the city to improve initial ETA accuracy
    const cityKey    = (city || '').toLowerCase().trim();
    const cityCoords = CITY_COORDS[cityKey] || CITY_COORDS.karachi;
    
    const etaData = await predictETA({
      city,
      vehicleType,
      parcels,
      pickup_lat: req.body.shipperLat || cityCoords.lat,
      pickup_lng: req.body.shipperLng || cityCoords.lng,
      dropoff_lat: req.body.receiverLat || cityCoords.lat,
      dropoff_lng: req.body.receiverLng || cityCoords.lng
    });
    
    if (etaData) {
      newBooking.estimatedDelivery = etaData.prediction;
      newBooking.etaUnit = etaData.unit;
      newBooking.etaCalculatedAt = etaData.timestamp;
    }
    // --------------------------------

    // --- AI DRIVER ASSIGNMENT (ML Pipeline) ---
    // We run the pipeline for suggestion/logging, but keep status 'pending'
    // as per user requirement to have it in the "req" column for manual accept.
    let suggestedDriverId   = null;
    let assignedDriverNote = null;
    const assigned = await autoAssignDriver(city, vehicleType, parcels);
    if (assigned) {
      suggestedDriverId          = assigned.driverId;
      newBooking.suggestedDriverId = suggestedDriverId;
      assignedDriverNote        = `AI recommended: ${assigned.driverName} (score=${assigned.score})`;
    }
    // -------------------------------------------

    const docRef = await db.collection('parcels').add(newBooking);

    // ── Write dedicated tracking record ──────────────────────────────
    const upperTrackingId = trackingId.toUpperCase();
    await db.collection('trackingNumbers').doc(upperTrackingId).set({
      trackingId: upperTrackingId,
      parcelDocId: docRef.id,
      userId,
      shipperName:   req.body.shipperName   || 'N/A',
      shipperPhone:  req.body.shipperPhone  || 'N/A',
      shipperAddress: req.body.shipperAddress || 'N/A',
      shipperCity:   city,
      receiverName,
      receiverPhone,
      receiverAddress,
      vehicleType:   vehicleType || 'car',
      serviceCode:   upperTrackingId.split('-')[0],
      shipperCode:   upperTrackingId.split('-')[1],
      sequenceNo:    upperTrackingId.split('-')[2],
      status:        newBooking.status,
      statusHistory: [
        { status: 'Booking Confirmed', timestamp: new Date().toISOString(), note: 'Parcel booked by shipper' }
      ],
      currentLocation: city,
      estimatedDelivery: etaData ? `${Math.round(etaData.prediction)} ${etaData.unit}` : null,
      suggestedDriver: suggestedDriverId,
      assignedDriver: null,
      assignedHub: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (assignedDriverNote) {
      await db.collection('trackingNumbers').doc(upperTrackingId).update({
        statusHistory: admin.firestore.FieldValue.arrayUnion({
           status: 'Pending Acceptance', timestamp: new Date().toISOString(), note: assignedDriverNote
        })
      });
    }

    // ── Update shippingLedger (Detailed permanent log) ───────────────────
    const parcelsToSum = req.body.parcels || [];
    const totalWeight = parcelsToSum.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0);
    const totalPrice  = parcelsToSum.reduce((sum, p) => sum + (Number(p.unitPrice) || 0), 0);
    
    await db.collection('shippingLedger').add({
      trackingId: upperTrackingId,
      userId,
      receiverName,
      receiverPhone: req.body.receiverPhone || 'N/A',
      receiverAddress: req.body.receiverAddress || 'N/A',
      city,
      vehicleType: req.body.vehicleType || 'car',
      totalWeight,
      totalPrice,
      parcelCount: parcels.length,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Booking created successfully',
      trackingId,
      booking: { id: docRef.id, ...newBooking }
    });

    // ── Targeted Dispatch ──────────────────────────────────────────
    const io = req.app.get('io');
    if (io) {
      if (assigned) {
        // TARGETED NOTIFICATION (Socket.io)
        io.to(assigned.driverId).emit('newRideRequest', {
          id: docRef.id,
          shipperId: userId,
          shipperName: req.body.shipperName,
          pickupAddress: req.body.shipperAddress,
          deliveryAddress: receiverAddress,
          vehicleType,
          totalBill: totalPrice,
          parcels,
          isSuggested: true
        });
        console.log(`[DISPATCH] Targeted AI request sent to driver: ${assigned.driverId}`);
      } else {
        // Fallback: Notify all drivers if AI assignment fails
        io.to('drivers').emit('newRideRequest', {
          id: docRef.id,
          shipperId: userId,
          shipperName: req.body.shipperName,
          pickupAddress: req.body.shipperAddress,
          deliveryAddress: receiverAddress,
          vehicleType,
          totalBill: totalPrice,
          parcels
        });
        console.log('[DISPATCH] AI Assignment returned no specific driver; broadcasting to all.');
      }
    }

  } catch (err) {
    console.error('Parcel Creation Error:', err);
    res.status(500).json({ error: 'Failed to create booking. Database connection issue.' });
  }
});

/**
 * @route   POST /api/parcels/brand-create
 * @desc    Create a new parcel booking tagged as 'brand' and store in brandShippingLedger
 */
router.post('/brand-create', async (req, res) => {
  const { 
    userId, receiverName, receiverPhone, receiverAddress, city, vehicleType, parcels 
  } = req.body;

  if (!userId || !receiverName || !receiverPhone || !receiverAddress || !city || !parcels) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const trackingId = await generateTrackingId(userId, vehicleType);

    const newBooking = {
      userId,
      trackingId,
      receiverName,
      receiverPhone,
      receiverAddress,
      shipperName:    req.body.shipperName   || 'N/A',
      shipperPhone:   req.body.shipperPhone  || 'N/A',
      shipperAddress: req.body.shipperAddress || 'N/A',
      city,
      vehicleType: vehicleType || 'car',
      source: 'brand', // Explicitly tag as brand for driver sorting or filtering if needed
      status: 'pending',
      driverId: null,
      shipperLat: Number(req.body.shipperLat) || null,
      shipperLng: Number(req.body.shipperLng) || null,
      receiverLat: Number(req.body.receiverLat) || null,
      receiverLng: Number(req.body.receiverLng) || null,
      parcels: parcels.map(p => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        description: p.description,
        paymentMethod: p.paymentMethod || 'COD',
        codAmount: Number(p.codAmount) || 0,
        weight: Number(p.weight) || 0,
        length: Number(p.length) || 0,
        width: Number(p.width) || 0,
        height: Number(p.height) || 0,
        unitPrice: Number(p.unitPrice) || 0,
      })),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const cityKey    = (city || '').toLowerCase().trim();
    const cityCoords = CITY_COORDS[cityKey] || CITY_COORDS.karachi;

    const etaData = await predictETA({ 
      city, 
      vehicleType, 
      parcels,
      pickup_lat: req.body.shipperLat || cityCoords.lat,
      pickup_lng: req.body.shipperLng || cityCoords.lng,
      dropoff_lat: req.body.receiverLat || cityCoords.lat,
      dropoff_lng: req.body.receiverLng || cityCoords.lng
    });
    if (etaData) {
      newBooking.estimatedDelivery = etaData.prediction;
      newBooking.etaUnit = etaData.unit;
      newBooking.etaCalculatedAt = etaData.timestamp;
    }

    // --- AI DRIVER ASSIGNMENT (ML Pipeline) ---
    let suggestedDriverId   = null;
    let assignedDriverNote  = null;
    const assignedBrand = await autoAssignDriver(city, vehicleType, parcels);
    if (assignedBrand) {
      suggestedDriverId          = assignedBrand.driverId;
      newBooking.suggestedDriverId = suggestedDriverId;
      assignedDriverNote        = `AI recommended: ${assignedBrand.driverName} (score=${assignedBrand.score})`;
    }
    // -------------------------------------------

    const docRef = await db.collection('parcels').add(newBooking);

    const upperTrackingId = trackingId.toUpperCase();
    await db.collection('trackingNumbers').doc(upperTrackingId).set({
      trackingId: upperTrackingId,
      parcelDocId: docRef.id,
      userId,
      shipperName:   req.body.shipperName   || 'N/A',
      shipperPhone:  req.body.shipperPhone  || 'N/A',
      shipperAddress: req.body.shipperAddress || 'N/A',
      shipperCity:   city,
      receiverName,
      receiverPhone,
      receiverAddress,
      vehicleType:   vehicleType || 'car',
      source:        'brand',
      serviceCode:   upperTrackingId.split('-')[0],
      shipperCode:   upperTrackingId.split('-')[1],
      sequenceNo:    upperTrackingId.split('-')[2],
      status:        newBooking.status,
      statusHistory: [
        { status: 'Booking Confirmed', timestamp: new Date().toISOString(), note: 'Parcel booked by brand' }
      ],
      currentLocation: city,
      estimatedDelivery: etaData ? `${Math.round(etaData.prediction)} ${etaData.unit}` : null,
      suggestedDriver: suggestedDriverId,
      assignedDriver: null,
      assignedHub: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (assignedDriverNote) {
      await db.collection('trackingNumbers').doc(upperTrackingId).update({
        statusHistory: admin.firestore.FieldValue.arrayUnion({
           status: 'Assigned', timestamp: new Date().toISOString(), note: assignedDriverNote
        })
      });
    }

    const parcelsToSum = req.body.parcels || [];
    const totalWeight = parcelsToSum.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0);
    const totalPrice  = parcelsToSum.reduce((sum, p) => sum + (Number(p.unitPrice) || 0), 0);
    
    // Write ONLY to brandShippingLedger
    await db.collection('brandShippingLedger').add({
      trackingId: upperTrackingId,
      userId,
      receiverName,
      receiverPhone: req.body.receiverPhone || 'N/A',
      receiverAddress: req.body.receiverAddress || 'N/A',
      city,
      vehicleType: req.body.vehicleType || 'car',
      totalWeight,
      totalPrice,
      parcelCount: parcels.length,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Brand Booking created successfully',
      trackingId,
      booking: { id: docRef.id, ...newBooking }
    });

    // ── Targeted Dispatch ──────────────────────────────────────────
    const io = req.app.get('io');
    if (io) {
      if (assignedBrand) {
        // TARGETED NOTIFICATION (Socket.io)
        io.to(assignedBrand.driverId).emit('newRideRequest', {
          id: docRef.id,
          shipperId: userId,
          shipperName: req.body.shipperName,
          pickupAddress: req.body.shipperAddress,
          deliveryAddress: receiverAddress,
          vehicleType,
          totalBill: totalPrice,
          parcels,
          isSuggested: true
        });
        console.log(`[DISPATCH] Targeted AI request sent to BRAND driver: ${assignedBrand.driverId}`);
      } else {
        // Fallback: Notify all drivers if AI assignment fails
        io.to('drivers').emit('newRideRequest', {
          id: docRef.id,
          shipperId: userId,
          shipperName: req.body.shipperName,
          pickupAddress: req.body.shipperAddress,
          deliveryAddress: receiverAddress,
          vehicleType,
          totalBill: totalPrice,
          parcels
        });
        console.log('[DISPATCH] Brand AI Assignment failed; broadcasting to all.');
      }
    }

  } catch (err) {
    console.error('Brand Parcel Creation Error:', err);
    res.status(500).json({ error: 'Failed to create brand booking.' });
  }
});

/**
 * @route   GET /api/parcels/user/:userId
 * @desc    Get all parcel bookings for a specific shipper
 */
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const snapshot = await db.collection('parcels')
      .where('userId', '==', userId)
      // .orderBy('createdAt', 'desc') // Requires composite index
      .get();

    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    // In-memory sort by createdAt descending to maintain behavior
    bookings.sort((a, b) => {
      const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
      const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
      return timeB - timeA;
    });

    res.status(200).json(bookings);

  } catch (err) {
    console.error('Fetch User Bookings Error:', err);
    res.status(500).json({ error: 'Failed to fetch user bookings.' });
  }
});

/**
 * @route   GET /api/parcels/pending
 * @desc    Get all pending parcel bookings
 */
router.get('/pending', async (req, res) => {
  try {
    const snapshot = await db.collection('parcels')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(bookings);
  } catch (err) {
    console.error('Fetch Pending Bookings Error:', err);
    // Fallback if index not ready
    try {
      const snapshot = await db.collection('parcels').where('status', '==', 'pending').get();
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.status(200).json(bookings);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch pending bookings.' });
    }
  }
});

/**
 * @route   GET /api/parcels/driver/:driverId
 * @desc    Get all parcels assigned to a specific driver
 */
router.get('/driver/:driverId', async (req, res) => {
  const { driverId } = req.params;

  try {
    const snapshot = await db.collection('parcels')
      .where('driverId', '==', driverId)
      .get();

    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(bookings);
  } catch (err) {
    console.error('Fetch Driver Parcels Error:', err);
    res.status(500).json({ error: 'Failed to fetch driver parcels.' });
  }
});

/**
 * @route   GET /api/parcels/track/:trackingId
 * @desc    Public tracking lookup — returns parcel status, history, and location
 */
router.get('/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params;

  if (!trackingId || trackingId.length < 5) {
    return res.status(400).json({ error: 'Invalid tracking ID provided.' });
  }

  try {
    // Primary: check dedicated trackingNumbers collection
    const trackDoc = await db.collection('trackingNumbers').doc(trackingId.toUpperCase()).get();

    if (trackDoc.exists) {
      const data = trackDoc.data();
      return res.status(200).json({
        found: true,
        trackingId: data.trackingId,
        status: data.status || 'unknown',
        currentLocation: data.currentLocation || 'N/A',
        estimatedDelivery: data.estimatedDelivery || null,
        assignedDriver: data.assignedDriver || null,
        assignedHub: data.assignedHub || null,
        statusHistory: data.statusHistory || [],
        shipper: {
          name: data.shipperName,
          phone: data.shipperPhone,
          city: data.shipperCity,
        },
        receiver: {
          name: data.receiverName,
          phone: data.receiverPhone,
          address: data.receiverAddress,
        },
        vehicleType: data.vehicleType,
        serviceCode: data.serviceCode,
        createdAt: data.createdAt,
        predictedDelay: data.predictedDelay || null
      });
    }

    // Fallback: search parcels collection by trackingId field
    const snapshot = await db.collection('parcels')
      .where('trackingId', '==', trackingId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      return res.status(200).json({
        found: true,
        trackingId: data.trackingId,
        status: data.status || 'pending',
        currentLocation: data.city || 'N/A',
        estimatedDelivery: null,
        assignedDriver: data.driverId || null,
        assignedHub: null,
        statusHistory: [{ status: 'Booking Confirmed', timestamp: data.createdAt, note: 'Parcel booked' }],
        receiver: {
          name: data.receiverName,
          phone: data.receiverPhone,
          address: data.receiverAddress,
        },
        vehicleType: data.vehicleType,
      });
    }

    return res.status(404).json({ found: false, error: 'Tracking ID not found. Please verify and try again.' });

  } catch (err) {
    console.error('Tracking Lookup Error:', err);
    res.status(500).json({ error: 'Failed to look up tracking ID.' });
  }
});

/**
 * @route   GET /api/parcels/ledger/:userId
 * @desc    Get simplified shipping ledger for a specific shipper
 */
router.get('/ledger/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const snapshot = await db.collection('shippingLedger')
      .where('userId', '==', userId)
      // .orderBy('createdAt', 'desc') // Requires composite index
      .limit(50)
      .get();

    const ledger = [];
    snapshot.forEach(doc => {
      ledger.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(ledger);
  } catch (err) {
    console.error('Fetch Shipping Ledger Error:', err);
    res.status(500).json({ error: 'Failed to fetch shipping ledger.' });
  }
});

/**
 * @route   GET /api/parcels/brand-ledger/:userId
 * @desc    Get Brand shipping ledger (exclusive to brand dashboard)
 */
router.get('/brand-ledger/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const snapshot = await db.collection('brandShippingLedger')
      .where('userId', '==', userId)
      .limit(50)
      .get();

    const ledger = [];
    snapshot.forEach(doc => {
      ledger.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(ledger);
  } catch (err) {
    console.error('Fetch Brand Ledger Error:', err);
    res.status(500).json({ error: 'Failed to fetch brand ledger.' });
  }
});

/**
 * @route   GET /api/parcels/assigned/:userId
 */
router.get('/assigned/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const snap = await db.collection('assignedBookings')
      .where('userId', '==', userId)
      // .orderBy('actionTimestamp', 'desc') // Requires composite index
      .get();
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching assigned bookings:', err);
    res.status(500).json({ error: err.message }); 
  }
});

/**
 * @route   GET /api/parcels/completed/:userId
 */
router.get('/completed/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const snap = await db.collection('completedBookings')
      .where('userId', '==', userId)
      // .orderBy('actionTimestamp', 'desc') // Requires composite index
      .get();
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching completed bookings:', err);
    res.status(500).json({ error: err.message }); 
  }
});

/**
 * @route   GET /api/parcels/delayed/:userId
 */
router.get('/delayed/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const snap = await db.collection('delayedBookings')
      .where('userId', '==', userId)
      // .orderBy('actionTimestamp', 'desc') // Requires composite index
      .get();
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching delayed bookings:', err);
    res.status(500).json({ error: err.message }); 
  }
});

/**
 * @route   POST /api/parcels/assign-driver
 * @desc    Manually trigger AI driver assignment for an existing parcel.
 *          Called by the "Assign Driver" button in any dashboard.
 * @body    { parcelId: string, lat?: number, lng?: number }
 */
router.post('/assign-driver', async (req, res) => {
  const { parcelId, lat, lng } = req.body;

  if (!parcelId) {
    return res.status(400).json({ success: false, error: 'parcelId is required.' });
  }

  try {
    // 1. Fetch the parcel document
    const parcelRef = db.collection('parcels').doc(parcelId);
    const parcelDoc = await parcelRef.get();

    if (!parcelDoc.exists) {
      return res.status(404).json({ success: false, error: 'Parcel not found.' });
    }

    const parcel = parcelDoc.data();

    // 2. Run AI assignment via shared helper
    const assigned = await autoAssignDriver(
      parcel.city,
      parcel.vehicleType,
      parcel.parcels || [],
      lat,
      lng
    );

    if (!assigned) {
      return res.status(422).json({
        success: false,
        error  : 'AI pipeline could not assign a driver. Check Flask server and driver availability.'
      });
    }

    // 3. Update Firestore parcel record
    await parcelRef.update({
      driverId  : assigned.driverId,
      status    : 'assigned',
      updatedAt : admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. TARGETED NOTIFICATION (Socket.io)
    const io = req.app.get('io');
    if (io) {
      io.to(assigned.driverId).emit('newRideRequest', {
        id           : parcelId,
        shipperId    : parcel.userId,
        shipperName  : parcel.shipperName,
        pickupAddress: parcel.shipperAddress,
        deliveryAddress: parcel.receiverAddress,
        vehicleType  : parcel.vehicleType,
        totalBill    : parcel.totalBill || (parcel.parcels || []).reduce((s, p) => s + (Number(p.unitPrice) || 0), 0),
        parcels      : parcel.parcels,
        isSuggested  : true
      });
      console.log(`[DISPATCH] Manual AI Assignment: Targeted request sent to driver: ${assigned.driverId}`);
    }

    return res.status(200).json({
      success        : true,
      parcelId,
      assigned_driver: {
        id   : assigned.driverId,
        name : assigned.driverName,
        score: assigned.score,
      },
      message: `Driver ${assigned.driverName} assigned successfully via AI pipeline.`,
    });

  } catch (err) {
    console.error('[/assign-driver] Error:', err);
    res.status(500).json({ success: false, error: 'Server error during driver assignment.' });
  }
});

module.exports = router;
