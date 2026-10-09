/* Gozaride - Comprehensive PostgreSQL Database Schema
 * Designed for VPS deployment with scalability in mind
 * All tables use UUID primary keys for distributed compatibility
 * Row-level security policies should be applied in production
 */

-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== ENUMS =====
CREATE TYPE user_role AS ENUM ('customer', 'driver', 'shop', 'admin');
CREATE TYPE trip_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE trip_type AS ENUM ('taxi', 'motorcycle', 'package', 'food', 'rental', 'bus');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('card', 'wallet', 'cash', 'transfer');
CREATE TYPE request_status AS ENUM ('active', 'accepted', 'completed', 'cancelled');

-- ===== TABLE: users (extends for each role) =====
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role user_role NOT NULL DEFAULT 'customer',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for users =====
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ===== TABLE: customer_profiles =====
CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  home_latitude DECIMAL(10, 8),
  home_longitude DECIMAL(11, 8),
  work_latitude DECIMAL(10, 8),
  work_longitude DECIMAL(11, 8),
  preferred_pickup_zone VARCHAR(100),
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for customer_profiles =====
CREATE INDEX idx_customer_profiles_user_id ON customer_profiles(user_id);
CREATE INDEX idx_customer_profiles_lat_lon ON customer_profiles USING GIN (
  to_tsvector('english', preferred_pickup_zone)
);

-- ===== TABLE: driver_profiles =====
CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  vehicle_type VARCHAR(50),
  license_number VARCHAR(50),
  status request_status DEFAULT 'active', -- active, offline, on_trip, unavailable
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  is_available BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  earnings DECIMAL(10, 2) DEFAULT 0,
  commission_rate DECIMAL(5, 2) DEFAULT 0.20, -- 20% platform commission
  vehicle_color VARCHAR(20),
  vehicle_model VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for driver_profiles =====
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_status ON driver_profiles(status);
CREATE INDEX idx_driver_profiles_location ON driver_profiles (current_latitude, current_longitude);
CREATE INDEX idx_driver_profiles_available ON driver_profiles(is_available);

-- ===== TABLE: shop_profiles =====
CREATE TABLE shop_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  shop_name VARCHAR(100) NOT NULL,
  business_type VARCHAR(50), -- restaurant, retail, service, etc.
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  delivery_radius_km DECIMAL(5, 2) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_orders INTEGER DEFAULT 0,
  revenue DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for shop_profiles =====
CREATE INDEX idx_shop_profiles_user_id ON shop_profiles(user_id);
CREATE INDEX idx_shop_profiles_location ON shop_profiles (latitude, longitude);

-- ===== TABLE: trips (the main booking system) =====
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type trip_type NOT NULL,
  status trip_status DEFAULT 'pending',
  
  -- Origin & Destination
  origin_latitude DECIMAL(10, 8) NOT NULL,
  origin_longitude DECIMAL(11, 8) NOT NULL,
  destination_latitude DECIMAL(10, 8) NOT NULL,
  destination_longitude DECIMAL(11, 8) NOT NULL,
  origin_name VARCHAR(100), -- e.g., "Home", "Restaurant", "Airport"
  destination_name VARCHAR(100),
  
  -- Trip details
  pickup_window_start TIMESTAMPTZ,
  pickup_window_end TIMESTAMPTZ,
  estimated_duration INTEGER, -- in minutes
  estimated_distance DECIMAL(8, 2), -- in km
  base_fare DECIMAL(10, 2) DEFAULT 0,
  distance_rate DECIMAL(8, 2) DEFAULT 0, -- per km
  waiting_rate DECIMAL(8, 2) DEFAULT 0, -- per minute
  surge_multiplier DECIMAL(5, 2) DEFAULT 1.0,
  final_fare DECIMAL(10, 2),
  
  -- Timing
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Payment
  payment_id UUID,
  payment_status payment_status DEFAULT 'pending',
  payment_method payment_method,
  tip_amount DECIMAL(8, 2) DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for trips =====
