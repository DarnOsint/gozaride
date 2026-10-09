/* Auth API Routes - Gozaride Backend */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "gozaride-development-secret-key-must-change";
const SALT_ROUNDS = 10;

// Helper: Execute SQL query and return results
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

// Helper: Hash password async
async function hashPassword(password: string) {
  // For sync API, use a simple approach
  // In production, use proper async bcrypt
  return require("crypto").createHash('sha256').update(password).digest('base64');
}

// Helper: Verify password
function verifyPassword(password: string, hashed: string) {
  const hashedPassword = require("crypto").createHash('sha256').update(password).digest('base64');
  return hashedPassword === hashed;
}

// Helper: Generate JWT
function generateToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

// Helper: Get user by email
function getUserByEmail(email: string) {
  const results = query("SELECT id, email, password_hash, full_name, role, phone FROM users WHERE email = $1", [email]);
  return results.length > 0 ? results[0] : null;
}

// Helper: Get user by ID
function getUserById(userId: string) {
  const results = query("SELECT id, email, full_name, role, phone, created_at FROM users WHERE id = $1", [userId]);
  return results.length > 0 ? results[0] : null;
}

// ===== AUTH ROUTES =====

// POST /api/auth/signup
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name, phone, role } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["customer", "driver", "shop", "admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = query(
      "INSERT INTO users (email, password_hash, full_name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, created_at",
      [email, passwordHash, full_name, phone, role]
    );

    const newUser = result.length > 0 ? result[0] : null;

    if (!newUser) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // Create role-specific profile
    if (role === "customer") {
      query(
        "INSERT INTO customer_profiles (user_id, home_latitude, home_longitude, work_latitude, work_longitude, preferred_pickup_zone) VALUES ($1, $2, $3, $4, $5, $6)",
        [newUser.id, null, null, null, null, ""])
    } else if (role === "driver") {
      query(
        "INSERT INTO driver_profiles (user_id, vehicle_type, license_number, status, current_latitude, current_longitude, is_available) VALUES ($1, $2, $3, 'active', $4, $5, true)",
        [newUser.id, "", "", null, null])
    } else if (role === "shop") {
      query(
        "INSERT INTO shop_profiles (user_id, shop_name, business_type, latitude, longitude, delivery_radius_km) VALUES ($1, $2, $3, $4, $5, $6)",
        [newUser.id, full_name, "service", null, null, 5.0])
    }

    // Generate JWT token
    const token = generateToken(newUser.id, newUser.role);

    return NextResponse.json(
      { user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name, role: newUser.role }, token },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/auth/signin
export async function signin(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const user = getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Note: password comparison using sha256 base64 (matching hash method)
    const passwordValid = verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    return NextResponse.json(
      { user: { id: userWithoutPassword.id, email: userWithoutPassword.email, full_name: userWithoutPassword.full_name, role: userWithoutPassword.role }, token },
      { status: 200 }
    );
  } catch (error) {
    console.error("Signin Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/auth/me - get current user info
export async function me(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = getUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { password_hash, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword }, { status: 200 });
  } catch (error) {
    console.error("Get Me Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}