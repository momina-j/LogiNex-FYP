const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-config');
const { predictETA, predictDelay } = require('./services/etaService');
const { geohashForLocation } = require('geofire-common');
const bcrypt = require('bcrypt');

// --- DRIVER LOCATION TRACKING ---
router.post('/location/update', async (req, res) => {
  const { driverId, lat, lng } = req.body;

  if (!driverId || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'driverId, lat, and lng are required' });
  }

  try {
    const hash = geohashForLocation([parseFloat(lat), parseFloat(lng)]);
    const locationRef = db.collection('locations').doc(driverId);

    await locationRef.set({
      geohash: hash,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ALSO UPDATE THE PRIMARY DRIVER DOCUMENT FOR REAL-TIME TRACKING
    await db.collection('drivers').doc(driverId).set({
      currentLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Location Update Error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// --- DRIVER AUTHENTICATION (CUSTOM PHONE/PASSWORD) ---

// A. Driver Signup
router.post('/auth/signup', async (req, res) => {
  const { profileImage, fullName, email, phoneNumber, cnic, age, gender, city, address, password } = req.body;

  // Basic Validation
  if (!fullName || !phoneNumber || !password) {
    return res.status(400).json({ error: 'fullName, phoneNumber, and password are required' });
  }

  // Phone number validation (simple formatting check)
  const phoneRegex = /^\+?[0-9\s\-]{10,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  try {
    const usersRef = db.collection('users');

    // Prevent duplicate accounts
    const snapshot = await usersRef.where('phoneNumber', '==', phoneNumber).get();

    if (!snapshot.empty) {
      return res.status(400).json({ error: 'A user with this phone number already exists' });
    }

    // Hash the password securely
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the new driver record
    const newDriver = {
      profileImage: profileImage || null,
      fullName,
      email: email || null,
      phoneNumber,
      cnic: cnic || null,
      age: age ? parseInt(age, 10) : null,
      gender: gender || null,
      city: city || null,
      address: address || null,
      password: hashedPassword, // Store securely
      roles: ['driver'],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await usersRef.add(newDriver);

    res.status(201).json({
      message: 'Driver registration successful',
      user: {
        id: docRef.id,
        fullName: newDriver.fullName,
        phoneNumber: newDriver.phoneNumber,
        roles: newDriver.roles
      }
    });

  } catch (error) {
    console.error("Driver Custom Signup Error", error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// B. Driver Login
router.post('/auth/login', async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({ error: 'Phone number and password are required' });
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef
      .where('phoneNumber', '==', phoneNumber)
      .where('roles', 'array-contains', 'driver')
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials or driver not found' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Verify bcrypt hash
    const isValidPassword = await bcrypt.compare(password, userData.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userId = userDoc.id;

    // Check if the driver has completed vehicle setup
    const vehicleSnap = await db.collection('vehicles').where('userId', '==', userId).get();
    const hasVehicle = !vehicleSnap.empty;

    res.status(200).json({
      message: 'Login successful',
      hasVehicle,
      user: {
        id: userId,
        fullName: userData.fullName,
        phoneNumber: userData.phoneNumber,
        roles: userData.roles
      }
    });

  } catch (error) {
    console.error("Driver Custom Login Error", error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// C. Vehicle Setup (First Time)
router.post('/vehicle/setup', async (req, res) => {
  const { userId, vehicleNumber, vehicleType, vehicleModel } = req.body;

  if (!userId || !vehicleNumber || !vehicleType || !vehicleModel) {
    return res.status(400).json({ error: 'userId, vehicleNumber, vehicleType, and vehicleModel are required' });
  }

  try {
    const vehiclesRef = db.collection('vehicles');

    // Prevent duplicate setup for the same driver
    const snapshot = await vehiclesRef.where('userId', '==', userId).get();

    if (!snapshot.empty) {
      return res.status(400).json({ error: 'Vehicle information is already registered for this user' });
    }

    const newVehicle = {
      userId,
      vehicleNumber,
      vehicleType,
      vehicleModel,
      registeredAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await vehiclesRef.add(newVehicle);

    res.status(201).json({
      message: 'Vehicle setup complete',
      vehicle: { id: docRef.id, ...newVehicle }
    });

  } catch (error) {
    console.error("Vehicle Setup Error", error);
    res.status(500).json({ error: 'Failed to complete vehicle registration' });
  }
});

// --- EXISTING ENDPOINTS ---

router.post('/profile', async (req, res) => {
  const { driverId, name, vehicleType, pricePerKm, status, location } = req.body;

  if (!driverId) {
    return res.status(400).json({ error: 'Driver ID is required.' });
  }

  try {
    const driverRef = db.collection('drivers').doc(driverId);
    
    const updatedData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name) updatedData.name = name;
    if (vehicleType) updatedData.vehicleType = vehicleType;
    if (pricePerKm) updatedData.pricePerKm = pricePerKm;
    if (status) updatedData.status = status;
    if (location) updatedData.location = location;

    await driverRef.set(updatedData, { merge: true });

    res.status(200).json({
      message: 'Driver profile updated successfully',
      driverId
    });
  } catch (error) {
    console.error('Firestore Driver Error', error);
    res.status(500).json({ error: 'Failed to update driver profile' });
  }
});

// 2. Update Parcel Delivery Status
router.post('/update-status', async (req, res) => {
  const { driverId, parcelId, status, delayReason } = req.body;

  if (!driverId || !parcelId || !status) {
    return res.status(400).json({ error: 'Driver ID, parcel ID, and new status are required.' });
  }

  const validStatuses = ['in_transit', 'delivered', 'delayed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  if (status === 'delayed' && !delayReason) {
    return res.status(400).json({ error: 'Delay reason is required when status is delayed.' });
  }

  try {
    const parcelRef = db.collection('parcels').doc(parcelId);

    const updatePayload = { 
      status, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    };
    
    if (status === 'delayed') {
      updatePayload.delayReason = delayReason;
      
      // --- INTEGRATE ML DELAY PREDICTION ---
      try {
        const parcelDoc = await parcelRef.get();
        if (parcelDoc.exists) {
          const parcelData = parcelDoc.data();
          const delayData = await predictDelay({
            ...parcelData,
            distance: parcelData.distance || 12.5 // Use existing or mock
          });
          
          if (delayData) {
            updatePayload.predictedDelayMinutes = delayData.delayMinutes;
            updatePayload.etaUnit = delayData.unit;
            // Also update status history with the prediction
            updatePayload.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: 'delayed',
              timestamp: new Date().toISOString(),
              note: `Predicted delay: ${Math.round(delayData.delayMinutes)} mins. Reason: ${delayReason}`
            });
          }
        }
      } catch (mlErr) {
        console.warn('ML Delay Prediction failed, proceeding with manual update:', mlErr.message);
      }
      // -------------------------------------
    }

    await parcelRef.update(updatePayload);

    // --- SYNC DELAY WITH ACTIVE ROUTE ---
    try {
      if (status === 'delayed' && updatePayload.predictedDelayMinutes) {
        // Fetch driver's active route ID
        const driverDoc = await db.collection('drivers').doc(driverId).get();
        if (driverDoc.exists) {
          const driverData = driverDoc.data();
          if (driverData.currentRouteId) {
            await db.collection('routes').doc(driverData.currentRouteId).update({
              predictedDelayMinutes: updatePayload.predictedDelayMinutes,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Synced predicted delay (${updatePayload.predictedDelayMinutes}m) to route ${driverData.currentRouteId}`);
          }
        }
      }
    } catch (syncErr) {
      console.warn('Failed to sync delay to route:', syncErr.message);
    }
    // ------------------------------------

    // Update trackingNumbers collection as well
    const parcelData = (await parcelRef.get()).data();
    const trackingId = parcelData?.trackingId;
    if (trackingId) {
      const trackUpdate = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (status === 'delayed' && updatePayload.predictedDelayMinutes) {
        trackUpdate.predictedDelay = `${Math.round(updatePayload.predictedDelayMinutes)} mins`;
      }
      await db.collection('trackingNumbers').doc(trackingId).update(trackUpdate);
      
      const io = req.app.get('io');
      if (io && parcelData && parcelData.userId) {
        io.to(parcelData.userId).emit('statusUpdated', {
          parcelId,
          trackingId,
          status,
          note: status === 'delayed' ? delayReason : `Updated by driver`
        });
      }

      // --- PUSH TO STATUS-SPECIFIC COLLECTIONS (SHIpper Dashboard Log) ---
      try {
        const fullParcelData = (await parcelRef.get()).data();
        let collectionName = null;
        if (status === 'delivered') collectionName = 'completedBookings';
        else if (status === 'delayed') collectionName = 'delayedBookings';

        if (collectionName) {
          await db.collection(collectionName).add({
            ...fullParcelData,
            parcelId,
            status,
            updatedBy: 'driver',
            actionDriverId: driverId,
            actionTimestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Synced record to ${collectionName} for trackingId: ${trackingId}`);
        }
      } catch (logErr) {
        console.warn('Logging to status collection failed:', logErr.message);
      }
      // -------------------------------------------------------------------

      // --- INCREMENT DRIVER PERFORMANCE COUNTERS ---
      try {
        const performanceUpdate = {};
        if (status === 'delivered') performanceUpdate.completedDeliveries = admin.firestore.FieldValue.increment(1);
        if (status === 'delayed') performanceUpdate.delayedDeliveries = admin.firestore.FieldValue.increment(1);

        if (Object.keys(performanceUpdate).length > 0) {
          await db.collection('drivers').doc(driverId).set(performanceUpdate, { merge: true });
          console.log(`Updated performance counters for driver ${driverId} (Status: ${status})`);
        }
      } catch (perfErr) {
        console.warn('Driver performance update failed:', perfErr.message);
      }
      // ----------------------------------------------
    }

    res.status(200).json({
      message: 'Parcel status updated successfully',
      parcelId, 
      status,
      predictedDelay: updatePayload.predictedDelayMinutes || null
    });

  } catch (error) {
    console.error("Firestore Parcel Status Error", error);
    res.status(500).json({ error: 'Could not locate or update parcel in database.' });
  }
});

// 3. Accept/Decline Delivery Request
router.post('/respond-request', async (req, res) => {
  const { driverId, parcelId, response } = req.body; // response: 'accept' or 'decline'

  if (!driverId || !parcelId || !response) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    if (response === 'accept') {
      const parcelRef = db.collection('parcels').doc(parcelId);
      const parcelDoc = await parcelRef.get();
      const parcelData = parcelDoc.data();

      // --- RECALCULATE ETA ON ACCEPTANCE ---
      const etaData = await predictETA({
        ...parcelData,
        driverId
      });
      // -------------------------------------

      const updateData = {
        driverId,
        status: 'in_transit',
        acceptedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (etaData) {
        updateData.estimatedDelivery = etaData.prediction;
        updateData.etaUnit = etaData.unit;
      }

      await parcelRef.update(updateData);

      // Also update the trackingNumbers collection
      const trackingId = parcelData.trackingId;
      if (trackingId) {
        await db.collection('trackingNumbers').doc(trackingId).update({
          status: 'in_transit',
          assignedDriver: driverId,
          estimatedDelivery: etaData ? `${Math.round(etaData.prediction)} ${etaData.unit}` : 'Calculating...',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // --- PUSH TO ASSIGNED COLLECTIONS ---
      try {
        await db.collection('assignedBookings').add({
          ...parcelData,
          parcelId,
          driverId,
          status: 'assigned',
          actionTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Synced record to assignedBookings for trackingId: ${trackingId}`);

        const io = req.app.get('io');
        if (io && parcelData && parcelData.userId) {
          io.to(parcelData.userId).emit('rideAccepted', {
            parcelId,
            trackingId,
            driverId,
            status: 'assigned'
          });
        }
      } catch (logErr) {
        console.warn('Logging to assignedBookings failed:', logErr.message);
      }
      // -------------------------------------

      res.status(200).json({ message: 'Request accepted and ETA updated successfully.' });
    } else if (response === 'decline') {
      res.status(200).json({ message: 'Request declined.' });
    } else {
      res.status(400).json({ error: 'Response must be either "accept" or "decline".' });
    }
  } catch (error) {
    console.error("Firebase Request Response Error", error);
    res.status(500).json({ error: "Failed to respond to request" });
  }
});

// 4. Get all shipments assigned to a driver
router.get('/:driverId/shipments', async (req, res) => {
  const { driverId } = req.params;

  try {
    const snapshot = await db.collection('shipments').where('driverId', '==', driverId).get();

    const driverShipments = [];
    snapshot.forEach((doc) => {
      driverShipments.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(driverShipments);
  } catch (err) {
    console.error("Firestore Fetch Driver Shipments Error:", err);
    res.status(500).json({ error: 'Failed to fetch shipments for this driver' });
  }
});

// 5. Update Shipment Delivery Status
router.put('/shipments/:shipmentId/status', async (req, res) => {
  const { shipmentId } = req.params;
  const { status, delayReason } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  const validStatuses = ['assigned', 'picked_up', 'in_transit', 'delivered', 'delayed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const shipmentRef = db.collection('shipments').doc(shipmentId);
    
    const updatePayload = { 
      status, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    };
    
    if (status === 'delayed' && delayReason) {
      updatePayload.delayReason = delayReason;
    }

    await shipmentRef.update(updatePayload);

    res.status(200).json({
      message: 'Shipment status updated successfully',
      shipmentId, 
      status
    });

  } catch (error) {
    console.error("Firestore Shipment Status Update Error", error);
    res.status(500).json({ error: 'Could not update shipment status.' });
  }
});

module.exports = router;
