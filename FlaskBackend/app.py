"""
app.py – LOGINEX Flask ML Backend
==================================

Endpoints:
  POST /predict          – ETA prediction
  POST /predict_route    – Pakistan-adjusted route ETA (segment-level buffers)
  POST /predict_delay    – Delay classification
  POST /assign_driver    – AI driver assignment (main trigger)
  GET  /health           – Health-check with model status

Driver assignment pipeline models are loaded ONCE on startup via driver_pipeline.py.
All assignment logic is in driver_pipeline.DriverAssignmentPipeline.
"""

import os
import pickle
import warnings
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import the dedicated pipeline modules (loaded once at startup)
from driver_pipeline import pipeline as driver_pipeline
from eta_pipeline import eta_pipeline
from pakistan_eta_engine import pakistan_eta_engine, DriverProfile

warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADER UTILITY
# ─────────────────────────────────────────────────────────────────────────────
def load_pkl_model(path: str):
    """Load a sklearn/joblib model, falling back to pickle on failure."""
    if not os.path.exists(path):
        print(f"[WARN] Model not found at {path}")
        return None
    try:
        model = joblib.load(path)
        print(f"[OK]   Loaded (joblib): {os.path.basename(path)}")
        return model
    except Exception:
        try:
            with open(path, 'rb') as f:
                model = pickle.load(f)
            print(f"[OK]   Loaded (pickle): {os.path.basename(path)}")
            return model
        except Exception as e:
            print(f"[ERR]  Failed to load {path}: {e}")
            return None


# ─────────────────────────────────────────────────────────────────────────────
# ETA ENSEMBLE PIPELINE  (v4 stacked model, loaded via eta_pipeline module)
# ─────────────────────────────────────────────────────────────────────────────
# eta_pipeline is loaded at the bottom of startup (after driver_pipeline.load())

# ─────────────────────────────────────────────────────────────────────────────
# DELAY CLASSIFIER PIPELINE  (used by /predict_delay)
# ─────────────────────────────────────────────────────────────────────────────
try:
    _delay_dir          = os.path.join(os.path.dirname(__file__), 'delay')
    delay_feature_cols  = joblib.load(os.path.join(_delay_dir, 'feature_columns.pkl'))
    delay_cat_cols      = joblib.load(os.path.join(_delay_dir, 'cat_cols.pkl'))
    delay_ordinal_enc   = joblib.load(os.path.join(_delay_dir, 'ordinal_encoder.pkl'))
    delay_clf           = joblib.load(os.path.join(_delay_dir, 'hist_gb_model.joblib'))
    delay_threshold     = joblib.load(os.path.join(_delay_dir, 'best_threshold.pkl'))
    print("[OK]   Loaded advanced delay classifier pipeline.")
    ADV_DELAY_READY = True
except Exception as e:
    print(f"[WARN] Advanced delay model pipeline not fully loaded: {e}")
    ADV_DELAY_READY = False

