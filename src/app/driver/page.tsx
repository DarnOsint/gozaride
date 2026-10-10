"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, money, ssp } from "@/lib/client";

type Trip = {
  id: string;
  service_type: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  origin_name: string | null;
  dest_name: string | null;
  distance_km: number;
  eta_minutes: number;
  fare_usd: number;
  fare_ssp: number;
  driver_earnings_usd: number;
  driver_earnings_ssp: number;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type OpenTrip = Trip & { pickup_distance_km: number | null };

type Earnings = {
  total_usd: number;
  total_ssp: number;
  this_week_usd: number;
  this_week_ssp: number;
};

function DriverDashboard({ token }: { token: string }) {
  const [online, setOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [openTrips, setOpenTrips] = useState<OpenTrip[]>([]);
  const [history, setHistory] = useState<Trip[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadOnline = useCallback(async () => {
    try {
      const res = await api<{ availability: { is_online: boolean } }>("/api/driver/availability", { token });
      setOnline(res.availability.is_online);
    } catch {
      setOnline(false);
    }
  }, [token]);

  const loadOpen = useCallback(async () => {
    try {
      const data = await api<{ trips: OpenTrip[] }>("/api/trips/available", { token });
      setOpenTrips(data.trips);
    } catch {
      setOpenTrips([]);
    }
  }, [token]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api<{ trips: Trip[] }>("/api/trips?status=completed&limit=20", { token });
      setHistory(data.trips);
    } catch {
      setHistory([]);
    }
  }, [token]);

  const loadEarnings = useCallback(async () => {
    try {
      const data = await api<Earnings>("/api/driver/earnings", { token });
      setEarnings(data);
    } catch {
      setEarnings(null);
    }
  }, [token]);

  const loadActive = useCallback(async () => {
    try {
      const data = await api<{ trips: Trip[] }>("/api/trips?status=accepted,in_progress&limit=1", { token });
      setActiveTrip(data.trips[0] ?? null);
    } catch {
      setActiveTrip(null);
    }
  }, [token]);

  useEffect(() => {
    loadOnline();
    loadHistory();
    loadEarnings();
  }, [loadOnline, loadHistory, loadEarnings]);

  useEffect(() => {
    if (online) {
      loadOpen();
      loadActive();
      const interval = setInterval(() => { loadOpen(); loadActive(); }, 15000);
      return () => clearInterval(interval);
    }
  }, [online, loadOpen, loadActive]);

  // Keep the driver's position live while the page is open.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const reportLocation = useCallback(async () => {
    if (!location) return;
    try {
      await api("/api/driver/location", { token, body: location });
    } catch {}
  }, [token, location]);

  useEffect(() => {
    if (!online || !location) return;
    const id = setInterval(reportLocation, 15000);
    return () => clearInterval(id);
  }, [online, location, reportLocation]);

  async function toggleOnline(next: boolean) {
    if (busy) return;
    setBusy("online");
    try {
      await api("/api/driver/availability", { token, body: { is_online: next } });
      setOnline(next);
      if (next) loadOpen();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not change status");
    } finally {
      setBusy(null);
    }
  }

  async function acceptTrip(id: string) {
    try {
      await api(`/api/trips/${id}/accept`, { token, method: "POST" });
      setOnline(false);
      loadActive();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not accept trip");
    }
  }

  async function startTrip(id: string) {
    try {
      await api(`/api/trips/${id}/start`, { token, method: "POST" });
      loadActive();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not start trip");
    }
  }

  async function completeTrip(id: string) {
    try {
      await api(`/api/trips/${id}/complete`, { token, method: "POST" });
      setActiveTrip(null);
      loadHistory();
      loadEarnings();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not complete trip");
    }
  }

  const actionBtn = "rounded-xl bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Driver Dashboard</h1>
        <button
          onClick={() => toggleOnline(!online)}
          disabled={busy === "online"}
          className={online ? "rounded-xl bg-gray-900 px-4 py-2 text-white" : actionBtn}
        >
          {busy === "online" ? "Changing..." : online ? "Go Offline" : "Go Online"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Total earnings</p>
          <p className="text-3xl font-bold mt-1">{money(earnings?.total_usd ?? 0)}</p>
          <p className="text-sm text-gray-500">{ssp(earnings?.total_ssp ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">This week</p>
          <p className="text-3xl font-bold mt-1">{money(earnings?.this_week_usd ?? 0)}</p>
          <p className="text-sm text-gray-500">{ssp(earnings?.this_week_ssp ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-3xl font-bold mt-1">{online ? "Online" : "Offline"}</p>
        </div>
      </div>

      {online && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Available trips</h2>
            <span className="text-sm text-gray-500">Updates every 15s</span>
          </div>
          <ul className="space-y-3">
            {openTrips.length === 0 && <p className="text-gray-500">No requests nearby.</p>}
            {openTrips.map((t) => (
              <li key={t.id} className="rounded-xl bg-white p-4 ring-1 ring-gray-200 flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.service_type.toUpperCase()}</p>
                  <p className="text-sm text-gray-600">
                    {t.origin_name ?? "Pickup"} → {t.dest_name ?? "Drop-off"}
                    · {t.distance_km?.toFixed(1)} km · ~{t.eta_minutes} min
                  </p>
                  <p className="text-sm text-orange-600 font-medium">
                    {money(t.fare_usd)} · {ssp(t.fare_ssp)}
                  </p>
                  {t.pickup_distance_km !== null && (
                    <p className="text-xs text-gray-500">{t.pickup_distance_km} km to pickup</p>
                  )}
                </div>
                <button
                  onClick={() => acceptTrip(t.id)}
                  className={actionBtn}
                  disabled={busy === `accept-${t.id}`}
                >
                  Accept
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTrip && (
        <section className="mb-8 rounded-2xl bg-orange-50 p-6 ring-1 ring-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Active trip</h2>
              <p className="text-sm text-gray-600">
                {activeTrip.origin_name} → {activeTrip.dest_name} · {activeTrip.distance_km} km
              </p>
            </div>
            <div className="flex gap-3">
              {activeTrip.status === "accepted" && (
                <button onClick={() => startTrip(activeTrip.id)} className={actionBtn}>
                  Start trip
                </button>
              )}
              {activeTrip.status === "in_progress" && (
                <button onClick={() => completeTrip(activeTrip.id)} className="rounded-xl bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700">
                  Complete
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4">Completed trips</h2>
        <ul className="space-y-3">
          {history.length === 0 && <p className="text-gray-500">No completed trips yet.</p>}
          {history.map((t) => (
            <li key={t.id} className="rounded-xl bg-white p-4 ring-1 ring-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium">{t.service_type?.toUpperCase()}</p>
                <p className="text-sm text-gray-600">
                  {t.origin_name} → {t.dest_name} · {t.distance_km} km
                </p>
                <p className="text-sm">
                  <span className="font-semibold">{money(t.fare_usd)}</span>
                  <span className="text-gray-500"> · {ssp(t.fare_ssp)}</span>
                </p>
              </div>
              <p className="text-sm text-gray-500">
                {money(t.driver_earnings_usd)} · {ssp(t.driver_earnings_ssp)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function DriverPage() {
  const { token } = useAuth();
  return (
    <RequireRole roles={["driver"]}>
      {() => (
        <Suspense fallback={<p className="p-8">Loading...</p>}>
          <DriverDashboard token={token!} />
        </Suspense>
      )}
    </RequireRole>
  );
}