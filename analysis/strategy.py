"""Strategies de trading et scoring multi-facteurs."""

import pandas as pd
from typing import Optional

from analysis.technical import get_technical_summary
from analysis.fundamental import get_fundamental_summary
from analysis.sentiment import get_sentiment_for_ticker
from data.market_data import get_historical_data, get_current_price
from data.analyst_data import get_analyst_recommendations, get_analyst_price_targets
from config import (
    SCORE_BUY_THRESHOLD,
    SCORE_SELL_THRESHOLD,
    TECHNICAL_PARAMS,
)


def momentum_strategy(df: pd.DataFrame) -> dict:
    """Strategie Momentum : suit la tendance.

    Achat si tendance haussiere + momentum positif.
    Vente si tendance baissiere + momentum negatif.
    """
    if df.empty or len(df) < 50:
        return {"signal": "neutre", "score": 0.0, "details": "Donnees insuffisantes"}

    from analysis.technical import compute_indicators, detect_trend

    df = compute_indicators(df)
    trend = detect_trend(df)

    close = df["Close"].iloc[-1]
    p = TECHNICAL_PARAMS

    score = 0.0
    details = []

    # Tendance par SMA
    if trend == "haussiere":
        score += 0.4
        details.append("Tendance haussiere (SMA)")
    elif trend == "baissiere":
        score -= 0.4
        details.append("Tendance baissiere (SMA)")

    # Momentum RSI
    if "RSI" in df.columns and not pd.isna(df["RSI"].iloc[-1]):
        rsi = df["RSI"].iloc[-1]
        if 50 < rsi < p["rsi_overbought"]:
            score += 0.3
            details.append(f"Momentum positif (RSI: {rsi:.1f})")
        elif p["rsi_oversold"] < rsi < 50:
            score -= 0.2
            details.append(f"Momentum faible (RSI: {rsi:.1f})")

    # Momentum prix (rendement 20 jours)
    if len(df) >= 20:
        ret_20 = (close / df["Close"].iloc[-20] - 1) * 100
        if ret_20 > 5:
            score += 0.3
            details.append(f"Rendement 20j: +{ret_20:.1f}%")
        elif ret_20 < -5:
            score -= 0.3
            details.append(f"Rendement 20j: {ret_20:.1f}%")

    signal = "achat" if score > SCORE_BUY_THRESHOLD else (
        "vente" if score < SCORE_SELL_THRESHOLD else "neutre"
    )

    return {"signal": signal, "score": score, "details": " | ".join(details)}


def mean_reversion_strategy(df: pd.DataFrame) -> dict:
    """Strategie Mean Reversion : retour a la moyenne.

    Achat si prix significativement sous la moyenne.
    Vente si prix significativement au-dessus.
    """
    if df.empty or len(df) < 50:
        return {"signal": "neutre", "score": 0.0, "details": "Donnees insuffisantes"}

    from analysis.technical import compute_indicators

    df = compute_indicators(df)
    close = df["Close"].iloc[-1]
    p = TECHNICAL_PARAMS

    score = 0.0
    details = []

    # Distance a la SMA 50
    sma_col = f"SMA_{p['sma_medium']}"
    if sma_col in df.columns and not pd.isna(df[sma_col].iloc[-1]):
        sma = df[sma_col].iloc[-1]
        deviation = ((close - sma) / sma) * 100

        if deviation < -5:
            score += 0.5
            details.append(f"Prix {deviation:.1f}% sous SMA50 - potentiel rebond")
        elif deviation > 5:
            score -= 0.5
            details.append(f"Prix +{deviation:.1f}% au-dessus SMA50 - suretendu")

    # RSI extremes (survendu => achat, surachete => vente)
    if "RSI" in df.columns and not pd.isna(df["RSI"].iloc[-1]):
        rsi = df["RSI"].iloc[-1]
        if rsi < p["rsi_oversold"]:
            score += 0.5
            details.append(f"RSI survendu ({rsi:.1f}) - signal de retournement")
        elif rsi > p["rsi_overbought"]:
            score -= 0.5
            details.append(f"RSI surachete ({rsi:.1f}) - signal de retournement")

    # Position dans les bandes de Bollinger
    bb_lower = f"BBL_{p['bb_period']}_{float(p['bb_std'])}"
    bb_upper = f"BBU_{p['bb_period']}_{float(p['bb_std'])}"
    if bb_lower in df.columns and bb_upper in df.columns:
        lower = df[bb_lower].iloc[-1]
        upper = df[bb_upper].iloc[-1]
        if not pd.isna(lower) and not pd.isna(upper) and upper > lower:
            pos = (close - lower) / (upper - lower)
            if pos < 0.15:
                score += 0.4
                details.append("Pres de la bande de Bollinger inferieure")
            elif pos > 0.85:
                score -= 0.4
                details.append("Pres de la bande de Bollinger superieure")

    signal = "achat" if score > SCORE_BUY_THRESHOLD else (
        "vente" if score < SCORE_SELL_THRESHOLD else "neutre"
    )

    return {"signal": signal, "score": score, "details": " | ".join(details)}


