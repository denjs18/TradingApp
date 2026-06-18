"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { parseSuiviPEA, type PEAData } from "@/lib/parseSuiviPEA";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

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

  // Suivi PEA historique
  const [peaData, setPeaData] = useState<PEAData | null>(null);
  const [peaLoading, setPeaLoading] = useState(false);
  const [peaHistPrices, setPeaHistPrices] = useState<Record<string, Record<string, number>> | null>(null);
  const peaFileRef = useRef<HTMLInputElement>(null);

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

  // ── Suivi PEA : import fichier Excel ──────────────────────────────────────
  async function handlePEAFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPeaLoading(true);
    setPeaHistPrices(null);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets["Suivi PEA"];
      if (!sheet) { alert('Onglet "Suivi PEA" introuvable dans le fichier.'); return; }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
      const parsed = parseSuiviPEA(rows);
      setPeaData(parsed);

      // Fetch historical prices from backend
      const instruments = parsed.instruments
        .filter(i => i.ticker)
        .map(i => ({ name: i.name, ticker: i.ticker }));
      if (instruments.length > 0) {
        const res = await fetch("/api/portfolio/historical-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruments, period: "5y" }),
        });
        if (res.ok) setPeaHistPrices(await res.json());
      }
    } catch (err: any) {
      alert("Erreur lors du parsing : " + err.message);
    } finally {
      setPeaLoading(false);
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
                      {p.is_etf && (
                        <span style={{
                          padding: "0.2rem 0.5rem", borderRadius: 5,
                          fontSize: "0.72rem", fontWeight: 700,
                          background: "rgba(100,120,200,0.15)",
                          color: "#7b8fcf",
                          border: "1px solid rgba(100,120,200,0.3)",
                        }}>ETF</span>
                      )}
                      {grade && !p.is_etf && (
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

        {/* ── Section Suivi PEA historique ─────────────────────────────── */}
        <div style={{ marginTop: "3rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ color: GOLD, fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Historique du PEA</h2>
              <p style={{ color: "#8892a4", fontSize: "0.78rem", margin: "0.3rem 0 0" }}>
                Importez votre fichier <strong style={{ color: "var(--text-secondary)" }}>Suivi_global.xlsx</strong> — onglet "Suivi PEA" exploité automatiquement
              </p>
            </div>
            <div>
              <input ref={peaFileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handlePEAFile} />
              <button
                onClick={() => peaFileRef.current?.click()}
                disabled={peaLoading}
                style={{
                  background: peaLoading ? "rgba(201,168,76,0.1)" : "rgba(201,168,76,0.15)",
                  border: `1px solid ${GOLD}55`, borderRadius: 8, color: GOLD,
                  padding: "0.55rem 1.2rem", fontWeight: 600, fontSize: "0.82rem",
                  cursor: peaLoading ? "wait" : "pointer",
                }}
              >
                {peaLoading ? "⏳ Chargement…" : "📂 Importer Suivi_global.xlsx"}
              </button>
            </div>
          </div>

          {peaData && (() => {
            const months = peaData.months;
            const instruments = peaData.instruments;
            if (!months.length) return null;

            // ── Chart 1 : Montant investi par mois (bar) ──────────────
            const monthLabels = months.map(m => `${m.month_name.slice(0,3)} ${m.year}`);
            const monthlyAmounts = months.map(m => m.total_invested_month);

            // ── Chart 2 : Total cumulé investi vs Valeur marché estimée ──
            let cumulInvested = 0;
            const cumulInvestedArr: number[] = [];
            const marketValueArr: number[] = [];
            const monthKeys = months.map(m => {
              const monthNum = ["janvier","février","mars","avril","mai","juin",
                "juillet","août","septembre","octobre","novembre","décembre"]
                .findIndex(n => m.month_name.toLowerCase().startsWith(n.slice(0,3)));
              const mn = monthNum >= 0 ? monthNum + 1 : 1;
              return `${m.year}-${String(mn).padStart(2,"0")}`;
            });

            // Prix le plus récent connu par instrument (reporté si un mois manque)
            const lastKnownPrice: Record<string, number> = {};
            months.forEach((m, i) => {
              cumulInvested += m.total_invested_month;
              cumulInvestedArr.push(Math.round(cumulInvested));
              // Market value = sum(qty_total × historical_price) for this month
              let val = 0;
              for (const inst of instruments) {
                const instData = m.instruments[inst.name];
                if (!instData || !instData.qty_total) continue;
                const key = monthKeys[i];
                // Priorité : prix marché du mois → prix d'achat du mois → dernier prix connu
                const price = peaHistPrices?.[inst.name]?.[key]
                  || instData.prix
                  || lastKnownPrice[inst.name];
                if (price) {
                  lastKnownPrice[inst.name] = price;
                  val += instData.qty_total * price;
                }
              }
              marketValueArr.push(Math.round(val));
            });

            const lastMonth = months[months.length - 1];
            const totalInvested = cumulInvestedArr[cumulInvestedArr.length - 1];
            const totalMarket = marketValueArr[marketValueArr.length - 1];
            const perfPct = totalInvested > 0 ? ((totalMarket - totalInvested) / totalInvested * 100) : 0;

            // ── Chart 3 : Allocation actuelle par instrument (pie) ──
            const pieLabels: string[] = [];
            const pieValues: number[] = [];
            for (const inst of instruments) {
              const cur = peaData.current[inst.name];
              if (cur && cur.total_cumule > 0) {
                pieLabels.push(inst.name);
                pieValues.push(cur.total_cumule);
              }
            }

            // ── Chart 4 : Évolution allocation (stacked area) ──
            const stackTraces = instruments
              .filter(inst => months.some(m => (m.instruments[inst.name]?.qty_total || 0) > 0))
              .map(inst => {
                let lastPx = 0;
                return {
                name: inst.name,
                x: monthLabels,
                y: months.map((m, i) => {
                  const instData = m.instruments[inst.name];
                  if (!instData?.qty_total) return 0;
                  const key = monthKeys[i];
                  const price = peaHistPrices?.[inst.name]?.[key] || instData.prix || lastPx;
                  if (price) lastPx = price;
                  return Math.round(instData.qty_total * price);
                }),
                type: "scatter" as const,
                mode: "lines" as const,
                stackgroup: "one",
                fill: "tonexty" as const,
              };
              });

            const plotLayout: any = {
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#a0aab8", size: 11 },
              margin: { t: 30, r: 10, l: 50, b: 50 },
              xaxis: { gridcolor: "#1e2330", tickfont: { size: 10 } },
              yaxis: { gridcolor: "#1e2330", ticksuffix: " €" },
              legend: { font: { size: 10 }, bgcolor: "transparent" },
              showlegend: true,
            };
            const plotConfig = { displayModeBar: false, responsive: true };

            return (
              <div>
                {/* KPI summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  {[
                    { label: "Total investi", val: `${totalInvested.toLocaleString("fr-FR")} €`, color: GOLD },
                    { label: "Valeur estimée", val: `${totalMarket.toLocaleString("fr-FR")} €`, color: totalMarket > totalInvested ? GREEN : RED },
                    { label: "Performance", val: `${perfPct > 0 ? "+" : ""}${perfPct.toFixed(1)}%`, color: perfPct >= 0 ? GREEN : RED },
                    { label: "Nb mois de DCA", val: `${months.length} mois`, color: "var(--text-primary)" },
                    { label: "Instruments", val: `${instruments.length}`, color: "var(--text-primary)" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="metric-card">
                      <div className="metric-label">{label}</div>
                      <div className="metric-value" style={{ color, fontSize: "1rem" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Charts grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

                  {/* Chart 1: Performance vs investi */}
                  <div className="card" style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: GOLD, marginBottom: "0.5rem" }}>
                      Performance vs Montant investi
                      {!peaHistPrices && <span style={{ color: "#8892a4", fontWeight: 400, fontSize: "0.7rem", marginLeft: "0.5rem" }}>(prix d'achat en attendant les données marché…)</span>}
                    </div>
                    <Plot
                      data={[
                        {
                          name: "Montant investi cumulé",
                          x: monthLabels, y: cumulInvestedArr,
                          type: "scatter", mode: "lines",
                          line: { color: GOLD, width: 2, dash: "dot" },
                          fill: "none",
                        },
                        {
                          name: "Valeur portefeuille estimée",
                          x: monthLabels, y: marketValueArr,
                          type: "scatter", mode: "lines",
                          line: { color: GREEN, width: 2.5 },
                          fill: "tonexty",
                          fillcolor: "rgba(61,158,110,0.08)",
                        },
                      ]}
                      layout={{ ...plotLayout, height: 260, showlegend: true }}
                      config={plotConfig}
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Chart 2: Montant investi par mois */}
                  <div className="card">
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: GOLD, marginBottom: "0.5rem" }}>Montant investi par mois</div>
                    <Plot
                      data={[{
                        x: monthLabels, y: monthlyAmounts,
                        type: "bar",
                        marker: { color: GOLD, opacity: 0.8 },
                        name: "Investi ce mois",
                      }]}
                      layout={{ ...plotLayout, height: 220, showlegend: false }}
                      config={plotConfig}
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Chart 3: Allocation actuelle */}
                  <div className="card">
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: GOLD, marginBottom: "0.5rem" }}>Allocation actuelle (montant investi)</div>
                    <Plot
                      data={[{
                        labels: pieLabels, values: pieValues,
                        type: "pie",
                        hole: 0.45,
                        textinfo: "label+percent",
                        textfont: { size: 10 },
                        marker: { colors: ["#c9a84c","#3d9e6e","#4a7fc1","#d4834a","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#6366f1","#84cc16","#f43f5e","#0ea5e9"] },
                      }]}
                      layout={{ ...plotLayout, height: 220, showlegend: false, margin: { t: 10, r: 10, l: 10, b: 10 } }}
                      config={plotConfig}
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Chart 4: Évolution stacked area */}
                  {stackTraces.length > 0 && (
                    <div className="card" style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: GOLD, marginBottom: "0.5rem" }}>Évolution de la valeur par instrument</div>
                      <Plot
                        data={stackTraces}
                        layout={{ ...plotLayout, height: 280 }}
                        config={plotConfig}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                </div>

                {/* Table récap par instrument */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="trading-table">
                    <thead>
                      <tr>
                        <th>Instrument</th>
                        <th>Ticker</th>
                        <th>Qty totale</th>
                        <th>Total investi</th>
                        <th>PRU moyen</th>
                        <th>Valeur estimée</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instruments.map(inst => {
                        const cur = peaData.current[inst.name];
                        if (!cur) return null;
                        const lastKey = monthKeys[monthKeys.length - 1];
                        const lastPrice = peaHistPrices?.[inst.name]?.[lastKey]
                          ?? (lastMonth.instruments[inst.name]?.prix ?? null);
                        const val = lastPrice && cur.qty_total ? cur.qty_total * lastPrice : null;
                        const pnl = val != null ? val - cur.total_cumule : null;
                        const pnlPct = pnl != null && cur.total_cumule > 0 ? pnl / cur.total_cumule * 100 : null;
                        const pru = cur.qty_total > 0 ? cur.total_cumule / cur.qty_total : null;
                        return (
                          <tr key={inst.name}>
                            <td style={{ fontWeight: 600 }}>{inst.name}</td>
                            <td style={{ color: "#8892a4", fontSize: "0.72rem" }}>{inst.ticker || "—"}</td>
                            <td>{cur.qty_total}</td>
                            <td>{cur.total_cumule.toFixed(2)} €</td>
                            <td>{pru ? `${pru.toFixed(2)} €` : "—"}</td>
                            <td>{val ? `${val.toFixed(2)} €` : "—"}</td>
                            <td style={{ color: pnl == null ? "var(--text-muted)" : pnl >= 0 ? GREEN : RED, fontWeight: 600 }}>
                              {pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} € (${pnlPct?.toFixed(1)}%)` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Legal disclaimer */}
        <p style={{ fontSize: "0.68rem", color: "#4a5060", textAlign: "center", marginTop: "3rem" }}>
          Les informations fournies sont à titre informatif uniquement et ne constituent pas un conseil en investissement.
          Investir comporte des risques de perte en capital.
        </p>
      </div>
    </div>
  );
}
