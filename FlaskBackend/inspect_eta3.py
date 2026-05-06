"""
Deep inspect of meta_v4.pkl - get exact feature list and pipeline logic
"""
import joblib
import os
import numpy as np
import warnings
warnings.filterwarnings('ignore')

ETA_DIR = os.path.join(os.path.dirname(__file__), 'eta_final')

meta_v4 = joblib.load(os.path.join(ETA_DIR, 'meta_v4.pkl'))

print("=== FEATURE LIST (63 features) ===")
features = meta_v4.get('features', [])
for i, f in enumerate(features):
    print(f"  [{i:2d}] {f}")

print(f"\n=== CONSTANTS ===")
print(f"G_ETA = {meta_v4['G_ETA']}")
print(f"G_SPD = {meta_v4['G_SPD']}")
print(f"FF_SPD = {meta_v4['FF_SPD']}")
print(f"LA0={meta_v4['LA0']}, LA1={meta_v4['LA1']}")
print(f"LO0={meta_v4['LO0']}, LO1={meta_v4['LO1']}")
print(f"nz1={meta_v4['nz1']}, nz2={meta_v4['nz2']}")

print("\n=== HOUR SPEED MAP (all 24 hours) ===")
for h, speed in sorted(meta_v4['hr_speed_map'].items()):
    print(f"  hour {h:02d}: {float(speed):.2f} m/s")

# Check OD TE lookup - first 10 keys
od_te = meta_v4.get('od_te_lookup', {})
print(f"\n=== OD_TE_LOOKUP (first 10 entries) ===")
for k, v in list(od_te.items())[:10]:
    print(f"  {k}: {v}")

# Now try to reconstruct the full pipeline
print("\n=== META SCALER details ===")
ms = joblib.load(os.path.join(ETA_DIR, 'meta_scaler_v4.pkl'))
print(f"n_features_in_: {ms.n_features_in_}")
print(f"Input: [hgb_a_pred, hgb_b_pred, xgb_c_pred, hgb_a_speed, hgb_b_speed, xgb_c_speed] ?")

print("\n=== META MODEL (Ridge) ===")
mm = joblib.load(os.path.join(ETA_DIR, 'meta_model_v4.pkl'))
print(f"coef_: {mm.coef_}")
print(f"intercept_: {mm.intercept_}")
