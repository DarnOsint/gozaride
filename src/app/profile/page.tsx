"use client";

import { useEffect, useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, money, ssp } from "@/lib/client";
import { dashboardFor } from "@/lib/roles";

function ProfileDashboard({ token }: { token: string }) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<{ ssp: number; usd: number } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rate, setRate] = useState<{ ssp_per_usd: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ ssp_balance: number; usd_balance: number }>("/api/wallet", { token }).catch(() => null),
      api<any[]>("/api/wallet/transactions?limit=20", { token }).catch(() => []),
      api<{ ssp_per_usd: number }>("/api/rates", {}).catch(() => null),
    ]).then(([w, t, r]) => {
      setWallet(w ? { ssp: w.ssp_balance, usd: w.usd_balance } : null);
      setTransactions(t);
      setRate(r);
    });
  }, [token]);

  async function convert() {
    if (!rate) return;
    const amount = prompt("Enter USD amount to convert to SSP:");
    if (!amount) return;
    try {
      setBusy("convert");
      await api("/api/wallet/convert", { token, body: { usd: Number(amount) } });
      setMessage(`Converted $${amount} to SSP`);
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const actions = [
    { role: "customer" as const, label: "Customer dashboard", href: "/customer" },
    { role: "driver" as const, label: "Driver dashboard", href: "/driver" },
    { role: "shop" as const, label: "Shop dashboard", href: "/shop" },
    { role: "admin" as const, label: "Admin panel", href: "/nen" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{user?.full_name}'s Profile</h1>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200 mb-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="font-medium">{user?.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Role</p>
            <p className="font-medium capitalize">{user?.role}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Preferred currency</p>
            <p className="font-medium">{user?.default_currency?.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {wallet && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200 mb-8">
          <h3 className="text-lg font-bold mb-4">Wallet</h3>
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">USD balance</p>
              <p className="text-2xl font-bold">${wallet.usd.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">SSP balance</p>
              <p className="text-2xl font-bold">SSP {Math.round(wallet.ssp).toLocaleString("en-US")}</p>
            </div>
          </div>
          {wallet.usd > 0 && (
            <button
              onClick={convert}
              disabled={busy === "convert"}
              className="rounded-xl bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {busy === "convert" ? "Converting..." : "Convert USD → SSP"}
            </button>
          )}
          {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Quick links</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {actions.map((a) => (
            <a
              key={a.role}
              href={a.href}
              className="rounded-xl bg-white p-4 ring-1 ring-gray-200 hover:ring-orange-300 transition"
            >
              <p className="font-medium">{a.label}</p>
              <p className="text-sm text-gray-500 mt-1">Switch to {a.label.toLowerCase()}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Recent transactions</h2>
        <ul className="space-y-3">
          {transactions.length === 0 && <p className="text-gray-500">No transactions yet.</p>}
          {transactions.map((tx) => (
            <li key={tx.id} className="rounded-xl bg-white p-4 ring-1 ring-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium capitalize">{tx.type}</p>
                <p className="text-sm text-gray-500">
                  ${tx.amount_usd?.toFixed(2) ?? "0.00"} · SSP {tx.amount_ssp?.toLocaleString("en-US") ?? "0"}
                </p>
                <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
              </div>
              <span className="text-sm text-gray-500">{tx.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  const { token } = useAuth();
  return (
    <RequireRole roles={["customer", "driver", "shop", "admin"]}>
      {() => <ProfileDashboard token={token!} />}
    </RequireRole>
  );
}
