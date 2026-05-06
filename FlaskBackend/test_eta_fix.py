"""
Quick sanity-check for the fixed ETA pipeline.
Tests a 30.7 km trip (should give ~50-60 min at typical daytime conditions).
"""
import datetime
import warnings
warnings.filterwarnings('ignore')

from eta_pipeline import eta_pipeline
eta_pipeline.load()

print("\n" + "="*60)
print("ETA SANITY TESTS")
print("="*60)

# ── Test 1: 30.7 km Lahore cross-city trip (daytime normal hours) ──
# Baseline: ~30.7 km, daytime, should be ~50-60 min
result = eta_pipeline.predict(
    pickup_lat=31.5204, pickup_lng=74.3587,   # Lahore center
    dropoff_lat=31.3671, dropoff_lng=74.1564, # ~30 km south-west
    pickup_dt=datetime.datetime(2024, 4, 10, 11, 0, 0)  # 11:00 AM
)
dist = eta_pipeline._haversine_km(31.5204, 74.3587, 31.3671, 74.1564)
print(f"\nTest 1: Lahore cross-city (~{dist:.1f} km air, ~{dist*1.35:.1f} km road)")
print(f"  ETA    : {result['eta_minutes']} min")
print(f"  Method : {result['method']}")
print(f"  Details: {result['details']}")
print(f"  Expected: ~50-65 min")

# ── Test 2: Short 5 km trip ──
result2 = eta_pipeline.predict(
    pickup_lat=31.5204, pickup_lng=74.3587,
    dropoff_lat=31.5620, dropoff_lng=74.3640,  # ~5 km north
    pickup_dt=datetime.datetime(2024, 4, 10, 9, 0, 0)  # 9:00 AM (rush)
)
dist2 = eta_pipeline._haversine_km(31.5204, 74.3587, 31.5620, 74.3640)
print(f"\nTest 2: Short trip (~{dist2:.1f} km air, rush hour 9 AM)")
print(f"  ETA    : {result2['eta_minutes']} min")
print(f"  Details: {result2['details']}")
print(f"  Expected: ~18-28 min")

# ── Test 3: 50 km inter-city leg ──
result3 = eta_pipeline.predict(
    pickup_lat=31.5204, pickup_lng=74.3587,   # Lahore
    dropoff_lat=31.1704, dropoff_lng=72.7097, # ~130km (Faisalabad area)
    pickup_dt=datetime.datetime(2024, 4, 10, 14, 0, 0)  # 2 PM afternoon
)
dist3 = eta_pipeline._haversine_km(31.5204, 74.3587, 31.1704, 72.7097)
print(f"\nTest 3: Long-haul (~{dist3:.1f} km air)")
print(f"  ETA    : {result3['eta_minutes']} min ({result3['eta_minutes']/60:.1f} hrs)")
print(f"  Expected: ~2.5-3.5 hrs")

# ── Test 4: Night trip ──
result4 = eta_pipeline.predict(
    pickup_lat=31.5204, pickup_lng=74.3587,
    dropoff_lat=31.3671, dropoff_lng=74.1564,
    pickup_dt=datetime.datetime(2024, 4, 10, 2, 0, 0)  # 2 AM night
)
print(f"\nTest 4: Night trip same 30km route (2 AM)")
print(f"  ETA    : {result4['eta_minutes']} min")
print(f"  Expected: ~38-50 min (faster than daytime)")

print("\n" + "="*60)
