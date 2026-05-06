import joblib
import pickle
import numpy as np
import os

model_path = os.path.join(os.path.dirname(__file__), 'eta_model.pkl')

try:
    # Try joblib first
    try:
        model = joblib.load(model_path)
        print("Loaded with joblib")
    except:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        print("Loaded with pickle")

    print(f"Model type: {type(model)}")
    
    # Check if it's a pipeline or model
    if hasattr(model, 'n_features_in_'):
        print(f"Number of features expected: {model.n_features_in_}")
    
    if hasattr(model, 'feature_names_in_'):
        print(f"Feature names: {model.feature_names_in_}")
    
except Exception as e:
    print(f"Error: {e}")
