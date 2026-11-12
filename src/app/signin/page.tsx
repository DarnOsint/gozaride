"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { dashboardFor } from "@/lib/roles";

export default function SignInPage() {
  const { signIn, user, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The PWA launches here, so skip the form when a session is already restored.
  useEffect(() => {
    if (ready && user) router.replace(dashboardFor(user.role));
  }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await signIn(email.trim(), password);
      router.push(dashboardFor(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <Image
          src="/icons/icon-192.png"
          alt="Gozaride"
          width={56}
          height={56}
          priority
          className="mx-auto rounded-2xl"
        />
        <h1 className="mt-4 text-center text-2xl font-bold">Sign in</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate={false}>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-orange-600 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">New to Gozaride?</p>
        <Link
          href="/signup"
          className="mt-2 block w-full rounded-xl border border-orange-600 py-3 text-center font-medium text-orange-600 hover:bg-orange-50"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
