/* Sign In Page */
import { Inter } from "next/font/inter";
import "../globals.css";
import { AuthModal } from "@/components/AuthModal";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function SignInPage() {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState("signin");

  return (
    <div className={`${inter.className} min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex items-center justify-center p-6`}
      onClick={({ target }: { target: EventTarget }) => {
        if ((target as HTMLElement)?.closest('.auth-modal') === null) {
          setShowModal(false);
        }
      }}>
      {/* Modal Trigger */}
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome Back</h1>
        <p className="text-gray-600 mb-6">Log in to your account to continue</p>
        
        {/* Auth Buttons */}
        <div className="flex gap-3 mb-8">
          <button 
            onClick={() => setMode("signin")}
            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 hover:border-orange-500 hover:text-orange-600 transition"
            aria-label="Sign in mode"
          >
            Sign In
          </button>
          <button 
            onClick={() => setMode("signup")}
            className="flex-1 rounded-border border border-orange-500 px-4 py-3 text-sm font-medium text-white bg-orange-500 hover:bg-orange-400 transition"
            aria-label="Sign up mode"
          >
            Sign Up
          </button>
        </div>

        {/* Authentication Modal */}
        <AuthModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          mode={mode}
        />
      </div>
    </div>
  );
}