const express = require('express');
const router = express.Router();
const { collection, getDocs, query, where, doc, getDoc } = require('firebase/firestore');
const { db } = require('./firebase-config');

/**
 * @route   GET /api/shipments/track/:trackingId
 * @desc    Track a shipment by its tracking ID
 */
router.get('/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params;

  if (!trackingId) {
    return res.status(400).json({ error: 'Tracking ID is required' });
  }

  try {
    const q = query(collection(db, 'shipments'), where('trackingId', '==', trackingId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = querySnapshot.docs[0].data();
    res.status(200).json({ id: querySnapshot.docs[0].id, ...shipment });
  } catch (error) {
    console.error("Tracking Shipment Error:", error);
    res.status(500).json({ error: 'Failed to fetch shipment details' });
  }
});

/**
 * @route   GET /api/shipments/:id
 * @desc    Get shipment details by document ID
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const docRef = doc(db, 'shipments', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.status(200).json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    console.error("Fetch Shipment Error:", error);
    res.status(500).json({ error: 'Failed to fetch shipment details' });
  }
});

module.exports = router;
