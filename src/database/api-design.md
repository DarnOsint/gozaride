/* Gozaride - Complete REST API Design
 * All endpoints designed for Next.js 16 App Router (app/api/)
 * Version: v1
 * Base URL: https://api.gozaride.com/v1
 */

-- ===== AUTHENTICATION ENDPOINTS =====

-- POST /api/v1/auth/signup
-- Request body:
-- {
--   "email": "user@example.com",
--   "password": "secure-password",
--   "full_name": "John Doe",
--   "phone": "+211 XX XXX XXX",
--   "role": "customer" | "driver" | "shop"
-- }
-- Responses:
-- 201 - { user: { id, email, full_name, role }, token }
-- 400 - { error: "Email already registered" }
-- 422 - Validation errors

-- POST /api/v1/auth/signin
-- Request body:
-- {
--   "email": "user@example.com",
--   "password": "secure-password"
-- }
-- Responses:
-- 200 - { user: { id, email, full_name, role }, token }
-- 401 - { error: "Invalid credentials" }

-- POST /api/v1/auth/refresh
-- Request body:
-- {
--   "refresh_token": "..." 
-- }
-- Responses:
-- 200 - { access_token, expires_in, user }
-- 401 - { error: "Invalid refresh token" }

-- POST /api/v1/auth/logout
-- Request body:
-- {
--   "token": "current_access_token"
-- }
-- Responses:
-- 204 - No content
-- 401 - { error: "Invalid token" }

-- GET /api/v1/auth/me
-- Headers: Authorization: Bearer <token>
-- Responses:
-- 200 - { user: { id, email, full_name, role, phone, ... } }
-- 401 - Unauthorized

-- ===== CUSTOMER ENDPOINTS =====

-- POST /api/v1/customer/request-trip
-- Request body:
-- {
--   "origin": { "lat": 4.0, "lng": 30.0 },
--   "destination": { "lat": 4.5, "lng": 31.0 },
--   "origin_name": "Home",
--   "destination_name": "Airport",
--   "trip_type": "taxi" | "motorcycle" | "package" | "food" | "rental" | "bus",
--   "pickup_window_minutes": 15, -- optional
--   "notes": "Need help with luggage" -- optional
-- }
-- Responses:
-- 201 - { trip: { id, status, estimated_price, driver_info? } }
-- 400 - { error: "Invalid origin/destination" }
-- 429 - Too many requests (rate limiting)

-- GET /api/v1/customer/my-trips
-- Headers: Authorization: Bearer <token>
-- Query params: status=pending|accepted|in_progress|completed|cancelled, page=1, limit=20
-- Responses:
-- 200 - { trips: [...], pagination: { total, page, total_pages} }
-- 401 - Unauthorized

-- GET /api/v1/customer/trip/:tripId
-- Headers: Authorization: Bearer <token>
-- Responses:
-- 200 - { trip: detailed_trip_info }
-- 401 - Unauthorized
-- 404 - Trip not found or not accessible

-- POST /api/v1/customer/cancel-trip
-- Request body:
-- {
--   "trip_id": "trip-uuid",
--   "reason": "Customer changed plans" -- optional
-- }
-- Responses:
-- 200 - { trip: { id, status: "cancelled" } }
-- 400 - Trip cannot be cancelled (already started/completed)
-- 401 - Unauthorized

-- POST /api/v1/customer/rate-driver
-- Request body:
-- {
--   "trip_id": "trip-uuid",
--   "rating": 4.5,
--   "review": "Great driver, helpful with luggage"
-- }
-- Responses:
-- 200 - { rating: updated_driver_rating }
-- 400 - Invalid rating (must be 1-5)
-- 401 - Unauthorized

-- ===== DRIVER ENDPOINTS =====

-- GET /api/v1/driver/available-trips
-- Headers: Authorization: Bearer <token>
-- Query params: trip_type?, status? (pending|accepted)
-- Responses:
-- 200 - { trips: [...], count: number }
-- 401 - Unauthorized

-- POST /api/v1/driver/accept-trip
-- Request body:
-- {
--   "trip_id": "trip-uuid"
-- }
-- Responses:
-- 200 - { trip: { id, status: "accepted", driver_id } }
-- 400 - Trip already accepted by another driver
-- 401 - Unauthorized
-- 404 - Trip not found

-- POST /api/v1/driver/update-location
-- Request body:
-- {
--  "latitude": 4.1234,
--  "longitude": 30.5678
-- }
-- Responses:
-- 200 - { success: true }
-- 400 - Invalid coordinates
-- 401 - Unauthorized

-- GET /api/v1/driver/earnings
-- Headers: Authorization: Bearer <token>
-- Query params: start_date?, end_date?
-- Responses:
-- 200 - { earnings: { total: amount, period }, trips: [...] }
-- 401 - Unauthorized

-- GET /api/v1/driver/trip/:tripId
-- Headers: Authorization: Bearer <token>
-- Responses:
-- 200 - { trip: detailed_trip_info_with_tracking }
-- 401 - Unauthorized

