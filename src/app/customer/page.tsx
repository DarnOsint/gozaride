"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, money, ssp } from "@/lib/client";
import { SERVICES } from "@/lib/services";
import { MapView, type MapMarker } from "@/components/MapView";
import { SafetyControls } from "@/components/SafetyControls";

// Juba, South Sudan — default map centre.
const JUBA = { lat: 4.8594, lng: 31.5713 };

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

type Track = {
  status: string;
  driver_id: string | null;
  origin: { lat: number; lng: number; name: string | null };
  destination: { lat: number; lng: number; name: string | null };
  driver_location: { latitude: number; longitude: number; recorded_at: string } | null;
};

const SERVICE_KEYS = Object.keys(SERVICES);
const ACTIVE = ["pending", "accepted", "in_progress"];

/**
 * Polls the trip tracking endpoint and shows the pickup, destination and the
 * driver's live position on a map while the trip is active.
 */
function LiveTrip({ tripId, token }: { tripId: string; token: string }) {
  const [track, setTrack] = useState<Track | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const data = await api<Track>(`/api/trips/${tripId}/track`, { token });
        if (alive) setTrack(data);
      } catch {
        // keep the last known position on transient errors
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tripId, token]);

  if (!track) return <p className="mt-2 text-sm text-gray-500">Loading live map…</p>;

  const markers: MapMarker[] = [
    { lat: track.origin.lat, lng: track.origin.lng, kind: "pickup", label: track.origin.name || "Pickup" },
    { lat: track.destination.lat, lng: track.destination.lng, kind: "destination", label: track.destination.name || "Destination" },
  ];
  if (track.driver_location) {
    markers.push({
      lat: track.driver_location.latitude,
      lng: track.driver_location.longitude,
      kind: "driver",
      label: "Driver",
    });
  }
  const center = track.driver_location
    ? { lat: track.driver_location.latitude, lng: track.driver_location.longitude }
    : { lat: track.origin.lat, lng: track.origin.lng };

  return (
    <div className="mt-3">
      <MapView center={center} zoom={14} markers={markers} follow={!!track.driver_location} className="h-56 w-full rounded-xl ring-1 ring-gray-200" />
      <p className="mt-1 text-xs text-gray-500">
        {track.driver_location
          ? `Driver last seen ${new Date(track.driver_location.recorded_at).toLocaleTimeString()}`
          : "Waiting for the driver to start sharing location…"}
      </p>
      <SafetyControls tripId={tripId} token={token} />
    </div>
  );
}

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
  const [picking, setPicking] = useState<"origin" | "dest" | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ trips: Trip[] }>("/api/trips?limit=20", { token });
    setTrips(data.trips);
  }, [token]);

  useEffect(() => {
    load().catch((e) => setMessage(e instanceof Error ? e.message : "Could not load trips"));
  }, [load]);

  function locate(setter: (p: { lat: number; lng: number }) => void) {
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

  const markers: MapMarker[] = [];
  if (origin) markers.push({ ...origin, kind: "pickup", label: originName || "Pickup" });
  if (dest) markers.push({ ...dest, kind: "destination", label: destName || "Destination" });
  const mapCenter = origin ?? dest ?? JUBA;

  function pickAt(p: { lat: number; lng: number }) {
    if (picking === "origin") {
      setOrigin(p);
      setPicking(null);
    } else if (picking === "dest") {
      setDest(p);
      setPicking(null);
    }
  }

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
            <div className="flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => locate(setOrigin)} className="text-orange-600 hover:underline">
                {origin ? `Pickup set (${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)})` : "Use my current location"}
              </button>
              <button
                type="button"
                onClick={() => setPicking(picking === "origin" ? null : "origin")}
                className={picking === "origin" ? "font-medium text-orange-700" : "text-orange-600 hover:underline"}
              >
                {picking === "origin" ? "Tap the map…" : "Place pickup on map"}
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Destination</legend>
            <input className={field} placeholder="Destination name (optional)" value={destName} onChange={(e) => setDestName(e.target.value)} />
            <div className="flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => locate(setDest)} className="text-orange-600 hover:underline">
                {dest ? `Destination set (${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)})` : "Use my current location"}
              </button>
              <button
                type="button"
                onClick={() => setPicking(picking === "dest" ? null : "dest")}
                className={picking === "dest" ? "font-medium text-orange-700" : "text-orange-600 hover:underline"}
              >
                {picking === "dest" ? "Tap the map…" : "Place destination on map"}
              </button>
            </div>
          </fieldset>

          <div>
            <MapView
              center={mapCenter}
              zoom={13}
              markers={markers}
              onPick={picking ? pickAt : undefined}
              className="h-64 w-full rounded-xl ring-1 ring-gray-200"
            />
            {picking && (
              <p className="mt-2 text-xs text-orange-700">
                Tap the map to set the {picking === "origin" ? "pickup" : "destination"} point.
              </p>
            )}
          </div>

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
              {ACTIVE.includes(t.status) && t.status !== "pending" && <LiveTrip tripId={t.id} token={token} />}
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
