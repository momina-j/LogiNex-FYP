import datetime
from pakistan_eta_engine import pakistan_eta_engine, DriverProfile

def test_engine():
    print("\n" + "="*60)
    print("PAKISTAN ETA ENGINE - SYSTEM TEST")
    print("="*60)

    # Cross-city Lahore (~15km haversine)
    # Origin: Gulberg (31.5204, 74.3587)
    # Destination: DHA Phase 6 (~31.4504, 74.4500)
    
    origin = (31.5204, 74.3587)
    dest = (31.4504, 74.4500)
    
    driver = DriverProfile(city='Lahore', experience_years=3, total_deliveries=200)

    # Test Case 1: Standard Afternoon
    dt1 = datetime.datetime.now().replace(hour=14, minute=0)
    res1 = pakistan_eta_engine.predict_route(
        origin[0], origin[1], dest[0], dest[1],
        dispatch_dt=dt1, driver=driver
    )
    
    print(f"\nTrip: Gulberg -> DHA (~{res1['distance_km']:.1f} km air)")
    print(f"Time: {dt1.strftime('%I:%M %p')}")
    print(f"ETA : {res1['eta_minutes']} min")
    print(f"ML Congestion: {res1['ml_congestion_factor']}")
    print(f"Buffers: {res1['buffers_triggered']}")

    # Test Case 2: Rush Hour
    dt2 = datetime.datetime.now().replace(hour=18, minute=0)
    res2 = pakistan_eta_engine.predict_route(
        origin[0], origin[1], dest[0], dest[1],
        dispatch_dt=dt2, driver=driver
    )
    print(f"\nTime: {dt2.strftime('%I:%M %p')} (Rush Hour)")
    print(f"ETA : {res2['eta_minutes']} min")
    print(f"Buffers: {res2['buffers_triggered']}")

    # Test Case 3: Short Trip (2km)
    origin_short = (31.5204, 74.3587)
    dest_short = (31.5304, 74.3687)
    res3 = pakistan_eta_engine.predict_route(
        origin_short[0], origin_short[1], dest_short[0], dest_short[1],
        dispatch_dt=dt1, driver=driver
    )
    print(f"\nShort Trip: Gulberg Block A -> Block B (~{res3['distance_km']:.1f} km air)")
    print(f"ETA : {res3['eta_minutes']} min")
    print(f"Handling included: 8.0 min")

    print("\n" + "="*60)

if __name__ == "__main__":
    test_engine()
