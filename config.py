"""Configuration globale de l'application de trading."""

import os
from pathlib import Path

# --- Chemins ---
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "trading.db"

# --- Euronext Tickers par secteur ---
SECTORS = {
    "Defense": ["HO.PA", "SAF.PA", "TKO.PA"],
    "Aeronautique": ["AIR.PA", "SAF.PA", "AM.PA"],
    "Luxe": ["MC.PA", "KER.PA", "RMS.PA"],
    "Banque": ["BNP.PA", "GLE.PA", "ACA.PA"],
    "Energie": ["TTE.PA", "ENGI.PA"],
    "Technologie": ["CAP.PA", "DAS.PA", "STM.PA"],
    "Automobile": ["RNO.PA", "STL.PA"],
    "Sante": ["SAN.PA", "BN.PA"],
    "Telecom": ["ORA.PA"],
    "Industrie": ["SU.PA", "SGO.PA", "LR.PA"],
}

# Liste unique de tous les tickers
ALL_TICKERS = sorted(set(t for tickers in SECTORS.values() for t in tickers))

# Tickers favoris par defaut
DEFAULT_FAVORITES = ["AIR.PA", "SAF.PA", "TKO.PA", "DAS.PA", "MC.PA"]

# --- Parametres de marche ---
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 0
MARKET_CLOSE_HOUR = 17
MARKET_CLOSE_MINUTE = 30
MARKET_TIMEZONE = "Europe/Paris"

# Minutes a eviter en debut/fin de seance (volatilite)
MARKET_BUFFER_MINUTES = 15

# --- Parametres de trading paper ---
DEFAULT_INITIAL_BALANCE = 10000.0  # EUR
DEFAULT_SPREAD_PCT = 0.05  # 0.05% de spread simule
COMMISSION_PCT = 0.0  # Pas de commission en paper trading

# --- Parametres de risque ---
DEFAULT_STOP_LOSS_PCT = -2.0  # -2%
DEFAULT_TAKE_PROFIT_PCT = 3.0  # +3%
DEFAULT_MAX_POSITION_PCT = 20.0  # 20% du portefeuille par position
DEFAULT_MAX_OPEN_POSITIONS = 5

# --- Parametres d'analyse technique ---
TECHNICAL_PARAMS = {
    "sma_short": 20,
    "sma_medium": 50,
    "sma_long": 200,
    "ema_short": 12,
    "ema_long": 26,
    "rsi_period": 14,
    "rsi_oversold": 30,
    "rsi_overbought": 70,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "bb_period": 20,
    "bb_std": 2,
    "volume_avg_period": 20,
    "volume_anomaly_threshold": 2.0,
}

# --- Scoring ---
SCORE_BUY_THRESHOLD = 0.3  # Score > 0.3 => signal d'achat
SCORE_SELL_THRESHOLD = -0.3  # Score < -0.3 => signal de vente
OPPORTUNITY_HIGH_SCORE = 7  # Score d'opportunite declenchant une alerte

# --- Sources de news ---
RSS_FEEDS = {
    "Boursorama": "https://www.boursorama.com/rss/actualites",
    "Les Echos Bourse": "https://syndication.lesechos.fr/rss/rss_bourse.xml",
    "Investing FR": "https://fr.investing.com/rss/news.rss",
}

NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")
NEWSAPI_BASE_URL = "https://newsapi.org/v2"

# --- LLM (optionnel) ---
OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")
USE_LLM = os.environ.get("USE_LLM", "false").lower() == "true"

# --- Strategies disponibles ---
STRATEGIES = ["momentum", "mean_reversion", "breakout", "combined"]

# --- Intervalles de rafraichissement ---
SCHEDULER_INTERVAL_SECONDS = 60  # Verification toutes les minutes
DATA_CACHE_SECONDS = 300  # Cache des donnees de marche: 5 minutes
