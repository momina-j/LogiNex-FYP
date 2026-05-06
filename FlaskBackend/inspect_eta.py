"""
Inspect the eta_final model components to understand the pipeline.
"""
import joblib
import os
import numpy as np

ETA_DIR = os.path.join(os.path.dirname(__file__), 'eta_final')

models = {
    'hgb_a': 'hgb_a_v4.pkl',
    'hgb_b': 'hgb_b_v4.pkl',
    'meta_model': 'meta_model_v4.pkl',
    'meta_scaler': 'meta_scaler_v4.pkl',
    'meta_v4': 'meta_v4.pkl',
    'xgb_c': 'xgb_c_v4.pkl',
}

loaded = {}
for name, fname in models.items():
    path = os.path.join(ETA_DIR, fname)
    try:
        obj = joblib.load(path)
        loaded[name] = obj
        print(f"\n=== {name} ({fname}) ===")
        print(f"  Type: {type(obj)}")
        if hasattr(obj, '__class__'):
            print(f"  Class: {obj.__class__.__name__}")
        if hasattr(obj, 'n_features_in_'):
            print(f"  n_features_in_: {obj.n_features_in_}")
        if hasattr(obj, 'feature_names_in_'):
            print(f"  feature_names_in_: {list(obj.feature_names_in_)}")
        if hasattr(obj, 'n_iter_'):
            print(f"  n_iter_: {obj.n_iter_}")
        if hasattr(obj, 'get_params'):
            params = obj.get_params()
            # Only print key params
            key_params = {k: v for k, v in params.items() if k in ['max_iter', 'learning_rate', 'max_depth', 'n_estimators', 'loss', 'objective']}
            print(f"  Key params: {key_params}")
        # Check if it's a scaler
        if hasattr(obj, 'mean_'):
            print(f"  mean_: {obj.mean_}")
            print(f"  scale_: {obj.scale_}")
            print(f"  n_features_in_: {obj.n_features_in_}")
        # Check if dict
        if isinstance(obj, dict):
            print(f"  Keys: {list(obj.keys())}")
            for k, v in obj.items():
                print(f"    {k}: {type(v)} = {v if not hasattr(v, 'shape') else v.shape}")
        # Check if tuple or list
        if isinstance(obj, (list, tuple)):
            print(f"  Length: {len(obj)}")
            print(f"  Contents: {[type(x).__name__ for x in obj]}")
    except Exception as e:
        print(f"\n=== {name} ({fname}) ===")
        print(f"  ERROR: {e}")

print("\n\n=== PIPELINE INFERENCE TEST ===")
# Try to figure out the pipeline by inspecting inputs/outputs
# Try a sample prediction if possible
try:
    hgb_a = loaded.get('hgb_a')
    hgb_b = loaded.get('hgb_b')
    xgb_c = loaded.get('xgb_c')
    meta_scaler = loaded.get('meta_scaler')
    meta_model = loaded.get('meta_model')
    meta_v4 = loaded.get('meta_v4')

    print(f"\nmeta_v4 type: {type(meta_v4)}")
    if isinstance(meta_v4, dict):
        print(f"  meta_v4 keys: {list(meta_v4.keys())}")
    elif hasattr(meta_v4, 'predict'):
        print(f"  meta_v4 is a model with predict method")
        if hasattr(meta_v4, 'n_features_in_'):
            print(f"  meta_v4.n_features_in_: {meta_v4.n_features_in_}")
        if hasattr(meta_v4, 'feature_names_in_'):
            print(f"  meta_v4.feature_names_in_: {list(meta_v4.feature_names_in_)}")

    # Try dummy input for hgb_a
    if hgb_a is not None and hasattr(hgb_a, 'n_features_in_'):
        n = hgb_a.n_features_in_
        print(f"\nhgb_a expects {n} features")
        X_dummy = np.ones((1, n))
        try:
            pred_a = hgb_a.predict(X_dummy)
            print(f"  hgb_a prediction: {pred_a}")
        except Exception as ex:
            print(f"  hgb_a predict error: {ex}")

    if hgb_b is not None and hasattr(hgb_b, 'n_features_in_'):
        n = hgb_b.n_features_in_
        print(f"\nhgb_b expects {n} features")

    if xgb_c is not None and hasattr(xgb_c, 'n_features_in_'):
        n = xgb_c.n_features_in_
        print(f"\nxgb_c expects {n} features")
        if hasattr(xgb_c, 'feature_names_in_'):
            print(f"  xgb_c feature names: {list(xgb_c.feature_names_in_)}")

except Exception as e:
    print(f"Inference test error: {e}")
    import traceback
    traceback.print_exc()
