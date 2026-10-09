/* Shop Owner API Routes - Gozaride Business Interface */
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

// ===== SHOP ROUTES =====

// POST /api/shops/orders - Create a new order
export async function POST_orders(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "shop") {
      return NextResponse.json(
        { error: "Unauthorized - shop owner only" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customer_id, items, delivery_address, special_instructions } = body;

    if (!customer_id || !items || !delivery_address) {
      return NextResponse.json(
        { error: "Missing required fields: customer_id, items, delivery_address" },
        { status: 400 }
      );
    }

    // Validate customer exists
    const customerCheck = query("SELECT id, full_name FROM users WHERE id = $1 AND role = 'customer'", [customer_id]);
    if (customerCheck.length === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Create order - assign a driver (simplified: find first available driver)
    const availableDriver = query(
      `SELECT u.id, u.full_name, dp.current_latitude, dp.current_longitude 
       FROM trips t 
       JOIN users u ON t.driver_id = u.id  
       JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE dp.is_available = true
       LIMIT 1`
    );

    // For now, create order with pending driver assignment
    const orderId = "order_" + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    // Insert order-related data - we'll use the trips system for simplicity
    // or create a minimal record. For this implementation, we'll create a trip
    // if items suggest a delivery order.
    
    if (items && items.length > 0) {
      // Create a trip for this delivery
      const driverResult = availableDriver.length > 0 ? availableDriver[0] : null;
      const driverId = driverResult ? driverResult.id : null;
      
      const tripResult = query(
        `INSERT INTO trips (
          customer_id, origin_latitude, origin_longitude, 
          destination_latitude, destination_longitude, 
          origin_name, destination_name, trip_type,
          status, driver_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'package',
          'pending', $8
        ) RETURNING id`,
        [
          customer_id,
          delivery_address.origin_lat, delivery_address.origin_lng,
          delivery_address.dest_lat, delivery_address.dest_lng,
          delivery_address.origin_name || customer_id,
          delivery_address.dest_name || "Delivery",
          driverId
        ]
      );

      const tripId = tripResult.length > 0 ? tripResult[0] : null;

      return NextResponse.json(
        { 
          order: { 
            id: orderId,
            trip_id: tripId,
            customer_id: customer_id,
            items: items,
            delivery_address: delivery_address,
            special_instructions: special_instructions || "",
            status: tripId ? "pending_driver_assignment" : "created",
            created_at: now
          } 
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { order: { id: orderId, status: "created", message: "Order received" } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Order Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/shops/orders - Get shop's orders with pagination and status filter
export async function GET_orders(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "shop") {
      return NextResponse.json(
        { error: "Unauthorized - shop owner only" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Build where clause for shop-related trips/orders
    // Shop orders are linked via customer trips or direct references
    let whereClause = "WHERE 1=1";
    
    // We'll look for trips associated with this shop's customers or 
    // directly reference shop orders. For now, get recent trips.
    if (statusFilter) {
      whereClause += ` AND status = '${statusFilter}'`;
    }

    // Count total orders (trips with status that could be shop orders)
    const countResult = query(
      `SELECT COUNT(*) FROM trips WHERE ${whereClause}`
    );
    const total = countResult.length > 0 ? parseInt(countResult[0]?.split("|")[0] || "0") : 0;

    // Get orders/trips
    const ordersResult = query(
      `SELECT t.id, t.status, t.trip_type, t.estimated_duration, t.estimated_distance, 
        t.base_fare, t.final_fare, t.requested_at, t.accepted_at, t.started_at, t.completed_at,
        u.full_name AS customer_name, u.email AS customer_email,
        dp.current_latitude AS driver_lat, dp.current_longitude AS driver_lon,
        CASE WHEN t.driver_id IS NOT NULL THEN true ELSE false END AS has_driver
      FROM trips t
      JOIN users u ON t.customer_id = u.id
      LEFT JOIN driver_profiles dp ON (t.driver_id IS NOT NULL AND u.id = dp.user_id)
      WHERE ${whereClause}
      ORDER BY t.requested_at DESC
      LIMIT ${limit} OFFSET ${offset}`
    );

    const orders = ordersResult.map(row => ({
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
      customer_name: row.customer_name || "Unknown",
      customer_email: row.customer_email || "",
      driver_name: row.driver_lat ? "Driver assigned" : null,
      driver_lat: row.driver_lat || null,
      driver_lon: row.driver_lon || null
    }));

    return NextResponse.json(
      { 
        orders,
        pagination: { total, page, total_pages: Math.ceil(total / limit) }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Orders Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/shops/dashboard - Shop dashboard data
export async function GET_dashboard(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser || authUser.role !== "shop") {
      return NextResponse.json(
        { error: "Unauthorized - shop owner only" },
        { status: 401 }
      );
    }

    // Get shop profile info
    const shopProfileResult = query(
      "SELECT * FROM shop_profiles WHERE user_id = $1",
      [authUser.id]
    );

    // Get recent orders count by status
    const ordersByStatus = {};
    const statuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
    
    for (const status of statuses) {
      const result = query(
        `SELECT COUNT(*) FROM trips WHERE status = '${status}' AND customer_id IN (
          SELECT id FROM users WHERE role = 'customer'
        )`
      );
      const count = result.length > 0 ? parseInt(result[0]?.split("|")[0] || "0") : 0;
      ordersByStatus[status] = count;
    }

    // Get total revenue (completed trips fare sum)
    const revenueResult = query(
      `SELECT COALESCE(SUM(final_fare), 0) FROM trips WHERE status = 'completed'`
    );
    const totalRevenue = revenueResult.length > 0 ? parseFloat(revenueResult[0]?.split("|")[0] || "0") : 0;

    // Get active drivers count (drivers currently online/available)
    const activeDriversResult = query(
      "SELECT COUNT(*) FROM driver_profiles WHERE is_available = true"
    );
    const activeDrivers = activeDriversResult.length > 0 ? parseInt(activeDriversResult[0]?.split("|")[0] || "0") : 0;

    // Get total customers
    const totalCustomersResult = query(
      "SELECT COUNT(*) FROM users WHERE role = 'customer'"
    );
    const totalCustomers = totalCustomersResult.length > 0 ? parseInt(totalCustomersResult[0]?.split("|")[0] || "0") : 0;

    return NextResponse.json(
      { 
        dashboard: { 
          total_revenue: Math.round(totalRevenue * 100) / 100,
          active_drivers: activeDrivers,
          total_customers: totalCustomers,
          orders_by_status: ordersByStatus,
          shop_name: authUser.full_name || "Gozaride Shop"
        } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Dashboard Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}