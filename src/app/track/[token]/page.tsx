"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapView, type MapMarker } from "@/components/MapView";

type Shared = {
  status: string;
  service_type: string;
  origin: { lat: number; lng: number; name: string | null };
  destination: { lat: number; lng: number; name: string | null };
  eta_minutes: number;
  driver_location: { latitude: number; longitude: number; recorded_at: string } | null;
  expires_at: string;
};

export default function TrackPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/track/${token}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "This link is not available");
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the trip");
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Live trip</h1>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="mx-auto max-w-lg px-4 py-16 text-gray-500">Loading live trip…</p>;
  }

  const markers: MapMarker[] = [
    { lat: data.origin.lat, lng: data.origin.lng, kind: "pickup", label: data.origin.name || "Pickup" },
    { lat: data.destination.lat, lng: data.destination.lng, kind: "destination", label: data.destination.name || "Destination" },
  ];
  if (data.driver_location) {
    markers.push({ lat: data.driver_location.latitude, lng: data.driver_location.longitude, kind: "driver", label: "Driver" });
  }
  const center = data.driver_location
    ? { lat: data.driver_location.latitude, lng: data.driver_location.longitude }
    : { lat: data.origin.lat, lng: data.origin.lng };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold">Live trip</h1>
      <p className="mt-1 text-sm text-gray-600">
        {data.origin.name || "Pickup"} → {data.destination.name || "Destination"} · status{" "}
        <span className="font-medium capitalize">{data.status.replace("_", " ")}</span>
      </p>
      <div className="mt-4">
        <MapView center={center} zoom={14} markers={markers} follow={!!data.driver_location} className="h-80 w-full rounded-xl ring-1 ring-gray-200" />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {data.driver_location
          ? `Driver last seen ${new Date(data.driver_location.recorded_at).toLocaleTimeString()}`
          : "Waiting for the driver to share location…"}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        This read-only link expires {new Date(data.expires_at).toLocaleString()}.
      </p>
    </div>
  );
}
