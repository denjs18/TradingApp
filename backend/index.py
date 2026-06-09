"""API Flask — backend pour l'app de trading Vercel."""

import sys
import os

# Racine du projet dans le path Python (backend/ est un niveau sous la racine)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from flask import Flask, jsonify, request
from flask_cors import CORS

from database.db import init_db, get_db, get_setting, set_setting, USE_POSTGRES
from trading.paper_engine import PaperTradingEngine
from trading.portfolio import (
    get_all_positions, add_position, update_position, remove_position,
    get_portfolio_summary as get_dca_summary,
    get_sector_allocation, get_portfolio_history, save_portfolio_snapshot,
)
from trading.risk_manager import RiskManager
from analysis.strategy import compute_opportunity_score, run_strategy, STRATEGY_MAP
from analysis.technical import compute_indicators, get_technical_summary
from analysis.fundamental import get_fundamental_summary
from data.market_data import (
    get_current_price, get_historical_data, get_market_status, get_price_change,
)
from data.news_fetcher import get_news_for_ticker
from data.analyst_data import get_analyst_recommendations, get_analyst_price_targets
from config import (
    DEFAULT_INITIAL_BALANCE, DEFAULT_STOP_LOSS_PCT, DEFAULT_TAKE_PROFIT_PCT,
    DEFAULT_MAX_POSITION_PCT, DEFAULT_MAX_OPEN_POSITIONS,
    ALL_TICKERS, SECTORS, DEFAULT_FAVORITES, STRATEGIES,
)

app = Flask(__name__)
CORS(app)


@app.errorhandler(Exception)
def handle_exception(e):
    """Retourne toutes les erreurs non gérées en JSON avec le traceback."""
    import traceback
    tb = traceback.format_exc()
    print(f"[ERROR] {e}\n{tb}")
    return jsonify({"error": str(e), "traceback": tb}), 500


# Initialiser la base de données au démarrage
try:
    init_db()
except Exception as e:
    import traceback
    print(f"Warning: init_db failed: {e}\n{traceback.format_exc()}")

engine = PaperTradingEngine()


# ── Helpers ──────────────────────────────────────────────────

def _get_risk_settings() -> dict:
    return {
        "stop_loss": float(get_setting("stop_loss", str(DEFAULT_STOP_LOSS_PCT))),
        "take_profit": float(get_setting("take_profit", str(DEFAULT_TAKE_PROFIT_PCT))),
        "max_position": float(get_setting("max_position", str(DEFAULT_MAX_POSITION_PCT))),
        "max_positions": int(get_setting("max_positions", str(DEFAULT_MAX_OPEN_POSITIONS))),
        "strategy": get_setting("strategy", "combined"),
        "tickers": get_setting("tickers", ",".join(DEFAULT_FAVORITES)).split(","),
    }


def _get_risk_manager() -> RiskManager:
    s = _get_risk_settings()
    return RiskManager(
        stop_loss_pct=s["stop_loss"],
        take_profit_pct=s["take_profit"],
        max_position_pct=s["max_position"],
        max_open_positions=s["max_positions"],
    )


# ── Health ────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "postgres": USE_POSTGRES})


# ── Config ────────────────────────────────────────────────────

@app.route("/api/config")
def get_config():
    return jsonify({
        "sectors": {k: v for k, v in SECTORS.items()},
        "all_tickers": ALL_TICKERS,
        "default_favorites": DEFAULT_FAVORITES,
        "strategies": STRATEGIES,
    })


# ── Trading status & controls ─────────────────────────────────

@app.route("/api/trading/status")
def trading_status():
    enabled = get_setting("trading_enabled", "false") == "true"
    settings = _get_risk_settings()
    market = get_market_status()
    return jsonify({
        "is_enabled": enabled,
        "strategy": settings["strategy"],
        "tickers": settings["tickers"],
        "last_run": get_setting("last_cycle_run", None) or None,
        "market": {
            "is_open": market["is_open"],
            "is_weekday": market["is_weekday"],
        },
    })


@app.route("/api/trading/start", methods=["POST"])
def trading_start():
    set_setting("trading_enabled", "true")
    return jsonify({"success": True})


@app.route("/api/trading/stop", methods=["POST"])
def trading_stop():
    set_setting("trading_enabled", "false")
    return jsonify({"success": True})


@app.route("/api/trading/settings", methods=["GET"])
def get_trading_settings():
    return jsonify(_get_risk_settings())


