"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth, type Role, type User } from "@/context/AuthContext";

/** Renders children only for signed-in users with an allowed role. */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: (user: User) => ReactNode;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/signin");
  }, [ready, user, router]);

  if (!ready) return <p className="p-8 text-gray-500">Loading...</p>;
  if (!user) return <p className="p-8 text-gray-500">Redirecting to sign in...</p>;
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">This page is for another account type</h1>
        <p className="mt-2 text-gray-600">You are signed in as a {user.role}.</p>
        <Link href="/" className="mt-4 inline-block text-orange-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }
  return <>{children(user)}</>;
}
