🚚 LOGINEX — AI-Powered Logistics & Parcel Delivery Optimization System
Final Year Project | Bachelor of Science in Computer Science
Lahore Garrison University, Lahore | Session 2022–2026

👩‍💻 Developed By
Name	Roll No
Momina Jahangir	BSCS-150-D
Hassan Mahmud	BSCS-152-D
Supervised by: Dr. Maria Tariq — Assistant Professor, Department of Computer Science
Chairperson: Dr. Muhammad Kashif Siddhu

📌 Project Overview
LOGINEX is an AI-powered logistics and parcel delivery platform designed specifically for Pakistan's growing e-commerce sector. Small businesses currently rely on informal, phone-based delivery arrangements with no digital booking, no real-time tracking, and no verified handoffs. LOGINEX solves these problems by automating the entire delivery workflow — from booking to delivery confirmation — using artificial intelligence and modern web technologies.

🎯 Objectives
Automate parcel booking and driver assignment to eliminate manual phone-based coordination
Use AI to select the most suitable driver based on location, vehicle type, workload, and past performance
Provide real-time GPS tracking for businesses and customers
Enable facial recognition for verified driver identity at handoff
Predict delivery delays before parcels enter the delivery stage
Support Pakistani small businesses and independent riders (micro-entrepreneurs)
✨ Key Features
📦 Parcel Management — Digital booking, parcel creation, and status tracking
🤖 AI-Based Driver Assignment — Three-stage ML pipeline (Random Forest + LambdaMART) ranks and assigns the best driver automatically
📍 Real-Time GPS Tracking — Live location updates every 3–5 seconds on Leaflet maps
🔐 Facial Recognition Verification — Biometric identity check to ensure verified drivers handle deliveries
⚠️ Delay Prediction — HistGradientBoosting model evaluates delay risk at booking time
🔔 Notifications & Alerts — Real-time updates for businesses, drivers, and customers
📊 Analytics & Reporting — Performance dashboards and delivery insights
🗺️ Urdu Address Resolution — Converts Urdu address input to verified GPS coordinates
🛠️ Technology Stack
Layer	Technology
Web Frontend	Next.js (React)
Mobile App (Driver)	React Native
Backend Server	Node.js / Express
AI / ML Layer	Python Flask
Database	Firebase Firestore
Maps & Routing	OpenStreetMap, Leaflet, Nominatim
Machine Learning	Random Forest, LambdaMART, HistGradientBoosting
Security	Facial Recognition, JWT Authentication
👥 User Roles
Business/Sender — Books parcels, tracks deliveries, views analytics
Driver — Receives assignments, updates delivery status via mobile app
Hub Partner — Small firm using LOGINEX delivery infrastructure
Consignee — Tracks shipment via public portal using Tracking ID
🧠 AI Pipeline
The driver assignment uses a three-stage AI pipeline trained on 8,000 historical dispatch records from Lahore:

Stage 1 — Geographic zone clustering to filter nearby drivers
Stage 2 — Random Forest model scores each driver individually on performance metrics
Stage 3 — LambdaMART ranks all candidates as a complete ranking task
🏫 Institution
Department of Computer Science
Lahore Garrison University, Lahore, Pakistan
