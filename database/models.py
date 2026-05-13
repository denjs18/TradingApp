"""Schemas et helpers pour les tables SQLite.

Ce module fournit des dataclasses correspondant aux tables
et des fonctions utilitaires pour les operations CRUD courantes.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class WatchlistItem:
    ticker: str
    name: str = ""
    sector: str = ""
    id: Optional[int] = None
    added_at: Optional[datetime] = None


@dataclass
class PortfolioPosition:
    """Position du portefeuille reel (DCA)."""
    ticker: str
    shares: float
    avg_price: float
    id: Optional[int] = None
    added_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class PaperPosition:
    """Position du portefeuille paper trading."""
    ticker: str
    shares: float
    entry_price: float
    current_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    id: Optional[int] = None
    opened_at: Optional[datetime] = None
    status: str = "open"


@dataclass
class Trade:
    ticker: str
    side: str  # "buy" ou "sell"
    shares: float
    price: float
    total: float
    strategy: str = ""
    reason: str = ""
    id: Optional[int] = None
    executed_at: Optional[datetime] = None


@dataclass
class OpportunityScore:
    ticker: str
    score: float
    technical_score: float = 0.0
    fundamental_score: float = 0.0
    sentiment_score: float = 0.0
    recommendation: str = ""
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_price: Optional[float] = None
    justification: str = ""
    id: Optional[int] = None
    computed_at: Optional[datetime] = None


@dataclass
class DCARecommendation:
    ticker: str
    action: str  # "renforcer", "conserver", "alleger"
    reason: str = ""
    short_term_outlook: str = ""
    medium_term_outlook: str = ""
    long_term_outlook: str = ""
    id: Optional[int] = None
    computed_at: Optional[datetime] = None
