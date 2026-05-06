const express = require('express');
const router = express.Router();
const { db } = require('./firebase-config');

// ─────────────────────────────────────────────
// GET /api/shipper/profile/:shipperId
// ─────────────────────────────────────────────
router.get('/profile/:shipperId', async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.shipperId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Shipper not found' });
    res.status(200).json({ profile: snap.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch shipper profile' });
  }
});

// ─────────────────────────────────────────────
// POST /api/shipper/profile
// ─────────────────────────────────────────────
router.post('/profile', async (req, res) => {
  const { shipperId, ...updateData } = req.body;
  if (!shipperId) return res.status(400).json({ error: 'Shipper ID required' });
  try {
    await db.collection('users').doc(shipperId).set(
      { ...updateData, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    res.status(200).json({ message: 'Shipper profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update shipper profile' });
  }
});

// ─────────────────────────────────────────────
// GET /api/shipper/bookings/:shipperId
// ─────────────────────────────────────────────
router.get('/bookings/:shipperId', async (req, res) => {
  try {
    const snap = await db.collection('parcels')
      .where('shipperId', '==', req.params.shipperId)
      .get();
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.status(200).json({ bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ─────────────────────────────────────────────
// GET /api/shipper/stats/:shipperId
// ─────────────────────────────────────────────
router.get('/stats/:shipperId', async (req, res) => {
  try {
    const snap = await db.collection('parcels')
      .where('shipperId', '==', req.params.shipperId)
      .get();

    let totalSpent = 0;
    let delivered = 0;
    let inTransit = 0;

    snap.forEach(d => {
      const data = d.data();
      totalSpent += Number(data.price || 0);
      if (data.status === 'delivered') delivered++;
      if (data.status === 'in-transit' || data.status === 'in_transit') inTransit++;
    });

    res.status(200).json({
      stats: {
        totalParcels: snap.size,
        delivered,
        inTransit,
        totalSpent: `Rs. ${totalSpent.toLocaleString()}`,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch shipper stats' });
  }
});

module.exports = router;
