"""Analyse de sentiment des actualites financieres.

Utilise une approche par mots-cles financiers, avec possibilite
d'enrichissement par LLM local (Ollama) si disponible.
"""

import re
from typing import Optional

from utils.llm_client import analyze_news_sentiment_llm, is_ollama_available

# Dictionnaires de mots-cles financiers (francais + anglais)
BULLISH_KEYWORDS = [
    # Francais
    "hausse", "haussier", "progresse", "progression", "croissance",
    "benefice", "profit", "record", "rebond", "amelioration",
    "surperformance", "acceleration", "optimisme", "confiance",
    "acquisition", "contrat", "dividende", "rachat", "releve",
    "objectif releve", "recommandation achat", "surperformer",
    "fort", "solide", "excellent", "meilleur", "depasse",
    "depasse les attentes", "au-dessus du consensus",
    # Anglais
    "bullish", "rally", "surge", "growth", "upgrade",
    "outperform", "buy", "strong buy", "beat", "exceeded",
    "positive", "upside", "breakout", "momentum",
    "recovery", "profit", "dividend", "acquisition",
]

BEARISH_KEYWORDS = [
    # Francais
    "baisse", "baissier", "recul", "chute", "perte",
    "deficit", "deterioration", "avertissement", "profit warning",
    "sous-performance", "ralentissement", "pessimisme",
    "inquietude", "risque", "crise", "faillite", "restructuration",
    "licenciement", "degrade", "objectif abaisse",
    "recommandation vente", "sous-performer",
    "faible", "decevant", "inferieur", "manque",
    "sous le consensus", "en dessous des attentes",
    # Anglais
    "bearish", "crash", "decline", "downgrade", "sell",
    "underperform", "miss", "missed", "negative", "downside",
    "warning", "loss", "risk", "crisis", "recession",
    "layoff", "restructuring", "weak", "disappointing",
]


def analyze_sentiment_keywords(text: str) -> dict:
    """Analyse le sentiment d'un texte par mots-cles.

    Returns:
        dict avec:
        - score: float entre -1.0 (tres baissier) et +1.0 (tres haussier)
        - bullish_matches: list des mots haussiers trouves
        - bearish_matches: list des mots baissiers trouves
        - label: str (haussier, baissier, neutre)
    """
    text_lower = text.lower()

    bullish_found = [kw for kw in BULLISH_KEYWORDS if kw in text_lower]
    bearish_found = [kw for kw in BEARISH_KEYWORDS if kw in text_lower]

    total = len(bullish_found) + len(bearish_found)
    if total == 0:
        return {
            "score": 0.0,
            "bullish_matches": [],
            "bearish_matches": [],
            "label": "neutre",
        }

    # Score normalise
    raw_score = (len(bullish_found) - len(bearish_found)) / total
    score = max(-1.0, min(1.0, raw_score))

    if score > 0.2:
        label = "haussier"
    elif score < -0.2:
        label = "baissier"
    else:
        label = "neutre"

    return {
        "score": score,
        "bullish_matches": bullish_found,
        "bearish_matches": bearish_found,
        "label": label,
    }


def analyze_news_sentiment(
    news_items: list[dict],
    use_llm: bool = False,
) -> dict:
    """Analyse le sentiment d'une liste d'actualites.

    Args:
        news_items: Liste de dicts avec 'title' et optionnellement 'summary'
        use_llm: Si True, tente d'utiliser le LLM local

    Returns:
        dict avec:
        - overall_score: float [-1, +1]
        - overall_label: str
        - items: list de dicts avec score par news
    """
    if not news_items:
        return {
            "overall_score": 0.0,
            "overall_label": "neutre",
            "items": [],
        }

    analyzed_items = []
    scores = []

    llm_available = use_llm and is_ollama_available()

    for item in news_items:
        text = item.get("title", "")
        if item.get("summary"):
            text += " " + item["summary"]

        # Analyse par mots-cles
        kw_result = analyze_sentiment_keywords(text)

        # Enrichissement LLM si disponible
        llm_result = None
        if llm_available:
            llm_result = analyze_news_sentiment_llm(
                item.get("title", ""),
                item.get("summary", ""),
            )

        # Combiner les scores
        if llm_result and "sentiment" in llm_result:
            # Poids 60% LLM, 40% mots-cles si les deux sont dispo
            final_score = 0.6 * llm_result["sentiment"] + 0.4 * kw_result["score"]
        else:
            final_score = kw_result["score"]

        analyzed_items.append({
            **item,
            "sentiment_score": final_score,
            "sentiment_label": kw_result["label"],
            "keywords_found": {
                "bullish": kw_result["bullish_matches"],
                "bearish": kw_result["bearish_matches"],
            },
            "llm_analysis": llm_result,
        })
        scores.append(final_score)

    # Score global (moyenne ponderee : news recentes comptent plus)
    if scores:
        weights = list(range(len(scores), 0, -1))  # Plus recent = poids plus fort
        total_weight = sum(weights)
        overall_score = sum(s * w for s, w in zip(scores, weights)) / total_weight
    else:
        overall_score = 0.0

    if overall_score > 0.2:
        overall_label = "haussier"
    elif overall_score < -0.2:
        overall_label = "baissier"
    else:
        overall_label = "neutre"

    return {
        "overall_score": overall_score,
        "overall_label": overall_label,
        "items": analyzed_items,
    }


def get_sentiment_for_ticker(ticker: str, company_name: str = "") -> dict:
    """Raccourci : recupere les news et analyse le sentiment pour un ticker."""
    from data.news_fetcher import get_news_for_ticker
    from config import USE_LLM

    news = get_news_for_ticker(ticker, company_name, max_results=10)
    return analyze_news_sentiment(news, use_llm=USE_LLM)
