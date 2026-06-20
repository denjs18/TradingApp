"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMarketStatus, getPortfolioSummary } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, logout } = useAuth();
  const [market, setMarket] = useState<{ is_open: boolean; is_weekday: boolean } | null>(null);
  const [portfolio, setPortfolio] = useState<{ total_value: number; total_pnl: number } | null>(null);

  useEffect(() => {
    getMarketStatus()
      .then((d) => setMarket(d as any))
      .catch(() => {});
    getPortfolioSummary()
      .then((s: any) => setPortfolio({ total_value: s.total_value, total_pnl: s.total_pnl }))
      .catch(() => {});
  }, []);

  const modules = [
    {
      href: "/trading",
      icon: "◈",
      title: "Trading Automatique",
      description:
        "Paper trading simulé avec 4 stratégies (momentum, mean reversion, breakout, combinée), risk management automatique et scheduler toutes les minutes.",
      badges: ["Momentum", "Mean Rev.", "Breakout", "Combinée"],
    },
    {
      href: "/opportunities",
      icon: "◎",
      title: "Analyse d'Opportunités",
      description:
        "Scoring multi-facteurs sur 27 tickers Euronext Paris — analyse technique, fondamentale, sentiment news et consensus analystes.",
      badges: ["Technique", "Fondamental", "Sentiment", "Analystes"],
    },
    {
      href: "/dca",
      icon: "◉",
      title: "Conseiller DCA",
      description:
        "Suivi de votre portefeuille réel avec recommandations Dollar-Cost Averaging personnalisées selon l'analyse technique et fondamentale.",
      badges: ["Renforcer", "Conserver", "Alléger"],
    },
    {
      href: "/backtest",
      icon: "⏪",
      title: "Backtesting",
      description:
        "Rejoue n'importe quelle stratégie sur des données historiques réelles (1–5 ans). Courbe d'equity, alpha vs Buy & Hold, win rate, Sharpe ratio — simulable même marché fermé.",
      badges: ["Momentum", "Mean Rev.", "Breakout", "Combined"],
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "0.75rem 2rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em" }}>
          ◈ TRADING APP
        </span>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.78rem" }}>
          {[
            { href: "/trading", label: "Trading Auto" },
            { href: "/opportunities", label: "Opportunités" },
            { href: "/dca", label: "DCA Advisor" },
            { href: "/portfolio", label: "Mon Portefeuille" },
            { href: "/backtest", label: "Backtest" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "1rem", alignItems: "center" }}>
          {market && (
            <span
              className={market.is_open ? "badge badge-active" : "badge badge-inactive"}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: market.is_open ? "var(--positive)" : "var(--text-muted)",
                  display: "inline-block",
                }}
              />
              {market.is_open ? "Marché ouvert" : "Marché fermé"}
            </span>
          )}
          {user ? (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--text-muted)" }}>{user.email}</span>
              <Link href="/profile" style={{ color: "var(--gold)", textDecoration: "none" }}>
                Profil
              </Link>
              <button
                onClick={logout}
                className="btn btn-secondary"
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.7rem" }}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-secondary" style={{ fontSize: "0.75rem" }}>
              Connexion
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: "4rem 2rem 2rem", maxWidth: 1000, margin: "0 auto" }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--gold)", marginBottom: "1rem" }}>
          Euronext Paris · Paper Trading
        </p>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            lineHeight: 1.1,
            marginBottom: "1rem",
          }}
        >
          Trading App
          <br />
          <span style={{ color: "var(--gold)" }}>Euronext</span>
        </h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6, marginBottom: "2rem" }}>
          Analyse quantitative, paper trading simulé et conseils DCA personnalisés sur les principales valeurs de la Bourse de Paris.
        </p>

        {portfolio && (
          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "3rem" }}>
            <div className="metric-card" style={{ minWidth: 160 }}>
              <div className="metric-label">Portefeuille virtuel</div>
              <div className="metric-value">{portfolio.total_value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</div>
            </div>
            <div className="metric-card" style={{ minWidth: 160 }}>
              <div className="metric-label">P&L Total</div>
              <div
                className="metric-value"
                style={{ color: portfolio.total_pnl >= 0 ? "var(--positive)" : "var(--negative)" }}
              >
                {portfolio.total_pnl >= 0 ? "+" : ""}
                {portfolio.total_pnl.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </div>
            </div>
          </div>
        )}

        {/* Modules */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {modules.map((m) => (
            <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                  height: "100%",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(201,168,76,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                }}
              >
                <div style={{ fontSize: "1.5rem", color: "var(--gold)", marginBottom: "0.75rem" }}>
                  {m.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem", color: "var(--text-primary)" }}>
                  {m.title}
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1rem" }}>
                  {m.description}
                </p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {m.badges.map((b) => (
                    <span
                      key={b}
                      style={{
                        background: "rgba(201,168,76,0.08)",
                        border: "1px solid rgba(201,168,76,0.2)",
                        borderRadius: 2,
                        padding: "0.15rem 0.5rem",
                        fontSize: "0.62rem",
                        fontWeight: 600,
                        color: "var(--gold)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ marginTop: "3rem", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          Paper trading — simulation avec argent fictif. Les scores et recommandations sont générés automatiquement et ne constituent pas un conseil en investissement.
        </p>
      </div>
    </div>
  );
}
