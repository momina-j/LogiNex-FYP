"""
Deep inspect of meta_v4.pkl to understand the full pipeline.
"""
import joblib
import os
import numpy as np

ETA_DIR = os.path.join(os.path.dirname(__file__), 'eta_final')

meta_v4 = joblib.load(os.path.join(ETA_DIR, 'meta_v4.pkl'))

print("=== meta_v4 keys ===")
for k, v in meta_v4.items():
    print(f"\n  {k}: {type(v).__name__}")
    if isinstance(v, (list, np.ndarray)):
        print(f"    len={len(v)}")
        if len(v) > 0 and len(v) <= 100:
            print(f"    values={v}")
    elif isinstance(v, dict):
        print(f"    sub-keys: {list(v.keys())}")
        # Show first few items
        for sk, sv in list(v.items())[:5]:
            print(f"      {sk}: {sv}")
        if len(v) > 5:
            print(f"      ... ({len(v)} total)")
    elif isinstance(v, (int, float, str, bool)):
        print(f"    value={v}")
    else:
        print(f"    repr={repr(v)[:200]}")

print("\n\n=== FEATURE LIST ===")
features = meta_v4.get('features', [])
print(f"Total features: {len(features)}")
for i, f in enumerate(features):
    print(f"  [{i}] {f}")

print("\n=== META SCALER ===")
meta_scaler = joblib.load(os.path.join(ETA_DIR, 'meta_scaler_v4.pkl'))
print(f"Type: {type(meta_scaler)}")
if hasattr(meta_scaler, 'n_features_in_'):
    print(f"n_features_in_: {meta_scaler.n_features_in_}")
if hasattr(meta_scaler, 'mean_'):
    print(f"mean_: {meta_scaler.mean_}")
    print(f"scale_: {meta_scaler.scale_}")

print("\n=== META MODEL ===")
meta_model = joblib.load(os.path.join(ETA_DIR, 'meta_model_v4.pkl'))
print(f"Type: {type(meta_model)}")
print(f"Class: {meta_model.__class__.__name__}")
if hasattr(meta_model, 'n_features_in_'):
    print(f"n_features_in_: {meta_model.n_features_in_}")
if hasattr(meta_model, 'coef_'):
    print(f"coef_: {meta_model.coef_}")
if hasattr(meta_model, 'get_params'):
    print(f"params: {meta_model.get_params()}")

print("\n=== KEY LOOKUP TABLES FROM meta_v4 ===")
print(f"\nG_ETA = {meta_v4.get('G_ETA')}")
print(f"G_SPD = {meta_v4.get('G_SPD')}")
print(f"FF_SPD = {meta_v4.get('FF_SPD')}")
print(f"LA0 = {meta_v4.get('LA0')}")
print(f"LA1 = {meta_v4.get('LA1')}")
print(f"LO0 = {meta_v4.get('LO0')}")
print(f"LO1 = {meta_v4.get('LO1')}")
print(f"nz1 = {meta_v4.get('nz1')}")
print(f"nz2 = {meta_v4.get('nz2')}")

hr_speed = meta_v4.get('hr_speed_map', {})
print(f"\nhr_speed_map keys (first 10): {list(hr_speed.keys())[:10]}")
print(f"hr_speed_map sample: {dict(list(hr_speed.items())[:5])}")

od_te = meta_v4.get('od_te_lookup', {})
print(f"\nod_te_lookup keys (first 5): {list(od_te.keys())[:5]}")
