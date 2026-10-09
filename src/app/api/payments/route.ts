/* Stripe Payment Integration API - Gozaride Payment Processing */
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

// ===== PAYMENT ROUTES =====

// POST /api/payments/initiate - Initialize payment for a trip
export async function POST_initiate(request: Request) {
  try {
    const authUser = getAuthUserFromToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { trip_id, payment_method, save_to_wallet } = body;

    if (!trip_id) {
      return NextResponse.json(
        { error: "Trip ID required" },
        { status: 400 }
      );
    }

    // Verify trip exists and get trip details
    const tripResult = query(
      `SELECT id, customer_id, final_fare, status, payment_status FROM trips WHERE id = $1`,
      [trip_id]
    );

    if (tripResult.length === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripResult[0];

    // Check authorization: customer owns the trip or driver/shop/admin
    const isCustomer = authUser.role === "customer" && trip.customer_id === authUser.id;
    const isDriver = authUser.role === "driver" && trip.driver_id === authUser.id;
    const isShop = authUser.role === "shop";
    const isAdmin = authUser.role === "admin";

    if (!isCustomer && !isDriver && !isShop && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized to pay for this trip" }, { status: 403 });
    }

    // Check if payment already exists
    const existingPayment = query(
      `SELECT id, status, amount FROM payments WHERE trip_id = $1`,
      [trip_id]
    );

    let amount = trip.final_fare || 0;
    let status = "pending";
    let payment_method_stripe = payment_method || "card";

    if (existingPayment.length > 0) {
      status = existingPayment[0].status;
      amount = existingPayment[0].amount;
    }

    // Create payment record in database
    const paymentId = "pay_" + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    const payResult = query(
      `INSERT INTO payments (trip_id, user_id, amount, status, method, gateway_response, created_at) 
       VALUES ($1, $2, $3, 'pending', $4, '{}'::jsonb, $5) RETURNING id, amount, status`,
      [trip_id, authUser.id || trip.customer_id, amount, payment_method_stripe, now]
    );

    const payment = payResult.length > 0 ? payResult[0] : null;

    // In a full Stripe integration, this is where we would:
    // 1. Create a PaymentIntent via Stripe API
    // 2. Return client_secret to frontend for checkout
    // 3. Handle webhooks for payment completion
    // 4. Update trip status upon payment success
    // 5. Deduct 20% platform commission, transfer 80% to driver

    // For now, return payment initiation data
    return NextResponse.json(
      { 
        payment: { 
          id: payment ? payment.id : paymentId,
          amount: amount,
          status: status,
          trip_id: trip_id,
          customer_id: trip.customer_id,
          requires_action: true, // Frontend would use Stripe.js to redirect/charge
          payment_method: payment_method_stripe,
          description: `Gozaride trip payment - ${trip_id}`,
          metadata: { trip_type: trip.trip_type }
        },
        stripe_client_secret: process.env.STRIPE_CLIENT_SECRET || null,
        mode: "payment"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Init Payment Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/payments/status/:paymentId - Check payment status
export async function GET_status_payment_id(request: Request, { params }: { params: { paymentId: string } }) {
  try {
    const authUser = getAuthUserFromToken(request);

    const paymentResult = query(
      `SELECT id, trip_id, user_id, amount, status, method, gateway_response, updated_at
       FROM payments WHERE id = $1`,
      [params.paymentId]
    );

    if (paymentResult.length === 0) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = paymentResult[0];

    // Check authorization
    if (authUser) {
      const isCustomer = authUser.role === "customer" && payment.user_id === authUser.id;
      const isDriver = authUser.role === "driver";
      const isShop = authUser.role === "shop";
      const isAdmin = authUser.role === "admin";

      if (!isCustomer && !isDriver && !isShop && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    // Parse gateway response if present
    let gateway_data = {};
    try {
      gateway_data = JSON.parse(payment.gateway_response || "{}");
    } catch {
      gateway_data = {};
    }

    return NextResponse.json(
      { 
        payment: { 
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
          gateway_data,
          updated_at: payment.updated_at,
          trip_id: payment.trip_id
        } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get Payment Status Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/payments/webhook - Stripe webhook endpoint (simulated)
export async function POST_webhook(request: Request) {
  try {
    const body = await request.json();
    const { id, status, amount } = body;

    // Update payment status based on webhook from Stripe
    const result = query(
      `UPDATE payments SET status = $1, amount = $2, updated_at = NOW() WHERE id = $3`,
      [status, amount, id]
    );

    // In production, this webhook would also:
    // - Update trip status to 'completed' if payment successful
    // - Trigger driver payout (80% of fare, 20% to platform)
    // - Send receipt emails to customer and driver
    // - Generate receipts and invoices
    // - Update platform analytics

    return NextResponse.json(
      { success: true, updated: result.length > 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error("Payment Webhook Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}