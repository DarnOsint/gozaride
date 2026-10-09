const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rough ETA from straight-line distance. Average urban speed of 25 km/h
 * covers traffic and road bends; minimum 3 minutes. Replace with a routing
 * engine (OSRM, self-hosted) when one is deployed.
 */
export function etaMinutes(km: number): number {
  return Math.max(3, Math.ceil((km / 25) * 60));
}
