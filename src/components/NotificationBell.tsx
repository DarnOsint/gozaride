"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/client";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Bell with unread count. Polls for in-app notifications and registers Web Push when available. */
export function NotificationBell() {
  const { user, token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const registered = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<{ notifications: Notification[]; unread: number }>(
        "/api/notifications",
        { token },
      );
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // ignore transient errors; keep last state
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [user, load]);

  // Register a Web Push subscription once per session when the server has keys.
  useEffect(() => {
    if (!user || !token || registered.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    registered.current = true;
    (async () => {
      try {
        const cfg = await api<{ enabled: boolean; publicKey: string | null }>(
          "/api/notifications/public-key",
        );
        if (!cfg.enabled || !cfg.publicKey) return;
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
          }));
        const json = sub.toJSON();
        await api("/api/notifications/subscribe", {
          token,
          body: { endpoint: json.endpoint, keys: json.keys },
        });
      } catch {
        // push is best-effort; in-app notifications still work
      }
    })();
  }, [user, token]);

  async function markAllRead() {
    if (!token) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    try {
      await api("/api/notifications/read", { token, body: {} });
    } catch {
      // reload will reconcile
    }
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-orange-600 px-1 text-xs font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-orange-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={`border-b border-gray-50 px-4 py-3 ${n.read_at ? "" : "bg-orange-50/50"}`}
              >
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-gray-600">{n.body}</p>}
                <p className="mt-1 text-[11px] text-gray-400">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
