"""Recuperation d'actualites financieres via RSS et NewsAPI."""

import feedparser
import requests
from datetime import datetime, timedelta
from typing import Optional

from config import RSS_FEEDS, NEWSAPI_KEY, NEWSAPI_BASE_URL


def fetch_rss_news(max_per_feed: int = 10) -> list[dict]:
    """Recupere les actualites depuis les flux RSS configures.

    Returns:
        Liste de dicts avec: title, summary, link, source, published
    """
    all_news = []

    for source_name, feed_url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:max_per_feed]:
                published = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    try:
                        published = datetime(*entry.published_parsed[:6])
                    except Exception:
                        pass

                all_news.append({
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", ""),
                    "link": entry.get("link", ""),
                    "source": source_name,
                    "published": published,
                })
        except Exception:
            continue

    # Trier par date (plus recentes en premier)
    all_news.sort(
        key=lambda x: x["published"] or datetime.min,
        reverse=True,
    )
    return all_news


def fetch_newsapi_news(
    query: str,
    language: str = "fr",
    page_size: int = 10,
) -> list[dict]:
    """Recupere les actualites depuis NewsAPI (free tier).

    Args:
        query: Terme de recherche (ex: nom d'entreprise, secteur)
        language: Langue des articles
        page_size: Nombre d'articles max

    Returns:
        Liste de dicts avec: title, summary, link, source, published
    """
    if not NEWSAPI_KEY:
        return []

    try:
        resp = requests.get(
            f"{NEWSAPI_BASE_URL}/everything",
            params={
                "q": query,
                "language": language,
                "pageSize": page_size,
                "sortBy": "publishedAt",
                "apiKey": NEWSAPI_KEY,
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return []

        data = resp.json()
        articles = []
        for article in data.get("articles", []):
            published = None
            if article.get("publishedAt"):
                try:
                    published = datetime.fromisoformat(
                        article["publishedAt"].replace("Z", "+00:00")
                    )
                except ValueError:
                    pass

            articles.append({
                "title": article.get("title", ""),
                "summary": article.get("description", ""),
                "link": article.get("url", ""),
                "source": article.get("source", {}).get("name", "NewsAPI"),
                "published": published,
            })
        return articles
    except Exception:
        return []


def get_news_for_ticker(
    ticker: str,
    company_name: str = "",
    max_results: int = 5,
) -> list[dict]:
    """Recupere les actualites pour un ticker specifique.

    Combine RSS (filtrage par mots-cles) et NewsAPI.
    """
    # Construire les termes de recherche
    search_terms = [ticker.replace(".PA", "")]
    if company_name:
        search_terms.append(company_name)

    # Essayer NewsAPI d'abord (si cle disponible)
    news = []
    for term in search_terms:
        newsapi_results = fetch_newsapi_news(term, page_size=max_results)
        news.extend(newsapi_results)
        if news:
            break

    # Completer avec RSS si pas assez de resultats
    if len(news) < max_results:
        rss_news = fetch_rss_news()
        for item in rss_news:
            title_lower = item["title"].lower()
            summary_lower = item.get("summary", "").lower()
            for term in search_terms:
                if term.lower() in title_lower or term.lower() in summary_lower:
                    news.append(item)
                    break

    # Deduplquer par titre
    seen_titles = set()
    unique_news = []
    for item in news:
        if item["title"] not in seen_titles:
            seen_titles.add(item["title"])
            unique_news.append(item)

    return unique_news[:max_results]


def get_sector_news(sector: str, max_results: int = 10) -> list[dict]:
    """Recupere les actualites pour un secteur."""
    # Chercher dans les RSS avec le nom du secteur
    rss_news = fetch_rss_news()
    sector_lower = sector.lower()

    filtered = [
        item for item in rss_news
        if sector_lower in item["title"].lower()
        or sector_lower in item.get("summary", "").lower()
    ]

    # Completer avec NewsAPI
    if len(filtered) < max_results:
        api_news = fetch_newsapi_news(f"{sector} bourse", page_size=max_results)
        filtered.extend(api_news)

    # Deduplication
    seen = set()
    unique = []
    for item in filtered:
        if item["title"] not in seen:
            seen.add(item["title"])
            unique.append(item)

    return unique[:max_results]


def get_ticker_news_yfinance(ticker: str, max_results: int = 8) -> list[dict]:
    """Récupère les news yfinance (Google Finance) pour un ticker."""
    import yfinance as yf
    from datetime import datetime, timezone
    try:
        stock = yf.Ticker(ticker)
        raw = stock.news or []
        results = []
        for item in raw[:max_results]:
            content = item.get("content", {})
            # yfinance ≥0.2.x wraps data in "content"
            title = content.get("title") or item.get("title", "")
            link  = (content.get("canonicalUrl", {}) or {}).get("url") or \
                    content.get("clickThroughUrl", {}).get("url", "") or \
                    item.get("link", "")
            source = (content.get("provider", {}) or {}).get("displayName") or \
                     item.get("publisher", "")
            pub_ts = content.get("pubDate") or item.get("providerPublishTime")
            published = None
            if isinstance(pub_ts, str):
                try:
                    published = datetime.fromisoformat(pub_ts.replace("Z", "+00:00"))
                except Exception:
                    pass
            elif isinstance(pub_ts, (int, float)):
                published = datetime.fromtimestamp(pub_ts, tz=timezone.utc)
            if title:
                results.append({
                    "title": title,
                    "summary": content.get("summary", "") or item.get("summary", ""),
                    "link": link,
                    "source": source,
                    "published": published,
                })
        return results
    except Exception:
        return []


def get_market_news_eu(period: str = "week", max_results: int = 20) -> list[dict]:
    """
    Actualités marchés européens filtrées par période.
    period: 'today' | 'week' | 'month'
    """
    from datetime import datetime, timedelta
    cutoff_map = {"today": timedelta(days=1), "week": timedelta(days=7), "month": timedelta(days=30)}
    cutoff = datetime.utcnow() - cutoff_map.get(period, timedelta(days=7))

    all_news = fetch_rss_news(max_per_feed=30)
    filtered = [n for n in all_news if n.get("published") and n["published"] >= cutoff]

    # Also try major EU tickers news via yfinance for broad market pulse
    eu_bellwethers = ["AIR.PA", "ASML.AS", "SAP.DE", "NOVO-B.CO", "LVMH.PA"]
    for ticker in eu_bellwethers:
        try:
            ticker_news = get_ticker_news_yfinance(ticker, max_results=3)
            for n in ticker_news:
                if n.get("published") and n["published"].replace(tzinfo=None) >= cutoff:
                    filtered.append(n)
        except Exception:
            continue

    # Dedup by title
    seen, unique = set(), []
    for n in sorted(filtered, key=lambda x: x.get("published") or datetime.min, reverse=True):
        if n["title"] not in seen:
            seen.add(n["title"])
            unique.append(n)
    return unique[:max_results]