# ─────────────────────────────────────────────────────────────────────────────
# DRIVER ASSIGNMENT PIPELINE – load once at startup
# (All model loading lives in driver_pipeline.py)
# ─────────────────────────────────────────────────────────────────────────────
driver_pipeline.load()
eta_pipeline.load()


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/predict', methods=['POST'])
def predict():
    """
    ETA prediction endpoint.

    Accepts JSON with:
      Required (at least one set):
        pickup_lat, pickup_lng, dropoff_lat, dropoff_lng  – coordinates (preferred)
        OR
        distance  – distance in km (fallback when coords are unavailable)

      Optional:
        vehicleType  – 'bike', 'car', 'van', 'truck' (unused by ML, kept for compat)
        weight       – parcel weight in kg
        volume       – parcel volume in m³
    """
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'success': False, 'error': 'No JSON body received'}), 400

        vehicle_type = str(data.get('vehicleType', 'bike')).lower()
        weight       = float(data.get('weight', 0.5))
        volume       = float(data.get('volume', 0.01))

        # ── Try coordinate-based ML prediction first ──────────────────────────
        plat = data.get('pickup_lat')
        plng = data.get('pickup_lng')
        dlat = data.get('dropoff_lat')
        dlng = data.get('dropoff_lng')

        if plat is not None and plng is not None and dlat is not None and dlng is not None:
            plat, plng = float(plat), float(plng)
            dlat, dlng = float(dlat), float(dlng)

            import datetime
            result = eta_pipeline.predict(plat, plng, dlat, dlng)

            return jsonify({
                'success'      : True,
                'prediction'   : result['eta_minutes'],
                'unit'         : 'minutes',
                'distance_km'  : result['distance_km'],
                'method'       : result['method'],
                'details'      : result['details'],
                'using_fallback': result['method'] != 'ensemble'
            })

        # ── Fallback: distance-only heuristic ────────────────────────────────
        distance = float(data.get('distance', 5.0))
        speed_map = {'bike': 35, 'rickshaw': 25, 'car': 22, 'van': 20, 'truck': 15}
        speed = speed_map.get(vehicle_type, 25)
        travel_time   = (distance / speed) * 60.0
        handling_time = 15.0 + (weight / 10.0) + (volume * 5.0)
        result_min    = round(travel_time + handling_time, 2)

        return jsonify({
            'success'      : True,
            'prediction'   : result_min,
            'unit'         : 'minutes',
            'distance_km'  : distance,
            'method'       : 'distance_heuristic',
            'details'      : {
                'travel_time_est'  : round(travel_time, 2),
                'handling_time_est': round(handling_time, 2),
                'vehicle_type'     : vehicle_type
            },
            'using_fallback': True
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/predict_delay', methods=['POST'])
def predict_delay():
    """Delay prediction endpoint."""
    try:
        data = request.get_json()

        distance = float(data.get('distance', 10.0))
        weight   = float(data.get('weight',   1.0))
        volume   = float(data.get('volume',   0.1))

        if ADV_DELAY_READY:
            import pandas as pd
            import datetime

            now = datetime.datetime.now()
            X_dict = {
                'city'                     : data.get('city', 'Lahore'),
                'month'                    : now.month,
                'day_of_week'              : now.weekday(),
                'hour_of_day'              : now.hour,
                'is_rush_hour'             : 1 if (8 <= now.hour <= 10) or (17 <= now.hour <= 20) else 0,
                'is_friday_jummah'         : 1 if now.weekday() == 4 and (12 <= now.hour <= 14) else 0,
                'is_ramadan_iftar_rush'    : 0,
                'original_eta_minutes'     : data.get('eta', distance * 3.0),
                'current_eta_minutes'      : data.get('eta', distance * 3.0),
                'eta_drift_delta'          : 0.0,
                'congestion_score'         : data.get('congestion_score', 0.2),
                'congestion_level'         : data.get('congestion_level', 'Low'),
                'weather_condition'        : data.get('weather_condition', 'Clear'),
                'weather_risk_level'       : 0.0,
                'weather_factor'           : 1.0,
                'driver_delay_history'     : 0.0,
                'driver_performance_score' : 0.9,
                'vehicle_type'             : data.get('vehicleType', 'bike'),
                'total_deliveries'         : 100.0,
                'total_delays'             : 2.0,
                'delay_rate'               : 0.02,
                'on_time_rate'             : 0.98,
                'avg_delay_minutes'        : 15.0,
                'worst_delay_minutes'      : 45.0,
                'years_experience'         : 2.0,
                'supplier_reliability_score': 0.95,
                'route_risk_level'         : 0.1,
                'disruption_likelihood'    : 0.05,
                'lead_time_days'           : 1.0,
                'delivery_time_deviation'  : 0.0,
                'warehouse_inventory_level': 1000.0,
                'cargo_condition_score'    : 1.0,
                'order_fulfillment_rate'   : 0.99,
                'supplier_country'         : 'PK'
            }

            df = pd.DataFrame([X_dict])[delay_feature_cols]

            if hasattr(delay_ordinal_enc, 'transform'):
                df[delay_cat_cols] = delay_ordinal_enc.transform(df[delay_cat_cols])

            df = df.astype(float)

            probs        = delay_clf.predict_proba(df)[0]
            prob_delayed = probs[1]
            is_delayed   = bool(prob_delayed > delay_threshold)

            result_minutes = (prob_delayed * 30.0 + distance * 0.1) if is_delayed else 0.0

            return jsonify({
                'success'          : True,
                'delay_minutes'    : round(result_minutes, 2),
                'is_delayed'       : is_delayed,
                'delay_probability': round(float(prob_delayed), 4),
                'unit'             : 'minutes',
                'using_advanced'   : True
            })

        else:
            # Heuristic fallback
            result = distance * 0.2 + 10.0
            return jsonify({
                'success'        : True,
                'delay_minutes'  : result,
                'unit'           : 'minutes',
                'using_fallback' : True
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/assign_driver', methods=['POST'])
def assign_driver():
    """
    AI-based driver assignment endpoint.

    Expected JSON body
    ------------------
    {
      "order": {
          "lat"         : 31.5204,
          "lng"         : 74.3587,
          "vehicleType" : "bike",
          "totalWeight" : 2.5       (optional)
      },
      "drivers": [
          {
              "id"            : "drv_001",
              "name"          : "Ali Hassan",
              "lat"           : 31.5100,
              "lng"           : 74.3200,
              "vehicleType"   : "bike",
              "rating"        : 4.7,
              "active_orders" : 1
          },
          ...
      ]
    }

    Response
    --------
    {
      "success"         : true,
      "assigned_driver" : { ...driver object with 'score', '_rf_proba', '_rank_score' },
      "ranked_drivers"  : [ ...all drivers sorted by score desc ],
      "pipeline_used"   : true,
      "total_drivers"   : N
    }
    
    Triggers
    --------
    - Called by Node.js parcels.js on every "Book Parcel" (shipper, brand, hub-partner)
    - Called by Node.js parcels.js on "Assign Driver" button (POST /api/parcels/assign-driver)
    """
    try:
        data    = request.get_json(force=True)
        order   = data.get('order', {})
        drivers = data.get('drivers', [])

        if not drivers:
            return jsonify({'success': False, 'error': 'No drivers provided'}), 400

        if not order:
            return jsonify({'success': False, 'error': 'No order data provided'}), 400

        # Delegate fully to the pipeline
        result = driver_pipeline.assign_best_driver(order, drivers)

        return jsonify(result)

    except Exception as e:
        print(f"[assign_driver] Unhandled error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/predict_route', methods=['POST'])
def predict_route():
    """
    Pakistan-adjusted route ETA with segment-level buffers.

    Accepts JSON:
    {
      "origin":      { "lat": 31.5204, "lng": 74.3587 },
      "destination": { "lat": 31.4504, "lng": 74.2760 },
      "dispatch_time": "2026-04-18T13:15:00"  (optional, defaults to now),
      "driver": {
        "city": "Lahore",
        "fuel": "petrol",
        "experience_years": 3,
        "total_deliveries": 210
      },
      "active_protests": [],       (list of protest zone labels)
      "is_ramadan": false,
      "iftar_time": null            (ISO time string, e.g. "19:05")
    }
    """
    import datetime
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'success': False, 'error': 'No JSON body'}), 400

        # ── Parse origin / destination ──────────────────────────────────────
        origin = data.get('origin', {})
        dest   = data.get('destination', {})

        origin_lat = float(origin.get('lat', data.get('pickup_lat', 31.5204)))
        origin_lng = float(origin.get('lng', data.get('pickup_lng', 74.3587)))
        dest_lat   = float(dest.get('lat',   data.get('dropoff_lat', 31.4504)))
        dest_lng   = float(dest.get('lng',   data.get('dropoff_lng', 74.2760)))

        # ── Parse dispatch time ──────────────────────────────────────────────
        dispatch_str = data.get('dispatch_time')
        if dispatch_str:
            try:
                dispatch_dt = datetime.datetime.fromisoformat(dispatch_str)
            except ValueError:
                dispatch_dt = datetime.datetime.now()
        else:
            dispatch_dt = datetime.datetime.now()

        # ── Parse driver profile ─────────────────────────────────────────────
        drv_data = data.get('driver', {})
        driver = DriverProfile(
            city=str(drv_data.get('city', 'Lahore')),
            fuel=str(drv_data.get('fuel', 'petrol')).lower(),
            experience_years=float(drv_data.get('experience_years', 2.0)),
            total_deliveries=int(drv_data.get('total_deliveries', 100)),
        )

        # ── Parse context flags ──────────────────────────────────────────────
        active_protests = data.get('active_protests', [])
        is_ramadan      = bool(data.get('is_ramadan', False))
        iftar_str       = data.get('iftar_time')   # e.g. "19:05"
        iftar_time      = None
        if iftar_str and is_ramadan:
            try:
                h, m = map(int, iftar_str.split(':')[:2])
                iftar_time = dispatch_dt.replace(hour=h, minute=m, second=0, microsecond=0)
            except Exception:
                pass

        # ── Run Pakistan ETA Engine ──────────────────────────────────────────
        result = pakistan_eta_engine.predict_route(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            dispatch_dt=dispatch_dt,
            driver=driver,
            active_protests=active_protests,
            is_ramadan=is_ramadan,
            iftar_time=iftar_time,
        )

        return jsonify({'success': True, **result})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/health', methods=['GET'])
def health():
    """Health-check endpoint with detailed model status."""
    p = driver_pipeline
    pipeline_models = {
        'scaler_coords'         : p.scaler_coords is not None,
        'kmeans_zones'          : p.kmeans_zones   is not None,
        'scaler_m1_rf'          : p.scaler_m1_rf   is not None,
        'rf_driver_assignment'  : p.rf_model        is not None,
        'lamdamart_ranker'      : p.lamdamart       is not None,
        'lamdamart_is_xgb_fallback': p._lamdamart_is_xgb,
    }
    ep = eta_pipeline
    return jsonify({
        'status'                    : 'healthy',
        'eta_pipeline_ready'        : ep.ready,
        'eta_method'                : 'ensemble' if ep.ready else 'heuristic',
        'delay_model_loaded'        : ADV_DELAY_READY,
        'assignment_pipeline_ready' : p.ready,
        'assignment_models'         : pipeline_models,
        'port'                      : 5000
    })


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
