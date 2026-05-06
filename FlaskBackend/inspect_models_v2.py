import joblib
import os

def inspect_model(filename):
    model_path = os.path.join(os.getcwd(), filename)
    if not os.path.exists(model_path):
        print(f"File {filename} not found.")
        return

    try:
        model = joblib.load(model_path)
        print(f"\n--- Model: {filename} ---")
        print(f"Type: {type(model)}")
        if hasattr(model, 'n_features_in_'):
            print(f"Features: {model.n_features_in_}")
        if hasattr(model, 'feature_names_in_'):
            print(f"Feature Names: {model.feature_names_in_}")
        
        # If it's a scikit-learn model, we can try to see parameters
        if hasattr(model, 'get_params'):
            params = model.get_params()
            print(f"Model params summary: {list(params.keys())[:5]}...")
            
    except Exception as e:
        print(f"Error inspecting {filename}: {e}")

inspect_model('eta_model.pkl')
inspect_model('delay_minutes_model.pkl')
