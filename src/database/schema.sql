-- Gozaride database schema, version 1.
--
-- Safe to run repeatedly: every statement is idempotent and nothing is dropped.
-- Money: fares are stored in USD (canonical). Each trip also stores the
-- SSP-per-USD rate in force when it was priced, so historical SSP amounts
-- never change when an admin updates the rate.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() on older Postgres

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash    text NOT NULL,
  full_name        text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  phone            text CHECK (phone IS NULL OR char_length(phone) BETWEEN 6 AND 20),
  role             text NOT NULL CHECK (role IN ('customer', 'driver', 'shop', 'admin')),
  default_currency text NOT NULL DEFAULT 'usd' CHECK (default_currency IN ('usd', 'ssp')),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_login_at    timestamptz
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- ------------------------------------------------------- driver profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id              uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  vehicle_type         text,
  plate_number         text,
  is_online            boolean NOT NULL DEFAULT false,
  latitude             double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude            double precision CHECK (longitude BETWEEN -180 AND 180),
  location_updated_at  timestamptz,
  rating_avg           numeric(3, 2) NOT NULL DEFAULT 0,
  rating_count         integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS driver_online_idx ON driver_profiles (is_online);

-- -------------------------------------------------- exchange rate history
-- Admin-set. The current rate is the newest row. There is no seed row:
-- until an admin sets a rate, trips cannot be priced.
CREATE TABLE IF NOT EXISTS currency_rates (
  id           bigserial PRIMARY KEY,
  ssp_per_usd  numeric(14, 4) NOT NULL CHECK (ssp_per_usd > 0),
  set_by       uuid REFERENCES users (id),
  set_at       timestamptz NOT NULL DEFAULT now(),
  note         text CHECK (note IS NULL OR char_length(note) <= 300)
);

CREATE INDEX IF NOT EXISTS currency_rates_latest_idx ON currency_rates (set_at DESC);

-- ----------------------------------------------------------------- trips
CREATE TABLE IF NOT EXISTS trips (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 uuid NOT NULL REFERENCES users (id),
  driver_id                   uuid REFERENCES users (id),
  service_type                text NOT NULL CHECK (service_type IN ('taxi', 'motorcycle', 'package', 'food', 'rental', 'bus')),
  status                      text NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  origin_name                 text CHECK (origin_name IS NULL OR char_length(origin_name) <= 200),
  origin_lat                  double precision NOT NULL CHECK (origin_lat BETWEEN -90 AND 90),
  origin_lng                  double precision NOT NULL CHECK (origin_lng BETWEEN -180 AND 180),
  dest_name                   text CHECK (dest_name IS NULL OR char_length(dest_name) <= 200),
  dest_lat                    double precision NOT NULL CHECK (dest_lat BETWEEN -90 AND 90),
  dest_lng                    double precision NOT NULL CHECK (dest_lng BETWEEN -180 AND 180),
  distance_km                 numeric(8, 2) NOT NULL CHECK (distance_km >= 0),
  eta_minutes                 integer NOT NULL CHECK (eta_minutes >= 0),
  fare_usd                    numeric(10, 2) NOT NULL CHECK (fare_usd >= 0),
  exchange_rate_ssp_per_usd   numeric(14, 4) NOT NULL CHECK (exchange_rate_ssp_per_usd > 0),
  commission_rate             numeric(4, 3) NOT NULL DEFAULT 0.200 CHECK (commission_rate BETWEEN 0 AND 1),
  requested_at                timestamptz NOT NULL DEFAULT now(),
  accepted_at                 timestamptz,
  started_at                  timestamptz,
  completed_at                timestamptz,
  cancelled_at                timestamptz,
  cancel_reason               text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 300),
  CONSTRAINT trips_pending_has_no_driver CHECK (status <> 'pending' OR driver_id IS NULL),
  CONSTRAINT trips_active_has_driver CHECK (status NOT IN ('accepted', 'in_progress', 'completed') OR driver_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS trips_customer_idx ON trips (customer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS trips_driver_idx ON trips (driver_id, status);
CREATE INDEX IF NOT EXISTS trips_open_idx ON trips (service_type, requested_at) WHERE status = 'pending';

-- Live GPS samples while a trip is in progress.
CREATE TABLE IF NOT EXISTS trip_locations (
  id           bigserial PRIMARY KEY,
  trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  driver_id    uuid NOT NULL REFERENCES users (id),
  latitude     double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude    double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_locations_trip_idx ON trip_locations (trip_id, recorded_at DESC);

-- ---------------------------------------------------------------- ratings
CREATE TABLE IF NOT EXISTS ratings (
  id          bigserial PRIMARY KEY,
  trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  rater_id    uuid NOT NULL REFERENCES users (id),
  ratee_id    uuid NOT NULL REFERENCES users (id),
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, rater_id)
);

-- ------------------------------------------------------------ shop profiles
CREATE TABLE IF NOT EXISTS shop_profiles (
  user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  shop_name    text NOT NULL CHECK (char_length(shop_name) BETWEEN 2 AND 120),
  address      text CHECK (address IS NULL OR char_length(address) <= 300),
  latitude     double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude    double precision CHECK (longitude BETWEEN -180 AND 180),
  is_open      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- products
CREATE TABLE IF NOT EXISTS products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description     text CHECK (description IS NULL OR char_length(description) <= 2000),
  price_ssp       numeric(12, 2) NOT NULL CHECK (price_ssp >= 0),
  price_usd       numeric(10, 2) NOT NULL CHECK (price_usd >= 0),
  category        text NOT NULL CHECK (category IN ('food', 'grocery', 'electronics', 'clothing', 'other')),
  image_url       text CHECK (image_url IS NULL OR char_length(image_url) <= 500),
  stock_quantity  integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_shop_idx ON products (shop_id, is_active);

-- --------------------------------------------------------- shop orders
CREATE TABLE IF NOT EXISTS shop_orders (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                    uuid NOT NULL REFERENCES users (id),
  customer_id                uuid NOT NULL REFERENCES users (id),
  driver_id                  uuid REFERENCES users (id),
  status                     text NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready_for_pickup',
                                                 'out_for_delivery', 'delivered', 'cancelled')),
  subtotal_ssp               numeric(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal_ssp >= 0),
  delivery_fee_ssp           numeric(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee_ssp >= 0),
  total_ssp                  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_ssp >= 0),
  total_usd                  numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
  exchange_rate_ssp_per_usd  numeric(14, 4) NOT NULL CHECK (exchange_rate_ssp_per_usd > 0),
  pickup_address             text CHECK (pickup_address IS NULL OR char_length(pickup_address) <= 300),
  delivery_address           text NOT NULL CHECK (char_length(delivery_address) BETWEEN 5 AND 300),
  pickup_lat                 double precision NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng                 double precision NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  delivery_lat               double precision NOT NULL CHECK (delivery_lat BETWEEN -90 AND 90),
  delivery_lng               double precision NOT NULL CHECK (delivery_lng BETWEEN -180 AND 180),
  notes                      text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  confirmed_at               timestamptz,
  ready_at                   timestamptz,
  picked_up_at               timestamptz,
  delivered_at               timestamptz,
  cancelled_at               timestamptz,
  cancel_reason              text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 300)
);

