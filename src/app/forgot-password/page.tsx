"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevCode(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        dev_code?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setMessage(data.message ?? "If an account matches, we sent a reset code.");
      if (data.dev_code) setDevCode(data.dev_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset code");
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
        <h1 className="mt-4 text-center text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          We will send a reset code to the email address or phone number on your account.
        </p>

        {message ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              {message}
            </p>
            {devCode && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Development only — reset code: <strong>{devCode}</strong>
              </p>
            )}
            <Link
              href={`/reset-password?identifier=${encodeURIComponent(identifier.trim())}`}
              className="block w-full rounded-xl bg-orange-600 py-3 text-center font-medium text-white hover:bg-orange-700"
            >
              Enter reset code
            </Link>
            <Link
              href="/signin"
              className="block text-center text-sm font-medium text-orange-600 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email or phone</span>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="you@example.com or +211 921 234 567"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
              {busy ? "Sending..." : "Send reset code"}
            </button>
            <Link
              href="/signin"
              className="block text-center text-sm font-medium text-orange-600 hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
