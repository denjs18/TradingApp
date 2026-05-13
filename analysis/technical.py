"""Analyse technique : indicateurs, patterns, signaux.

Les indicateurs sont calcules directement avec pandas/numpy
(pas de dependance a pandas-ta/numba).
"""

import pandas as pd
import numpy as np
from typing import Optional

from config import TECHNICAL_PARAMS


# --- Fonctions de calcul d'indicateurs ---

def _sma(series: pd.Series, length: int) -> pd.Series:
    """Simple Moving Average."""
    return series.rolling(window=length, min_periods=length).mean()


def _ema(series: pd.Series, length: int) -> pd.Series:
    """Exponential Moving Average."""
    return series.ewm(span=length, adjust=False).mean()


def _rsi(series: pd.Series, length: int = 14) -> pd.Series:
    """Relative Strength Index."""
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)

    avg_gain = gain.ewm(com=length - 1, min_periods=length).mean()
    avg_loss = loss.ewm(com=length - 1, min_periods=length).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def _macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """MACD (Moving Average Convergence Divergence).

    Returns: (macd_line, signal_line, histogram)
    """
    ema_fast = _ema(series, fast)
    ema_slow = _ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = _ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _bbands(series: pd.Series, length: int = 20, std: float = 2.0):
    """Bollinger Bands.

    Returns: (lower, mid, upper)
    """
    mid = _sma(series, length)
    rolling_std = series.rolling(window=length, min_periods=length).std()
    upper = mid + std * rolling_std
    lower = mid - std * rolling_std
    return lower, mid, upper


# --- Fonction principale ---