CREATE INDEX IF NOT EXISTS shop_orders_shop_idx ON shop_orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_customer_idx ON shop_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_driver_idx ON shop_orders (driver_id, status);

CREATE TABLE IF NOT EXISTS shop_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES shop_orders (id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products (id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price_ssp  numeric(12, 2) NOT NULL CHECK (unit_price_ssp >= 0),
  unit_price_usd  numeric(10, 2) NOT NULL CHECK (unit_price_usd >= 0),
  line_total_ssp  numeric(12, 2) NOT NULL CHECK (line_total_ssp >= 0),
  line_total_usd  numeric(10, 2) NOT NULL CHECK (line_total_usd >= 0)
);

CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON shop_order_items (order_id);

-- ------------------------------------------------------------- wallets
CREATE TABLE IF NOT EXISTS wallets (
  user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  ssp_balance  numeric(14, 2) NOT NULL DEFAULT 0 CHECK (ssp_balance >= 0),
  usd_balance  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (usd_balance >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'trip_payment', 'shop_payment',
                                                  'commission', 'bonus', 'refund', 'convert', 'payout')),
  amount_ssp       numeric(14, 2) NOT NULL DEFAULT 0,
  amount_usd       numeric(12, 2) NOT NULL DEFAULT 0,
  currency_used    text NOT NULL CHECK (currency_used IN ('ssp', 'usd')),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  description      text CHECK (description IS NULL OR char_length(description) <= 300),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id, created_at DESC);

-- ------------------------------------------------------- driver earnings
CREATE TABLE IF NOT EXISTS earnings_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  trip_id            uuid REFERENCES trips (id) ON DELETE SET NULL,
  net_earnings_ssp   numeric(14, 2) NOT NULL,
  net_earnings_usd   numeric(12, 2) NOT NULL,
  paid_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id)
);

CREATE INDEX IF NOT EXISTS earnings_driver_idx ON earnings_history (driver_id, paid_at DESC);
