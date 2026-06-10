"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser, getMe, logout as doLogout } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setToken: (token: string) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setToken: () => {},
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("trading_token");
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setToken = (token: string) => {
    localStorage.setItem("trading_token", token);
    refreshUser();
  };

  const logout = () => {
    doLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setToken, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
