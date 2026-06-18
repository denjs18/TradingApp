"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";
const BG = "#0d0f14";
const CARD_BG = "#14171e";
const BORDER = "#1e2330";

interface PortfolioPosition {
  name: string;
  isin: string;
  ticker: string | null;
  shares: number;
  avg_price: number;
  current_price: number | null;
  current_value: number | null;
  pnl_pct: number | null;
  pnl_abs: number | null;
}

const ISIN_TO_TICKER: Record<string, string> = {
  "NL0000235190": "AIR.PA",
  "FR0010220475": "ALO.PA",
  "FR0000120172": "CA.PA",
  "FR0014003TT8": "DSY.PA",
  "NL0000226223": "STM.PA",
  "FR0004180578": "SWORD.PA",
  "FR0013412020": "PAEEM.PA",
  "FR0013412285": "PUST.PA",
  "LU2655993207": "LCWL.PA",
  "LU3047998896": "DEFN.PA",
  "FR0000131104": "BNP.PA",
  "FR0000121014": "MC.PA",
  "FR0000120321": "SAN.PA",
  "FR0000130809": "SU.PA",
  "FR0000120628": "AXA.PA",
};

function parseBrokerCSV(text: string): PortfolioPosition[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const headerIdx = lines.findIndex(
    (l) => l.includes('"Nom"') && l.includes('"ISIN"')
  );
  if (headerIdx === -1) return [];

  const parsePrice = (s: string) => {
    if (!s || s === "--") return null;
    return (
      parseFloat(
        s
          .replace(/"/g, "")
          .replace(" €", "")
          .replace(/\s/g, "")
          .replace(",", ".")
      ) || null
    );
  };
  const parsePct = (s: string) => {
    if (!s || s === "--") return null;
    return (
      parseFloat(s.replace(/"/g, "").replace(" %", "").replace(",", ".")) ||
      null
    );
  };
  const parseQty = (s: string) => {
    return parseFloat(s.replace(/"/g, "").replace(",", "").trim()) || 0;
  };

  const results: PortfolioPosition[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < 6) continue;
    const name = cols[0].replace(/"/g, "").trim();
    const isin = cols[1].replace(/"/g, "").trim();
    if (!name || !isin || isin.length !== 12) continue;

    const shares = parseQty(cols[2]);
    const current_price = parsePrice(cols[3]);
    const current_value = parsePrice(cols[4]);
    const avg_price = parsePrice(cols[6]) || parsePrice(cols[5]);
    const pnl_abs = parsePrice(cols[8]);
    const pnl_pct = parsePct(cols[10]);

    results.push({
      name,
      isin,
      ticker: null,
      shares,
      avg_price: avg_price || 0,
      current_price,
      current_value,
      pnl_pct,
      pnl_abs,
    });
  }
  return results;
}

function verdictColor(verdict: string) {
  switch (verdict?.toLowerCase()) {
    case "renforcer": return GREEN;
    case "garder": return GOLD;
    case "alléger": return ORANGE;
    case "vendre": return RED;
    default: return "#888";
  }
}

function verdictBg(verdict: string) {
  switch (verdict?.toLowerCase()) {
    case "renforcer": return "rgba(61,158,110,0.15)";
    case "garder": return "rgba(201,168,76,0.12)";
    case "alléger": return "rgba(212,131,74,0.15)";
    case "vendre": return "rgba(200,72,72,0.15)";
    default: return "rgba(255,255,255,0.05)";
  }
}

function verdictArrow(verdict: string) {
  switch (verdict?.toLowerCase()) {
    case "renforcer": return "↑";
    case "garder": return "→";
    case "alléger": return "↓";
    case "vendre": return "↓↓";
    default: return "";
  }
}

export default function PortfolioPage() {
  const { user } = useAuth() as any;
  const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [budget, setBudget] = useState(200);
  const [csvError, setCsvError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseBrokerCSV(text);
      if (parsed.length === 0) {
        setCsvError(
          "Aucune position trouvée. Vérifiez le format du fichier CSV (séparateur ; et en-tête avec Nom/ISIN)."
        );
      } else {
        setPositions(parsed);
        setResults(null);
      }
    };
    reader.readAsText(file, "utf-8");
    // reset input so same file can be re-imported
    e.target.value = "";
  }

  async function analyzePortfolio() {
    if (!positions.length) return;
    setAnalyzing(true);
    setCsvError("");
    try {
      const positionsWithTickers = positions.map((p) => ({
        ...p,
        ticker: ISIN_TO_TICKER[p.isin] || p.isin,
      }));
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ positions: positionsWithTickers, budget }),
      });
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setCsvError("Erreur lors de l'analyse : " + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  // Build a verdict map by ticker for quick lookup
  const verdictMap: Record<string, any> = {};
  if (results?.advice?.positions) {
    for (const v of results.advice.positions) {
      verdictMap[v.ticker] = v;
    }
  }

  const enrichedPositions: any[] = results?.positions || [];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#e8eaf0" }}>
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          padding: "0.85rem 2rem",
          borderBottom: `1px solid ${BORDER}`,
          background: "#10121a",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em" }}>
          ◈ TRADING APP
        </span>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.78rem" }}>
          {[
            { href: "/trading", label: "Trading Auto" },
            { href: "/opportunities", label: "Opportunités" },
            { href: "/dca", label: "DCA Advisor" },
            { href: "/portfolio", label: "Mon Portefeuille" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                color: l.href === "/portfolio" ? GOLD : "var(--text-secondary, #8892a4)",
                textDecoration: "none",
                fontWeight: l.href === "/portfolio" ? 600 : 400,
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#8892a4" }}>
          {user?.email && <span>{user.email}</span>}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 700,
                color: GOLD,
                margin: 0,
                letterSpacing: "0.02em",
              }}
            >
              Mon Portefeuille PEA
            </h1>
            <p style={{ color: "#8892a4", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
              Importez votre CSV broker, obtenez un scoring + conseil DCA Groq IA
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            {/* Budget presets */}
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#8892a4" }}>Budget DCA :</span>
              {[100, 200, 300, 500].map((b) => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  style={{
                    padding: "0.3rem 0.65rem",
                    fontSize: "0.75rem",
                    border: `1px solid ${budget === b ? GOLD : BORDER}`,
                    borderRadius: 4,
                    background: budget === b ? "rgba(201,168,76,0.15)" : "transparent",
                    color: budget === b ? GOLD : "#8892a4",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {b}€
                </button>
              ))}
            </div>

            {/* Import CSV */}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "0.5rem 1.1rem",
                fontSize: "0.8rem",
                background: "rgba(201,168,76,0.12)",
                border: `1px solid ${GOLD}`,
                borderRadius: 6,
                color: GOLD,
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              ↑ Import CSV broker
            </button>
          </div>
        </div>

        {csvError && (
          <div
            style={{
              background: "rgba(200,72,72,0.1)",
              border: `1px solid ${RED}`,
              borderRadius: 6,
              padding: "0.75rem 1rem",
              color: RED,
              fontSize: "0.82rem",
              marginBottom: "1rem",
            }}
          >
            {csvError}
          </div>
        )}

        {/* Positions table */}
        {positions.length > 0 && !results && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                padding: "0.85rem 1.25rem",
                borderBottom: `1px solid ${BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontWeight: 600, color: GOLD, fontSize: "0.9rem" }}>
                {positions.length} positions importées
              </span>
              <span style={{ fontSize: "0.75rem", color: "#8892a4" }}>
                Valeur totale :{" "}
                {positions
                  .reduce((s, p) => s + (p.current_value || 0), 0)
                  .toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["Nom", "ISIN", "Qté", "PRU", "Cours", "Valeur", "P&L"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.6rem 1rem",
                          textAlign: "left",
                          color: "#8892a4",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: `1px solid ${BORDER}`,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: "0.6rem 1rem", color: "#8892a4", fontFamily: "monospace" }}>
                        {p.isin}
                        {ISIN_TO_TICKER[p.isin] && (
                          <span
                            style={{
                              marginLeft: "0.4rem",
                              padding: "0.1rem 0.35rem",
                              background: "rgba(201,168,76,0.1)",
                              border: `1px solid ${GOLD}`,
                              borderRadius: 3,
                              fontSize: "0.68rem",
                              color: GOLD,
                            }}
                          >
                            {ISIN_TO_TICKER[p.isin]}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 1rem" }}>{p.shares}</td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        {p.avg_price ? p.avg_price.toFixed(2) + " €" : "—"}
                      </td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        {p.current_price ? p.current_price.toFixed(2) + " €" : "—"}
                      </td>
                      <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>
                        {p.current_value
                          ? p.current_value.toLocaleString("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            })
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.6rem 1rem",
                          color:
                            p.pnl_pct == null ? "#8892a4" : p.pnl_pct >= 0 ? GREEN : RED,
                          fontWeight: 600,
                        }}
                      >
                        {p.pnl_pct != null ? `${p.pnl_pct >= 0 ? "+" : ""}${p.pnl_pct.toFixed(1)}%` : "—"}
                        {p.pnl_abs != null && (
                          <span style={{ fontSize: "0.72rem", marginLeft: "0.4rem", opacity: 0.7 }}>
                            ({p.pnl_abs >= 0 ? "+" : ""}
                            {p.pnl_abs.toFixed(0)}€)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analyze button */}
        {positions.length > 0 && !results && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
            <button
              onClick={analyzePortfolio}
              disabled={analyzing}
              style={{
                padding: "0.85rem 2.5rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                background: analyzing
                  ? "rgba(61,158,110,0.1)"
                  : "linear-gradient(135deg, rgba(61,158,110,0.2), rgba(61,158,110,0.1))",
                border: `1px solid ${GREEN}`,
                borderRadius: 8,
                color: analyzing ? "#8892a4" : GREEN,
                cursor: analyzing ? "not-allowed" : "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.2s",
              }}
            >
              {analyzing ? "⟳ Analyse en cours…" : "Analyser avec l'IA Groq →"}
            </button>
          </div>
        )}

        {/* Analyzing spinner */}
        {analyzing && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "#8892a4",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ marginBottom: "0.5rem", fontSize: "1.5rem" }}>⟳</div>
            Scoring de chaque position + analyse Groq IA en cours…
            <br />
            <span style={{ fontSize: "0.75rem" }}>
              Cela peut prendre 20 à 40 secondes selon le nombre de positions.
            </span>
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {/* Summary bar */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                marginBottom: "1.5rem",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "#8892a4", fontSize: "0.78rem" }}>Valeur totale</span>
                <div style={{ fontWeight: 700, fontSize: "1.2rem", color: GOLD }}>
                  {results.total_value?.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }) || "—"}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => {
                    setResults(null);
                    setPositions([]);
                  }}
                  style={{
                    padding: "0.4rem 0.9rem",
                    fontSize: "0.75rem",
                    background: "transparent",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 5,
                    color: "#8892a4",
                    cursor: "pointer",
                  }}
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: "0.4rem 0.9rem",
                    fontSize: "0.75rem",
                    background: "rgba(201,168,76,0.1)",
                    border: `1px solid ${GOLD}`,
                    borderRadius: 5,
                    color: GOLD,
                    cursor: "pointer",
                  }}
                >
                  ↑ Nouveau CSV
                </button>
              </div>
            </div>

            {/* Per-position cards grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              {enrichedPositions.map((p: any, i: number) => {
                const ticker = ISIN_TO_TICKER[p.isin] || p.ticker || p.isin;
                // Try to match verdict by ticker or by name fragment
                const advice =
                  verdictMap[ticker] ||
                  verdictMap[p.ticker] ||
                  Object.values(verdictMap).find(
                    (v: any) =>
                      v.ticker === ticker ||
                      p.name?.toLowerCase().includes(v.ticker?.toLowerCase())
                  );
                const verdict = advice?.verdict || null;
                const conviction = advice?.conviction || null;
                const raison = advice?.raison || null;
                const score = p.score;
                const grade = p.quality_grade;
                const redFlags: string[] = p.red_flags || [];

                return (
                  <div
                    key={i}
                    style={{
                      background: CARD_BG,
                      border: `1px solid ${verdict ? verdictColor(verdict) + "44" : BORDER}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    {/* Card header */}
                    <div
                      style={{
                        padding: "0.85rem 1rem 0.6rem",
                        borderBottom: `1px solid ${BORDER}`,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          {p.name}
                          {ticker && ticker !== p.isin && (
                            <span style={{ color: "#8892a4", fontWeight: 400, fontSize: "0.78rem", marginLeft: "0.4rem" }}>
                              — {ticker}
                            </span>
                          )}
                        </div>
                        {score != null && (
                          <div style={{ fontSize: "0.75rem", color: "#8892a4", marginTop: "0.15rem" }}>
                            Score :{" "}
                            <span
                              style={{
                                color:
                                  score >= 6 ? GREEN : score >= 3 ? ORANGE : GOLD,
                                fontWeight: 700,
                              }}
                            >
                              {Number(score).toFixed(1)}/10
                            </span>
                          </div>
                        )}
                      </div>
                      {grade && (
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: 5,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background:
                              grade === "A"
                                ? "rgba(61,158,110,0.15)"
                                : grade === "B"
                                ? "rgba(201,168,76,0.12)"
                                : "rgba(200,72,72,0.12)",
                            color:
                              grade === "A" ? GREEN : grade === "B" ? GOLD : RED,
                            border: `1px solid ${grade === "A" ? GREEN : grade === "B" ? GOLD : RED}40`,
                          }}
                        >
                          {grade}
                        </span>
                      )}
                    </div>

                    {/* Verdict row */}
                    {verdict && (
                      <div
                        style={{
                          padding: "0.6rem 1rem",
                          background: verdictBg(verdict),
                          borderBottom: `1px solid ${BORDER}`,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <span
                          style={{
                            padding: "0.2rem 0.6rem",
                            borderRadius: 5,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            background: verdictColor(verdict) + "22",
                            color: verdictColor(verdict),
                            border: `1px solid ${verdictColor(verdict)}55`,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {verdictArrow(verdict)} {verdict}
                        </span>
                        {conviction != null && (
                          <span style={{ fontSize: "0.75rem", color: "#8892a4" }}>
                            Conviction :{" "}
                            <span style={{ color: GOLD, fontWeight: 600 }}>
                              {conviction}/10
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* AI reason */}
                    {raison && (
                      <div
                        style={{
                          padding: "0.6rem 1rem",
                          fontSize: "0.78rem",
                          color: "#b0b8cc",
                          lineHeight: 1.5,
                          borderBottom: `1px solid ${BORDER}`,
                          fontStyle: "italic",
                        }}
                      >
                        "{raison}"
                      </div>
                    )}

                    {/* Position details */}
                    <div style={{ padding: "0.6rem 1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          fontSize: "0.75rem",
                          color: "#8892a4",
                        }}
                      >
                        <span>
                          <span style={{ color: "#e8eaf0" }}>{p.shares}</span> titres
                        </span>
                        <span>
                          PRU{" "}
                          <span style={{ color: "#e8eaf0" }}>
                            {p.avg_price?.toFixed(2)}€
                          </span>
                        </span>
                        {p.pnl_pct != null && (
                          <span
                            style={{ color: p.pnl_pct >= 0 ? GREEN : RED, fontWeight: 600 }}
                          >
                            {p.pnl_pct >= 0 ? "+" : ""}
                            {p.pnl_pct.toFixed(1)}%
                          </span>
                        )}
                        {p.weight_pct != null && (
                          <span>
                            Poids{" "}
                            <span style={{ color: GOLD }}>
                              {p.weight_pct}%
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Red flags */}
                      {redFlags.length > 0 && (
                        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {redFlags.map((f, fi) => (
                            <span
                              key={fi}
                              style={{
                                padding: "0.1rem 0.4rem",
                                background: "rgba(200,72,72,0.1)",
                                border: `1px solid ${RED}40`,
                                borderRadius: 3,
                                fontSize: "0.65rem",
                                color: RED,
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Scoring error */}
                      {p.error && (
                        <div
                          style={{ fontSize: "0.7rem", color: "#8892a4", marginTop: "0.4rem", fontStyle: "italic" }}
                        >
                          Scoring indisponible ({p.error.slice(0, 60)}...)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI Portfolio Review */}
            {results.advice && !results.advice.error && (
              <div
                style={{
                  background: CARD_BG,
                  border: `1px solid ${GOLD}33`,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: "2rem",
                }}
              >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    borderBottom: `1px solid ${BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>◈</span>
                  <span style={{ fontWeight: 700, color: GOLD, fontSize: "1rem" }}>
                    Analyse IA — Revue de portefeuille
                  </span>
                </div>

                {results.advice.analyse_globale && (
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: "0.72rem", color: "#8892a4", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Analyse globale
                    </div>
                    <p style={{ color: "#c8d0e0", lineHeight: 1.65, fontSize: "0.85rem", margin: 0 }}>
                      {results.advice.analyse_globale}
                    </p>
                  </div>
                )}

                {results.advice.priorite_dca && (
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: "0.72rem", color: "#8892a4", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Priorité DCA ce mois ({budget}€)
                    </div>
                    <div
                      style={{
                        background: "rgba(61,158,110,0.08)",
                        border: `1px solid ${GREEN}33`,
                        borderRadius: 8,
                        padding: "0.85rem 1rem",
                        color: "#c8d0e0",
                        lineHeight: 1.65,
                        fontSize: "0.85rem",
                      }}
                    >
                      {results.advice.priorite_dca}
                    </div>
                  </div>
                )}

                {results.advice.alerte && (
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <div style={{ fontSize: "0.72rem", color: RED, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      ⚠ Alerte
                    </div>
                    <div
                      style={{
                        background: "rgba(200,72,72,0.08)",
                        border: `1px solid ${RED}44`,
                        borderRadius: 8,
                        padding: "0.85rem 1rem",
                        color: "#e8a0a0",
                        lineHeight: 1.65,
                        fontSize: "0.85rem",
                      }}
                    >
                      {results.advice.alerte}
                    </div>
                  </div>
                )}

                {results.advice.error && (
                  <div style={{ padding: "1rem 1.5rem", color: "#8892a4", fontSize: "0.8rem" }}>
                    Analyse Groq indisponible : {results.advice.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!positions.length && !analyzing && (
          <div
            style={{
              textAlign: "center",
              padding: "5rem 2rem",
              color: "#8892a4",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.4 }}>📊</div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#c8d0e0", marginBottom: "0.5rem" }}>
              Aucun portefeuille importé
            </div>
            <p style={{ fontSize: "0.82rem", maxWidth: 420, margin: "0 auto", lineHeight: 1.65 }}>
              Exportez votre relevé de portefeuille depuis votre espace broker (format CSV, séparateur{" "}
              <code style={{ color: GOLD }}>;</code>), puis importez-le via le bouton ci-dessus.
            </p>
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem 1.5rem",
                background: "rgba(201,168,76,0.06)",
                border: `1px solid ${GOLD}22`,
                borderRadius: 8,
                fontSize: "0.78rem",
                color: "#8892a4",
                display: "inline-block",
                textAlign: "left",
                maxWidth: 480,
              }}
            >
              <strong style={{ color: GOLD }}>Format attendu (Amundi / broker français) :</strong>
              <pre style={{ margin: "0.5rem 0 0", fontSize: "0.7rem", color: "#b0b8cc", overflowX: "auto" }}>
                {`"Nom";"ISIN";"Quantité";"Cours";"Valorisation en euro";"Prix de revient";...
"AIRBUS";"NL0000235190";"25, ";"192,17 €";"4804,25 €";"167,9532 €";...`}
              </pre>
            </div>
          </div>
        )}

        {/* Legal disclaimer */}
        <p style={{ fontSize: "0.68rem", color: "#4a5060", textAlign: "center", marginTop: "3rem" }}>
          Les informations fournies sont à titre informatif uniquement et ne constituent pas un conseil en investissement.
          Investir comporte des risques de perte en capital.
        </p>
      </div>
    </div>
  );
}
