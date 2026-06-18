"""Analyse fondamentale : P/E, PEG, dividendes, marges, dette, etc."""

import yfinance as yf
from typing import Optional


# Médianes sectorielles pour normaliser les ratios
# Source: moyennes historiques par secteur (ordre de grandeur)
SECTOR_MEDIANS = {
    "Technology":             {"pe": 28, "pb": 5.0, "roe": 0.20, "debt_eq": 40,  "pm": 0.18},
    "Financial Services":     {"pe": 12, "pb": 1.2, "roe": 0.12, "debt_eq": 200, "pm": 0.22},
    "Healthcare":             {"pe": 22, "pb": 3.5, "roe": 0.15, "debt_eq": 60,  "pm": 0.12},
    "Consumer Cyclical":      {"pe": 18, "pb": 2.5, "roe": 0.14, "debt_eq": 80,  "pm": 0.07},
    "Consumer Defensive":     {"pe": 20, "pb": 3.0, "roe": 0.18, "debt_eq": 70,  "pm": 0.10},
    "Industrials":            {"pe": 18, "pb": 2.8, "roe": 0.14, "debt_eq": 90,  "pm": 0.09},
    "Energy":                 {"pe": 12, "pb": 1.5, "roe": 0.12, "debt_eq": 60,  "pm": 0.08},
    "Utilities":              {"pe": 16, "pb": 1.6, "roe": 0.10, "debt_eq": 150, "pm": 0.12},
    "Real Estate":            {"pe": 30, "pb": 1.8, "roe": 0.08, "debt_eq": 160, "pm": 0.20},
    "Basic Materials":        {"pe": 14, "pb": 1.8, "roe": 0.12, "debt_eq": 70,  "pm": 0.10},
    "Communication Services": {"pe": 20, "pb": 2.5, "roe": 0.14, "debt_eq": 80,  "pm": 0.14},
    "default":                {"pe": 18, "pb": 2.5, "roe": 0.14, "debt_eq": 80,  "pm": 0.10},
}


def _num(val) -> Optional[float]:
    """Convertit une valeur en float, retourne None si impossible ou infini."""
    if val is None:
        return None
    try:
        import math
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f  # rejette NaN et Infinity
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

        data["ebit"]             = _num(info.get("ebit"))
        data["interest_expense"] = _num(info.get("interestExpense"))

        # Ratio de couverture des intérêts = EBIT / intérêts payés
        if data["ebit"] is not None and data["interest_expense"] and data["interest_expense"] != 0:
            data["interest_coverage"] = round(data["ebit"] / abs(data["interest_expense"]), 1)
        else:
            data["interest_coverage"] = None

        # EV/FCF
        if data["enterprise_value"] and data["free_cash_flow"] and data["free_cash_flow"] > 0:
            data["ev_to_fcf"] = round(data["enterprise_value"] / data["free_cash_flow"], 1)
        else:
            data["ev_to_fcf"] = None
    except Exception:
        pass

    return data