@app.route("/api/trading/settings", methods=["POST"])
def update_trading_settings():
    data = request.get_json()
    if "stop_loss" in data:
        set_setting("stop_loss", str(data["stop_loss"]))
    if "take_profit" in data:
        set_setting("take_profit", str(data["take_profit"]))
    if "max_position" in data:
        set_setting("max_position", str(data["max_position"]))
    if "max_positions" in data:
        set_setting("max_positions", str(data["max_positions"]))
    if "strategy" in data:
        set_setting("strategy", str(data["strategy"]))
    if "tickers" in data:
        tickers = data["tickers"]
        if isinstance(tickers, list):
            set_setting("tickers", ",".join(tickers))
    return jsonify({"success": True, "settings": _get_risk_settings()})


# ── Portfolio (paper trading) ─────────────────────────────────

@app.route("/api/portfolio/summary")
def portfolio_summary():
    summary = engine.get_portfolio_summary()
    initial = DEFAULT_INITIAL_BALANCE
    total_pnl = summary["total_value"] - initial
    return jsonify({
        **summary,
        "initial_balance": initial,
        "total_pnl": total_pnl,
        "total_pnl_pct": (total_pnl / initial * 100) if initial > 0 else 0,
    })


@app.route("/api/portfolio/metrics")
def portfolio_metrics():
    return jsonify(engine.get_performance_metrics())


@app.route("/api/portfolio/trades")
def portfolio_trades():
    trades = engine.get_all_trades()
    return jsonify(trades)


@app.route("/api/portfolio/logs")
def portfolio_logs():
    limit = int(request.args.get("limit", 50))
    return jsonify(engine.get_logs(limit))


@app.route("/api/portfolio/snapshots")
def portfolio_snapshots():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portfolio_snapshots ORDER BY snapshot_at"
        ).fetchall()
    return jsonify(rows)


@app.route("/api/portfolio/reset", methods=["POST"])
def portfolio_reset():
    data = request.get_json() or {}
    balance = float(data.get("balance", DEFAULT_INITIAL_BALANCE))
    set_setting("trading_enabled", "false")
    engine.reset(balance)
    return jsonify({"success": True})


# ── Market data ───────────────────────────────────────────────

@app.route("/api/market/price/<ticker>")
def market_price(ticker: str):
    price = get_current_price(ticker.upper())
    return jsonify({"ticker": ticker.upper(), "price": price})


@app.route("/api/market/history/<ticker>")
def market_history(ticker: str):
    period = request.args.get("period", "6mo")
    df = get_historical_data(ticker.upper(), period=period)
    if df.empty:
        return jsonify({"error": "no data"}), 404

    df = compute_indicators(df)
    df.index = df.index.astype(str)

    result = {
        "dates": df.index.tolist(),
        "open": df["Open"].round(2).tolist(),
        "high": df["High"].round(2).tolist(),
        "low": df["Low"].round(2).tolist(),
        "close": df["Close"].round(2).tolist(),
        "volume": df["Volume"].tolist(),
    }

    # Indicateurs disponibles
    for col in ["SMA_20", "SMA_50", "SMA_200", "RSI", "MACD", "MACD_Signal"]:
        if col in df.columns:
            result[col] = df[col].round(4).tolist()

    return jsonify(result)


@app.route("/api/market/status")
def market_status_route():
    status = get_market_status()
    return jsonify({
        "is_open": status["is_open"],
        "is_weekday": status["is_weekday"],
    })


# ── Opportunities ─────────────────────────────────────────────

@app.route("/api/opportunities/scores")
def opportunity_scores():
    """Retourne les derniers scores calculés depuis la DB."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT DISTINCT ON (ticker) *
               FROM opportunity_scores
               ORDER BY ticker, computed_at DESC"""
            if USE_POSTGRES else
            """SELECT * FROM opportunity_scores
               WHERE id IN (
                   SELECT MAX(id) FROM opportunity_scores GROUP BY ticker
               )
               ORDER BY score DESC"""
        ).fetchall()
    return jsonify(rows)


