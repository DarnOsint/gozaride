/* Trips API Routes - Gozaride Core Booking System */
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

    // Base fare calculation based on trip type
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

    const baseFare = baseFares[trip_type] || 5.00;
    const rate = distanceRate[trip_type] || 1.50;

    // Calculate initial fare (before surge)
    const initialFare = Math.round(baseFare + (distance * rate) * 100) / 100;

    // Create the trip
    const result = query(
      `INSERT INTO trips (
        customer_id, origin_latitude, origin_longitude, 
        destination_latitude, destination_longitude, 
        origin_name, destination_name, trip_type,
        estimated_duration, estimated_distance, base_fare, 
        status, surge_multiplier
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, 'pending', 1.0
      ) RETURNING id, created_at`,
      [
        authUser.id,
        origin_lat, origin_lng,
        dest_lat, dest_lng,
        origin_name || "Customer origin",
        dest_name || "Customer destination",
        trip_type || "taxi",
        duration, distance, baseFare
      ]
    );

    const newTrip = result.length > 0 ? result[0] : null;

    if (!newTrip) {
      return NextResponse.json(
        { error: "Failed to create trip" },
        { status: 500 }
      );
    }

    // Create driver notification - in production, this would via WebSocket/SSE
    // For now, we just return the trip info

    return NextResponse.json(
      { 
        trip: { 
          id: newTrip.id,
          status: "pending",
          estimated_duration: duration,
          estimated_distance_km: distance,
          base_fare: initialFare,
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

// GET /api/trips/my-trips - Get customer's trips with pagination
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

    // Build query with optional status filter
    let whereClause = "";
    if (statusFilter) {
      whereClause = ` AND t.status = '${statusFilter}'`;
    }

    // Count total
    const countResult = query(
      `SELECT COUNT(*) FROM trips t WHERE t.customer_id = ${authUser.id} ${whereClause}`
    );
    const total = countResult.length > 0 ? parseInt(countResult[0]?.split("|")[0] || "0") : 0;

    // Get trips
    const tripsResult = query(
      `SELECT t.id, t.status, t.trip_type, t.estimated_duration, t.estimated_distance, 
        t.base_fare, t.final_fare, t.requested_at, t.accepted_at, t.started_at, t.completed_at,
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

// GET /api/trips/:tripId - Get specific trip details
export async function GET_trip_id(request: Request, { params }: { params: { tripId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);

    const tripResult = query(
      `SELECT t.*, u.full_name AS customer_name, u.email AS customer_email,
        dp.current_latitude AS driver_lat, dp.current_longitude AS driver_lon,
        u2.full_name AS driver_full_name,
        CASE WHEN t.driver_id IS NOT NULL THEN true ELSE false END AS has_driver
      FROM trips t
      JOIN users u ON t.customer_id = u.id
      LEFT JOIN users u2 ON t.driver_id = u2.id
      LEFT JOIN driver_profiles dp ON u2.id = dp.user_id
      WHERE t.id = ${params.tripId}`
    );

    const trip = tripsResult.length > 0 ? tripsResult[0] : null;

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check authorization: customer owns this trip, or driver is assigned
    if (authUser) {
      const isCustomer = authUser.role === "customer";
      const isDriver = authUser.role === "driver";
      const customerOwnsTrip = trip.customer_id === authUser.id;
      const driverAssigned = trip.driver_id === authUser.id;

      if (!(isCustomer && customerOwnsTrip) && !(isDriver && driverAssigned)) {
        return NextResponse.json(
          { error: "Unauthorized to view this trip" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ trip }, { status: 200 });
  } catch (error) {
    console.error("Get Trip Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    // Check trip exists and is available for acceptance
    const tripCheck = query("SELECT id, status, driver_id FROM trips WHERE id = $1", [params.tripId]);
    if (tripCheck.length === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripCheck[0];
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

    // Accept the trip
    const result = query(
      `UPDATE trips SET driver_id = $1, status = 'accepted', accepted_at = NOW() WHERE id = $2 RETURNING id, status, driver_id`,
      [authUser.id, params.tripId]
    );

    // In production: Send WebSocket notification to customer
    // broadcastToCustomer(params.tripId, { type: "driver_accepted", driver_id: authUser.id })

    return NextResponse.json(
      { 
        trip: { 
          id: result[0]?.id,
          status: result[0]?.status,
          driver_id: result[0]?.driver_id,
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

// POST /api/trips/:tripId/start - Driver starts the trip
export async function POST_start(request: Request, { params }: { params: { tripId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "driver") {
      return NextResponse.json(
        { error: "Unauthorized - driver only" },
        { status: 401 }
      );
    }

    // Verify trip is assigned to this driver and is accepted
    const tripCheck = query("SELECT id, status FROM trips WHERE id = $1 AND driver_id = $2", [params.tripId, authUser.id]);
    if (tripCheck.length === 0) {
      return NextResponse.json({ error: "Trip not found or not assigned to you" }, { status: 404 });
    }

    const trip = tripCheck[0];
    if (trip.status !== "accepted") {
      return NextResponse.json(
        { error: "Trip not in accepted status" },
        { status: 400 }
      );
    }

    // Start the trip
    const result = query(
      `UPDATE trips SET status = 'in_progress', started_at = NOW() WHERE id = $1 RETURNING id, status`,
      [params.tripId]
    );

    // Start GPS tracking updates (in production via WebSocket)
    // startGpsTracking(params.tripId, authUser.id)

    return NextResponse.json(
      { trip: { id: result[0]?.id, status: result[0]?.status, started_at: result[0]?.started_at } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Start Trip Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/trips/:tripId/complete - Driver completes the trip
export async function POST_complete(request: Request, { params }: { params: { tripId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "driver") {
      return NextResponse.json(
        { error: "Unauthorized - driver only" },
        { status: 401 }
      );
    }

    // Verify trip is assigned to this driver and is in progress
    const tripCheck = query("SELECT id, status, customer_id FROM trips WHERE id = $1 AND driver_id = $2", [params.tripId, authUser.id]);
    if (tripCheck.length === 0) {
      return NextResponse.json({ error: "Trip not found or not assigned to you" }, { status: 404 });
    }

    const trip = tripCheck[0];
    if (trip.status !== "in_progress") {
      return NextResponse.json(
        { error: "Trip not in progress status" },
        { status: 400 }
      );
    }

    const { final_fare, tip } = await request.json();

    // Complete the trip
    const fare = final_fare || Math.round((trip.estimated_distance * 1.5 + 5) * 100) / 100;
    const tipAmount = tip || 0;

    const result = query(
      `UPDATE trips SET status = 'completed', completed_at = NOW(), final_fare = $1, tip_amount = $2 WHERE id = $3 RETURNING id, status, final_fare`,
      [fare, tipAmount, params.tripId]
    );

    // Generate payment record
    const paymentResult = query(
      `INSERT INTO payments (trip_id, user_id, amount, status, method) VALUES ($1, $2, $3, 'processing', 'wallet') RETURNING id, amount, status`,
      [params.tripId, trip.customer_id, fare]
    );

    // In production:
    // - Process payment via Stripe
    // - Deduct 20% commission to platform
    // - Transfer 80% to driver
    // - Send receipt to both parties
    // - Send WebSocket: trip_completed
    // - Trigger rating/review flow

    // Send GPS tracking stop
    // stopGpsTracking(params.tripId)

    return NextResponse.json(
      { 
        trip: { 
          id: result[0]?.id,
          status: result[0]?.status,
          final_fare: result[0]?.final_fare,
          payment_id: paymentResult[0]?.id,
          message: "Trip completed successfully"
        } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Complete Trip Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}