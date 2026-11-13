"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const field =
  "mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Email links arrive with ?identifier=...&code=... already filled in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("identifier");
    const c = params.get("code");
    if (id) setIdentifier(id);
    if (c) setCode(c);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.push("/signin?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
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
        <h1 className="mt-4 text-center text-2xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter the code we sent to your email or phone.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email or phone</span>
            <input
              className={field}
              type="text"
              required
              autoComplete="username"
              placeholder="you@example.com or +211 921 234 567"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Reset code</span>
            <input
              className={`${field} uppercase tracking-widest`}
              type="text"
              required
              minLength={6}
              maxLength={16}
              autoComplete="one-time-code"
              placeholder="ABCD2345"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">New password (min 8 characters)</span>
            <input
              className={field}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Confirm new password</span>
            <input
              className={field}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {busy ? "Updating..." : "Update password"}
          </button>
          <Link
            href="/signin"
            className="block text-center text-sm font-medium text-orange-600 hover:underline"
          >
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