def score_valuation(fundamentals: dict) -> dict:
    """Score la valorisation de l'action."""
    scores = []
    details = []

    sector = fundamentals.get("sector") or "default"
    medians = SECTOR_MEDIANS.get(sector, SECTOR_MEDIANS["default"])
    pe_median = medians["pe"]

    pe = _num(fundamentals.get("pe_ratio"))
    if pe is not None and pe > 0:
        # Comparer au P/E médian du secteur
        pe_vs_sector = (pe - pe_median) / pe_median  # négatif = moins cher que le secteur
        if pe_vs_sector < -0.30:
            scores.append(1.0)
            details.append(f"Très bon marché vs son secteur : P/E {pe:.1f} vs médiane {pe_median:.0f}x ({sector})")
        elif pe_vs_sector < -0.10:
            scores.append(0.5)
            details.append(f"Légèrement moins cher que son secteur : P/E {pe:.1f} vs {pe_median:.0f}x")
        elif pe_vs_sector < 0.20:
            scores.append(0.0)
            details.append(f"Valorisation dans la norme sectorielle : P/E {pe:.1f} (médiane {pe_median:.0f}x)")
        elif pe_vs_sector < 0.50:
            scores.append(-0.5)
            details.append(f"Plus cher que la moyenne du secteur : P/E {pe:.1f} vs {pe_median:.0f}x")
        else:
            scores.append(-1.0)
            details.append(f"Très cher vs son secteur : P/E {pe:.1f} vs médiane {pe_median:.0f}x — prime injustifiée ?")

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

    ev_fcf = _num(fundamentals.get("ev_to_fcf"))
    if ev_fcf is not None and ev_fcf > 0:
        if ev_fcf < 15:
            scores.append(0.8)
            details.append(f"Valorisation EV/FCF attractive ({ev_fcf:.1f}x) — peu cher par rapport au cash généré")
        elif ev_fcf < 25:
            scores.append(0.3)
            details.append(f"EV/FCF correct ({ev_fcf:.1f}x)")
        elif ev_fcf < 40:
            scores.append(-0.2)
            details.append(f"EV/FCF élevé ({ev_fcf:.1f}x) — valorisation tendue")
        else:
            scores.append(-0.6)
            details.append(f"EV/FCF très élevé ({ev_fcf:.1f}x) — très cher sur la base du cash")

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

    ic = _num(fundamentals.get("interest_coverage"))
    if ic is not None:
        if ic > 10:
            scores.append(0.7)
            details.append(f"Dettes très bien couvertes : génère {ic:.1f}x ses charges d'intérêts")
        elif ic > 5:
            scores.append(0.3)
            details.append(f"Bonne couverture des intérêts ({ic:.1f}x)")
        elif ic > 2:
            scores.append(-0.1)
            details.append(f"Couverture des intérêts correcte mais à surveiller ({ic:.1f}x)")
        elif ic > 0:
            scores.append(-0.5)
            details.append(f"Couverture des intérêts faible ({ic:.1f}x) — dettes pèsent lourd")
        else:
            scores.append(-0.9)
            details.append(f"L'entreprise ne couvre pas ses charges d'intérêts — risque de défaut")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def compute_red_flags(fundamentals: dict) -> list:
    """Détecte les signaux d'alarme critiques à afficher en priorité."""
    flags = []

    # Dividende non soutenable
    payout = _num(fundamentals.get("payout_ratio"))
    if payout is not None and payout > 1.0:
        flags.append(f"⚠️ Dividende non soutenable : distribue {payout:.0%} de ses bénéfices")

    # FCF négatif + dette élevée = combo dangereux
    fcf = _num(fundamentals.get("free_cash_flow"))
    nd_ebitda = _num(fundamentals.get("net_debt_to_ebitda"))
    if fcf is not None and fcf < 0 and nd_ebitda is not None and nd_ebitda > 3:
        flags.append(f"🚨 Cash négatif + dette lourde ({nd_ebitda:.1f}x EBITDA) — combinaison risquée")

    # Couverture des intérêts très faible
    ic = _num(fundamentals.get("interest_coverage"))
    if ic is not None and ic < 2 and ic > 0:
        flags.append(f"⚠️ Dettes difficilement couvertes (couverture {ic:.1f}x)")
    elif ic is not None and ic <= 0:
        flags.append(f"🚨 Ne couvre pas ses charges d'intérêts — risque financier critique")

    # Pertes nettes
    pm = _num(fundamentals.get("profit_margin"))
    if pm is not None and pm < -0.05:
        flags.append(f"⚠️ Pertes significatives : marge nette de {pm:.1%}")

    # Endettement extrême
    dte = _num(fundamentals.get("debt_to_equity"))
    if dte is not None and dte > 300:
        flags.append(f"🚨 Endettement extrême : dette = {dte:.0f}% des capitaux propres")

    # ROIC négatif
    roic = _num(fundamentals.get("roic"))
    if roic is not None and roic < -0.05:
        flags.append(f"⚠️ Détruit de la valeur : ROIC négatif ({roic:.1%})")

    return flags


def compute_quality_grade(quality_score: float) -> str:
    """Convertit le quality_score [-1, +1] en note lisible."""
    if quality_score >= 0.65:   return "A"
    elif quality_score >= 0.35: return "B"
    elif quality_score >= 0.05: return "C"
    elif quality_score >= -0.2: return "D"
    else:                       return "F"


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

    is_etf = fundamentals.get("is_etf", False)
    red_flags = [] if is_etf else compute_red_flags(fundamentals)
    quality_grade = None if is_etf else compute_quality_grade(overall)

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
        "red_flags": red_flags,
        "quality_grade": quality_grade,
        "fundamentals": fundamentals,
    }
