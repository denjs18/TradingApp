"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  PortfolioSummary, PerformanceMetrics, TradingStatus,
  RiskSettings, Trade, TradingLog, PortfolioSnapshot, OHLCVData,
} from "@/lib/types";
import {
  getPortfolioSummary, getPortfolioMetrics, getTradingStatus,
  getTradingSettings, updateTradingSettings, startTrading, stopTrading,
  resetPortfolio, getPortfolioTrades, getPortfolioLogs,
  getPortfolioSnapshots, getMarketHistory,
} from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";

const PROFILES = {
  prudent: { name: "Prudent", strategy: "mean_reversion", stop_loss: -1.5, take_profit: 2.0, max_position: 10, max_positions: 3 },
  equilibre: { name: "Équilibré", strategy: "combined", stop_loss: -2.5, take_profit: 4.0, max_position: 20, max_positions: 5 },
  dynamique: { name: "Dynamique", strategy: "momentum", stop_loss: -4.0, take_profit: 8.0, max_position: 30, max_positions: 7 },
};

const STRATEGY_NAMES: Record<string, string> = {
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  combined: "Combinée",
};

const ALL_TICKERS = [
  "AIR.PA","SAF.PA","TKO.PA","HO.PA","MC.PA","KER.PA","RMS.PA",
  "BNP.PA","GLE.PA","ACA.PA","TTE.PA","ENGI.PA","CAP.PA","DAS.PA",
  "STM.PA","RNO.PA","STL.PA","SAN.PA","BN.PA","ORA.PA","SU.PA",
  "SGO.PA","LR.PA","AM.PA",
];