def breakout_strategy(df: pd.DataFrame) -> dict:
    """Strategie Breakout : cassure de niveaux.

    Achat sur cassure de resistance avec volume.
    Vente sur cassure de support.
    """
    if df.empty or len(df) < 50:
        return {"signal": "neutre", "score": 0.0, "details": "Donnees insuffisantes"}

    from analysis.technical import compute_indicators, find_support_resistance, detect_volume_anomaly

    df = compute_indicators(df)
    close = df["Close"].iloc[-1]

    score = 0.0
    details = []

    # Niveaux de support/resistance
    sr = find_support_resistance(df)
    volume = detect_volume_anomaly(df)

    # Breakout haussier
    if sr["resistances"]:
        nearest_res = sr["resistances"][0]
        if close > nearest_res:
            score += 0.5
            details.append(f"Cassure de resistance ({nearest_res:.2f})")
            if volume["anomaly"]:
                score += 0.3
                details.append(f"Volume anormal (x{volume['ratio']:.1f})")

    # Breakout baissier
    if sr["supports"]:
        nearest_sup = sr["supports"][0]
        if close < nearest_sup:
            score -= 0.5
            details.append(f"Cassure de support ({nearest_sup:.2f})")
            if volume["anomaly"]:
                score -= 0.2
                details.append(f"Volume anormal (x{volume['ratio']:.1f})")

    # Range trop etroit (pas de breakout)
    if sr["supports"] and sr["resistances"]:
        range_pct = (sr["resistances"][0] - sr["supports"][0]) / sr["supports"][0] * 100
        if range_pct < 2:
            details.append(f"Range etroit ({range_pct:.1f}%) - attente de cassure")

    signal = "achat" if score > SCORE_BUY_THRESHOLD else (
        "vente" if score < SCORE_SELL_THRESHOLD else "neutre"
    )

    return {"signal": signal, "score": score, "details": " | ".join(details)}


def combined_strategy(df: pd.DataFrame) -> dict:
    """Strategie combinee : moyenne des trois strategies."""
    mom = momentum_strategy(df)
    mr = mean_reversion_strategy(df)
    bo = breakout_strategy(df)

    avg_score = (mom["score"] + mr["score"] + bo["score"]) / 3

    details_parts = []
    if mom["details"]:
        details_parts.append(f"Momentum: {mom['signal']} ({mom['score']:+.2f})")
    if mr["details"]:
        details_parts.append(f"Mean Rev: {mr['signal']} ({mr['score']:+.2f})")
    if bo["details"]:
        details_parts.append(f"Breakout: {bo['signal']} ({bo['score']:+.2f})")

    signal = "achat" if avg_score > SCORE_BUY_THRESHOLD else (
        "vente" if avg_score < SCORE_SELL_THRESHOLD else "neutre"
    )

    return {
        "signal": signal,
        "score": avg_score,
        "details": " | ".join(details_parts),
        "sub_strategies": {
            "momentum": mom,
            "mean_reversion": mr,
            "breakout": bo,
        },
    }


STRATEGY_MAP = {
    "momentum": momentum_strategy,
    "mean_reversion": mean_reversion_strategy,
    "breakout": breakout_strategy,
    "combined": combined_strategy,
}


def run_strategy(ticker: str, strategy_name: str = "combined") -> dict:
    """Execute une strategie sur un ticker.

    Returns:
        dict avec signal, score, details, et contexte supplementaire.
    """
    df = get_historical_data(ticker, period="6mo")
    if df.empty:
        return {"signal": "neutre", "score": 0.0, "details": "Pas de donnees"}

    strategy_fn = STRATEGY_MAP.get(strategy_name, combined_strategy)
    result = strategy_fn(df)
    result["ticker"] = ticker
    result["strategy"] = strategy_name
    return result