@app.route("/api/opportunities/analyze", methods=["POST"])
def opportunity_analyze():
    """Lance l'analyse pour une liste de tickers."""
    data = request.get_json() or {}
    tickers = data.get("tickers", [])
    if not tickers:
        return jsonify({"error": "no tickers"}), 400

    results = []
    errors = []
    for ticker in tickers:
        try:
            opp = compute_opportunity_score(ticker.upper())
            results.append(opp)
            # Sauvegarder en DB
            with get_db() as conn:
                conn.execute(
                    """INSERT INTO opportunity_scores
                       (ticker, score, technical_score, fundamental_score,
                        sentiment_score, recommendation, entry_price,
                        target_price, stop_price, justification)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        opp["ticker"], opp["score"], opp["technical_score"],
                        opp["fundamental_score"], opp["sentiment_score"],
                        opp["recommendation"], opp.get("entry_price"),
                        opp.get("target_price"), opp.get("stop_price"),
                        opp["justification"],
                    ),
                )
        except Exception as e:
            errors.append({"ticker": ticker, "error": str(e)})

    results.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"results": results, "errors": errors})


@app.route("/api/opportunities/news/<ticker>")
def opportunity_news(ticker: str):
    news = get_news_for_ticker(ticker.upper())
    serializable = []
    for item in news[:10]:
        serializable.append({
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "source": item.get("source", ""),
            "published": item["published"].strftime("%d/%m %H:%M") if item.get("published") else None,
        })
    return jsonify(serializable)


# ── DCA Advisor ───────────────────────────────────────────────

@app.route("/api/dca/summary")
def dca_summary():
    summary = get_dca_summary()
    allocation = get_sector_allocation(summary["positions"])
    return jsonify({**summary, "allocation": allocation})


@app.route("/api/dca/positions", methods=["GET"])
def dca_positions():
    return jsonify(get_all_positions())


@app.route("/api/dca/positions", methods=["POST"])
def dca_add_position():
    data = request.get_json()
    ticker = data.get("ticker", "").upper()
    shares = float(data.get("shares", 0))
    avg_price = float(data.get("avg_price", 0))
    if not ticker or shares <= 0 or avg_price <= 0:
        return jsonify({"error": "Données invalides"}), 400
    add_position(ticker, shares, avg_price)
    return jsonify({"success": True})


@app.route("/api/dca/positions/<ticker>", methods=["DELETE"])
def dca_remove_position(ticker: str):
    remove_position(ticker.upper())
    return jsonify({"success": True})


@app.route("/api/dca/recommendations")
def dca_recommendations():
    summary = get_dca_summary()
    recommendations = []

    for pos in summary["positions"]:
        ticker = pos["ticker"]
        current_price = pos.get("current_price")
        avg_price = pos["avg_price"]

        if current_price is None:
            continue

        hist = get_historical_data(ticker, period="6mo")
        tech_summary = get_technical_summary(hist) if not hist.empty else None
        fund_summary = get_fundamental_summary(ticker)
        analyst = get_analyst_recommendations(ticker)
        targets = get_analyst_price_targets(ticker)
        changes = get_price_change(ticker)

        action = "conserver"
        reasons = []

        if current_price < avg_price * 0.95:
            reasons.append(f"Prix ({current_price:.2f}) sous le PRU ({avg_price:.2f})")

        tech_score = tech_summary["overall_score"] if tech_summary else 0
        if tech_score > 0.3:
            reasons.append(f"Signal technique favorable ({tech_score:+.2f})")
        elif tech_score < -0.3:
            reasons.append(f"Signal technique défavorable ({tech_score:+.2f})")

        fund_score = fund_summary["overall_score"]
        if fund_score > 0.3:
            reasons.append("Fondamentaux solides")
        elif fund_score < -0.3:
            reasons.append("Fondamentaux détériorés")

        if analyst.get("recommendation") in ("buy", "strong_buy"):
            reasons.append(f"Consensus analystes : {analyst['recommendation']}")
        elif analyst.get("recommendation") in ("sell", "strong_sell"):
            reasons.append(f"Consensus analystes : {analyst['recommendation']}")

        if targets.get("upside_pct") and targets["upside_pct"] > 15:
            reasons.append(f"Upside potentiel : {targets['upside_pct']:.1f}%")

        bullish = sum(1 for r in reasons if any(
            w in r.lower() for w in ["favorable", "solide", "buy", "sous le pru", "upside"]
        ))
        bearish = sum(1 for r in reasons if any(
            w in r.lower() for w in ["défavorable", "détérioré", "sell"]
        ))

        if bullish >= 2:
            action = "renforcer"
        elif bearish >= 2:
            action = "alléger"

        trend = tech_summary["trend"] if tech_summary else "neutre"
        short_term = f"Tendance {trend}"
        if tech_score > 0.3:
            short_term += " — momentum positif"
        elif tech_score < -0.3:
            short_term += " — momentum négatif"

        medium_term = "Neutre"
        if fund_score > 0.3 and analyst.get("recommendation") in ("buy", "strong_buy"):
            medium_term = "Favorable — fondamentaux et consensus positifs"
        elif fund_score < -0.3:
            medium_term = "Défavorable — fondamentaux en baisse"

        long_term = "Neutre"
        if targets.get("upside_pct"):
            if targets["upside_pct"] > 20:
                long_term = f"Favorable — objectif moyen +{targets['upside_pct']:.0f}%"
            elif targets["upside_pct"] < -10:
                long_term = f"Défavorable — objectif moyen {targets['upside_pct']:.0f}%"

        recommendations.append({
            "ticker": ticker,
            "action": action,
            "reasons": reasons,
            "tech_score": round(tech_score, 2),
            "fund_score": round(fund_score, 2),
            "current_price": current_price,
            "avg_price": avg_price,
            "target_mean": targets.get("target_mean"),
            "changes": {k: v for k, v in (changes or {}).items() if v is not None},
            "short_term": short_term,
            "medium_term": medium_term,
            "long_term": long_term,
        })

    recommendations.sort(
        key=lambda r: (
            {"renforcer": 0, "conserver": 1, "alléger": 2}.get(r["action"], 1),
            -r["tech_score"],
        )
    )
    return jsonify(recommendations)


@app.route("/api/dca/history")
def dca_history():
    save_portfolio_snapshot()
    return jsonify(get_portfolio_history())


# ── Cron (remplace APScheduler) ───────────────────────────────

@app.route("/api/cron", methods=["GET", "POST"])
def cron_cycle():
    """Cycle de trading — appelé par Vercel Cron toutes les minutes."""
    # Vérifier l'autorisation cron
    auth = request.headers.get("Authorization", "")
    cron_secret = os.environ.get("CRON_SECRET", "")
    if cron_secret and auth != f"Bearer {cron_secret}":
        return jsonify({"error": "Unauthorized"}), 401

    enabled = get_setting("trading_enabled", "false") == "true"
    if not enabled:
        return jsonify({"skipped": "trading disabled"})

    settings = _get_risk_settings()
    risk_manager = _get_risk_manager()

    can_trade = risk_manager.can_trade()
    if not can_trade["allowed"]:
        return jsonify({"skipped": can_trade["reason"]})

    results = {"actions": [], "checks": []}

    # 1. Stop-loss / take-profit
    executed = engine.check_stop_loss_take_profit()
    results["actions"].extend(executed)

    # 2. Analyser chaque ticker
    for ticker in settings["tickers"]:
        if not ticker:
            continue
        try:
            result = run_strategy(ticker, settings["strategy"])
            results["checks"].append({
                "ticker": ticker,
                "signal": result["signal"],
                "score": result["score"],
            })
            from config import SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD
            if result["signal"] == "achat" and result["score"] > SCORE_BUY_THRESHOLD:
                if not engine.get_position_for_ticker(ticker):
                    portfolio_value = engine._get_portfolio_value()
                    price = get_current_price(ticker)
                    if price:
                        sizing = risk_manager.calculate_position_size(portfolio_value, price)
                        stop_loss = risk_manager.calculate_stop_loss(price, ticker)
                        take_profit = risk_manager.calculate_take_profit(price, ticker)
                        trade_result = engine.buy(
                            ticker=ticker,
                            shares=sizing["shares"],
                            stop_loss=stop_loss,
                            take_profit=take_profit,
                            strategy=settings["strategy"],
                            reason=result.get("details", "Signal d'achat"),
                        )
                        if trade_result["success"]:
                            results["actions"].append({"type": "buy", "trade": trade_result})

            elif result["signal"] == "vente" and result["score"] < SCORE_SELL_THRESHOLD:
                if engine.get_position_for_ticker(ticker):
                    trade_result = engine.sell(
                        ticker=ticker,
                        strategy=settings["strategy"],
                        reason=result.get("details", "Signal de vente"),
                    )
                    if trade_result["success"]:
                        results["actions"].append({"type": "sell", "trade": trade_result})
        except Exception as e:
            results["checks"].append({"ticker": ticker, "error": str(e)})

    engine.save_snapshot()

    from datetime import datetime
    set_setting("last_cycle_run", datetime.now().isoformat())

    return jsonify(results)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
