const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-config');

// 1. Get All Shipments
router.get('/shipments', async (req, res) => {
  try {
    const snapshot = await db.collection('shipments').get();
    const allShipments = [];
    
    snapshot.forEach((doc) => {
      allShipments.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(allShipments);
  } catch (err) {
    console.error("Firestore Admin Fetch Shipments Error:", err);
    res.status(500).json({ error: 'Failed to fetch all shipments' });
  }
});

// 2. Get All Active Drivers
router.get('/drivers', async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('roles', 'array-contains', 'driver')
      .get();

    const drivers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      drivers.push({
        id: doc.id,
        name: data.fullName || data.name,
        email: data.email,
        phone: data.phone,
        status: data.status,
      });
    });

    res.status(200).json(drivers);
  } catch (err) {
    console.error("Firestore Admin Fetch Drivers Error:", err);
    res.status(500).json({ error: 'Failed to fetch registered drivers' });
  }
});

// 3. Assign Driver to a Shipment
router.post('/shipments/:shipmentId/assign', async (req, res) => {
  const { shipmentId } = req.params;
  const { driverId } = req.body;

  if (!driverId) {
    return res.status(400).json({ error: 'driverId must be provided internally to assign.' });
  }

  try {
    const shipmentRef = db.collection('shipments').doc(shipmentId);
    
    await shipmentRef.update({
      driverId: driverId,
      status: 'assigned', // Status changed to assigned automatically
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Driver assigned to shipment successfully',
      shipmentId,
      driverId
    });

  } catch (error) {
    console.error("Firebase Admin Assignment Error", error);
    res.status(500).json({ error: "Failed to assign driver. Ensure shipment ID is valid." });
  }
});

module.exports = router;
