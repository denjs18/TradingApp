"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Chargement…</span>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
