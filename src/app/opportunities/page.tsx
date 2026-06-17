"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { OpportunityScore, OHLCVData, NewsItem } from "@/lib/types";
import { analyzeOpportunities, getOpportunityScores, getMarketHistory, getOpportunityNews, getAIAdvice, getAITickerAnalysis } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";

// Toutes les grandes caps éligibles PEA (UE/EEE) par indice
const SECTORS: Record<string, string[]> = {
  // ── FRANCE ───────────────────────────────────────────────────────────────
  "CAC 40": [
    "AC.PA","AI.PA","AIR.PA","AXA.PA","BNP.PA","BN.PA","BVI.PA","CA.PA","CAP.PA",
    "ACA.PA","DG.PA","DSY.PA","EDEN.PA","EL.PA","ENGI.PA","ERF.PA","GLE.PA",
    "HO.PA","KER.PA","LR.PA","MC.PA","ML.PA","MT.AS","OR.PA","ORA.PA","PUB.PA",
    "RI.PA","RMS.PA","RNO.PA","SAF.PA","SAN.PA","SGO.PA","SU.PA","STLAM.PA",
    "STM.PA","TEP.PA","HO.PA","TTE.PA","URW.PA","VIE.PA","EN.PA","VIV.PA",
  ],
  "CAC Next 20": [
    "AF.PA","AKE.PA","BIM.PA","FGR.PA","ENX.PA","GET.PA","LI.PA","RCO.PA",
    "RXL.PA","DIM.PA","SW.PA","SOI.PA","UBI.PA","FR.PA","GFC.PA",
  ],
  "SBF 120 (autres)": [
    "ADP.PA","ALO.PA","ALTEN.PA","AM.PA","ALTAREA.PA","BOL.PA","BON.PA",
    "CBU.PA","COV.PA","ERAMET.PA","FNAC.PA","GENFIT.PA","GTT.PA","ICAD.PA",
    "ILD.PA","IPH.PA","LAGR.PA","M6.PA","NK.PA","OVH.PA","SEB.PA",
    "TEC.PA","TF1.PA","VK.PA","WLN.PA","FRVIA.PA","STMPA.PA",
  ],
  // ── ALLEMAGNE (DAX 40) ───────────────────────────────────────────────────
  "DAX 40": [
    "ADS.DE","ALV.DE","BAS.DE","BAYN.DE","BEI.DE","BMW.DE","BNR.DE","CBK.DE",
    "CON.DE","DBK.DE","DB1.DE","DHL.DE","DTG.DE","DTE.DE","EOAN.DE","FME.DE",
    "FRE.DE","G1A.DE","HEI.DE","HEN3.DE","HNR1.DE","IFX.DE","MBG.DE","MRK.DE",
    "MTX.DE","MUV2.DE","PAH3.DE","QIA.DE","RHM.DE","RWE.DE","SAP.DE","SHL.DE",
    "SIE.DE","ENR.DE","SY1.DE","VNA.DE","VOW3.DE","ZAL.DE","G24.DE",
  ],
  // ── PAYS-BAS (AEX) ───────────────────────────────────────────────────────
  "AEX (Pays-Bas)": [
    "ABN.AS","ADYEN.AS","AGN.AS","AD.AS","AKZA.AS","ASM.AS","ASML.AS","ASRNL.AS",
    "BESI.AS","DSFIR.AS","EXO.AS","HEIA.AS","IMCD.AS","INGA.AS","KPN.AS",
    "MT.AS","NN.AS","PHIA.AS","PRX.AS","RAND.AS","UMG.AS","WKL.AS",
  ],
  // ── BELGIQUE (BEL 20) ────────────────────────────────────────────────────
  "BEL 20 (Belgique)": [
    "ABI.BR","ACKB.BR","AED.BR","AGS.BR","ARGX.BR","APAM.BR","AZE.BR",
    "DIE.BR","ELI.BR","GBLB.BR","KBC.BR","LOTB.BR","MELE.BR","MONT.BR",
    "SOF.BR","SOLB.BR","UCB.BR","UMI.BR","WDP.BR","SYENS.BR",
  ],
  // ── ITALIE (FTSE MIB) ────────────────────────────────────────────────────
  "FTSE MIB (Italie)": [
    "A2A.MI","AMP.MI","AZM.MI","BAMI.MI","BMPS.MI","BPE.MI","BC.MI","BZU.MI",
    "CPR.MI","DIA.MI","ENEL.MI","ENI.MI","RACE.MI","FBK.MI","G.MI","HER.MI",
    "ISP.MI","INW.MI","IG.MI","LDO.MI","MB.MI","MONC.MI","NEXI.MI","PST.MI",
    "PRY.MI","REC.MI","SPM.MI","SRG.MI","TEN.MI","TIT.MI","TRN.MI","UCG.MI","UNI.MI",
  ],
  // ── ESPAGNE (IBEX 35) ────────────────────────────────────────────────────
  "IBEX 35 (Espagne)": [
    "ACS.MC","ACX.MC","AENA.MC","AMS.MC","ANA.MC","ANE.MC","BBVA.MC","BKT.MC",
    "CABK.MC","CLNX.MC","ELE.MC","ENG.MC","FDR.MC","FER.MC","GRF.MC","IAG.MC",
    "IBE.MC","IDR.MC","ITX.MC","LOG.MC","MAP.MC","MRL.MC","MTS.MC","NTGY.MC",
    "PUIG.MC","RED.MC","REP.MC","ROVI.MC","SAB.MC","SAN.MC","SCYR.MC","TEF.MC",
  ],
  // ── SUÈDE (OMX Stockholm 30) ─────────────────────────────────────────────
  "OMX Stockholm 30 (Suède)": [
    "ALFA.ST","ASSA-B.ST","ATCO-A.ST","BOL.ST","EPI-A.ST","EQT.ST","ERIC-B.ST",
    "ESSITY-B.ST","EVO.ST","SHB-A.ST","HM-B.ST","HEXA-B.ST","INDU-C.ST",
    "INVE-B.ST","LIFCO-B.ST","NIBE-B.ST","NDA-SE.ST","SAAB-B.ST","SAND.ST",
    "SCA-B.ST","SEB-A.ST","SKA-B.ST","SKF-B.ST","SWED-A.ST","TEL2-B.ST",
    "TELIA.ST","VOLV-B.ST",
  ],
  // ── DANEMARK (OMX Copenhagen 25) ─────────────────────────────────────────
  "OMX Copenhagen 25 (Danemark)": [
    "MAERSK-A.CO","MAERSK-B.CO","AMBU-B.CO","CARL-B.CO","COLO-B.CO","DANSKE.CO",
    "DEMANT.CO","DSV.CO","GMAB.CO","GN.CO","ISS.CO","NDA-DK.CO","NKT.CO",
    "NOVO-B.CO","NSIS-B.CO","ORSTED.CO","PNDORA.CO","RBREW.CO","ROCK-B.CO",
    "TRYG.CO","VWS.CO","ZEAL.CO",
  ],
  // ── FINLANDE (OMX Helsinki 25) ───────────────────────────────────────────
  "OMX Helsinki 25 (Finlande)": [
    "ELISA.HE","FORTUM.HE","HUH1V.HE","KEMIRA.HE","KESKOB.HE","KNEBV.HE",
    "KCR.HE","METSO.HE","NESTE.HE","NOKIA.HE","NDA-FI.HE","ORNBV.HE",
    "OUT1V.HE","QTCOM.HE","SAMPO.HE","STERV.HE","TIETO.HE","UPM.HE",
    "VALMT.HE","WRT1V.HE",
  ],
  // ── PORTUGAL (PSI 20) ────────────────────────────────────────────────────
  "PSI 20 (Portugal)": [
    "ALTR.LS","BCP.LS","COR.LS","CTT.LS","EDP.LS","EDPR.LS","GALP.LS",
    "JMT.LS","NOS.LS","RENE.LS","SEM.LS","SON.LS","NVG.LS",
  ],
  // ── AUTRICHE (ATX) ───────────────────────────────────────────────────────
  "ATX (Autriche)": [
    "ANDR.VI","ATS.VI","EBS.VI","EVN.VI","LNZ.VI","OMV.VI","OPT.VI",
    "PAL.VI","RBI.VI","SBO.VI","STR.VI","UQA.VI","VER.VI","VIG.VI","VOE.VI","WIE.VI",
  ],
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

function ProgressPanel({ progress }: { progress: { current: number; total: number; ticker: string; startedAt: number } }) {
  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const elapsed = progress.startedAt ? (Date.now() - progress.startedAt) / 1000 : 0;
  const rate = progress.current > 0 ? elapsed / progress.current : 0;
  const remaining = rate > 0 ? Math.round(rate * (progress.total - progress.current)) : null;
  const etaStr = remaining == null ? "—"
    : remaining > 60 ? `~${Math.ceil(remaining / 60)} min`
    : `~${remaining}s`;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "1.25rem 1.5rem",
      marginBottom: "1.5rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.6rem" }}>
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.2rem" }}>
            Analyse en cours…
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {progress.ticker ? `→ ${progress.ticker}` : "Démarrage…"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: GOLD, lineHeight: 1 }}>
            {Math.round(pct)}%
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
            {progress.current}/{progress.total} tickers
          </div>
        </div>
      </div>

      {/* Barre principale */}
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 10, overflow: "hidden", marginBottom: "0.6rem" }}>
        <div style={{
          background: `linear-gradient(90deg, ${GOLD}, #e8c97a)`,
          height: "100%",
          width: `${pct}%`,
          transition: "width 0.4s ease",
          borderRadius: 4,
          boxShadow: `0 0 8px rgba(201,168,76,0.5)`,
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)" }}>
        <span>Temps écoulé : {Math.round(elapsed)}s</span>
        <span>Temps restant estimé : {etaStr}</span>
      </div>
    </div>
  );
}

