// End-to-end test against a running server. Exits non-zero on the first failure.
// Usage: BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-test.mjs
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  process.exit(1);
}

const run = Date.now().toString(36);
let passed = 0;

function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`FAIL ${name} ${detail}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`ok   ${name}`);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// 1. Before any rate is set, pricing is unavailable.
let r = await api("GET", "/api/rates");
if (r.status === 503) {
  console.log("ok   rate unset returns 503");
  passed += 1;
} else {
  console.log("note rate already set from an earlier run; 503 check skipped");
}

// 2. Admin sets the rate.
const admin = await api("POST", "/api/auth/signin", { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
check("admin signs in", admin.status === 200 && admin.json.token, JSON.stringify(admin));
r = await api("POST", "/api/admin/rates", { token: admin.json.token, body: { ssp_per_usd: 1500, note: "smoke test rate" } });
check("admin sets rate", r.status === 201 && r.json.ssp_per_usd === 1500, JSON.stringify(r));
r = await api("GET", "/api/rates");
check("public rate readable", r.status === 200 && r.json.ssp_per_usd === 1500, JSON.stringify(r));

// 3. Customer and two drivers sign up.
const pwd = "correct-horse-battery";
const customer = await api("POST", "/api/auth/signup", {
  body: { email: `cust-${run}@test.gozaride`, password: pwd, full_name: "Test Customer", role: "customer" },
});
check("customer signs up", customer.status === 201 && customer.json.token, JSON.stringify(customer));
const driver = await api("POST", "/api/auth/signup", {
  body: { email: `drv-${run}@test.gozaride`, password: pwd, full_name: "Test Driver", role: "driver" },
});
check("driver signs up", driver.status === 201, JSON.stringify(driver));
const driver2 = await api("POST", "/api/auth/signup", {
  body: { email: `drv2-${run}@test.gozaride`, password: pwd, full_name: "Second Driver", role: "driver" },
});
check("second driver signs up", driver2.status === 201, JSON.stringify(driver2));

const dup = await api("POST", "/api/auth/signup", {
  body: { email: `cust-${run}@test.gozaride`, password: pwd, full_name: "Dup", role: "customer" },
});
check("duplicate email rejected", dup.status === 409, JSON.stringify(dup));

const selfAdmin = await api("POST", "/api/auth/signup", {
  body: { email: `x-${run}@test.gozaride`, password: pwd, full_name: "Sneaky", role: "admin" },
});
check("admin self-registration rejected", selfAdmin.status === 422, JSON.stringify(selfAdmin));

const badSignin = await api("POST", "/api/auth/signin", { body: { email: `cust-${run}@test.gozaride`, password: "wrong-password" } });
check("wrong password rejected", badSignin.status === 401, JSON.stringify(badSignin));

const me = await api("GET", "/api/auth/me", { token: customer.json.token });
check("me returns the customer", me.status === 200 && me.json.user.role === "customer", JSON.stringify(me));
const noAuth = await api("GET", "/api/trips");
check("trips need sign-in", noAuth.status === 401, JSON.stringify(noAuth));

// 4. Driver goes online and reports location.
const dt = driver.json.token;
let a = await api("POST", "/api/driver/availability", { token: dt, body: { is_online: true, vehicle_type: "car", plate_number: "SS-1234" } });
check("driver goes online", a.status === 200 && a.json.availability.is_online === true, JSON.stringify(a));
const loc = await api("POST", "/api/driver/location", { token: dt, body: { latitude: 4.85, longitude: 31.6 } });
check("driver location recorded", loc.status === 200, JSON.stringify(loc));

const d2 = driver2.json.token;
a = await api("POST", "/api/driver/availability", { token: d2, body: { is_online: true } });
check("second driver goes online", a.status === 200, JSON.stringify(a));

// 5. Customer requests a trip. Fare is priced in USD with SSP alongside.
const req1 = {
  service_type: "taxi",
  origin: { lat: 4.8517, lng: 31.5825, name: "Market" },
  destination: { lat: 4.8594, lng: 31.6071, name: "Airport" },
};
const t1 = await api("POST", "/api/trips", { token: customer.json.token, body: req1 });
check("trip requested", t1.status === 201 && t1.json.trip.status === "pending", JSON.stringify(t1));
const trip = t1.json.trip;
check("fare in USD and SSP", trip.fare_usd > 0 && trip.fare_ssp === Math.round(trip.fare_usd * 1500 * 100) / 100, JSON.stringify(trip));
check("eta present", Number.isInteger(trip.eta_minutes) && trip.eta_minutes >= 3);

const t2 = await api("POST", "/api/trips", { token: customer.json.token, body: req1 });
check("second concurrent trip blocked", t2.status === 409, JSON.stringify(t2));

const bad = await api("POST", "/api/trips", {
  token: customer.json.token,
  body: { service_type: "taxi", origin: { lat: 99, lng: 0 }, destination: { lat: 1, lng: 1 } },
});
check("invalid coordinates rejected", bad.status === 422, JSON.stringify(bad));

// 6. Drivers see the open request and accept it. Only one can win.
const open = await api("GET", "/api/trips/available", { token: dt });
check("driver sees open trip", open.status === 200 && open.json.trips.some((t) => t.id === trip.id), JSON.stringify(open));

const acc = await api("POST", `/api/trips/${trip.id}/accept`, { token: dt });
check("driver accepts", acc.status === 200 && acc.json.trip.status === "accepted", JSON.stringify(acc));
const active = await api("GET", "/api/trips?status=accepted,in_progress&limit=1", { token: dt });
check("driver's active trip listed with multi-status filter", active.status === 200 && active.json.trips.length === 1 && active.json.trips[0].id === trip.id, JSON.stringify(active));
const avail0 = await api("GET", "/api/driver/availability", { token: dt });
check("driver availability readable after reload", avail0.status === 200 && avail0.json.availability.is_online === true, JSON.stringify(avail0));
const bogus = await api("GET", "/api/trips?status=nope", { token: dt });
check("unknown status rejected", bogus.status === 422, JSON.stringify(bogus));
const acc2 = await api("POST", `/api/trips/${trip.id}/accept`, { token: d2 });
check("second driver cannot take it", acc2.status === 409, JSON.stringify(acc2));

const st = await api("POST", `/api/trips/${trip.id}/start`, { token: dt });
check("trip starts", st.status === 200 && st.json.trip.status === "in_progress", JSON.stringify(st));
const track = await api("POST", "/api/driver/location", { token: dt, body: { latitude: 4.855, longitude: 31.61 } });
check("location recorded against trip", track.status === 200 && track.json.trip_id === trip.id, JSON.stringify(track));

const offline = await api("POST", "/api/driver/availability", { token: dt, body: { is_online: false } });
check("cannot go offline mid-trip", offline.status === 409, JSON.stringify(offline));

const done = await api("POST", `/api/trips/${trip.id}/complete`, { token: dt });
check("trip completes", done.status === 200 && done.json.trip.status === "completed", JSON.stringify(done));
const earnings = await api("GET", "/api/driver/earnings", { token: dt });
const expectedUsd = Math.round(done.json.trip.fare_usd * 0.8 * 100) / 100;
check("driver earnings recorded at 80% of fare", earnings.status === 200 && Math.abs(earnings.json.total_usd - expectedUsd) < 0.01, JSON.stringify(earnings));

// 6b. Wallet credit + payout flow.
const dw = await api("GET", "/api/wallet", { token: dt });
check("trip completion credits driver wallet", dw.status === 200 && Math.abs(dw.json.usd_balance - expectedUsd) < 0.01, JSON.stringify(dw));
const topupNoKeys = await api("POST", "/api/payments/topup", { token: customer.json.token, body: { usd: 10 } });
check("top-up degrades cleanly without Stripe keys", topupNoKeys.status === 503, JSON.stringify(topupNoKeys));
const bigPayout = await api("POST", "/api/payments/payout", { token: dt, body: { usd: expectedUsd + 100 } });
check("payout larger than balance refused", bigPayout.status === 409, JSON.stringify(bigPayout));
const payout = await api("POST", "/api/payments/payout", { token: dt, body: { usd: expectedUsd } });
check("payout request accepted", payout.status === 201, JSON.stringify(payout));
const dw2 = await api("GET", "/api/wallet", { token: dt });
check("payout deducted from wallet USD", dw2.status === 200 && Math.abs(dw2.json.usd_balance) < 0.01, JSON.stringify(dw2));
const payouts = await api("GET", "/api/payments/payouts", { token: dt });
check("payout listed as pending", payouts.status === 200 && payouts.json.payouts.some((p) => p.status === "pending"), JSON.stringify(payouts.json).slice(0, 200));

// 7. Ratings.
const rate1 = await api("POST", `/api/trips/${trip.id}/rate`, { token: customer.json.token, body: { stars: 5, comment: "Great" } });
check("customer rates driver", rate1.status === 201, JSON.stringify(rate1));
const rate2 = await api("POST", `/api/trips/${trip.id}/rate`, { token: customer.json.token, body: { stars: 1 } });
check("duplicate rating rejected", rate2.status === 409, JSON.stringify(rate2));

// 8. Visibility and roles.
const mine = await api("GET", "/api/trips", { token: customer.json.token });
check("customer sees own trips", mine.status === 200 && mine.json.trips.some((t) => t.id === trip.id));
const other = await api("GET", `/api/trips/${trip.id}`, { token: d2 });
check("unrelated driver cannot view trip", other.status === 404, JSON.stringify(other));
const forbidden = await api("GET", "/api/admin/rates", { token: customer.json.token });
check("customer cannot read admin rates", forbidden.status === 403, JSON.stringify(forbidden));
const users = await api("GET", "/api/admin/users?limit=100", { token: admin.json.token });
check("admin user list shape", users.status === 200 && Array.isArray(users.json.users) && users.json.users.length >= 3, JSON.stringify(users.json).slice(0, 200));
const adminTrips = await api("GET", "/api/admin/trips?limit=50", { token: admin.json.token });
check("admin trip list shape", adminTrips.status === 200 && Array.isArray(adminTrips.json.trips), JSON.stringify(adminTrips.json).slice(0, 200));
const history = await api("GET", "/api/admin/rates", { token: admin.json.token });
check("admin reads rate history", history.status === 200 && history.json.history.length >= 1);

console.log(`\nall ${passed} checks passed`);
