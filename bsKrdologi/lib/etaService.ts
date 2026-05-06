/**
 * etaService.ts
 * =============
 * Calls the Flask ML stacked-ensemble ETA predictor.
 *
 * Preferred usage (coordinate-based, runs the full v4 ensemble):
 *   getML_ETA({ pickup_lat, pickup_lng, dropoff_lat, dropoff_lng })
 *
 * Fallback usage (distance-only, uses heuristic):
 *   getML_ETA({ distance, vehicleType })
 */

export interface ETARequest {
  /** Origin latitude (preferred — enables the full ML ensemble) */
  pickup_lat?:   number;
  /** Origin longitude (preferred) */
  pickup_lng?:   number;
  /** Destination latitude (preferred) */
  dropoff_lat?:  number;
  /** Destination longitude (preferred) */
  dropoff_lng?:  number;
  /** Distance in km (fallback when coordinates are unavailable) */
  distance?:     number;
  vehicleType?:  string;
  weight?:       number;
  volume?:       number;
}

export interface ETAResponse {
  success:         boolean;
  prediction:      number;   // ETA in minutes
  unit:            string;
  distance_km?:    number;
  method?:         string;   // 'ensemble' | 'heuristic' | 'distance_heuristic'
  using_fallback?: boolean;
  details?:        Record<string, unknown>;
}

/**
 * Fetches a ML-driven ETA from the Flask backend.
 *
 * Pass coordinates for the full stacked-ensemble prediction, or
 * pass distance alone for a quick heuristic fallback.
 *
 * @returns ETA in minutes, or null on failure.
 */
export async function getML_ETA(input: ETARequest): Promise<number | null> {
  try {
    // Proxied via next.config.ts → http://localhost:5000/predict
    const response = await fetch('/api-ml/predict', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
    });

    if (!response.ok) {
      console.error(`Flask ETA API error: ${response.status}`);
      return null;
    }

    const data: ETAResponse = await response.json();

    if (data.success && typeof data.prediction === 'number') {
      console.log(
        `[ETA] ${data.prediction.toFixed(1)} min ` +
        `| method=${data.method ?? 'unknown'} ` +
        `| dist=${data.distance_km ?? '?'}km`
      );
      return data.prediction;
    }

    return null;
  } catch (error) {
    console.error('Error fetching ML ETA from Flask:', error);
    return null;
  }
}
export interface RouteETARequest {
  origin:      { lat: number; lng: number };
  destination: { lat: number; lng: number };
  dispatch_time?: string;
  driver?: {
    city?: string;
    fuel?: string;
    experience_years?: number;
    total_deliveries?: number;
  };
  active_protests?: string[];
  is_ramadan?:      boolean;
  iftar_time?:      string;
}

export interface RouteETAResponse {
  success: boolean;
  eta_minutes: number;
  confidence_band: { min: number; max: number };
  distance_km: number;
  segments_adjusted: Array<{
    index: number;
    dist_km: number;
    base_duration_min: number;
    adjusted_duration_min: number;
    buffer_factor: number;
    trigger: string;
    arrival_time: string;
    road_type: string;
  }>;
  buffers_triggered: string[];
  driver_calibration: {
    factor: number;
    extra_minutes: number;
    type: string;
  };
  ml_congestion_factor: number;
  method: string;
}

/**
 * Fetches a refined, Pakistan-specific ETA with segment buffers and confidence bands.
 * Calls /predict_route on the Flask backend.
 */
export async function getRouteETA(input: RouteETARequest): Promise<RouteETAResponse | null> {
  try {
    const response = await fetch('/api-ml/predict_route', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
    });

    if (!response.ok) {
      console.error(`Flask Route-ETA API error: ${response.status}`);
      return null;
    }

    const data: RouteETAResponse = await response.json();
    if (data.success) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching Route ETA from Flask:', error);
    return null;
  }
}
