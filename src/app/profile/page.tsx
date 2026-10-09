/* User Profile - Works for All Roles */
import { Inter } from "next/font/inter";
import "../globals.css";
import { useAuth } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export default function ProfilePage() {
  const { user, isLoading, logout, hasRole } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Not authenticated</div>;
  }

  return (
    <div className={`${inter.className} min-h-screen bg-white p-6`}
      style={{ minHeight: "100vh" }}>
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {user.name}'s Profile
        </h1>
      </header>

      {/* User Info Card */}
      <div className="rounded-2xl bg-gray-50 p-6 shadow mb-8">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500">Full Name</p>
            <p className="font-medium text-gray-900">{user.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{user.email}</p>
          </div>
          {user.phone && (
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{user.phone}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">User ID</p>
            <p className="text-orange-600 font-mono text-xs">{user.id}</p>
          </div>
        </div>
      </div>

      {/* Role-Specific Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {hasRole("customer") && (
          <a href="/customer" className="rounded-xl bg-blue-500 p-4 text-white transition">
            <div className="text-xl mb-2">🏠</div>
            <span>Customer Home</span>
          </a>
        )}

        {hasRole("driver") && (
          <a href="/driver" className="rounded-xl bg-green-500 p-4 text-white transition">
            <div className="text-xl mb-2">📊</div>
            <span>Driver Dashboard</span>
          </a>
        )}

        {hasRole("shop") && (
          <a href="/shop" className="rounded-xl bg-purple-500 p-4 text-white transition">
            <div className="text-xl mb-2">🏪</div>
            <span>Shop Owner</span>
          </a>
        )}

        {hasRole("admin") && (
          <a href="/nen" className="rounded-xl bg-red-500 p-4 text-white transition">
            <div className="text-xl mb-2">👑</div>
            <span>Admin Panel</span>
          </a>
        )}
      </div>

      {/* Logout Button */}
      <div className="mt-8 p-4 rounded-xl bg-red-100 border border-red-300">
        <button
          onClick={logout}
          className="w-full text-red-600 font-medium text-sm hover:text-red-800 transition"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}