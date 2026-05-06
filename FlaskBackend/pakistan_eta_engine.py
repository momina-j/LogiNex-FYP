"""
pakistan_eta_engine.py
======================
Progressive ETA engine with Pakistan/Lahore-specific adjustments.
Integrates with the existing ETAPipeline (eta_final/ ensemble).

Usage:
    from pakistan_eta_engine import PakistanETAEngine, DriverProfile
    engine = PakistanETAEngine()
    result = engine.predict_route(
        origin_lat=31.5204, origin_lng=74.3587,
        dest_lat=31.4504, dest_lng=74.2760,
        dispatch_dt=datetime.datetime.now(),
        driver=DriverProfile(city='Lahore', fuel='petrol', experience_years=3, total_deliveries=210)
    )
"""

import datetime
import math
import os
import warnings
from dataclasses import dataclass, field
from typing import Optional

warnings.filterwarnings('ignore')

# ══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class DriverProfile:
    city: str = 'Lahore'
    fuel: str = 'petrol'          # 'petrol' | 'cng' | 'diesel'
    experience_years: float = 2.0
    total_deliveries: int = 100
    is_lahori: Optional[bool] = None  # auto-resolved if None

    def __post_init__(self):
        if self.is_lahori is None:
            self.is_lahori = (
                self.city.lower() in ['lahore', 'lhr'] and
                self.experience_years >= 2
            )


@dataclass
class Segment:
    index: int
    dist_km: float
    base_duration_min: float
    road_type: str          # motorway | gt_road | arterial | inner_city
    start_lat: float
    start_lng: float


@dataclass
class AdjustedSegment:
    index: int
    dist_km: float
    base_duration_min: float
    adjusted_duration_min: float
    buffer_factor: float
    trigger: str            # '' if no buffer triggered
    arrival_time: str       # ISO format HH:MM:SS
    road_type: str


# ══════════════════════════════════════════════════════════════════════════════
# LAHORE SPECIFIC CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

# Major mosque coordinates (Lahore) — Friday prayer buffer radius: 500 m
LAHORE_MOSQUES = [
    (31.5497, 74.3436, 'Badshahi Mosque'),
    (31.5204, 74.3587, 'Jamia Hanfiyah Gulberg'),
    (31.5100, 74.3483, 'Garden Town Mosque'),
    (31.4757, 74.3084, 'Model Town Mosque'),
    (31.5686, 74.3185, 'Androon Shehr Central Mosque'),
    (31.5008, 74.3541, 'DHA Mosque'),
]

# Known flooded underpass centroids (Lahore monsoon)
FLOOD_ZONES = [
    (31.5640, 74.3120, 'Farooq Ganj Underpass'),
    (31.5580, 74.3090, 'Data Nagar Underpass'),
    (31.5700, 74.2980, 'Gulshan-e-Ravi Underpass'),
]

# Protest flashpoints: (lat_min, lat_max, lng_min, lng_max, label, buffer_min)
PROTEST_FLASHPOINTS = [
    (31.4200, 31.4600, 74.2500, 74.3100, 'Multan Road LHR', 45),
    (31.3900, 31.4100, 74.2300, 74.2600, 'Thokar Niaz Baig', 45),
    (31.5600, 31.5900, 74.3900, 74.4200, 'Babu Sabu', 30),
]

