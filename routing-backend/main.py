from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Union, Optional
from fastapi.middleware.cors import CORSMiddleware
from geocoder import geocode_address
from router import optimizer
import uvicorn

app = FastAPI()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OptimizeRequest(BaseModel):
    start: Union[str, List[float]]  # Address or [lat, lng]
    stops: List[Union[str, List[float]]]  # List of addresses or [[lat, lng], ...]
    vehicle_type: Optional[str] = "car"  # car, bike, foot

@app.post("/optimize")
async def optimize_route(request: OptimizeRequest):
    """
    Endpoint to receive a starting point and multiple stops, 
    returning the optimized shortest road path.
    """
    # 1. Resolve start location
    start_coords = None
    if isinstance(request.start, str):
        start_coords = geocode_address(request.start)
    else:
        start_coords = (request.start[0], request.start[1])

    if not start_coords:
        raise HTTPException(status_code=400, detail="Invalid start address or coordinates")

    # 2. Resolve stops
    resolved_stops = []
    for stop in request.stops:
        if isinstance(stop, str):
            coords = geocode_address(stop)
            if coords:
                resolved_stops.append(coords)
        else:
            resolved_stops.append((stop[0], stop[1]))

    if not resolved_stops:
        raise HTTPException(status_code=400, detail="No valid stops provided")

    # 3. Optimize
    # Map vehicle type to OSMnx modes
    mode_map = {"car": "drive", "bike": "bike", "foot": "walk"}
    optimizer.mode = mode_map.get(request.vehicle_type, "drive")

    result = optimizer.get_route(start_coords, resolved_stops)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "routing-optimizer"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