function fmt(n: number | null | undefined, currency = true): string {
  if (n == null) return "—";
  if (currency) return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
  return n.toFixed(2);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function PosColor({ value }: { value: number | null }) {
  if (value == null) return <span>—</span>;
  const c = value > 0 ? GREEN : value < 0 ? RED : "var(--text-secondary)";
  return <span style={{ color: c }}>{value > 0 ? "+" : ""}{value.toFixed(2)}</span>;
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title">{children}</div>;
}

export default function TradingPage() {
  const [resetBalance, setResetBalance] = useState(10000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedChartTicker, setSelectedChartTicker] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVData | null>(null);

  const { data: summary, mutate: mutatePortfolio } = useSWR<PortfolioSummary>(
    "portfolio-summary", getPortfolioSummary, { refreshInterval: 15000 }
  );
  const { data: metrics } = useSWR<PerformanceMetrics>(
    "portfolio-metrics", getPortfolioMetrics, { refreshInterval: 30000 }
  );
  const { data: tradingStatus, mutate: mutateStatus } = useSWR<TradingStatus>(
    "trading-status", getTradingStatus as any, { refreshInterval: 10000 }
  );
  const { data: settings, mutate: mutateSettings } = useSWR<RiskSettings>(
    "trading-settings", getTradingSettings as any, { refreshInterval: 60000 }
  );
  const { data: trades } = useSWR<Trade[]>("portfolio-trades", getPortfolioTrades as any, { refreshInterval: 30000 });
  const { data: logs } = useSWR<TradingLog[]>("portfolio-logs", () => getPortfolioLogs(30) as any, { refreshInterval: 10000 });
  const { data: snapshots } = useSWR<PortfolioSnapshot[]>("portfolio-snapshots", getPortfolioSnapshots as any, { refreshInterval: 60000 });

  const [localSettings, setLocalSettings] = useState<RiskSettings | null>(null);
  useEffect(() => { if (settings && !localSettings) setLocalSettings(settings); }, [settings]);

  const msg = (m: string) => { setActionMsg(m); setTimeout(() => setActionMsg(""), 3000); };

  const handleStart = async () => {
    await startTrading(); mutateStatus(); msg("Trading automatique démarré.");
  };
  const handleStop = async () => {
    await stopTrading(); mutateStatus(); msg("Trading automatique arrêté.");
  };
  const handleReset = async () => {
    if (!confirm("Réinitialiser le portefeuille ? Toutes les positions et trades seront effacés.")) return;
    await stopTrading();
    await resetPortfolio(resetBalance);
    mutatePortfolio(); mutateStatus(); msg("Portefeuille réinitialisé.");
  };

  const handleSaveSettings = async () => {
    if (!localSettings) return;
    setSaving(true);
    await updateTradingSettings(localSettings as any);
    mutateSettings(); setSaving(false); msg("Paramètres sauvegardés.");
  };

  const applyProfile = (key: keyof typeof PROFILES) => {
    const p = PROFILES[key];
    setLocalSettings((prev) => prev ? {
      ...prev,
      strategy: p.strategy,
      stop_loss: p.stop_loss,
      take_profit: p.take_profit,
      max_position: p.max_position,
      max_positions: p.max_positions,
    } : null);
  };

  const loadChart = useCallback(async (ticker: string) => {
    setSelectedChartTicker(ticker);
    try {
      const data = await getMarketHistory(ticker, "1mo") as OHLCVData;
      setChartData(data);
    } catch {}
  }, []);

  const isEnabled = tradingStatus?.is_enabled ?? false;
  const initial = summary?.initial_balance ?? 10000;
  const totalPnl = summary?.total_pnl ?? 0;
  const totalPnlPct = summary?.total_pnl_pct ?? 0;

  return (
    <div className="page-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-label">Configuration</div>
        <Link href="/" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          ← Accueil
        </Link>

        <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          Profil de risque
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "1rem" }}>
          {Object.entries(PROFILES).map(([k, p]) => (
            <button
              key={k}
              className="btn btn-secondary"
              style={{ fontSize: "0.72rem", justifyContent: "flex-start" }}
              onClick={() => applyProfile(k as keyof typeof PROFILES)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <hr style={{ borderColor: "var(--border)", marginBottom: "1rem" }} />

        {localSettings && (
          <>
            <label>Stratégie</label>
            <select
              className="select"
              style={{ marginBottom: "1rem" }}
              value={localSettings.strategy}
              onChange={(e) => setLocalSettings({ ...localSettings, strategy: e.target.value })}
            >
              {Object.entries(STRATEGY_NAMES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <label>Tickers surveillés</label>
            <div style={{ maxHeight: 120, overflowY: "auto", marginBottom: "1rem", border: "1px solid var(--border)", borderRadius: 3, padding: "0.4rem" }}>
              {ALL_TICKERS.map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: 2, textTransform: "none", letterSpacing: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={localSettings.tickers.includes(t)}
                    onChange={(e) => {
                      const tickers = e.target.checked
                        ? [...localSettings.tickers, t]
                        : localSettings.tickers.filter((x) => x !== t);
                      setLocalSettings({ ...localSettings, tickers });
                    }}
                    style={{ accentColor: GOLD }}
                  />
                  {t}
                </label>
              ))}
            </div>

            <button
              className="btn"
              style={{ fontSize: "0.65rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "▲" : "▼"} Mode avancé
            </button>

            {showAdvanced && (
              <>
                <label>Stop-Loss (%)</label>
                <input
                  type="range" min={-10} max={-0.5} step={0.5}
                  value={localSettings.stop_loss}
                  onChange={(e) => setLocalSettings({ ...localSettings, stop_loss: +e.target.value })}
                  style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }}
                />
                <div style={{ fontSize: "0.72rem", color: RED, marginBottom: "0.75rem" }}>{localSettings.stop_loss}%</div>

                <label>Take-Profit (%)</label>
                <input
                  type="range" min={0.5} max={15} step={0.5}
                  value={localSettings.take_profit}
                  onChange={(e) => setLocalSettings({ ...localSettings, take_profit: +e.target.value })}
                  style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }}
                />
                <div style={{ fontSize: "0.72rem", color: GREEN, marginBottom: "0.75rem" }}>+{localSettings.take_profit}%</div>

                <label>Max position (%)</label>
                <input
                  type="range" min={5} max={50} step={5}
                  value={localSettings.max_position}
                  onChange={(e) => setLocalSettings({ ...localSettings, max_position: +e.target.value })}
                  style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }}
                />
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>{localSettings.max_position}%</div>

                <label>Max positions ouvertes</label>
                <input
                  type="range" min={1} max={10} step={1}
                  value={localSettings.max_positions}
                  onChange={(e) => setLocalSettings({ ...localSettings, max_positions: +e.target.value })}
                  style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }}
                />
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>{localSettings.max_positions}</div>
              </>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </>
        )}
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="page-title">Trading Automatique</div>
          <div className="page-subtitle">Paper trading — simulation temps réel</div>
        </div>

        {actionMsg && (
          <div style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 3, padding: "0.5rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: GOLD }}>
            {actionMsg}
          </div>
        )}

        {/* Status + controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {tradingStatus && (
            <>
              <span className={tradingStatus.market.is_open ? "badge badge-active" : "badge badge-inactive"}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: tradingStatus.market.is_open ? GREEN : "var(--text-muted)", display: "inline-block" }} />
                {tradingStatus.market.is_open ? "Marché ouvert" : "Marché fermé"}
              </span>
              <span className={isEnabled ? "badge badge-active" : "badge badge-inactive"}>
                {isEnabled ? "Trading actif" : "Trading inactif"}
              </span>
              {tradingStatus.last_run && (
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  Dernier cycle : {new Date(tradingStatus.last_run).toLocaleTimeString("fr-FR")}
                </span>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary" onClick={handleStart} disabled={isEnabled}>
            {isEnabled ? "En cours…" : "Démarrer"}
          </button>
          <button className="btn btn-secondary" onClick={handleStop} disabled={!isEnabled}>
            Arrêter
          </button>
          <button className="btn btn-danger" onClick={handleReset}>
            Réinitialiser
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ margin: 0, fontSize: "0.7rem", whiteSpace: "nowrap" }}>Solde initial :</label>
            <input
              type="number" min={100} step={100}
              value={resetBalance}
              onChange={(e) => setResetBalance(+e.target.value)}
              className="input"
              style={{ width: 120 }}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>EUR</span>
          </div>
        </div>

        {/* Portfolio metrics */}
        <SectionTitle>Portefeuille Virtuel</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <MetricCard label="Cash disponible" value={fmt(summary?.cash)} />
          <MetricCard label="Positions" value={fmt(summary?.positions_value)} />
          <MetricCard label="Valeur totale" value={fmt(summary?.total_value)} />
          <MetricCard label="Positions ouvertes" value={String(summary?.num_positions ?? "—")} />
          <MetricCard
            label="P&L Total"
            value={`${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`}
            sub={fmtPct(totalPnlPct)}
            color={totalPnl >= 0 ? GREEN : RED}
          />
        </div>

        {/* Open positions */}
        {summary?.positions && summary.positions.length > 0 && (
          <>
            <SectionTitle>Positions Ouvertes</SectionTitle>
            <div className="card" style={{ padding: 0 }}>
              <table className="trading-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Actions</th>
                    <th>Entrée</th>
                    <th>Cours</th>
                    <th>Valeur</th>
                    <th>P&L €</th>
                    <th>P&L %</th>
                    <th>Stop-Loss</th>
                    <th>Take-Profit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.positions.map((pos) => (
                    <tr key={pos.ticker}>
                      <td style={{ color: GOLD, fontWeight: 600 }}>{pos.ticker}</td>
                      <td>{pos.shares.toFixed(2)}</td>
                      <td>{fmt(pos.entry_price)}</td>
                      <td>{fmt(pos.current_price)}</td>
                      <td>{fmt(pos.current_value)}</td>
                      <td><PosColor value={pos.pnl ?? null} /></td>
                      <td><PosColor value={pos.pnl_pct ?? null} /></td>
                      <td style={{ color: RED }}>{pos.stop_loss ? fmt(pos.stop_loss) : "—"}</td>
                      <td style={{ color: GREEN }}>{pos.take_profit ? fmt(pos.take_profit) : "—"}</td>
                      <td>
                        <button
                          style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                          onClick={() => loadChart(pos.ticker)}
                        >
                          Graphique
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart for selected position */}
            {selectedChartTicker && chartData && (
              <div className="chart-container" style={{ marginTop: "1rem" }}>
                <Plot
                  data={[
                    {
                      type: "candlestick",
                      x: chartData.dates,
                      open: chartData.open,
                      high: chartData.high,
                      low: chartData.low,
                      close: chartData.close,
                      name: selectedChartTicker,
                      increasing: { line: { color: GREEN } },
                      decreasing: { line: { color: RED } },
                    },
                    ...(chartData.SMA_20 ? [{
                      type: "scatter" as const,
                      x: chartData.dates,
                      y: chartData.SMA_20,
                      name: "SMA 20",
                      line: { color: GOLD, width: 1 },
                    }] : []),
                  ]}
                  layout={{
                    title: { text: selectedChartTicker, font: { color: "var(--text-primary)", size: 12 } },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    height: 320,
                    margin: { l: 40, r: 20, t: 40, b: 30 },
                    xaxis: {
                      gridcolor: "rgba(201,168,76,0.06)",
                      tickfont: { color: "var(--text-muted)", size: 10 },
                      rangeslider: { visible: false },
                    },
                    yaxis: {
                      gridcolor: "rgba(201,168,76,0.06)",
                      tickfont: { color: "var(--text-muted)", size: 10 },
                      side: "right",
                    },
                    legend: { font: { color: "var(--text-secondary)", size: 10 } },
                    shapes: summary.positions.filter(p => p.ticker === selectedChartTicker).flatMap(p => [
                      p.stop_loss ? { type: "line" as const, x0: chartData.dates[0], x1: chartData.dates[chartData.dates.length - 1], y0: p.stop_loss, y1: p.stop_loss, line: { color: RED, dash: "dot", width: 1 } } : null,
                      p.take_profit ? { type: "line" as const, x0: chartData.dates[0], x1: chartData.dates[chartData.dates.length - 1], y0: p.take_profit, y1: p.take_profit, line: { color: GREEN, dash: "dot", width: 1 } } : null,
                    ]).filter(Boolean) as any,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </>
        )}

        {/* Performance metrics */}
        <SectionTitle>Performance</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <MetricCard label="Trades total" value={String(metrics?.total_trades ?? "—")} />
          <MetricCard label="Trades clôturés" value={String(metrics?.closed_trades ?? "—")} />
          <MetricCard label="Win Rate" value={metrics ? `${metrics.win_rate.toFixed(1)}%` : "—"} />
          <MetricCard label="P&L total" value={fmt(metrics?.total_pnl)} color={metrics && metrics.total_pnl >= 0 ? GREEN : RED} />
          <MetricCard label="Max Drawdown" value={fmt(metrics?.max_drawdown)} />
          <MetricCard label="Sharpe Ratio" value={metrics ? metrics.sharpe_ratio.toFixed(2) : "—"} />
        </div>

        {/* Performance curve */}
        {snapshots && snapshots.length > 1 && (
          <>
            <SectionTitle>Courbe de Performance</SectionTitle>
            <div className="chart-container">
              <Plot
                data={[{
                  type: "scatter",
                  x: snapshots.map((s) => s.snapshot_at),
                  y: snapshots.map((s) => s.total_value),
                  mode: "lines",
                  name: "Valeur",
                  line: { color: GOLD, width: 2 },
                  fill: "tozeroy",
                  fillcolor: "rgba(201,168,76,0.06)",
                }]}
                layout={{
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  height: 320,
                  margin: { l: 50, r: 20, t: 20, b: 40 },
                  xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 } },
                  yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                  shapes: [{
                    type: "line",
                    x0: snapshots[0]?.snapshot_at,
                    x1: snapshots[snapshots.length - 1]?.snapshot_at,
                    y0: initial,
                    y1: initial,
                    line: { color: "rgba(201,168,76,0.3)", dash: "dash", width: 1 },
                  }],
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}

        {/* Trade history */}
        <SectionTitle>Historique des Trades</SectionTitle>
        {trades && trades.length > 0 ? (
          <div className="card" style={{ padding: 0 }}>
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  <th>Type</th>
                  <th>Actions</th>
                  <th>Prix</th>
                  <th>Total</th>
                  <th>Stratégie</th>
                </tr>
              </thead>
              <tbody>
                {(trades as Trade[]).slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: "0.72rem" }}>{new Date(t.executed_at).toLocaleString("fr-FR")}</td>
                    <td style={{ color: GOLD, fontWeight: 600 }}>{t.ticker}</td>
                    <td style={{ color: t.side === "buy" ? GREEN : RED, fontWeight: 600, textTransform: "uppercase", fontSize: "0.7rem" }}>
                      {t.side === "buy" ? "ACHAT" : "VENTE"}
                    </td>
                    <td>{t.shares.toFixed(2)}</td>
                    <td>{fmt(t.price)}</td>
                    <td>{fmt(t.total)}</td>
                    <td style={{ fontSize: "0.72rem" }}>{t.strategy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Aucun trade exécuté.</p>
        )}

        {/* Logs */}
        <SectionTitle>Logs de Trading</SectionTitle>
        {logs && logs.length > 0 ? (
          <div className="log-terminal">
            {(logs as TradingLog[]).map((log) => {
              const colors = { INFO: "var(--text-secondary)", WARNING: ORANGE, ERROR: RED };
              const c = colors[log.level] ?? "var(--text-muted)";
              return (
                <div key={log.id}>
                  <span style={{ color: "var(--text-muted)" }}>{log.created_at}</span>
                  {" "}
                  <span style={{ color: c, fontWeight: 500 }}>[{log.level}]</span>
                  {" "}
                  <span style={{ color: "var(--text-secondary)" }}>{log.message}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Aucun log disponible.</p>
        )}

        <p style={{ marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          Paper trading — simulation avec argent fictif. Les résultats passés ne garantissent pas les performances futures.
        </p>
      </main>
    </div>
  );
}
