const express = require('express');
const router  = express.Router();
const { db, admin } = require('./firebase-config');

// Flask ML backend URL
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';

/**
 * autoAssignDriverHubPartner
 * --------------------------
 * Calls the Flask ML pipeline to find the best driver for a generated parcel.
 * Returns { driverId, driverName, score } or null if unavailable.
 */
async function autoAssignDriverHubPartner(vehicleType, orderLat, orderLng) {
  try {
    const driversSnap = await db.collection('drivers').get();
    if (driversSnap.empty) return null;

    const driversList = driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const orderPayload = {
      lat        : orderLat  || 24.8607,
      lng        : orderLng  || 67.0011,
      vehicleType: vehicleType || 'bike',
    };

    const flaskRes = await fetch(`${FLASK_URL}/assign_driver`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ order: orderPayload, drivers: driversList }),
    });

    if (!flaskRes.ok) return null;

    const data = await flaskRes.json();
    if (data.success && data.assigned_driver) {
      const d = data.assigned_driver;
      console.log(`[hubpartner/assign] Driver: ${d.name || d.id} (score=${d.score})`);
      return { driverId: d.id, driverName: d.name || d.id, score: d.score };
    }
    return null;
  } catch (err) {
    console.warn('[hubpartner/assign] ML pipeline error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 1. Save/Update Hub Partner Profile Details
// ─────────────────────────────────────────────
router.post('/profile', async (req, res) => {
  const { partnerId, businessName, location, capacity, status } = req.body;
  if (!partnerId) return res.status(400).json({ error: 'Partner ID is required.' });

  try {
    const partnerRef = db.collection('hubpartners').doc(partnerId);
    const updatedData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (businessName) updatedData.businessName = businessName;
    if (location)     updatedData.location     = location;
    if (capacity)     updatedData.capacity      = capacity;
    if (status)       updatedData.status        = status;

    await partnerRef.set(updatedData, { merge: true });
    res.status(200).json({ message: 'Partner profile updated successfully', partnerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update Partner Profile' });
  }
});

// ─────────────────────────────────────────────
// 2. Fetch Partner Dashboard Statistics
// ─────────────────────────────────────────────
router.get('/stats/:partnerId', async (req, res) => {
  const { partnerId } = req.params;
  try {
    // Count real products
    const productsSnap = await db.collection('ecommerce_products')
      .where('partnerId', '==', partnerId)
      .get();
    const totalProducts = productsSnap.size;

    // Count real orders
    const ordersSnap = await db.collection('ecommerce_orders')
      .where('partnerId', '==', partnerId)
      .get();
    const totalOrders = ordersSnap.size;

    // Calculate revenue from delivered orders
    let totalRevenue = 0;
    ordersSnap.forEach(d => {
      const o = d.data();
      if (o.status === 'delivered') totalRevenue += Number(o.amount || 0);
    });

    const stats = {
      totalRevenue: `Rs. ${totalRevenue.toLocaleString()}`,
      parcelsProcessed: totalOrders,
      activeDrivers: 12,
      hubCapacityUsed: '78%',
      totalProducts,
      totalOrders,
      activeListings: productsSnap.docs.filter(d => d.data().status === 'active').length,
    };

    res.status(200).json({ message: 'Statistics fetched', stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hubpartner stats' });
  }
});

// ─────────────────────────────────────────────
// 3. Create Hub Store
// ─────────────────────────────────────────────
router.post('/store', async (req, res) => {
  const { partnerId, storeName, currency, themeColor } = req.body;
  if (!partnerId || !storeName)
    return res.status(400).json({ error: 'Partner ID and Store Name are required.' });

  try {
    const storeRef = db.collection('ecommerce_stores').doc(partnerId);
    const existing = await storeRef.get();

    const storeData = {
      partnerId,
      storeName,
      currency: currency || 'PKR',
      themeColor: themeColor || '#f97316',
      status: existing.exists ? (existing.data().status || 'active') : 'active',
      createdAt: existing.exists ? existing.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await storeRef.set(storeData, { merge: true });
    res.status(200).json({ message: 'Store saved successfully', store: storeData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save store settings' });
  }
});

// ─────────────────────────────────────────────
// 4. Get Store Profile
// ─────────────────────────────────────────────
router.get('/store/:partnerId', async (req, res) => {
  try {
    const storeRef = db.collection('ecommerce_stores').doc(req.params.partnerId);
    const storeDoc = await storeRef.get();
    if (storeDoc.exists) {
      res.status(200).json({ store: storeDoc.data() });
    } else {
      res.status(404).json({ error: 'Store not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

// ─────────────────────────────────────────────
// 4b. Toggle Store Status
// ─────────────────────────────────────────────
router.patch('/store/:partnerId/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required.' });

  try {
    const storeRef = db.collection('ecommerce_stores').doc(req.params.partnerId);
    await storeRef.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).json({ message: 'Store status updated', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update store status' });
  }
});

// ─────────────────────────────────────────────
// 5. Add new Product
// ─────────────────────────────────────────────
router.post('/products', async (req, res) => {
  const { partnerId, name, description, price, stock, imageUrl, category } = req.body;
  if (!partnerId || !name || !price)
    return res.status(400).json({ error: 'Partner ID, name, and price are required.' });

  try {
    const productsRef = db.collection('ecommerce_products');
    const newProduct = {
      partnerId,
      name,
      description: description || '',
      price: Number(price),
      stock: Number(stock) || 0,
      imageUrl: imageUrl || '',
      category: category || 'General',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await productsRef.add(newProduct);
    res.status(201).json({ message: 'Product added successfully', product: { id: docRef.id, ...newProduct } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ─────────────────────────────────────────────
// 6. Get all Products (Global Store)
// ─────────────────────────────────────────────
router.get('/products/all', async (req, res) => {
  try {
    const snap = await db.collection('ecommerce_products')
      .where('status', '==', 'active')
      .get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.status(200).json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get global products' });
  }
});

// ─────────────────────────────────────────────
// 6b. Get all Products for a Store
// ─────────────────────────────────────────────
router.get('/products/:partnerId', async (req, res) => {
  try {
    const snap = await db.collection('ecommerce_products')
      .where('partnerId', '==', req.params.partnerId)
      .get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.status(200).json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// ─────────────────────────────────────────────
// 7. Update Product
// ─────────────────────────────────────────────
router.put('/products/:productId', async (req, res) => {
  const { name, description, price, stock, imageUrl, category, status } = req.body;
  try {
    const productRef = db.collection('ecommerce_products').doc(req.params.productId);
    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name !== undefined)        updateData.name        = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined)       updateData.price       = Number(price);
    if (stock !== undefined)       updateData.stock       = Number(stock);
    if (imageUrl !== undefined)    updateData.imageUrl    = imageUrl;
    if (category !== undefined)    updateData.category    = category;
    if (status !== undefined)      updateData.status      = status;

    await productRef.update(updateData);
    res.status(200).json({ message: 'Product updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ─────────────────────────────────────────────
// 8. Delete Product
// ─────────────────────────────────────────────
router.delete('/products/:productId', async (req, res) => {
  try {
    await db.collection('ecommerce_products').doc(req.params.productId).delete();
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ─────────────────────────────────────────────
// 9. Get Orders for a Store
// ─────────────────────────────────────────────
router.get('/orders/:partnerId', async (req, res) => {
  try {
    const snap = await db.collection('ecommerce_orders')
      .where('partnerId', '==', req.params.partnerId)
      .get();
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort by createdAt descending in-memory
    orders.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    });

    res.status(200).json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ─────────────────────────────────────────────
// 10. Generate Parcel from Hub Partner Order
// ─────────────────────────────────────────────
router.post('/generate-parcel', async (req, res) => {
  const { orderId, partnerId, weight, type, vehicleType, lat, lng } = req.body;

  if (!orderId || !partnerId) {
    return res.status(400).json({ error: 'orderId and partnerId are required.' });
  }

  try {
    const orderRef  = db.collection('ecommerce_orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const orderData = orderSnap.data();

    // AI driver assignment
    const assigned = await autoAssignDriverHubPartner(
      vehicleType || 'bike',
      lat  || null,
      lng  || null
    );

    const parcelsRef = db.collection('parcels');

    // Create a new parcel document based on the order
    const newParcelData = {
      orderId,
      partnerId,
      customerName : orderData.customerName || 'Unknown Customer',
      amount       : orderData.amount || 0,
      weight       : weight || '1kg',
      type         : type   || 'Standard',
      vehicleType  : vehicleType || 'bike',
      source       : 'hubpartner',
      status       : assigned ? 'assigned' : 'pending_dispatch',
      driverId     : assigned ? assigned.driverId : null,
      origin       : 'Hub Store',
      destination  : orderData.address || 'Customer Address',
      createdAt    : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt    : admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await parcelsRef.add(newParcelData);

    // Update order status to indicate it's being shipped
    await orderRef.update({
      status    : 'shipped',
      parcelId  : docRef.id,
      driverId  : assigned ? assigned.driverId : null,
      updatedAt : admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify drivers via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const assignedDriverId = assigned ? assigned.driverId : null;
      if (assignedDriverId) {
        io.to(assignedDriverId).emit('newAssignedJob', {
          id: docRef.id,
          ...newParcelData,
          createdAt: new Date().toISOString()
        });
        console.log(`Emitted newAssignedJob to driver ${assignedDriverId}`);
      } else {
        io.to('drivers').emit('newRideRequest', {
          id: docRef.id,
          ...newParcelData,
          createdAt: new Date().toISOString()
        });
        console.log('Emitted newRideRequest to drivers');
      }
    }

    const responseMsg = assigned
      ? `Parcel generated and AI-assigned to driver ${assigned.driverName} (score=${assigned.score})`
      : 'Parcel generated. No driver available — parcel is pending dispatch.';

    res.status(201).json({
      message        : responseMsg,
      parcel         : { id: docRef.id, ...newParcelData },
      assigned_driver: assigned || null,
    });
  } catch (err) {
    console.error('[generate-parcel] Error:', err);
    res.status(500).json({ error: 'Failed to generate parcel' });
  }
});

module.exports = router;
