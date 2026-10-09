/* Driver Dashboard - Service Provider Interface */
import { Inter } from "next/font/inter";
import "../globals.css";
import { useAuth } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export default function DriverDashboard() {
  const { isDriver, user } = useAuth();

  if (!isDriver) {
    return null;
  }

  return (
    <div className={`${inter.className} min-h-screen bg-gray-50 p-6`}
      style={{ minHeight: "100vh" }}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Driver Dashboard - Welcome, {user?.name || "Driver"}
        </h1>
        <p className="text-gray-600">Manage your rides and earnings</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="text-3xl text-orange-600 mb-2">💰</div>
          <div className="font-semibold text-gray-900">Earnings This Week</div>
          <div className="text-2xl font-bold text-orange-600">$2,450</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="text-3xl text-green-500 mb-2">📊</div>
          <div className="font-semibold text-gray-900">Completed Rides</div>
          <div className="text-2xl font-bold text-green-500">47</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="text-3xl text-blue-500 mb-2">👥</div>
          <div className="font-semibold text-gray-900">Active Trips</div>
          <div className="text-2xl font-bold text-blue-500">3</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/driver/accept-rides" className="group rounded-2xl bg-orange-600 p-6 text-white shadow hover:shadow-2xl transition">
          <div className="text-3xl mb-2">📱</div>
          <h3 className="font-semibold">Accept New Ride</h3>
          <p className="text-gray-100 mt-1">Get matched with passengers</p>
        </a>

        <a href="/driver/earnings" className="group rounded-2xl bg-blue-600 p-6 text-white shadow hover:shadow-2xl transition">
          <div className="text-3xl mb-2">💵</div>
          <h3 className="font-semibold">Earnings</h3>
          <p className="text-gray-100 mt-1">View your earnings history</p>
        </a>
      </div>

      {/* Recent Rides */}
      <div className="mt-8 rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Trips</h2>
        <div className="space-y-4">
          <div className="p-4 rounded bg-gray-50">
            <p className="text-sm text-gray-500">No trips yet - start accepting rides</p>
          </div>
        </div>
      </div>
    </div>
  );
}