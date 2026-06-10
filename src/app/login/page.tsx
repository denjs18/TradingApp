"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { getMe } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login: setAuthUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      const me = await getMe();
      setAuthUser(me, data.token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ color: "var(--gold)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            ◈ TRADING APP
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
            Connexion
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Accédez à votre compte
          </p>
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>
                Mot de passe
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div style={{ fontSize: "0.78rem", color: "var(--negative)", background: "rgba(200,72,72,0.08)", border: "1px solid rgba(200,72,72,0.2)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "0.25rem" }}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Pas de compte ?{" "}
          <Link href="/register" style={{ color: "var(--gold)", textDecoration: "none" }}>
            Créer un compte
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
