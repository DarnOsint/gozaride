/* Auth Context for Role-Based Authentication */
import { createContext, useContext, useState, useEffect, ReactNode, } from "react";

type UserRole = "customer" | "driver" | "shop" | "admin";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (role: UserRole, userData: Partial<User>) => void;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  isCustomer: boolean;
  isDriver: boolean;
  isShop: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("gozaride_user") : null;
    
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem("gozaride_user");
      }
    } else {
      const defaultUser: User = {
        id: "user_" + Math.random().toString(36).substring(2, 15),
        name: "Customer",
        email: "",
        role: "customer",
      };
      localStorage.setItem("gozaride_user", JSON.stringify(defaultUser));
      setUser(defaultUser);
    }
    setIsLoading(false);
  }, []);

  const login = (role: UserRole, userData: Partial<User>) => {
    const user: User = {
      id: "user_" + Math.random().toString(36).substring(2, 15),
      name: userData.name || `${role.charAt(0).toUpperCase()}${role.slice(1)}`,
      email: userData.email || "",
      role,
      phone: userData.phone,
    };
    setUser(user);
    localStorage.setItem("gozaride_user", JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("gozaride_user");
  };

  const hasRole = (role: UserRole) => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      hasRole,
      isCustomer: hasRole("customer"),
      isDriver: hasRole("driver"),
      isShop: hasRole("shop"),
      isAdmin: hasRole("admin"),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}