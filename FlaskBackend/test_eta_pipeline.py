from eta_pipeline import eta_pipeline
eta_pipeline.load()

tests = [
    (31.52, 74.35, 31.53, 74.36),  # ~1.3 km Lahore
    (31.52, 74.35, 31.58, 74.42),  # ~9.4 km Lahore
    (31.52, 74.35, 31.80, 74.70),  # ~40 km
    (24.86, 67.00, 24.90, 67.05),  # ~6 km Karachi
]
for plat, plng, dlat, dlng in tests:
    dist = eta_pipeline._haversine_km(plat, plng, dlat, dlng)
    r = eta_pipeline.predict(plat, plng, dlat, dlng)
    print(f"  dist={dist:.1f}km  eta={r['eta_minutes']}min  method={r['method']}")
    print(f"    base preds -> a={r['details'].get('hgb_a_pred')} b={r['details'].get('hgb_b_pred')} c={r['details'].get('xgb_c_pred')}")
