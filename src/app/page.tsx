/* Gozaride Main Entry - Role-Aware Homepage */
import { Inter } from "next/font/inter";
import "../globals.css";
import { useAuth } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export default function HomePage() {
  const { user, isCustomer, isDriver, isShop, isAdmin, isLoading } = useAuth();

  {/* Show loading state */}
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  {/* Customer Homepage */}
  if (isCustomer) {
    return (
      <div className={`${inter.className} min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex items-center justify-center p-6`}
        style={{ minHeight: "100vh" }}>
        <div className="max-w-7xl w-full text-center">
          {/* Hero Header */}
          <header className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-4">
              Move Easy.<span className="text-orange-600">.</span> Go Anywhere.
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your all-in-one mobility platform. From taxi rides to food delivery, we go everywhere you need.
            </p>
          </header>

          {/* Services Grid - for customers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-2xl mx-auto mb-8">
            <a href="/services/taxi" className="group rounded-3xl bg-white p-8 shadow-lg hover:shadow-2xl hover:transition-shadow duration-500 transform hover:-translate-y-1">
              <div className="text-4xl mb-3">🚕</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Taxi Rides</h3>
              <p className="text-gray-500 line-clamp-2">Book rides instantly with real-time tracking and professional drivers.</p>
            </a>

            <a href="/services/motorcycle" className="group rounded-3xl bg-white p-8 shadow-lg hover:shadow-2xl hover:transition-shadow duration-500 transform hover:-translate-y-1">
              <div className="text-4xl mb-3">🛵</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Motorcycle Delivery</h3>
              <p className="text-gray-500 line-clamp-2">Fast and reliable delivery service for parcels and documents.</p>
            </a>

            <a href="/services/package" className="group rounded-3xl bg-white p-8 shadow-lg hover:shadow-2xl hover:transition-shadow duration-500 transform hover:-translate-y-1">
              <div className="text-4xl mb-3">📦</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Package Delivery</h3>
              <p className="text-gray-500 line-clamp-2">Secure parcel service nationwide with real-time tracking.</p>
            </a>
          </div>

          {/* More Services for customers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 max-w-2xl mx-auto">
            <a href="/services/food" className="group rounded-3xl bg-white p-8 shadow-lg hover:shadow-2xl hover:transition-shadow duration-500 transform hover:-translate-y-1">
              <div className="text-4xl mb-3">🍔</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Food Delivery</h3>
              <p className="text-gray-500 line-clamp-2">Hot meals delivered from your favorite local restaurants.</p>
            </a>

            <a href="/services/rental" className="group rounded-3xl bg-white p-8 shadow-lg hover:shadow-2xl hover:transition-shadow duration-500 transform hover:-translate-y-1">
              <div className="text-4xl mb-3">🚗</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Car Rental</h3>
              <p className="text-gray-500 line-clamp-2">Rent a vehicle for any occasion - SUVs, sedans, and more.</p>
            </a>

            <a href="/services/bus" className="group rounded-3xl bg-white p-8 shadow-lg hover:shadow-2xl hover:transition-shadow duration-500 transform hover:-translate-y-1">
              <div className="text-4xl mb-3">🚌</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Transport Services</h3>
              <p className="text-gray-500 line-clamp-2">Public transit options and route planning for your journey.</p>
            </a>
          </div>

          {/* User Greeting */}
          {user && (
            <div className="mt-8 p-6 rounded-2xl bg-gray-50 border border-gray-200 max-w-md mx-auto">
              <h3 className="text-xl font-medium text-gray-900 mb-2">Welcome back, {user.name}!</h3>
              <p className="text-gray-500 text-sm">
                Choose a service above to get started or check your profile for options.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  {/* Driver Dashboard */}
  if (isDriver) {
    return null;
  }

  {/* Shop Owner Dashboard */}
  if (isShop) {
    return null;
  }

  {/* Admin Panel */}
  if (isAdmin) {
    return null;
  }

  {/* Default - landing page for unauthenticated users */}
  return (
    <div className={`${inter.className} min-h-screen bg-gray-100 p-6`}
      style={{ minHeight: "100vh" }}>
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Gozaride</h1>
        <p className="text-gray-600 mb-6">Move Easy. Go Anywhere.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/signin" className="rounded-xl bg-orange-600 p-3 text-white hover:bg-orange-500 transition">
            Sign In
          </a>
          <a href="/signup" className="rounded-border border-orange-500 p-3 text-orange-600 hover:bg-orange-50 transition">
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
}