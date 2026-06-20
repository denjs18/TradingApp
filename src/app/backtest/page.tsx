"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const BG = "#0d0f18";
const CARD = "#13161f";
const BORDER = "#1e2330";
const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";

const STRATEGIES = [
  { value: "combined",       label: "Combined (recommandé)" },
  { value: "momentum",       label: "Momentum" },
  { value: "mean_reversion", label: "Mean Reversion" },
  { value: "breakout",       label: "Breakout" },
];

const PERIODS = [
  { value: "6mo", label: "6 mois" },
  { value: "1y",  label: "1 an" },
  { value: "2y",  label: "2 ans" },
  { value: "3y",  label: "3 ans" },
  { value: "5y",  label: "5 ans" },
];

interface Trade {
  date: string;
  side: "buy" | "sell";
  price: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
  reason: string;
}

interface EquityPoint {
  date: string;
  equity: number;
  price: number;
  in_position: boolean;
}

interface BacktestResult {
  ticker: string;
  strategy: string;
  period: string;
  initial_capital: number;
  final_equity: number;
  total_return_pct: number;
  bh_return_pct: number;
  alpha_pct: number;
  num_trades: number;
  win_rate: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  equity_curve: EquityPoint[];
  trades: Trade[];
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6,
      padding: "0.85rem 1rem",
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: color || "#e8eaf0" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.65rem", color: "#8892a4", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

const REASON_LABELS: Record<string, string> = {
  signal: "Signal",
  stop_loss: "Stop-loss",
  take_profit: "Take-profit",
  end_of_period: "Fin période",
};

export default function BacktestPage() {
  useAuth(); // auth context
  const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
  const [ticker, setTicker] = useState("AIR.PA");
  const [strategy, setStrategy] = useState("combined");
  const [period, setPeriod] = useState("2y");
  const [capital, setCapital] = useState(10000);
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);

