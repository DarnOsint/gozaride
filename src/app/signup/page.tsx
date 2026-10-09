"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth, type Role } from "@/context/AuthContext";
import { dashboardFor } from "@/lib/roles";

const ROLE_OPTIONS: { value: Exclude<Role, "admin">; label: string; help: string }[] = [
  { value: "customer", label: "Rider", help: "Book rides and deliveries" },
  { value: "driver", label: "Driver / rider", help: "Take trips and deliveries" },
  { value: "shop", label: "Business", help: "Receive and fulfil orders" },
];

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<Exclude<Role, "admin">>("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const user = await signUp({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role,
      });
      router.push(dashboardFor(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-2xl font-bold">Create your account</h1>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-700">I want to</legend>
          <div className="mt-2 grid gap-2">
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  role === opt.value ? "border-orange-600 bg-orange-50" : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={role === opt.value}
                  onChange={() => setRole(opt.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-sm text-gray-600">{opt.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Full name</span>
            <input className={field} required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
            <input className={field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+211..." autoComplete="tel" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Password (min 8 characters)</span>
            <input className={field} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Confirm password</span>
            <input className={field} type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="w-full rounded-xl bg-orange-600 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-60">
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already registered?{" "}
          <Link href="/signin" className="font-medium text-orange-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
