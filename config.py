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

# --- Pool de tickers étendu (300+ valeurs EU éligibles PEA) ---
ALL_PEA_TICKERS = sorted(set([
    # ── CAC 40 ──────────────────────────────────────────────────────────
    "AIR.PA", "AI.PA", "ATO.PA", "BNP.PA", "CA.PA", "CAP.PA", "CS.PA",
    "DSY.PA", "ENGI.PA", "EL.PA", "EN.PA", "GLE.PA", "HO.PA", "KER.PA",
    "LR.PA", "MC.PA", "ML.PA", "ORA.PA", "PUB.PA", "RI.PA", "RMS.PA",
    "RNO.PA", "SAF.PA", "SAN.PA", "SGO.PA", "STLA.PA", "STM.PA", "SU.PA",
    "TKO.PA", "TTE.PA", "URW.PA", "VIE.PA", "VIV.PA", "WLN.PA", "DG.PA",
    "ACA.PA", "ERF.PA", "MT.PA",
    # ── SBF 120 / Euronext Paris Mid & Small Cap ─────────────────────────
    "AM.PA", "BB.PA", "BIC.PA", "BOL.PA", "CBT.PA", "COV.PA", "DEC.PA",
    "EFI.PA", "GTT.PA", "IPN.PA", "JDEP.PA", "LAF.PA", "LSS.PA", "LTA.PA",
    "MMB.PA", "NNI.PA", "ODET.PA", "PGO.PA", "SAFT.PA", "SES.PA", "SFA.PA",
    "SMCP.PA", "SOI.PA", "TFF.PA", "UBI.PA", "UFF.PA", "VCT.PA", "VTE.PA",
    "AMUN.PA", "APAM.PA", "COTA.PA", "ESI.PA", "EXPL.PA", "FREY.PA",
    "GL.PA", "GLIN.PA", "GNE.PA", "HWAY.PA", "ILD.PA", "KLER.PA",
    "LINT.PA", "MANU.PA", "MKGT.PA", "MNL.PA", "MONT.PA", "MRN.PA",
    "NF.PA", "NRO.PA", "PAY.PA", "PRY.PA", "RACL.PA", "RCO.PA",
    "RES.PA", "RSX.PA", "SGE.PA", "SLM.PA", "SLS.PA", "SQLI.PA",
    "TAN.PA", "TCH.PA", "TFF.PA", "TRI.PA", "TXCS.PA", "UMG.PA",
    "VEL.PA", "VK.PA", "VNE.PA", "WEI.PA",
    "ALO.PA", "BVI.PA", "FGR.PA", "GFC.PA", "IQST.PA", "LOUP.PA",
    "NBI.PA", "NEURONES.PA", "OSE.PA", "PCAS.PA", "PRLD.PA", "RBOT.PA",
    "SESG.PA", "SII.PA", "TNOM.PA", "TVTV.PA", "VBFC.PA", "VIRP.PA",
    "HCO.PA", "MELE.PA", "SPDE.PA", "TLX.PA", "XPO.PA",
    # ── Euronext Amsterdam (.AS) ─────────────────────────────────────────
    "ASML.AS", "ADYEN.AS", "INGA.AS", "ABN.AS", "PHIA.AS", "REN.AS",
    "WKL.AS", "HEIA.AS", "NN.AS", "AKZA.AS", "AGN.AS", "RAND.AS",
    "UNA.AS", "DSM.AS", "GLPG.AS", "IMCD.AS", "BESI.AS", "TKWY.AS",
    "SBMO.AS", "WDP.AS", "JDEP.AS", "FLOW.AS", "AHOLD.AS", "OCI.AS",
    "DSFIR.AS", "NSI.AS", "BRNL.AS", "ECMPA.AS", "LIGHT.AS",
    # ── Euronext Brussels (.BR) ──────────────────────────────────────────
    "UCB.BR", "SOLB.BR", "ACKB.BR", "BEFB.BR", "KBC.BR", "AB.BR",
    "ABI.BR", "COLR.BR", "GBLB.BR", "PROXB.BR", "TESB.BR", "WHA.BR",
    "AEDIF.BR", "COFB.BR", "DIL.BR", "INN.BR", "ONTEX.BR", "SCAN.BR",
    # ── XETRA Frankfurt (.DE) ────────────────────────────────────────────
    "SAP.DE", "SIE.DE", "ALV.DE", "MUV2.DE", "DTE.DE", "BAYN.DE",
    "BMW.DE", "BAS.DE", "MBG.DE", "DB1.DE", "EOAN.DE", "RWE.DE",
    "VOW3.DE", "ADS.DE", "HEN3.DE", "FRE.DE", "IFX.DE", "LIN.DE",
    "MTX.DE", "DBK.DE", "HNR1.DE", "KNEBV.DE", "DHER.DE", "ZAL.DE",
    "AIXA.DE", "CON.DE", "DPW.DE", "HFCL.DE", "KGX.DE", "MRK.DE",
    "NDA.DE", "PSM.DE", "QIAGEN.DE", "RHM.DE", "SHL.DE", "SMHN.DE",
    "SRT3.DE", "WAF.DE", "WDI.DE", "WUBA.DE",
    # ── Bolsa Madrid (.MC) ───────────────────────────────────────────────
    "SAN.MC", "BBVA.MC", "TEF.MC", "ITX.MC", "IBE.MC", "REP.MC",
    "CABK.MC", "FER.MC", "ACS.MC", "MAP.MC", "GRF.MC", "CLNX.MC",
    "VIS.MC", "ENG.MC", "NTGY.MC", "ACX.MC", "ANA.MC", "BKT.MC",
    "ENCE.MC", "FDR.MC", "IAG.MC", "LOGN.MC", "MRL.MC", "NHH.MC",
    # ── Borsa Milano (.MI) ───────────────────────────────────────────────
    "ENI.MI", "ENEL.MI", "ISP.MI", "UCG.MI", "STM.MI", "LDO.MI",
    "RACE.MI", "PRY.MI", "BMED.MI", "CNHI.MI", "DIA.MI", "G.MI",
    "MFCG.MI", "PIRC.MI", "PSTI.MI", "REC.MI", "SFER.MI", "TIT.MI",
    # ── Nasdaq Stockholm (.ST) ───────────────────────────────────────────
    "ERIC-B.ST", "VOLV-B.ST", "SEB-A.ST", "SHB-A.ST", "SWED-A.ST",
    "ABB.ST", "ATCO-B.ST", "NIBE-B.ST", "ALIV-SDB.ST", "AZN.ST",
    "ESSITY-B.ST", "HEXA-B.ST", "HM-B.ST", "INVE-B.ST", "KINV-B.ST",
    "NDA-SE.ST", "SAND.ST", "SECU-B.ST", "SKA-B.ST", "SSAB-B.ST",
    # ── Nasdaq Copenhagen (.CO) ──────────────────────────────────────────
    "NOVO-B.CO", "MAERSK-B.CO", "ORSTED.CO", "CARL-B.CO", "COLO-B.CO",
    "DEMANT.CO", "DSV.CO", "FLS.CO", "GN.CO", "NETC.CO", "RBREW.CO",
    "ROCKB.CO", "SIM.CO", "SYDB.CO", "TRYG.CO", "VWS.CO",
]))

