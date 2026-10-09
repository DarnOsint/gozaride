"use client";

import { useEffect, useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, money, ssp } from "@/lib/client";

type Order = {
  id: string;
  service_type: string;
  status: string;
  origin_name: string | null;
  dest_name: string | null;
  distance_km: number;
  final_fare: number;
  final_fare_ssp: number;
  final_fare_usd: number;
  currency_used: string;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

function ShopDashboard({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    today: 0,
    revenue_usd: 0,
    revenue_ssp: 0,
  });

  async function load() {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        api<Order[]>("/api/shop/orders", { token }),
        api<{ today: number; revenue_usd: number; revenue_ssp: number }>("/api/shop/stats", { token }),
      ]);
      setOrders(ordersRes);
      setStats(statsRes);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, [token]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Shop Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Orders today</p>
          <p className="text-3xl font-bold mt-1">{stats.today}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Revenue (USD)</p>
          <p className="text-3xl font-bold mt-1">{money(stats.revenue_usd)}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Revenue (SSP)</p>
          <p className="text-3xl font-bold mt-1">{ssp(stats.revenue_ssp)}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-4">Recent orders</h2>
        <ul className="space-y-3">
          {orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl bg-white p-4 ring-1 ring-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium">{o.service_type.toUpperCase()}</p>
                <p className="text-sm text-gray-600">
                  {o.origin_name ?? "Pickup"} → {o.dest_name ?? "Drop-off"} · {o.distance_km} km
                </p>
                <p className="text-sm text-gray-500 capitalize">{o.status.replace("_", " ")}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(o.final_fare_usd)}</p>
                <p className="text-sm text-gray-500">{ssp(o.final_fare_ssp)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold mb-4">Note</h2>
        <p className="text-gray-600">
          Shop dashboard is a work in progress. Order creation, product catalogue,
          scheduled deliveries, and inventory management will be added next.
        </p>
      </section>
    </div>
  );
}

export default function ShopPage() {
  const { token } = useAuth();
  return (
    <RequireRole roles={["shop"]}>
      {() => <ShopDashboard token={token!} />}
    </RequireRole>
  );
}