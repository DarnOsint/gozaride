/* Admin Panel - /nen Interface */
import { Inter } from "next/font/inter";
import "../globals.css";
import { useAuth } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export default function AdminPanel() {
  const { isAdmin, user } = useAuth();

  if (!isAdmin) {
    return null;
  }

  return (
    <div className={`${inter.className} min-h-screen bg-gray-900 text-gray-100 p-6`}
      style={{ minHeight: "100vh" }}>
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h1 className="text-4xl font-bold">
          Admin Panel - Gozaride
        </h1>
        <p className="text-gray-300">Platform management dashboard</p>
      </header>

      {/* Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <a href="/users" className="group rounded-lg bg-gray-800 p-4 hover:bg-gray-700 transition">
          <div className="text-2xl mb-2">👥</div>
          <div>Users</div>
          <p className="text-sm text-gray-400">Manage all accounts</p>
        </a>

        <a href="/bookings" className="group rounded-lg bg-gray-800 p-4 hover:bg-gray-700 transition">
          <div className="text-2xl mb-2">📅</div>
          <div>Bookings</div>
          <p className="text-sm text-gray-400">View all bookings</p>
        </a>

        <a href="/analytics" className="group rounded-lg bg-gray-800 p-4 hover:bg-gray-700 transition">
          <div className="text-2xl mb-2">📊</div>
          <div>Analytics</div>
          <p className="text-sm text-gray-400">Platform insights</p>
        </a>

        <a href="/settings" className="group rounded-lg bg-gray-800 p-4 hover:bg-gray-700 transition">
          <div className="text-2xl mb-2">⚙️</div>
          <div>Settings</div>
          <p className="text-sm text-gray-400">Platform configuration</p>
        </a>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="rounded-2xl bg-gray-800 p-6 shadow">
          <div className="text-3xl text-orange-500 mb-2">👤</div>
          <div>Total Users</div>
          <div className="text-2xl font-bold text-orange-400">12,847</div>
        </div>

        <div className="rounded-2xl bg-gray-800 p-6 shadow">
          <div className="text-3xl text-green-500 mb-2">💼</div>
          <div>Active Drivers</div>
          <div className="text-2xl font-bold text-green-400">342</div>
        </div>

        <div className="rounded-2xl bg-gray-800 p-6 shadow">
          <div className="text-3xl text-blue-500 mb-2">🏪</div>
          <div>Active Shops</div>
          <div className="text-2xl font-bold text-blue-400">89</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl bg-gray-800 p-6 shadow">
        <h2 className="text-xl font-bold text-gray-100 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="p-3 rounded bg-gray-900 text-gray-300 text-sm">
            <div className="font-medium">New driver registered</div>
            <div className="text-gray-400 text-xs">10 minutes ago</div>
          </div>
          <div className="p-3 rounded bg-gray-900 text-gray-300 text-sm">
            <div className="font-medium">New order placed</div>
            <div className="text-gray-400 text-xs">15 minutes ago</div>
          </div>
        </div>
      </div>
    </div>
  );
}