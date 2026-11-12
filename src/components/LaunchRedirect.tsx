"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { dashboardFor } from "@/lib/roles";

/**
 * Installed PWAs may keep an older manifest whose start_url is "/". When the
 * app launches in standalone mode, send the user straight to the right screen
 * instead of the marketing homepage.
 */
export function LaunchRedirect() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    router.replace(user ? dashboardFor(user.role) : "/signin");
  }, [ready, user, router]);

  return null;
}
