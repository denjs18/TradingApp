export interface PaperPosition {
  id: number;
  ticker: string;
  shares: number;
  entry_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  opened_at: string;
  current_value?: number;
  invested?: number;
  pnl?: number;
  pnl_pct?: number;
}

export interface Trade {
  id: number;
  ticker: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  strategy: string;
  reason: string;
  executed_at: string;
}

export interface TradingLog {
  id: number;
  level: "INFO" | "WARNING" | "ERROR";
  message: string;
  details: string;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: number;
  total_value: number;
  cash: number;
  positions_value: number;
  snapshot_at: string;
}

export interface PortfolioSummary {
  cash: number;
  positions: PaperPosition[];
  positions_value: number;
  total_value: number;
  num_positions: number;
  initial_balance: number;
  total_pnl: number;
  total_pnl_pct: number;
}

export interface PerformanceMetrics {
  total_trades: number;
  closed_trades?: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
  max_drawdown: number;
  sharpe_ratio: number;
}

export interface TradingStatus {
  is_enabled: boolean;
  strategy: string;
  tickers: string[];
  last_run: string | null;
  market: {
    is_open: boolean;
    is_weekday: boolean;
  };
}

export interface RiskSettings {
  stop_loss: number;
  take_profit: number;
  max_position: number;
  max_positions: number;
  strategy: string;
  tickers: string[];
}

export interface OpportunityScore {
  ticker: string;
  name: string;
  sector: string;
  score: number;
  technical_score: number;
  fundamental_score: number;
  sentiment_score: number;
  analyst_score: number;
  recommendation: string;
  current_price: number | null;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  gain_pct: number | null;
  risk_pct: number | null;
  trend: string;
  justification: string;
  computed_at?: string;
}

export interface DCAPosition {
  id: number;
  ticker: string;
  shares: number;
  avg_price: number;
  current_price: number | null;
  invested: number;
  current_value: number | null;
  pnl: number | null;
  pnl_pct: number | null;
}

export interface DCASummary {
  positions: DCAPosition[];
  total_invested: number;
  total_current_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  allocation: Record<string, number>;
}

export interface DCARecommendation {
  ticker: string;
  action: "renforcer" | "conserver" | "alléger";
  reasons: string[];
  tech_score: number;
  fund_score: number;
  current_price: number;
  avg_price: number;
  target_mean: number | null;
  changes: Record<string, number>;
  short_term: string;
  medium_term: string;
  long_term: string;
}

export interface OHLCVData {
  dates: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  SMA_20?: number[];
  SMA_50?: number[];
  SMA_200?: number[];
  RSI?: number[];
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string | null;
}

export interface AppConfig {
  sectors: Record<string, string[]>;
  all_tickers: string[];
  default_favorites: string[];
  strategies: string[];
}
