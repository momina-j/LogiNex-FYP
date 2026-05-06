import os
import sys

# Add directory to path to import app
sys.path.append(os.path.dirname(__file__))

from app import app
import json

client = app.test_client()

response = client.post('/predict_delay', 
   data=json.dumps({'distance': 15.0, 'weight': 2.5, 'volume': 0.05, 'city': 'Lahore', 'vehicleType': 'bike'}),
   content_type='application/json')

print("Status:", response.status_code)
print("Response:", response.get_data(as_text=True))
