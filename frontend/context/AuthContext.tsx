"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getMe } from "@/lib/api";

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  avatar_path: string | null;
  parsed_cv: Record<string, unknown> | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await getMe();
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (t: string) => {
    localStorage.setItem("token", t);
    setToken(t);
    await refreshUser();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
