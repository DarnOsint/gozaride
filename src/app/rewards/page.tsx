"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { api, money } from "@/lib/client";

type Loyalty = {
  points: number;
  value_usd: number;
  referral_code: string | null;
  referrals: number;
  events: Array<{ id: string; points: number; reason: string; ref: string | null; created_at: string }>;
};

const REASON_LABEL: Record<string, string> = {
  trip: "Trip completed",
  trip_earnings: "Trip earnings",
  order: "Order delivered",
  referral: "Referral reward",
  referral_welcome: "Welcome bonus",
  redeemed: "Redeemed for wallet credit",
};

function RewardsDashboard({ token }: { token: string }) {
  const [data, setData] = useState<Loyalty | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState("");
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const d = await api<Loyalty>("/api/loyalty", { token });
    setData(d);
  }, [token]);

  useEffect(() => {
    setOrigin(window.location.origin);
    load().catch((e) => setMessage(e instanceof Error ? e.message : "Could not load rewards"));
  }, [load]);

  const shareUrl = data?.referral_code ? `${origin}/signup?ref=${data.referral_code}` : "";

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied to clipboard.`);
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("Copy failed — select and copy manually.");
    }
  }

  async function redeem() {
    const value = Number(points);
    if (!value || value <= 0) {
      setMessage("Enter how many points to redeem.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ usd: number }>("/api/loyalty/redeem", { token, body: { points: value } });
      setMessage(`Redeemed ${value} points for ${money(res.usd)} wallet credit.`);
      setPoints("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not redeem");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-gray-500">Loading rewards…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Rewards</h1>
      <p className="mt-1 text-sm text-gray-600">
        Earn 10 points for every $1 you spend. 100 points = $1 of wallet credit.
      </p>

      {message && (
        <p role="status" className="mt-4 rounded-lg bg-orange-50 px-3 py-2 text-sm text-gray-800">
          {message}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-sm text-gray-500">Points balance</p>
          <p className="text-2xl font-bold text-orange-600">{data.points.toLocaleString("en-US")}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-sm text-gray-500">Worth</p>
          <p className="text-2xl font-bold">{money(data.value_usd)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-sm text-gray-500">Friends referred</p>
          <p className="text-2xl font-bold">{data.referrals}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-gray-200">
        <h2 className="text-lg font-bold">Redeem points</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            type="number"
            min="100"
            step="100"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Points (min 100)"
            className="w-44 rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={redeem}
            disabled={busy || data.points < 100}
            className="rounded-xl bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {busy ? "Redeeming…" : "Redeem for wallet credit"}
          </button>
        </div>
        {data.points < 100 && (
          <p className="mt-2 text-sm text-gray-500">You need at least 100 points to redeem.</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-gray-200">
        <h2 className="text-lg font-bold">Refer a friend</h2>
        <p className="mt-1 text-sm text-gray-600">
          Share your code. When they sign up you both get {50} bonus points and you earn a cash reward.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-gray-100 px-4 py-2 font-mono text-lg tracking-widest">
            {data.referral_code ?? "—"}
          </code>
          {data.referral_code && (
            <>
              <button
                onClick={() => copy(data.referral_code!, "Referral code")}
                className="rounded-xl border border-orange-600 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
              >
                Copy code
              </button>
              <button
                onClick={() => copy(shareUrl, "Referral link")}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Copy invite link
              </button>
            </>
          )}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Points history</h2>
        <ul className="mt-3 space-y-2">
          {data.events.length === 0 && <li className="text-gray-500">No points activity yet.</li>}
          {data.events.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-xl bg-white p-4 ring-1 ring-gray-200">
              <div>
                <p className="font-medium">{REASON_LABEL[e.reason] ?? e.reason}</p>
                <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</p>
              </div>
              <span className={e.points >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                {e.points >= 0 ? "+" : ""}
                {e.points}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function RewardsPage() {
  const { token } = useAuth();
  return (
    <RequireRole roles={["customer", "driver", "shop", "admin"]}>
      {() => <RewardsDashboard token={token!} />}
    </RequireRole>
  );
}
