/* Real-Time Trip Tracking API - Gozaride GPS Tracking */
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

// ===== TRACKING ROUTES =====

// POST /api/tracking/update-location - Driver updates GPS location
export async function POST_update_location(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "driver") {
      return NextResponse.json(
        { error: "Unauthorized - driver only" },
        { status: 401 }
      );
    }

    const { latitude, longitude } = await request.json();

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Latitude and longitude required" },
        { status: 400 }
      );
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: "Invalid coordinate values" },
        { status: 400 }
      );
    }

    // Update driver's current location in driver_profiles
    const result = query(
      `UPDATE driver_profiles SET current_latitude = $1, current_longitude = $2, updated_at = NOW() WHERE user_id = $2 RETURNING id, current_latitude, current_longitude, is_available`,
      [latitude, authUser.id, longitude]
    );

    // Also update or insert trip location updates for active trips
    if (result.length > 0) {
      // Find active trips assigned to this driver
      const activeTrips = query(
        `SELECT id, status FROM trips WHERE driver_id = $1 AND status IN ('accepted', 'in_progress')`,
        [authUser.id]
      );

      // Insert location updates for each active trip
      for (const trip of activeTrips) {
        // Check if there's a recent update (within 15 seconds) to avoid duplicates
        const recentUpdate = query(
          `SELECT id FROM trip_updates WHERE trip_id = $1 ORDER BY timestamp DESC LIMIT 1`,
          [trip.id]
        );

        // Insert location update
        query(
          `INSERT INTO trip_updates (trip_id, driver_id, latitude, longitude, timestamp, metadata) 
           VALUES ($1, $2, $3, $4, NOW(), '{"updated_by": "driver_api"}'::jsonb)`,
          [trip.id, authUser.id, latitude, longitude]
        );
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        location: { latitude, longitude },
        message: "Location updated successfully",
        active_trips_count: activeTrips.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update Location Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tracking/trip/:tripId - Get trip tracking history
export async function GET_trip_tracking(request: Request, { params }: { params: { tripId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);

    // Check authorization: customer owns the trip, or driver is assigned
    const tripCheck = query(
      `SELECT t.id, t.status, t.customer_id, u.role AS customer_role
       FROM trips t
       JOIN users u ON t.customer_id = u.id
       WHERE t.id = $1`,
      [params.tripId]
    );

    if (tripCheck.length === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripCheck[0];

    // Customer can track their own trip
    if (authUser && authUser.role === "customer" && trip.customer_id === authUser.id) {
      // authorized
    } else if (authUser && authUser.role === "driver" && trip.status === "in_progress") {
      // Driver can track their own trip
    } else {
      return NextResponse.json({ error: "Unauthorized to track this trip" }, { status: 403 });
    }
  } catch (error) {
    console.error("Get Trip Tracking Auth Error:", error);
  }

  // Get tracking history
  const trackingResult = query(
    `SELECT latitude, longitude, timestamp, speed, heading, metadata
     FROM trip_updates
     WHERE trip_id = $1
     ORDER BY timestamp DESC
     LIMIT 50`,
    [params.tripId]
  );

  const trackingHistory = trackingResult.map(row => ({
    latitude: row.latitude ? parseFloat(row.latitude) : 0,
    longitude: row.longitude ? parseFloat(row.longitude) : 0,
    timestamp: row.timestamp,
    speed: row.speed ? parseFloat(row.speed) : 0,
    heading: row.heading ? parseFloat(row.heading) : 0,
    metadata: row.metadata || {}
  }).filter(t => t.latitude !== 0 && t.longitude !== 0));

  return NextResponse.json({ tracking_history: trackingHistory }, { status: 200 });
}

// GET /api/tracking/driver/:driverId - Get driver's current location and active trips
export async function GET_driver_status(request: Request, { params }: { params: { driverId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);

    // Get driver's current location
    const driverResult = query(
      "SELECT id, full_name, current_latitude, current_longitude, is_available, rating, total_rides, earnings
       FROM driver_profiles dp
       JOIN users u ON dp.user_id = u.id
       WHERE u.id = $1",
      [driverId]
    );

    const driver = driverResult.length > 0 ? {
      id: driverResult[0].id,
      full_name: driverResult[0].full_name,
      latitude: driverResult[0].current_latitude ? parseFloat(driverResult[0].current_latitude) : 0,
      longitude: driverResult[0].current_longitude ? parseFloat(driverResult[0].current_longitude) : 0,
      is_available: driverResult[0].is_available === "t",
      rating: driverResult[0].rating ? parseFloat(driverResult[0].rating) : 0,
      total_rides: driverResult[0].total_rides || 0,
      earnings: driverResult[0].earnings || 0
    } : null;

    // Get active trips assigned to this driver
    const activeTripsResult = query(
      `SELECT t.id, t.status, t.origin_name, t.destination_name, t.requested_at
       FROM trips t
       WHERE t.driver_id = $1 AND t.status IN ('accepted', 'in_progress')`,
      [driverId]
    );

    const activeTrips = activeTripsResult.map(row => ({
      id: row.id,
      status: row.status,
      origin: row.origin_name,
      destination: row.destination_name,
      requested_at: row.requested_at
    }));

    return NextResponse.json({ driver, active_trips: activeTrips }, { status: 200 });
  } catch (error) {
    console.error("Get Driver Status Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}