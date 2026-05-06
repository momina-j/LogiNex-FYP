/**
 * seed_parcels.js
 * Seeds dummy in-transit parcels into Firebase for dashboard demo.
 * Run: node seed_parcels.js
 */
const { db, admin } = require('./firebase-config');

// ── Dummy data ──────────────────────────────────────────────────────────────
const DUMMY_PARCELS = [
  {
    receiverName:    'Ahmed Raza',
    receiverPhone:   '+92 311 1234567',
    receiverAddress: 'House 12, Street 5, Gulshan-e-Iqbal, Karachi',
    city:            'Karachi',
    vehicleType:     'bike',
    status:          'in_transit',
    driverNote:      'Out for delivery — 2nd attempt',
    parcels: [{ description: 'Mobile Phone', weight: 0.5, paymentMethod: 'COD', codAmount: 35000, length: 20, width: 10, height: 5 }],
  },
  {
    receiverName:    'Sara Khan',
    receiverPhone:   '+92 333 9876543',
    receiverAddress: 'Flat 4-B, DHA Phase 5, Lahore',
    city:            'Lahore',
    vehicleType:     'car',
    status:          'assigned',
    driverNote:      'Driver en route to pick up',
    parcels: [{ description: 'Clothing Bundle', weight: 3, paymentMethod: 'COD', codAmount: 5500, length: 40, width: 30, height: 15 }],
  },
  {
    receiverName:    'Umar Farooq',
    receiverPhone:   '+92 321 5551234',
    receiverAddress: 'Office 7, Blue Area, Islamabad',
    city:            'Islamabad',
    vehicleType:     'van',
    status:          'in_transit',
    driverNote:      'Large parcel — loading dock delivery',
    parcels: [
      { description: 'Office Furniture Parts', weight: 18, paymentMethod: 'ONLINE', codAmount: 0, length: 120, width: 60, height: 20 },
      { description: 'Chair Assembly Kit',     weight: 5,  paymentMethod: 'ONLINE', codAmount: 0, length: 50,  width: 40, height: 30 },
    ],
  },
  {
    receiverName:    'Fatima Malik',
    receiverPhone:   '+92 300 7778899',
    receiverAddress: 'House 88-C, Model Town, Lahore',
    city:            'Lahore',
    vehicleType:     'rickshaw',
    status:          'pending',
    driverNote:      'Awaiting driver assignment',
    parcels: [{ description: 'Grocery Package', weight: 8, paymentMethod: 'COD', codAmount: 1200, length: 35, width: 25, height: 20 }],
  },
  {
    receiverName:    'Bilal Ahmed',
    receiverPhone:   '+92 345 1122334',
    receiverAddress: 'Apartment 3, Bahria Phase 2, Rawalpindi',
    city:            'Rawalpindi',
    vehicleType:     'car',
    status:          'in_transit',
    driverNote:      '10 mins from drop point',
    parcels: [{ description: 'Electronics — Laptop', weight: 2.5, paymentMethod: 'COD', codAmount: 85000, length: 40, width: 30, height: 5 }],
  },
  {
    receiverName:    'Zara Siddiqui',
    receiverPhone:   '+92 312 6543210',
    receiverAddress: '22-B, Gulberg III, Lahore',
    city:            'Lahore',
    vehicleType:     'bike',
    status:          'delayed',
    driverNote:      'Traffic delay — ETA +45 mins',
    parcels: [{ description: 'Medicines', weight: 0.3, paymentMethod: 'COD', codAmount: 2200, length: 15, width: 10, height: 8 }],
  },
  {
    receiverName:    'Hassan Ali',
    receiverPhone:   '+92 340 9191919',
    receiverAddress: 'Shop 12, Saddar Market, Karachi',
    city:            'Karachi',
    vehicleType:     'truck',
    status:          'assigned',
    driverNote:      'Driver assigned — picking up from hub',
    parcels: [
      { description: 'Wholesale Textiles',  weight: 50, paymentMethod: 'ONLINE', codAmount: 0, length: 80, width: 60, height: 40 },
      { description: 'Fabric Rolls – 10pcs', weight: 30, paymentMethod: 'ONLINE', codAmount: 0, length: 100, width: 20, height: 20 },
    ],
  },
];

// Service code map (mirrors parcels.js)
const SERVICE_CODES = { bike: '1Z', rickshaw: '1Z', car: '1G', van: '1G', truck: '1E' };

