const BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Trading ───────────────────────────────────────────────────

export const getTradingStatus = () =>
  fetchJSON(`${BASE}/trading/status`);

export const startTrading = () =>
  fetchJSON(`${BASE}/trading/start`, { method: "POST" });

export const stopTrading = () =>
  fetchJSON(`${BASE}/trading/stop`, { method: "POST" });

export const getTradingSettings = () =>
  fetchJSON(`${BASE}/trading/settings`);

export const updateTradingSettings = (settings: Record<string, unknown>) =>
  fetchJSON(`${BASE}/trading/settings`, {
    method: "POST",
    body: JSON.stringify(settings),
  });

// ── Portfolio ─────────────────────────────────────────────────

export const getPortfolioSummary = () =>
  fetchJSON(`${BASE}/portfolio/summary`);

export const getPortfolioMetrics = () =>
  fetchJSON(`${BASE}/portfolio/metrics`);

export const getPortfolioTrades = () =>
  fetchJSON(`${BASE}/portfolio/trades`);

export const getPortfolioLogs = (limit = 50) =>
  fetchJSON(`${BASE}/portfolio/logs?limit=${limit}`);

export const getPortfolioSnapshots = () =>
  fetchJSON(`${BASE}/portfolio/snapshots`);

export const resetPortfolio = (balance?: number) =>
  fetchJSON(`${BASE}/portfolio/reset`, {
    method: "POST",
    body: JSON.stringify({ balance: balance ?? 10000 }),
  });

// ── Market ────────────────────────────────────────────────────

export const getMarketHistory = (ticker: string, period = "6mo") =>
  fetchJSON(`${BASE}/market/history/${encodeURIComponent(ticker)}?period=${period}`);

export const getMarketStatus = () =>
  fetchJSON(`${BASE}/market/status`);

// ── Opportunities ─────────────────────────────────────────────

export const getOpportunityScores = () =>
  fetchJSON(`${BASE}/opportunities/scores`);

export const analyzeOpportunities = (tickers: string[]) =>
  fetchJSON(`${BASE}/opportunities/analyze`, {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });

export const getOpportunityNews = (ticker: string) =>
  fetchJSON(`${BASE}/opportunities/news/${encodeURIComponent(ticker)}`);

export const getAIAdvice = (results: any[]) =>
  fetchJSON(`${BASE}/ai/advisor`, {
    method: "POST",
    body: JSON.stringify({ results }),
  });

// ── DCA ───────────────────────────────────────────────────────

export const getDCASummary = () =>
  fetchJSON(`${BASE}/dca/summary`);

export const getDCAPositions = () =>
  fetchJSON(`${BASE}/dca/positions`);

export const addDCAPosition = (ticker: string, shares: number, avg_price: number) =>
  fetchJSON(`${BASE}/dca/positions`, {
    method: "POST",
    body: JSON.stringify({ ticker, shares, avg_price }),
  });

export const removeDCAPosition = (ticker: string) =>
  fetchJSON(`${BASE}/dca/positions/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
  });

export const getDCARecommendations = () =>
  fetchJSON(`${BASE}/dca/recommendations`);

export const getDCAHistory = () =>
  fetchJSON(`${BASE}/dca/history`);

// ── Config ────────────────────────────────────────────────────

export const getAppConfig = () =>
  fetchJSON(`${BASE}/config`);
