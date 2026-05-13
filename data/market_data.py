"""Recuperation des donnees de marche via yfinance."""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional


def get_stock_info(ticker: str) -> dict:
    """Retourne les informations generales d'une action."""
    stock = yf.Ticker(ticker)
    try:
        info = stock.info
    except Exception:
        info = {}
    return info


def get_current_price(ticker: str) -> Optional[float]:
    """Retourne le prix actuel (ou le dernier connu)."""
    stock = yf.Ticker(ticker)
    try:
        hist = stock.history(period="1d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass
    return None


def get_multiple_prices(tickers: list[str]) -> dict[str, Optional[float]]:
    """Retourne les prix actuels pour une liste de tickers."""
    prices = {}
    for ticker in tickers:
        prices[ticker] = get_current_price(ticker)
    return prices


def get_historical_data(
    ticker: str,
    period: str = "6mo",
    interval: str = "1d",
) -> pd.DataFrame:
    """Recupere les donnees historiques d'une action.

    Args:
        ticker: Symbole de l'action (ex: AIR.PA)
        period: Periode (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max)
        interval: Intervalle (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo)

    Returns:
        DataFrame avec colonnes Open, High, Low, Close, Volume
    """
    stock = yf.Ticker(ticker)
    try:
        df = stock.history(period=period, interval=interval)
        if df.empty:
            return pd.DataFrame()
        # Nettoyer les colonnes inutiles si presentes
        cols_to_drop = [c for c in ["Dividends", "Stock Splits"] if c in df.columns]
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
        return df
    except Exception:
        return pd.DataFrame()


def get_intraday_data(ticker: str, days: int = 5) -> pd.DataFrame:
    """Recupere les donnees intraday (intervalle 2 minutes, max 60 jours)."""
    if days <= 7:
        interval = "1m"
    else:
        interval = "2m"
    period = f"{days}d"
    return get_historical_data(ticker, period=period, interval=interval)


def get_price_change(ticker: str) -> dict:
    """Calcule les variations de prix sur differentes periodes."""
    changes = {
        "day": None,
        "week": None,
        "month": None,
        "ytd": None,
        "year": None,
    }

    stock = yf.Ticker(ticker)
    try:
        hist = stock.history(period="1y")
        if hist.empty or len(hist) < 2:
            return changes

        current = float(hist["Close"].iloc[-1])

        # Variation jour
        if len(hist) >= 2:
            prev = float(hist["Close"].iloc[-2])
            changes["day"] = ((current - prev) / prev) * 100

        # Variation semaine (5 jours de trading)
        if len(hist) >= 6:
            ref = float(hist["Close"].iloc[-6])
            changes["week"] = ((current - ref) / ref) * 100

        # Variation mois (~22 jours de trading)
        if len(hist) >= 23:
            ref = float(hist["Close"].iloc[-23])
            changes["month"] = ((current - ref) / ref) * 100

        # YTD
        year_start = datetime(datetime.now().year, 1, 1)
        ytd_data = hist[hist.index >= pd.Timestamp(year_start, tz=hist.index.tz)]
        if not ytd_data.empty:
            ref = float(ytd_data["Close"].iloc[0])
            changes["ytd"] = ((current - ref) / ref) * 100

        # Variation annee
        if len(hist) > 200:
            ref = float(hist["Close"].iloc[0])
            changes["year"] = ((current - ref) / ref) * 100

    except Exception:
        pass

    return changes


def get_market_status() -> dict:
    """Verifie si le marche Euronext est ouvert."""
    from zoneinfo import ZoneInfo
    from config import (
        MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE,
        MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE,
        MARKET_TIMEZONE,
    )

    tz = ZoneInfo(MARKET_TIMEZONE)
    now = datetime.now(tz)
    market_open = now.replace(
        hour=MARKET_OPEN_HOUR, minute=MARKET_OPEN_MINUTE, second=0, microsecond=0
    )
    market_close = now.replace(
        hour=MARKET_CLOSE_HOUR, minute=MARKET_CLOSE_MINUTE, second=0, microsecond=0
    )

    is_weekday = now.weekday() < 5
    is_market_hours = market_open <= now <= market_close

    return {
        "is_open": is_weekday and is_market_hours,
        "current_time": now,
        "market_open": market_open,
        "market_close": market_close,
        "is_weekday": is_weekday,
    }
