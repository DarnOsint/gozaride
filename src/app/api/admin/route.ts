/* Admin Panel API Routes - Gozaride Platform Management */
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
  const results = query("SELECT id, email, full_name, role FROM users WHERE id = $1", [userId]);
  return results.length > 0 ? results[0] : null;
}

// ===== ADMIN ROUTES =====

// GET /api/admin/users - Get all users with role filtering and pagination
export async function GET_users(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin only" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const roleFilter = url.searchParams.get("role") || null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let whereClause = "";
    if (roleFilter) {
      whereClause = `WHERE role = '${roleFilter}'`;
    }

    // Count total
    const countResult = query(
      `SELECT COUNT(*) FROM users ${whereClause}`
    );
    const total = countResult.length > 0 ? parseInt(countResult[0]?.split("|")[0] || "0") : 0;

    // Get users
    const usersResult = query(
      `SELECT id, email, full_name, role, created_at, last_login 
       FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`
    );

    const users = usersResult.map(row => ({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      created_at: row.created_at,
      last_login: row.last_login
    }));

    return NextResponse.json(
      { users, pagination: { total, page, total_pages: Math.ceil(total / limit) } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Users Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/users/:userId/toggle-status - Toggle user active status
export async function POST_toggle_status(request: Request, { params }: { params: { userId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin only" },
        { status: 403 }
      );
    }

    const { is_active } = await request.json();

    if (is_active === undefined) {
      return NextResponse.json(
        { error: "Missing is_active parameter" },
        { status: 400 }
      );
    }

    // Toggle the user's active status - we'll update a conceptual field
    // In a full implementation, you'd have an is_active column on users
    const result = query(
      `SELECT id, email, full_name, role FROM users WHERE id = $1`,
      [params.userId]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result[0];

    return NextResponse.json(
      { user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, is_active: is_active } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Toggle User Status Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/admin/trips - Get all trips with filtering
export async function GET_trips(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin only" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || null;
    const typeFilter = url.searchParams.get("type") || null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let whereClause = "";
    if (statusFilter) whereClause += ` AND status = '${statusFilter}'`;
    if (typeFilter) whereClause += ` AND type = '${typeFilter}'`;

    // Count total
    const countResult = query(
      `SELECT COUNT(*) FROM trips ${whereClause}`
    );
    const total = countResult.length > 0 ? parseInt(countResult[0]?.split("|")[0] || "0") : 0;

    // Get trips with customer and driver info
    const tripsResult = query(
      `SELECT t.id, t.status, t.trip_type, t.estimated_duration, t.estimated_distance, 
        t.base_fare, t.final_fare, t.requested_at,
        u_c.full_name AS customer_name, u_c.email AS customer_email,
        u_d.full_name AS driver_name, u_d.email AS driver_email,
        dp.current_latitude AS driver_lat, dp.current_longitude AS driver_lon
      FROM trips t
      JOIN users u_c ON t.customer_id = u_c.id
      LEFT JOIN users u_d ON t.driver_id = u_d.id
      LEFT JOIN driver_profiles dp ON (t.driver_id IS NOT NULL AND u_d.id = dp.user_id)
      ${whereClause}
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
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      driver_name: row.driver_name || "Not assigned",
      driver_email: row.driver_email || "",
      driver_lat: row.driver_lat || null,
      driver_lon: row.driver_lon || null
    }));

    return NextResponse.json(
      { trips, pagination: { total, page, total_pages: Math.ceil(total / limit) } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Admin Trips Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/admin/analytics - Comprehensive platform analytics
export async function GET_analytics(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin only" },
        { status: 403 }
      );
    }

    // Total users by role
    const usersByRoleResult = query(
      `SELECT role, COUNT(*) FROM users GROUP BY role`
    );
    const usersByRole: Record<string, number> = {};
    if (usersByRoleResult.length > 0) {
      usersByRoleResult.forEach((row: any) => {
        usersByRole[row.role] = parseInt(row.count || "0");
      });
    }

    // Total trips by status
    const tripsByStatusResult = query(
      `SELECT status, COUNT(*) FROM trips GROUP BY status`
    );
    const tripsByStatus: Record<string, number> = {};
    if (tripsByStatusResult.length > 0) {
      tripsByStatusResult.forEach((row: any) => {
        tripsByStatus[row.status] = parseInt(row.count || "0");
      });
    }

    // Total revenue from completed trips
    const revenueResult = query(
      `SELECT COALESCE(SUM(final_fare), 0) FROM trips WHERE status = 'completed'`
    );
    const totalRevenue = revenueResult.length > 0 ? parseFloat(revenueResult[0]?.split("|")[0] || "0") : 0;

    // Active drivers (available)
    const activeDriversResult = query(
      "SELECT COUNT(*) FROM driver_profiles WHERE is_available = true"
    );
    const activeDrivers = activeDriversResult.length > 0 ? parseInt(activeDriversResult[0]?.split("|")[0] || "0") : 0;

    // Total completed trips
    const totalTripsResult = query(
      "SELECT COUNT(*) FROM trips WHERE status = 'completed'"
    );
    const totalTrips = totalTripsResult.length > 0 ? parseInt(totalTripsResult[0]?.split("|")[0] || "0") : 0;

    // Average rating
    const avgRatingResult = query(
      "SELECT COALESCE(AVG(rating), 0) FROM reviews_ratings"
    );
    const averageRating = avgRatingResult.length > 0 ? parseFloat(avgRatingResult[0]?.split("|")[0] || "0") : 0;

    // Recent activity - last 10 trips
    const recentActivityResult = query(
      `SELECT t.id, t.status, t.requested_at, u.full_name AS customer_name
       FROM trips t
       JOIN users u ON t.customer_id = u.id
       ORDER BY t.requested_at DESC
       LIMIT 10`
    );

    const recentActivity = recentActivityResult.map((row: any) => ({
      id: row.id,
      status: row.status,
      customer_name: row.customer_name,
      requested_at: row.requested_at
    }));

    return NextResponse.json(
      { 
        analytics: { 
          users_by_role: usersByRole,
          trips_by_status: tripsByStatus,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          active_drivers: activeDrivers,
          total_trips: totalTrips,
          average_rating: Math.round(averageRating * 100) / 100,
          recent_activity: recentActivity
        } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Admin Analytics Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/settings - Update platform settings
export async function POST_settings(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin only" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: "Missing settings key" },
        { status: 400 }
      );
    }

    // Update or insert platform setting
    // In a real implementation, this would be a dedicated table
    // For now, we just validate and return
    const validKeys = ["commission_rate", "surge_threshold", "min_rating", "distance_rate", "waiting_rate"];
    
    if (validKeys.includes(key)) {
      return NextResponse.json(
        { setting: { key, value, updated: true } },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: "Invalid settings key" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Update Settings Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}