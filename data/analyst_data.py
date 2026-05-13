"""Recuperation du consensus analystes via yfinance."""

import yfinance as yf
from typing import Optional


def get_analyst_recommendations(ticker: str) -> dict:
    """Recupere le consensus analystes pour un ticker.

    Returns:
        dict avec les cles:
        - recommendation: str (buy, hold, sell, etc.)
        - target_mean: float (objectif moyen)
        - target_median: float (objectif median)
        - target_low: float (objectif bas)
        - target_high: float (objectif haut)
        - num_analysts: int
        - buy/hold/sell counts
    """
    result = {
        "recommendation": None,
        "target_mean": None,
        "target_median": None,
        "target_low": None,
        "target_high": None,
        "num_analysts": 0,
        "strong_buy": 0,
        "buy": 0,
        "hold": 0,
        "sell": 0,
        "strong_sell": 0,
    }

    stock = yf.Ticker(ticker)

    try:
        info = stock.info
        result["recommendation"] = info.get("recommendationKey")
        result["target_mean"] = info.get("targetMeanPrice")
        result["target_median"] = info.get("targetMedianPrice")
        result["target_low"] = info.get("targetLowPrice")
        result["target_high"] = info.get("targetHighPrice")
        result["num_analysts"] = info.get("numberOfAnalystOpinions", 0)
    except Exception:
        pass

    try:
        recs = stock.recommendations
        if recs is not None and not recs.empty:
            # Prendre la derniere ligne (la plus recente)
            latest = recs.iloc[-1]
            for col in ["strongBuy", "buy", "hold", "sell", "strongSell"]:
                if col in latest.index:
                    key = col[0].lower() + col[1:]
                    # Convertir camelCase vers snake_case
                    snake = ""
                    for c in col:
                        if c.isupper() and snake:
                            snake += "_" + c.lower()
                        else:
                            snake += c.lower()
                    result[snake] = int(latest[col])
    except Exception:
        pass

    return result


def get_analyst_price_targets(ticker: str) -> dict:
    """Recupere les objectifs de prix des analystes.

    Returns:
        dict avec current_price, targets, et upside/downside potentiel.
    """
    stock = yf.Ticker(ticker)
    result = {
        "current_price": None,
        "target_mean": None,
        "target_median": None,
        "target_low": None,
        "target_high": None,
        "upside_pct": None,
        "downside_pct": None,
    }

    try:
        info = stock.info
        current = info.get("currentPrice") or info.get("regularMarketPrice")
        result["current_price"] = current
        result["target_mean"] = info.get("targetMeanPrice")
        result["target_median"] = info.get("targetMedianPrice")
        result["target_low"] = info.get("targetLowPrice")
        result["target_high"] = info.get("targetHighPrice")

        if current and result["target_mean"]:
            result["upside_pct"] = (
                (result["target_mean"] - current) / current
            ) * 100

        if current and result["target_low"]:
            result["downside_pct"] = (
                (result["target_low"] - current) / current
            ) * 100
    except Exception:
        pass

    return result


def get_recommendation_summary(ticker: str) -> str:
    """Retourne un resume textuel du consensus analystes."""
    data = get_analyst_recommendations(ticker)

    if not data["recommendation"]:
        return "Aucune donnee analyste disponible."

    total = (
        data.get("strong_buy", 0)
        + data.get("buy", 0)
        + data.get("hold", 0)
        + data.get("sell", 0)
        + data.get("strong_sell", 0)
    )

    parts = [f"Consensus: {data['recommendation'].upper()}"]

    if total > 0:
        parts.append(
            f"({data.get('strong_buy', 0) + data.get('buy', 0)} achat, "
            f"{data.get('hold', 0)} neutre, "
            f"{data.get('sell', 0) + data.get('strong_sell', 0)} vente)"
        )

    if data["target_mean"]:
        parts.append(f"Objectif moyen: {data['target_mean']:.2f} EUR")

    if data["target_low"] and data["target_high"]:
        parts.append(
            f"Fourchette: {data['target_low']:.2f} - {data['target_high']:.2f} EUR"
        )

    return " | ".join(parts)
