"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { OpportunityScore, OHLCVData, NewsItem } from "@/lib/types";
import { analyzeOpportunities, getOpportunityScores, getMarketHistory, getOpportunityNews } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";

const SECTORS: Record<string, string[]> = {
  "Défense & Aéro": ["AIR.PA", "SAF.PA", "HO.PA", "AM.PA"],
  "Luxe & Beauté": ["MC.PA", "KER.PA", "RMS.PA", "OR.PA"],
  "Banque & Assurance": ["BNP.PA", "GLE.PA", "ACA.PA", "AXA.PA"],
  "Énergie": ["TTE.PA", "ENGI.PA", "GTT.PA"],
  "Technologie & IT": ["CAP.PA", "DSY.PA", "STM.PA", "ATO.PA", "ALTEN.PA"],
  "Santé & Pharma": ["SAN.PA", "EL.PA", "IPH.PA", "ERF.PA", "GENFIT.PA", "DBV.PA"],
  "Industrie": ["SU.PA", "SGO.PA", "LR.PA", "ALO.PA", "SEB.PA", "WLN.PA", "VIE.PA"],
  "Automobile": ["RNO.PA", "STLAM.PA", "ML.PA", "FRVIA.PA"],
  "Télécom": ["ORA.PA", "ILD.PA"],
  "Distribution & Retail": ["CA.PA", "RXL.PA", "FNAC.PA"],
  "Immobilier": ["URW.PA", "COV.PA", "ICAD.PA"],
  "Matériaux": ["MT.PA", "VK.PA", "ERAMET.PA"],
  "Médias & Loisirs": ["VIV.PA", "TF1.PA", "M6.PA", "LAGR.PA"],
  "Agroalimentaire": ["BN.PA", "RI.PA", "BON.PA"],
  "Transport": ["ADP.PA", "AF.PA", "GETLINK.PA"],
};

function scoreColor(score: number) {
  if (score >= 6) return GREEN;
  if (score >= 3) return ORANGE;
  if (score >= 0) return GOLD;
  return RED;
}

function recEmoji(rec: string) {
  const map: Record<string, string> = { acheter: "▲", surveiller: "◎", neutre: "—", eviter: "▼" };
  return map[rec] ?? "—";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title">{children}</div>;
}

interface TickerDetail {
  ticker: string;
  chartData: OHLCVData | null;
  news: NewsItem[];
  open: boolean;
}