def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Calcule tous les indicateurs techniques sur un DataFrame OHLCV.

    Le DataFrame doit contenir les colonnes: Open, High, Low, Close, Volume.
    Retourne le DataFrame enrichi avec les colonnes d'indicateurs.
    """
    if df.empty or len(df) < 30:
        return df

    df = df.copy()
    p = TECHNICAL_PARAMS

    # Moyennes mobiles simples
    df[f"SMA_{p['sma_short']}"] = _sma(df["Close"], p["sma_short"])
    df[f"SMA_{p['sma_medium']}"] = _sma(df["Close"], p["sma_medium"])
    if len(df) >= p["sma_long"]:
        df[f"SMA_{p['sma_long']}"] = _sma(df["Close"], p["sma_long"])

    # Moyennes mobiles exponentielles
    df[f"EMA_{p['ema_short']}"] = _ema(df["Close"], p["ema_short"])
    df[f"EMA_{p['ema_long']}"] = _ema(df["Close"], p["ema_long"])

    # RSI
    df["RSI"] = _rsi(df["Close"], p["rsi_period"])

    # MACD
    macd_line, signal_line, histogram = _macd(
        df["Close"], p["macd_fast"], p["macd_slow"], p["macd_signal"],
    )
    macd_col = f"MACD_{p['macd_fast']}_{p['macd_slow']}_{p['macd_signal']}"
    signal_col = f"MACDs_{p['macd_fast']}_{p['macd_slow']}_{p['macd_signal']}"
    hist_col = f"MACDh_{p['macd_fast']}_{p['macd_slow']}_{p['macd_signal']}"
    df[macd_col] = macd_line
    df[signal_col] = signal_line
    df[hist_col] = histogram

    # Bandes de Bollinger
    lower, mid, upper = _bbands(df["Close"], p["bb_period"], p["bb_std"])
    df[f"BBL_{p['bb_period']}_{float(p['bb_std'])}"] = lower
    df[f"BBM_{p['bb_period']}_{float(p['bb_std'])}"] = mid
    df[f"BBU_{p['bb_period']}_{float(p['bb_std'])}"] = upper

    # Volume moyen
    df["Volume_Avg"] = df["Volume"].rolling(window=p["volume_avg_period"]).mean()
    df["Volume_Ratio"] = df["Volume"] / df["Volume_Avg"]

    return df


def detect_trend(df: pd.DataFrame) -> str:
    """Detecte la tendance actuelle (haussiere, baissiere, neutre).

    Basee sur la position du prix par rapport aux SMAs.
    """
    if df.empty or len(df) < 50:
        return "neutre"

    p = TECHNICAL_PARAMS
    current = df["Close"].iloc[-1]
    sma_short_col = f"SMA_{p['sma_short']}"
    sma_medium_col = f"SMA_{p['sma_medium']}"

    if sma_short_col not in df.columns or sma_medium_col not in df.columns:
        return "neutre"

    sma_short = df[sma_short_col].iloc[-1]
    sma_medium = df[sma_medium_col].iloc[-1]

    if pd.isna(sma_short) or pd.isna(sma_medium):
        return "neutre"

    # Tendance haussiere: prix > SMA20 > SMA50
    if current > sma_short > sma_medium:
        return "haussiere"
    # Tendance baissiere: prix < SMA20 < SMA50
    if current < sma_short < sma_medium:
        return "baissiere"

    return "neutre"


def get_rsi_signal(df: pd.DataFrame) -> dict:
    """Analyse le RSI et retourne un signal."""
    if "RSI" not in df.columns or df["RSI"].isna().all():
        return {"signal": "neutre", "value": None, "score": 0.0}

    rsi = df["RSI"].iloc[-1]
    if pd.isna(rsi):
        return {"signal": "neutre", "value": None, "score": 0.0}

    p = TECHNICAL_PARAMS
    if rsi < p["rsi_oversold"]:
        # Survendu => potentiel achat
        score = (p["rsi_oversold"] - rsi) / p["rsi_oversold"]
        return {"signal": "achat", "value": rsi, "score": min(score, 1.0)}
    elif rsi > p["rsi_overbought"]:
        # Surachete => potentiel vente
        score = (rsi - p["rsi_overbought"]) / (100 - p["rsi_overbought"])
        return {"signal": "vente", "value": rsi, "score": -min(score, 1.0)}
    else:
        return {"signal": "neutre", "value": rsi, "score": 0.0}


def get_macd_signal(df: pd.DataFrame) -> dict:
    """Analyse le MACD et retourne un signal."""
    p = TECHNICAL_PARAMS
    macd_col = f"MACD_{p['macd_fast']}_{p['macd_slow']}_{p['macd_signal']}"
    signal_col = f"MACDs_{p['macd_fast']}_{p['macd_slow']}_{p['macd_signal']}"
    hist_col = f"MACDh_{p['macd_fast']}_{p['macd_slow']}_{p['macd_signal']}"

    if macd_col not in df.columns:
        return {"signal": "neutre", "value": None, "score": 0.0}

    macd_val = df[macd_col].iloc[-1]
    signal_val = df[signal_col].iloc[-1] if signal_col in df.columns else None
    hist_val = df[hist_col].iloc[-1] if hist_col in df.columns else None

    if pd.isna(macd_val):
        return {"signal": "neutre", "value": None, "score": 0.0}

    # Croisement MACD/Signal
    if signal_val is not None and not pd.isna(signal_val) and len(df) >= 2:
        prev_macd = df[macd_col].iloc[-2]
        prev_signal = df[signal_col].iloc[-2] if signal_col in df.columns else None

        if prev_signal is not None and not pd.isna(prev_macd) and not pd.isna(prev_signal):
            # Croisement haussier
            if prev_macd <= prev_signal and macd_val > signal_val:
                return {"signal": "achat", "value": macd_val, "score": 0.7}
            # Croisement baissier
            if prev_macd >= prev_signal and macd_val < signal_val:
                return {"signal": "vente", "value": macd_val, "score": -0.7}

    # Signal base sur l'histogramme
    if hist_val is not None and not pd.isna(hist_val):
        score = max(-1.0, min(1.0, hist_val / (abs(macd_val) + 1e-9)))
        signal = "achat" if score > 0.1 else ("vente" if score < -0.1 else "neutre")
        return {"signal": signal, "value": macd_val, "score": score * 0.5}

    return {"signal": "neutre", "value": macd_val, "score": 0.0}


def get_bollinger_signal(df: pd.DataFrame) -> dict:
    """Analyse les bandes de Bollinger et retourne un signal."""
    p = TECHNICAL_PARAMS
    lower_col = f"BBL_{p['bb_period']}_{float(p['bb_std'])}"
    upper_col = f"BBU_{p['bb_period']}_{float(p['bb_std'])}"

    if lower_col not in df.columns or upper_col not in df.columns:
        return {"signal": "neutre", "value": None, "score": 0.0}

    close = df["Close"].iloc[-1]
    lower = df[lower_col].iloc[-1]
    upper = df[upper_col].iloc[-1]

    if pd.isna(lower) or pd.isna(upper):
        return {"signal": "neutre", "value": None, "score": 0.0}

    bb_width = upper - lower
    if bb_width <= 0:
        return {"signal": "neutre", "value": close, "score": 0.0}

    # Position relative dans les bandes (0 = lower, 1 = upper)
    position = (close - lower) / bb_width

    if position < 0.1:
        # Pres de la bande inferieure => potentiel rebond
        return {"signal": "achat", "value": position, "score": 0.6}
    elif position > 0.9:
        # Pres de la bande superieure => potentiel retournement
        return {"signal": "vente", "value": position, "score": -0.6}

    return {"signal": "neutre", "value": position, "score": 0.0}


def detect_volume_anomaly(df: pd.DataFrame) -> dict:
    """Detecte les anomalies de volume."""
    if "Volume_Ratio" not in df.columns:
        return {"anomaly": False, "ratio": None}

    ratio = df["Volume_Ratio"].iloc[-1]
    if pd.isna(ratio):
        return {"anomaly": False, "ratio": None}

    threshold = TECHNICAL_PARAMS["volume_anomaly_threshold"]
    return {
        "anomaly": ratio > threshold,
        "ratio": ratio,
    }


def find_support_resistance(df: pd.DataFrame, window: int = 20) -> dict:
    """Detecte les niveaux de support et resistance.

    Methode : pivots locaux (plus hauts/plus bas locaux).
    """
    if df.empty or len(df) < window * 2:
        return {"supports": [], "resistances": []}

    highs = df["High"].values
    lows = df["Low"].values
    current_price = df["Close"].iloc[-1]

    resistances = []
    supports = []

    for i in range(window, len(df) - window):
        # Resistance : plus haut local
        if highs[i] == max(highs[i - window: i + window + 1]):
            resistances.append(float(highs[i]))
        # Support : plus bas local
        if lows[i] == min(lows[i - window: i + window + 1]):
            supports.append(float(lows[i]))

    # Garder les niveaux les plus proches du prix actuel
    supports = sorted(set(s for s in supports if s < current_price), reverse=True)[:3]
    resistances = sorted(set(r for r in resistances if r > current_price))[:3]

    return {"supports": supports, "resistances": resistances}


def detect_patterns(df: pd.DataFrame) -> list[dict]:
    """Detecte des patterns de prix (double top/bottom, breakout).

    Retourne une liste de patterns detectes.
    """
    patterns = []
    if df.empty or len(df) < 50:
        return patterns

    close = df["Close"].values
    high = df["High"].values
    low = df["Low"].values

    # Detection de breakout (cassure de range)
    recent_high = max(high[-20:])
    recent_low = min(low[-20:])
    current = close[-1]
    prev_high = max(high[-40:-20]) if len(high) >= 40 else recent_high
    prev_low = min(low[-40:-20]) if len(low) >= 40 else recent_low

    if current > prev_high:
        patterns.append({
            "pattern": "breakout_haussier",
            "description": f"Cassure du plus haut recent ({prev_high:.2f})",
            "signal": "achat",
            "strength": 0.7,
        })
    elif current < prev_low:
        patterns.append({
            "pattern": "breakout_baissier",
            "description": f"Cassure du plus bas recent ({prev_low:.2f})",
            "signal": "vente",
            "strength": 0.7,
        })

    # Detection simplifiee de double top
    if len(high) >= 30:
        peaks = []
        for i in range(5, len(high) - 5):
            if high[i] == max(high[i - 5: i + 6]):
                peaks.append((i, high[i]))

        if len(peaks) >= 2:
            last_two = peaks[-2:]
            price_diff_pct = abs(last_two[0][1] - last_two[1][1]) / last_two[0][1]
            if price_diff_pct < 0.02 and current < last_two[1][1] * 0.98:
                patterns.append({
                    "pattern": "double_top",
                    "description": (
                        f"Double sommet detecte (~{last_two[0][1]:.2f})"
                    ),
                    "signal": "vente",
                    "strength": 0.6,
                })

    # Detection simplifiee de double bottom
    if len(low) >= 30:
        troughs = []
        for i in range(5, len(low) - 5):
            if low[i] == min(low[i - 5: i + 6]):
                troughs.append((i, low[i]))

        if len(troughs) >= 2:
            last_two = troughs[-2:]
            price_diff_pct = abs(last_two[0][1] - last_two[1][1]) / last_two[0][1]
            if price_diff_pct < 0.02 and current > last_two[1][1] * 1.02:
                patterns.append({
                    "pattern": "double_bottom",
                    "description": (
                        f"Double creux detecte (~{last_two[0][1]:.2f})"
                    ),
                    "signal": "achat",
                    "strength": 0.6,
                })

    return patterns


def get_technical_summary(df: pd.DataFrame) -> dict:
    """Retourne un resume complet de l'analyse technique.

    Inclut tendance, signaux des indicateurs, niveaux cles, patterns.
    """
    if df.empty:
        return {
            "trend": "neutre",
            "signals": {},
            "support_resistance": {"supports": [], "resistances": []},
            "patterns": [],
            "overall_score": 0.0,
        }

    # Calculer les indicateurs
    df = compute_indicators(df)

    # Signaux individuels
    rsi_signal = get_rsi_signal(df)
    macd_signal = get_macd_signal(df)
    bb_signal = get_bollinger_signal(df)
    volume = detect_volume_anomaly(df)

    # Tendance
    trend = detect_trend(df)
    trend_score = {"haussiere": 0.5, "baissiere": -0.5, "neutre": 0.0}[trend]

    # Support / Resistance
    sr = find_support_resistance(df)

    # Patterns
    patterns = detect_patterns(df)
    pattern_score = sum(
        p["strength"] * (1 if p["signal"] == "achat" else -1)
        for p in patterns
    )

    # Score global (moyenne ponderee)
    scores = [
        (rsi_signal["score"], 0.2),
        (macd_signal["score"], 0.25),
        (bb_signal["score"], 0.15),
        (trend_score, 0.25),
        (min(1.0, max(-1.0, pattern_score)), 0.15),
    ]
    overall_score = sum(s * w for s, w in scores)

    return {
        "trend": trend,
        "signals": {
            "rsi": rsi_signal,
            "macd": macd_signal,
            "bollinger": bb_signal,
            "volume_anomaly": volume,
        },
        "support_resistance": sr,
        "patterns": patterns,
        "overall_score": overall_score,
    }
