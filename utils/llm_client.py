"""Client LLM optionnel (Ollama local ou API externe).

Ce module est optionnel. Si Ollama n'est pas disponible,
les fonctions retournent des reponses par defaut.
"""

import requests
from typing import Optional

from config import OLLAMA_BASE_URL, OLLAMA_MODEL, USE_LLM


def is_ollama_available() -> bool:
    """Verifie si Ollama est accessible."""
    if not USE_LLM:
        return False
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False


def query_llm(prompt: str, system: str = "", max_tokens: int = 500) -> Optional[str]:
    """Envoie une requete a Ollama et retourne la reponse.

    Returns None si le LLM n'est pas disponible.
    """
    if not USE_LLM:
        return None

    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        if system:
            payload["system"] = system

        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=60,
        )
        if resp.status_code == 200:
            return resp.json().get("response", "")
    except Exception:
        pass

    return None


def analyze_news_sentiment_llm(headline: str, summary: str = "") -> Optional[dict]:
    """Utilise le LLM pour analyser le sentiment d'une news financiere.

    Returns:
        dict avec 'sentiment' (-1 a +1) et 'explanation', ou None.
    """
    prompt = f"""Analyse le sentiment de cette actualite financiere.
Reponds UNIQUEMENT avec un JSON: {{"sentiment": <float entre -1.0 et 1.0>, "explanation": "<1 phrase>"}}

Titre: {headline}
{f'Resume: {summary}' if summary else ''}
"""
    system = (
        "Tu es un analyste financier. Evalue le sentiment: "
        "-1.0 = tres baissier, 0 = neutre, +1.0 = tres haussier."
    )

    response = query_llm(prompt, system=system, max_tokens=150)
    if response:
        import json
        try:
            # Essayer d'extraire le JSON de la reponse
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
        except (json.JSONDecodeError, ValueError):
            pass

    return None
