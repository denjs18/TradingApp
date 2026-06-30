"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { OpportunityScore, OHLCVData, NewsItem } from "@/lib/types";
import { analyzeOpportunities, getOpportunityScores, getMarketHistory, getOpportunityNews, getAITickerAnalysis, getDCAPositions } from "@/lib/api";

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
  // ── SECTEURS ÉCONOMIQUES ─────────────────────────────────────────────────
  "💻 Technologie & Logiciels": [
    "SAP.DE","CAP.PA","DSY.PA","ORA.PA","PUB.PA","ALTEN.PA",
    "ADYEN.AS","PRX.AS","ASML.AS","ASM.AS","BESI.AS","IFX.DE","STM.PA","NOKIA.HE",
    "ERIC-B.ST","UBI.PA","OVH.PA","ENX.PA",
  ],
  "🔬 Santé & Pharmacie": [
    "SAN.PA","OR.PA","SHL.DE","FME.DE","MRK.DE","BAYN.DE",
    "NOVO-B.CO","GMAB.CO","DEMANT.CO","UCB.BR","ARGX.BR","SOLB.BR","GN.CO",
    "ROVI.MC","GRF.MC","AZM.MI","MONC.MI",
    "ALNA.PA","GENFIT.PA","ICAD.PA","IPH.PA",
  ],
  "🏦 Finance & Assurance": [
    "BNP.PA","ACA.PA","GLE.PA","AXA.PA","ML.PA","BN.PA",
    "DBK.DE","CBK.DE","ALV.DE","MUV2.DE",
    "ABN.AS","INGA.AS","ASRNL.AS","NN.AS",
    "ABI.BR","KBC.BR","GBLB.BR",
    "BBVA.MC","SAN.MC","CABK.MC","MAP.MC",
    "ISP.MI","UCG.MI","MB.MI",
    "NDA-SE.ST","SEB-A.ST","SWED-A.ST","SHB-A.ST",
    "DANSKE.CO",
  ],
  "⚡ Énergie & Utilities": [
    "TTE.PA","ENGI.PA","SU.PA","EDF.PA","EDEN.PA",
    "RWE.DE","EON.DE","ENR.DE",
    "ENEL.MI","ENI.MI","SRG.MI","ERG.MI",
    "IBE.MC","ELE.MC","ENG.MC","NTGY.MC","RED.MC","REP.MC",
    "ORSTED.CO","VWS.CO","NESTE.HE","FORTUM.HE",
    "EDP.LS","EDPR.LS","GALP.LS","RENE.LS",
  ],
  "✈️ Défense & Aérospatiale": [
    "AIR.PA","SAF.PA","TEC.PA","HO.PA",
    "RHM.DE","HEI.DE","MTX.DE",
    "SAAB-B.ST",
    "LDO.MI",
    "IAG.MC","ANA.MC",
  ],
  "💎 Luxe & Consommation": [
    "MC.PA","KER.PA","RMS.PA","EL.PA","RI.PA","AC.PA","PUB.PA","DG.PA","ML.PA",
    "ADS.DE","PUM.DE",
    "MONC.MI","BC.MI",
    "ITX.MC","PUIG.MC",
  ],
  "🚗 Automobile": [
    "RNO.PA","STLAM.PA","ML.PA",
    "MBG.DE","BMW.DE","VOW3.DE","CON.DE","PAH3.DE",
  ],
  "🏗️ Industrie & Matériaux": [
    "AI.PA","SGO.PA","LR.PA","ERAMET.PA","MT.AS",
    "BAS.DE","SIE.DE","DHL.DE","HNR1.DE","QIA.DE",
    "AKE.PA","SOLB.BR","UMI.BR",
    "MTS.MC","FER.MC",
    "TEN.MI","PRY.MI",
    "ALFA.ST","SAND.ST","VOLV-B.ST","SKF-B.ST","SKA-B.ST",
    "NKT.CO","ROCK-B.CO",
    "VNA.DE","URW.PA","WDP.BR",
  ],
  "📡 Télécom & Médias": [
    "ORA.PA","VIV.PA","BVI.PA","TF1.PA","M6.PA",
    "DTE.DE","DTG.DE",
    "KPN.AS","UMG.AS",
    "TEF.MC","NOS.LS",
    "TELIA.ST","TEL2-B.ST",
    "NOKIA.HE","ELISA.HE",
    "TIT.MI",
  ],
  // ── THÉMATIQUES TENDANCE ─────────────────────────────────────────────────
  "🤖 IA & Semiconducteurs": [
    "ASML.AS","ASM.AS","BESI.AS","IFX.DE","STM.PA",
    "SAP.DE","CAP.PA","ALTEN.PA","DSY.PA",
    "NOKIA.HE","ERIC-B.ST",
  ],
  "🌱 Transition énergétique": [
    "ENGI.PA","SU.PA","TTE.PA","GTT.PA",
    "RWE.DE","ENR.DE",
    "ORSTED.CO","VWS.CO","NESTE.HE","FORTUM.HE",
    "EDPR.LS","RENE.LS","EDP.LS",
    "IBE.MC","ELE.MC","RED.MC",
    "ENEL.MI",
    "NIBE-B.ST",
  ],
  "🔐 Cybersécurité": [
    "CAP.PA","ALTEN.PA","OVH.PA",
    "SAP.DE",
    "DSY.PA",
  ],
  "💊 Biotech & MedTech": [
    "GENFIT.PA","ICAD.PA","IPH.PA","ALNA.PA",
    "GMAB.CO","AMBU-B.CO",
    "ARGX.BR","UCB.BR",
    "GN.CO","DEMANT.CO",
    "ROVI.MC","GRF.MC",
  ],
  "🛸 Spatial & Drones": [
    "AIR.PA","SAF.PA","TEC.PA","HO.PA",
    "RHM.DE",
    "SAAB-B.ST",
    "LDO.MI",
  ],
  "🏠 Immobilier coté (SIIC/REIT)": [
    "URW.PA","COV.PA","ALTAREA.PA","LI.PA","LAGR.PA","WLN.PA",
    "VNA.DE",
    "WDP.BR",
  ],
  "📈 ETFs PEA accessibles": [
    "PUST.PA","LCWL.PA","ISPY.PA","AERO.PA","PAEEM.PA",
    "CW8.PA","AWLD.PA","PCEU.PA","C40.PA",
    "LYPS.DE","XDWD.DE","DBXD.DE",
  ],
  // ── ACTUALITÉ DU MOMENT (juin 2026) ──────────────────────────────────────
  "📰 Réarmement Europe": [
    "RHM.DE","HEI.DE","MTX.DE","AIR.PA","SAF.PA","TEC.PA","HO.PA",
    "SAAB-B.ST","LDO.MI",
  ],
  "🏰 Nucléaire & Énergie bas-carbone": [
    "EDF.PA","ENGI.PA","SU.PA","GTT.PA","TTE.PA",
    "NESTE.HE","FORTUM.HE","ORSTED.CO",
    "RWE.DE",
  ],
  "🇺🇸 Impacté par tarifs Trump": [
    "AIR.PA","RNO.PA","STLAM.PA","VOW3.DE","BMW.DE","MBG.DE",
    "MC.PA","KER.PA","RMS.PA","EL.PA",
    "ASML.AS","STM.PA","IFX.DE",
    "MT.AS","BAS.DE",
  ],
  "🤖 Robotique & Automatisation": [
    "KION.DE","SIE.DE","HEXA-B.ST","LIFCO-B.ST",
    "CAP.PA","ALTEN.PA","STM.PA","IFX.DE",
  ],
  "🏥 Vieillissement démographique": [
    "NOVO-B.CO","SAN.PA","BAYN.DE","FME.DE","MRK.DE","SHL.DE",
    "AMBU-B.CO","DEMANT.CO","GN.CO",
    "UCB.BR","ARGX.BR",
    "IPH.PA","ICAD.PA",
    "SAN.MC","AZM.MI",
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
  // Phase 2 — deep analysis
  deepAnalysis: DeepAnalysis | null;
  deepLoading: boolean;
  tickerNews: NewsItem[];
  tickerNewsLoading: boolean;
}

