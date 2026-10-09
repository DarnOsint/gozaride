"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Role = "customer" | "driver" | "shop" | "admin";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  default_currency: "usd" | "ssp";
};

type AuthState = {
  user: User | null;
  token: string | null;
  ready: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role: Role;
  }) => Promise<User>;
  signOut: () => void;
};

const STORAGE_KEY = "gozaride.session";

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    ready: false,
  });

  // Restore the session from localStorage and confirm the token is still valid.
  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setState({ user: null, token: null, ready: true });
      return;
    }
    let saved: { token: string; user: User };
    try {
      saved = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setState({ user: null, token: null, ready: true });
      return;
    }
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${saved.token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("session expired");
        const data = (await res.json()) as { user: User };
        setState({ user: data.user, token: saved.token, ready: true });
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setState({ user: null, token: null, ready: true });
      });
  }, []);

  const persist = useCallback((token: string, user: User) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    setState({ user, token, ready: true });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await postJson<{ token: string; user: User }>(
        "/api/auth/signin",
        { email, password },
      );
      persist(data.token, data.user);
      return data.user;
    },
    [persist],
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: Role;
    }) => {
      const data = await postJson<{ token: string; user: User }>(
        "/api/auth/signup",
        input,
      );
      persist(data.token, data.user);
      return data.user;
    },
    [persist],
  );

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, token: null, ready: true });
  }, []);

  const value = useMemo(
    () => ({ ...state, signIn, signUp, signOut }),
    [state, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
