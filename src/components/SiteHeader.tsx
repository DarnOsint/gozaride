"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_LINKS = [
  { href: "/services/taxi", label: "Taxi" },
  { href: "/services/motorcycle", label: "Motorcycle" },
  { href: "/services/package", label: "Package" },
  { href: "/services/food", label: "Food" },
  { href: "/services/rental", label: "Car rental" },
  { href: "/services/bus", label: "Transport" },
];

const DASHBOARD_BY_ROLE: Record<string, { href: string; label: string }> = {
  customer: { href: "/customer", label: "My rides" },
  driver: { href: "/driver", label: "Driver" },
  shop: { href: "/shop", label: "Shop" },
  admin: { href: "/nen", label: "Admin" },
};

export function SiteHeader() {
  const { user, ready, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const dashboard = user ? DASHBOARD_BY_ROLE[user.role] : null;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-2xl font-bold text-orange-600">
          Gozaride
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Services">
          {PUBLIC_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 hover:text-orange-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {ready && user ? (
            <>
              {dashboard && (
                <Link
                  href={dashboard.href}
                  className="hidden rounded-lg border border-orange-600 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 sm:inline-block"
                >
                  {dashboard.label}
                </Link>
              )}
              <button
                onClick={signOut}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Sign out
              </button>
            </>
          ) : (
            ready && (
              <>
                <Link
                  href="/signin"
                  className="rounded-lg border border-orange-600 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
                >
                  Sign up
                </Link>
              </>
            )
          )}
          <button
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-gray-200 bg-white px-4 py-3 md:hidden" aria-label="Services mobile">
          <ul className="grid grid-cols-2 gap-3">
            {PUBLIC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-gray-700" onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
