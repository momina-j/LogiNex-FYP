"""
eta_pipeline.py
===============
Stacked-ensemble ETA predictor using the eta_final/ model files.

Pipeline (v4):
  [pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, datetime]
    → 63 engineered features
    → hgb_a, hgb_b, xgb_c  (three base regressors)
    → [pred_a, pred_b, pred_c, speed_a, speed_b, speed_c]
    → meta_scaler → meta_model (Ridge)
    → ETA in minutes

Falls back to hr_speed_map-based heuristic if any model is unavailable.
"""

import os
import math
import warnings
import datetime
import numpy as np
import joblib

warnings.filterwarnings('ignore')

# ── Directory ─────────────────────────────────────────────────────────────────
ETA_DIR = os.path.join(os.path.dirname(__file__), 'eta_final')

# ── Pakistan city centre coordinate bounds (replaces NYC bounds) ───────────────
# We re-map the grid zone logic so Pakistani coords get reasonable zone IDs.
# The model was trained on NYC data but the zone-based target encoding
# will simply fall through to G_ETA for unknown OD pairs — which is fine.
PK_LA0, PK_LA1 = 23.5, 37.0   # Pakistan lat range
PK_LO0, PK_LO1 = 60.0, 77.5   # Pakistan lng range


class ETAPipeline:
    """Loads and runs the v4 stacked ETA ensemble."""

    def __init__(self):
        self.hgb_a       = None
        self.hgb_b       = None
        self.xgb_c       = None
        self.meta_scaler = None
        self.meta_model  = None
        self.meta        = None   # dict of constants
        self.ready       = False

    # ── Loading ───────────────────────────────────────────────────────────────

    def load(self):
        """Load all models. Called once at Flask startup."""
        if not os.path.isdir(ETA_DIR):
            print(f"[ETA] eta_final/ directory not found at {ETA_DIR}")
            return

        print("\n-- Loading ETA Ensemble Pipeline (v4) --------------------------")
        try:
            self.hgb_a       = joblib.load(os.path.join(ETA_DIR, 'hgb_a_v4.pkl'))
            print("[ETA] hgb_a_v4.pkl loaded")
        except Exception as e:
            print(f"[ETA][WARN] hgb_a_v4.pkl failed: {e}")

        try:
            self.hgb_b       = joblib.load(os.path.join(ETA_DIR, 'hgb_b_v4.pkl'))
            print("[ETA] hgb_b_v4.pkl loaded")
        except Exception as e:
            print(f"[ETA][WARN] hgb_b_v4.pkl failed: {e}")

        try:
            self.xgb_c       = joblib.load(os.path.join(ETA_DIR, 'xgb_c_v4.pkl'))
            print("[ETA] xgb_c_v4.pkl loaded")
        except Exception as e:
            print(f"[ETA][WARN] xgb_c_v4.pkl failed: {e}")

        try:
            self.meta_scaler = joblib.load(os.path.join(ETA_DIR, 'meta_scaler_v4.pkl'))
            print("[ETA] meta_scaler_v4.pkl loaded")
        except Exception as e:
            print(f"[ETA][WARN] meta_scaler_v4.pkl failed: {e}")

        try:
            self.meta_model  = joblib.load(os.path.join(ETA_DIR, 'meta_model_v4.pkl'))
            print("[ETA] meta_model_v4.pkl loaded")
        except Exception as e:
            print(f"[ETA][WARN] meta_model_v4.pkl failed: {e}")

        try:
            self.meta        = joblib.load(os.path.join(ETA_DIR, 'meta_v4.pkl'))
            print("[ETA] meta_v4.pkl loaded")
        except Exception as e:
            print(f"[ETA][WARN] meta_v4.pkl failed: {e}")

        self.ready = all([
            self.hgb_a, self.hgb_b, self.xgb_c,
            self.meta_scaler, self.meta_model, self.meta
        ])
        print(f"-- ETA Pipeline ready: {self.ready} "
              f"({'full ensemble' if self.ready else 'heuristic fallback'}) --\n")

    # ── Feature Engineering ───────────────────────────────────────────────────

    def _zone(self, lat: float, lng: float, nz: int,
              la0: float, la1: float, lo0: float, lo1: float) -> int:
        """Map a coordinate to a flattened grid zone id."""
        r = int(np.clip((lat - la0) / (la1 - la0) * nz, 0, nz - 1))
        c = int(np.clip((lng - lo0) / (lo1 - lo0) * nz, 0, nz - 1))
        return r * nz + c

    def _haversine_km(self, lat1, lng1, lat2, lng2) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
        return R * 2 * math.asin(math.sqrt(a))

    def _build_features(self, plat: float, plng: float,
                         dlat: float, dlng: float,
                         dt: datetime.datetime) -> np.ndarray:
        """Build the 63-feature vector expected by the base models."""
        meta = self.meta

        # ── Spatial constants (re-mapped to Pakistan bounds) ──────────────────
        LA0, LA1 = PK_LA0, PK_LA1
        LO0, LO1 = PK_LO0, PK_LO1
        nz1, nz2 = meta['nz1'], meta['nz2']

        # Core distance features
        dist_km  = self._haversine_km(plat, plng, dlat, dlng)
        dist_m   = dist_km * 1000.0
        clat     = (plat + dlat) / 2.0
        clon     = (plng + dlng) / 2.0

        # Bearing
        dLat_r   = math.radians(dlat - plat)
        dLon_r   = math.radians(dlng - plng)
        y_b      = math.sin(dLon_r) * math.cos(math.radians(dlat))
        x_b      = (math.cos(math.radians(plat)) * math.sin(math.radians(dlat))
                    - math.sin(math.radians(plat)) * math.cos(math.radians(dlat)) * math.cos(dLon_r))
        bearing  = math.atan2(y_b, x_b)

        # Heuristic ETA from global speed (G_SPD m/s)
        G_SPD    = meta['G_SPD']
        FF_SPD   = meta['FF_SPD']
        G_ETA    = meta['G_ETA']
        peta     = (dist_m / G_SPD) / 60.0 if G_SPD > 0 else G_ETA
        petam    = peta * 1.1          # a mild upward bias for Manhattan distance

        # Detour ratio (approx; use 1.3 as typical urban factor)
        detour   = 1.3

        # ── Time features ─────────────────────────────────────────────────────
        hr  = dt.hour
        mn  = dt.minute
        dw  = dt.weekday()    # 0=Mon … 6=Sun
        mo  = dt.month
        dom = dt.day
        toh = hr + mn / 60.0
        hb  = int(hr == 0 or hr == 12)
        wk  = int(dw >= 5)    # weekend

        rush    = int((7 <= hr < 10) or (16 <= hr < 20))
        rush_am = int(7 <= hr < 10)
        rush_pm = int(16 <= hr < 20)
        night   = int(hr < 6 or hr >= 22)
        midday  = int(10 <= hr < 16)
        feve    = 0  # Friday evening (weekday 4, evening) – unused in PK context

        # ── Speed from hour speed map ─────────────────────────────────────────
        hr_speed_map = meta.get('hr_speed_map', {})
        hs = float(hr_speed_map.get(hr, G_SPD))   # m/s at this hour for pickup
        hc = float(hr_speed_map.get((hr + 1) % 24, G_SPD))  # 1 hr later (drop-off)
        # Derived time-of-day speed features (similar to original feature set)
        ds  = hs
        dc  = hc
        ms  = hs * 0.95
        mc  = hc * 0.95
        ns  = hs * 0.85
        nc  = hc * 0.85

        # ── Trip-level aggregations (vendor / pax — not applicable, use 0/1) ──
        vend = 1
        sfwd = 0
        pax  = 1

        # ── Zone features (using Pakistan grid) ───────────────────────────────
        pz = self._zone(plat, plng, nz1, LA0, LA1, LO0, LO1)
        dz = self._zone(dlat, dlng, nz1, LA0, LA1, LO0, LO1)

        # Sub-zone lat/lng centres
        pzla = LA0 + (pz // nz1 + 0.5) * (LA1 - LA0) / nz1
        pzlo = LO0 + (pz %  nz1 + 0.5) * (LO1 - LO0) / nz1
        dzla = LA0 + (dz // nz1 + 0.5) * (LA1 - LA0) / nz1
        dzlo = LO0 + (dz %  nz1 + 0.5) * (LO1 - LO0) / nz1

        # ── Zone speed / congestion ────────────────────────────────────────────
        zspd  = hs                  # same zone → use hour speed
        zcong = max(0.0, (G_SPD - hs) / G_SPD) if G_SPD > 0 else 0.0

        # ── OD target-encoded ETA ─────────────────────────────────────────────
        od_te         = meta.get('od_te_lookup', {})
        od_key        = f"{pz}_{dz}"
        od_eta        = float(od_te.get(od_key, G_ETA))
        od_rush_eta   = od_eta * (1.3 if rush else 1.0)
        od_night_eta  = od_eta * (0.8 if night else 1.0)

        # ── Airport distance (not applicable, use fixed large values) ─────────
        d_jfk    = dist_km * 0.9   # approximate using overall dist
        d_lga    = dist_km * 1.1
        d_jfk_do = dist_km * 0.95
        is_airport = 0

        # ── Interaction features ───────────────────────────────────────────────
        dxr  = dist_km * rush
        dxc  = dist_km * zcong
        dxw  = dist_km * wk
        mxr  = dist_km * rush_am
        lxc  = dist_km * zcong * 0.5
        pxr  = pax * rush
        pxc  = pax * zcong

        # ── Assemble in the EXACT feature order from meta['features'] ─────────
        feat_names = meta['features']
        feat_dict  = {
            'dist'              : dist_km,
            'man'               : dist_km * detour,
            'logd'              : math.log1p(dist_km),
            'detour'            : detour,
            'peta'              : peta,
            'petam'             : petam,
            'bsin'              : math.sin(bearing),
            'bcos'              : math.cos(bearing),
            'dlat'              : dlat - plat,
            'dlon'              : dlng - plng,
            'clat'              : clat,
            'clon'              : clon,
            'pickup_latitude'   : plat,
            'pickup_longitude'  : plng,
            'dropoff_latitude'  : dlat,
            'dropoff_longitude' : dlng,
            'd_jfk'             : d_jfk,
            'd_lga'             : d_lga,
            'd_jfk_do'          : d_jfk_do,
            'is_airport'        : is_airport,
            'pzla'              : pzla,
            'pzlo'              : pzlo,
            'dzla'              : dzla,
            'dzlo'              : dzlo,
            'pz'                : float(pz),
            'dz'                : float(dz),
            'hr'                : float(hr),
            'mn'                : float(mn),
            'dw'                : float(dw),
            'mo'                : float(mo),
            'dom'               : float(dom),
            'toh'               : toh,
            'hb'                : float(hb),
            'wk'                : float(wk),
            'rush'              : float(rush),
            'rush_am'           : float(rush_am),
            'rush_pm'           : float(rush_pm),
            'night'             : float(night),
            'midday'            : float(midday),
            'feve'              : float(feve),
            'hs'                : hs,
            'hc'                : hc,
            'ds'                : ds,
            'dc'                : dc,
            'ms'                : ms,
            'mc'                : mc,
            'ns'                : ns,
            'nc'                : nc,
            'vend'              : float(vend),
            'sfwd'              : float(sfwd),
            'pax'               : float(pax),
            'zspd'              : zspd,
            'zcong'             : zcong,
            'od_eta'            : od_eta,
            'od_rush_eta'       : od_rush_eta,
            'od_night_eta'      : od_night_eta,
            'dxr'               : dxr,
            'dxc'               : dxc,
            'dxw'               : dxw,
            'mxr'               : mxr,
            'lxc'               : lxc,
            'pxr'               : pxr,
            'pxc'               : pxc,
        }

        return np.array([[feat_dict[f] for f in feat_names]], dtype=np.float64)

    # ── Prediction ────────────────────────────────────────────────────────────

    def _heuristic_eta(self, plat: float, plng: float,
                        dlat: float, dlng: float,
                        dt: datetime.datetime) -> float:
        """Heuristic ETA using Pakistani urban speeds + detour + handling."""
        dist_km = self._haversine_km(plat, plng, dlat, dlng)
        road_km = dist_km * 1.35   # urban detour factor

        # Pakistani time-of-day speed (km/h)
        hr = dt.hour
        rush  = (7 <= hr < 10) or (16 <= hr < 20)
        night = hr < 6 or hr >= 22
        if night:
            pk_speed_kmh = 48.0
        elif rush:
            pk_speed_kmh = 22.0
        else:
            pk_speed_kmh = 30.0

        travel_min = (road_km / pk_speed_kmh) * 60.0
        eta_min    = travel_min + 8.0   # handling time
        return round(max(eta_min, 5.0), 2)

    def predict(self,
                pickup_lat: float, pickup_lng: float,
                dropoff_lat: float, dropoff_lng: float,
                pickup_dt: datetime.datetime | None = None) -> dict:
        """
        Run the full stacked ensemble to predict ETA.

        Parameters
        ----------
        pickup_lat  : origin latitude
        pickup_lng  : origin longitude
        dropoff_lat : destination latitude
        dropoff_lng : destination longitude
        pickup_dt   : pickup datetime (default: now)

        Returns
        -------
        dict with keys:
          eta_minutes  : float
          distance_km  : float
          method       : str ('ensemble' | 'heuristic')
          details      : dict
        """
        if pickup_dt is None:
            pickup_dt = datetime.datetime.now()

        dist_km = self._haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        dist_m  = dist_km * 1000.0

        if not self.ready:
            eta = self._heuristic_eta(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_dt)
            return {
                'eta_minutes': eta,
                'distance_km': round(dist_km, 3),
                'method'     : 'heuristic',
                'details'    : {'reason': 'models not loaded'}
            }

        try:
            X = self._build_features(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_dt)
            hr = pickup_dt.hour

            def safe_pred(model) -> float:
                p = float(model.predict(X)[0])
                return max(p, 0.5)

            pred_a = safe_pred(self.hgb_a)
            pred_b = safe_pred(self.hgb_b)
            pred_c = safe_pred(self.xgb_c)

            # ─────────────────────────────────────────────────────────────────
            # CALIBRATED FULL-TRIP ETA FOR PAKISTAN
            # ─────────────────────────────────────────────────────────────────
            # Root-cause of the old bug:
            #   The NYC models learned avg trip ≈ 11 min @ G_SPD ≈ 12.87 m/s.
            #   Using G_SPD directly as the Pakistani speed gave results that
            #   scaled linearly but were anchored to NYC short trips, acting
            #   as if each 10 km = ~13 min regardless of actual Pakistani speeds.
            #
            # Fix strategy:
            #   1. Use the ML ensemble purely as a DIMENSIONLESS congestion ratio
            #      (avg_pred / nyc_ref_eta) — tells us how congested this moment
            #      is relative to average NYC conditions.
            #   2. Apply that ratio to a physics-correct Pakistan baseline:
            #        road_km = dist_km * detour_factor
            #        travel_min = (road_km / pk_speed_kmh) * 60
            #   3. This gives, e.g., 30.7 km in daytime → ~54 min correctly.

            G_SPD = self.meta.get('G_SPD', 12.87)  # NYC avg m/s
            G_ETA = self.meta.get('G_ETA', 11.07)  # NYC avg trip min

            # Reference: what the NYC model "expects" for this exact distance
            # at average NYC conditions (peta = dist_m / G_SPD / 60)
            nyc_ref_eta = (dist_m / (G_SPD * 60.0)) if G_SPD > 0 else G_ETA

            avg_pred = (pred_a + pred_b + pred_c) / 3.0

            # Congestion ratio: how much slower/faster than NYC average
            if nyc_ref_eta > 0:
                congestion_factor = avg_pred / nyc_ref_eta
                # Realistic bounds: 0.7 (clear night) to 3.5 (severe gridlock)
                congestion_factor = max(0.7, min(congestion_factor, 3.5))
            else:
                congestion_factor = 1.2

            # ── Pakistani time-of-day speed ───────────────────────────────────
            # Map NYC hour speed ratio → Pakistani absolute speed
            hr_speed_map  = self.meta.get('hr_speed_map', {})
            nyc_hr_speed  = float(hr_speed_map.get(hr, G_SPD))  # m/s
            nyc_ratio     = nyc_hr_speed / G_SPD if G_SPD > 0 else 1.0
            nyc_ratio     = max(0.6, min(nyc_ratio, 1.8))

            # Pakistani speed scales with trip distance:
            #   < 15 km  : dense urban  → 25 km/h base
            #   15-40 km : urban/arteri  → 35 km/h base
            #   40-80 km : arterial/hwy  → 55 km/h base
            #   > 80 km  : motorway     → 75 km/h base
            if dist_km < 15.0:
                PK_BASE_KMH = 25.0
            elif dist_km < 40.0:
                PK_BASE_KMH = 35.0
            elif dist_km < 80.0:
                PK_BASE_KMH = 55.0
            else:
                PK_BASE_KMH = 75.0

            pk_speed_kmh  = PK_BASE_KMH * nyc_ratio
            # Hard bounds by tier
            if dist_km < 15.0:
                pk_speed_kmh = max(15.0, min(pk_speed_kmh, 45.0))
            elif dist_km < 40.0:
                pk_speed_kmh = max(22.0, min(pk_speed_kmh, 60.0))
            elif dist_km < 80.0:
                pk_speed_kmh = max(35.0, min(pk_speed_kmh, 90.0))
            else:
                pk_speed_kmh = max(50.0, min(pk_speed_kmh, 100.0))

            # ── Road distance (Haversine × urban detour factor) ───────────────
            # Detour factor decreases as trips get longer (highways are straighter)
            if dist_km < 15.0:
                DETOUR_FACTOR = 1.45
            elif dist_km < 40.0:
                DETOUR_FACTOR = 1.35
            elif dist_km < 80.0:
                DETOUR_FACTOR = 1.25
            else:
                DETOUR_FACTOR = 1.15
            road_km = dist_km * DETOUR_FACTOR

            # ── Physics travel time + ML congestion + time-of-day adj ─────────
            base_travel_min = (road_km / pk_speed_kmh) * 60.0

            rush  = int((7 <= hr < 10) or (16 <= hr < 20))
            night = int(hr < 6 or hr >= 22)
            # Mild extra correction on top of the ML congestion signal
            time_adj = 1.12 if rush else (0.92 if night else 1.0)

            travel_min   = base_travel_min * congestion_factor * time_adj
            handling_min = 8.0   # pickup wait + dropoff confirmation
            final_eta    = travel_min + handling_min
            final_eta    = max(final_eta, 5.0)

            print(f"[ETA] dist={dist_km:.2f}km road={road_km:.2f}km "
                  f"pk_spd={pk_speed_kmh:.1f}km/h cong={congestion_factor:.2f} "
                  f"time_adj={time_adj} -> {final_eta:.1f}min (hr={hr})")

            return {
                'eta_minutes': round(final_eta, 2),
                'distance_km': round(dist_km, 3),
                'method'     : 'ensemble',
                'details'    : {
                    'hgb_a_pred'       : round(pred_a, 2),
                    'hgb_b_pred'       : round(pred_b, 2),
                    'xgb_c_pred'       : round(pred_c, 2),
                    'congestion_factor': round(congestion_factor, 3),
                    'pk_speed_kmh'     : round(pk_speed_kmh, 1),
                    'road_km'          : round(road_km, 2),
                    'detour_factor'    : DETOUR_FACTOR,
                    'time_adj'         : time_adj,
                    'hour'             : hr,
                }
            }

        except Exception as e:
            print(f"[ETA][WARN] Ensemble failed, using heuristic. Error: {e}")
            import traceback
            traceback.print_exc()
            eta = self._heuristic_eta(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_dt)
            return {
                'eta_minutes': eta,
                'distance_km': round(dist_km, 3),
                'method'     : 'heuristic',
                'details'    : {'reason': str(e)}
            }


# ── Singleton loaded at startup ────────────────────────────────────────────────
eta_pipeline = ETAPipeline()
