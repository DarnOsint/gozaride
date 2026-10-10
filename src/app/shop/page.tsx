"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, money, ssp } from "@/lib/client";
import { SHOP_TRANSITIONS } from "@/lib/shop";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  price_ssp: number;
  category: string;
  image_url: string | null;
  stock_quantity: number;
  is_active: boolean;
};

type OrderItem = { product_name: string; quantity: number; line_total_usd: number };

type Order = {
  id: string;
  status: string;
  total_usd: number;
  total_ssp: number;
  customer_name: string;
  delivery_address: string;
  created_at: string;
  driver_id: string | null;
  items: OrderItem[];
};

type Profile = {
  shop_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
};

type ProductForm = {
  name: string;
  description: string;
  price_usd: string;
  category: string;
  image_url: string;
  stock_quantity: string;
  is_active: boolean;
};

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  price_usd: "",
  category: "food",
  image_url: "",
  stock_quantity: "0",
  is_active: true,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function ShopDashboard({ token }: { token: string }) {
  const [tab, setTab] = useState<"products" | "orders" | "profile">("orders");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ today: 0, revenue_usd: 0, revenue_ssp: 0 });
  const [rate, setRate] = useState<number | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const report = (e: unknown) => setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong");

  const loadAll = useCallback(async () => {
    try {
      const [p, pr, o, s, r] = await Promise.all([
        api<{ products: Product[] }>("/api/shop/products", { token }),
        api<{ profile: Profile | null }>("/api/shop/profile", { token }),
        api<{ orders: Order[] }>("/api/shop/orders?limit=50", { token }),
        api<{ today: number; revenue_usd: number; revenue_ssp: number }>("/api/shop/stats", { token }),
        api<{ ssp_per_usd: number }>("/api/rates", {}).catch(() => null),
      ]);
      setProducts(p.products);
      setProfile(pr.profile);
      setOrders(o.orders);
      setStats(s);
      setRate(r?.ssp_per_usd ?? null);
    } catch (e) {
      report(e);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price_usd: String(p.price_usd),
      category: p.category,
      image_url: p.image_url ?? "",
      stock_quantity: String(p.stock_quantity),
      is_active: p.is_active,
    });
    setShowForm(true);
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price_usd: Number(form.price_usd),
      category: form.category,
      image_url: form.image_url.trim() || undefined,
      stock_quantity: Number(form.stock_quantity),
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await api(`/api/shop/products/${editing.id}`, { token, method: "PUT", body: payload });
        setNotice("Product updated");
      } else {
        await api("/api/shop/products", { token, body: payload });
        setNotice("Product added");
      }
      setShowForm(false);
      await loadAll();
    } catch (err) {
      report(err);
    }
  }

  async function deactivate(p: Product) {
    if (!confirm(`Hide "${p.name}" from customers?`)) return;
    try {
      await api(`/api/shop/products/${p.id}`, { token, method: "DELETE" });
      await loadAll();
    } catch (err) {
      report(err);
    }
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    try {
      await api("/api/shop/profile", {
        token,
        method: "PUT",
        body: {
          shop_name: String(f.get("shop_name") ?? "").trim(),
          address: String(f.get("address") ?? "").trim() || undefined,
          latitude: Number(f.get("latitude")),
          longitude: Number(f.get("longitude")),
          is_open: f.get("is_open") === "on",
        },
      });
      setNotice("Shop profile saved");
      await loadAll();
    } catch (err) {
      report(err);
    }
  }

  function locateMe(setter: (lat: number, lng: number) => void) {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setter(pos.coords.latitude, pos.coords.longitude),
      () => setError("Location permission was denied. Enter coordinates by hand."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function setOrderStatus(order: Order, status: string) {
    setError(null);
    try {
      await api(`/api/shop/orders/${order.id}/status`, { token, body: { status } });
      await loadAll();
    } catch (err) {
      report(err);
    }
  }

  const btn = "rounded-xl px-4 py-2 text-sm font-medium";
  const input = "mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{profile?.shop_name ?? "Shop dashboard"}</h1>
      {!profile?.latitude && (
        <p className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Set your shop location in the Profile tab before customers can order.
        </p>
      )}
      {rate === null && (
        <p className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          The exchange rate has not been set yet, so products cannot be priced.
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Orders today" value={String(stats.today)} />
        <Stat label="Delivered revenue (USD)" value={money(stats.revenue_usd)} />
        <Stat label="Delivered revenue (SSP)" value={ssp(stats.revenue_ssp)} />
      </div>

      <nav className="mb-6 flex gap-2 border-b border-gray-200">
        {(["orders", "products", "profile"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-orange-600 text-orange-600" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {tab === "orders" && (
        <section className="space-y-3">
          {orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}
          {orders.map((o) => {
            const next = SHOP_TRANSITIONS[o.status] ?? [];
            return (
              <article key={o.id} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{o.customer_name} · {o.items.length} item(s)</p>
                    <p className="text-sm text-gray-600">
                      {o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                    </p>
                    <p className="text-sm text-gray-500">Deliver to: {o.delivery_address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(o.total_usd)}</p>
                    <p className="text-sm text-gray-500">{ssp(o.total_ssp)}</p>
                    <p className="text-sm">{STATUS_LABEL[o.status] ?? o.status}</p>
                  </div>
                </div>
                {next.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {next.map((s) => (
                      <button
                        key={s}
                        onClick={() => setOrderStatus(o, s)}
                        className={`${btn} ${s === "cancelled" ? "bg-red-50 text-red-700" : "bg-orange-600 text-white"}`}
                      >
                        {s === "cancelled" ? "Cancel order" : `Mark ${STATUS_LABEL[s]?.toLowerCase() ?? s}`}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {tab === "products" && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Products</h2>
            <button onClick={openNew} className={`${btn} bg-orange-600 text-white`}>Add product</button>
          </div>

          {showForm && (
            <form onSubmit={saveProduct} className="mb-6 grid gap-4 rounded-2xl bg-white p-6 ring-1 ring-gray-200 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-medium">Name</span>
                <input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-medium">Description</span>
                <textarea className={input} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label>
                <span className="text-sm font-medium">Price (USD)</span>
                <input required type="number" min="0" step="0.01" className={input} value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: e.target.value })} />
                {rate && form.price_usd && (
                  <span className="text-xs text-gray-500">≈ {ssp(Number(form.price_usd) * rate)} at today&apos;s rate</span>
                )}
              </label>
              <label>
                <span className="text-sm font-medium">Stock</span>
                <input required type="number" min="0" step="1" className={input} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </label>
              <label>
                <span className="text-sm font-medium">Category</span>
                <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {["food", "grocery", "electronics", "clothing", "other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium">Image URL (optional)</span>
                <input type="url" className={input} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 md:col-span-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <span className="text-sm">Visible to customers</span>
              </label>
              <div className="flex gap-3 md:col-span-2">
                <button type="submit" className={`${btn} bg-orange-600 text-white`}>{editing ? "Save changes" : "Add product"}</button>
                <button type="button" onClick={() => setShowForm(false)} className={`${btn} border border-gray-300`}>Cancel</button>
              </div>
            </form>
          )}

          <ul className="space-y-2">
            {products.length === 0 && <p className="text-gray-500">No products yet.</p>}
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-gray-200">
                <div>
                  <p className="font-medium">{p.name} <span className="text-xs text-gray-500">({p.category})</span></p>
                  <p className="text-sm text-gray-600">{money(p.price_usd)} · {ssp(p.price_ssp)} · {p.stock_quantity} in stock {p.is_active ? "" : "· hidden"}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEdit(p)} className="text-sm text-orange-600 hover:underline">Edit</button>
                  {p.is_active && <button onClick={() => deactivate(p)} className="text-sm text-red-600 hover:underline">Hide</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "profile" && (
        <ProfileForm key={profile?.shop_name ?? "new"} profile={profile} onSubmit={saveProfile} locate={locateMe} />
      )}
    </div>
  );
}

function ProfileForm({
  profile,
  onSubmit,
  locate,
}: {
  profile: Profile | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  locate: (set: (lat: number, lng: number) => void) => void;
}) {
  const [lat, setLat] = useState(profile?.latitude ?? "");
  const [lng, setLng] = useState(profile?.longitude ?? "");
  const input = "mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none";
  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4 rounded-2xl bg-white p-6 ring-1 ring-gray-200">
      <label>
        <span className="text-sm font-medium">Shop name</span>
        <input name="shop_name" required minLength={2} defaultValue={profile?.shop_name ?? ""} className={input} />
      </label>
      <label>
        <span className="text-sm font-medium">Address</span>
        <input name="address" defaultValue={profile?.address ?? ""} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label>
          <span className="text-sm font-medium">Latitude</span>
          <input name="latitude" type="number" step="any" required value={lat} onChange={(e) => setLat(e.target.value)} className={input} />
        </label>
        <label>
          <span className="text-sm font-medium">Longitude</span>
          <input name="longitude" type="number" step="any" required value={lng} onChange={(e) => setLng(e.target.value)} className={input} />
        </label>
      </div>
      <button type="button" onClick={() => locate((a, b) => { setLat(a); setLng(b); })} className="justify-self-start text-sm text-orange-600 hover:underline">
        Use my current location for the shop
      </button>
      <label className="flex items-center gap-2">
        <input name="is_open" type="checkbox" defaultChecked={profile?.is_open ?? true} />
        <span className="text-sm">Accepting orders</span>
      </label>
      <button type="submit" className="justify-self-start rounded-xl bg-orange-600 px-5 py-2 font-medium text-white">Save profile</button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function ShopPage() {
  const { token } = useAuth();
  return <RequireRole roles={["shop"]}>{() => <ShopDashboard token={token!} />}</RequireRole>;
}
