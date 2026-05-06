import os
import json
import joblib
import pickle
import numpy as np
import pandas as pd
from firebase_functions import https_fn
from firebase_admin import initialize_app

initialize_app()

def json_dumps(data):
    """Serialize data to a JSON-formatted string."""
    return json.dumps(data)

# Load the model lazily
model = None

def load_model():
    global model
    if model is not None:
        return model
    
    model_path = os.path.join(os.path.dirname(__file__), "eta_model.pkl")
    try:
        try:
            model = joblib.load(model_path)
        except Exception:
            with open(model_path, "rb") as f:
                model = pickle.load(f)
        return model
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

@https_fn.on_request()
def predict_eta(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function for ETA prediction."""
    try:
        if req.method == "OPTIONS":
            # Handle CORS preflight
            return https_fn.Response(status=204, headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "3600"
            })

        data = req.get_json()
        if not data:
            return https_fn.Response("No data provided", status=400)

        # Extract features (priority to new features, fallback to old ones)
        distance_m = float(data.get("distance_meters", data.get("distance", 10.0) * 1000))
        hour = int(data.get("hour_of_day", 12))
        day = int(data.get("day_of_week", 1))
        weekend = int(data.get("is_weekend", False))
        exp_score = float(data.get("driver_experience_score", 3.0))

        # We assume the model was retrained for these 5 features
        features = [distance_m, hour, day, weekend, exp_score]
        clf = load_model()

        if clf:
            query = np.array([features])
            try:
                prediction = clf.predict(query)
            except Exception as e:
                # Fallback if the model still expects [distance, weight, volume]
                print(f"Model prediction error with new features: {e}. Falling back to old feature format.")
                weight = float(data.get("weight", 1.0))
                volume = float(data.get("volume", 0.1))
                old_features = [distance_m / 1000.0, weight, volume]
                prediction = clf.predict(np.array([old_features]))
            
            if hasattr(prediction, "tolist"):
                result = prediction.tolist()[0]
            else:
                result = float(prediction)
        else:
            # Fallback
            weight = float(data.get("weight", 1.0))
            result = (distance_m / 1000.0) * 2.0 + weight * 1.5 + 20

        return https_fn.Response(
            json_dumps({
                "success": True,
                "prediction": result,
                "unit": "minutes",
                "using_fallback": clf is None,
                "features_received": {
                    "distance_meters": distance_m,
                    "hour_of_day": hour,
                    "day_of_week": day,
                    "is_weekend": weekend,
                    "driver_experience_score": exp_score
                }
            }),
            status=200,
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        )

    except Exception as e:
        return https_fn.Response(
            json_dumps({"success": False, "error": str(e)}),
            status=500,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

# json_dumps is defined at the top of this module
