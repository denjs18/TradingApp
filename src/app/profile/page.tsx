"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/lib/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshUser, loading } = useAuth();
  const [groqKey, setGroqKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Chargement…</span>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.push("/login");
    return null;
  }

  async function handleSaveGroqKey(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg("");
    setSaveError("");
    setSaving(true);
    try {
      await updateProfile({ groq_api_key: groqKey || undefined });
      await refreshUser();
      setSaveMsg("Clé API sauvegardée avec succès");
      setGroqKey("");
    } catch (err: any) {
      setSaveError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveGroqKey() {
    setSaveMsg("");
    setSaveError("");
    setSaving(true);
    try {
      await updateProfile({ groq_api_key: "" });
      await refreshUser();
      setSaveMsg("Clé API supprimée");
    } catch (err: any) {
      setSaveError(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    router.push("/");
  }

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid var(--border)", padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link href="/" style={{ color: "var(--gold)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em", textDecoration: "none" }}>
          ◈ TRADING APP
        </Link>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ fontSize: "0.75rem" }}>
            Déconnexion
          </button>
        </div>
      </nav>

      <div style={{ padding: "3rem 2rem", maxWidth: 560, margin: "0 auto" }}>
        <p style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--gold)", marginBottom: "0.5rem" }}>
          Mon Profil
        </p>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "2rem" }}>
          Paramètres du compte
        </h1>

        {/* Account info */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="section-title" style={{ paddingTop: 0 }}>Informations du compte</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Email</span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{user.email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Membre depuis</span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{memberSince}</span>
            </div>
          </div>
        </div>

        {/* Groq API Key */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="section-title" style={{ paddingTop: 0 }}>Clé API Groq</div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.6 }}>
            Utilisée pour les analyses IA (ticker et conseiller). Obtenez une clé gratuite sur{" "}
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
              console.groq.com
            </a>
            .
          </p>

          <div style={{ marginBottom: "1rem", padding: "0.6rem 0.9rem", background: "var(--surface2)", borderRadius: 3, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Statut :</span>
            {user.has_groq_key ? (
              <span style={{ fontSize: "0.75rem", color: "var(--positive)", fontWeight: 600 }}>Configurée ✓</span>
            ) : (
              <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: 600 }}>Non configurée</span>
            )}
            {user.has_groq_key && (
              <button
                onClick={handleRemoveGroqKey}
                disabled={saving}
                style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--negative)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Supprimer
              </button>
            )}
          </div>

          <form onSubmit={handleSaveGroqKey} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>
                {user.has_groq_key ? "Remplacer la clé" : "Entrer la clé"}
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="input"
                  type={showKey ? "text" : "password"}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowKey(!showKey)}
                  style={{ whiteSpace: "nowrap", minWidth: 60 }}
                >
                  {showKey ? "Masquer" : "Voir"}
                </button>
              </div>
            </div>
            {saveMsg && (
              <div style={{ fontSize: "0.78rem", color: "var(--positive)", background: "rgba(61,158,110,0.08)", border: "1px solid rgba(61,158,110,0.2)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>
                {saveMsg}
              </div>
            )}
            {saveError && (
              <div style={{ fontSize: "0.78rem", color: "var(--negative)", background: "rgba(200,72,72,0.08)", border: "1px solid rgba(200,72,72,0.2)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>
                {saveError}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving || !groqKey.trim()}>
              {saving ? "Sauvegarde…" : "Sauvegarder la clé"}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div className="card">
          <div className="section-title" style={{ paddingTop: 0 }}>Session</div>
          <button onClick={handleLogout} className="btn btn-danger" style={{ width: "100%" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
