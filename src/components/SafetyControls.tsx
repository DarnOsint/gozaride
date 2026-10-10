"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/**
 * Safety controls shown on an active trip: a one-tap SOS and a shareable
 * read-only tracking link for a trusted contact.
 */
export function SafetyControls({ tripId, token }: { tripId: string; token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  function here(): Promise<{ latitude?: number; longitude?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }

  async function raiseSos() {
    setBusy(true);
    setMessage(null);
    try {
      const where = await here();
      await api(`/api/trips/${tripId}/sos`, {
        token,
        body: { kind: "sos", ...where, note: "SOS from the trip screen" },
      });
      setMessage("SOS sent. The Gozaride team has been alerted.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not send SOS");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  async function share() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ share: { token: string } }>(`/api/trips/${tripId}/share`, {
        token,
        body: {},
      });
      const url = `${window.location.origin}/track/${res.share.token}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Tracking link copied. Anyone with it can watch this trip.");
      } catch {
        setMessage("Tracking link created — copy it below.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create a link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-gray-200">
      <div className="flex flex-wrap items-center gap-3">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            SOS
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <button
              onClick={raiseSos}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Confirm SOS"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              Cancel
            </button>
          </span>
        )}
        <button
          onClick={share}
          disabled={busy}
          className="rounded-xl border border-orange-600 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-60"
        >
          Share live trip
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-gray-700">{message}</p>}
      {shareUrl && (
        <p className="mt-2 break-all text-xs">
          <a href={shareUrl} className="text-orange-600 hover:underline" target="_blank" rel="noreferrer">
            {shareUrl}
          </a>
        </p>
      )}
    </div>
  );
}