# Liste unique de tous les tickers (par défaut: secteurs seulement)
ALL_TICKERS = sorted(set(t for tickers in SECTORS.values() for t in tickers))

# Tickers favoris par defaut
DEFAULT_FAVORITES = ["AIR.PA", "SAF.PA", "TKO.PA", "DAS.PA", "MC.PA"]

# --- Modes de trading ---
TRADING_MODES = {
    "conservative": {
        "name": "Conservateur",
        "description": "24 tickers · cycle 2min · seuils stricts",
        "interval_seconds": 120,
        "buy_threshold": 0.50,
        "sell_threshold": -0.50,
        "max_positions": 3,
        "max_position_pct": 15.0,
        "stop_loss_pct": -1.5,
        "take_profit_pct": 3.0,
        "max_workers": 5,
        "ticker_count": 24,
    },
    "standard": {
        "name": "Standard",
        "description": "24 tickers · cycle 1min · paramètres équilibrés",
        "interval_seconds": 60,
        "buy_threshold": 0.30,
        "sell_threshold": -0.30,
        "max_positions": 5,
        "max_position_pct": 20.0,
        "stop_loss_pct": -2.0,
        "take_profit_pct": 4.0,
        "max_workers": 10,
        "ticker_count": 24,
    },
    "aggressive": {
        "name": "Agressif",
        "description": "100 tickers · cycle 45s · seuils bas",
        "interval_seconds": 45,
        "buy_threshold": 0.15,
        "sell_threshold": -0.15,
        "max_positions": 15,
        "max_position_pct": 7.0,
        "stop_loss_pct": -3.0,
        "take_profit_pct": 6.0,
        "max_workers": 20,
        "ticker_count": 100,
    },
    "ultra": {
        "name": "Ultra Agressif",
        "description": "300+ tickers · cycle 30s · rotation auto",
        "interval_seconds": 30,
        "buy_threshold": 0.05,
        "sell_threshold": -0.05,
        "max_positions": 25,
        "max_position_pct": 4.0,
        "stop_loss_pct": -4.0,
        "take_profit_pct": 8.0,
        "max_workers": 30,
        "ticker_count": None,  # tous les tickers
    },
}

DEFAULT_TRADING_MODE = "standard"

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
