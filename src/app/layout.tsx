/* Gozaride Layout with Navigation */
import "../globals.css";
import { Inter } from "next/font/inter";

const inter = Inter({ subsets: ["latin"] });

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export default function Layout({
  children,
  showAuth = true,
}: { children: React.ReactNode; showAuth?: boolean }) {
  const navItems: NavItem[] = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/services/taxi", label: "Taxi Rides", icon: "🚕" },
    { href: "/services/motorcycle", label: "Motorcycle", icon: "🛵" },
    { href: "/services/package", label: "Package", icon: "📦" },
    { href: "/services/food", label: "Food", icon: "🍔" },
    { href: "/services/rental", label: "Car Rental", icon: "🚗" },
    { href: "/services/bus", label: "Transport", icon: "🚌" },
  ];

  return (
    <div className={`${inter.className} min-h-screen`}>
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-orange-600">Gozaride</div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-600 text-sm font-medium hover:text-orange-600 transition"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Mobile Menu & Auth */}
          <div className="md:hidden flex items-center gap-3">
{/* Hamburger Menu */}
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

            {/* Auth Buttons */}
            <div className="flex items-center gap-2">
              {/* Sign In Button */}
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { mode: 'signin' } }))}
                className="relative rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 transition"
                aria-label="Sign in"
              >
                Sign In
              </button>

              {/* Sign Up Button */}
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { mode: 'signup' } }))}
                className="relative rounded-border border border-orange-600 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 transition"
                aria-label="Sign up"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-16 pb-8">
        {children}
      </main>
    </div>
  );
}