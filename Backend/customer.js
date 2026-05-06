const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-config');

// 1. Create New Shipment
router.post('/shipment', async (req, res) => {
  const { customerId, senderName, receiverName, pickupLocation, deliveryLocation } = req.body;

  if (!customerId || !senderName || !receiverName || !pickupLocation || !deliveryLocation) {
    return res.status(400).json({ error: 'customerId, senderName, receiverName, pickupLocation, and deliveryLocation are required parameters' });
  }

  try {
    // Generate a simple alphanumeric tracking ID
    const trackingId = `LOGI-${Math.floor(100000 + Math.random() * 900000)}`;

    const newShipment = {
      trackingId,
      customerId,
      senderName,
      receiverName,
      pickupLocation,
      deliveryLocation,
      status: 'pending', // default starting status
      driverId: null, // to be assigned by admin
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('shipments').add(newShipment);

    res.status(201).json({
      message: 'Shipment created successfully',
      shipment: { id: docRef.id, ...newShipment }
    });
  } catch (error) {
    console.error("Firestore Shipment Creation Error:", error);
    res.status(500).json({ error: 'Failed to create shipment order' });
  }
});

// 2. Get All Shipments for a Customer
router.get('/:customerId/shipments', async (req, res) => {
  const { customerId } = req.params;

  try {
    const snapshot = await db.collection('shipments')
      .where('customerId', '==', customerId)
      .get();

    const customerShipments = [];
    snapshot.forEach((doc) => {
      customerShipments.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(customerShipments);
  } catch (err) {
    console.error("Firestore Fetch Customer Shipments Error:", err);
    res.status(500).json({ error: 'Failed to fetch shipments for this customer' });
  }
});

module.exports = router;
