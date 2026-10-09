/* Shop Owner Dashboard - Business Interface */
import { Inter } from "next/font/inter";
import "../globals.css";
import { useAuth } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export default function ShopDashboard() {
  const { isShop, user } = useAuth();

  if (!isShop) {
    return null;
  }

  return (
    <div className={`${inter.className} min-h-screen bg-gray-50 p-6`}
      style={{ minHeight: "100vh" }}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Shop Dashboard - Welcome, {user?.name || "Business"}
        </h1>
        <p className="text-gray-600">Manage orders and products</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="text-3xl text-green-500 mb-2">📦</div>
          <div className="font-semibold text-gray-900">Active Orders</div>
          <div className="text-2xl font-bold text-green-500">12</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="text-3xl text-orange-500 mb-2">💵</div>
          <div className="font-semibold text-gray-900">Revenue This Month</div>
          <div className="text-2xl font-bold text-orange-500">$3,850</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="text-3xl text-purple-600 mb-2">🛒</div>
          <div className="font-semibold text-gray-900">Products Listed</div>
          <div className="text-2xl font-bold text-purple-600">24</div>
        </div>
      </div>

      {/* Order Management */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Orders</h2>
          <div className="space-y-3">
            <div className="p-3 rounded border border-gray-200">
              <p className="text-sm text-gray-600">Order #1025 - Food delivery</p>
              <p className="text-xs text-gray-500">20 min ago</p>
              <span className="text-green-500 font-medium">Confirmed</span>
            </div>
            <div className="p-3 rounded border border-gray-200">
              <p className="text-sm text-gray-600">Order #1024 - Package delivery</p>
              <p className="text-xs text-gray-500">1 hour ago</p>
              <span className="text-orange-500 font-medium">Processing</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Product Catalog</h2>
          <p className="text-sm text-gray-500">Manage your products and services</p>
          <a href="/shop/products" className="text-orange-600 hover:text-orange-500 mt-2 underline">
            View/Manage Products
          </a>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/shop/products" className="rounded-2xl bg-white p-6 shadow hover:shadow-lg transition">
          <div className="text-2xl mb-2">🛒</div>
          <h3 className="font-medium">Products</h3>
          <p className="text-gray-500 text-sm">Manage your offerings</p>
        </a>

        <a href="#" className="rounded-2xl bg-white p-6 shadow hover:shadow-lg transition">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-medium">Analytics</h3>
          <p className="text-gray-500 text-sm">View performance</p>
        </a>

        <a href="/profile" className="rounded-2xl bg-white p-6 shadow hover:shadow-lg transition">
          <div className="text-2xl mb-2">👤</div>
          <h3 className="font-medium">Profile</h3>
          <p className="text-gray-500 text-sm">Account settings</p>
        </a>
      </div>
    </div>
  );
}