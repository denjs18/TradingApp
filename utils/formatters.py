"""Formatage des donnees pour affichage dans le dashboard."""

from datetime import datetime
from typing import Optional


def format_currency(value: Optional[float], currency: str = "EUR") -> str:
    """Formate un montant en devise."""
    if value is None:
        return "N/A"
    symbol = "€" if currency == "EUR" else "$"
    return f"{value:,.2f} {symbol}"


def format_percentage(value: Optional[float], decimals: int = 2) -> str:
    """Formate un pourcentage avec couleur indicative."""
    if value is None:
        return "N/A"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.{decimals}f}%"


def format_large_number(value: Optional[float]) -> str:
    """Formate un grand nombre (capitalisation, volume, etc.)."""
    if value is None:
        return "N/A"
    if abs(value) >= 1e12:
        return f"{value / 1e12:.2f}T"
    if abs(value) >= 1e9:
        return f"{value / 1e9:.2f}B"
    if abs(value) >= 1e6:
        return f"{value / 1e6:.2f}M"
    if abs(value) >= 1e3:
        return f"{value / 1e3:.1f}K"
    return f"{value:.0f}"


def format_timestamp(dt: Optional[datetime], fmt: str = "%d/%m/%Y %H:%M") -> str:
    """Formate un datetime pour affichage."""
    if dt is None:
        return "N/A"
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return dt
    return dt.strftime(fmt)


def color_value(value: Optional[float]) -> str:
    """Retourne une couleur CSS en fonction du signe."""
    if value is None:
        return "gray"
    if value > 0:
        return "green"
    if value < 0:
        return "red"
    return "gray"


def recommendation_emoji(recommendation: str) -> str:
    """Retourne un emoji pour une recommandation."""
    mapping = {
        "acheter": "🟢",
        "renforcer": "🟢",
        "surveiller": "🟡",
        "conserver": "🟡",
        "eviter": "🔴",
        "alleger": "🔴",
        "vendre": "🔴",
    }
    return mapping.get(recommendation.lower(), "⚪")


def score_to_stars(score: float, max_score: float = 10.0, stars: int = 5) -> str:
    """Convertit un score en etoiles."""
    filled = round((score / max_score) * stars)
    filled = max(0, min(stars, filled))
    return "★" * filled + "☆" * (stars - filled)


def truncate_text(text: str, max_length: int = 100) -> str:
    """Tronque un texte avec ellipsis."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."
