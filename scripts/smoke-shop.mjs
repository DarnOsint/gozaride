// End-to-end shop test against a running server. Requires an admin with a rate already set
// (run scripts/smoke-test.mjs first, or set the rate manually).
// Usage: BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-shop.mjs
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
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const PWD = "correct-horse-battery";
const admin = await api("POST", "/api/auth/signin", { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
check("admin signs in", admin.status === 200, JSON.stringify(admin));
const rate = await api("GET", "/api/rates");
check("rate is set", rate.status === 200, JSON.stringify(rate));
const SSP_PER_USD = rate.json.ssp_per_usd;

// Accounts
const shop = await api("POST", "/api/auth/signup", {
  body: { email: `shop-${run}@test.gozaride`, password: PWD, full_name: "Test Shop Owner", role: "shop", shop_name: "Juba Test Shop" },
});
check("shop signs up", shop.status === 201, JSON.stringify(shop));
const shopToken = shop.json.token;
const other = await api("POST", "/api/auth/signup", {
  body: { email: `shop2-${run}@test.gozaride`, password: PWD, full_name: "Other Shop", role: "shop", shop_name: "Other Shop" },
});
const customer = await api("POST", "/api/auth/signup", {
  body: { email: `buyer-${run}@test.gozaride`, password: PWD, full_name: "Buyer One", role: "customer" },
});
const buyer2 = await api("POST", "/api/auth/signup", {
  body: { email: `buyer2-${run}@test.gozaride`, password: PWD, full_name: "Buyer Two", role: "customer" },
});
const driver = await api("POST", "/api/auth/signup", {
  body: { email: `drv-${run}@test.gozaride`, password: PWD, full_name: "Delivery Rider", role: "driver" },
});
const custToken = customer.json.token;

// Shop without a location cannot take orders.
let p = await api("POST", "/api/shop/products", {
  token: shopToken,
  body: { name: "Rice 5kg", price_usd: 6.5, category: "grocery", stock_quantity: 10, is_active: true },
});
check("product created", p.status === 201, JSON.stringify(p));
check("SSP price derived from rate", p.json.product.price_ssp === Math.round(6.5 * SSP_PER_USD * 100) / 100, JSON.stringify(p.json));
const productId = p.json.product.id;

const noLoc = await api("POST", "/api/shop/orders", {
  token: custToken,
  body: { shop_id: shop.json.user.id, items: [{ product_id: productId, quantity: 1 }], delivery_address: "Near the market", delivery_lat: 4.85, delivery_lng: 31.6 },
});
check("order refused before shop sets location", noLoc.status === 409, JSON.stringify(noLoc));

const prof = await api("PUT", "/api/shop/profile", {
  token: shopToken,
  body: { shop_name: "Juba Test Shop", address: "Custom Market", latitude: 4.8517, longitude: 31.5825, is_open: true },
});
check("shop sets location", prof.status === 200, JSON.stringify(prof));

// Place an order.
const placed = await api("POST", "/api/shop/orders", {
  token: custToken,
  body: {
    shop_id: shop.json.user.id,
    items: [{ product_id: productId, quantity: 2 }],
    delivery_address: "Hai Malakal, house 12",
    delivery_lat: 4.86,
    delivery_lng: 31.61,
  },
});
check("order placed", placed.status === 201, JSON.stringify(placed));
const order = placed.json.order;
check("order total in USD and SSP", order.total_usd > 13 && order.total_ssp > 0, JSON.stringify(order));
check("subtotal is 2 x $6.50 in SSP", order.subtotal_ssp === Math.round(13 * SSP_PER_USD * 100) / 100, JSON.stringify(order));
check("delivery fee at least $1.50", Math.round((order.total_usd - 13) * 100) / 100 >= 1.5, JSON.stringify(order));

const after = await api("GET", "/api/shop/products", { token: shopToken });
check("stock reserved (10 -> 8)", after.json.products[0].stock_quantity === 8, JSON.stringify(after.json));

// Stock and location checks.
const tooMany = await api("POST", "/api/shop/orders", {
  token: custToken,
  body: { shop_id: shop.json.user.id, items: [{ product_id: productId, quantity: 99 }], delivery_address: "Somewhere far", delivery_lat: 4.86, delivery_lng: 31.61 },
});
check("order beyond stock refused", tooMany.status === 409, JSON.stringify(tooMany));
const wrongShop = await api("POST", "/api/shop/orders", {
  token: custToken,
  body: { shop_id: other.json.user.id, items: [{ product_id: productId, quantity: 1 }], delivery_address: "Somewhere far", delivery_lat: 4.86, delivery_lng: 31.61 },
});
check("items from another shop refused", wrongShop.status === 422, JSON.stringify(wrongShop));

// Privacy: another customer cannot see this order.
const peek = await api("GET", `/api/shop/orders/${order.id}`, { token: buyer2.json.token });
check("other customer cannot view order", peek.status === 404, JSON.stringify(peek));
const mine = await api("GET", "/api/shop/orders", { token: buyer2.json.token });
check("other customer's list excludes order", mine.json.orders.every((o) => o.id !== order.id));
const shopOrders = await api("GET", "/api/shop/orders", { token: other.json.token });
check("other shop's list excludes order", shopOrders.json.orders.every((o) => o.id !== order.id));

// Status rules.
const skip = await api("POST", `/api/shop/orders/${order.id}/status`, { token: shopToken, body: { status: "ready_for_pickup" } });
check("cannot skip to ready", skip.status === 409, JSON.stringify(skip));
const wrongRole = await api("POST", `/api/shop/orders/${order.id}/status`, { token: custToken, body: { status: "confirmed" } });
check("customer cannot confirm", wrongRole.status === 403, JSON.stringify(wrongRole));
const confirm = await api("POST", `/api/shop/orders/${order.id}/status`, { token: shopToken, body: { status: "confirmed" } });
check("shop confirms", confirm.status === 200 && confirm.json.status === "confirmed", JSON.stringify(confirm));

// Customer cancels a second order: stock must come back.
const second = await api("POST", "/api/shop/orders", {
  token: buyer2.json.token,
  body: { shop_id: shop.json.user.id, items: [{ product_id: productId, quantity: 3 }], delivery_address: "Hai Jebel", delivery_lat: 4.84, delivery_lng: 31.6 },
});
check("second order placed", second.status === 201, JSON.stringify(second));
const cancel = await api("POST", `/api/shop/orders/${second.json.order.id}/status`, { token: buyer2.json.token, body: { status: "cancelled", reason: "changed mind" } });
check("customer cancels", cancel.status === 200 && cancel.json.status === "cancelled", JSON.stringify(cancel));
const restored = await api("GET", "/api/shop/products", { token: shopToken });
check("cancelled stock returned (8 -> 5 -> 8)", restored.json.products[0].stock_quantity === 8, JSON.stringify(restored.json));

// Driver pickup and delivery.
const dt = driver.json.token;
let r = await api("POST", "/api/driver/availability", { token: dt, body: { is_online: true, vehicle_type: "motorcycle" } });
check("driver online", r.status === 200, JSON.stringify(r));
const notReady = await api("POST", `/api/shop/orders/${order.id}/claim`, { token: dt });
check("cannot claim before ready", notReady.status === 409, JSON.stringify(notReady));
for (const s of ["preparing", "ready_for_pickup"]) {
  r = await api("POST", `/api/shop/orders/${order.id}/status`, { token: shopToken, body: { status: s } });
  check(`shop marks ${s}`, r.status === 200, JSON.stringify(r));
}
const avail = await api("GET", "/api/shop/orders/available", { token: dt });
check("driver sees ready order", avail.status === 200 && avail.json.orders.some((o) => o.id === order.id), JSON.stringify(avail));
const claim = await api("POST", `/api/shop/orders/${order.id}/claim`, { token: dt });
check("driver claims order", claim.status === 200, JSON.stringify(claim));
const claim2 = await api("POST", `/api/shop/orders/${order.id}/claim`, { token: dt });
check("second claim refused", claim2.status === 409, JSON.stringify(claim2));
const shopCannotDeliver = await api("POST", `/api/shop/orders/${order.id}/status`, { token: shopToken, body: { status: "delivered" } });
check("shop cannot mark delivered", shopCannotDeliver.status === 403, JSON.stringify(shopCannotDeliver));
const deliver = await api("POST", `/api/shop/orders/${order.id}/status`, { token: dt, body: { status: "delivered" } });
check("driver delivers", deliver.status === 200 && deliver.json.status === "delivered", JSON.stringify(deliver));

const stats = await api("GET", "/api/shop/stats", { token: shopToken });
check("shop revenue counts delivered order", stats.status === 200 && stats.json.revenue_usd >= order.total_usd - 1e-9, JSON.stringify(stats));

console.log(`\nall ${passed} shop checks passed`);
