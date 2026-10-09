/* Gozaride - Mapping Service Selection & Integration
 * Evaluated 3 options and selected optimal choice for VPS deployment
 */

-- ===== EVALUATION RESULTS =====

| Service | Free Tier | Monthly Requests | Cost After Free | API Key Required | Best For |
|---------|-----------|-----------------|-----------------|------------------|----------|
| **OpenStreetMap** | ✅ Unlimited | ✅ Unlimited | $0 | ❌ No | Budget-focused, unlimited scaling |
| **Mapbox** | ✅ 50,000 | ✅ 50,000 | $5/100,000 | ✅ Yes | Feature-rich, custom maps |
| **Google Maps** | ❌ 200/day | ❌ 200/day | $$$ $$$ | ✅ Yes | Enterprise, best accuracy |

-- ===== SELECTED: OpenStreetMap (Recommended) =====

-- **Why OpenStreetMap:**
- ✅ Completely free, no API key needed
- ✅ Unlimited requests - scales without cost concerns
- ✅ Open data - no licensing restrictions
- ✅ Good coverage for most regions
- ✅ Can use free tile servers (Mapnik, Osmarender)
- ✅ Vector tiles available through Tippecanoe/Metatiles

-- **Alternative: Mapbox (if features needed)**
- 50,000 free monthly requests (sufficient for launch)
- Custom styles, geocoding, search
- Cost: $5 per 100,000 additional requests
- Requires API key setup

-- ===== INTEGRATION IMPLEMENTATION =====

-- **OpenStreetMap Usage:**

-- 1. Static Maps (no API key):
--   URL pattern: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
--   Attribution: © OpenStreetMap contributors

-- 2. Geocoding (free, limited):
--   https://nominatim.openstreetmap.org/search?format=json&q=address
--   ⚠️ Rate limit: 1 request per second, please respect usage

-- 3. Distance Matrix (self-calculated or open sources):
--   - Use Haversine formula for quick distance estimates
--   - Or use OSRM (Open Source Routing Machine) - self-hosted on VPS
--   - Or use Mapillary/Mapzen (now defunct, avoid)

-- **Mapbox Usage (if selected):**
--   - Mapbox API Key from https://account.mapbox.com/access-tokens/
--   - Geocoding: https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={TOKEN}
--   - Directions: https://api.mapbox.com/directions-matrix/v1/{coordinates}?access_token={TOKEN}
--   - Static images: https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/{coordinates}/{parameters}?access_token={TOKEN}

-- ===== COST ANALYSIS (First Year) =====

-- **OpenStreetMap: $0**
-- - Tile server costs: $0-10/month (VPS already running)
-- - Developer time: included in build cost
-- - Total: ~$0-120/year (VPS only)

-- **Mapbox (conservative - 1M requests):**
-- - Free tier: 50,000 requests
-- - Additional 950,000 @ $5/100k = $47.50
-- - Plus API key management overhead
-- - Total: ~$50-100/year

-- **Google Maps (conservative - 1M requests):**
-- - $7 per 1,000 requests = $7,000/year
-- - Plus $200 monthly credit (covers ~28k requests)
-- - Total: $2,000-5,000+/year

-- ===== IMPLEMENTATION: Distance Calculation (Haversine Formula) =====

-- Used when OpenStreetMap geocoding is insufficient:

/* JavaScript implementation for client-side */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

/* Example usage: */
const distance = haversineDistance(4.0, 30.0, 4.5, 31.0); // ≈ 55 km

-- ===== TRAVEL TIME ESTIMATION =====

/* Basic time formula: */
function estimateTravelTime(distance_km, speed_kmh = 30) {
  const base_time_minutes = (distance_km / speed_kmh) * 60;
  // Add buffer for urban traffic: 1.3x multiplier
  return Math.round(base_time_minutes * 1.3);
}

/* Example: 55km at 30km/h = 110 minutes, with traffic = 143 minutes */

/-- ===== API ENDPOINTS USING MAPPING =====

-- POST /api/v1/trip/estimate-price
-- Request body:
-- {
--   "origin": { "lat": 4.0, "lng": 30.0 },
--   "destination": { "lat": 4.5, "lng": 31.0 },
--   "trip_type": "taxi",
--   "surge_factor": 1.0 (default)
-- }
-- Responses:
-- 200 - { 
--   distance_km: 55.3,
--   estimated_duration_minutes: 143,
--   base_fare: 15.00,
--   distance_rate: 1.50,
--   waiting_rate: 0.50,
--   estimated_total: 98.00,
--   surge_multiplier: 1.0
-- }

-- ===== RECOMMENDED TECH STACK =====

-- Mapping: OpenStreetMap (tiles) + self-calculated Haversine distances
-- No API keys required = zero cost, maximum scalability
-- Fallback: Mapbox if advanced features (search, custom styles) needed
-- Routing: OSRM self-hosted on VPS if turn-by-turn navigation needed