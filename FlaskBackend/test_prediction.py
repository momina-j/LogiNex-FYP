import joblib
import pickle
import pandas as pd
import numpy as np
import warnings
import sys
warnings.filterwarnings('ignore')

try:
    feature_columns = pickle.load(open('delay/feature_columns.pkl', 'rb'))
    cat_cols = pickle.load(open('delay/cat_cols.pkl', 'rb'))
    ordinal_encoder = pickle.load(open('delay/ordinal_encoder.pkl', 'rb'))
    model = joblib.load('delay/hist_gb_model.joblib')
    noise_config = pickle.load(open('delay/noise_config.pkl', 'rb'))
    best_threshold = pickle.load(open('delay/best_threshold.pkl', 'rb'))
    
    print("Feature columns:", feature_columns)
    print("Cat columns:", cat_cols)
    print("Best threshold:", best_threshold)
    print("Noise config:", noise_config)
    print("Model classes_: ", getattr(model, 'classes_', 'N/A'))
    
    # Create dummy DataFrame using defaults
    dummy_input = {}
    for col in feature_columns:
        if col in cat_cols:
            dummy_input[col] = 'Unknown'
        else:
            dummy_input[col] = 0.0
            
    # Add some valid values for known categorical cols
    dummy_input['city'] = 'Lahore'
    dummy_input['vehicle_type'] = 'bike'
    dummy_input['weather_condition'] = 'Clear'
    dummy_input['congestion_level'] = 'Low'
    dummy_input['supplier_country'] = 'PK'
    
    df = pd.DataFrame([dummy_input])
    
    # Apply ordinal mapping exactly like the pipeline requires
    for col in cat_cols:
        mapping = ordinal_encoder.get(col, {})
        val = df[col].iloc[0]
        mapped_val = mapping.get(val, -1)
        df[col] = mapped_val
        
        # Ensure correct type (str to float)
        df[col] = pd.to_numeric(df[col], errors='coerce')
        
    for col in feature_columns:
        df[col] = pd.to_numeric(df[col], errors='coerce').astype(np.float64)
        
    print("Running prediction...")
    probs = model.predict_proba(df)[0]
    preds = model.predict(df)[0]
    print(f"Probabilities: {probs}")
    print(f"Prediction: {preds}")
    print(f"Threshold applied: {probs[1] > best_threshold}")
    
except Exception as e:
    import traceback
    traceback.print_exc()