export default function OpportunitiesPage() {
  const [selectedSectors, setSelectedSectors] = useState<string[]>(["Defense", "Aeronautique", "Technologie"]);
  const [extraTickers, setExtraTickers] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [results, setResults] = useState<OpportunityScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, ticker: "" });
  const [errors, setErrors] = useState<Array<{ ticker: string; error: string }>>([]);
  const [details, setDetails] = useState<Record<string, TickerDetail>>({});
  const [loadingCached, setLoadingCached] = useState(false);

  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  const getTickerList = () => {
    const set = new Set<string>();
    selectedSectors.forEach((s) => SECTORS[s]?.forEach((t) => set.add(t)));
    extraTickers.split(",").forEach((t) => {
      const clean = t.trim().toUpperCase();
      if (clean) set.add(clean);
    });
    return Array.from(set).sort();
  };

  const handleAnalyze = async () => {
    const tickers = getTickerList();
    if (!tickers.length) return;
    setLoading(true);
    setErrors([]);
    setProgress({ current: 0, total: tickers.length, ticker: "" });

    // Envoyer par lots de 3
    const allResults: OpportunityScore[] = [];
    for (let i = 0; i < tickers.length; i += 3) {
      const batch = tickers.slice(i, i + 3);
      setProgress({ current: i, total: tickers.length, ticker: batch.join(", ") });
      try {
        const data = await analyzeOpportunities(batch) as { results: OpportunityScore[]; errors: any[] };
        allResults.push(...data.results);
        setErrors((prev) => [...prev, ...data.errors]);
      } catch (e: any) {
        batch.forEach((t) => setErrors((prev) => [...prev, { ticker: t, error: e.message }]));
      }
    }

    allResults.sort((a, b) => b.score - a.score);
    setResults(allResults);
    setProgress({ current: tickers.length, total: tickers.length, ticker: "" });
    setLoading(false);
  };

  const handleLoadCached = async () => {
    setLoadingCached(true);
    try {
      const data = await getOpportunityScores() as OpportunityScore[];
      const sorted = [...data].sort((a, b) => b.score - a.score);
      setResults(sorted);
    } catch {}
    setLoadingCached(false);
  };

  const toggleDetail = async (opp: OpportunityScore) => {
    const key = opp.ticker;
    if (details[key]?.open) {
      setDetails((prev) => ({ ...prev, [key]: { ...prev[key], open: false } }));
      return;
    }
    if (details[key]) {
      setDetails((prev) => ({ ...prev, [key]: { ...prev[key], open: true } }));
      return;
    }
    // Load chart + news
    const [chartData, news] = await Promise.allSettled([
      getMarketHistory(key, "6mo"),
      getOpportunityNews(key),
    ]);
    setDetails((prev) => ({
      ...prev,
      [key]: {
        ticker: key,
        chartData: chartData.status === "fulfilled" ? (chartData.value as OHLCVData) : null,
        news: news.status === "fulfilled" ? (news.value as NewsItem[]) : [],
        open: true,
      },
    }));
  };

  const filtered = results.filter((r) => r.score >= minScore);
  const highScore = filtered.filter((r) => r.score >= 7);
  const tickers = getTickerList();

  return (
    <div className="page-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-label">Paramètres</div>
        <Link href="/" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          ← Accueil
        </Link>

        <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          Secteurs
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem" }}>
          {Object.keys(SECTORS).map((s) => (
            <label
              key={s}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                cursor: "pointer", fontSize: "0.78rem", color: "var(--text-secondary)",
                textTransform: "none", letterSpacing: 0, marginBottom: 0,
              }}
            >
              <input
                type="checkbox"
                checked={selectedSectors.includes(s)}
                onChange={() => toggleSector(s)}
                style={{ accentColor: GOLD }}
              />
              {s}
            </label>
          ))}
        </div>

        <hr style={{ borderColor: "var(--border)", marginBottom: "1rem" }} />

        <label>Tickers supplémentaires</label>
        <input
          className="input"
          placeholder="ex : AAPL, TSLA"
          value={extraTickers}
          onChange={(e) => setExtraTickers(e.target.value)}
          style={{ marginBottom: "1rem" }}
        />

        <label>Score minimum</label>
        <input
          type="range" min={-10} max={10} step={0.5}
          value={minScore}
          onChange={(e) => setMinScore(+e.target.value)}
          style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }}
        />
        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          {minScore >= 0 ? "+" : ""}{minScore}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginBottom: "0.5rem" }}
          onClick={handleAnalyze}
          disabled={loading || !tickers.length}
        >
          {loading ? `Analyse… (${progress.current}/${progress.total})` : `Lancer l'analyse (${tickers.length} tickers)`}
        </button>

        <button
          className="btn btn-secondary"
          style={{ width: "100%", fontSize: "0.7rem" }}
          onClick={handleLoadCached}
          disabled={loadingCached}
        >
          {loadingCached ? "Chargement…" : "Charger scores récents"}
        </button>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="page-header">
          <div className="page-title">Analyse d'Opportunités</div>
          <div className="page-subtitle">Scoring multi-facteurs par secteur</div>
        </div>

        {/* Progress */}
        {loading && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
              Analyse de {progress.ticker}…
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 2, height: 4, overflow: "hidden" }}>
              <div
                style={{
                  background: GOLD,
                  height: "100%",
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{ marginBottom: "1rem", fontSize: "0.75rem", color: RED }}>
            {errors.slice(0, 3).map((e) => (
              <div key={e.ticker}>⚠ {e.ticker}: {e.error}</div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && results.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Configurez les secteurs et cliquez sur <strong>Lancer l'analyse</strong>, ou chargez les scores récents.
          </p>
        )}

        {filtered.length > 0 && (
          <>
            {/* Alerts */}
            {highScore.length > 0 && (
              <>
                <SectionTitle>Alertes</SectionTitle>
                {highScore.map((opp) => (
                  <div
                    key={opp.ticker}
                    style={{
                      background: "rgba(201,168,76,0.06)",
                      border: "1px solid rgba(201,168,76,0.3)",
                      borderLeft: "3px solid #c9a84c",
                      borderRadius: 3,
                      padding: "0.7rem 1rem",
                      marginBottom: "0.5rem",
                      fontSize: "0.82rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <span style={{ color: GOLD, fontWeight: 700, letterSpacing: "0.05em" }}>{opp.ticker}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{opp.name}</span>
                    <span style={{ marginLeft: "auto", color: GOLD, fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase" }}>
                      Score {opp.score}/10
                    </span>
                    <span style={{ color: "var(--text-primary)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase" }}>
                      {opp.recommendation.toUpperCase()}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Summary table */}
            <SectionTitle>Tableau des Opportunités</SectionTitle>
            <div className="card" style={{ padding: 0 }}>
              <table className="trading-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Nom</th>
                    <th>Score</th>
                    <th>Recommandation</th>
                    <th>Cours</th>
                    <th>Objectif</th>
                    <th>Gain Pot.</th>
                    <th>Tech.</th>
                    <th>Fonda.</th>
                    <th>Sentiment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((opp) => {
                    const det = details[opp.ticker];
                    return (
                      <>
                        <tr key={opp.ticker}>
                          <td style={{ color: GOLD, fontWeight: 600 }}>{opp.ticker}</td>
                          <td style={{ fontSize: "0.72rem" }}>{opp.name || "—"}</td>
                          <td>
                            <span style={{ color: scoreColor(opp.score), fontWeight: 600 }}>
                              {opp.score.toFixed(1)}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>/10</span>
                          </td>
                          <td style={{ fontSize: "0.72rem" }}>
                            {recEmoji(opp.recommendation)} {opp.recommendation.toUpperCase()}
                          </td>
                          <td>{opp.current_price ? opp.current_price.toFixed(2) : "—"}</td>
                          <td>{opp.target_price ? opp.target_price.toFixed(2) : "—"}</td>
                          <td style={{ color: opp.gain_pct != null && opp.gain_pct > 0 ? GREEN : "var(--text-secondary)" }}>
                            {opp.gain_pct != null ? `${opp.gain_pct > 0 ? "+" : ""}${opp.gain_pct.toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ color: opp.technical_score > 0 ? GREEN : opp.technical_score < 0 ? RED : "var(--text-secondary)" }}>
                            {opp.technical_score > 0 ? "+" : ""}{opp.technical_score.toFixed(2)}
                          </td>
                          <td style={{ color: opp.fundamental_score > 0 ? GREEN : opp.fundamental_score < 0 ? RED : "var(--text-secondary)" }}>
                            {opp.fundamental_score > 0 ? "+" : ""}{opp.fundamental_score.toFixed(2)}
                          </td>
                          <td style={{ color: opp.sentiment_score > 0 ? GREEN : opp.sentiment_score < 0 ? RED : "var(--text-secondary)" }}>
                            {opp.sentiment_score > 0 ? "+" : ""}{opp.sentiment_score.toFixed(2)}
                          </td>
                          <td>
                            <button
                              style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                              onClick={() => toggleDetail(opp)}
                            >
                              {det?.open ? "Fermer" : "Détails"}
                            </button>
                          </td>
                        </tr>
                        {det?.open && (
                          <tr key={`${opp.ticker}-detail`}>
                            <td colSpan={11} style={{ padding: "1rem", background: "rgba(201,168,76,0.04)", borderTop: "1px solid var(--border)" }}>
                              {/* Scores */}
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                                {[
                                  { label: "Score global", val: opp.score, suffix: "/10" },
                                  { label: "Cours actuel", val: opp.current_price, suffix: " €" },
                                  { label: "Objectif", val: opp.target_price, suffix: " €" },
                                  { label: "Gain potentiel", val: opp.gain_pct, suffix: "%" },
                                ].map(({ label, val, suffix }) => (
                                  <div key={label} className="metric-card">
                                    <div className="metric-label">{label}</div>
                                    <div className="metric-value" style={{ color: val != null && val > 0 ? GREEN : "var(--text-primary)" }}>
                                      {val != null ? `${val > 0 && suffix !== "/10" ? "+" : ""}${typeof val === "number" ? val.toFixed(label === "Gain potentiel" ? 1 : 2) : val}${suffix}` : "—"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {opp.justification && (
                                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                                  <span style={{ color: "var(--text-muted)" }}>Justification</span> — {opp.justification}
                                </p>
                              )}
                              {/* Chart */}
                              {det.chartData && (
                                <div className="chart-container" style={{ marginBottom: "1rem" }}>
                                  <Plot
                                    data={[
                                      {
                                        type: "candlestick",
                                        x: det.chartData.dates,
                                        open: det.chartData.open,
                                        high: det.chartData.high,
                                        low: det.chartData.low,
                                        close: det.chartData.close,
                                        name: opp.ticker,
                                        increasing: { line: { color: GREEN } },
                                        decreasing: { line: { color: RED } },
                                      },
                                      ...(det.chartData.SMA_20 ? [{
                                        type: "scatter" as const,
                                        x: det.chartData.dates, y: det.chartData.SMA_20,
                                        name: "SMA 20", line: { color: GOLD, width: 1 },
                                      }] : []),
                                      ...(det.chartData.SMA_50 ? [{
                                        type: "scatter" as const,
                                        x: det.chartData.dates, y: det.chartData.SMA_50,
                                        name: "SMA 50", line: { color: "rgba(201,168,76,0.45)", width: 1 },
                                      }] : []),
                                    ]}
                                    layout={{
                                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                                      height: 300, margin: { l: 40, r: 20, t: 10, b: 30 },
                                      xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, rangeslider: { visible: false } },
                                      yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                                      legend: { font: { color: "var(--text-secondary)", size: 10 }, bgcolor: "rgba(0,0,0,0)" },
                                    }}
                                    config={{ displayModeBar: false, responsive: true }}
                                    style={{ width: "100%" }}
                                  />
                                </div>
                              )}
                              {/* News */}
                              {det.news.length > 0 && (
                                <div>
                                  <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: "0 0 0.5rem" }}>Actualités</p>
                                  {det.news.map((item, i) => (
                                    <p key={i} style={{ fontSize: "0.78rem", margin: "0.2rem 0" }}>
                                      {item.published && <span style={{ color: "var(--text-muted)" }}>{item.published} — </span>}
                                      <a href={item.link} target="_blank" rel="noreferrer" style={{ color: GOLD, textDecoration: "none" }}>{item.title}</a>
                                      <span style={{ color: "var(--text-muted)" }}> · {item.source}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Score comparison chart */}
            <SectionTitle>Comparaison des Scores</SectionTitle>
            <div className="chart-container">
              <Plot
                data={[
                  { type: "bar", name: "Technique", x: filtered.map(o => o.ticker), y: filtered.map(o => o.technical_score), marker: { color: GOLD } },
                  { type: "bar", name: "Fondamental", x: filtered.map(o => o.ticker), y: filtered.map(o => o.fundamental_score), marker: { color: GREEN } },
                  { type: "bar", name: "Sentiment", x: filtered.map(o => o.ticker), y: filtered.map(o => o.sentiment_score), marker: { color: ORANGE } },
                  { type: "bar", name: "Analystes", x: filtered.map(o => o.ticker), y: filtered.map(o => o.analyst_score ?? 0), marker: { color: "#7b6fc4" } },
                ]}
                layout={{
                  barmode: "group",
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  height: 380,
                  margin: { l: 40, r: 20, t: 20, b: 60 },
                  xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 } },
                  yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 } },
                  legend: { font: { color: "var(--text-secondary)", size: 11 }, bgcolor: "rgba(0,0,0,0)" },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
              />
            </div>

            {/* Per-company detail */}
            <SectionTitle>Détail par Entreprise</SectionTitle>
            {filtered.map((opp) => {
              const det = details[opp.ticker];
              return (
                <div key={opp.ticker} style={{ marginBottom: "0.75rem" }}>
                  <button
                    onClick={() => toggleDetail(opp)}
                    style={{
                      width: "100%",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 3,
                      padding: "0.75rem 1rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: GOLD, fontWeight: 700 }}>{opp.ticker}</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{opp.name}</span>
                    <span style={{ marginLeft: "auto", color: scoreColor(opp.score), fontWeight: 600, fontSize: "0.85rem" }}>
                      {opp.score.toFixed(1)}/10
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{det?.open ? "▲" : "▼"}</span>
                  </button>

                  {det?.open && (
                    <div className="card" style={{ borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                      {/* Metrics */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div className="metric-card">
                          <div className="metric-label">Score global</div>
                          <div className="metric-value" style={{ color: scoreColor(opp.score) }}>{opp.score}/10</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">Cours actuel</div>
                          <div className="metric-value">{opp.current_price ? `${opp.current_price.toFixed(2)} €` : "—"}</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">Objectif</div>
                          <div className="metric-value">{opp.target_price ? `${opp.target_price.toFixed(2)} €` : "—"}</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">Gain potentiel</div>
                          <div className="metric-value" style={{ color: opp.gain_pct != null && opp.gain_pct > 0 ? GREEN : RED }}>
                            {opp.gain_pct != null ? `${opp.gain_pct > 0 ? "+" : ""}${opp.gain_pct.toFixed(1)}%` : "—"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                        {[
                          { label: "Technique", val: opp.technical_score },
                          { label: "Fondamental", val: opp.fundamental_score },
                          { label: "Sentiment", val: opp.sentiment_score },
                          { label: "Analystes", val: opp.analyst_score },
                        ].map(({ label, val }) => (
                          <div key={label} className="metric-card">
                            <div className="metric-label">{label}</div>
                            <div className="metric-value" style={{ color: val > 0 ? GREEN : val < 0 ? RED : "var(--text-secondary)" }}>
                              {val != null ? `${val > 0 ? "+" : ""}${val.toFixed(2)}` : "—"}
                            </div>
                          </div>
                        ))}
                      </div>

                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Justification</span> — {opp.justification}
                      </p>

                      {/* Chart */}
                      {det.chartData && (
                        <div className="chart-container" style={{ marginBottom: "1rem" }}>
                          <Plot
                            data={[
                              {
                                type: "candlestick",
                                x: det.chartData.dates,
                                open: det.chartData.open,
                                high: det.chartData.high,
                                low: det.chartData.low,
                                close: det.chartData.close,
                                name: opp.ticker,
                                increasing: { line: { color: GREEN } },
                                decreasing: { line: { color: RED } },
                              },
                              ...(det.chartData.SMA_20 ? [{
                                type: "scatter" as const,
                                x: det.chartData.dates, y: det.chartData.SMA_20,
                                name: "SMA 20", line: { color: GOLD, width: 1 },
                              }] : []),
                              ...(det.chartData.SMA_50 ? [{
                                type: "scatter" as const,
                                x: det.chartData.dates, y: det.chartData.SMA_50,
                                name: "SMA 50", line: { color: "rgba(201,168,76,0.45)", width: 1 },
                              }] : []),
                            ]}
                            layout={{
                              paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                              height: 340, margin: { l: 40, r: 20, t: 20, b: 30 },
                              xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, rangeslider: { visible: false } },
                              yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                              legend: { font: { color: "var(--text-secondary)", size: 10 }, bgcolor: "rgba(0,0,0,0)" },
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: "100%" }}
                          />
                        </div>
                      )}

                      {/* News */}
                      {det.news.length > 0 && (
                        <>
                          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: "0 0 0.5rem" }}>
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

        <p style={{ marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          Les scores et recommandations sont générés automatiquement et ne constituent pas un conseil en investissement.
        </p>
      </main>
    </div>
  );
}
