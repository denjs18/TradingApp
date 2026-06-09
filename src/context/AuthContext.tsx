"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout as authLogout, UserProfile } from "@/lib/auth";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
      if (!token) {
        setUser(null);
        return;
      }
      const me = await getMe();
      setUser(me);
    } catch {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("trading_token");
      }
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = (userData: UserProfile, token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("trading_token", token);
    }
    setUser(userData);
  };

  const logout = () => {
    authLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