def compute_opportunity_score(ticker: str) -> dict:
    """Calcule le score d'opportunite global pour un ticker.

    Combine analyse technique, fondamentale, sentiment, et consensus.
    Score de -10 a +10.

    Returns:
        dict complet avec scores, recommandation, prix cibles, justification.
    """
    # Donnees de marche
    df = get_historical_data(ticker, period="6mo")
    current_price = get_current_price(ticker)

    # Analyse technique
    tech = get_technical_summary(df) if not df.empty else {
        "overall_score": 0, "trend": "neutre",
        "signals": {}, "support_resistance": {"supports": [], "resistances": []},
        "patterns": [],
    }

    # Analyse fondamentale
    fund = get_fundamental_summary(ticker)

    # Sentiment
    sentiment = get_sentiment_for_ticker(ticker, fund.get("name", ""))

    # Consensus analystes
    analyst = get_analyst_recommendations(ticker)
    targets = get_analyst_price_targets(ticker)

    # Scoring (chaque composante sur [-2.5, +2.5], total sur [-10, +10])
    tech_score = tech["overall_score"] * 2.5  # [-2.5, +2.5]
    fund_score = fund["overall_score"] * 2.5  # [-2.5, +2.5]
    sent_score = sentiment["overall_score"] * 2.5  # [-2.5, +2.5]

    # Score analyste
    analyst_score = 0.0
    rec = analyst.get("recommendation", "")
    if rec in ("strong_buy", "buy"):
        analyst_score = 1.5
    elif rec == "hold":
        analyst_score = 0.0
    elif rec in ("sell", "strong_sell"):
        analyst_score = -1.5

    if targets.get("upside_pct"):
        upside_bonus = min(1.0, max(-1.0, targets["upside_pct"] / 30))
        analyst_score += upside_bonus

    total_score = tech_score + fund_score + sent_score + analyst_score
    total_score = max(-10, min(10, total_score))

    # Recommandation
    if total_score >= 5:
        recommendation = "acheter"
    elif total_score >= 2:
        recommendation = "surveiller"
    elif total_score <= -5:
        recommendation = "eviter"
    else:
        recommendation = "neutre"

    # Prix d'entree et cibles
    entry_price = current_price
    target_price = targets.get("target_mean")
    stop_price = None

    if current_price and tech["support_resistance"]["supports"]:
        stop_price = tech["support_resistance"]["supports"][0] * 0.99

    # Gain/Risque potentiel
    gain_pct = None
    risk_pct = None
    if current_price and target_price:
        gain_pct = ((target_price - current_price) / current_price) * 100
    if current_price and stop_price:
        risk_pct = ((stop_price - current_price) / current_price) * 100

    # Justification
    justification_parts = []
    justification_parts.append(f"Tendance technique: {tech['trend']}")
    if tech["patterns"]:
        for p in tech["patterns"]:
            justification_parts.append(f"Pattern: {p['description']}")
    if fund.get("valuation", {}).get("details"):
        justification_parts.extend(fund["valuation"]["details"][:2])
    if sentiment["overall_label"] != "neutre":
        justification_parts.append(
            f"Sentiment news: {sentiment['overall_label']} "
            f"({sentiment['overall_score']:+.2f})"
        )
    if analyst.get("recommendation"):
        justification_parts.append(f"Consensus analystes: {analyst['recommendation']}")

    # Métriques de risque depuis l'historique
    volatility_annual = None
    max_drawdown = None
    sharpe_ratio = None
    risk_level = "inconnu"

    if not df.empty and len(df) > 5:
        import numpy as np
        returns = df["Close"].pct_change().dropna()
        if len(returns) > 0:
            vol_daily = float(returns.std())
            volatility_annual = round(vol_daily * (252 ** 0.5) * 100, 1)  # en %

            # Max drawdown sur la période
            cumulative = (1 + returns).cumprod()
            rolling_max = cumulative.cummax()
            drawdowns = (cumulative - rolling_max) / rolling_max
            max_drawdown = round(float(drawdowns.min()) * 100, 1)  # en % (négatif)

            # Sharpe approximatif (rf = 3% annuel)
            rf_daily = 0.03 / 252
            excess = returns - rf_daily
            if float(returns.std()) > 0:
                sharpe_ratio = round(float(excess.mean()) / float(returns.std()) * (252 ** 0.5), 2)

        if volatility_annual is not None:
            if volatility_annual < 15:
                risk_level = "faible"
            elif volatility_annual < 30:
                risk_level = "modéré"
            elif volatility_annual < 50:
                risk_level = "élevé"
            else:
                risk_level = "très élevé"

    return {
        "ticker": ticker,
        "name": fund.get("name", ticker),
        "sector": fund.get("sector", ""),
        "score": round(total_score, 1),
        "technical_score": round(tech_score, 2),
        "fundamental_score": round(fund_score, 2),
        "sentiment_score": round(sent_score, 2),
        "analyst_score": round(analyst_score, 2),
        "recommendation": recommendation,
        "current_price": current_price,
        "entry_price": entry_price,
        "target_price": target_price,
        "stop_price": stop_price,
        "gain_pct": round(gain_pct, 1) if gain_pct else None,
        "risk_pct": round(risk_pct, 1) if risk_pct else None,
        "volatility_annual": volatility_annual,
        "max_drawdown": max_drawdown,
        "sharpe_ratio": sharpe_ratio,
        "risk_level": risk_level,
        "beta": fund.get("fundamentals", {}).get("beta"),
        "dividend_yield": fund.get("fundamentals", {}).get("dividend_yield"),
        "trend": tech["trend"],
        "justification": " | ".join(justification_parts),
        "details": {
            "technical": tech,
            "fundamental": fund,
            "sentiment": sentiment,
            "analyst": analyst,
            "targets": targets,
        },
    }
