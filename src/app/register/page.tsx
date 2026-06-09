"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du compte");
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
            Créer un compte
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Rejoignez TradingApp Euronext
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
                placeholder="Minimum 6 caractères"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>
                Confirmer le mot de passe
              </label>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div style={{ fontSize: "0.78rem", color: "var(--negative)", background: "rgba(200,72,72,0.08)", border: "1px solid rgba(200,72,72,0.2)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "0.25rem" }}>
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Déjà un compte ?{" "}
          <Link href="/login" style={{ color: "var(--gold)", textDecoration: "none" }}>
            Se connecter
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
