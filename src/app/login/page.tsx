"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await login(email, password);
      setToken(token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ color: "var(--gold)", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.1em" }}>◈ TRADING APP</div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.5rem" }}>Connexion</h1>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" required autoFocus />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>Mot de passe</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && (
              <div style={{ fontSize: "0.78rem", color: "var(--negative)", background: "rgba(200,72,72,0.08)", border: "1px solid rgba(200,72,72,0.2)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>{error}</div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Pas encore de compte ?{" "}
          <Link href="/register" style={{ color: "var(--gold)" }}>Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