CREATE INDEX idx_trips_customer_id ON trips(customer_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_type ON trips(type);
CREATE INDEX idx_trips_created_at ON trips(requested_at);
CREATE INDEX idx_trips_origin ON trips (origin_latitude, origin_longitude);
CREATE INDEX idx_trips_destination ON trips (destination_latitude, destination_longitude);
CREATE INDEX idx_trips_driver_status ON trips(driver_id, status) WHERE driver_id IS NOT NULL;

-- ===== TABLE: trip_updates (real-time tracking) =====
CREATE TABLE trip_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  speed DECIMAL(8, 2), -- km/h
  heading DECIMAL(8, 2), -- degrees
  occupancy_status VARCHAR(20), -- 'available', 'en_route', 'passenger_onboard',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ===== INDEXES for trip_updates =====
CREATE INDEX idx_trip_updates_trip_id ON trip_updates(trip_id);
CREATE INDEX idx_trip_updates_driver_id ON trip_updates(driver_id);
CREATE INDEX idx_trip_updates_timestamp ON trip_updates(timestamp DESC);

-- ===== TABLE: payments =====
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status payment_status DEFAULT 'pending',
  method payment_method,
  transaction_id VARCHAR(100), -- external gateway transaction ID
  gateway_response JSONB DEFAULT '{}',
  refunded_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for payments =====
CREATE INDEX idx_payments_trip_id ON payments(trip_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ===== TABLE: reviews_ratings =====
CREATE TABLE reviews_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewee_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  rating DECIMAL(3, 2) NOT NULL, -- 1.0 to 5.0
  title VARCHAR(100),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: rating must be between 1 and 5
  CONSTRAINT chk_rating_check CHECK (rating >= 1 AND rating <= 5)
);

-- ===== INDEXES for reviews_ratings =====
CREATE INDEX idx_reviews_ratings_reviewer ON reviews_ratings(reviewer_id);
CREATE INDEX idx_reviews_ratings_reviewee ON reviews_ratings(reviewee_id);
CREATE INDEX idx_reviews_ratings_trip ON reviews_ratings(trip_id);
CREATE INDEX idx_reviews_ratings_rating ON reviews_ratings(rating);

-- ===== TABLE: driver_availability_schedule =====
CREATE TABLE driver_availability_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  is_available BOOLEAN DEFAULT TRUE,
  start_time TIME DEFAULT '00:00',
  end_time TIME DEFAULT '23:59',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for driver_availability_schedule =====
CREATE INDEX idx_driver_availability_driver_id ON driver_availability_schedule(driver_id);
CREATE INDEX idx_driver_availability_day ON driver_availability_schedule(day_of_week);

-- ===== TABLE: platform_settings =====
CREATE TABLE platform_settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== DEFAULT SETTINGS =====
INSERT INTO platform_settings (key, value) VALUES
  ('commission_rate', '0.20'::jsonb),
  ('surge_multiplier_threshold', '2.0'::jsonb),
  ('min_rating_to_drive', '4.0'::jsonb),
  ('default_distance_rate', '1.50'::jsonb), -- per km
  ('default_waiting_rate', '0.50'::jsonb), -- per minute
  ('currency', '"USD"'::jsonb);

-- ===== ROW-LEVEL SECURITY POLICIES (commented for manual application) =====
/*
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews_ratings ENABLE ROW LEVEL SECURITY;

-- Customers can only see their own trips
CREATE POLICY customer_trips_policy ON trips FOR ALL
  USING (customer_id = current_setting('app.current_user_id')::uuid);

-- Drivers can see their own trips
CREATE POLICY driver_trips_policy ON trips FOR ALL
  USING (driver_id = current_setting('app.current_user_id')::uuid);

-- Admins can see everything
CREATE POLICY admin_policy ON trips FOR ALL
  USING (current_setting('app.admin_mode')::boolean = TRUE);
*/

-- ===== VIEW: active_trips_summary =====
CREATE OR REPLACE VIEW active_trips_summary AS
SELECT 
  t.id,
  t.type,
  t.status,
  t.estimated_duration,
  t.estimated_distance,
  t.base_fare,
  t.final_fare,
  t.requested_at,
  u.full_name AS customer_name,
  u2.full_name AS driver_name,
  dp.current_latitude AS driver_lat,
  dp.current_longitude AS driver_lon
FROM trips t
JOIN users u ON t.customer_id = u.id
LEFT JOIN users u2 ON t.driver_id = u2.id
LEFT JOIN driver_profiles dp ON u2.id = dp.user_id
WHERE t.status IN ('pending', 'accepted', 'in_progress');

-- ===== VIEW: driver_dashboard_view =====
CREATE OR REPLACE VIEW driver_dashboard_view AS
SELECT 
  dp.*,
  u.email,
  u.full_name,
  (SELECT COUNT(*) FROM trips WHERE driver_id = dp.user_id AND status = 'completed') AS completed_rides,
  (SELECT COUNT(*) FROM trips WHERE driver_id = dp.user_id AND status = 'accepted') AS active_rides,
  (SELECT COALESCE(SUM(final_fare), 0) FROM trips WHERE driver_id = dp.user_id AND status = 'completed') AS total_earnings
FROM driver_profiles dp
JOIN users u ON dp.user_id = u.id;