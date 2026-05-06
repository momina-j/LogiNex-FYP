"""
driver_pipeline.py
==================
Modular AI driver assignment pipeline.

Models (all from FlaskBackend/driver_assignment/):
  1. scaler_coords.pkl        – StandardScaler(n_features=2) for raw lat/lng
  2. kmeans_zones.pkl         – KMeans(n_clusters=5) for zone clustering
  3. scaler_m1_rf.pkl         – StandardScaler(n_features=9) for feature vector
  4. rf_driver_assignment.pkl – RandomForestClassifier → P(class=1) score
  5. lamdamart.pkl            – LambdaMART ranker (joblib pkl)
                               Falls back to lambdamart_ranker.json (XGBoost) if pkl missing.

Pipeline order:
  raw lat/lng
    → scaler_coords  → scaled coords
    → kmeans_zones   → zone_id
    → 9-feature vec  → [d_lat_s, d_lng_s, o_lat_s, o_lng_s,
                          dist_scaled, d_zone, o_zone, rating, active_orders]
    → scaler_m1_rf   → scaled 9-feat
    → rf_model       → rf_proba  (P class=1)
    → lamdamart      → rank_score
    → final_score    = rf_proba + rank_score  (descending → best driver)
"""

import os
import pickle
import warnings
import numpy as np
import joblib

warnings.filterwarnings('ignore')

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
PIPELINE_DIR = os.path.join(os.path.dirname(__file__), 'driver_assignment')

# City coordinate fallbacks used when only a city name is provided
CITY_COORDS = {
    'karachi':   (24.8607, 67.0011),
    'lahore':    (31.5204, 74.3587),
    'islamabad': (33.6844, 73.0479),
    'rawalpindi':(33.5651, 73.0169),
    'faisalabad':(31.4180, 73.0790),
    'peshawar':  (34.0151, 71.5249),
    'multan':    (30.1575, 71.5249),
    'quetta':    (30.1798, 66.9750),
}


# ─────────────────────────────────────────────────────────────────────────────
# Low-level loader
# ─────────────────────────────────────────────────────────────────────────────
def _load_pkl(path: str, label: str):
    """Load a sklearn/joblib model from path, falling back to pickle."""
    if not os.path.exists(path):
        print(f"[WARN] Model file not found: {path}")
        return None
    try:
        model = joblib.load(path)
        print(f"[OK]   Loaded (joblib): {label}")
        return model
    except Exception:
        try:
            with open(path, 'rb') as f:
                model = pickle.load(f)
            print(f"[OK]   Loaded (pickle): {label}")
            return model
        except Exception as e:
            print(f"[ERR]  Failed to load {label}: {e}")
            return None


