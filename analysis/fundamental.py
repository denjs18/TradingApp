"""Analyse fondamentale : P/E, PEG, dividendes, marges, dette, etc."""

import yfinance as yf
from typing import Optional


def _num(val) -> Optional[float]:
    """Convertit une valeur en float, retourne None si impossible."""
    if val is None:
        return None
    try:
        f = float(val)
        return f if f == f else None  # rejette NaN
    except (TypeError, ValueError):
        return None


def get_fundamental_data(ticker: str) -> dict:
    """Recupere les donnees fondamentales d'une action.

    Returns:
        Dict avec toutes les metriques fondamentales disponibles.
    """
    stock = yf.Ticker(ticker)
    data = {
        "pe_ratio": None,
        "forward_pe": None,
        "peg_ratio": None,
        "price_to_book": None,
        "dividend_yield": None,
        "dividend_rate": None,
        "payout_ratio": None,
        "revenue_growth": None,
        "earnings_growth": None,
        "profit_margin": None,
        "operating_margin": None,
        "gross_margin": None,
        "debt_to_equity": None,
        "current_ratio": None,
        "return_on_equity": None,
        "return_on_assets": None,
        "market_cap": None,
        "enterprise_value": None,
        "ev_to_ebitda": None,
        "free_cash_flow": None,
        "beta": None,
        "sector": None,
        "industry": None,
        "name": None,
    }

    try:
        info = stock.info
        data["pe_ratio"] = _num(info.get("trailingPE"))
        data["forward_pe"] = _num(info.get("forwardPE"))
        data["peg_ratio"] = _num(info.get("pegRatio"))
        data["price_to_book"] = _num(info.get("priceToBook"))
        data["dividend_yield"] = _num(info.get("dividendYield"))
        data["dividend_rate"] = _num(info.get("dividendRate"))
        data["payout_ratio"] = _num(info.get("payoutRatio"))
        data["revenue_growth"] = _num(info.get("revenueGrowth"))
        data["earnings_growth"] = _num(info.get("earningsGrowth"))
        data["profit_margin"] = _num(info.get("profitMargins"))
        data["operating_margin"] = _num(info.get("operatingMargins"))
        data["gross_margin"] = _num(info.get("grossMargins"))
        data["debt_to_equity"] = _num(info.get("debtToEquity"))
        data["current_ratio"] = _num(info.get("currentRatio"))
        data["return_on_equity"] = _num(info.get("returnOnEquity"))
        data["return_on_assets"] = _num(info.get("returnOnAssets"))
        data["market_cap"] = _num(info.get("marketCap"))
        data["enterprise_value"] = _num(info.get("enterpriseValue"))
        data["ev_to_ebitda"] = _num(info.get("enterpriseToEbitda"))
        data["free_cash_flow"] = _num(info.get("freeCashflow"))
        data["beta"] = _num(info.get("beta"))
        data["sector"] = info.get("sector")
        data["industry"] = info.get("industry")
        data["name"] = info.get("longName") or info.get("shortName")
        # 52-week context for valuation
        w52_high = _num(info.get("fiftyTwoWeekHigh"))
        w52_low = _num(info.get("fiftyTwoWeekLow"))
        current = _num(info.get("currentPrice") or info.get("regularMarketPrice"))
        data["week52_high"] = w52_high
        data["week52_low"] = w52_low
        if w52_high and w52_low and w52_high > w52_low and current:
            data["position_52w"] = round((current - w52_low) / (w52_high - w52_low) * 100, 1)
            data["pct_from_52w_high"] = round((current - w52_high) / w52_high * 100, 1)
            data["pct_from_52w_low"] = round((current - w52_low) / w52_low * 100, 1)
        else:
            data["position_52w"] = None
            data["pct_from_52w_high"] = None
            data["pct_from_52w_low"] = None
        data["five_year_avg_dividend_yield"] = _num(info.get("fiveYearAvgDividendYield"))
        data["trailing_annual_dividend_yield"] = _num(info.get("trailingAnnualDividendYield"))
    except Exception:
        pass

    return data


