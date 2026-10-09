"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, money, ssp } from "@/lib/client";
import { SERVICES } from "@/lib/services";

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
  requested_at: string;
};

const SERVICE_KEYS = Object.keys(SERVICES);
const ACTIVE = ["pending", "accepted", "in_progress"];

function CustomerDashboard({ token }: { token: string }) {
  const params = useSearchParams();
  const initialService = params.get("service") ?? "taxi";

  const [service, setService] = useState(
    SERVICE_KEYS.includes(initialService) ? initialService : "taxi",
  );
  const [originName, setOriginName] = useState("");
  const [destName, setDestName] = useState("");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ trips: Trip[] }>("/api/trips?limit=20", { token });
    setTrips(data.trips);
  }, [token]);

  useEffect(() => {
    load().catch((e) => setMessage(e instanceof Error ? e.message : "Could not load trips"));
  }, [load]);

  function useMyLocation(setter: (p: { lat: number; lng: number }) => void) {
    if (!navigator.geolocation) {
      setMessage("Your browser cannot share location. Enter coordinates instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMessage("Location permission was denied."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function requestTrip(e: FormEvent) {
    e.preventDefault();
    if (!origin || !dest) {
      setMessage("Set both pickup and destination first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/trips", {
        token,
        body: {
          service_type: service,
          origin: { ...origin, name: originName || undefined },
          destination: { ...dest, name: destName || undefined },
        },
      });
      setMessage("Request sent. Nearby drivers can now see it.");
      setOriginName("");
      setDestName("");
      setOrigin(null);
      setDest(null);
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not request the trip");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setMessage(null);
    try {
      await api(`/api/trips/${id}/cancel`, { token, body: {} });
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not cancel");
    }
  }

  const hasActive = trips.some((t) => ACTIVE.includes(t.status));
  const field = "mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none";

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
      <section>
        <h1 className="text-2xl font-bold">Request a ride or delivery</h1>
        <form onSubmit={requestTrip} className="mt-6 space-y-4 rounded-2xl bg-white p-6 ring-1 ring-gray-200">
          <label className="block">
            <span className="text-sm font-medium">Service</span>
            <select className={field} value={service} onChange={(e) => setService(e.target.value)}>
              {SERVICE_KEYS.map((k) => (
                <option key={k} value={k}>{SERVICES[k].title}</option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Pickup</legend>
            <input className={field} placeholder="Pickup name (optional)" value={originName} onChange={(e) => setOriginName(e.target.value)} />
            <button type="button" onClick={() => useMyLocation(setOrigin)} className="text-sm text-orange-600 hover:underline">
              {origin ? `Pickup set (${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)})` : "Use my current location"}
            </button>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Destination</legend>
            <input className={field} placeholder="Destination name (optional)" value={destName} onChange={(e) => setDestName(e.target.value)} />
            <button type="button" onClick={() => useMyLocation(setDest)} className="text-sm text-orange-600 hover:underline">
              {dest ? `Destination set (${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)})` : "Use my current location"}
            </button>
          </fieldset>

          {message && <p role="status" className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-gray-800">{message}</p>}

          <button
            type="submit"
            disabled={busy || hasActive}
            className="w-full rounded-xl bg-orange-600 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {hasActive ? "You have an active trip" : busy ? "Requesting..." : "Request"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-2xl font-bold">My trips</h2>
        <ul className="mt-6 space-y-3">
          {trips.length === 0 && <li className="text-gray-500">No trips yet.</li>}
          {trips.map((t) => (
            <li key={t.id} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-medium">{SERVICES[t.service_type]?.title ?? t.service_type}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{t.status.replace("_", " ")}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {t.origin_name ?? "Pickup"} → {t.dest_name ?? "Destination"} · {t.distance_km.toFixed(1)} km · ~{t.eta_minutes} min
              </p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{money(t.fare_usd)}</span>
                <span className="text-gray-500"> · {ssp(t.fare_ssp)}</span>
              </p>
              {t.status === "pending" && (
                <button onClick={() => cancel(t.id)} className="mt-3 text-sm text-red-600 hover:underline">
                  Cancel request
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function CustomerPage() {
  const { token } = useAuth();
  return (
    <RequireRole roles={["customer"]}>
      {() => (
        <Suspense fallback={<p className="p-8">Loading...</p>}>
          <CustomerDashboard token={token!} />
        </Suspense>
      )}
    </RequireRole>
  );
}
