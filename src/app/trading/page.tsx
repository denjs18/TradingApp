"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const getLastCycle = () => fetch("/api/trading/last-cycle").then(r => r.json());

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const GOLD = "#c9a84c";
const GREEN = "#3d9e6e";
const RED = "#c84848";
const ORANGE = "#d4834a";
const BLUE = "#4a8fd4";
const CYAN = "#3db8c8";

const CYCLE_INTERVAL_SECONDS = 90;

const TRADING_MODES = {
  conservative: { name: "Conservateur", description: "24 tickers · cycle 2min · seuils stricts", color: "#3d9e6e", interval: 120 },
  standard:     { name: "Standard",     description: "24 tickers · cycle 1min · équilibré",      color: "#4a8fd4", interval: 60  },
  aggressive:   { name: "Agressif",     description: "100 tickers · cycle 45s · seuils bas",     color: "#d4834a", interval: 45  },
  ultra:        { name: "Ultra 🔥",     description: "300+ tickers · cycle 30s · rotation auto",  color: "#c84848", interval: 30  },
} as const;

type TradingMode = keyof typeof TRADING_MODES;

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  momentum: "Suit la tendance haussière",
  mean_reversion: "Retour à la moyenne",
  breakout: "Cassures de niveaux",
  combined: "Combinaison des 3 stratégies",
};

interface AIStrategyResult {
  strategy: string; tickers: string[];
  stop_loss: number; take_profit: number;
  max_position: number; max_positions: number;
  reasoning: string; warnings: string;
  profile_name: string; error?: string;
}

interface LiveEvent {
  id: number; time: string; type: "buy" | "sell" | "signal" | "cycle" | "info" | "error";
  ticker?: string; price?: number; shares?: number; pnl?: number;
  message: string;
}

const PROFILES = {
  prudent:  { name: "Prudent",   strategy: "mean_reversion", stop_loss: -1.5, take_profit: 2.0,  max_position: 10, max_positions: 3 },
  equilibre:{ name: "Équilibré", strategy: "combined",       stop_loss: -2.5, take_profit: 4.0,  max_position: 20, max_positions: 5 },
  dynamique:{ name: "Dynamique", strategy: "momentum",       stop_loss: -4.0, take_profit: 8.0,  max_position: 30, max_positions: 7 },
};

const STRATEGY_NAMES: Record<string, string> = {
  momentum: "Momentum", mean_reversion: "Mean Reversion", breakout: "Breakout", combined: "Combinée",
};

const ALL_TICKERS = [
  "AIR.PA","SAF.PA","TKO.PA","HO.PA","MC.PA","KER.PA","RMS.PA",
  "BNP.PA","GLE.PA","ACA.PA","TTE.PA","ENGI.PA","CAP.PA","DAS.PA",
  "STM.PA","RNO.PA","STL.PA","SAN.PA","BN.PA","ORA.PA","SU.PA",
  "SGO.PA","LR.PA","AM.PA",
];

let _eventId = 0;
function newEvent(fields: Omit<LiveEvent, "id" | "time">): LiveEvent {
  return { id: ++_eventId, time: new Date().toLocaleTimeString("fr-FR"), ...fields };
}

function fmt(n: number | null | undefined, currency = true): string {
  if (n == null) return "—";
  if (currency) return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
  return n.toFixed(2);
}
function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function PosColor({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value == null) return <span>—</span>;
  const c = value > 0 ? GREEN : value < 0 ? RED : "var(--text-secondary)";
  return <span style={{ color: c }}>{value > 0 ? "+" : ""}{value.toFixed(2)}{suffix}</span>;
}

function Pulse({ active }: { active: boolean }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginRight: "0.4rem" }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: active ? GREEN : "var(--text-muted)",
        display: "inline-block",
        boxShadow: active ? `0 0 0 0 ${GREEN}` : "none",
        animation: active ? "pulse 1.5s ease-out infinite" : "none",
      }} />
    </span>
  );
}

