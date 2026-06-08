"use client";

import { useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { DCASummary, DCARecommendation, OHLCVData, NewsItem } from "@/lib/types";
import {
  getDCASummary, addDCAPosition, removeDCAPosition,
  getDCARecommendations, getMarketHistory, getOpportunityNews, getDCAHistory,
} from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";

const POPULAR_ASSETS: Record<string, string> = {
  "CW8.PA": "Amundi MSCI World (CW8)",
  "EWLD.PA": "Lyxor MSCI World",
  "500.PA": "Amundi S&P 500",
  "PSP5.PA": "Lyxor PEA S&P 500",
  "PE500.PA": "Amundi PEA S&P 500 ESG",
  "PUST.PA": "Lyxor PEA Nasdaq-100",
  "PANX.PA": "Amundi PEA Nasdaq-100",
  "C50.PA": "Amundi CAC 40",
  "CAC.PA": "Lyxor CAC 40",
  "MEUD.PA": "Amundi Euro Stoxx 50",
  "PAEEM.PA": "Amundi PEA Emerging Markets",
  "AIR.PA": "Airbus",
  "SAF.PA": "Safran",
  "TKO.PA": "Thales",
  "MC.PA": "LVMH",
  "KER.PA": "Kering",
  "RMS.PA": "Hermès",
  "BNP.PA": "BNP Paribas",
  "GLE.PA": "Société Générale",
  "TTE.PA": "TotalEnergies",
  "CAP.PA": "Capgemini",
  "DAS.PA": "Dassault Systèmes",
  "SAN.PA": "Sanofi",
  "SU.PA": "Schneider Electric",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title">{children}</div>;
}

const PALETTE = ["#c9a84c","#3d9e6e","#7b6fc4","#d4834a","#4a8fd4","#c84848","#6e9e8a","#a07b40"];

interface RecDetail {
  chartData: OHLCVData | null;
  news: NewsItem[];
  open: boolean;
}

export default function DCAPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [manualTicker, setManualTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [recDetails, setRecDetails] = useState<Record<string, RecDetail>>({});

  const { data: summary, mutate: mutateSummary } = useSWR<DCASummary>(
    "dca-summary", getDCASummary as any, { refreshInterval: 60000 }
  );
  const { data: recommendations, mutate: mutateRecs } = useSWR<DCARecommendation[]>(
    "dca-recommendations", getDCARecommendations as any, { refreshInterval: 120000 }
  );
  const { data: history } = useSWR("dca-history", getDCAHistory as any, { refreshInterval: 300000 });

  const msg = (m: string) => { setFormMsg(m); setTimeout(() => setFormMsg(""), 3000); };

  const searchResults = searchQuery.length >= 2
    ? Object.entries(POPULAR_ASSETS).filter(([t, n]) =>
        t.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.toLowerCase().includes(searchQuery.toLowerCase())
      ).map(([t]) => t)
    : [];

  const finalTicker = (selectedTicker || manualTicker).toUpperCase().trim();

  const handleAdd = async () => {
    if (!finalTicker) return msg("Sélectionnez ou entrez un ticker.");
    if (!shares || +shares <= 0) return msg("Entrez un nombre d'actions > 0.");
    if (!price || +price <= 0) return msg("Entrez un prix > 0.");
    await addDCAPosition(finalTicker, +shares, +price);
    setShares(""); setPrice(""); setSelectedTicker(""); setManualTicker(""); setSearchQuery("");
    mutateSummary(); mutateRecs();
    msg(`${finalTicker} ajouté au portefeuille.`);
  };

  const handleRemove = async (ticker: string) => {
    if (!confirm(`Supprimer ${ticker} du portefeuille ?`)) return;
    await removeDCAPosition(ticker);
    mutateSummary(); mutateRecs();
    msg(`${ticker} supprimé.`);
  };

  const toggleRecDetail = async (rec: DCARecommendation) => {
    const key = rec.ticker;
    if (recDetails[key]?.open) {
      setRecDetails((prev) => ({ ...prev, [key]: { ...prev[key], open: false } }));
      return;
    }
    if (recDetails[key]) {
      setRecDetails((prev) => ({ ...prev, [key]: { ...prev[key], open: true } }));
      return;
    }
    const [chartData, news] = await Promise.allSettled([
      getMarketHistory(key, "6mo"),
      getOpportunityNews(key),
    ]);
    setRecDetails((prev) => ({
      ...prev,
      [key]: {
        chartData: chartData.status === "fulfilled" ? (chartData.value as OHLCVData) : null,
        news: news.status === "fulfilled" ? (news.value as NewsItem[]) : [],
        open: true,
      },
    }));
  };

  const actionConfig = {
    renforcer: { color: GREEN, label: "RENFORCER", bg: "rgba(61,158,110,0.08)", border: "rgba(61,158,110,0.3)" },
    conserver: { color: GOLD, label: "CONSERVER", bg: "rgba(201,168,76,0.06)", border: "rgba(201,168,76,0.25)" },
    "alléger": { color: RED, label: "ALLÉGER", bg: "rgba(200,72,72,0.06)", border: "rgba(200,72,72,0.25)" },
  };

  return (
    <div className="page-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-label">Portefeuille</div>
        <Link href="/" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          ← Accueil
        </Link>

        <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          Ajouter / Renforcer
        </div>

        <label>Rechercher</label>
        <input
          className="input"
          placeholder="Nom ou ticker (ex: World, CW8, LVMH…)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginBottom: "0.5rem" }}
        />

        {searchResults.length > 0 && (
          <select
            className="select"
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            style={{ marginBottom: "0.75rem" }}
          >
            <option value="">— Sélectionnez —</option>
            {searchResults.map((t) => (
              <option key={t} value={t}>{POPULAR_ASSETS[t]} ({t})</option>
            ))}
          </select>
        )}

        <label>Ticker manuel</label>
        <input
          className="input"
          placeholder="ex: AAPL, MSFT.US"
          value={manualTicker}
          onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
          style={{ marginBottom: "0.75rem" }}
        />

        {finalTicker && (
          <div style={{
            background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)",
            borderRadius: 3, padding: "0.4rem 0.75rem", fontSize: "0.75rem", marginBottom: "0.75rem",
          }}>
            <span style={{ color: GOLD, fontWeight: 600 }}>{finalTicker}</span>
            {POPULAR_ASSETS[finalTicker] && <span style={{ color: "var(--text-muted)" }}> · {POPULAR_ASSETS[finalTicker]}</span>}
          </div>
        )}

        <label>Actions / parts</label>
        <input
          className="input" type="number" min="0" step="0.01"
          placeholder="0.00"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          style={{ marginBottom: "0.5rem" }}
        />

        <label>Prix moyen (EUR)</label>
        <input
          className="input" type="number" min="0" step="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{ marginBottom: "0.75rem" }}
        />

        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleAdd}>
          Ajouter la position
        </button>

        {formMsg && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: GOLD }}>
            {formMsg}
          </div>
        )}

        {/* Remove position */}
        {summary?.positions && summary.positions.length > 0 && (
          <>
            <hr style={{ borderColor: "var(--border)", margin: "1rem 0" }} />
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              Supprimer une position
            </div>
            {summary.positions.map((p) => (
              <div key={p.ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.75rem", color: GOLD }}>{p.ticker}</span>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: "0.62rem", padding: "0.2rem 0.5rem" }}
                  onClick={() => handleRemove(p.ticker)}
                >
                  ✕
                </button>
              </div>
            ))}
          </>
        )}

        {/* ETF reference */}
        <hr style={{ borderColor: "var(--border)", margin: "1rem 0" }} />
        <details>
          <summary style={{ fontSize: "0.72rem", color: "var(--text-secondary)", cursor: "pointer", marginBottom: "0.5rem" }}>
            ETF populaires
          </summary>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.8 }}>
            <div><span style={{ color: GOLD }}>World</span> CW8.PA · EWLD.PA</div>
            <div><span style={{ color: GOLD }}>S&P 500</span> 500.PA · PE500.PA</div>
            <div><span style={{ color: GOLD }}>Nasdaq</span> PUST.PA · PANX.PA</div>
            <div><span style={{ color: GOLD }}>Europe</span> C50.PA · MEUD.PA</div>
          </div>
        </details>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="page-header">
          <div className="page-title">Conseiller DCA</div>
          <div className="page-subtitle">Suivi de portefeuille & recommandations personnalisées</div>
        </div>

        {!summary?.positions?.length ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Aucune position dans le portefeuille. Utilisez le formulaire pour ajouter vos positions.
          </p>
        ) : (
          <>
            {/* Overview */}
            <SectionTitle>Vue Globale</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div className="metric-card">
                <div className="metric-label">Investi</div>
                <div className="metric-value">{fmt(summary.total_invested)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Valeur actuelle</div>
                <div className="metric-value">{fmt(summary.total_current_value)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">P&L total</div>
                <div className="metric-value" style={{ color: summary.total_pnl >= 0 ? GREEN : RED }}>
                  {summary.total_pnl >= 0 ? "+" : ""}{fmt(summary.total_pnl)}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                  {fmtPct(summary.total_pnl_pct)}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Positions</div>
                <div className="metric-value">{summary.positions.length}</div>
              </div>
            </div>

            {/* Sector allocation */}
            {summary.allocation && Object.keys(summary.allocation).length > 0 && (
              <>
                <SectionTitle>Allocation Sectorielle</SectionTitle>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 260, height: 260 }}>
                    <Plot
                      data={[{
                        type: "pie",
                        values: Object.values(summary.allocation),
                        labels: Object.keys(summary.allocation),
                        hole: 0.55,
                        marker: { colors: PALETTE.slice(0, Object.keys(summary.allocation).length), line: { color: "#0b0b10", width: 3 } },
                        textfont: { size: 11, color: "#f0ede0" },
                        hovertemplate: "<b>%{label}</b><br>%{value:.1f}%<extra></extra>",
                      }]}
                      layout={{
                        height: 260, width: 260,
                        paper_bgcolor: "rgba(0,0,0,0)",
                        margin: { l: 0, r: 0, t: 0, b: 0 },
                        legend: { bgcolor: "rgba(0,0,0,0)", font: { size: 11, color: "var(--text-secondary)" } },
                        annotations: [{
                          text: `<b>${Object.keys(summary.allocation).length}</b>`,
                          x: 0.5, y: 0.5, font: { size: 18, color: "#f0ede0" }, showarrow: false,
                        }],
                      }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                  <div>
                    {Object.entries(summary.allocation).map(([sector, pct], i) => (
                      <div key={sector} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE[i % PALETTE.length], display: "inline-block" }} />
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", minWidth: 100 }}>{sector}</span>
                        <span style={{ fontSize: "0.8rem", color: GOLD, fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Positions table */}
            <SectionTitle>Détail des Positions</SectionTitle>
            <div className="card" style={{ padding: 0 }}>
              <table className="trading-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Actions</th>
                    <th>PRU (€)</th>
                    <th>Cours (€)</th>
                    <th>Investi (€)</th>
                    <th>Valeur (€)</th>
                    <th>P&L (€)</th>
                    <th>P&L (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.positions.map((pos) => (
                    <tr key={pos.ticker}>
                      <td style={{ color: GOLD, fontWeight: 600 }}>{pos.ticker}</td>
                      <td>{pos.shares.toFixed(2)}</td>
                      <td>{pos.avg_price.toFixed(2)}</td>
                      <td>{pos.current_price ? pos.current_price.toFixed(2) : "—"}</td>
                      <td>{pos.invested.toFixed(2)}</td>
                      <td>{pos.current_value ? pos.current_value.toFixed(2) : "—"}</td>
                      <td style={{ color: pos.pnl != null && pos.pnl > 0 ? GREEN : pos.pnl != null && pos.pnl < 0 ? RED : "inherit" }}>
                        {pos.pnl != null ? `${pos.pnl > 0 ? "+" : ""}${pos.pnl.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ color: pos.pnl_pct != null && pos.pnl_pct > 0 ? GREEN : pos.pnl_pct != null && pos.pnl_pct < 0 ? RED : "inherit" }}>
                        {pos.pnl_pct != null ? `${pos.pnl_pct > 0 ? "+" : ""}${pos.pnl_pct.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* DCA Recommendations */}
            <SectionTitle>Recommandations du Jour</SectionTitle>
            {!recommendations ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Chargement des recommandations…</p>
            ) : (
              <>
                {(recommendations as DCARecommendation[]).map((rec) => {
                  const cfg = actionConfig[rec.action as keyof typeof actionConfig] ?? actionConfig.conserver;
                  const det = recDetails[rec.ticker];
                  return (
                    <div key={rec.ticker} style={{ marginBottom: "0.75rem" }}>
                      <button
                        onClick={() => toggleRecDetail(rec)}
                        style={{
                          width: "100%",
                          background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          borderRadius: 3,
                          padding: "0.75rem 1rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                        }}
                      >
                        <span style={{ color: GOLD, fontWeight: 700 }}>{rec.ticker}</span>
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.1em", color: cfg.color,
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          borderRadius: 2, padding: "0.15rem 0.5rem",
                        }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {rec.current_price.toFixed(2)} €
                        </span>
                        <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {det?.open ? "▲" : "▼"}
                        </span>
                      </button>

                      {det?.open && (
                        <div className="card" style={{ borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                          {/* Metrics */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                            <div className="metric-card">
                              <div className="metric-label">Score technique</div>
                              <div className="metric-value" style={{ color: rec.tech_score > 0 ? GREEN : rec.tech_score < 0 ? RED : "inherit" }}>
                                {rec.tech_score > 0 ? "+" : ""}{rec.tech_score.toFixed(2)}
                              </div>
                            </div>
                            <div className="metric-card">
                              <div className="metric-label">Score fondamental</div>
                              <div className="metric-value" style={{ color: rec.fund_score > 0 ? GREEN : rec.fund_score < 0 ? RED : "inherit" }}>
                                {rec.fund_score > 0 ? "+" : ""}{rec.fund_score.toFixed(2)}
                              </div>
                            </div>
                            {rec.target_mean && (
                              <div className="metric-card">
                                <div className="metric-label">Objectif moyen</div>
                                <div className="metric-value">{rec.target_mean.toFixed(2)} €</div>
                              </div>
                            )}
                            {rec.changes?.week != null && (
                              <div className="metric-card">
                                <div className="metric-label">Variation semaine</div>
                                <div className="metric-value" style={{ color: rec.changes.week > 0 ? GREEN : RED }}>
                                  {rec.changes.week > 0 ? "+" : ""}{rec.changes.week.toFixed(2)}%
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Reasons */}
                          {rec.reasons.length > 0 && (
                            <div style={{ marginBottom: "1rem" }}>
                              <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                                Facteurs
                              </p>
                              {rec.reasons.map((r, i) => (
                                <p key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.15rem 0" }}>
                                  <span style={{ color: GOLD, marginRight: "0.5rem" }}>–</span>{r}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Forecasts */}
                          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                            Prévisions
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                            {[
                              { period: "Court terme · 1-4 sem.", text: rec.short_term },
                              { period: "Moyen terme · 1-6 mois", text: rec.medium_term },
                              { period: "Long terme · 6-12 mois", text: rec.long_term },
                            ].map(({ period, text }) => (
                              <div key={period} style={{
                                background: "var(--surface2)", border: "1px solid var(--border)",
                                borderRadius: 3, padding: "0.85rem",
                              }}>
                                <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                                  {period}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{text}</div>
                              </div>
                            ))}
                          </div>

                          {/* Chart */}
                          {det.chartData && (
                            <div className="chart-container" style={{ marginBottom: "1rem" }}>
                              <Plot
                                data={[
                                  {
                                    type: "candlestick",
                                    x: det.chartData.dates,
                                    open: det.chartData.open, high: det.chartData.high,
                                    low: det.chartData.low, close: det.chartData.close,
                                    name: rec.ticker,
                                    increasing: { line: { color: GREEN } },
                                    decreasing: { line: { color: RED } },
                                  },
                                  ...(det.chartData.SMA_20 ? [{
                                    type: "scatter" as const,
                                    x: det.chartData.dates, y: det.chartData.SMA_20,
                                    name: "SMA 20", line: { color: GOLD, width: 1 },
                                  }] : []),
                                ]}
                                layout={{
                                  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                                  height: 320, margin: { l: 40, r: 20, t: 20, b: 30 },
                                  xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, rangeslider: { visible: false } },
                                  yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                                  legend: { font: { color: "var(--text-secondary)", size: 10 }, bgcolor: "rgba(0,0,0,0)" },
                                  shapes: [{
                                    type: "line", x0: det.chartData.dates[0],
                                    x1: det.chartData.dates[det.chartData.dates.length - 1],
                                    y0: rec.avg_price, y1: rec.avg_price,
                                    line: { color: GOLD, dash: "dash", width: 1 },
                                  }],
                                }}
                                config={{ displayModeBar: false, responsive: true }}
                                style={{ width: "100%" }}
                              />
                            </div>
                          )}

                          {/* News */}
                          {det.news.length > 0 && (
                            <>
                              <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: "0 0 0.4rem" }}>
                                Actualités
                              </p>
                              {det.news.map((item, i) => (
                                <p key={i} style={{ fontSize: "0.78rem", margin: "0.2rem 0" }}>
                                  {item.published && <span style={{ color: "var(--text-muted)" }}>{item.published} — </span>}
                                  <a href={item.link} target="_blank" rel="noreferrer" style={{ color: GOLD, textDecoration: "none" }}>
                                    {item.title}
                                  </a>
                                  <span style={{ color: "var(--text-muted)" }}> · {item.source}</span>
                                </p>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Portfolio history */}
            {history && Array.isArray(history) && history.length > 1 && (
              <>
                <SectionTitle>Évolution de la Valeur</SectionTitle>
                <div className="chart-container">
                  <Plot
                    data={[{
                      type: "scatter",
                      x: (history as any[]).map((h) => h.snapshot_at),
                      y: (history as any[]).map((h) => h.total_value),
                      mode: "lines",
                      line: { color: GOLD, width: 2 },
                      fill: "tozeroy",
                      fillcolor: "rgba(201,168,76,0.06)",
                    }]}
                    layout={{
                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                      height: 300, margin: { l: 50, r: 20, t: 20, b: 40 },
                      xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 } },
                      yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}
          </>
        )}

        <p style={{ marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          Les recommandations sont générées automatiquement et ne constituent pas un conseil en investissement.
        </p>
      </main>
    </div>
  );
}
