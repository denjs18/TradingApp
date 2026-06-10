"""API Flask — backend pour l'app de trading Vercel."""

import sys
import os

# Racine du projet dans le path Python (backend/ est un niveau sous la racine)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

import jwt
import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

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


def sanitize(obj):
    """Recursively convert numpy/pandas types to native Python types for JSON serialization."""
    import numpy as np
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return sanitize(obj.tolist())
    try:
        import pandas as pd
        if isinstance(obj, pd.NA.__class__) or (hasattr(pd, 'isna') and pd.isna(obj)):
            return None
    except Exception:
        pass
    return obj


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

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30


def _make_token(user_id: int, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user() -> dict | None:
    """Read Authorization: Bearer <token> header and return user dict or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        with get_db() as conn:
            user = conn.execute(
                "SELECT id, email, groq_api_key, default_sectors, default_min_score, created_at FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()
        return user
    except Exception:
        return None


# ── Auth endpoints ────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    password_hash = generate_password_hash(password)
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, password_hash),
            )
            user = conn.execute(
                "SELECT id, email FROM users WHERE email = ?", (email,)
            ).fetchone()
    except Exception as e:
        if "UNIQUE" in str(e) or "unique" in str(e) or "duplicate" in str(e).lower():
            return jsonify({"error": "Email already registered"}), 409
        return jsonify({"error": str(e)}), 500
    token = _make_token(user["id"], user["email"])
    return jsonify({"token": token, "user": {"id": user["id"], "email": user["email"]}}), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401
    token = _make_token(user["id"], user["email"])
    return jsonify({"token": token, "user": {"id": user["id"], "email": user["email"]}})


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({
        "id": user["id"],
        "email": user["email"],
        "has_groq_key": bool(user.get("groq_api_key")),
        "default_sectors": user.get("default_sectors", "[]"),
        "default_min_score": user.get("default_min_score", 0),
        "created_at": str(user.get("created_at", "")),
    })


@app.route("/api/auth/profile", methods=["PUT"])
def auth_profile():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json() or {}
    fields = []
    values = []
    if "groq_api_key" in data:
        fields.append("groq_api_key = ?")
        values.append(data["groq_api_key"] or None)
    if "default_sectors" in data:
        import json as _json
        sectors = data["default_sectors"]
        fields.append("default_sectors = ?")
        values.append(_json.dumps(sectors) if isinstance(sectors, list) else sectors)
    if "default_min_score" in data:
        fields.append("default_min_score = ?")
        values.append(float(data["default_min_score"]))
    if not fields:
        return jsonify({"error": "No fields to update"}), 400
    values.append(user["id"])
    with get_db() as conn:
        conn.execute(
            f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values
        )
    return jsonify({"success": True})


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    return jsonify({"success": True})


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
    return jsonify(sanitize({"results": results, "errors": errors}))


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


# ── AI Advisor (Groq) ─────────────────────────────────────────

@app.route("/api/ai/ticker", methods=["POST"])
def ai_ticker_analysis():
    """Analyse approfondie d'un ticker avec horizons temporels et profils investisseurs."""
    import requests as req

    user = get_current_user()
    if user and user.get("groq_api_key"):
        groq_key = user["groq_api_key"]
    else:
        groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        if user:
            return jsonify({"error": "Please add your Groq API key in your profile to use AI features"}), 403
        return jsonify({"error": "GROQ_API_KEY not configured"}), 503

    data = request.get_json() or {}
    opp = data.get("opportunity", {})
    if not opp:
        return jsonify({"error": "no opportunity data"}), 400

    fund = opp.get("details", {}).get("fundamental", {})
    fundamentals = fund.get("fundamentals", {})

    prompt = f"""Tu es un analyste financier senior. Voici les données complètes sur {opp.get('ticker')} ({opp.get('name', '')}), secteur: {opp.get('sector', '')}.

DONNÉES TECHNIQUES:
- Cours actuel: {opp.get('current_price')} €
- Objectif analysts: {opp.get('target_price')} € (gain potentiel: {opp.get('gain_pct')}%)
- Stop suggéré: {opp.get('stop_price')} €
- Tendance: {opp.get('trend')}
- Volatilité annuelle: {opp.get('volatility_annual')}%
- Max drawdown (6 mois): {opp.get('max_drawdown')}%
- Sharpe ratio: {opp.get('sharpe_ratio')}
- Niveau de risque: {opp.get('risk_level')}
- Score global: {opp.get('score')}/10 ({opp.get('recommendation')})
- Score technique: {opp.get('technical_score')}, fondamental: {opp.get('fundamental_score')}, sentiment: {opp.get('sentiment_score')}

DONNÉES FONDAMENTALES:
- P/E: {fundamentals.get('pe_ratio')}, PEG: {fundamentals.get('peg_ratio')}, P/B: {fundamentals.get('price_to_book')}
- Marge nette: {fundamentals.get('profit_margin')}, ROE: {fundamentals.get('return_on_equity')}
- Croissance CA: {fundamentals.get('revenue_growth')}, Croissance BPA: {fundamentals.get('earnings_growth')}
- Dette/Capitaux propres: {fundamentals.get('debt_to_equity')}
- Dividende: {fundamentals.get('dividend_yield')} (rendement)
- Beta: {fundamentals.get('beta')}
- Capitalisation: {fundamentals.get('market_cap')}

Génère une analyse structurée en JSON:
{{
  "synthese": "<2-3 phrases résumant la situation actuelle>",
  "horizons": {{
    "1an": {{"outlook": "haussier|neutre|baissier", "potentiel": "<fourchette de prix estimée>", "catalyseurs": "<1-2 facteurs clés>"}},
    "3ans": {{"outlook": "haussier|neutre|baissier", "potentiel": "<fourchette>", "catalyseurs": "<facteurs>"}},
    "5ans": {{"outlook": "haussier|neutre|baissier", "potentiel": "<fourchette>", "catalyseurs": "<facteurs>"}},
    "10ans": {{"outlook": "haussier|neutre|baissier", "potentiel": "<fourchette>", "catalyseurs": "<facteurs>"}}
  }},
  "profil_dca": {{
    "adapte": true/false,
    "score_dca": <0-10>,
    "frequence_recommandee": "mensuelle|trimestrielle|annuelle",
    "zone_accumulation": "<fourchette de prix idéale pour DCA>",
    "raison": "<2-3 phrases expliquant pourquoi le DCA est adapté ou non>"
  }},
  "profil_swing": {{
    "adapte": true/false,
    "score_swing": <0-10>,
    "entree_ideale": "<prix ou condition d'entrée>",
    "objectif_court_terme": "<prix cible à 3-6 mois>",
    "stop_loss": "<niveau de stop recommandé>",
    "ratio_risque_rendement": "<ex: 1:3>",
    "raison": "<2-3 phrases>"
  }},
  "risques_principaux": ["<risque 1>", "<risque 2>", "<risque 3>"],
  "catalyseurs_positifs": ["<catalyseur 1>", "<catalyseur 2>"],
  "verdict_final": "<1 paragraphe de conclusion avec recommandation claire>"
}}

Réponds UNIQUEMENT avec le JSON valide."""

    try:
        resp = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.25,
                "max_tokens": 1800,
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        import json as _json
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            return jsonify(_json.loads(content[start:end]))
        return jsonify({"verdict_final": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/advisor", methods=["POST"])
def ai_advisor():
    """Analyse les résultats de scoring avec Groq et retourne des conseils."""
    import requests as req

    user = get_current_user()
    if user and user.get("groq_api_key"):
        groq_key = user["groq_api_key"]
    else:
        groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        if user:
            return jsonify({"error": "Please add your Groq API key in your profile to use AI features"}), 403
        return jsonify({"error": "GROQ_API_KEY not configured"}), 503

    data = request.get_json() or {}
    results = data.get("results", [])
    if not results:
        return jsonify({"error": "no results"}), 400

    # Préparer un résumé compact pour le prompt
    top = sorted(results, key=lambda x: x.get("score", 0), reverse=True)[:15]
    lines = []
    for r in top:
        lines.append(
            f"- {r['ticker']} ({r.get('name','')}) : score {r.get('score',0):.1f}/10, "
            f"recommandation={r.get('recommendation','')}, "
            f"gain_potentiel={r.get('gain_pct') or 0:.1f}%, "
            f"technique={r.get('technical_score',0):.2f}, "
            f"fondamental={r.get('fundamental_score',0):.2f}, "
            f"sentiment={r.get('sentiment_score',0):.2f}"
        )
    summary_text = "\n".join(lines)

    prompt = f"""Tu es un conseiller en investissement PEA expérimenté. Voici les résultats d'une analyse multi-facteurs de {len(results)} actions européennes éligibles PEA.

TOP 15 par score :
{summary_text}

Fournis une analyse structurée en JSON avec exactement ce format :
{{
  "synthese": "<3-4 phrases résumant les opportunités du moment>",
  "top_achats": [
    {{"ticker": "...", "raison": "<1 phrase>", "conviction": "haute|moyenne|faible"}}
  ],
  "secteurs_favoris": ["...", "..."],
  "risques": "<2-3 phrases sur les risques actuels>",
  "strategie_recommandee": "<1 paragraphe sur la stratégie PEA à adopter>"
}}

Réponds UNIQUEMENT avec le JSON, sans markdown ni texte autour."""

    try:
        resp = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1200,
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        import json as _json
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            advice = _json.loads(content[start:end])
        else:
            advice = {"synthese": content, "top_achats": [], "secteurs_favoris": [], "risques": "", "strategie_recommandee": ""}
        return jsonify(advice)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

ALL_PEA_TICKERS = [
    # CAC 40
    "AC.PA","AI.PA","AIR.PA","AXA.PA","BNP.PA","BN.PA","BVI.PA","CA.PA","CAP.PA",
    "ACA.PA","DG.PA","DSY.PA","EDEN.PA","EL.PA","ENGI.PA","ERF.PA","GLE.PA",
    "HO.PA","KER.PA","LR.PA","MC.PA","ML.PA","MT.AS","OR.PA","ORA.PA","PUB.PA",
    "RI.PA","RMS.PA","RNO.PA","SAF.PA","SAN.PA","SGO.PA","SU.PA","STLAM.PA",
    "STM.PA","TEP.PA","TTE.PA","URW.PA","VIE.PA","EN.PA","VIV.PA",
    # CAC Next 20
    "AF.PA","AKE.PA","BIM.PA","FGR.PA","ENX.PA","GET.PA","LI.PA","RCO.PA",
    "RXL.PA","DIM.PA","SW.PA","SOI.PA","UBI.PA","FR.PA","GFC.PA",
    # SBF 120 supplémentaires
    "ADP.PA","ALO.PA","ALTEN.PA","AM.PA","ALTAREA.PA","BOL.PA","BON.PA",
    "COV.PA","ERAMET.PA","FNAC.PA","GENFIT.PA","GTT.PA","ICAD.PA",
    "ILD.PA","IPH.PA","LAGR.PA","M6.PA","NK.PA","OVH.PA","SEB.PA",
    "TEC.PA","TF1.PA","VK.PA","WLN.PA","FRVIA.PA",
    # DAX 40
    "ADS.DE","ALV.DE","BAS.DE","BAYN.DE","BEI.DE","BMW.DE","BNR.DE","CBK.DE",
    "CON.DE","DBK.DE","DB1.DE","DHL.DE","DTG.DE","DTE.DE","EOAN.DE","FME.DE",
    "FRE.DE","G1A.DE","HEI.DE","HEN3.DE","HNR1.DE","IFX.DE","MBG.DE","MRK.DE",
    "MTX.DE","MUV2.DE","PAH3.DE","QIA.DE","RHM.DE","RWE.DE","SAP.DE","SHL.DE",
    "SIE.DE","ENR.DE","SY1.DE","VNA.DE","VOW3.DE","ZAL.DE","G24.DE",
    # AEX Pays-Bas
    "ABN.AS","ADYEN.AS","AGN.AS","AD.AS","AKZA.AS","ASM.AS","ASML.AS","ASRNL.AS",
    "BESI.AS","DSFIR.AS","EXO.AS","HEIA.AS","IMCD.AS","INGA.AS","KPN.AS",
    "MT.AS","NN.AS","PHIA.AS","PRX.AS","RAND.AS","UMG.AS","WKL.AS",
    # BEL 20 Belgique
    "ABI.BR","ACKB.BR","AED.BR","AGS.BR","ARGX.BR","APAM.BR","AZE.BR",
    "DIE.BR","ELI.BR","GBLB.BR","KBC.BR","LOTB.BR","MELE.BR","MONT.BR",
    "SOF.BR","SOLB.BR","UCB.BR","UMI.BR","WDP.BR","SYENS.BR",
    # FTSE MIB Italie
    "A2A.MI","AMP.MI","AZM.MI","BAMI.MI","BMPS.MI","BPE.MI","BC.MI","BZU.MI",
    "CPR.MI","DIA.MI","ENEL.MI","ENI.MI","RACE.MI","FBK.MI","G.MI","HER.MI",
    "ISP.MI","INW.MI","IG.MI","LDO.MI","MB.MI","MONC.MI","NEXI.MI","PST.MI",
    "PRY.MI","REC.MI","SPM.MI","SRG.MI","TEN.MI","TIT.MI","TRN.MI","UCG.MI","UNI.MI",
    # IBEX 35 Espagne
    "ACS.MC","ACX.MC","AENA.MC","AMS.MC","ANA.MC","ANE.MC","BBVA.MC","BKT.MC",
    "CABK.MC","CLNX.MC","ELE.MC","ENG.MC","FDR.MC","FER.MC","GRF.MC","IAG.MC",
    "IBE.MC","IDR.MC","ITX.MC","LOG.MC","MAP.MC","MRL.MC","MTS.MC","NTGY.MC",
    "PUIG.MC","RED.MC","REP.MC","ROVI.MC","SAB.MC","SAN.MC","SCYR.MC","TEF.MC",
    # OMX Stockholm 30 Suède
    "ALFA.ST","ASSA-B.ST","ATCO-A.ST","BOL.ST","EPI-A.ST","EQT.ST","ERIC-B.ST",
    "ESSITY-B.ST","EVO.ST","SHB-A.ST","HM-B.ST","HEXA-B.ST","INDU-C.ST",
    "INVE-B.ST","LIFCO-B.ST","NIBE-B.ST","NDA-SE.ST","SAAB-B.ST","SAND.ST",
    "SCA-B.ST","SEB-A.ST","SKA-B.ST","SKF-B.ST","SWED-A.ST","TEL2-B.ST",
    "TELIA.ST","VOLV-B.ST",
    # OMX Copenhagen 25 Danemark
    "MAERSK-A.CO","MAERSK-B.CO","AMBU-B.CO","CARL-B.CO","COLO-B.CO","DANSKE.CO",
    "DEMANT.CO","DSV.CO","GMAB.CO","GN.CO","ISS.CO","NDA-DK.CO","NKT.CO",
    "NOVO-B.CO","NSIS-B.CO","ORSTED.CO","PNDORA.CO","RBREW.CO","ROCK-B.CO",
    "TRYG.CO","VWS.CO","ZEAL.CO",
    # OMX Helsinki 25 Finlande
    "ELISA.HE","FORTUM.HE","HUH1V.HE","KEMIRA.HE","KESKOB.HE","KNEBV.HE",
    "KCR.HE","METSO.HE","NESTE.HE","NOKIA.HE","NDA-FI.HE","ORNBV.HE",
    "OUT1V.HE","QTCOM.HE","SAMPO.HE","STERV.HE","TIETO.HE","UPM.HE",
    "VALMT.HE","WRT1V.HE",
    # PSI 20 Portugal
    "ALTR.LS","BCP.LS","COR.LS","CTT.LS","EDP.LS","EDPR.LS","GALP.LS",
    "JMT.LS","NOS.LS","RENE.LS","SEM.LS","SON.LS","NVG.LS",
    # ATX Autriche
    "ANDR.VI","ATS.VI","EBS.VI","EVN.VI","LNZ.VI","OMV.VI","OPT.VI",
    "PAL.VI","RBI.VI","SBO.VI","STR.VI","UQA.VI","VER.VI","VIG.VI","VOE.VI","WIE.VI",
]


@app.route("/api/opportunities/pea-tickers")
def get_pea_tickers():
    """Retourne la liste complète des tickers PEA disponibles."""
    return jsonify(ALL_PEA_TICKERS)


@app.route("/api/cron", methods=["GET", "POST"])
def cron_cycle():
    """Cycle de trading + pré-calcul des scores — appelé par Vercel Cron."""
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
