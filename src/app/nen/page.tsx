"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/client";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

type Trip = {
  id: string;
  service_type: string;
  status: string;
  customer_name: string;
  driver_name: string | null;
  fare_usd: number;
  requested_at: string;
};

function AdminPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rate, setRate] = useState<{ ssp_per_usd: number } | null>(null);
  const [newRate, setNewRate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, tripsRes, rateRes] = await Promise.all([
        api<{ users: User[] }>("/api/admin/users?limit=100", { token }),
        api<{ trips: Trip[] }>("/api/admin/trips?limit=50", { token }),
        api<{ ssp_per_usd: number }>("/api/rates", {}),
      ]);
      setUsers(usersRes.users);
      setTrips(tripsRes.trips);
      setRate(rateRes);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function setNewRateValue() {
    const val = Number(newRate);
    if (!val || val < 1 || val > 1_000_000) return alert("Enter a valid rate (e.g., 1500)");
    setBusy(true);
    try {
      await api("/api/admin/rates", { token, method: "POST", body: { ssp_per_usd: val, note: "set from admin panel" } });
      load();
      setNewRate("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to set rate");
    }
  }

  async function toggleUser(id: string, active: boolean) {
    try {
      await api("/api/admin/users/" + id + "/toggle", { token, method: "POST", body: { is_active: active } });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Panel (Gozaride)</h1>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-gray-200">
        <h2 className="text-xl font-bold mb-4">Exchange rate (SSP per USD)</h2>
        <div className="flex gap-3 items-end">
          <input
            type="number"
            step="0.0001"
            min="1"
            max="1000000"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="flex-1 max-w-xs rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none"
            placeholder="e.g. 1500"
          />
          <button onClick={setNewRateValue} disabled={busy} className="rounded-xl bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50">
            Set rate
          </button>
          {rate && <span className="text-gray-600">Current: {rate.ssp_per_usd.toLocaleString()} SSP / USD</span>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Joined</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="p-3">{u.full_name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3">
                    <span className={u.is_active ? "text-green-600" : "text-red-600"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleUser(u.id, !u.is_active)}
                      className={u.is_active ? "text-red-600 hover:underline" : "text-green-600 hover:underline"}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Recent trips</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-3 font-medium">ID</th>
                <th className="p-3 font-medium">Service</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Driver</th>
                <th className="p-3 font-medium">Fare (USD)</th>
                <th className="p-3 font-medium">Requested</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="p-3 text-xs font-mono">{t.id.slice(0, 8)}…</td>
                  <td className="p-3">{t.service_type}</td>
                  <td className="p-3 capitalize">{t.status.replace("_", " ")}</td>
                  <td className="p-3">{t.customer_name}</td>
                  <td className="p-3">{t.driver_name ?? "—"}</td>
                  <td className="p-3">{t.fare_usd}</td>
                  <td className="p-3">{new Date(t.requested_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const { token } = useAuth();
  return (
    <RequireRole roles={["admin"]}>
      {() => <AdminPanel token={token!} />}
    </RequireRole>
  );
}