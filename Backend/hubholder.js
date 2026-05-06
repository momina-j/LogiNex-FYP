const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-config');

// 0. Fetch Hub Holder Profile
router.get('/profile/:id', async (req, res) => {
  try {
    const doc = await db.collection('hubholders').doc(req.params.id).get();
    if (!doc.exists) {
      // Default initialization
      return res.status(200).json({
        hubId: req.params.id,
        name: 'New Hub',
        type: 'Warehouse',
        location: '',
        storageTotal: 100, // Default limit
        storageUsed: 0,
        status: 'Active',
        acceptingParcels: true
      });
    }
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hub profile' });
  }
});

// 1. Save/Update Hub Holder Profile & Details
router.post('/profile', async (req, res) => {
  const { hubId, name, type, location, storageTotal, storageUsed, status } = req.body;

  if (!hubId) {
    return res.status(400).json({ error: 'Hub ID is required.' });
  }

  try {
    const hubRef = db.collection('hubholders').doc(hubId);
    const updatedData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    
    if (name) updatedData.name = name;
    if (type) updatedData.type = type;
    if (location) updatedData.location = location;
    if (storageTotal !== undefined) updatedData.storageTotal = Number(storageTotal);
    if (storageUsed !== undefined) updatedData.storageUsed = Number(storageUsed);
    if (status) updatedData.status = status;
    if (req.body.acceptingParcels !== undefined) updatedData.acceptingParcels = req.body.acceptingParcels;

    // Auto-check limit if manually adjusting
    if (updatedData.storageTotal !== undefined && updatedData.storageUsed !== undefined) {
      if (updatedData.storageUsed >= updatedData.storageTotal) {
        updatedData.acceptingParcels = false;
        updatedData.status = 'FULL';
      }
    }

    await hubRef.set(updatedData, { merge: true });

    res.status(200).json({
      message: 'Hub profile updated successfully inside Firestore',
      hubId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update Hub profile' });
  }
});

// 2. Receive incoming batch scans
router.post('/scan-batch', async (req, res) => {
  const { hubId, trackingId } = req.body;

  if (!hubId) return res.status(400).json({ error: 'Hub ID is required.' });
  if (!trackingId) return res.status(400).json({ error: 'Tracking ID is required.' });

  try {
    const hubRef = db.collection('hubholders').doc(hubId);
    const hubDoc = await hubRef.get();
    
    let storageTotal = 100;
    let storageUsed = 0;
    if (hubDoc.exists) {
      const data = hubDoc.data();
      storageTotal = data.storageTotal || 100;
      storageUsed = data.storageUsed || 0;
      if (data.acceptingParcels === false) {
        return res.status(403).json({ error: 'Hub is currently NOT ACCEPTING parcels. Auto-routing to another Hub.' });
      }
    }

    if (storageUsed >= storageTotal) {
      return res.status(403).json({ error: 'Hub capacity exceeded. Cannot accept incoming batch. Wait for rider pickups or re-route.' });
    }

    const scannedBatch = {
      trackingId,
      hubId,
      scannedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'received_at_hub'
    };

    // Save batch scan action to firestore
    const docRef = await db.collection('scannedBatches').add(scannedBatch);

    // Update hub holder storage incrementally inside Firebase!
    // Auto-lock if this package fills it up
    const newStorageUsed = storageUsed + 1;
    const isNowFull = newStorageUsed >= storageTotal;
    
    const updatePayload = { storageUsed: admin.firestore.FieldValue.increment(1) };
    if (isNowFull) {
      updatePayload.acceptingParcels = false;
      updatePayload.status = 'FULL';
    }
    
    await hubRef.set(updatePayload, { merge: true });

    res.status(200).json({
      message: `Batch ${trackingId} successfully received and scanned across Firestore.`,
      batchId: docRef.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to scan batch into Firebase" });
  }
});

// 3. AI Allocation & Assign to Rider
router.post('/assign-rider', async (req, res) => {
  const { hubId, riderId, zone, parcelIds } = req.body;

  if (!hubId || !riderId || !zone || !parcelIds || !Array.isArray(parcelIds)) {
    return res.status(400).json({ error: 'Invalid payload. Requires hubId, riderId, zone, and an array of parcelIds.' });
  }

  try {
    // In a real execution, we would iterate over parcelIds to update them to the new rider...
    const batch = db.batch();
    for (const pId of parcelIds) {
      if (pId !== 'p_mock_id') {
        const parcelRef = db.collection('parcels').doc(pId);
        batch.update(parcelRef, { assignedDriver: riderId, zone, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }

    // Decrement storage since parcels are assigned
    const hubRef = db.collection('hubholders').doc(hubId);
    batch.set(hubRef, { storageUsed: admin.firestore.FieldValue.increment(-parcelIds.length) }, { merge: true });

    await batch.commit();

    res.status(200).json({
      message: `Assigned ${parcelIds.length} parcels for zone ${zone} to rider ${riderId} effectively overriding Firebase tables.`,
      assignedItemsCount: parcelIds.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign riders inside database" });
  }
});

module.exports = router;