interface DeepAnalysis {
  bull_thesis: string;
  bear_thesis: string;
  macro_context: string;
  business_quality: string;
  timing_vs_value: string;
  what_would_change: string[];
  conviction: "faible" | "modérée" | "forte";
  horizon: string;
  verdict_final: string;
  action: string;
}

const MARKET_COLORS: Record<string, string> = {
  forte: "#3d9e6e",
  correcte: "#c9a84c",
  faible: "#d4834a",
  attendre: "#c84848",
};

const MARKET_LABELS: Record<string, string> = {
  forte: "Opportunités fortes",
  correcte: "Opportunités correctes",
  faible: "Peu d'opportunités",
  attendre: "Moment d'attendre",
};

export default function OpportunitiesPage() {
  const allSectorNames = Object.keys(SECTORS);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(["CAC 40"]);
  const [extraTickers, setExtraTickers] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [budget, setBudget] = useState(500);
  const [maxPrice, setMaxPrice] = useState(0); // 0 = pas de limite
  const [results, setResults] = useState<OpportunityScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, ticker: "", startedAt: 0 });
  const [errors, setErrors] = useState<Array<{ ticker: string; error: string }>>([]);
  const [details, setDetails] = useState<Record<string, TickerDetail>>({});
  const [loadingCached, setLoadingCached] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [dcaPositions, setDcaPositions] = useState<Record<string, { shares: number; avg_price: number }>>({});
  const [verdictHistory, setVerdictHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [marketNewsPeriod, setMarketNewsPeriod] = useState<"today"|"week"|"month">("week");
  const [marketNewsLoading, setMarketNewsLoading] = useState(false);
  const [showMarketNews, setShowMarketNews] = useState(false);
  // Tri / filtre post-analyse
  const [sortBy, setSortBy] = useState<"score" | "price" | "gain" | "name">("score");
  const [filterSector, setFilterSector] = useState<string>("");
  const [bulkDeepRunning, setBulkDeepRunning] = useState(false);

  // Charger positions DCA et historique des verdicts au montage
  useEffect(() => {
    getDCAPositions().then((pos: any[]) => {
      const map: Record<string, { shares: number; avg_price: number }> = {};
      (pos || []).forEach((p: any) => { map[p.ticker] = { shares: p.shares, avg_price: p.avg_price }; });
      setDcaPositions(map);
    }).catch(() => {});

    const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
    fetch("/api/opportunities/verdicts", {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).then(r => r.json()).then(setVerdictHistory).catch(() => {});
  }, []);

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
    setAiAdvice(null);
    const startedAt = Date.now();
    setProgress({ current: 0, total: tickers.length, ticker: "", startedAt });

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

    if (allResults.length > 0) {
      setAiLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
        const res = await fetch("/api/ai/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ results: allResults, budget, max_price: maxPrice }),
        });
        setAiAdvice(await res.json());
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
      [key]: {
        ticker: key, chartData: null, news: [], aiAnalysis: null, aiLoading: true, open: true,
        deepAnalysis: null, deepLoading: false, tickerNews: [], tickerNewsLoading: false,
      },
    }));
    // Charger chart, news et analyse IA en parallèle
    const [chartData, news, aiAnalysis] = await Promise.allSettled([
      getMarketHistory(key, "6mo"),
      getOpportunityNews(key),
      getAITickerAnalysis(opp),
    ]);
    // Charger les news yfinance du ticker
    const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
    const tickerNewsRes = await fetch(`/api/ticker-news/${key}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json()).catch(() => []);

    setDetails((prev) => ({
      ...prev,
      [key]: {
        ticker: key,
        chartData: chartData.status === "fulfilled" ? (chartData.value as OHLCVData) : null,
        news: news.status === "fulfilled" ? (news.value as NewsItem[]) : [],
        aiAnalysis: aiAnalysis.status === "fulfilled" ? aiAnalysis.value : null,
        aiLoading: false,
        open: true,
        deepAnalysis: null, deepLoading: false,
        tickerNews: Array.isArray(tickerNewsRes) ? tickerNewsRes : [],
        tickerNewsLoading: false,
      },
    }));
  };

  const launchDeepAnalysis = async (opp: OpportunityScore) => {
    const key = opp.ticker;
    // Crée l'entrée si absente et marque le chargement (robuste même si le détail n'est pas ouvert)
    setDetails(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {
          ticker: key, chartData: null, news: [], aiAnalysis: null, aiLoading: false,
          tickerNews: [], tickerNewsLoading: false,
        }),
        open: true, deepLoading: true, deepAnalysis: null,
      },
    }));
    const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
    const existingNews = details[key]?.tickerNews ?? [];
    try {
      const res = await fetch("/api/opportunities/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          ticker: key,
          score_data: opp,
          news: existingNews.slice(0, 8),
        }),
      });
      const data = await res.json();
      setDetails(prev => ({ ...prev, [key]: { ...prev[key], deepLoading: false, deepAnalysis: data } }));
    } catch {
      setDetails(prev => ({ ...prev, [key]: { ...prev[key], deepLoading: false } }));
    }
  };

  const loadMarketNews = async (period: "today"|"week"|"month") => {
    setMarketNewsLoading(true);
    setMarketNewsPeriod(period);
    const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
    try {
      const res = await fetch(`/api/market-news?period=${period}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setMarketNews(Array.isArray(data) ? data : []);
    } catch { setMarketNews([]); }
    setMarketNewsLoading(false);
  };

  const tickers = getTickerList();

  // ── Filtrage post-analyse : score min, prix max, secteur ──────────────
  let displayed = results.filter((r) => r.score >= minScore);
  if (maxPrice > 0) displayed = displayed.filter((r) => r.current_price != null && r.current_price <= maxPrice);
  if (filterSector) displayed = displayed.filter((r) => (SECTORS[filterSector] || []).includes(r.ticker));
  // ── Tri ──
  displayed = [...displayed].sort((a, b) => {
    if (sortBy === "price") return (a.current_price ?? 1e12) - (b.current_price ?? 1e12);
    if (sortBy === "gain") return (b.gain_pct ?? -1e12) - (a.gain_pct ?? -1e12);
    if (sortBy === "name") return (a.name || a.ticker).localeCompare(b.name || b.ticker);
    return b.score - a.score;
  });
  const filtered = displayed; // alias utilisé par le tableau et le graphique
  const highScore = displayed.filter((r) => r.score >= 7);

  // Secteurs sélectionnés ayant au moins un résultat (pour le menu de filtre)
  const sectorsWithResults = selectedSectors.filter(
    (s) => (SECTORS[s] || []).some((t) => results.some((r) => r.ticker === t))
  );

  // ── Export CSV des résultats affichés (avec IA + Phase 2 si chargées) ──
  const exportCSV = () => {
    if (displayed.length === 0) return;
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const headers = [
      "Ticker", "Nom", "Score/10", "Recommandation", "Cours (€)", "Objectif (€)", "Gain potentiel %",
      "Technique", "Fondamental", "Sentiment", "Analystes", "Qualité", "Position 52W %", "Justification",
      "IA - Synthèse", "IA - Verdict",
      "Phase2 - Action", "Phase2 - Conviction", "Phase2 - Horizon", "Phase2 - Verdict final",
      "Phase2 - Thèse haussière", "Phase2 - Thèse baissière",
    ];
    const rows = displayed.map((opp) => {
      const det = details[opp.ticker];
      const ai = det?.aiAnalysis;
      const d = det?.deepAnalysis;
      const fund52 = (opp as any).details?.fundamental?.fundamentals;
      const pos52w = fund52?.position_52w ?? (opp as any).position_52w;
      return [
        opp.ticker, opp.name ?? "", opp.score?.toFixed(2), opp.recommendation,
        opp.current_price != null ? opp.current_price.toFixed(2) : "",
        opp.target_price != null ? opp.target_price.toFixed(2) : "",
        opp.gain_pct != null ? opp.gain_pct.toFixed(1) : "",
        opp.technical_score?.toFixed(2), opp.fundamental_score?.toFixed(2),
        opp.sentiment_score?.toFixed(2), opp.analyst_score != null ? opp.analyst_score.toFixed(2) : "",
        opp.quality_grade ?? "", pos52w != null ? Number(pos52w).toFixed(0) : "",
        opp.justification ?? "",
        ai && !ai.error ? (ai.synthese ?? "") : "", ai && !ai.error ? (ai.verdict_final ?? "") : "",
        d ? (d.action ?? "") : "", d ? (d.conviction ?? "") : "", d ? (d.horizon ?? "") : "",
        d ? (d.verdict_final ?? "") : "", d ? (d.bull_thesis ?? "") : "", d ? (d.bear_thesis ?? "") : "",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opportunites_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Lancer Phase 2 sur tous les tickers affichés (séquentiel, ouvre le détail si besoin)
  const runBulkDeepAnalysis = async () => {
    if (bulkDeepRunning) return;
    setBulkDeepRunning(true);
    try {
      for (const opp of displayed) {
        if (details[opp.ticker]?.deepAnalysis) continue;
        if (!details[opp.ticker]) {
          await toggleDetail(opp);
        }
        await launchDeepAnalysis(opp);
      }
    } finally {
      setBulkDeepRunning(false);
    }
  };

  return (
    <div className="page-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-label">Paramètres</div>
        <Link href="/" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          ← Accueil
        </Link>

        {/* Global select/deselect */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
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

        {/* Grouped sectors */}
        {[
          {
            label: "Indices boursiers",
            keys: allSectorNames.filter(k => !/^\p{Emoji}/u.test(k)),
          },
          {
            label: "Secteurs économiques",
            keys: allSectorNames.filter(k => /^[💻🔬🏦⚡✈️💎🚗🏗️📡]/u.test(k)),
          },
          {
            label: "Thématiques tendance",
            keys: allSectorNames.filter(k => /^[🤖🌱🔐💊🛸🏠📈]/u.test(k) && !k.startsWith("🤖 Robotique") && !k.startsWith("🏥")),
          },
          {
            label: "Actualité du moment",
            keys: allSectorNames.filter(k => /^[📰🏰🇺🇸]/u.test(k) || k.startsWith("🤖 Robotique") || k.startsWith("🏥")),
          },
        ].map(({ label, keys }) => (
          <div key={label} style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                {label}
              </div>
              <button
                onClick={() => {
                  const allSelected = keys.every(k => selectedSectors.includes(k));
                  if (allSelected) {
                    setSelectedSectors(prev => prev.filter(s => !keys.includes(s)));
                  } else {
                    setSelectedSectors(prev => Array.from(new Set([...prev, ...keys])));
                  }
                }}
                style={{
                  fontSize: "0.58rem", background: "none", border: "1px solid var(--border)",
                  borderRadius: 3, padding: "0.1rem 0.35rem", cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                Tout sélectionner
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              {keys.map((s) => (
                <label
                  key={s}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    cursor: "pointer", fontSize: "0.72rem", color: "var(--text-secondary)",
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
          </div>
        ))}

        <hr style={{ borderColor: "var(--border)", marginBottom: "1rem" }} />

        {/* Actualités marché */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              📰 Actualités marché EU
            </div>
            <button
              onClick={() => { setShowMarketNews(v => !v); if (!showMarketNews && marketNews.length === 0) loadMarketNews("week"); }}
              style={{ fontSize: "0.58rem", background: "none", border: "1px solid var(--border)", borderRadius: 3, padding: "0.1rem 0.35rem", cursor: "pointer", color: "var(--text-muted)" }}
            >
              {showMarketNews ? "Masquer" : "Afficher"}
            </button>
          </div>
          {showMarketNews && (
            <div>
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.5rem" }}>
                {(["today", "week", "month"] as const).map(p => (
                  <button key={p} onClick={() => loadMarketNews(p)} style={{
                    fontSize: "0.62rem", padding: "0.15rem 0.4rem", borderRadius: 3, cursor: "pointer",
                    background: marketNewsPeriod === p ? GOLD : "var(--surface2)",
                    border: `1px solid ${marketNewsPeriod === p ? GOLD : "var(--border)"}`,
                    color: marketNewsPeriod === p ? "#000" : "var(--text-muted)", fontWeight: marketNewsPeriod === p ? 700 : 400,
                  }}>
                    {p === "today" ? "Aujourd'hui" : p === "week" ? "Semaine" : "Mois"}
                  </button>
                ))}
              </div>
              {marketNewsLoading && <div style={{ fontSize: "0.7rem", color: "#8892a4" }}>Chargement…</div>}
              {!marketNewsLoading && marketNews.length === 0 && <div style={{ fontSize: "0.7rem", color: "#8892a4" }}>Aucune actualité trouvée.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 280, overflowY: "auto" }}>
                {marketNews.slice(0, 15).map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.4rem 0.5rem" }}>
                      <div style={{ fontSize: "0.68rem", color: "#e8eaf0", lineHeight: 1.4 }}>{n.title}</div>
                      <div style={{ fontSize: "0.6rem", color: "#8892a4", marginTop: "0.2rem" }}>
                        {n.source} {n.published ? `· ${new Date(n.published).toLocaleDateString("fr-FR")}` : ""}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <hr style={{ borderColor: "var(--border)", marginBottom: "1rem" }} />

        {/* Budget mensuel */}
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 4 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.6rem" }}>
            Versement mensuel DCA
          </div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {[100, 200, 300, 400, 500].map((v) => (
              <button key={v} onClick={() => setBudget(v)} style={{
                fontSize: "0.72rem", padding: "0.25rem 0.5rem", borderRadius: 3, cursor: "pointer",
                background: budget === v ? GOLD : "var(--surface2)",
                border: `1px solid ${budget === v ? GOLD : "var(--border)"}`,
                color: budget === v ? "#000" : "var(--text-secondary)", fontWeight: budget === v ? 700 : 400,
              }}>{v} €</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="number" min={0} step={50} value={budget === 0 ? "" : budget}
              onChange={(e) => setBudget(+e.target.value)}
              className="input" style={{ flex: 1, fontSize: "0.72rem" }} placeholder="Autre montant"
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>€/mois</span>
          </div>
        </div>

        {/* Prix max par action */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
            Prix max par action
          </div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            {[0, 100, 200, 300, 400, 500].map((v) => (
              <button key={v} onClick={() => setMaxPrice(v)} style={{
                fontSize: "0.7rem", padding: "0.2rem 0.45rem", borderRadius: 3, cursor: "pointer",
                background: maxPrice === v ? "rgba(201,168,76,0.2)" : "var(--surface2)",
                border: `1px solid ${maxPrice === v ? "rgba(201,168,76,0.5)" : "var(--border)"}`,
                color: maxPrice === v ? GOLD : "var(--text-muted)", fontWeight: maxPrice === v ? 700 : 400,
              }}>{v === 0 ? "Tous" : `≤${v}€`}</button>
            ))}
          </div>
        </div>

        <label>Tickers supplémentaires</label>
        <input
          className="input"
          placeholder="ex : MSFT, ASML.AS"
          value={extraTickers}
          onChange={(e) => setExtraTickers(e.target.value)}
          style={{ marginBottom: "1rem" }}
        />

        <label>Score minimum affiché</label>
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

            {/* ── VERDICT DU CONSEILLER IA ── */}
            {(aiLoading || aiAdvice) && (
              <div style={{ marginBottom: "2rem" }}>
                {/* En-tête statut marché */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "1rem",
                  padding: "1rem 1.25rem",
                  background: aiAdvice ? `linear-gradient(135deg, ${MARKET_COLORS[aiAdvice.opportunite_marche] ?? GOLD}18, transparent)` : "var(--surface2)",
                  border: `1px solid ${aiAdvice ? (MARKET_COLORS[aiAdvice.opportunite_marche] ?? GOLD) + "55" : "var(--border)"}`,
                  borderRadius: "6px 6px 0 0", borderBottom: "none",
                }}>
                  <div>
                    <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Verdict IA — Groq / Llama 3.3</div>
                    {aiAdvice?.opportunite_marche && (
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: MARKET_COLORS[aiAdvice.opportunite_marche] ?? GOLD, marginTop: "0.1rem" }}>
                        {MARKET_LABELS[aiAdvice.opportunite_marche] ?? aiAdvice.opportunite_marche}
                      </div>
                    )}
                    {aiLoading && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>Analyse en cours — lecture des fondamentaux…</div>}
                  </div>
                  {aiAdvice?.opportunite_marche ? (
                    <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: "50%", background: MARKET_COLORS[aiAdvice.opportunite_marche] ?? GOLD, boxShadow: `0 0 10px ${MARKET_COLORS[aiAdvice.opportunite_marche] ?? GOLD}` }} />
                  ) : (
                    <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                    </div>
                  )}
                </div>

                {aiAdvice && !aiLoading && (
                  <div style={{ border: `1px solid ${(MARKET_COLORS[aiAdvice.opportunite_marche] ?? GOLD) + "55"}`, borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
                    {/* Verdict global */}
                    {aiAdvice.verdict_global && (
                      <div style={{ padding: "1.25rem 1.5rem", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                        <p style={{ fontSize: "0.88rem", color: "var(--text-primary)", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>"{aiAdvice.verdict_global}"</p>
                      </div>
                    )}

                    {/* Aucune opportunité */}
                    {(!aiAdvice.top_achats || aiAdvice.top_achats.length === 0) && aiAdvice.message_si_vide && (
                      <div style={{ padding: "1.25rem 1.5rem", background: "rgba(200,72,72,0.04)", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: RED, marginBottom: "0.5rem" }}>Pas d'achat recommandé ce mois-ci</div>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{aiAdvice.message_si_vide}</p>
                      </div>
                    )}

                    {/* Cartes par valeur recommandée */}
                    {aiAdvice.top_achats?.length > 0 && (
                      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "1rem" }}>
                          {aiAdvice.top_achats.length === 1 ? "1 valeur recommandée" : `${aiAdvice.top_achats.length} valeurs recommandées`}
                          {maxPrice > 0 && <span style={{ color: GOLD, marginLeft: "0.5rem" }}>· cours ≤ {maxPrice} €</span>}
                          {budget > 0 && <span style={{ color: GOLD, marginLeft: "0.5rem" }}>· budget {budget} €/mois</span>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {aiAdvice.top_achats.map((item: any, idx: number) => (
                            <div key={item.ticker} style={{ background: "var(--surface2)", borderRadius: 5, border: `1px solid ${item.conviction === "haute" ? GREEN + "55" : GOLD + "33"}`, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: item.conviction === "haute" ? "rgba(61,158,110,0.06)" : "rgba(201,168,76,0.04)", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "1rem", fontWeight: 800, color: GOLD }}>#{idx + 1}</span>
                                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.ticker}</span>
                                {item.nom && <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{item.nom}</span>}
                                {item.cours && <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{item.cours} €</span>}
                                <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", padding: "0.2rem 0.6rem", borderRadius: 3, background: item.conviction === "haute" ? "rgba(61,158,110,0.2)" : "rgba(212,131,74,0.15)", color: item.conviction === "haute" ? GREEN : ORANGE, border: `1px solid ${item.conviction === "haute" ? GREEN + "44" : ORANGE + "44"}` }}>
                                  Conviction {item.conviction}
                                </span>
                                {item.horizon_recommande && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Horizon : {item.horizon_recommande}</span>}
                              </div>
                              <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD, marginBottom: "0.35rem" }}>Pourquoi maintenant ?</div>
                                  <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", lineHeight: 1.65, margin: 0 }}>{item.pourquoi_maintenant}</p>
                                </div>
                                {item.these_bull && (
                                  <div style={{ background: "rgba(61,158,110,0.06)", borderRadius: 4, padding: "0.6rem 0.75rem", borderLeft: `3px solid ${GREEN}` }}>
                                    <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: GREEN, marginBottom: "0.25rem" }}>▲ Scénario haussier</div>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{item.these_bull}</p>
                                  </div>
                                )}
                                {item.these_bear && (
                                  <div style={{ background: "rgba(200,72,72,0.05)", borderRadius: 4, padding: "0.6rem 0.75rem", borderLeft: `3px solid ${RED}` }}>
                                    <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: "0.25rem" }}>▼ Ce qui peut mal tourner</div>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{item.these_bear}</p>
                                  </div>
                                )}
                                {item.ce_qui_invaliderait && (
                                  <div style={{ gridColumn: "1 / -1", background: "rgba(212,131,74,0.06)", borderRadius: 4, padding: "0.6rem 0.75rem", borderLeft: `3px solid ${ORANGE}` }}>
                                    <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: ORANGE, marginBottom: "0.25rem" }}>⚠ Signal qui invaliderait la thèse</div>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{item.ce_qui_invaliderait}</p>
                                  </div>
                                )}
                                {(item.nb_actions_budget != null || item.niveau_risque) && (
                                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                    {item.nb_actions_budget != null && budget > 0 && (
                                      <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: 3, background: "rgba(201,168,76,0.12)", border: `1px solid ${GOLD}44`, color: GOLD, fontWeight: 600 }}>
                                        ~{item.nb_actions_budget} action{item.nb_actions_budget > 1 ? "s" : ""} avec {budget} €
                                      </span>
                                    )}
                                    {item.niveau_risque && (
                                      <span style={{ fontSize: "0.68rem", padding: "0.2rem 0.5rem", borderRadius: 3, fontWeight: 600, color: item.niveau_risque === "faible" ? GREEN : item.niveau_risque === "modéré" ? ORANGE : RED, border: `1px solid ${item.niveau_risque === "faible" ? GREEN : item.niveau_risque === "modéré" ? ORANGE : RED}44` }}>
                                        Risque {item.niveau_risque}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Macro + DCA */}
                    <div style={{ padding: "1rem 1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      {aiAdvice.risques_macro && (
                        <div>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: "0.35rem" }}>Risques macro</div>
                          <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>{aiAdvice.risques_macro}</p>
                        </div>
                      )}
                      {aiAdvice.conseil_dca && (
                        <div>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD, marginBottom: "0.35rem" }}>Conseil DCA</div>
                          <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>{aiAdvice.conseil_dca}</p>
                        </div>
                      )}
                      {aiAdvice.secteurs_a_surveiller?.length > 0 && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.35rem" }}>Secteurs à surveiller</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {aiAdvice.secteurs_a_surveiller.map((s: string) => (
                              <span key={s} style={{ fontSize: "0.72rem", padding: "0.15rem 0.4rem", borderRadius: 3, background: "rgba(201,168,76,0.1)", border: `1px solid ${GOLD}33`, color: GOLD }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "0.5rem 1.5rem", background: "rgba(255,255,255,0.02)", borderTop: "1px solid var(--border)" }}>
                      <p style={{ fontSize: "0.62rem", color: "var(--text-muted)", margin: 0 }}>⚠ Analyse IA — ne constitue pas un conseil en investissement réglementé.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Barre de filtres / tri / export ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
              padding: "0.75rem 1rem", background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 6, marginBottom: "1rem",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {displayed.length} résultat{displayed.length > 1 ? "s" : ""}
              </span>

              <div style={{ width: 1, height: 18, background: "var(--border)" }} />

              {/* Tri */}
              <label style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0, textTransform: "none", letterSpacing: 0 }}>
                Trier par
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="select" style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem", width: "auto" }}>
                  <option value="score">Score ↓</option>
                  <option value="gain">Gain potentiel ↓</option>
                  <option value="price">Prix ↑</option>
                  <option value="name">Nom A→Z</option>
                </select>
              </label>

              {/* Filtre secteur */}
              {sectorsWithResults.length > 1 && (
                <label style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0, textTransform: "none", letterSpacing: 0 }}>
                  Secteur
                  <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)} className="select" style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem", width: "auto", maxWidth: 200 }}>
                    <option value="">Tous</option>
                    {sectorsWithResults.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}

              {/* Filtre prix max (réutilise maxPrice) */}
              <label style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0, textTransform: "none", letterSpacing: 0 }}>
                Prix max
                <select value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="select" style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem", width: "auto" }}>
                  {[0, 50, 100, 200, 300, 500, 1000].map((v) => <option key={v} value={v}>{v === 0 ? "Tous" : `≤ ${v} €`}</option>)}
                </select>
              </label>

              <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={runBulkDeepAnalysis}
                  disabled={bulkDeepRunning || displayed.length === 0}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.7rem", opacity: bulkDeepRunning ? 0.6 : 1 }}
                  title="Lancer l'analyse approfondie (Phase 2) sur tous les résultats affichés"
                >
                  {bulkDeepRunning ? "🔍 Analyse en cours…" : "🔍 Phase 2 sur tout"}
                </button>
                <button
                  onClick={exportCSV}
                  disabled={displayed.length === 0}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.7rem" }}
                  title="Exporter les résultats affichés (avec IA et Phase 2 si chargées) en CSV"
                >
                  ↓ Export CSV
                </button>
              </div>
            </div>

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
                    <th>52W</th>
                    <th>PRU</th>
                    <th>Tech.</th>
                    <th>Fonda.</th>
                    <th>Sentiment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((opp) => {
                    const det = details[opp.ticker];
                    const dca = dcaPositions[opp.ticker];
                    const fund52 = (opp as any).details?.fundamental?.fundamentals;
                    const pos52w = fund52?.position_52w ?? (opp as any).position_52w;
                    const pctHigh = fund52?.pct_from_52w_high ?? (opp as any).pct_from_52w_high;
                    const pru = dca?.avg_price;
                    const pruPct = pru && opp.current_price ? ((opp.current_price - pru) / pru) * 100 : null;
                    return (
                      <>
                        <tr key={opp.ticker} style={dca ? { background: "rgba(201,168,76,0.03)" } : undefined}>
                          <td style={{ color: GOLD, fontWeight: 600 }}>
                            {opp.ticker}
                            {dca && <span style={{ marginLeft: "0.3rem", fontSize: "0.58rem", color: GOLD, background: "rgba(201,168,76,0.15)", padding: "0.05rem 0.3rem", borderRadius: 2 }}>PEA</span>}
                            {opp.quality_grade && !((opp as any).is_etf) && (
                              <span style={{
                                marginLeft: 4, fontSize: "0.6rem", fontWeight: 700,
                                padding: "1px 4px", borderRadius: 3,
                                background: opp.quality_grade === "A" ? "rgba(61,158,110,0.25)" :
                                            opp.quality_grade === "B" ? "rgba(61,158,110,0.12)" :
                                            opp.quality_grade === "F" ? "rgba(200,72,72,0.25)" :
                                            "rgba(255,255,255,0.08)",
                                color: opp.quality_grade === "A" ? GREEN :
                                       opp.quality_grade === "B" ? GREEN :
                                       opp.quality_grade === "F" ? RED : "var(--text-muted)",
                              }}>{opp.quality_grade}</span>
                            )}
                          </td>
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
                          {/* 52W position */}
                          <td>
                            {pos52w != null ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                                <div style={{ fontSize: "0.65rem", color: pos52w <= 30 ? GREEN : pos52w >= 75 ? RED : "var(--text-secondary)" }}>
                                  {pos52w <= 30 ? "▼ Bas" : pos52w >= 75 ? "▲ Haut" : "◎ Mid"}
                                </div>
                                <div style={{ width: 48, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                                  <div style={{ width: `${pos52w}%`, height: "100%", borderRadius: 2, background: pos52w <= 30 ? GREEN : pos52w >= 75 ? RED : ORANGE }} />
                                </div>
                                {pctHigh != null && <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{pctHigh.toFixed(1)}% vs haut</div>}
                              </div>
                            ) : "—"}
                          </td>
                          {/* PRU */}
                          <td>
                            {pru != null ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{pru.toFixed(2)} €</div>
                                {pruPct != null && (
                                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: pruPct >= 0 ? GREEN : RED }}>
                                    {pruPct >= 0 ? "+" : ""}{pruPct.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            ) : <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>—</span>}
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
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                              <button
                                style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                                onClick={() => toggleDetail(opp)}
                              >
                                {det?.open ? "Fermer" : "Détails"}
                              </button>
                              <button
                                style={{
                                  fontSize: "0.62rem", padding: "0.15rem 0.4rem", borderRadius: 3, cursor: "pointer",
                                  background: det?.deepAnalysis ? "rgba(61,158,110,0.15)" : "rgba(201,168,76,0.12)",
                                  border: `1px solid ${det?.deepAnalysis ? GREEN + "55" : GOLD + "44"}`,
                                  color: det?.deepAnalysis ? GREEN : GOLD, whiteSpace: "nowrap",
                                }}
                                title="Analyse approfondie (Phase 2)"
                                disabled={det?.deepLoading}
                                onClick={async () => {
                                  if (!details[opp.ticker]?.open) await toggleDetail(opp);
                                  launchDeepAnalysis(opp);
                                }}
                              >
                                {det?.deepLoading ? "⏳" : det?.deepAnalysis ? "✓ Phase 2" : "🔍 Phase 2"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {det?.open && (
                          <tr key={`${opp.ticker}-detail`}>
                            <td colSpan={13} style={{ padding: "1rem", background: "rgba(201,168,76,0.04)", borderTop: "1px solid var(--border)" }}>
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

                              {(opp as any).red_flags && (opp as any).red_flags.length > 0 && (
                                <div style={{ marginBottom: "1rem" }}>
                                  {((opp as any).red_flags as string[]).map((flag: string, i: number) => (
                                    <div key={i} style={{
                                      fontSize: "0.76rem", padding: "0.4rem 0.75rem", marginBottom: "0.3rem",
                                      borderRadius: 4, background: "rgba(200,72,72,0.1)",
                                      borderLeft: "3px solid rgba(200,72,72,0.6)", color: "var(--text-primary)"
                                    }}>{flag}</div>
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
                              {/* News ticker (yfinance) */}
                              {(det.tickerNews?.length > 0 || det.news.length > 0) && (
                                <div style={{ marginBottom: "1rem" }}>
                                  <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: "0 0 0.5rem" }}>
                                    Actualités récentes
                                  </p>
                                  {(det.tickerNews?.length > 0 ? det.tickerNews : det.news).map((item, i) => (
                                    <a key={i} href={item.link} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: "0.35rem" }}>
                                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.4rem 0.6rem" }}>
                                        <div style={{ fontSize: "0.74rem", color: "#e8eaf0", lineHeight: 1.4 }}>{item.title}</div>
                                        <div style={{ fontSize: "0.63rem", color: "#8892a4", marginTop: "0.15rem" }}>
                                          {item.source}{item.published ? ` · ${new Date(item.published).toLocaleDateString("fr-FR")}` : ""}
                                        </div>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* ── Phase 2 : Analyse approfondie ─────────────── */}
                              <div style={{
                                background: "linear-gradient(135deg, rgba(201,168,76,0.05), rgba(61,158,110,0.03))",
                                border: "1px solid rgba(201,168,76,0.3)", borderRadius: 6, padding: "0.9rem 1rem",
                                marginBottom: "0.5rem",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                                  <div>
                                    <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD }}>
                                      Phase 2 — Analyse approfondie
                                    </div>
                                    <div style={{ fontSize: "0.62rem", color: "#8892a4", marginTop: "0.1rem" }}>
                                      Raisonnement d'analyste senior · thèse haussière/baissière · conviction
                                    </div>
                                  </div>
                                  {!det.deepAnalysis && (
                                    <button
                                      onClick={() => launchDeepAnalysis(opp)}
                                      disabled={det.deepLoading}
                                      style={{
                                        padding: "0.35rem 0.8rem", borderRadius: 4, cursor: det.deepLoading ? "not-allowed" : "pointer",
                                        background: det.deepLoading ? "var(--surface2)" : GOLD,
                                        color: det.deepLoading ? "#8892a4" : "#0d0f18",
                                        border: "none", fontWeight: 700, fontSize: "0.72rem", whiteSpace: "nowrap",
                                      }}
                                    >
                                      {det.deepLoading ? "Analyse en cours…" : "🔍 Analyser"}
                                    </button>
                                  )}
                                </div>

                                {det.deepLoading && (
                                  <div style={{ fontSize: "0.75rem", color: "#8892a4", padding: "0.5rem 0" }}>
                                    Le modèle réfléchit… (10–20 secondes)
                                  </div>
                                )}

                                {det.deepAnalysis && (() => {
                                  const d = det.deepAnalysis;
                                  const convColor = d.conviction === "forte" ? GREEN : d.conviction === "modérée" ? ORANGE : RED;
                                  const actionColor: Record<string, string> = {
                                    "acheter maintenant": GREEN, "renforcer progressivement": GREEN,
                                    "attendre point d'entrée": GOLD, "conserver": GOLD,
                                    "alléger": ORANGE, "éviter": RED,
                                  };
                                  return (
                                    <div>
                                      {/* Verdict + conviction */}
                                      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.8rem", flexWrap: "wrap" }}>
                                        <span style={{ padding: "0.25rem 0.7rem", borderRadius: 20, fontWeight: 700, fontSize: "0.72rem", background: `${(actionColor[d.action] || GOLD)}22`, color: actionColor[d.action] || GOLD, border: `1px solid ${(actionColor[d.action] || GOLD)}55` }}>
                                          {d.action?.toUpperCase()}
                                        </span>
                                        <span style={{ padding: "0.25rem 0.7rem", borderRadius: 20, fontWeight: 600, fontSize: "0.72rem", background: `${convColor}22`, color: convColor, border: `1px solid ${convColor}55` }}>
                                          Conviction {d.conviction}
                                        </span>
                                        <span style={{ padding: "0.25rem 0.7rem", borderRadius: 20, fontWeight: 400, fontSize: "0.7rem", background: "var(--surface2)", color: "#a0aab8", border: "1px solid var(--border)" }}>
                                          {d.horizon}
                                        </span>
                                      </div>

                                      {/* Verdict final */}
                                      <p style={{ fontSize: "0.8rem", color: "#e8eaf0", lineHeight: 1.6, margin: "0 0 0.9rem", fontStyle: "italic" }}>
                                        "{d.verdict_final}"
                                      </p>

                                      {/* Thèses */}
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.8rem" }}>
                                        <div style={{ background: `${GREEN}11`, border: `1px solid ${GREEN}33`, borderRadius: 5, padding: "0.6rem 0.75rem" }}>
                                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>▲ Thèse haussière</div>
                                          <p style={{ fontSize: "0.74rem", color: "#c8d0dc", margin: 0, lineHeight: 1.5 }}>{d.bull_thesis}</p>
                                        </div>
                                        <div style={{ background: `${RED}11`, border: `1px solid ${RED}33`, borderRadius: 5, padding: "0.6rem 0.75rem" }}>
                                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>▼ Thèse baissière</div>
                                          <p style={{ fontSize: "0.74rem", color: "#c8d0dc", margin: 0, lineHeight: 1.5 }}>{d.bear_thesis}</p>
                                        </div>
                                      </div>

                                      {/* Contexte macro + qualité + timing */}
                                      {[
                                        { label: "Contexte macro", val: d.macro_context, color: "#7b8fa6" },
                                        { label: "Qualité du business", val: d.business_quality, color: GOLD },
                                        { label: "Timing vs valorisation", val: d.timing_vs_value, color: ORANGE },
                                      ].map(({ label, val, color }) => val ? (
                                        <div key={label} style={{ marginBottom: "0.6rem" }}>
                                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem" }}>{label}</div>
                                          <p style={{ fontSize: "0.74rem", color: "#a0aab8", margin: 0, lineHeight: 1.5 }}>{val}</p>
                                        </div>
                                      ) : null)}

                                      {/* Ce qui changerait la thèse */}
                                      {d.what_would_change?.length > 0 && (
                                        <div>
                                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#7b6fc4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>À surveiller</div>
                                          <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                                            {d.what_would_change.map((s: string, i: number) => (
                                              <li key={i} style={{ fontSize: "0.73rem", color: "#a0aab8", marginBottom: "0.2rem", lineHeight: 1.4 }}>{s}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      <button
                                        onClick={() => launchDeepAnalysis(opp)}
                                        style={{ marginTop: "0.8rem", fontSize: "0.65rem", background: "none", border: "1px solid var(--border)", borderRadius: 3, padding: "0.2rem 0.5rem", cursor: "pointer", color: "#8892a4" }}
                                      >
                                        ↻ Relancer l'analyse
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
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

            {/* Détail par entreprise — fusionné dans le tableau ci-dessus (liste unique) */}
            {([] as typeof filtered).map((opp) => {
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

                              {((opp as any).ev_to_fcf != null || (opp as any).interest_coverage != null) && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                                  {(opp as any).ev_to_fcf != null && (
                                    <div className="metric-card">
                                      <div className="metric-label">EV/FCF</div>
                                      <div className="metric-value" style={{ fontSize: "0.85rem", color: (opp as any).ev_to_fcf < 15 ? GREEN : (opp as any).ev_to_fcf > 35 ? RED : "var(--text-primary)" }}>
                                        {(opp as any).ev_to_fcf}x
                                      </div>
                                    </div>
                                  )}
                                  {(opp as any).interest_coverage != null && (
                                    <div className="metric-card">
                                      <div className="metric-label">Couv. intérêts</div>
                                      <div className="metric-value" style={{ fontSize: "0.85rem", color: (opp as any).interest_coverage > 5 ? GREEN : (opp as any).interest_coverage < 2 ? RED : "var(--text-primary)" }}>
                                        {(opp as any).interest_coverage}x
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {(opp as any).red_flags && (opp as any).red_flags.length > 0 && (
                                <div style={{ marginBottom: "1rem" }}>
                                  {((opp as any).red_flags as string[]).map((flag: string, i: number) => (
                                    <div key={i} style={{
                                      fontSize: "0.76rem", padding: "0.4rem 0.75rem", marginBottom: "0.3rem",
                                      borderRadius: 4, background: "rgba(200,72,72,0.1)",
                                      borderLeft: "3px solid rgba(200,72,72,0.6)", color: "var(--text-primary)"
                                    }}>{flag}</div>
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

        {/* ── HISTORIQUE DES VERDICTS ─────────────────────────── */}
        {verdictHistory.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
              <SectionTitle>Historique des Verdicts IA</SectionTitle>
              <button onClick={() => setShowHistory(h => !h)} style={{ fontSize: "0.68rem", background: "none", border: "1px solid var(--border)", borderRadius: 3, padding: "0.2rem 0.6rem", color: "var(--text-muted)", cursor: "pointer" }}>
                {showHistory ? "Masquer" : `Voir les ${verdictHistory.length} derniers verdicts`}
              </button>
            </div>
            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {verdictHistory.map((v: any, i: number) => {
                  const mc = MARKET_COLORS[v.opportunite_marche] ?? GOLD;
                  const ml = MARKET_LABELS[v.opportunite_marche] ?? v.opportunite_marche;
                  const date = new Date(v.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
                  return (
                    <div key={v.id ?? i} style={{ background: "var(--surface2)", border: `1px solid ${mc}33`, borderLeft: `3px solid ${mc}`, borderRadius: 4, padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: mc }}>{ml}</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{date}</span>
                        {v.budget > 0 && <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Budget : {v.budget} €</span>}
                        {v.nb_tickers > 0 && <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{v.nb_tickers} tickers analysés</span>}
                        {v.top_achats?.length > 0 && (
                          <div style={{ display: "flex", gap: "0.3rem", marginLeft: "auto", flexWrap: "wrap" }}>
                            {v.top_achats.map((t: any) => (
                              <span key={t.ticker} style={{ fontSize: "0.68rem", padding: "0.15rem 0.45rem", borderRadius: 3, background: "rgba(201,168,76,0.12)", color: GOLD, fontWeight: 600 }}>{t.ticker}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {v.verdict_global && (
                        <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{v.verdict_global}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p style={{ marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          Les scores et recommandations sont générés automatiquement et ne constituent pas un conseil en investissement.
        </p>
      </main>
    </div>
  );
}
