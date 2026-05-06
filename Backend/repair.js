const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'hubpartner.js');
let content = fs.readFileSync(filepath, 'utf8');

const prefixMatch = content.match(/res\.status\(500\)\.json\(\{ error: 'Failed to delete product' \}\);\s*\}\s*\}\);/);
if (!prefixMatch) {
  console.error("Could not find split point");
  process.exit(1);
}

const idx = prefixMatch.index;
const splitPointLength = prefixMatch[0].length;
const prefix = content.substring(0, idx + splitPointLength) + '\n\n';

const suffix = `// ─────────────────────────────────────────────
// 9. Get Orders for a Store
// ─────────────────────────────────────────────
router.get('/orders/:partnerId', async (req, res) => {
  try {
    const snap = await db.collection('ecommerce_orders')
      .where('partnerId', '==', req.params.partnerId)
      .get();
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Sort by createdAt desc in-memory if it's a mix of string/timestamp or just for safety
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
// 10. Update Order Status
// ─────────────────────────────────────────────
router.patch('/orders/:orderId/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status required.' });

  try {
    const orderRef = db.collection('ecommerce_orders').doc(req.params.orderId);
    await orderRef.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).json({ message: 'Order status updated', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ─────────────────────────────────────────────
// 11. Create a test order (seed for demo)
// ─────────────────────────────────────────────
router.post('/orders', async (req, res) => {
  const { partnerId, customerName, amount, status, items } = req.body;
  if (!partnerId || !customerName || !amount)
    return res.status(400).json({ error: 'partnerId, customerName, amount required.' });

  try {
    const ordersRef = db.collection('ecommerce_orders');
    const newOrder = {
      partnerId,
      customerName,
      amount: Number(amount),
      status: status || 'pending',
      items: items || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await ordersRef.add(newOrder);
    res.status(201).json({ message: 'Order created', order: { id: ref.id, ...newOrder } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ─────────────────────────────────────────────
// 12. Save Pricing / Discount / Shipping Settings
// ─────────────────────────────────────────────
router.post('/pricing', async (req, res) => {
  const { partnerId, discount, taxRate, shippingCharge, bulkThreshold, bulkDiscount } = req.body;
  if (!partnerId) return res.status(400).json({ error: 'Partner ID required.' });

  try {
    const pricingRef = db.collection('ecommerce_pricing').doc(partnerId);
    const pricingData = {
      partnerId,
      discount: Number(discount) || 0,
      taxRate: Number(taxRate) || 0,
      shippingCharge: Number(shippingCharge) || 0,
      bulkThreshold: Number(bulkThreshold) || 0,
      bulkDiscount: Number(bulkDiscount) || 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await pricingRef.set(pricingData, { merge: true });
    res.status(200).json({ message: 'Pricing settings saved', pricing: pricingData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save pricing' });
  }
});

// ─────────────────────────────────────────────
// 13. Get Pricing Settings
// ─────────────────────────────────────────────
router.get('/pricing/:partnerId', async (req, res) => {
  try {
    const pricingRef = db.collection('ecommerce_pricing').doc(req.params.partnerId);
    const snap = await pricingRef.get();
    if (snap.exists) {
      res.status(200).json({ pricing: snap.data() });
    } else {
      res.status(200).json({
        pricing: { discount: 0, taxRate: 0, shippingCharge: 150, bulkThreshold: 5, bulkDiscount: 10 }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// ─────────────────────────────────────────────
// 14. Quick Analytics
// ─────────────────────────────────────────────
router.get('/analytics/:partnerId', async (req, res) => {
  try {
    const ordersSnap = await db.collection('ecommerce_orders')
      .where('partnerId', '==', req.params.partnerId)
      .get();

    // Build 7-day revenue chart data
    const now = new Date();
    const revenueByDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { weekday: 'short' });
      revenueByDay[key] = 0;
    }

    let totalRevenue = 0;
    const productSalesMap = {}; // { productId: { name, count, totalRevenue } }

    ordersSnap.forEach(d => {
      const o = d.data();
      const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      
      // Calculate revenue by day for the chart (last 7 days)
      const diffMs = now - orderDate;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      if (diffDays >= 0 && diffDays < 7) {
        const key = orderDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (revenueByDay[key] !== undefined) {
          revenueByDay[key] += Number(o.amount || 0);
        }
      }
      
      if (o.status === 'delivered') {
        totalRevenue += Number(o.amount || 0);
      }

      // Track product popularity
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          const pid = item.productId || item.id;
          if (pid) {
            if (!productSalesMap[pid]) {
              productSalesMap[pid] = { name: item.name || 'Unknown Product', count: 0, revenue: 0 };
            }
            productSalesMap[pid].count += Number(item.quantity || 1);
            productSalesMap[pid].revenue += Number(item.price || 0) * Number(item.quantity || 1);
          }
        });
      }
    });

    // Top products by sales count
    const topProducts = Object.entries(productSalesMap)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.status(200).json({
      analytics: {
        revenueChart: Object.entries(revenueByDay).map(([day, revenue]) => ({ day, revenue })),
        totalRevenue,
        totalOrders: ordersSnap.size,
        topProducts,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ─────────────────────────────────────────────
// 15. Generate Parcel from Order
// ─────────────────────────────────────────────
router.post('/orders/:orderId/generate-parcel', async (req, res) => {
  const { orderId } = req.params;
  const { partnerId, weight, type, vehicleType, lat, lng } = req.body;

  if (!partnerId) return res.status(400).json({ error: 'Partner ID is required.' });

  try {
    const orderRef = db.collection('ecommerce_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();
    const parcelsRef = db.collection('parcels');

    // ── AI Driver Assignment (ML Pipeline) ──────────────────────────────
    const assigned = await autoAssignDriverHubPartner(
      vehicleType || 'bike',
      lat  || null,
      lng  || null
    );
    // ───────────────────────────────────────────────────────────────────

    // Create a new parcel document based on the order
    const newParcel = {
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

    const docRef = await parcelsRef.add(newParcel);
    
    // Update order status to indicate it's being shipped
    await orderRef.update({ 
      status    : 'shipped',
      parcelId  : docRef.id,
      driverId  : assigned ? assigned.driverId : null,
      updatedAt : admin.firestore.FieldValue.serverTimestamp() 
    });

    // Notify Drivers logic
    const io = req.app.get('io');
    if (io) {
      const assignedDriverId = assigned ? assigned.driverId : null;
      if (assignedDriverId) {
        io.to(assignedDriverId).emit('newAssignedJob', {
          id: docRef.id,
          ...newParcel,
          createdAt: new Date().toISOString()
        });
        console.log(\`Emitted newAssignedJob to driver \${assignedDriverId}\`);
      } else {
        io.to('drivers').emit('newRideRequest', {
          id: docRef.id,
          ...newParcel,
          createdAt: new Date().toISOString()
        });
        console.log('Emitted newRideRequest to drivers');
      }
    }

    const responseMsg = assigned
      ? \`Parcel generated and AI-assigned to driver \${assigned.driverName} (score=\${assigned.score})\`
      : 'Parcel generated. No driver available — parcel is pending dispatch.';

    res.status(201).json({ 
      message       : responseMsg,
      parcel        : { id: docRef.id, ...newParcel },
      assigned_driver: assigned || null,
    });
  } catch (err) {
    console.error('[generate-parcel] Error:', err);
    res.status(500).json({ error: 'Failed to generate parcel' });
  }
});

module.exports = router;
`;

fs.writeFileSync(filepath, prefix + suffix);
console.log('Repaired hubpartner.js successfully!');