# ─────────────────────────────────────────────────────────────────────────────
# Model container
# ─────────────────────────────────────────────────────────────────────────────
class DriverAssignmentPipeline:
    """Holds all 5 models and provides the full scoring pipeline."""

    def __init__(self):
        self.scaler_coords = None   # step 1 – scale raw lat/lng
        self.kmeans_zones  = None   # step 2 – zone clustering
        self.scaler_m1_rf  = None   # step 3 – scale 9-feature vector
        self.rf_model      = None   # step 4 – RF eligibility score
        self.lamdamart     = None   # step 5 – LambdaMART rank score
        self._lamdamart_is_xgb = False  # True if loaded from .json (XGBoost)
        self.ready         = False

    # ── Model Loading ────────────────────────────────────────────────────────

    def load(self):
        """Load all models from the driver_assignment/ folder. Call once at startup."""
        if not os.path.isdir(PIPELINE_DIR):
            print(f"[WARN] driver_assignment/ folder not found at {PIPELINE_DIR}")
            return

        print("\n-- Loading Driver Assignment Pipeline ------------------------------")

        # 1. Coordinate scaler
        self.scaler_coords = _load_pkl(
            os.path.join(PIPELINE_DIR, 'scaler_coords.pkl'),
            'scaler_coords.pkl'
        )

        # 2. KMeans zones
        self.kmeans_zones = _load_pkl(
            os.path.join(PIPELINE_DIR, 'kmeans_zones.pkl'),
            'kmeans_zones.pkl'
        )

        # 3. Feature scaler – try both known spellings
        scaler_path = os.path.join(PIPELINE_DIR, 'scaler_m1_rf.pkl')
        if not os.path.exists(scaler_path):
            scaler_path = os.path.join(PIPELINE_DIR, 'scalar_m1_rf.pkl')
        self.scaler_m1_rf = _load_pkl(scaler_path, 'scaler_m1_rf.pkl')

        # 4. Random Forest
        self.rf_model = _load_pkl(
            os.path.join(PIPELINE_DIR, 'rf_driver_assignment.pkl'),
            'rf_driver_assignment.pkl'
        )

        # 5. LambdaMART ranker – try pkl first, fall back to XGBoost JSON
        lm_pkl_path  = os.path.join(PIPELINE_DIR, 'lamdamart.pkl')
        lm_json_path = os.path.join(PIPELINE_DIR, 'lambdamart_ranker.json')

        if os.path.exists(lm_pkl_path):
            self.lamdamart = _load_pkl(lm_pkl_path, 'lamdamart.pkl')
            self._lamdamart_is_xgb = False
        elif os.path.exists(lm_json_path):
            try:
                import xgboost as xgb
                booster = xgb.Booster()
                booster.load_model(lm_json_path)
                self.lamdamart = booster
                self._lamdamart_is_xgb = True
                print(f"[OK]   Loaded (xgb fallback): lambdamart_ranker.json "
                      f"(features={booster.num_features()})")
            except Exception as e:
                print(f"[WARN] lambdamart_ranker.json found but failed to load: {e}")
        else:
            print("[WARN] No lamdamart.pkl or lambdamart_ranker.json found – "
                  "ranking step will be skipped (RF-only scoring).")

        # Readiness check
        core_ready = all([
            self.scaler_coords,
            self.kmeans_zones,
            self.scaler_m1_rf,
            self.rf_model,
        ])
        self.ready = core_ready
        ranker_info = ("lamdamart.pkl" if (self.lamdamart and not self._lamdamart_is_xgb)
                       else "lambdamart_ranker.json (xgb)" if self.lamdamart
                       else "MISSING (RF-only)")
        print(f"-- Pipeline ready: {self.ready} | Ranker: {ranker_info} --\n")

    # ── Feature Building ─────────────────────────────────────────────────────

    def _build_feature_vector(self,
                               driver_lat: float, driver_lng: float,
                               order_lat:  float, order_lng:  float,
                               driver_rating: float, driver_active_orders: float
                               ) -> np.ndarray:
        """
        Build the canonical 9-feature vector.

        Steps
        -----
        1. Z-score both lat/lng pairs via scaler_coords.
        2. Predict KMeans zone for driver and order coords.
        3. Compute Euclidean distance in scaled coord space.
        4. Assemble:
             [d_lat_s, d_lng_s, o_lat_s, o_lng_s, dist_scaled,
              driver_zone, order_zone, rating, active_orders]
        """
        # Step 1 – scale coordinates
        d_scaled = self.scaler_coords.transform([[driver_lat, driver_lng]])[0]  # (2,)
        o_scaled = self.scaler_coords.transform([[order_lat,  order_lng]])[0]   # (2,)

        # Step 2 – KMeans zones
        driver_zone = int(self.kmeans_zones.predict([d_scaled])[0])
        order_zone  = int(self.kmeans_zones.predict([o_scaled])[0])

        # Step 3 – Euclidean distance in scaled space (dimensionless)
        dist_scaled = float(np.linalg.norm(o_scaled - d_scaled))

        # Step 4 – assemble 9-feature vector (shape: (1, 9))
        feat = np.array([[
            d_scaled[0], d_scaled[1],      # driver lat/lng (scaled)
            o_scaled[0], o_scaled[1],      # order  lat/lng (scaled)
            dist_scaled,                   # distance in scaled space
            float(driver_zone),            # driver cluster zone
            float(order_zone),             # order cluster zone
            float(driver_rating),          # driver rating
            float(driver_active_orders),   # active orders count
        ]])
        return feat  # shape (1, 9)

    # ── Scoring ──────────────────────────────────────────────────────────────

    def _score_driver(self, feat_raw: np.ndarray):
        """
        Run the 9-feature vector through scaler_m1_rf → RF → LambdaMART.

        Returns
        -------
        rf_proba   : float – P(class=1) from Random Forest
        rank_score : float – relevance score from LambdaMART (or 0 if unavailable)
        """
        # Scale with scaler_m1_rf
        feat_scaled = self.scaler_m1_rf.transform(feat_raw)

        # RF eligibility probability
        if hasattr(self.rf_model, 'predict_proba'):
            rf_proba = float(self.rf_model.predict_proba(feat_scaled)[0][1])
        else:
            rf_proba = float(self.rf_model.predict(feat_scaled)[0])

        # LambdaMART rank score
        rank_score = 0.0
        if self.lamdamart is not None:
            try:
                if self._lamdamart_is_xgb:
                    import xgboost as xgb
                    dmatrix    = xgb.DMatrix(feat_scaled)
                    rank_score = float(self.lamdamart.predict(dmatrix)[0])
                else:
                    # Joblib-loaded sklearn-compatible ranker
                    rank_score = float(self.lamdamart.predict(feat_scaled)[0])
            except Exception as e:
                print(f"[WARN] LambdaMART scoring failed: {e} – using RF-only")

        return rf_proba, rank_score

    # ── Public API ───────────────────────────────────────────────────────────

    def assign_best_driver(self, order: dict, drivers: list) -> dict:
        """
        Run the full pipeline and return ranked drivers.

        Parameters
        ----------
        order   : dict with at least 'lat', 'lng', 'vehicleType'
        drivers : list of driver dicts with 'id', 'lat', 'lng',
                  'vehicleType', 'rating', 'active_orders'

        Returns
        -------
        {
            'success'         : bool,
            'assigned_driver' : dict | None,
            'ranked_drivers'  : list,
            'pipeline_used'   : bool,
            'total_drivers'   : int,
            'error'           : str | None,    # only on failure
        }
        """
        if not drivers:
            return {'success': False, 'error': 'No drivers provided',
                    'assigned_driver': None, 'ranked_drivers': [], 'total_drivers': 0}

        order_lat  = float(order.get('lat',  24.8607))
        order_lng  = float(order.get('lng',  67.0011))
        order_vtype = str(order.get('vehicleType', 'car')).lower()

        # ── Step 1: Filter by vehicle type ──────────────────────────────────
        filtered = [d for d in drivers
                    if str(d.get('vehicleType', '')).lower() == order_vtype]
        if not filtered:
            print(f"[assign] No vehicle match for '{order_vtype}', "
                  f"using all {len(drivers)} drivers.")
            filtered = list(drivers)

        # ── Step 2: Score each driver ────────────────────────────────────────
        scored = []
        for d in filtered:
            d_lat  = float(d.get('lat',           order_lat))
            d_lng  = float(d.get('lng',           order_lng))
            rating = float(d.get('rating',        4.5))
            active = float(d.get('active_orders', 0.0))

            driver_copy = dict(d)

            if self.ready:
                try:
                    feat_raw = self._build_feature_vector(
                        d_lat, d_lng, order_lat, order_lng, rating, active
                    )
                    rf_proba, rank_score = self._score_driver(feat_raw)
                    driver_copy['score']      = round(rf_proba + rank_score, 6)
                    driver_copy['_rf_proba']  = round(rf_proba,   4)
                    driver_copy['_rank_score']= round(rank_score, 4)
                    driver_copy['_pipeline']  = True
                except Exception as e:
                    print(f"[assign] Pipeline error for driver {d.get('id')}: {e}")
                    # Fallback per-driver: negative distance (closer = higher score)
                    dist_deg = np.sqrt((order_lat - d_lat)**2 + (order_lng - d_lng)**2)
                    driver_copy['score']     = float(-dist_deg)
                    driver_copy['_pipeline'] = False
            else:
                # Full fallback: nearest driver
                dist_deg = np.sqrt((order_lat - d_lat)**2 + (order_lng - d_lng)**2)
                driver_copy['score']     = float(-dist_deg)
                driver_copy['_pipeline'] = False

            scored.append(driver_copy)

        # ── Step 3: Sort descending by score → best driver first ─────────────
        scored.sort(key=lambda x: x.get('score', 0), reverse=True)

        return {
            'success'         : True,
            'assigned_driver' : scored[0] if scored else None,
            'ranked_drivers'  : scored,
            'pipeline_used'   : self.ready,
            'total_drivers'   : len(scored),
            'error'           : None,
        }

    def get_city_coords(self, city: str) -> tuple[float, float]:
        """Return (lat, lng) for a city name. Falls back to Karachi."""
        return CITY_COORDS.get(city.lower().strip(), CITY_COORDS['karachi'])


# ─────────────────────────────────────────────────────────────────────────────
# Singleton – loaded once at app startup
# ─────────────────────────────────────────────────────────────────────────────
pipeline = DriverAssignmentPipeline()
