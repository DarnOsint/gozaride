/* Authentication Modal Component */
import { Inter } from "next/font/inter";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "signin" | "signup";
}

export function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 hidden">
      {isOpen && (
        <div className="relative bg-white rounded-2xl w-full max-w-md mx-4 p-8 transform scale-100">
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12"/>
              </path>
            </svg>
          </button>

          {/* Modal Header */}
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </h2>

          {/* Form */}
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === "signin" ? "Email" : "Full Name"}
              </label>
              <input 
                type={mode === "signin" ? "email" : "text"}
                placeholder={mode === "signin" ? "name@example.com" : "Your full name"}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === "signin" ? "Password" : "Phone Number"}
              </label>
              <input 
                type={mode === "signin" ? "password" : "tel"}
                placeholder={mode === "signin" ? "••••••••" : "+211 XX XXX XXX"}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
              />
            </div>

            {/* Mode-Specific Fields */}
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                />
              </div>
            )}

            {/* Action Button */}
            <div>
              <button 
                type="submit"
                className="w-full rounded-xl bg-orange-600 py-3 px-4 font-medium text-white hover:bg-orange-500 transition hover:opacity-90"
              >
                {mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </div>

            {/* Divider */}
            {mode === "signup" && (
              <div className="flex items-center text-sm text-gray-500">
                <span className="flex-1 h-px bg-gray-200/50"></span>
                <span>or continue with</span>
                <span className="flex-1 h-px bg-gray-200/50"></span>
              </div>
            )}

            {/* Social Buttons */}
            <div className="mt-6 space-y-3">
              <button 
                className="w-full rounded-xl border border-gray-300 py-3 px-4 font-medium text-gray-700 hover:bg-gray-50 transition"
                aria-label="Sign in with Google"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2-3h6a2 2 0 0 1 2 2v14z"/>
                    <path d="M13 2v6h6v12h-6v8l-6-5-6 5V2h6z"/>
                  </path>
                </svg>
                Google
              </button>

              <button 
                className="w-full rounded-xl border border-gray-300 py-3 px-4 font-medium text-gray-700 hover:bg-gray-50 transition"
                aria-label="Sign in with Apple"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L9 18l-6-6"/>
                    <path d="M6l12 8 6-8z"/>
                  </path>
                </svg>
                Apple
              </button>
            </div>

            {/* Account Link */}
            <div className="mt-6 text-center text-sm">
              {mode === "signin" && (
                <p className="text-gray-500">
                  Don't have an account? <span href="#" onClick={() => onClose()} className="text-orange-600 font-medium text-sm underline underline-offset-2">Sign up</span>
                </p>
              )}
              {mode === "signup" && (
                <p className="text-gray-500">
                  Already have an account? <span href="#" onClick={() => onClose()} className="text-orange-600 font-medium text-sm underline underline-offset-2">Sign in</span>
                </p>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}