async function findShipperUserId() {
  // Try to find any user with 'shipper' role
  const snap = await db.collection('users').where('roles', 'array-contains', 'shipper').limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    console.log(`Found shipper: ${doc.data().fullName || doc.data().name} (${doc.id})`);
    return { id: doc.id, name: doc.data().fullName || doc.data().name || 'Demo Shipper' };
  }
  // Fallback — use any first user
  const fallback = await db.collection('users').limit(1).get();
  if (!fallback.empty) {
    const doc = fallback.docs[0];
    console.log(`No shipper found — using first user: ${doc.id}`);
    return { id: doc.id, name: doc.data().fullName || 'Demo Shipper' };
  }
  // Hard fallback
  console.log('No users found — using demo_shipper_001');
  return { id: 'demo_shipper_001', name: 'Demo Shipper' };
}

async function getNextSeq(userId) {
  const counterRef = db.collection('shipperCounters').doc(userId);
  const doc = await counterRef.get();
  const current = doc.exists ? (doc.data().seq || 0) : 0;
  const next = current + 1;
  await counterRef.set({ seq: next }, { merge: true });
  return next;
}

function generateTrackingParts(vehicleType, shipperCode, seq) {
  const svc    = SERVICE_CODES[vehicleType] || '1G';
  const seqStr = String(seq).padStart(5, '0');
  const rand   = String(Math.floor(100000 + Math.random() * 900000));
  return { trackingId: `${svc}-${shipperCode}-${seqStr}-${rand}`, serviceCode: svc };
}

function makeHistory(status) {
  const now = new Date();
  const history = [
    { status: 'Booking Confirmed',   timestamp: new Date(now - 3600000 * 3).toISOString(), note: 'Shipper submitted booking' },
  ];
  if (['assigned', 'in_transit', 'delayed'].includes(status)) {
    history.push({ status: 'Driver Assigned',    timestamp: new Date(now - 3600000 * 2).toISOString(), note: 'Driver accepted the job' });
  }
  if (['in_transit', 'delayed'].includes(status)) {
    history.push({ status: 'Parcel Picked Up',   timestamp: new Date(now - 3600000 * 1).toISOString(), note: 'Parcel collected from shipper' });
    history.push({ status: 'In Transit',         timestamp: new Date(now - 1800000).toISOString(),     note: 'Parcel is on its way' });
  }
  if (status === 'delayed') {
    history.push({ status: 'Delayed',            timestamp: new Date(now - 900000).toISOString(),      note: 'Traffic/route delay detected' });
  }
  return history;
}

async function seedParcels() {
  console.log('\n🚀 Starting Dummy Parcel Seeder...\n');

  const shipper = await findShipperUserId();
  const shipperCode = shipper.id
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase()
    .padEnd(4, 'X');

  console.log(`Shipper: ${shipper.name} | Code: ${shipperCode}\n`);

  let created = 0;
  for (const p of DUMMY_PARCELS) {
    try {
      const seq = await getNextSeq(shipper.id);
      const { trackingId, serviceCode } = generateTrackingParts(p.vehicleType, shipperCode, seq);
      const history = makeHistory(p.status);
      const ts = admin.firestore.FieldValue.serverTimestamp();

      // Write to parcels collection
      const parcelDoc = await db.collection('parcels').add({
        userId:          shipper.id,
        trackingId,
        receiverName:    p.receiverName,
        receiverPhone:   p.receiverPhone,
        receiverAddress: p.receiverAddress,
        city:            p.city,
        vehicleType:     p.vehicleType,
        status:          p.status,
        driverId:        p.status !== 'pending' ? 'driver_demo_001' : null,
        parcels:         p.parcels,
        createdAt:       ts,
        updatedAt:       ts,
      });

      // Write to trackingNumbers collection
      await db.collection('trackingNumbers').doc(trackingId).set({
        trackingId,
        parcelDocId:     parcelDoc.id,
        userId:          shipper.id,
        shipperName:     shipper.name,
        shipperPhone:    'N/A',
        shipperCity:     p.city,
        receiverName:    p.receiverName,
        receiverPhone:   p.receiverPhone,
        receiverAddress: p.receiverAddress,
        vehicleType:     p.vehicleType,
        serviceCode,
        shipperCode,
        sequenceNo:      String(seq).padStart(5, '0'),
        status:          p.status,
        statusHistory:   history,
        currentLocation: p.driverNote,
        estimatedDelivery: null,
        assignedDriver:  p.status !== 'pending' ? 'driver_demo_001' : null,
        assignedHub:     null,
        createdAt:       ts,
        updatedAt:       ts,
      });

      console.log(`  ✅ [${p.status.toUpperCase().padEnd(11)}]  ${trackingId}  →  ${p.receiverName} (${p.city})`);
      created++;
    } catch (err) {
      console.error(`  ❌ Failed: ${p.receiverName}:`, err.message);
    }
  }

  console.log(`\n✨ Done — ${created}/${DUMMY_PARCELS.length} dummy parcels created.\n`);
  process.exit(0);
}

seedParcels();
