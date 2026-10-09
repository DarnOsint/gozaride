/* Gozaride - Role-Based Layout with AuthProvider */
import "../globals.css";
import { Inter } from "next/font/inter";

const inter = Inter({ subsets: ["latin"] });

import { AuthProvider } from "@/context/AuthContext";

export default function Layout({
  children,
}: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className={`${inter.className} min-h-screen`}>
        {/* Navigation */}
        <nav className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-orange-600">Gozaride</div>
            </div>

            {/* Desktop Nav - shown for all roles */}
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-gray-600 text-sm font-medium hover:text-orange-600 transition">
                Home
              </a>
              <a href="/services/taxi" className="text-gray-600 text-sm font-medium hover:text-orange-600 transition">
                Taxi Rides
              </a>
              <a href="/services/motorcycle" className="text-gray-600 text-sm font-medium hover:text-orange-600 transition">
                Motorcycle
              </a>
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden flex items-center gap-2">
              <button
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                </button>
              </button>

              {/* Auth placeholder - individual pages handle auth buttons */}
              <div className="flex items-center gap-2">
                {/* Buttons rendered by page components */}
              </div>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="pt-16 pb-8">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}