function MetricCard({ label, value, sub, color, glow }: { label: string; value: string; sub?: string; color?: string; glow?: boolean }) {
  return (
    <div className="metric-card" style={glow ? { boxShadow: `0 0 12px rgba(201,168,76,0.15)`, borderColor: "rgba(201,168,76,0.3)" } : undefined}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

function EventTypeTag({ type }: { type: LiveEvent["type"] }) {
  const map: Record<string, [string, string]> = {
    buy:    ["ACHAT",   GREEN],
    sell:   ["VENTE",   RED],
    cycle:  ["CYCLE",   GOLD],
    signal: ["SIGNAL",  BLUE],
    info:   ["INFO",    "var(--text-muted)"],
    error:  ["ERREUR",  RED],
  };
  const [label, color] = map[type] ?? ["—", "var(--text-muted)"];
  return (
    <span style={{
      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", padding: "0.1rem 0.4rem",
      borderRadius: 2, border: `1px solid ${color}`, color, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export default function TradingPage() {
  const [tradingMode, setTradingMode] = useState<TradingMode>("standard");
  const [modeChanging, setModeChanging] = useState(false);
  const [resetBalance, setResetBalance] = useState(10000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedChartTicker, setSelectedChartTicker] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVData | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "chart" | "config">("dashboard");

  // AI Strategy Builder
  const [aiDescription, setAiDescription] = useState("");
  const [aiCapital, setAiCapital] = useState(10000);
  const [aiRisk, setAiRisk] = useState("modéré");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIStrategyResult | null>(null);
  const [aiError, setAiError] = useState("");

  // Live engine
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [countdown, setCountdown] = useState(CYCLE_INTERVAL_SECONDS);
  const [cycleCount, setCycleCount] = useState(0);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [lastCycleTime, setLastCycleTime] = useState<string | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const { data: summary, mutate: mutatePortfolio } = useSWR<PortfolioSummary>(
    "portfolio-summary", getPortfolioSummary, { refreshInterval: 10000 }
  );
  const { data: metrics } = useSWR<PerformanceMetrics>(
    "portfolio-metrics", getPortfolioMetrics, { refreshInterval: 20000 }
  );
  const { data: tradingStatus, mutate: mutateStatus } = useSWR<TradingStatus>(
    "trading-status", getTradingStatus as any, { refreshInterval: 8000 }
  );
  const { data: settings, mutate: mutateSettings } = useSWR<RiskSettings>(
    "trading-settings", getTradingSettings as any, { refreshInterval: 60000 }
  );
  const { data: trades, mutate: mutateTrades } = useSWR<Trade[]>("portfolio-trades", getPortfolioTrades as any, { refreshInterval: 15000 });
  const { data: logs } = useSWR<TradingLog[]>("portfolio-logs", () => getPortfolioLogs(50) as any, { refreshInterval: 8000 });
  const { data: snapshots } = useSWR<PortfolioSnapshot[]>("portfolio-snapshots", getPortfolioSnapshots as any, { refreshInterval: 30000 });
  const { data: lastCycle, mutate: mutateLastCycle } = useSWR("last-cycle", getLastCycle, { refreshInterval: 10000 });
  const { data: modeData, mutate: mutateMode } = useSWR("trading-mode", () => fetch("/api/trading/mode").then(r => r.json()), { refreshInterval: 30000 });
  useEffect(() => { if (modeData?.current_mode) setTradingMode(modeData.current_mode as TradingMode); }, [modeData]);

  const [localSettings, setLocalSettings] = useState<RiskSettings>({
    strategy: "combined", tickers: ALL_TICKERS.slice(0, 5),
    stop_loss: -2.5, take_profit: 4.0, max_position: 20, max_positions: 5,
  });
  useEffect(() => { if (settings) setLocalSettings(settings); }, [settings]);

  const isEnabled = tradingStatus?.is_enabled ?? false;
  const initial = summary?.initial_balance ?? 10000;
  const totalPnl = summary?.total_pnl ?? 0;
  const totalPnlPct = summary?.total_pnl_pct ?? 0;

  const addEvent = useCallback((e: Omit<LiveEvent, "id" | "time">) => {
    setLiveEvents(prev => [newEvent(e), ...prev].slice(0, 200));
  }, []);

  const msg = (m: string) => { setActionMsg(m); setTimeout(() => setActionMsg(""), 4000); };

  const handleRunCycle = useCallback(async (auto = false) => {
    if (cycleRunning) return;
    setCycleRunning(true);
    if (!auto) addEvent({ type: "cycle", message: "Cycle manuel déclenché…" });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
      const res = await fetch("/api/trading/cycle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      const now = new Date().toLocaleTimeString("fr-FR");
      setLastCycleTime(now);
      setCycleCount(c => c + 1);

      if (data.skipped) {
        addEvent({ type: "info", message: `Cycle ignoré : ${data.skipped}` });
      } else {
        const actions: any[] = data.actions ?? [];
        const checks: any[] = data.checks ?? [];

        addEvent({ type: "cycle", message: `Cycle #${cycleCount + 1} — ${checks.length} ticker(s) analysé(s), ${actions.length} action(s)` });

        for (const a of actions) {
          addEvent({
            type: a.side === "buy" ? "buy" : "sell",
            ticker: a.ticker, price: a.price, shares: a.shares,
            message: `${a.side === "buy" ? "Achat" : "Vente"} ${a.shares?.toFixed(2)} × ${a.ticker} @ ${a.price?.toFixed(2)}€ — ${a.reason ?? ""}`,
          });
        }

        for (const c of checks) {
          if (c.signal && c.signal !== "neutre" && !actions.find((a: any) => a.ticker === c.ticker)) {
            addEvent({
              type: "signal", ticker: c.ticker,
              message: `Signal ${c.signal?.toUpperCase()} sur ${c.ticker} (score ${c.score > 0 ? "+" : ""}${c.score}) — non exécuté`,
            });
          }
        }

        mutatePortfolio(); mutateStatus(); mutateLastCycle(); mutateTrades();
      }
    } catch (e: any) {
      addEvent({ type: "error", message: `Erreur cycle : ${e.message}` });
    } finally {
      setCycleRunning(false);
    }
  }, [cycleRunning, cycleCount, addEvent, mutatePortfolio, mutateStatus, mutateLastCycle, mutateTrades]);

  // Auto-cycle engine (browser-driven since Vercel Hobby cron = once/day)
  useEffect(() => {
    if (!isEnabled) {
      if (cycleRef.current) clearInterval(cycleRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(CYCLE_INTERVAL_SECONDS);
      return;
    }

    // Countdown tick
    setCountdown(CYCLE_INTERVAL_SECONDS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? CYCLE_INTERVAL_SECONDS : c - 1));
    }, 1000);

    // Cycle trigger
    if (cycleRef.current) clearInterval(cycleRef.current);
    cycleRef.current = setInterval(() => {
      handleRunCycle(true);
    }, CYCLE_INTERVAL_SECONDS * 1000);

    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetMode = async (mode: TradingMode) => {
    setModeChanging(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
      await fetch("/api/trading/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode }),
      });
      setTradingMode(mode);
      mutateMode();
      const m = TRADING_MODES[mode];
      addEvent({ type: "info", message: `Mode changé : ${m.name} — ${m.description}` });
      msg(`Mode "${m.name}" activé.`);
    } finally {
      setModeChanging(false);
    }
  };

  const handleStart = async () => {
    await startTrading(); mutateStatus();
    addEvent({ type: "info", message: "Trading automatique démarré — cycles auto toutes les " + CYCLE_INTERVAL_SECONDS + "s" });
    msg("Trading démarré. Premier cycle dans " + CYCLE_INTERVAL_SECONDS + "s.");
    setTimeout(() => handleRunCycle(true), 1500);
  };
  const handleStop = async () => {
    await stopTrading(); mutateStatus();
    addEvent({ type: "info", message: "Trading arrêté." });
    msg("Trading arrêté.");
  };
  const handleReset = async () => {
    if (!confirm("Réinitialiser ? Toutes positions et trades effacés.")) return;
    await stopTrading(); await resetPortfolio(resetBalance);
    mutatePortfolio(); mutateStatus();
    setLiveEvents([]); setCycleCount(0);
    addEvent({ type: "info", message: `Portefeuille réinitialisé à ${resetBalance}€` });
    msg("Portefeuille réinitialisé.");
  };
  const handleSaveSettings = async () => {
    setSaving(true);
    await updateTradingSettings(localSettings as any);
    mutateSettings(); setSaving(false); msg("Paramètres sauvegardés.");
  };

  const generateAIStrategy = async () => {
    if (!aiDescription.trim()) return;
    setAiLoading(true); setAiError(""); setAiResult(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
      const res = await fetch("/api/ai/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ description: aiDescription, capital: aiCapital, risk_tolerance: aiRisk }),
      });
      const json = await res.json();
      if (!res.ok || json.error) setAiError(json.error || "Erreur inconnue");
      else setAiResult(json as AIStrategyResult);
    } catch (e: any) {
      setAiError(e.message || "Erreur réseau");
    } finally {
      setAiLoading(false);
    }
  };

  const applyProfile = (key: keyof typeof PROFILES) => {
    const p = PROFILES[key];
    setLocalSettings(prev => ({ ...prev, strategy: p.strategy, stop_loss: p.stop_loss, take_profit: p.take_profit, max_position: p.max_position, max_positions: p.max_positions }));
    msg(`Profil "${p.name}" appliqué.`);
  };

  const applyAIStrategy = () => {
    if (!aiResult) return;
    setLocalSettings(prev => ({ ...prev, strategy: aiResult.strategy, tickers: aiResult.tickers, stop_loss: aiResult.stop_loss, take_profit: aiResult.take_profit, max_position: aiResult.max_position, max_positions: aiResult.max_positions }));
    msg(`Stratégie "${aiResult.profile_name}" appliquée.`);
  };

  const loadChart = useCallback(async (ticker: string) => {
    setSelectedChartTicker(ticker); setActiveTab("chart");
    try {
      const data = await getMarketHistory(ticker, "1mo") as OHLCVData;
      setChartData(data);
    } catch {}
  }, []);

  // ── Render helpers ──────────────────────────────────────────────

  const countdownPct = ((CYCLE_INTERVAL_SECONDS - countdown) / CYCLE_INTERVAL_SECONDS) * 100;
  const countdownColor = countdown < 15 ? RED : countdown < 30 ? ORANGE : GREEN;

  return (
    <div className="page-layout">
      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-label">Configuration</div>
        <Link href="/" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          ← Accueil
        </Link>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1rem" }}>
          {(["dashboard", "chart", "config"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, fontSize: "0.62rem", padding: "0.3rem 0.2rem",
              background: activeTab === t ? "rgba(201,168,76,0.15)" : "var(--surface2)",
              border: `1px solid ${activeTab === t ? "rgba(201,168,76,0.4)" : "var(--border)"}`,
              borderRadius: 3, color: activeTab === t ? GOLD : "var(--text-muted)", cursor: "pointer",
              fontWeight: activeTab === t ? 700 : 400, textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              {t === "dashboard" ? "Live" : t === "chart" ? "Chart" : "Config"}
            </button>
          ))}
        </div>

        {/* Mode de trading */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.5rem" }}>Mode de trading</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {(Object.entries(TRADING_MODES) as [TradingMode, typeof TRADING_MODES[TradingMode]][]).map(([key, m]) => {
              const active = tradingMode === key;
              return (
                <button
                  key={key}
                  disabled={modeChanging}
                  onClick={() => handleSetMode(key)}
                  style={{
                    padding: "0.45rem 0.6rem", borderRadius: 3, cursor: "pointer",
                    background: active ? `rgba(${key === "ultra" ? "200,72,72" : key === "aggressive" ? "212,131,74" : key === "standard" ? "74,143,212" : "61,158,110"},0.12)` : "var(--surface2)",
                    border: `1px solid ${active ? m.color : "var(--border)"}`,
                    textAlign: "left", transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: active ? m.color : "var(--text-secondary)" }}>{m.name}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>{m.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Strategy Builder (always visible) */}
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 4 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.6rem" }}>◈ IA Stratège</div>
          <textarea
            value={aiDescription} onChange={(e) => setAiDescription(e.target.value)}
            placeholder="Ex: Investir prudemment dans les grandes cap françaises, secteur défense, 5000€, horizon 1 an…"
            style={{ width: "100%", minHeight: 70, padding: "0.5rem", fontSize: "0.72rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-primary)", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
            <input type="number" min={500} step={500} value={aiCapital} onChange={(e) => setAiCapital(+e.target.value)} className="input" style={{ flex: 1, fontSize: "0.72rem" }} placeholder="Capital €" />
            <select value={aiRisk} onChange={(e) => setAiRisk(e.target.value)} className="select" style={{ flex: 1, fontSize: "0.72rem" }}>
              <option value="faible">Faible</option>
              <option value="modéré">Modéré</option>
              <option value="élevé">Élevé</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem", fontSize: "0.72rem" }} onClick={generateAIStrategy} disabled={aiLoading || !aiDescription.trim()}>
            {aiLoading ? "Analyse…" : "Générer ma stratégie"}
          </button>
          {aiError && <div style={{ fontSize: "0.7rem", color: RED, marginTop: "0.4rem", padding: "0.3rem 0.5rem", background: "rgba(200,72,72,0.08)", borderRadius: 3 }}>{aiError}</div>}
        </div>

        {activeTab === "config" && (
          <>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Profil de risque</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "1rem" }}>
              {Object.entries(PROFILES).map(([k, p]) => (
                <button key={k} className="btn btn-secondary" style={{ fontSize: "0.72rem", justifyContent: "flex-start" }} onClick={() => applyProfile(k as keyof typeof PROFILES)}>{p.name}</button>
              ))}
            </div>
            <hr style={{ borderColor: "var(--border)", marginBottom: "1rem" }} />
            <label>Stratégie</label>
            <select className="select" style={{ marginBottom: "1rem" }} value={localSettings.strategy} onChange={(e) => setLocalSettings({ ...localSettings, strategy: e.target.value })}>
              {Object.entries(STRATEGY_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label>Tickers surveillés</label>
            <div style={{ maxHeight: 130, overflowY: "auto", marginBottom: "1rem", border: "1px solid var(--border)", borderRadius: 3, padding: "0.4rem" }}>
              {ALL_TICKERS.map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: 2, textTransform: "none", letterSpacing: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={localSettings.tickers.includes(t)} onChange={(e) => setLocalSettings({ ...localSettings, tickers: e.target.checked ? [...localSettings.tickers, t] : localSettings.tickers.filter(x => x !== t) })} style={{ accentColor: GOLD }} />
                  {t}
                </label>
              ))}
            </div>
            <button className="btn" style={{ fontSize: "0.65rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }} onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? "▲" : "▼"} Paramètres avancés
            </button>
            {showAdvanced && (
              <>
                <label>Stop-Loss (%)</label>
                <input type="range" min={-10} max={-0.5} step={0.5} value={localSettings.stop_loss} onChange={(e) => setLocalSettings({ ...localSettings, stop_loss: +e.target.value })} style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }} />
                <div style={{ fontSize: "0.72rem", color: RED, marginBottom: "0.75rem" }}>{localSettings.stop_loss}%</div>
                <label>Take-Profit (%)</label>
                <input type="range" min={0.5} max={15} step={0.5} value={localSettings.take_profit} onChange={(e) => setLocalSettings({ ...localSettings, take_profit: +e.target.value })} style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }} />
                <div style={{ fontSize: "0.72rem", color: GREEN, marginBottom: "0.75rem" }}>+{localSettings.take_profit}%</div>
                <label>Max position (%)</label>
                <input type="range" min={5} max={50} step={5} value={localSettings.max_position} onChange={(e) => setLocalSettings({ ...localSettings, max_position: +e.target.value })} style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }} />
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>{localSettings.max_position}%</div>
                <label>Max positions ouvertes</label>
                <input type="range" min={1} max={10} step={1} value={localSettings.max_positions} onChange={(e) => setLocalSettings({ ...localSettings, max_positions: +e.target.value })} style={{ width: "100%", accentColor: GOLD, marginBottom: "0.25rem" }} />
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>{localSettings.max_positions}</div>
              </>
            )}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </>
        )}

        {/* Reset + balance (always visible at bottom) */}
        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.4rem" }}>
            <input type="number" min={100} step={100} value={resetBalance} onChange={(e) => setResetBalance(+e.target.value)} className="input" style={{ flex: 1, fontSize: "0.72rem" }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>€ initial</span>
          </div>
          <button className="btn btn-danger" style={{ width: "100%", fontSize: "0.72rem" }} onClick={handleReset}>Réinitialiser</button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="main-content">

        {/* ── COMMAND BAR ──────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem",
          background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 5,
          marginBottom: "1.25rem", flexWrap: "wrap",
        }}>
          {/* Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Pulse active={isEnabled} />
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isEnabled ? GREEN : "var(--text-muted)" }}>
              {isEnabled ? "TRADING ACTIF" : "TRADING INACTIF"}
            </span>
          </div>

          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          {/* Market status */}
          {tradingStatus && (
            <span style={{ fontSize: "0.72rem", color: tradingStatus.market.is_open ? GREEN : "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: tradingStatus.market.is_open ? GREEN : "var(--text-muted)", display: "inline-block" }} />
              {tradingStatus.market.is_open ? "Marché ouvert" : "Marché fermé"}
            </span>
          )}

          {/* Countdown */}
          {isEnabled && (
            <>
              <div style={{ width: 1, height: 20, background: "var(--border)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ position: "relative", width: 28, height: 28 }}>
                  <svg width="28" height="28" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="14" cy="14" r="11" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle cx="14" cy="14" r="11" fill="none" stroke={countdownColor} strokeWidth="3"
                      strokeDasharray={`${2 * Math.PI * 11}`}
                      strokeDashoffset={`${2 * Math.PI * 11 * (1 - countdownPct / 100)}`}
                      style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
                    />
                  </svg>
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 700, color: countdownColor }}>{countdown}</span>
                </div>
                <div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Prochain cycle</div>
                  <div style={{ fontSize: "0.7rem", color: countdownColor, fontWeight: 600 }}>{countdown}s</div>
                </div>
              </div>
            </>
          )}

          {/* Active mode + ticker count */}
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 2,
              background: `rgba(${tradingMode === "ultra" ? "200,72,72" : tradingMode === "aggressive" ? "212,131,74" : tradingMode === "standard" ? "74,143,212" : "61,158,110"},0.12)`,
              border: `1px solid ${TRADING_MODES[tradingMode].color}`,
              color: TRADING_MODES[tradingMode].color, textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              {TRADING_MODES[tradingMode].name}
            </span>
            {lastCycle?.tickers_count && (
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{lastCycle.tickers_count} tickers</span>
            )}
          </div>

          {/* Cycle stats */}
          {cycleCount > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: "var(--border)" }} />
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                <span style={{ color: GOLD, fontWeight: 600 }}>{cycleCount}</span> cycle(s)
                {lastCycleTime && <span style={{ color: "var(--text-muted)" }}> · dernier {lastCycleTime}</span>}
              </div>
            </>
          )}

          {/* Controls */}
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={handleStart} disabled={isEnabled} style={{ fontSize: "0.75rem" }}>
              ▶ Démarrer
            </button>
            <button className="btn btn-secondary" onClick={handleStop} disabled={!isEnabled} style={{ fontSize: "0.75rem" }}>
              ■ Arrêter
            </button>
            <button
              className="btn btn-secondary" onClick={() => handleRunCycle(false)}
              disabled={cycleRunning} style={{ fontSize: "0.75rem", opacity: cycleRunning ? 0.6 : 1 }}
              title="Forcer un cycle maintenant"
            >
              {cycleRunning ? "⟳ Analyse…" : "⟳ Cycle maintenant"}
            </button>
          </div>
        </div>

        {actionMsg && (
          <div style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 3, padding: "0.5rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: GOLD }}>
            {actionMsg}
          </div>
        )}

        {/* ── AI RESULT ────────────────────────────────────────── */}
        {aiResult && (
          <div style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 5, padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.15em" }}>◈ Stratégie IA</span>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.15rem" }}>{aiResult.profile_name}</div>
              </div>
              <button className="btn btn-primary" onClick={applyAIStrategy} style={{ fontSize: "0.75rem" }}>Appliquer</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.6rem", marginBottom: "0.9rem" }}>
              {[
                { label: "Stratégie", value: STRATEGY_DESCRIPTIONS[aiResult.strategy] ?? aiResult.strategy },
                { label: "Stop-Loss",   value: `${aiResult.stop_loss}%`, color: RED },
                { label: "Take-Profit", value: `+${aiResult.take_profit}%`, color: GREEN },
                { label: "Max position", value: `${aiResult.max_position}%` },
                { label: "Max positions", value: String(aiResult.max_positions) },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--surface2)", borderRadius: 3, padding: "0.5rem 0.6rem" }}>
                  <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem" }}>{label}</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: color ?? "var(--text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.6rem" }}>
              {aiResult.tickers.map((t) => (
                <span key={t} style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 3, color: GOLD, fontWeight: 600 }}>{t}</span>
              ))}
            </div>
            {aiResult.reasoning && <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 0.5rem" }}>{aiResult.reasoning}</p>}
            {aiResult.warnings && (
              <div style={{ background: "rgba(212,131,74,0.08)", border: "1px solid rgba(212,131,74,0.25)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 600, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚠ Vigilance — </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{aiResult.warnings}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === "chart" && selectedChartTicker && chartData ? (
          /* ── CHART TAB ──────────────────────────────────────── */
          <>
            <SectionTitle right={<button className="btn btn-secondary" style={{ fontSize: "0.7rem" }} onClick={() => setActiveTab("dashboard")}>← Retour</button>}>
              Graphique — {selectedChartTicker}
            </SectionTitle>
            <div className="chart-container">
              <Plot
                data={[
                  { type: "candlestick", x: chartData.dates, open: chartData.open, high: chartData.high, low: chartData.low, close: chartData.close, name: selectedChartTicker, increasing: { line: { color: GREEN } }, decreasing: { line: { color: RED } } },
                  ...(chartData.SMA_20 ? [{ type: "scatter" as const, x: chartData.dates, y: chartData.SMA_20, name: "SMA 20", line: { color: GOLD, width: 1.5 } }] : []),
                ]}
                layout={{
                  title: { text: selectedChartTicker, font: { color: "var(--text-primary)", size: 13 } },
                  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                  height: 380, margin: { l: 50, r: 20, t: 50, b: 40 },
                  xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, rangeslider: { visible: false } },
                  yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                  legend: { font: { color: "var(--text-secondary)", size: 10 } },
                  shapes: summary?.positions?.filter(p => p.ticker === selectedChartTicker).flatMap(p => [
                    p.stop_loss ? { type: "line" as const, x0: chartData.dates[0], x1: chartData.dates[chartData.dates.length - 1], y0: p.stop_loss, y1: p.stop_loss, line: { color: RED, dash: "dot", width: 1 } } : null,
                    p.take_profit ? { type: "line" as const, x0: chartData.dates[0], x1: chartData.dates[chartData.dates.length - 1], y0: p.take_profit, y1: p.take_profit, line: { color: GREEN, dash: "dot", width: 1 } } : null,
                  ]).filter(Boolean) as any ?? [],
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
              />
            </div>
          </>
        ) : (
          /* ── DASHBOARD TAB ───────────────────────────────────── */
          <>
            {/* ── TOP ROW : Portfolio + Performance ──────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>

              {/* Portfolio */}
              <div>
                <SectionTitle>Portefeuille Virtuel</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <MetricCard label="Valeur totale" value={fmt(summary?.total_value)} glow />
                  <MetricCard label="Cash disponible" value={fmt(summary?.cash)} />
                  <MetricCard label="Positions" value={fmt(summary?.positions_value)} />
                  <MetricCard label="Positions ouvertes" value={String(summary?.num_positions ?? "—")} />
                  <MetricCard
                    label="P&L Total"
                    value={`${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`}
                    sub={fmtPct(totalPnlPct)}
                    color={totalPnl >= 0 ? GREEN : RED}
                  />
                  <MetricCard label="Mise initiale" value={fmt(initial)} />
                </div>
              </div>

              {/* Performance */}
              <div>
                <SectionTitle>Performance</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <MetricCard label="Win Rate" value={metrics ? `${metrics.win_rate.toFixed(1)}%` : "—"} color={metrics && metrics.win_rate >= 50 ? GREEN : RED} />
                  <MetricCard label="Trades total" value={String(metrics?.total_trades ?? "—")} />
                  <MetricCard label="P&L réalisé" value={fmt(metrics?.total_pnl)} color={metrics && metrics.total_pnl >= 0 ? GREEN : RED} />
                  <MetricCard label="Max Drawdown" value={fmt(metrics?.max_drawdown)} color={RED} />
                  <MetricCard label="Sharpe Ratio" value={metrics ? metrics.sharpe_ratio.toFixed(2) : "—"} color={metrics && metrics.sharpe_ratio >= 1 ? GREEN : ORANGE} />
                  <MetricCard label="Clôturés" value={String(metrics?.closed_trades ?? "—")} />
                </div>
              </div>
            </div>

            {/* ── LIVE TICKER TABLE + FEED (2-col) ───────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1rem", marginBottom: "1.25rem" }}>

              {/* Last cycle analysis table */}
              <div>
                <SectionTitle right={
                  lastCycle?.ran_at && (
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                      {cycleRunning ? <span style={{ color: GOLD }}>⟳ Analyse en cours…</span> : <>mis à jour {new Date(lastCycle.ran_at).toLocaleTimeString("fr-FR")}</>}
                    </span>
                  )
                }>
                  Analyse Temps Réel
                </SectionTitle>
                {!lastCycle || (!lastCycle.ran_at && !(lastCycle.checks?.length)) ? (
                  <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
                      {isEnabled ? "Premier cycle en cours de démarrage…" : "Démarrez le trading pour voir l'analyse en direct."}
                    </p>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                    <table className="trading-table">
                      <thead>
                        <tr>
                          <th>Ticker</th><th>Prix</th><th>Signal</th><th>Score</th>
                          <th>Position</th><th>Décision</th><th>Détails</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(lastCycle.checks || []).map((c: any) => {
                          const sigColor = c.signal === "achat" ? GREEN : c.signal === "vente" ? RED : "var(--text-muted)";
                          const isAction = c.decision?.startsWith("✓");
                          return (
                            <tr key={c.ticker} style={isAction ? { background: "rgba(61,158,110,0.07)" } : undefined}>
                              <td style={{ color: GOLD, fontWeight: 600 }}>{c.ticker}</td>
                              <td style={{ fontSize: "0.75rem" }}>{c.price ? `${c.price.toFixed(2)}€` : "—"}</td>
                              <td>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: sigColor, textTransform: "uppercase" }}>
                                  {c.error ? "⚠" : c.signal ?? "—"}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: "0.75rem", color: c.score > 0.3 ? GREEN : c.score < -0.3 ? RED : "var(--text-secondary)", fontWeight: 600 }}>
                                  {c.score != null ? (c.score > 0 ? "+" : "") + c.score : "—"}
                                </span>
                              </td>
                              <td style={{ fontSize: "0.7rem" }}>
                                {c.has_position ? <span style={{ color: CYAN }}>● Ouvert</span> : <span style={{ color: "var(--text-muted)" }}>○ Libre</span>}
                              </td>
                              <td style={{ fontSize: "0.72rem", color: isAction ? GREEN : "var(--text-secondary)", fontWeight: isAction ? 600 : 400 }}>
                                {c.decision || "—"}
                              </td>
                              <td style={{ fontSize: "0.68rem", color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.details}>
                                {c.details || c.error || ""}
                              </td>
                              <td>
                                <button style={{ fontSize: "0.62rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }} onClick={() => loadChart(c.ticker)}>
                                  ↗
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Live event feed */}
              <div>
                <SectionTitle right={
                  liveEvents.length > 0 && (
                    <button onClick={() => setLiveEvents([])} style={{ fontSize: "0.6rem", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>Effacer</button>
                  )
                }>
                  Flux en Direct
                </SectionTitle>
                <div ref={feedRef} style={{
                  height: 340, overflowY: "auto", background: "var(--surface2)",
                  border: "1px solid var(--border)", borderRadius: 4,
                  display: "flex", flexDirection: "column", gap: "1px",
                }}>
                  {liveEvents.length === 0 ? (
                    <div style={{ padding: "1rem", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: "auto", marginBottom: "auto" }}>
                      {isEnabled ? "En attente d'événements…" : "Démarrez le trading pour voir les événements."}
                    </div>
                  ) : (
                    liveEvents.map(e => (
                      <div key={e.id} style={{
                        display: "flex", gap: "0.5rem", alignItems: "flex-start",
                        padding: "0.4rem 0.6rem", borderBottom: "1px solid rgba(255,255,255,0.03)",
                        background: e.type === "buy" ? "rgba(61,158,110,0.04)" : e.type === "sell" ? "rgba(200,72,72,0.04)" : "transparent",
                      }}>
                        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", whiteSpace: "nowrap", paddingTop: "0.1rem" }}>{e.time}</span>
                        <EventTypeTag type={e.type} />
                        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.4, flex: 1 }}>{e.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── OPEN POSITIONS ───────────────────────────────── */}
            {summary?.positions && summary.positions.length > 0 && (
              <>
                <SectionTitle>Positions Ouvertes</SectionTitle>
                <div className="card" style={{ padding: 0, marginBottom: "1.25rem" }}>
                  <table className="trading-table">
                    <thead>
                      <tr>
                        <th>Ticker</th><th>Actions</th><th>Entrée</th><th>Cours actuel</th>
                        <th>Valeur</th><th>P&L €</th><th>P&L %</th><th>Stop-Loss</th><th>Take-Profit</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.positions.map((pos) => (
                        <tr key={pos.ticker}>
                          <td style={{ color: GOLD, fontWeight: 700 }}>{pos.ticker}</td>
                          <td>{pos.shares.toFixed(2)}</td>
                          <td>{fmt(pos.entry_price)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(pos.current_price)}</td>
                          <td>{fmt(pos.current_value)}</td>
                          <td><PosColor value={pos.pnl ?? null} /></td>
                          <td><PosColor value={pos.pnl_pct ?? null} suffix="%" /></td>
                          <td style={{ color: RED }}>{pos.stop_loss ? fmt(pos.stop_loss) : "—"}</td>
                          <td style={{ color: GREEN }}>{pos.take_profit ? fmt(pos.take_profit) : "—"}</td>
                          <td>
                            <button style={{ fontSize: "0.65rem", color: CYAN, background: "none", border: "none", cursor: "pointer" }} onClick={() => loadChart(pos.ticker)}>Graphique ↗</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── PERFORMANCE CURVE ────────────────────────────── */}
            {snapshots && snapshots.length > 1 && (
              <>
                <SectionTitle>Courbe de Performance</SectionTitle>
                <div className="chart-container" style={{ marginBottom: "1.25rem" }}>
                  <Plot
                    data={[{
                      type: "scatter", x: snapshots.map(s => s.snapshot_at), y: snapshots.map(s => s.total_value),
                      mode: "lines", name: "Valeur totale", line: { color: GOLD, width: 2 },
                      fill: "tozeroy", fillcolor: "rgba(201,168,76,0.06)",
                    }]}
                    layout={{
                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                      height: 280, margin: { l: 50, r: 20, t: 20, b: 40 },
                      xaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 } },
                      yaxis: { gridcolor: "rgba(201,168,76,0.06)", tickfont: { color: "var(--text-muted)", size: 10 }, side: "right" },
                      shapes: [{ type: "line", x0: snapshots[0]?.snapshot_at, x1: snapshots[snapshots.length-1]?.snapshot_at, y0: initial, y1: initial, line: { color: "rgba(201,168,76,0.3)", dash: "dash", width: 1 } }],
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}

            {/* ── TRADE HISTORY + LOGS (2-col) ─────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

              {/* Trade history */}
              <div>
                <SectionTitle>Historique des Trades</SectionTitle>
                {trades && trades.length > 0 ? (
                  <div className="card" style={{ padding: 0 }}>
                    <table className="trading-table">
                      <thead>
                        <tr><th>Heure</th><th>Ticker</th><th>Type</th><th>Actions</th><th>Prix</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {(trades as Trade[]).slice(0, 30).map((t) => (
                          <tr key={t.id}>
                            <td style={{ fontSize: "0.68rem" }}>{new Date(t.executed_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" })}</td>
                            <td style={{ color: GOLD, fontWeight: 600 }}>{t.ticker}</td>
                            <td style={{ color: t.side === "buy" ? GREEN : RED, fontWeight: 700, fontSize: "0.7rem" }}>{t.side === "buy" ? "ACHAT" : "VENTE"}</td>
                            <td>{t.shares.toFixed(2)}</td>
                            <td>{fmt(t.price)}</td>
                            <td>{fmt(t.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>Aucun trade exécuté.</p>
                  </div>
                )}
              </div>

              {/* System logs */}
              <div>
                <SectionTitle>Logs Système</SectionTitle>
                {logs && logs.length > 0 ? (
                  <div className="log-terminal" style={{ maxHeight: 320, overflowY: "auto" }}>
                    {(logs as TradingLog[]).map((log) => {
                      const colors: Record<string, string> = { INFO: "var(--text-secondary)", WARNING: ORANGE, ERROR: RED };
                      return (
                        <div key={log.id} style={{ marginBottom: "0.2rem" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>{log.created_at}</span>
                          {" "}<span style={{ color: colors[log.level] ?? "var(--text-muted)", fontWeight: 600 }}>[{log.level}]</span>
                          {" "}<span style={{ color: "var(--text-secondary)" }}>{log.message}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>Aucun log.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <p style={{ marginTop: "2rem", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          Paper trading — simulation avec argent fictif. Les résultats passés ne garantissent pas les performances futures.
        </p>
      </main>

      <style jsx global>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(61,158,110,0.7); }
          70%  { box-shadow: 0 0 0 8px rgba(61,158,110,0); }
          100% { box-shadow: 0 0 0 0 rgba(61,158,110,0); }
        }
      `}</style>
    </div>
  );
}
