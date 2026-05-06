const axios = require('axios');

/**
 * Service to interact with the Flask ETA Prediction model
 */
const predictETA = async (parcelData) => {
  try {
    const FLASK_URL = process.env.FLASK_API_URL || 'http://localhost:5000/predict';
    
    const totalWeight = parcelData.parcels 
      ? parcelData.parcels.reduce((sum, p) => sum + (Number(p.weight) || 0), 0)
      : (Number(parcelData.weight) || 0);
      
    const totalVolume = parcelData.parcels
      ? parcelData.parcels.reduce((sum, p) => sum + ((Number(p.length) || 0) * (Number(p.width) || 0) * (Number(p.height) || 0) / 1000000), 0)
      : 0.1;

    const distance = parcelData.distance || 15.0; 

    const payload = {
      distance: distance,
      weight: totalWeight,
      volume: totalVolume,
      vehicleType: parcelData.vehicleType || 'car'
    };

    // If coordinates are provided, pass them to Flask for real-time ML accuracy
    if (parcelData.pickup_lat && parcelData.pickup_lng && parcelData.dropoff_lat && parcelData.dropoff_lng) {
      payload.pickup_lat = parcelData.pickup_lat;
      payload.pickup_lng = parcelData.pickup_lng;
      payload.dropoff_lat = parcelData.dropoff_lat;
      payload.dropoff_lng = parcelData.dropoff_lng;
    }

    const response = await axios.post(FLASK_URL, payload, { timeout: 5000 });

    if (response.data && response.data.success) {
      return {
        prediction: response.data.prediction,
        unit: response.data.unit,
        timestamp: new Date().toISOString()
      };
    }
    return null;
  } catch (error) {
    console.warn('Error calling ETA prediction service:', error.message);
    return null;
  }
};

/**
 * Service to interact with the Flask Delay Prediction model
 */
const predictDelay = async (parcelData) => {
  try {
    const FLASK_URL = (process.env.FLASK_API_URL ? process.env.FLASK_API_URL.replace('/predict', '/predict_delay') : 'http://localhost:5000/predict_delay');
    
    const totalWeight = parcelData.parcels 
      ? parcelData.parcels.reduce((sum, p) => sum + (Number(p.weight) || 0), 0)
      : (Number(parcelData.weight) || 0);
      
    const totalVolume = parcelData.parcels
      ? parcelData.parcels.reduce((sum, p) => sum + ((Number(p.length) || 0) * (Number(p.width) || 0) * (Number(p.height) || 0) / 1000000), 0)
      : 0.1;

    const distance = parcelData.distance || 15.0; 

    const response = await axios.post(FLASK_URL, {
      distance: distance,
      weight: totalWeight,
      volume: totalVolume,
      vehicleType: parcelData.vehicleType || 'car'
    }, { timeout: 5000 });

    if (response.data && response.data.success) {
      return {
        delayMinutes: response.data.delay_minutes,
        unit: response.data.unit,
        timestamp: new Date().toISOString()
      };
    }
    return null;
  } catch (error) {
    console.warn('Error calling Delay prediction service:', error.message);
    return null;
  }
};

module.exports = { predictETA, predictDelay };
