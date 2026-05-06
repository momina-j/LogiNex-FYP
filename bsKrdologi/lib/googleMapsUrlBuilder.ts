/**
 * Builds Google Maps URLs WITHOUT any API key.
 * Uses public embed and redirect URLs.
 */

interface Coords {
  lat: number;
  lng: number;
}

export type MapLocation = Coords | string;

function formatLocation(loc: MapLocation): string {
  if (typeof loc === 'string') {
    return encodeURIComponent(loc);
  }
  return `${loc.lat},${loc.lng}`;
}

/**
 * Builds embed URL for iframe
 * Format: https://maps.google.com/maps?saddr={origin}&daddr={destination}+to:{wp1}&output=embed
 */
export function getEmbedMapUrl(
  origin: MapLocation,
  destination: MapLocation,
  waypoints?: MapLocation[]
): string {
  const originStr = formatLocation(origin);
  let destStr = formatLocation(destination);
  
  if (waypoints && waypoints.length > 0) {
    // Legacy format handles waypoints by adding +to: to the daddr parameter
    const waypointsStr = waypoints.map(wp => `+to:${formatLocation(wp)}`).join('');
    destStr += waypointsStr;
  }

  return `https://maps.google.com/maps?saddr=${originStr}&daddr=${destStr}&output=embed`;
}

/**
 * Builds full Google Maps URL for opening in a new tab
 */
export function getFullGoogleMapsUrl(
  origin: MapLocation,
  destination: MapLocation,
  waypoints?: MapLocation[]
): string {
  const originStr = formatLocation(origin);
  const destStr = formatLocation(destination);
  
  let waypointsStr = '';
  if (waypoints && waypoints.length > 0) {
    waypointsStr = waypoints.map(wp => formatLocation(wp)).join('/');
  }

  const path = [originStr, waypointsStr, destStr].filter(Boolean).join('/');
  return `https://www.google.com/maps/dir/${path}`;
}

/**
 * Interface matching the RouteLeg schema
 */
export interface RouteLeg {
  originCoords: MapLocation;
  destinationCoords: MapLocation;
  [key: string]: any;
}

/**
 * Builds URL for a specific leg
 */
export function getLegNavigationUrl(leg: RouteLeg, type: 'embed' | 'full' = 'embed'): string {
  if (type === 'embed') {
    return getEmbedMapUrl(leg.originCoords, leg.destinationCoords);
  }
  return getFullGoogleMapsUrl(leg.originCoords, leg.destinationCoords);
}
