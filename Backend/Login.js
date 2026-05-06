// Login.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const dns = require('dns');

// Fix for Node 18+ DNS resolution issues on some Windows systems
dns.setDefaultResultOrder('ipv4first');
const axios = require('axios'); // For Auth REST API
const bcrypt = require('bcrypt');
const { Server } = require('socket.io');
const { db, auth, admin } = require('./firebase-config');

// Re-enforce IPv4 preference for stable connectivity to Google APIs
dns.setDefaultResultOrder('ipv4first');

const app = express();
const API_KEY = process.env.FIREBASE_API_KEY; // Loaded from .env

// Force IPv4 Agent for identitytoolkit
const ipv4Agent = new https.Agent({ family: 4 });

// Explicit CORS configuration for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003'
];

app.use(cors({
  origin: function (origin, callback) {
    // During development, allow all localhost and 127.0.0.1 origins
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(null, new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request Logging Middleware to debug "Failed to fetch" issues
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin || 'N/A'}`);
  next();
});

app.options('*', cors()); // Handle preflight requests
app.use(express.json());

// Import the role-specific routers
const driverRoute = require('./driver');
const hubholderRoute = require('./hubholder');
const hubpartnerRoute = require('./hubpartner');
const adminRoute = require('./admin');
const customerRoute = require('./customer');
const paymentsRoute = require('./payments');
const parcelsRoute = require('./parcels');

// Mount the routes
app.use('/api/driver', driverRoute);
app.use('/api/hubholder', hubholderRoute);
app.use('/api/hubpartner', hubpartnerRoute);
app.use('/api/admin', adminRoute);
app.use('/api/customer', customerRoute);
app.use('/api/payments', paymentsRoute);
app.use('/api/parcels', parcelsRoute);

// -----------------
// Helper Functions
// -----------------
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isPhoneNumber = (id) => /^\+?[0-9\s\-]{10,15}$/.test(id);

// -----------------
// Routes
// -----------------

// Login (Unified: Supports Email and Phone)
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifier (email/phone) and password are required' });
  }

  try {
    let userId;
    let idToken = null;
    let userData;

    if (isValidEmail(identifier)) {
      // 1. Authenticate with Firebase Auth REST API to verify password
      let loginResponse = null;
      let retries = 3;
      let lastError = null;

      while (retries > 0 && !loginResponse) {
        try {
          console.log(`[AUTH] Attempting Firebase Auth for: ${identifier} (Retries left: ${retries - 1})`);
          loginResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
            { email: identifier, password, returnSecureToken: true },
            { 
              timeout: 10000, // Reduced timeout for faster failure
              httpsAgent: ipv4Agent 
            }
          );
          console.log(`[AUTH] Firebase Auth success for: ${identifier}`);
        } catch (authErr) {
          lastError = authErr;
          const fbStatus = authErr.response?.status;
          const fbMsg = authErr.response?.data?.error?.message;
          
          console.error(`[AUTH DIAGNOSTIC] Login attempt failed. HTTP Status: ${fbStatus}, Payload: ${fbMsg}`);

          if (authErr.code === 'ENOTFOUND' || authErr.code === 'ETIMEDOUT' || authErr.code === 'ECONNRESET') {
            console.warn(`[AUTH] Connection issue (retries left: ${retries - 1}):`, authErr.code);
            retries--;
            if (retries > 0) await new Promise(r => setTimeout(r, 1000));
          } else {
            console.error(`[AUTH] Fatal Auth Error: ${fbMsg || authErr.message}`);
            break; 
          }
        }
      }

      if (!loginResponse) {
        const authErr = lastError;
        const fbErrorCode = authErr.response?.data?.error?.message;
        const fbErrorDetails = authErr.response?.data?.error?.errors;
        
        console.error(`[AUTH DIAGNOSTIC] Login failed for: ${identifier}`);
        console.error(`[AUTH DIAGNOSTIC] Firebase Error Code: ${fbErrorCode}`);
        if (fbErrorDetails) {
            console.error(`[AUTH DIAGNOSTIC] Details:`, JSON.stringify(fbErrorDetails, null, 2));
        }

        const handledErrors = ['INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'INVALID_LOGIN_CREDENTIALS', 'USER_DISABLED'];
        
        if (handledErrors.includes(fbErrorCode)) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // If it's a key error or other systemic error, throw it so the global handler catches it
        throw authErr;
      }

      userId = loginResponse.data.localId;
      idToken = loginResponse.data.idToken;

      // 2. Fetch user profile from Firestore using Admin SDK
      try {
        const userDocSnap = await db.collection('users').doc(userId).get();
        if (!userDocSnap.exists) {
          return res.status(404).json({ error: 'User profile not found. Please register.' });
        }
        userData = userDocSnap.data();
      } catch (dbErr) {
        console.error("Firestore Fetch Error:", dbErr.message);
        return res.status(500).json({ error: 'Database connection failed. Please ensure serviceAccountKey.json is present.' });
      }
    } 
    else if (isPhoneNumber(identifier)) {
      // 1. Look up user by phoneNumber in Firestore
      try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('phoneNumber', '==', identifier).get();

        if (snapshot.empty) {
          // Try 'phone' field as fallback
          const snapshotAlt = await usersRef.where('phone', '==', identifier).get();
          if (snapshotAlt.empty) {
            return res.status(401).json({ error: 'User with this phone number not found' });
          }
          userData = snapshotAlt.docs[0].data();
          userId = snapshotAlt.docs[0].id;
        } else {
          userData = snapshot.docs[0].data();
          userId = snapshot.docs[0].id;
        }
      } catch (dbErr) {
        console.error("Firestore Phone Lookup Error:", dbErr.message);
        return res.status(500).json({ error: 'Database connection failed.' });
      }

      // 2. Verify password (check if bcrypt hash exists)
      if (userData.password) {
        const isValidPassword = await bcrypt.compare(password, userData.password);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid password' });
        }
      } else {
        return res.status(400).json({ error: 'This account requires email login or has no password set' });
      }
    } 
    else {
      return res.status(400).json({ error: 'Invalid identifier format. Use email or phone (+92...)' });
    }

    res.status(200).json({
      message: 'Login successful',
      idToken,
      user: {
        id: userId,
        name: userData.fullName || userData.name,
        email: userData.email,
        phone: userData.phone || userData.phoneNumber,
        roles: userData.roles || ['customer'],
        city: userData.city,
        warehouseLocation: userData.warehouseLocation,
        status: userData.status || 'approved',
      }
    });

  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error("Unified Login General Error:", errorMessage);
    res.status(500).json({ error: `Authentication error: ${errorMessage}` });
  }
});


// Register (Unified)
app.post('/api/register', async (req, res) => {
  const { fullName, email, phone, cnic, age, gender, city, password, address, roles, warehouseLocation } = req.body;

  const missingFields = [];
  if (!fullName) missingFields.push('fullName');
  if (!email)    missingFields.push('email');
  if (!phone)    missingFields.push('phone');
  if (!password) missingFields.push('password');
  if (!roles || roles.length === 0) missingFields.push('roles');

  if (roles?.includes('brand') && !warehouseLocation) {
    missingFields.push('warehouseLocation (required for brands)');
  }

  if (missingFields.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
  }

  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });

  try {
    // 1. Create user in Firebase Auth using Admin SDK
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
      phoneNumber: phone.startsWith('+') ? phone : undefined // Optional: sync phone to Auth if valid format
    });
    const userId = userRecord.uid;

    // 2. Hash password for Firestore (enables phone-based login via bcrypt)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Set custom claims for roles (Driver, Hub Holder, Shipper, brand)
    await auth.setCustomUserClaims(userId, { role: roles[0], roles: roles });

    // 4. Insert user into Firestore using Admin SDK
    const finalUserData = {
      fullName,
      email,
      phone,
      phoneNumber: phone, // keep both for compatibility
      cnic: cnic || null,
      age: age ? parseInt(age, 10) : null,
      gender: gender || 'Other',
      city: city || 'Unknown',
      address: address || '',
      roles,
      password: hashedPassword, // Store hashed for phone-based login
      status: 'approved',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (roles.includes('brand')) {
      finalUserData.warehouseLocation = warehouseLocation;
    }

    await db.collection('users').doc(userId).set(finalUserData);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: userId,
        name: fullName,
        email,
        phone,
        roles,
        city,
        status: 'approved',
      }
    });

  } catch (error) {
    console.error("Firebase Reg Error:", error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    if (error.code === 'auth/invalid-phone-number') {
      return res.status(400).json({ error: 'Invalid phone number format for Firebase Auth' });
    }
    res.status(500).json({ error: `Failed to create user account (${error.code || error.message})` });
  }
});

// -----------------
// Socket.IO
// -----------------
const PORT = process.env.PORT || 5001;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Share io instance across routers
app.set('io', io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on('joinDriversRoom', () => {
    socket.join('drivers');
    console.log(`Socket ${socket.id} joined drivers room`);
  });

  socket.on('updateLocation', async (data) => {
    const { userId, lat, lng } = data;
    if (!userId || !lat || !lng) {
      console.warn('Invalid location data:', data);
      return;
    }

    // Push to real-time database listener room
    io.to(userId).emit('newLocation', { userId, lat, lng, timestamp: new Date().toISOString() });

    // PERSIST TO FIRESTORE REAL-TIME
    try {
      await db.collection('drivers').doc(userId).set({
        currentLocation: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        },
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error(`[SOCKET] Failed to persist location for ${userId}:`, err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Health Check / Ping
app.get('/api/health', (req, res) => {
  try {
    const firestoreStatus = db ? 'connected' : 'disconnected';
    res.json({ status: 'online', database: firestoreStatus, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Global Error Handler - Ensures JSON is returned even for crashes
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] SERVER ERROR:`, err);
  
  // Ensure we haven't already sent headers
  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({ 
    success: false,
    error: 'Internal Server Error', 
    message: err.message || 'An unexpected error occurred',
    path: req.path
  });
});

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});