/* Gozaride - Enhanced PostgreSQL Schema with SSP/USD Currency */
-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== ENUMS =====
CREATE TYPE user_role AS ENUM ('customer', 'driver', 'shop', 'admin');
CREATE TYPE trip_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE trip_type AS ENUM ('taxi', 'motorcycle', 'package', 'food', 'rental', 'bus');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('card', 'wallet', 'cash', 'transfer', 'ssp', 'usd');
CREATE TYPE currency_type AS ENUM ('ssp', 'usd');
CREATE TYPE wallet_type AS ENUM ('credit', 'deposit', 'earnings', 'balance');

-- ===== TABLE: users (extended with currency) =====
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role user_role NOT NULL DEFAULT 'customer',
  email_verified BOOLEAN DEFAULT FALSE,
  -- Currency preferences
  default_currency currency_type DEFAULT 'usd',
  -- Wallet info
  wallet_balance_ssp DECIMAL(12, 2) DEFAULT 0,
  wallet_balance_usd DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for users =====
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_default_currency ON users(default_currency);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ===== TABLE: currency_rates (admin-set exchange rates) =====
CREATE TABLE currency_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency currency_type NOT NULL,
  to_currency currency_type NOT NULL,
  rate DECIMAL(15, 4) NOT NULL, -- 1 from_currency = rate to_currency
  is_active BOOLEAN DEFAULT TRUE,
  set_by_admin UUID REFERENCES users(id),
  set_at TIMESTAMPTZ DEFAULT NOW(),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);

-- ===== INDEXES for currency_rates =====
CREATE INDEX idx_currency_rates_from_to ON currency_rates(from_currency, to_currency);
CREATE INDEX idx_currency_rates_active ON currency_rates(is_active);

-- ===== DEFAULT RATE INSERTION =====
INSERT INTO currency_rates (from_currency, to_currency, rate, set_by_admin, set_at, valid_from, valid_until)
VALUES ('ssd', 'usd', 0.056::decimal(15,4), NULL, NOW(), NOW(), NULL),
       ('usd', 'ssd', 17.86::decimal(15,4), NULL, NOW(), NOW(), NULL),
       ('ssd', 'ssd', 1.0000::decimal(15,4), NULL, NOW(), NOW(), NULL),
       ('usd', 'usd', 1.0000::decimal(15,4), NULL, NOW(), NOW(), NULL);

-- ===== TABLE: wallets (detailed wallet tracking) =====
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  ssp_balance DECIMAL(12, 2) DEFAULT 0,
  usd_balance DECIMAL(10, 2) DEFAULT 0,
  total_deposited_ssp DECIMAL(12, 2) DEFAULT 0,
  total_deposited_usd DECIMAL(10, 2) DEFAULT 0,
  total_withdrawn_ssp DECIMAL(12, 2) DEFAULT 0,
  total_withdrawn_usd DECIMAL(10, 2) DEFAULT 0,
  bonus_ssp DECIMAL(12, 2) DEFAULT 0,
  bonus_usd DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for wallets =====
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ===== TABLE: transactions (all wallet/ payment transactions) =====
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type transaction_type NOT NULL, -- 'deposit', 'withdrawal', 'trip_payment', 'commission', 'bonus', 'refund'
  amount_ssp DECIMAL(12, 2) NOT NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  currency_used currency_type NOT NULL,
  status payment_status DEFAULT 'pending',
  description TEXT,
  reference_id UUID, -- trip_id, referral_id, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for transactions =====
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_trip_id ON transactions(trip_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- ===== TABLE: transaction_types (enum values) =====
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'trip_payment', 'commission', 'bonus', 'refund', 'referral_reward');

-- ===== TABLE: reviews_ratings (enhanced) =====
CREATE TABLE reviews_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewee_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  rating DECIMAL(3, 2) NOT NULL, -- 1.0 to 5.0
  title VARCHAR(100),
  review TEXT,
  -- Currency of any monetary feedback
  amount_ssp DECIMAL(12, 2) DEFAULT 0,
  amount_usd DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_rating_check CHECK (rating >= 1 AND rating <= 5)
);

-- ===== INDEXES for reviews_ratings =====
CREATE INDEX idx_reviews_ratings_reviewer ON reviews_ratings(reviewer_id);
CREATE INDEX idx_reviews_ratings_reviewee ON reviews_ratings(reviewee_id);
CREATE INDEX idx_reviews_ratings_trip ON reviews_ratings(trip_id);
CREATE INDEX idx_reviews_ratings_rating ON reviews_ratings(rating);

