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
