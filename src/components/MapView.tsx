"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  lat: number;
  lng: number;
  label?: string;
  kind?: "pickup" | "destination" | "driver" | "user" | "shop";
};

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  /** When set, clicking the map calls this with the clicked coordinates. */
  onPick?: (p: { lat: number; lng: number }) => void;
  className?: string;
  /** Follow the first marker (used for live tracking). */
  follow?: boolean;
};

const COLORS: Record<NonNullable<MapMarker["kind"]>, string> = {
  pickup: "#ea580c",
  destination: "#111827",
  driver: "#2563eb",
  user: "#16a34a",
  shop: "#7c3aed",
};

// Custom pin built from HTML so we never depend on Leaflet's bundled image
// assets (which break under Next.js bundling).
function pinIcon(color: string) {
  return {
    html: `<div style="position:relative;width:18px;height:18px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff"></div>`,
    iconSize: [18, 18] as [number, number],
    iconAnchor: [9, 18] as [number, number],
  };
}

export function MapView({ center, zoom = 13, markers = [], onPick, className, follow }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      mapRef.current = map;
      // Ensure proper sizing after mount.
      setTimeout(() => map.invalidateSize(), 50);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update cursor when picking is enabled.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = onPick ? "crosshair" : "";
  }, [onPick]);

  // Sync markers.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const color = COLORS[m.kind ?? "pickup"];
      const marker = L.marker([m.lat, m.lng], { icon: L.divIcon(pinIcon(color)) });
      if (m.label) marker.bindTooltip(m.label, { direction: "top", offset: [0, -16] });
      marker.addTo(layer);
    }
  }, [markers]);

  // Recenter when center changes (and when following).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (follow && markers.length > 0) {
      const m = markers[0];
      mapRef.current?.panTo([m.lat, m.lng], { animate: true });
    }
  }, [follow, markers]);

  return <div ref={containerRef} className={className ?? "h-64 w-full rounded-xl"} />;
}