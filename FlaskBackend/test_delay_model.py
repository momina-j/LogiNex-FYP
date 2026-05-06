import joblib
import pickle
import sys

print('Python version:', sys.version)
import numpy
print('NumPy version:', numpy.__version__)
import sklearn
print('Sklearn version:', sklearn.__version__)

try:
    model = joblib.load('delay/hist_gb_model.joblib')
    print('Successfully loaded model')
except Exception as e:
    print('Failed to load model:', type(e), e)