def score_valuation(fundamentals: dict) -> dict:
    """Score la valorisation de l'action."""
    scores = []
    details = []

    pe = _num(fundamentals.get("pe_ratio"))
    if pe is not None and pe > 0:
        if pe < 10:
            scores.append(1.0); details.append(f"P/E bas ({pe:.1f}) - potentiellement sous-evalue")
        elif pe < 15:
            scores.append(0.5); details.append(f"P/E raisonnable ({pe:.1f})")
        elif pe < 25:
            scores.append(0.0); details.append(f"P/E moyen ({pe:.1f})")
        elif pe < 40:
            scores.append(-0.5); details.append(f"P/E eleve ({pe:.1f}) - potentiellement surevalue")
        else:
            scores.append(-1.0); details.append(f"P/E tres eleve ({pe:.1f}) - attention a la valorisation")

    peg = _num(fundamentals.get("peg_ratio"))
    if peg is not None and peg > 0:
        if peg < 1:
            scores.append(0.8); details.append(f"PEG < 1 ({peg:.2f}) - croissance sous-evaluee")
        elif peg < 1.5:
            scores.append(0.3); details.append(f"PEG correct ({peg:.2f})")
        elif peg < 2:
            scores.append(0.0); details.append(f"PEG moyen ({peg:.2f})")
        else:
            scores.append(-0.5); details.append(f"PEG eleve ({peg:.2f}) - croissance surevaluee")

    ptb = _num(fundamentals.get("price_to_book"))
    if ptb is not None and ptb > 0:
        if ptb < 1:
            scores.append(0.7); details.append(f"P/B < 1 ({ptb:.2f}) - sous la valeur comptable")
        elif ptb < 3:
            scores.append(0.2); details.append(f"P/B raisonnable ({ptb:.2f})")
        else:
            scores.append(-0.3); details.append(f"P/B eleve ({ptb:.2f})")

    # 52-week position bonus: near 52w low = attractive for DCA
    pos_52w = fundamentals.get("position_52w")
    if pos_52w is not None:
        if pos_52w <= 20:
            scores.append(0.6); details.append(f"Cours proche du plus bas 52 semaines ({pos_52w:.0f}% de la range) — zone d'accumulation")
        elif pos_52w <= 40:
            scores.append(0.2); details.append(f"Cours dans le bas de la range 52 semaines ({pos_52w:.0f}%)")
        elif pos_52w >= 85:
            scores.append(-0.4); details.append(f"Cours proche du plus haut 52 semaines ({pos_52w:.0f}%) — prudence")
        elif pos_52w >= 70:
            scores.append(-0.1); details.append(f"Cours dans le haut de la range 52 semaines ({pos_52w:.0f}%)")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_profitability(fundamentals: dict) -> dict:
    """Score la rentabilite de l'entreprise."""
    scores = []
    details = []

    pm = _num(fundamentals.get("profit_margin"))
    if pm is not None:
        if pm > 0.20:
            scores.append(1.0); details.append(f"Marge nette excellente ({pm:.1%})")
        elif pm > 0.10:
            scores.append(0.5); details.append(f"Bonne marge nette ({pm:.1%})")
        elif pm > 0.05:
            scores.append(0.0); details.append(f"Marge nette correcte ({pm:.1%})")
        elif pm > 0:
            scores.append(-0.3); details.append(f"Marge nette faible ({pm:.1%})")
        else:
            scores.append(-1.0); details.append(f"Marge nette negative ({pm:.1%})")

    roe = _num(fundamentals.get("return_on_equity"))
    if roe is not None:
        if roe > 0.20:
            scores.append(0.8); details.append(f"ROE eleve ({roe:.1%})")
        elif roe > 0.10:
            scores.append(0.4); details.append(f"ROE correct ({roe:.1%})")
        elif roe > 0:
            scores.append(0.0); details.append(f"ROE faible ({roe:.1%})")
        else:
            scores.append(-0.7); details.append(f"ROE negatif ({roe:.1%})")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_growth(fundamentals: dict) -> dict:
    """Score la croissance."""
    scores = []
    details = []

    rg = _num(fundamentals.get("revenue_growth"))
    if rg is not None:
        if rg > 0.20:
            scores.append(1.0); details.append(f"Croissance CA forte ({rg:.1%})")
        elif rg > 0.10:
            scores.append(0.6); details.append(f"Bonne croissance CA ({rg:.1%})")
        elif rg > 0:
            scores.append(0.2); details.append(f"Croissance CA faible ({rg:.1%})")
        else:
            scores.append(-0.5); details.append(f"CA en baisse ({rg:.1%})")

    eg = _num(fundamentals.get("earnings_growth"))
    if eg is not None:
        if eg > 0.20:
            scores.append(1.0); details.append(f"Croissance benefices forte ({eg:.1%})")
        elif eg > 0.10:
            scores.append(0.5); details.append(f"Bonne croissance benefices ({eg:.1%})")
        elif eg > 0:
            scores.append(0.1); details.append(f"Croissance benefices faible ({eg:.1%})")
        else:
            scores.append(-0.6); details.append(f"Benefices en baisse ({eg:.1%})")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_financial_health(fundamentals: dict) -> dict:
    """Score la sante financiere (dette, liquidite)."""
    scores = []
    details = []

    dte = _num(fundamentals.get("debt_to_equity"))
    if dte is not None:
        if dte < 30:
            scores.append(0.8); details.append(f"Faible endettement (D/E: {dte:.0f}%)")
        elif dte < 80:
            scores.append(0.3); details.append(f"Endettement modere (D/E: {dte:.0f}%)")
        elif dte < 150:
            scores.append(-0.2); details.append(f"Endettement eleve (D/E: {dte:.0f}%)")
        else:
            scores.append(-0.8); details.append(f"Endettement tres eleve (D/E: {dte:.0f}%)")

    cr = _num(fundamentals.get("current_ratio"))
    if cr is not None:
        if cr > 2:
            scores.append(0.6); details.append(f"Bonne liquidite (CR: {cr:.2f})")
        elif cr > 1:
            scores.append(0.2); details.append(f"Liquidite correcte (CR: {cr:.2f})")
        else:
            scores.append(-0.6); details.append(f"Liquidite insuffisante (CR: {cr:.2f})")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def get_fundamental_summary(ticker: str) -> dict:
    """Retourne un resume complet de l'analyse fondamentale.

    Inclut tous les scores et un score global.
    """
    fundamentals = get_fundamental_data(ticker)

    valuation = score_valuation(fundamentals)
    profitability = score_profitability(fundamentals)
    growth = score_growth(fundamentals)
    health = score_financial_health(fundamentals)

    # Score global (moyenne ponderee)
    weights = {
        "valuation": 0.3,
        "profitability": 0.25,
        "growth": 0.25,
        "health": 0.2,
    }
    sub_scores = {
        "valuation": valuation["score"],
        "profitability": profitability["score"],
        "growth": growth["score"],
        "health": health["score"],
    }
    overall = sum(sub_scores[k] * weights[k] for k in weights)

    # Dividende
    dividend_info = None
    if fundamentals.get("dividend_yield") is not None:
        dividend_info = {
            "yield": fundamentals["dividend_yield"],
            "rate": fundamentals.get("dividend_rate"),
            "payout_ratio": fundamentals.get("payout_ratio"),
        }

    return {
        "name": fundamentals.get("name"),
        "sector": fundamentals.get("sector"),
        "industry": fundamentals.get("industry"),
        "market_cap": fundamentals.get("market_cap"),
        "beta": fundamentals.get("beta"),
        "valuation": valuation,
        "profitability": profitability,
        "growth": growth,
        "health": health,
        "dividend": dividend_info,
        "overall_score": overall,
        "raw_data": fundamentals,
    }