# Canal Bank / Ring Road coords (winter fog buffer)
FOG_ROAD_ZONES = [
    (31.4800, 31.5800, 74.2800, 74.3900, 'Canal Bank Road'),
    (31.4200, 31.5200, 74.2000, 74.3200, 'Lahore Ring Road'),
]


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + (
        math.cos(math.radians(lat1)) *
        math.cos(math.radians(lat2)) *
        math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _point_in_bbox(lat: float, lng: float,
                   lat_min: float, lat_max: float,
                   lng_min: float, lng_max: float) -> bool:
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


def _within_radius_km(lat1: float, lng1: float,
                      lat2: float, lng2: float,
                      radius_km: float) -> bool:
    return _haversine_km(lat1, lng1, lat2, lng2) <= radius_km


# ══════════════════════════════════════════════════════════════════════════════
# SEGMENT SYNTHESIZER
# Generates synthetic segments from origin→destination using Haversine splits.
# When GraphHopper is available, replace this with real segment parsing.
# ══════════════════════════════════════════════════════════════════════════════

def _classify_road_from_distance(dist_km: float) -> str:
    """Heuristic: classify road type based on trip length for synthetic segments."""
    if dist_km > 80:
        return 'motorway'
    elif dist_km > 40:
        return 'gt_road'
    elif dist_km > 10:
        return 'arterial'
    else:
        return 'inner_city'


ROAD_SPEED = {
    'motorway': 100.0,
    'gt_road': 60.0,
    'arterial': 32.0,
    'inner_city': 15.0,
}


def synthesize_segments(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    n_segments: int = 6
) -> list:
    """
    Split the route into n_segments equally-spaced synthetic segments.
    Each segment gets a road_type based on its position in the journey:
      - First 20%: inner_city (leaving origin)
      - Middle 60%: arterial or gt_road (based on total trip length)
      - Last 20%: inner_city (entering destination)
    """
    total_km = _haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    detour = 1.35 if total_km < 40 else 1.25 if total_km < 80 else 1.15
    segments = []

    for i in range(n_segments):
        frac_start = i / n_segments
        frac_mid = (i + 0.5) / n_segments

        # Interpolate midpoint lat/lng for buffer checks
        mid_lat = origin_lat + frac_mid * (dest_lat - origin_lat)
        mid_lng = origin_lng + frac_mid * (dest_lng - origin_lng)

        seg_km = (total_km * detour) / n_segments

        # Assign road type
        if frac_mid < 0.20 or frac_mid > 0.80:
            road_type = 'inner_city'
        elif total_km > 40:
            road_type = 'gt_road' if frac_mid > 0.35 and frac_mid < 0.65 else 'arterial'
        else:
            road_type = 'arterial'

        speed_kmh = ROAD_SPEED[road_type]
        base_dur = (seg_km / speed_kmh) * 60.0

        segments.append(Segment(
            index=i,
            dist_km=round(seg_km, 3),
            base_duration_min=round(base_dur, 2),
            road_type=road_type,
            start_lat=round(mid_lat, 6),
            start_lng=round(mid_lng, 6),
        ))

    return segments


# ══════════════════════════════════════════════════════════════════════════════
# PAKISTAN BUFFER LAYER
# ══════════════════════════════════════════════════════════════════════════════

class PakistanBufferLayer:
    """
    Applies Lahore/Pakistan-specific buffer factors to a single segment
    given the estimated arrival time at that segment.
    """

    def get_buffer(
        self,
        seg: Segment,
        arrival: datetime.datetime,
        active_protests: list = None,   # list of string labels
        is_ramadan: bool = False,
        iftar_time: Optional[datetime.datetime] = None,
    ) -> tuple:
        """
        Returns (factor: float, trigger: str).
        factor >= 1.0 means slowdown; 0.85 allowed for motorway night bonus.
        """
        active_protests = active_protests or []
        factor = 1.0
        triggers = []

        hr = arrival.hour
        weekday = arrival.weekday()  # 0=Mon, 4=Fri, 5=Sat, 6=Sun

        # ── Road-type speed cap already baked into base_duration; no extra factor ──
        # Apply time-of-day on top of base

        # ── Rush Hour ────────────────────────────────────────────────────────
        is_rush = (7 <= hr < 10) or (16 <= hr < 20)
        is_night = hr < 5 or hr >= 23

        if seg.road_type in ('arterial', 'inner_city'):
            if (7 <= hr < 10):
                factor = max(factor, 1.20)
                triggers.append('morning_rush')
            elif (16 <= hr < 20):
                factor = max(factor, 1.25)
                triggers.append('evening_rush')

        # ── Night Bonus ──────────────────────────────────────────────────────
        if is_night and seg.road_type != 'inner_city':
            factor = min(factor, 0.90)  # can undercut 1.0 for fast night
            triggers.append('night_bonus')

        # ── Friday Prayer (12:00–14:30 within 500 m of major mosque) ────────
        if weekday == 4 and (12 * 60 <= hr * 60 + arrival.minute <= 14 * 60 + 30):
            for mlat, mlng, mname in LAHORE_MOSQUES:
                if _within_radius_km(seg.start_lat, seg.start_lng, mlat, mlng, 0.5):
                    factor = max(factor, 1.50)
                    triggers.append(f'friday_prayer:{mname}')
                    break

        # ── Ramadan Iftar (1 hr before to 30 min after iftar) ────────────────
        if is_ramadan and iftar_time:
            iftar_window_start = iftar_time - datetime.timedelta(minutes=60)
            iftar_window_end = iftar_time + datetime.timedelta(minutes=30)
            if iftar_window_start.time() <= arrival.time() <= iftar_window_end.time():
                if seg.road_type in ('arterial', 'inner_city'):
                    factor = max(factor, 1.30)
                    triggers.append('ramadan_iftar')

        # ── Protest Flashpoints ───────────────────────────────────────────────
        for lat_min, lat_max, lng_min, lng_max, label, buffer_min in PROTEST_FLASHPOINTS:
            if label in active_protests:
                if _point_in_bbox(seg.start_lat, seg.start_lng, lat_min, lat_max, lng_min, lng_max):
                    # Fixed buffer — we flag it; engine adds flat minutes
                    factor = max(factor, 2.0)
                    triggers.append(f'protest:{label}:+{buffer_min}min')
                    break

        # ── Monsoon Flooding (July–August, underpass zones) ──────────────────
        if arrival.month in (7, 8):
            for flat, flng, fname in FLOOD_ZONES:
                if _within_radius_km(seg.start_lat, seg.start_lng, flat, flng, 0.3):
                    factor = max(factor, 1.40)
                    triggers.append(f'monsoon_flood:{fname}')
                    break

        # ── Winter Fog (Dec–Jan, Canal Bank / Ring Road after 22:00) ─────────
        if arrival.month in (12, 1) and hr >= 22:
            for lat_min, lat_max, lng_min, lng_max, zone_name in FOG_ROAD_ZONES:
                if _point_in_bbox(seg.start_lat, seg.start_lng, lat_min, lat_max, lng_min, lng_max):
                    factor = max(factor, 1.30)
                    triggers.append(f'winter_fog:{zone_name}')
                    break

        # Cap factor
        factor = max(0.80, min(factor, 2.50))
        trigger_str = ','.join(triggers) if triggers else ''
        return round(factor, 3), trigger_str


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER CALIBRATION
# ══════════════════════════════════════════════════════════════════════════════

def get_driver_calibration(driver: DriverProfile, dispatch_dt: datetime.datetime, total_km: float):
    """
    Returns (factor, extra_minutes, label).
    Applied ONCE to total accumulated ETA after segment sum.
    """
    factor = 1.0
    extra_min = 0.0
    labels = []

    if driver.is_lahori and driver.total_deliveries >= 50:
        factor = min(factor, 0.85)
        labels.append('lahori_driver')
    elif not driver.is_lahori or driver.total_deliveries < 20:
        factor = max(factor, 1.40)
        labels.append('out_of_city_driver')

    if driver.total_deliveries < 50:
        factor = max(factor, 1.20)
        labels.append('new_driver')

    # CNG morning queue buffer
    if (driver.fuel == 'cng' and
            total_km > 20 and
            6 <= dispatch_dt.hour < 9):
        extra_min = 17.5   # midpoint of 15–20 min
        labels.append('cng_morning_queue')

    label = ','.join(labels) if labels else 'standard'
    return round(factor, 3), round(extra_min, 1), label


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class PakistanETAEngine:
    """
    Full ETA engine for Pakistani dispatch.
    Combines:
      - Synthetic segment generation (or GraphHopper segments when available)
      - ETAPipeline ML ensemble for congestion factor
      - Pakistan buffer layer (per-segment, progressive time)
      - Driver calibration
    """

    def __init__(self):
        self.buffer_layer = PakistanBufferLayer()
        self._load_ml_pipeline()

    def _load_ml_pipeline(self):
        """Load the existing eta_final ensemble."""
        try:
            from eta_pipeline import eta_pipeline
            if not eta_pipeline.ready:
                eta_pipeline.load()
            self.eta_pipeline = eta_pipeline
        except Exception as e:
            print(f'[PakistanETA] Could not load ETAPipeline: {e}')
            self.eta_pipeline = None

    def predict_route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        dispatch_dt: Optional[datetime.datetime] = None,
        driver: Optional[DriverProfile] = None,
        active_protests: list = None,
        is_ramadan: bool = False,
        iftar_time: Optional[datetime.datetime] = None,
        n_segments: int = 6,
        graphhopper_segments: Optional[list] = None,  # future: real GH segments
    ) -> dict:
        """
        Run full Pakistan-adjusted ETA prediction.

        Returns dict with:
          eta_minutes, confidence_band, distance_km,
          segments_adjusted, buffers_triggered, driver_calibration, method
        """
        if dispatch_dt is None:
            dispatch_dt = datetime.datetime.now()
        if driver is None:
            driver = DriverProfile()

        total_km = _haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)

        # ── Step 1: Segments ──────────────────────────────────────────────────
        if graphhopper_segments:
            segments = graphhopper_segments
        else:
            segments = synthesize_segments(
                origin_lat, origin_lng, dest_lat, dest_lng, n_segments
            )

        # ── Step 2: ML Congestion Factor ──────────────────────────────────────
        congestion_factor = 1.0
        ml_method = 'heuristic'
        if self.eta_pipeline and self.eta_pipeline.ready:
            try:
                ml_result = self.eta_pipeline.predict(
                    origin_lat, origin_lng, dest_lat, dest_lng, dispatch_dt
                )
                # Extract congestion factor from details
                congestion_factor = ml_result.get('details', {}).get(
                    'congestion_factor', 1.0
                )
                ml_method = ml_result.get('method', 'heuristic')
            except Exception as e:
                print(f'[PakistanETA] ML predict failed: {e}')

        # ── Step 3: Progressive Segment Accumulation ─────────────────────────
        accumulated_min = 0.0
        adjusted_segments = []
        all_triggers = []

        for seg in segments:
            arrival_at_seg = dispatch_dt + datetime.timedelta(minutes=accumulated_min)

            buf_factor, trigger = self.buffer_layer.get_buffer(
                seg, arrival_at_seg,
                active_protests=active_protests,
                is_ramadan=is_ramadan,
                iftar_time=iftar_time,
            )

            # Apply both ML congestion AND buffer to this segment
            # ML congestion is global; buffer is per-segment
            adj_dur = seg.base_duration_min * congestion_factor * buf_factor
            adj_dur = max(adj_dur, 0.1)
            accumulated_min += adj_dur

            if trigger:
                all_triggers.extend(trigger.split(','))

            adjusted_segments.append(AdjustedSegment(
                index=seg.index,
                dist_km=seg.dist_km,
                base_duration_min=seg.base_duration_min,
                adjusted_duration_min=round(adj_dur, 2),
                buffer_factor=buf_factor,
                trigger=trigger,
                arrival_time=arrival_at_seg.strftime('%H:%M:%S'),
                road_type=seg.road_type,
            ))

        # ── Step 4: Driver Calibration ────────────────────────────────────────
        drv_factor, drv_extra, drv_label = get_driver_calibration(
            driver, dispatch_dt, total_km
        )
        accumulated_min = accumulated_min * drv_factor + drv_extra

        # ── Step 5: Handling Time ─────────────────────────────────────────────
        handling_min = 8.0
        final_eta = round(max(accumulated_min + handling_min, 5.0), 2)

        # ── Step 6: Confidence Band ───────────────────────────────────────────
        confidence_min = round(final_eta * 0.85, 1)
        confidence_max = round(final_eta * 1.30, 1)

        unique_triggers = list(dict.fromkeys(all_triggers))  # deduplicate, preserve order

        return {
            'eta_minutes': final_eta,
            'confidence_band': {'min': confidence_min, 'max': confidence_max},
            'distance_km': round(total_km, 3),
            'segments_adjusted': [
                {
                    'index': s.index,
                    'dist_km': s.dist_km,
                    'base_duration_min': s.base_duration_min,
                    'adjusted_duration_min': s.adjusted_duration_min,
                    'buffer_factor': s.buffer_factor,
                    'trigger': s.trigger,
                    'arrival_time': s.arrival_time,
                    'road_type': s.road_type,
                }
                for s in adjusted_segments
            ],
            'buffers_triggered': unique_triggers,
            'driver_calibration': {
                'factor': drv_factor,
                'extra_minutes': drv_extra,
                'type': drv_label,
            },
            'ml_congestion_factor': round(congestion_factor, 3),
            'method': f'pakistan_engine+{ml_method}',
        }


# Singleton
pakistan_eta_engine = PakistanETAEngine()