  const run = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticker: t,
          strategy,
          period,
          initial_capital: capital,
          stop_loss_pct: stopLoss / 100,
          take_profit_pct: takeProfit / 100,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erreur inconnue");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const plotLayout: any = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: "#a0aab8", size: 11 },
    margin: { t: 30, r: 20, l: 60, b: 50 },
    xaxis: { gridcolor: "#1e2330", tickfont: { size: 10 } },
    yaxis: { gridcolor: "#1e2330", ticksuffix: " €" },
    legend: { font: { size: 10 }, bgcolor: "transparent", x: 0, y: 1 },
    hovermode: "x unified",
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#e8eaf0", fontFamily: "var(--font-mono)" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", gap: "1.5rem",
        padding: "0.85rem 2rem", borderBottom: `1px solid ${BORDER}`,
        background: "#10121a", position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ color: GOLD, fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}>
          Trading App
        </Link>
        {[
          { href: "/trading", label: "Trading Auto" },
          { href: "/opportunities", label: "Opportunités" },
          { href: "/dca", label: "DCA Advisor" },
          { href: "/portfolio", label: "Mon Portefeuille" },
          { href: "/backtest", label: "Backtest" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={{
            color: href === "/backtest" ? GOLD : "#8892a4",
            fontSize: "0.8rem", textDecoration: "none",
            fontWeight: href === "/backtest" ? 700 : 400,
          }}>
            {label}
          </Link>
        ))}
      </nav>

      <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: GOLD, margin: 0 }}>Backtesting</h1>
          <p style={{ color: "#8892a4", fontSize: "0.78rem", margin: "0.3rem 0 0" }}>
            Rejoue une stratégie sur des données historiques réelles · simulable même marché fermé
          </p>
        </div>

        {/* Paramètres */}
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: "1.25rem", marginBottom: "1.5rem",
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem",
          alignItems: "end",
        }}>
          {/* Ticker */}
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>
              Ticker
            </label>
            <input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && run()}
              placeholder="ex: AIR.PA"
              style={{
                width: "100%", background: "#0d0f18", border: `1px solid ${BORDER}`,
                borderRadius: 4, color: "#e8eaf0", padding: "0.45rem 0.6rem",
                fontSize: "0.85rem", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Stratégie */}
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>
              Stratégie
            </label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              style={{
                width: "100%", background: "#0d0f18", border: `1px solid ${BORDER}`,
                borderRadius: 4, color: "#e8eaf0", padding: "0.45rem 0.6rem",
                fontSize: "0.82rem",
              }}
            >
              {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Période */}
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>
              Période
            </label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{
                width: "100%", background: "#0d0f18", border: `1px solid ${BORDER}`,
                borderRadius: 4, color: "#e8eaf0", padding: "0.45rem 0.6rem",
                fontSize: "0.82rem",
              }}
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Capital */}
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>
              Capital initial (€)
            </label>
            <input
              type="number" min={100} step={500}
              value={capital}
              onChange={e => setCapital(Number(e.target.value))}
              style={{
                width: "100%", background: "#0d0f18", border: `1px solid ${BORDER}`,
                borderRadius: 4, color: "#e8eaf0", padding: "0.45rem 0.6rem",
                fontSize: "0.85rem", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Stop-loss */}
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>
              Stop-loss ({stopLoss}%)
            </label>
            <input
              type="range" min={1} max={20} step={0.5}
              value={stopLoss}
              onChange={e => setStopLoss(Number(e.target.value))}
              style={{ width: "100%", accentColor: RED }}
            />
          </div>

          {/* Take-profit */}
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>
              Take-profit ({takeProfit}%)
            </label>
            <input
              type="range" min={2} max={50} step={1}
              value={takeProfit}
              onChange={e => setTakeProfit(Number(e.target.value))}
              style={{ width: "100%", accentColor: GREEN }}
            />
          </div>

          {/* Bouton */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={run}
              disabled={loading}
              style={{
                width: "100%", padding: "0.5rem 1rem",
                background: loading ? "#1e2330" : GOLD,
                color: loading ? "#8892a4" : "#0d0f18",
                border: "none", borderRadius: 4, fontWeight: 700,
                fontSize: "0.85rem", cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Calcul en cours…" : "▶ Lancer le backtest"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(200,72,72,0.08)", border: `1px solid ${RED}`, borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1.5rem", color: RED, fontSize: "0.82rem" }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "3rem", color: "#8892a4", fontSize: "0.85rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
            Chargement des données et simulation en cours…<br />
            <span style={{ fontSize: "0.72rem" }}>Peut prendre 10–20 secondes selon la période</span>
          </div>
        )}

        {result && (() => {
          const curve = result.equity_curve;
          const dates = curve.map(p => p.date);
          const equity = curve.map(p => p.equity);

          // Buy & Hold curve
          const startPrice = curve[0]?.price || 1;
          const bhEquity = curve.map(p => result.initial_capital * p.price / startPrice);

          // Annotations : entrées/sorties
          const buySignals = result.trades.filter(t => t.side === "buy");
          const sellSignals = result.trades.filter(t => t.side === "sell");

          const alpha = result.alpha_pct;
          const stratBetter = alpha > 0;

          return (
            <div>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <MetricCard
                  label="Rendement stratégie"
                  value={`${result.total_return_pct > 0 ? "+" : ""}${result.total_return_pct.toFixed(1)}%`}
                  color={result.total_return_pct >= 0 ? GREEN : RED}
                  sub={`${result.initial_capital.toLocaleString("fr-FR")} → ${result.final_equity.toLocaleString("fr-FR")} €`}
                />
                <MetricCard
                  label="Buy & Hold"
                  value={`${result.bh_return_pct > 0 ? "+" : ""}${result.bh_return_pct.toFixed(1)}%`}
                  color={result.bh_return_pct >= 0 ? GREEN : RED}
                />
                <MetricCard
                  label="Alpha vs B&H"
                  value={`${alpha > 0 ? "+" : ""}${alpha.toFixed(1)}%`}
                  color={stratBetter ? GREEN : RED}
                  sub={stratBetter ? "Stratégie bat le B&H" : "B&H bat la stratégie"}
                />
                <MetricCard
                  label="Trades"
                  value={`${result.num_trades}`}
                  sub={`Win rate : ${result.win_rate.toFixed(0)}%`}
                  color={result.win_rate >= 50 ? GREEN : ORANGE}
                />
                <MetricCard
                  label="Gain moyen / Perte moy."
                  value={`+${result.avg_win_pct.toFixed(1)}% / ${result.avg_loss_pct.toFixed(1)}%`}
                  color={Math.abs(result.avg_win_pct) > Math.abs(result.avg_loss_pct) ? GREEN : ORANGE}
                />
                <MetricCard
                  label="Max drawdown"
                  value={`-${result.max_drawdown_pct.toFixed(1)}%`}
                  color={result.max_drawdown_pct < 10 ? GREEN : result.max_drawdown_pct < 20 ? ORANGE : RED}
                />
                <MetricCard
                  label="Sharpe ratio"
                  value={`${result.sharpe_ratio.toFixed(2)}`}
                  color={result.sharpe_ratio >= 1 ? GREEN : result.sharpe_ratio >= 0 ? ORANGE : RED}
                  sub="Annualisé"
                />
              </div>

              {/* Equity curve */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: GOLD, marginBottom: "0.5rem" }}>
                  Courbe d'equity — {result.ticker} · {STRATEGIES.find(s => s.value === result.strategy)?.label} · {PERIODS.find(p => p.value === result.period)?.label}
                </div>
                <Plot
                  data={[
                    {
                      name: "Buy & Hold",
                      x: dates, y: bhEquity,
                      type: "scatter", mode: "lines",
                      line: { color: "#8892a4", width: 1.5, dash: "dot" },
                    },
                    {
                      name: "Stratégie",
                      x: dates, y: equity,
                      type: "scatter", mode: "lines",
                      line: { color: stratBetter ? GREEN : ORANGE, width: 2.5 },
                      fill: "tonexty",
                      fillcolor: stratBetter ? "rgba(61,158,110,0.06)" : "rgba(212,131,74,0.06)",
                    },
                    {
                      name: "Achat",
                      x: buySignals.map(t => t.date),
                      y: buySignals.map(t => {
                        const pt = curve.find(c => c.date === t.date);
                        return pt ? pt.equity : 0;
                      }),
                      type: "scatter", mode: "markers",
                      marker: { color: GREEN, size: 8, symbol: "triangle-up" },
                    },
                    {
                      name: "Vente",
                      x: sellSignals.map(t => t.date),
                      y: sellSignals.map(t => {
                        const pt = curve.find(c => c.date === t.date);
                        return pt ? pt.equity : 0;
                      }),
                      type: "scatter", mode: "markers",
                      marker: { color: RED, size: 8, symbol: "triangle-down" },
                    },
                  ]}
                  layout={{ ...plotLayout, height: 320 }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Trades table */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: GOLD }}>
                    Historique des trades ({result.trades.filter(t => t.side === "sell").length} clôturés)
                  </div>
                  <button
                    onClick={() => setShowTrades(v => !v)}
                    style={{ fontSize: "0.7rem", background: "none", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "0.2rem 0.5rem", cursor: "pointer", color: "#8892a4" }}
                  >
                    {showTrades ? "Masquer" : "Afficher"}
                  </button>
                </div>
                {showTrades && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                      <thead>
                        <tr style={{ color: "#8892a4", borderBottom: `1px solid ${BORDER}` }}>
                          {["Date", "Sens", "Prix", "Quantité", "PnL €", "PnL %", "Raison"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.6rem", fontWeight: 600, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, opacity: 0.92 }}>
                            <td style={{ padding: "0.3rem 0.6rem", color: "#a0aab8" }}>{t.date}</td>
                            <td style={{ padding: "0.3rem 0.6rem", color: t.side === "buy" ? GREEN : RED, fontWeight: 600 }}>
                              {t.side === "buy" ? "▲ Achat" : "▼ Vente"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem" }}>{t.price.toLocaleString("fr-FR")} €</td>
                            <td style={{ padding: "0.3rem 0.6rem" }}>{t.shares.toFixed(3)}</td>
                            <td style={{ padding: "0.3rem 0.6rem", color: t.pnl > 0 ? GREEN : t.pnl < 0 ? RED : "#8892a4" }}>
                              {t.side === "sell" ? `${t.pnl > 0 ? "+" : ""}${t.pnl.toFixed(2)} €` : "—"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", color: t.pnl_pct > 0 ? GREEN : t.pnl_pct < 0 ? RED : "#8892a4" }}>
                              {t.side === "sell" ? `${t.pnl_pct > 0 ? "+" : ""}${t.pnl_pct.toFixed(2)}%` : "—"}
                            </td>
                            <td style={{ padding: "0.3rem 0.6rem", color: "#8892a4", fontSize: "0.7rem" }}>
                              {REASON_LABELS[t.reason] || t.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
