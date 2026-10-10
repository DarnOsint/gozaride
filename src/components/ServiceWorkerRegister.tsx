"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable as a PWA.
// The worker itself is online-only and never caches responses.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure must not break the app.
    });
  }, []);
  return null;
}