-- POST /api/v1/driver/complete-trip
-- Request body:
-- {
--   "trip_id": "trip-uuid",
--   "final_fare": 15.50,
--   "tip_received": 2.00,
--   "rating_optional": 5,
--   "review_optional": "Good trip"
-- }
-- Responses:
-- 200 - { trip: { id, status: "completed", final_earnings } }
-- 400 - Trip not in progress
-- 401 - Unauthorized

-- ===== SHOP OWNER ENDPOINTS =====

-- POST /api/v1/shop/create-order
-- Request body:
-- {
--   "customer_id": "user-uuid",
--   "items": [{ "product_id": "prod-uuid", "quantity": 2 }],
--   "delivery_address": { "lat":..., "lng":..., "name": "Home" },
--   "special_instructions": "Leave at front door"
-- }
-- Responses:
-- 201 - { order: { id, status, total, driver_assigned? } }
-- 400 - Invalid product/information

-- GET /api/v1/shop/orders
-- Headers: Authorization: Bearer <token>
-- Query params: status=pending|processing|completed|cancelled, page=1, limit=20
-- Responses:
-- 200 - { orders: [...], pagination: {...} }
-- 401 - Unauthorized

-- GET /api/v1/shop/orders/:orderId
-- Headers: Authorization: Bearer <token>
-- Responses:
-- 200 - { order: detailed_order_info }
-- 401 - Unauthorized

-- GET /api/v1/shop/dashboard
-- Headers: Authorization: Bearer <token>
-- Responses:
-- 200 - { dashboard: { revenue, orders_today, active_deliveries, rating } }
-- 401 - Unauthorized

-- ===== ADMIN ENDPOINTS =====

-- GET /api/v1/admin/users
-- Headers: Authorization: Bearer <token>
-- Query params: role=customer|driver|shop, page=1, limit=50
-- Responses:
-- 200 - { users: [...], pagination: {...} }
-- 401 - Unauthorized
-- 403 - Admin only

-- POST /api/v1/admin/users/:userId/toggle-status
-- Headers: Authorization: Bearer <token>
-- Request body: { is_active: boolean }
-- Responses:
-- 200 - { user: { id, is_active } }
-- 401 - Unauthorized
-- 403 - Admin only

-- GET /api/v1/admin/trips
-- Headers: Authorization: Bearer <token>
-- Query params: status?, type?, page=1, limit=50
-- Responses:
-- 200 - { trips: [...], pagination: {...} }
-- 401 - Unauthorized
-- 403 - Admin only

-- GET /api/v1/admin/analytics
-- Headers: Authorization: Bearer <token>
-- Responses:
-- 200 - { 
--   total_users: number,
--   total_drivers: number,
--   total_shops: number,
--   total_trips: number,
--   revenue_today: number,
--   revenue_this_month: number,
--   active_trips: number,
--   average_rating: number
-- }
-- 401 - Unauthorized
-- 403 - Admin only

-- POST /api/v1/admin/-settings
-- Headers: Authorization: Bearer <token>
-- Request body: { key, value } -- update platform settings
-- Responses:
-- 200 - { setting: { key, value } }
-- 401 - Unauthorized
-- 403 - Admin only

-- ===== PAYMENT ENDPOINTS =====

-- POST /api/v1/payments/initiate
-- Request body:
-- {
--   "trip_id": "trip-uuid",
--   "payment_method": "card" | "wallet" | "cash",
--   "save_to_wallet": boolean
-- }
-- Responses:
-- 201 - { payment: { id, status, url? } } -- url for redirect to payment gateway
-- 400 - Invalid trip or payment method

-- GET /api/v1/payments/status/:paymentId
-- Responses:
-- 200 - { payment: { id, status, amount, transaction_id } }
-- 404 - Payment not found

-- ===== TRIP TRACKING WEBSOCKET =====
-- WS /api/v1/trips/:tripId/tracking
-- Headers: Authorization: Bearer <token> (for customer)
-- OR no auth (for driver dashboard subscription)
-- Events:
-- "location_update": { latitude, longitude, timestamp, heading, speed }
-- "status_change": { from, to, timestamp }
-- "fare_update": { base_fare, distance, waiting, total, tip }
-- "eta_update": { estimated_minutes }
-- Errors: {"code": "4001", "message": "Trip not found or access denied"}

-- ===== RATE LIMITING =====
-- Global: 100 requests per 15 minutes per IP
-- Auth routes: 10 requests per minute per user
-- Trip routes: 50 requests per minute per user
-- Admin routes: 200 requests per minute (limited)

-- ===== ERROR RESPONSE FORMAT =====
-- All errors follow:
-- {
--   "error": "ERROR_TYPE",
--   "message": "Human readable message",
--   "path": "/api/v1/endpoint", -- optional
--   "timestamp": "2024-01-01T00:00:00Z" -- optional
-- }
-- HTTP status codes: 400, 401, 403, 404, 422, 429, 500