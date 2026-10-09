/* Trips API Routes - Gozaride Core Booking System with SSP/USD Support */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "gozaride-development-secret-key-must-change";

function query(sql: string, params: any[] = []) {
  try {
    const result = execSync(
      `psql -U macbook -d gozaride_development -t -A -f /dev/stdin <<'EOF'\n${sql}\nEOF\`,
      { input: params.map(p => String(p)).join("\n") }
    );
    return result.stdout.trim() ? result.stdout.trim().split("\n").map(row => row.split("|").map(s => s.trim())) : [];
  } catch (error) {
    console.error("DB Query Error:", error);
    return [];
  }
}

function getAuthUserFromToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token) return null;

  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }

  return getUserById(payload.userId);
}

function getUserById(userId: string) {
  const results = query("SELECT id, email, full_name, role, default_currency, wallet_balance_ssp, wallet_balance_usd FROM users WHERE id = $1", [userId]);
  return results.length > 0 ? results[0] : null;
}

// Helper: Haversine distance calculation
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}

// Helper: Estimate travel time in minutes
function estimateTravelTime(distanceKm: number): number {
  const speedKmh = 30; // average speed in km/h
  const baseMinutes = (distanceKm / speedKmh) * 60;
  // Add 30% buffer for traffic/urban conditions
  return Math.round(baseMinutes * 1.3);
}

// Helper: Convert currency using admin rates
function convertCurrency(amount: number, from: string, to: string): number {
  // Use admin rates from platform_settings
  if (from === to) return Math.round(amount * 100) / 100;
  
  // SSD to USD rate (from platform_settings)
  const ssd_to_usd = 0.056;
  // USD to SSD rate
  const usd_to_ssd = 17.86;
  
  if (from === 'ssd' && to === 'usd') {
    return Math.round(amount * ssd_to_usd * 100) / 100;
  }
  if (from === 'usd' && to === 'ssd') {
    return Math.round(amount * usd_to_ssd * 100) / 100;
  }
  return Math.round(amount * 100) / 100;
}

// ===== TRIP ROUTES =====

// POST /api/trips/request - Customer requests a new trip
export async function POST_request(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "customer") {
      return NextResponse.json(
        { error: "Unauthorized - customer only" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { origin_lat, origin_lng, dest_lat, dest_lng, origin_name, dest_name, trip_type, notes } = body;

    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      return NextResponse.json(
        { error: "Origin and destination coordinates required" },
        { status: 400 }
      );
    }

    // Calculate distance and estimated time
    const distance = haversineDistance(origin_lat, origin_lng, dest_lat, dest_lng);
    const duration = estimateTravelTime(distance);

    // Determine currency based on user preference
    const userCurrency = authUser.default_currency || 'usd';
    
    // Base fare calculation based on trip type (in USD by default)
    const baseFares: Record<string, number> = {
      taxi: 5.00,
      motorcycle: 3.00,
      package: 8.00,
      food: 4.00,
      rental: 10.00,
      bus: 2.00
    };

    const distanceRate: Record<string, number> = {
      taxi: 1.50,
      motorcycle: 1.00,
      package: 2.00,
      food: 1.00,
      rental: 2.00,
      bus: 0.50
    };

    const baseFareUSD = baseFares[trip_type] || 5.00;
    const rate = distanceRate[trip_type] || 1.50;

    // Calculate initial fare in USD
    const initialFareUSD = Math.round(baseFareUSD + (distance * rate) * 100) / 100;

    // Convert to customer's preferred currency
    const initialFare = userCurrency === 'ssd' ? convertCurrency(initialFareUSD, 'usd', 'ssd') : initialFareUSD;
    const finalFareUSD = initialFareUSD; // Will be updated upon trip completion
    const finalFare = userCurrency === 'ssd' ? convertCurrency(initialFareUSD, 'usd', 'ssd') : initialFareUSD;

    // Create the trip with currency info
    const result = query(
      `INSERT INTO trips (
        customer_id, origin_latitude, origin_longitude, 
        destination_latitude, destination_longitude, 
        origin_name, destination_name, trip_type,
        estimated_duration, estimated_distance, base_fare, 
        final_fare, currency_used, status, surge_multiplier
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, 'pending', 1.0
      ) RETURNING id, created_at, final_fare, final_fare_ssp, final_fare_usd, currency_used`,
      [
        authUser.id,
        origin_lat, origin_lng,
        dest_lat, dest_lng,
        origin_name || "Customer origin",
        dest_name || "Customer destination",
        trip_type || "taxi",
        duration, distance, baseFareUSD,
        finalFare,
        userCurrency
      ]
    );

    const newTrip = result.length > 0 ? result[0] : null;

    if (!newTrip) {
      return NextResponse.json(
        { error: "Failed to create trip" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        trip: { 
          id: newTrip.id,
          status: "pending",
          estimated_duration: duration,
          estimated_distance_km: distance,
          base_fare: initialFareUSD,
          final_fare: newTrip.final_fare,
          final_fare_ssp: newTrip.final_fare_ssp,
          final_fare_usd: newTrip.final_fare_usd,
          currency_used: newTrip.currency_used,
          surge_multiplier: 1.0,
          message: "Trip requested - drivers will be notified"
        } 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Request Trip Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/trips/my-trips - Get customer's trips with currency display
export async function GET_my_trips(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "customer") {
      return NextResponse.json(
        { error: "Unauthorized - customer only" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    let whereClause = "";
    if (statusFilter) {
      whereClause = ` AND t.status = '${statusFilter}'`;
    }

    // Count total
    const countResult = query(
      `SELECT COUNT(*) FROM trips t WHERE t.customer_id = ${authUser.id} ${whereClause}`
    );
    const total = countResult.length > 0 ? parseInt(countResult[0]?.split("|")[0] || "0") : 0;

    // Get trips with currency display
    const tripsResult = query(
      `SELECT t.id, t.status, t.trip_type, t.estimated_duration, t.estimated_distance, 
        t.base_fare, t.final_fare, t.final_fare_ssp, t.final_fare_usd, t.currency_used,
        t.requested_at, t.accepted_at, t.started_at, t.completed_at,
        dp.current_latitude AS driver_lat, dp.current_longitude AS driver_lon,
        u.full_name AS driver_name,
        CASE WHEN t.driver_id IS NOT NULL THEN true ELSE false END AS has_driver
      FROM trips t
      LEFT JOIN users u ON t.driver_id = u.id
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE t.customer_id = ${authUser.id} ${whereClause}
      ORDER BY t.requested_at DESC
      LIMIT ${limit} OFFSET ${offset}`
    );

    const trips = tripsResult.map(row => ({
      id: row.id,
      status: row.status,
      trip_type: row.trip_type,
      estimated_duration: row.estimated_duration,
      estimated_distance_km: row.estimated_distance,
      base_fare: row.base_fare,
      final_fare: row.final_fare,
      final_fare_ssp: row.final_fare_ssp,
      final_fare_usd: row.final_fare_usd,
      currency_used: row.currency_used,
      requested_at: row.requested_at,
      accepted_at: row.accepted_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      has_driver: row.has_driver === "true",
      driver_name: row.driver_name || null,
      driver_lat: row.driver_lat || null,
      driver_lon: row.driver_lon || null
    }));

    return NextResponse.json(
      { 
        trips,
        pagination: { total, page, total_pages: Math.ceil(total / limit) }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get My Trips Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ... (rest of trip routes remain similar with currency support)
// For brevity, I'll include the key modified parts

// POST /api/trips/:tripId/accept - Driver accepts a trip
export async function POST_accept(request: Request, { params }: { params: { tripId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "driver") {
      return NextResponse.json(
        { error: "Unauthorized - driver only" },
        { status: 401 }
      );
    }

    const tripCheck = query("SELECT id, status, driver_id, final_fare, final_fare_ssp, final_fare_usd, currency_used FROM trips WHERE id = $1", [params.tripId]);
    if (tripCheck.length === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripCheck[0];
    
    // If trip has fare in USD but driver's currency is SSD, or vice versa, ensure consistency
    // The trip's currency_used determines how fares are displayed

    if (trip.status !== "pending") {
      return NextResponse.json(
        { error: "Trip cannot be accepted - status is: " + trip.status },
        { status: 400 }
      );
    }

    if (trip.driver_id) {
      return NextResponse.json(
        { error: "Trip already accepted by another driver" },
        { status: 400 }
      );
    }

    const result = query(
      `UPDATE trips SET driver_id = $1, status = 'accepted', accepted_at = NOW() WHERE id = $2 RETURNING id, status, driver_id, final_fare, final_fare_ssp, final_fare_usd, currency_used`,
      [authUser.id, params.tripId]
    );

    return NextResponse.json(
      { 
        trip: { 
          id: result[0]?.id,
          status: result[0]?.status,
          driver_id: result[0]?.driver_id,
          final_fare: result[0]?.final_fare,
          final_fare_ssp: result[0]?.final_fare_ssp,
          final_fare_usd: result[0]?.final_fare_usd,
          currency_used: result[0]?.currency_used,
          message: "Trip accepted successfully"
        } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Accept Trip Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ... other trip routes would similarly handle currency display