"""Backtester : rejoue une stratégie sur des données OHLCV historiques."""

import math
import pandas as pd
from typing import Optional

from analysis.technical import compute_indicators
from data.market_data import get_historical_data


def _sig(strategy_name: str, df_up_to: pd.DataFrame) -> str:
    """Retourne 'achat', 'vente' ou 'neutre' pour une barre donnée."""
    from analysis.strategy import STRATEGY_MAP, combined_strategy
    fn = STRATEGY_MAP.get(strategy_name, combined_strategy)
    res = fn(df_up_to)
    return res.get("signal", "neutre")


def run_backtest(
    ticker: str,
    strategy_name: str = "combined",
    period: str = "2y",
    initial_capital: float = 10_000.0,
    stop_loss_pct: float = 0.05,
    take_profit_pct: float = 0.10,
    position_size_pct: float = 0.95,   # fraction du capital investie par trade
) -> dict:
    """
    Rejoue `strategy_name` barre par barre sur `period` d'historique.

    Règles :
      - 1 seule position ouverte à la fois
      - Achat au Close de la barre qui génère le signal
      - Stop-loss et take-profit évalués à chaque barre suivante
      - Vente au Close de la barre qui déclenche SL/TP ou signal de vente
      - Pas de lookahead : le signal au bar i utilise uniquement df[0..i]

    Retourne un dict avec equity_curve, trades, metrics.
    """
    df = get_historical_data(ticker, period=period, interval="1d")
    if df is None or len(df) < 60:
        return {"error": f"Données insuffisantes pour {ticker} sur {period}"}

    df = compute_indicators(df.copy())
    df = df.dropna(subset=["Close"])
    dates = list(df.index)
    closes = list(df["Close"])
    n = len(dates)

    capital = initial_capital
    position: Optional[dict] = None   # {shares, entry_price, stop, target}
    equity_curve: list[dict] = []
    trades: list[dict] = []

    for i in range(50, n):   # 50 barres de chauffe pour les indicateurs
        price = closes[i]
        date_str = str(dates[i])[:10]
        df_slice = df.iloc[: i + 1]

        # ── Évaluer stop-loss / take-profit ──────────────────────────────
        if position:
            ep = position["entry_price"]
            if price <= position["stop"]:
                pnl = (price - ep) * position["shares"]
                capital += price * position["shares"]
                trades.append({
                    "date": date_str, "side": "sell", "price": round(price, 4),
                    "shares": round(position["shares"], 4),
                    "pnl": round(pnl, 2), "reason": "stop_loss",
                    "pnl_pct": round((price - ep) / ep * 100, 2),
                })
                position = None
            elif price >= position["target"]:
                pnl = (price - ep) * position["shares"]
                capital += price * position["shares"]
                trades.append({
                    "date": date_str, "side": "sell", "price": round(price, 4),
                    "shares": round(position["shares"], 4),
                    "pnl": round(pnl, 2), "reason": "take_profit",
                    "pnl_pct": round((price - ep) / ep * 100, 2),
                })
                position = None

        # ── Signal de stratégie ───────────────────────────────────────────
        signal = _sig(strategy_name, df_slice)

        if not position and signal == "achat" and capital > price * 1.01:
            shares = (capital * position_size_pct) / price
            cost = shares * price
            capital -= cost
            position = {
                "shares": shares,
                "entry_price": price,
                "stop": price * (1 - stop_loss_pct),
                "target": price * (1 + take_profit_pct),
                "entry_date": date_str,
            }
            trades.append({
                "date": date_str, "side": "buy", "price": round(price, 4),
                "shares": round(shares, 4),
                "pnl": 0.0, "reason": "signal",
                "pnl_pct": 0.0,
            })

        elif position and signal == "vente":
            ep = position["entry_price"]
            pnl = (price - ep) * position["shares"]
            capital += price * position["shares"]
            trades.append({
                "date": date_str, "side": "sell", "price": round(price, 4),
                "shares": round(position["shares"], 4),
                "pnl": round(pnl, 2), "reason": "signal",
                "pnl_pct": round((price - ep) / ep * 100, 2),
            })
            position = None

        # ── Equity curve ──────────────────────────────────────────────────
        total = capital + (position["shares"] * price if position else 0)
        equity_curve.append({
            "date": date_str,
            "equity": round(total, 2),
            "price": round(price, 4),
            "in_position": position is not None,
        })

    # Fermer position ouverte à la dernière barre
    if position and closes:
        last_price = closes[-1]
        ep = position["entry_price"]
        pnl = (last_price - ep) * position["shares"]
        capital += last_price * position["shares"]
        trades.append({
            "date": str(dates[-1])[:10], "side": "sell",
            "price": round(last_price, 4),
            "shares": round(position["shares"], 4),
            "pnl": round(pnl, 2), "reason": "end_of_period",
            "pnl_pct": round((last_price - ep) / ep * 100, 2),
        })
        position = None

    final_equity = capital
    total_return = (final_equity - initial_capital) / initial_capital * 100

    # Buy & Hold
    bh_start = closes[50]
    bh_shares = initial_capital / bh_start
    bh_end = closes[-1] * bh_shares
    bh_return = (bh_end - initial_capital) / initial_capital * 100

    # Métriques
    sell_trades = [t for t in trades if t["side"] == "sell"]
    wins = [t for t in sell_trades if t["pnl"] > 0]
    losses = [t for t in sell_trades if t["pnl"] <= 0]
    win_rate = len(wins) / len(sell_trades) * 100 if sell_trades else 0
    avg_win = sum(t["pnl_pct"] for t in wins) / len(wins) if wins else 0
    avg_loss = sum(t["pnl_pct"] for t in losses) / len(losses) if losses else 0

    # Max drawdown
    peak = initial_capital
    max_dd = 0.0
    for pt in equity_curve:
        eq = pt["equity"]
        if eq > peak:
            peak = eq
        dd = (peak - eq) / peak * 100
        if dd > max_dd:
            max_dd = dd

    # Sharpe ratio (annualisé, rf = 0)
    eq_vals = [pt["equity"] for pt in equity_curve]
    if len(eq_vals) > 1:
        daily_returns = [(eq_vals[i] - eq_vals[i - 1]) / eq_vals[i - 1]
                         for i in range(1, len(eq_vals))]
        mean_r = sum(daily_returns) / len(daily_returns)
        std_r = math.sqrt(sum((r - mean_r) ** 2 for r in daily_returns) / len(daily_returns)) or 1e-9
        sharpe = round((mean_r / std_r) * math.sqrt(252), 2)
    else:
        sharpe = 0.0

    return {
        "ticker": ticker,
        "strategy": strategy_name,
        "period": period,
        "initial_capital": initial_capital,
        "final_equity": round(final_equity, 2),
        "total_return_pct": round(total_return, 2),
        "bh_return_pct": round(bh_return, 2),
        "alpha_pct": round(total_return - bh_return, 2),
        "num_trades": len(sell_trades),
        "win_rate": round(win_rate, 1),
        "avg_win_pct": round(avg_win, 2),
        "avg_loss_pct": round(avg_loss, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "sharpe_ratio": sharpe,
        "equity_curve": equity_curve,
        "trades": trades,
    }