-- ===== TABLE: referral_codes =====
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  code VARCHAR(20) UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  max_uses INTEGER,
  reward_ssp DECIMAL(12, 2) DEFAULT 0,
  reward_usd DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ
);

-- ===== INDEXES for referral_codes =====
CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referral_codes_active ON referral_codes(is_active);

-- ===== TABLE: earnings_history (driver earnings breakdown) =====
CREATE TABLE earnings_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  amount_ssp DECIMAL(12, 2) NOT NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  commission_ssp DECIMAL(12, 2) DEFAULT 0,
  commission_usd DECIMAL(10, 2) DEFAULT 0,
  net_earnings_ssp DECIMAL(12, 2) NOT NULL,
    net_earnings_usd DECIMAL(10, 2) NOT NULL,
  trip_status trip_status NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES for earnings_history =====
CREATE INDEX idx_earnings_history_driver_id ON earnings_history(driver_id);
CREATE INDEX idx_earnings_history_trip_id ON earnings_history(trip_id);
CREATE INDEX idx_earnings_history_paid_at ON earnings_history(paid_at);

-- ===== TABLE: platform_settings (enhanced) =====
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
  ('default_distance_rate', '1.50'::jsonb), -- per km in USD
  ('default_waiting_rate', '0.50'::jsonb), -- per minute in USD
  ('currency', '{"ssd": "SSP", "usd": "USD", "default": "usd"}'::jsonb),
  ('exchange_rate_ssd_to_usd', '0.056'::jsonb),
  ('exchange_rate_usd_to_ssd', '17.86'::jsonb);

-- ===== VIEWS =====

-- ===== Active Trips Summary (with currency) =====
CREATE OR REPLACE VIEW active_trips_summary AS
SELECT 
  t.id,
  t.type,
  t.status,
  t.estimated_duration,
  t.estimated_distance,
  t.base_fare,
  t.final_fare,
  t.currency_used,
  t.final_fare_ssp,
  t.final_fare_usd,
  u.full_name AS customer_name,
  u2.full_name AS driver_name,
  dp.current_latitude AS driver_lat,
  dp.current_longitude AS driver_lon
FROM trips t
JOIN users u ON t.customer_id = u.id
LEFT JOIN users u2 ON t.driver_id = u2.id
LEFT JOIN driver_profiles dp ON u2.id = dp.user_id
WHERE t.status IN ('pending', 'accepted', 'in_progress');

-- ===== Driver Dashboard View (with earnings in both currencies) =====
CREATE OR REPLACE VIEW driver_dashboard_view AS
SELECT 
  dp.*,
  u.email,
  u.full_name,
  (SELECT COALESCE(SUM(net_earnings_ssp), 0) FROM earnings_history WHERE driver_id = dp.user_id AND status = 'completed') AS total_earnings_ssd,
  (SELECT COALESCE(SUM(net_earnings_usd), 0) FROM earnings_history WHERE driver_id = dp.user_id AND status = 'completed') AS total_earnings_usd,
  (SELECT COUNT(*) FROM trips WHERE driver_id = dp.user_id AND status = 'completed') AS completed_rides,
  (SELECT COUNT(*) FROM trips WHERE driver_id = dp.user_id AND status = 'accepted') AS active_rides
FROM driver_profiles dp
JOIN users u ON dp.user_id = u.id;

-- ===== Customer Wallet View =====
CREATE OR REPLACE VIEW customer_wallet_view AS
SELECT 
  w.id,
  u.full_name,
  u.email,
  w.ssp_balance,
  w.usd_balance,
  w.total_deposited_ssp,
  w.total_deposited_usd,
  w.total_withdrawn_ssp,
  w.total_withdrawn_usd
FROM wallets w
JOIN users u ON w.user_id = u.id;

-- ===== Recent Transactions View =====
CREATE OR REPLACE VIEW recent_transactions_view AS
SELECT 
  t.id,
  t.type,
  t.amount_ssp,
  t.amount_usd,
  t.currency_used,
  t.status,
  t.description,
  t.created_at,
  u.full_name AS user_full_name
FROM transactions t
JOIN users u ON t.user_id = u.id
ORDER BY t.created_at DESC
LIMIT 50;
