from geopy.geocoders import Nominatim
from geopy.exc import GeopyError
import time

geolocator = Nominatim(user_agent="route_optimizer_app")

def geocode_address(address: str):
    """
    Converts an address string to (latitude, longitude).
    """
    try:
        # Rate limiting: wait 1 second between requests (Nominatim policy)
        time.sleep(1)
        location = geolocator.geocode(address)
        if location:
            return (location.latitude, location.longitude)
        return None
    except GeopyError as e:
        print(f"Geocoding error for {address}: {e}")
        return None

def reverse_geocode(lat: float, lng: float):
    """
    Converts (latitude, longitude) to an address string.
    """
    try:
        time.sleep(1)
        location = geolocator.reverse((lat, lng))
        if location:
            return location.address
        return None
    except GeopyError as e:
        print(f"Reverse geocoding error: {e}")
        return None