interface TickerDetail {
  ticker: string;
  chartData: OHLCVData | null;
  news: NewsItem[];
  aiAnalysis: any | null;
  aiLoading: boolean;
  open: boolean;
}

export default function OpportunitiesPage() {
  const allSectorNames = Object.keys(SECTORS);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(["CAC 40"]);
  const [extraTickers, setExtraTickers] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [results, setResults] = useState<OpportunityScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, ticker: "", startedAt: 0 });
  const [errors, setErrors] = useState<Array<{ ticker: string; error: string }>>([]);
  const [details, setDetails] = useState<Record<string, TickerDetail>>({});
  const [loadingCached, setLoadingCached] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
    const startedAt = Date.now();
    setProgress({ current: 0, total: tickers.length, ticker: "", startedAt });

    // Envoyer par lots de 3
    const allResults: OpportunityScore[] = [];
    for (let i = 0; i < tickers.length; i += 3) {
      const batch = tickers.slice(i, i + 3);
      setProgress({ current: i, total: tickers.length, ticker: batch.join(", "), startedAt });
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
    setProgress((p) => ({ ...p, current: tickers.length, ticker: "" }));
    setLoading(false);

    // Lancer l'analyse IA automatiquement
    if (allResults.length > 0) {
      setAiLoading(true);
      setAiAdvice(null);
      try {
        const advice = await getAIAdvice(allResults);
        setAiAdvice(advice);
      } catch {}
      setAiLoading(false);
    }
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
    // Init avec loading AI
    setDetails((prev) => ({
      ...prev,
      [key]: { ticker: key, chartData: null, news: [], aiAnalysis: null, aiLoading: true, open: true },
    }));
    // Charger chart, news et analyse IA en parallèle
    const [chartData, news, aiAnalysis] = await Promise.allSettled([
      getMarketHistory(key, "6mo"),
      getOpportunityNews(key),
      getAITickerAnalysis(opp),
    ]);
    setDetails((prev) => ({
      ...prev,
      [key]: {
        ticker: key,
        chartData: chartData.status === "fulfilled" ? (chartData.value as OHLCVData) : null,
        news: news.status === "fulfilled" ? (news.value as NewsItem[]) : [],
        aiAnalysis: aiAnalysis.status === "fulfilled" ? aiAnalysis.value : null,
        aiLoading: false,
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

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Indices / Secteurs
          </div>
          <button
            onClick={() => setSelectedSectors(
              selectedSectors.length === allSectorNames.length ? [] : allSectorNames
            )}
            style={{
              fontSize: "0.62rem", background: "none", border: "1px solid var(--border)",
              borderRadius: 3, padding: "0.15rem 0.4rem", cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            {selectedSectors.length === allSectorNames.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem" }}>
          {allSectorNames.map((s) => (
            <label
              key={s}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                cursor: "pointer", fontSize: "0.75rem", color: "var(--text-secondary)",
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
        {loading && <ProgressPanel progress={progress} />}

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

            {/* AI Advisor */}
            {(aiLoading || aiAdvice) && (
              <div style={{
                background: "linear-gradient(135deg, rgba(201,168,76,0.07), rgba(201,168,76,0.03))",
                border: "1px solid rgba(201,168,76,0.35)",
                borderRadius: 8,
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "1.2rem" }}>🤖</span>
                  <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.04em" }}>
                    Conseiller IA — Groq / Llama 3.3
                  </span>
                  {aiLoading && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                      Analyse en cours…
                    </span>
                  )}
                </div>

                {aiLoading && (
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: "50%", background: GOLD,
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        opacity: 0.7,
                      }} />
                    ))}
                  </div>
                )}

                {aiAdvice && !aiLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Synthèse */}
                    {aiAdvice.synthese && (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                        {aiAdvice.synthese}
                      </p>
                    )}

                    {/* Top achats */}
                    {aiAdvice.top_achats?.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                          Meilleures opportunités
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {aiAdvice.top_achats.map((item: any) => (
                            <div key={item.ticker} style={{
                              background: "rgba(61,158,110,0.1)",
                              border: "1px solid rgba(61,158,110,0.3)",
                              borderRadius: 4,
                              padding: "0.4rem 0.75rem",
                              fontSize: "0.78rem",
                            }}>
                              <span style={{ color: GOLD, fontWeight: 700 }}>{item.ticker}</span>
                              <span style={{
                                marginLeft: "0.4rem", fontSize: "0.65rem",
                                color: item.conviction === "haute" ? GREEN : item.conviction === "moyenne" ? ORANGE : "var(--text-muted)",
                                fontWeight: 600, textTransform: "uppercase",
                              }}>
                                {item.conviction}
                              </span>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                                {item.raison}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      {/* Secteurs favoris */}
                      {aiAdvice.secteurs_favoris?.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                            Secteurs favoris
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {aiAdvice.secteurs_favoris.map((s: string) => (
                              <span key={s} style={{
                                background: "rgba(201,168,76,0.12)",
                                border: "1px solid rgba(201,168,76,0.25)",
                                borderRadius: 3, padding: "0.2rem 0.5rem",
                                fontSize: "0.72rem", color: GOLD,
                              }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Risques */}
                      {aiAdvice.risques && (
                        <div>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                            Risques
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                            {aiAdvice.risques}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Stratégie */}
                    {aiAdvice.strategie_recommandee && (
                      <div style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 4,
                        padding: "0.75rem 1rem",
                        borderLeft: `3px solid ${GOLD}`,
                      }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                          Stratégie recommandée
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>
                          {aiAdvice.strategie_recommandee}
                        </p>
                      </div>
                    )}

                    <p style={{ fontSize: "0.62rem", color: "var(--text-muted)", margin: 0 }}>
                      ⚠ Ces conseils sont générés par IA et ne constituent pas un conseil en investissement réglementé.
                    </p>
                  </div>
                )}
              </div>
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
                    <th title="Score technique (tendance, momentum, supports)">Tendance</th>
                    <th title="Score fondamental (qualité de l'entreprise, valorisation)">Qualité</th>
                    <th title="Signal DCA : opportunité d'accumulation">DCA</th>
                    <th title="Sentiment news et marché">Marché</th>
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
                          <td>
                            {opp.dca_opportunity != null ? (
                              <span style={{
                                fontSize: "0.68rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                                background: opp.dca_opportunity >= 0.5 ? "rgba(61,158,110,0.2)" : opp.dca_opportunity <= -0.2 ? "rgba(200,72,72,0.15)" : "rgba(255,255,255,0.06)",
                                color: opp.dca_opportunity >= 0.5 ? GREEN : opp.dca_opportunity <= -0.2 ? RED : "var(--text-muted)",
                              }}>
                                {opp.dca_opportunity >= 0.7 ? "Fort" : opp.dca_opportunity >= 0.5 ? "Bon" : opp.dca_opportunity >= 0.2 ? "OK" : opp.dca_opportunity <= -0.2 ? "Piège" : "—"}
                              </span>
                            ) : "—"}
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
                            <td colSpan={12} style={{ padding: "1rem", background: "rgba(201,168,76,0.04)", borderTop: "1px solid var(--border)" }}>
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
                              {/* Métriques de risque */}
                              {((opp as any).volatility_annual != null || (opp as any).max_drawdown != null) && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                                  {[
                                    { label: "Volatilité/an", val: `${(opp as any).volatility_annual}%`, warn: (opp as any).volatility_annual > 30 },
                                    { label: "Max drawdown", val: `${(opp as any).max_drawdown}%`, warn: true },
                                    { label: "Sharpe ratio", val: `${(opp as any).sharpe_ratio ?? "—"}`, warn: false },
                                    { label: "Niveau risque", val: (opp as any).risk_level || "—", warn: ["élevé","très élevé"].includes((opp as any).risk_level) },
                                  ].map(({ label, val, warn }) => (
                                    <div key={label} className="metric-card">
                                      <div className="metric-label">{label}</div>
                                      <div className="metric-value" style={{ color: warn ? RED : "var(--text-primary)", fontSize: "0.85rem" }}>{val}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {opp.justification && (
                                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                                  <span style={{ color: "var(--text-muted)" }}>Justification</span> — {opp.justification}
                                </p>
                              )}

                              {/* Analyse IA Groq */}
                              {(det.aiLoading || det.aiAnalysis) && (
                                <div style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 6, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                                    <span>🤖</span>
                                    <span style={{ color: GOLD, fontWeight: 600, fontSize: "0.8rem" }}>Analyse IA approfondie — Groq / Llama 3.3</span>
                                    {det.aiLoading && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginLeft: "auto" }}>Chargement…</span>}
                                  </div>
                                  {det.aiLoading && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Analyse en cours (~3s)…</div>}
                                  {det.aiAnalysis && !det.aiLoading && (() => {
                                    const ai = det.aiAnalysis;
                                    if (ai.error) return <p style={{ color: RED, fontSize: "0.75rem" }}>Erreur : {ai.error}</p>;
                                    const hColor = (o: string) => o === "haussier" ? GREEN : o === "baissier" ? RED : ORANGE;
                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                                        {ai.synthese && <p style={{ fontSize: "0.8rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{ai.synthese}</p>}

                                        {/* Horizons */}
                                        {ai.horizons && (
                                          <div>
                                            <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Horizons temporels</div>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
                                              {Object.entries(ai.horizons).map(([h, d]: [string, any]) => (
                                                <div key={h} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "0.5rem 0.6rem", borderTop: `2px solid ${hColor(d.outlook)}` }}>
                                                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>{h.replace("an","").replace("ans","")+" an"+(h.includes("ans")?"s":"")}</div>
                                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: hColor(d.outlook) }}>{d.outlook}</div>
                                                  <div style={{ fontSize: "0.68rem", color: GOLD }}>{d.potentiel}</div>
                                                  <div style={{ fontSize: "0.63rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{d.catalyseurs}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Profils */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                          {ai.profil_dca && (
                                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "0.6rem", borderLeft: `3px solid ${ai.profil_dca.adapte ? GREEN : "var(--border)"}` }}>
                                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: ai.profil_dca.adapte ? GREEN : "var(--text-muted)" }}>{ai.profil_dca.adapte ? "✓" : "✗"} DCA</span>
                                                <span style={{ fontSize: "0.68rem", color: GOLD }}>{ai.profil_dca.score_dca}/10</span>
                                              </div>
                                              {ai.profil_dca.zone_accumulation && <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Zone : <span style={{ color: GOLD }}>{ai.profil_dca.zone_accumulation}</span></div>}
                                              {ai.profil_dca.frequence_recommandee && <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Fréquence : {ai.profil_dca.frequence_recommandee}</div>}
                                              <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", margin: 0 }}>{ai.profil_dca.raison}</p>
                                            </div>
                                          )}
                                          {ai.profil_swing && (
                                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "0.6rem", borderLeft: `3px solid ${ai.profil_swing.adapte ? ORANGE : "var(--border)"}` }}>
                                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: ai.profil_swing.adapte ? ORANGE : "var(--text-muted)" }}>{ai.profil_swing.adapte ? "✓" : "✗"} Swing / Gros coup</span>
                                                <span style={{ fontSize: "0.68rem", color: GOLD }}>{ai.profil_swing.score_swing}/10</span>
                                              </div>
                                              {ai.profil_swing.entree_ideale && <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Entrée : {ai.profil_swing.entree_ideale}</div>}
                                              {ai.profil_swing.ratio_risque_rendement && <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>R/R : <span style={{ color: GOLD }}>{ai.profil_swing.ratio_risque_rendement}</span></div>}
                                              <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", margin: 0 }}>{ai.profil_swing.raison}</p>
                                            </div>
                                          )}
                                        </div>

                                        {/* Risques & Catalyseurs */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                          {ai.risques_principaux?.length > 0 && (
                                            <div>
                                              <div style={{ fontSize: "0.63rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: "0.25rem" }}>⚠ Risques</div>
                                              {ai.risques_principaux.map((r: string, i: number) => <div key={i} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: "0.1rem" }}>• {r}</div>)}
                                            </div>
                                          )}
                                          {ai.catalyseurs_positifs?.length > 0 && (
                                            <div>
                                              <div style={{ fontSize: "0.63rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: GREEN, marginBottom: "0.25rem" }}>▲ Catalyseurs</div>
                                              {ai.catalyseurs_positifs.map((c: string, i: number) => <div key={i} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: "0.1rem" }}>• {c}</div>)}
                                            </div>
                                          )}
                                        </div>

                                        {ai.verdict_final && (
                                          <div style={{ background: "rgba(201,168,76,0.08)", borderRadius: 4, padding: "0.7rem 1rem", borderLeft: `3px solid ${GOLD}` }}>
                                            <p style={{ fontSize: "0.78rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{ai.verdict_final}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
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

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                        {[
                          { label: "Tendance", val: opp.technical_score },
                          { label: "Qualité", val: opp.fundamental_score },
                          { label: "Signal DCA", val: opp.dca_opportunity },
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

                              {/* Métriques de risque */}
                              {((opp as any).volatility_annual != null || (opp as any).max_drawdown != null) && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                                  {[
                                    { label: "Volatilité/an", val: (opp as any).volatility_annual != null ? `${(opp as any).volatility_annual}%` : "—", warn: (opp as any).volatility_annual > 30 },
                                    { label: "Max drawdown", val: (opp as any).max_drawdown != null ? `${(opp as any).max_drawdown}%` : "—", warn: true },
                                    { label: "Sharpe ratio", val: (opp as any).sharpe_ratio != null ? `${(opp as any).sharpe_ratio}` : "—", warn: false },
                                    { label: "Niveau risque", val: (opp as any).risk_level || "—", warn: ["élevé","très élevé"].includes((opp as any).risk_level) },
                                  ].map(({ label, val, warn }) => (
                                    <div key={label} className="metric-card">
                                      <div className="metric-label">{label}</div>
                                      <div className="metric-value" style={{ color: warn ? RED : "var(--text-primary)", fontSize: "0.85rem" }}>{val}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>Justification</span> — {opp.justification}
                              </p>

                              {/* Analyse IA */}
                              {(det.aiLoading || det.aiAnalysis) && (
                                <div style={{
                                  background: "rgba(201,168,76,0.05)",
                                  border: "1px solid rgba(201,168,76,0.25)",
                                  borderRadius: 6,
                                  padding: "1rem 1.25rem",
                                  marginBottom: "1rem",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    <span>🤖</span>
                                    <span style={{ color: GOLD, fontWeight: 600, fontSize: "0.8rem" }}>Analyse IA approfondie</span>
                                    {det.aiLoading && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginLeft: "auto" }}>Chargement…</span>}
                                  </div>

                                  {det.aiLoading && (
                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                      {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, opacity: 0.6 }} />)}
                                    </div>
                                  )}

                                  {det.aiAnalysis && !det.aiLoading && (() => {
                                    const ai = det.aiAnalysis;
                                    const horizonColor = (o: string) => o === "haussier" ? GREEN : o === "baissier" ? RED : ORANGE;
                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                                        {ai.synthese && <p style={{ fontSize: "0.8rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{ai.synthese}</p>}

                                        {/* Horizons temporels */}
                                        {ai.horizons && (
                                          <div>
                                            <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Horizons temporels</div>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
                                              {Object.entries(ai.horizons).map(([horizon, data]: [string, any]) => (
                                                <div key={horizon} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "0.5rem 0.6rem", borderTop: `2px solid ${horizonColor(data.outlook)}` }}>
                                                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.2rem" }}>{horizon.replace("an", " an").replace("ans", " ans")}</div>
                                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: horizonColor(data.outlook), marginBottom: "0.2rem" }}>{data.outlook}</div>
                                                  <div style={{ fontSize: "0.68rem", color: GOLD }}>{data.potentiel}</div>
                                                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{data.catalyseurs}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Profils investisseurs */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                          {ai.profil_dca && (
                                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "0.75rem", borderLeft: `3px solid ${ai.profil_dca.adapte ? GREEN : "var(--border)"}` }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: ai.profil_dca.adapte ? GREEN : "var(--text-muted)" }}>
                                                  {ai.profil_dca.adapte ? "✓" : "✗"} Investisseur DCA
                                                </span>
                                                <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: GOLD }}>{ai.profil_dca.score_dca}/10</span>
                                              </div>
                                              {ai.profil_dca.frequence_recommandee && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Fréquence : <span style={{ color: "var(--text-secondary)" }}>{ai.profil_dca.frequence_recommandee}</span></div>}
                                              {ai.profil_dca.zone_accumulation && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>Zone : <span style={{ color: GOLD }}>{ai.profil_dca.zone_accumulation}</span></div>}
                                              <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", margin: 0 }}>{ai.profil_dca.raison}</p>
                                            </div>
                                          )}
                                          {ai.profil_swing && (
                                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "0.75rem", borderLeft: `3px solid ${ai.profil_swing.adapte ? ORANGE : "var(--border)"}` }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: ai.profil_swing.adapte ? ORANGE : "var(--text-muted)" }}>
                                                  {ai.profil_swing.adapte ? "✓" : "✗"} Gros coup / Swing
                                                </span>
                                                <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: GOLD }}>{ai.profil_swing.score_swing}/10</span>
                                              </div>
                                              {ai.profil_swing.entree_ideale && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Entrée : <span style={{ color: "var(--text-secondary)" }}>{ai.profil_swing.entree_ideale}</span></div>}
                                              {ai.profil_swing.ratio_risque_rendement && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>R/R : <span style={{ color: GOLD }}>{ai.profil_swing.ratio_risque_rendement}</span></div>}
                                              <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", margin: 0 }}>{ai.profil_swing.raison}</p>
                                            </div>
                                          )}
                                        </div>

                                        {/* Risques & catalyseurs */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                          {ai.risques_principaux?.length > 0 && (
                                            <div>
                                              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: "0.3rem" }}>Risques</div>
                                              {ai.risques_principaux.map((r: string, i: number) => (
                                                <div key={i} style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.15rem" }}>• {r}</div>
                                              ))}
                                            </div>
                                          )}
                                          {ai.catalyseurs_positifs?.length > 0 && (
                                            <div>
                                              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: GREEN, marginBottom: "0.3rem" }}>Catalyseurs</div>
                                              {ai.catalyseurs_positifs.map((c: string, i: number) => (
                                                <div key={i} style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.15rem" }}>• {c}</div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {ai.verdict_final && (
                                          <div style={{ background: "rgba(201,168,76,0.08)", borderRadius: 4, padding: "0.75rem 1rem", borderLeft: `3px solid ${GOLD}` }}>
                                            <p style={{ fontSize: "0.78rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{ai.verdict_final}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
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
