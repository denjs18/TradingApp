"""Analyse fondamentale : valorisation, rentabilité, croissance, santé financière."""

import yfinance as yf
from typing import Optional


def _num(val) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def get_fundamental_data(ticker: str) -> dict:
    stock = yf.Ticker(ticker)
    data = {
        "pe_ratio": None, "forward_pe": None, "peg_ratio": None,
        "price_to_book": None, "dividend_yield": None, "dividend_rate": None,
        "payout_ratio": None, "revenue_growth": None, "earnings_growth": None,
        "profit_margin": None, "operating_margin": None, "gross_margin": None,
        "debt_to_equity": None, "current_ratio": None,
        "return_on_equity": None, "return_on_assets": None,
        "market_cap": None, "enterprise_value": None, "ev_to_ebitda": None,
        "free_cash_flow": None, "beta": None,
        "sector": None, "industry": None, "name": None,
    }

    try:
        info = stock.info
        data["pe_ratio"]          = _num(info.get("trailingPE"))
        data["forward_pe"]        = _num(info.get("forwardPE"))
        data["peg_ratio"]         = _num(info.get("pegRatio"))
        data["price_to_book"]     = _num(info.get("priceToBook"))
        data["dividend_yield"]    = _num(info.get("dividendYield"))
        data["dividend_rate"]     = _num(info.get("dividendRate"))
        data["payout_ratio"]      = _num(info.get("payoutRatio"))
        data["revenue_growth"]    = _num(info.get("revenueGrowth"))
        data["earnings_growth"]   = _num(info.get("earningsGrowth"))
        data["profit_margin"]     = _num(info.get("profitMargins"))
        data["operating_margin"]  = _num(info.get("operatingMargins"))
        data["gross_margin"]      = _num(info.get("grossMargins"))
        data["debt_to_equity"]    = _num(info.get("debtToEquity"))
        data["current_ratio"]     = _num(info.get("currentRatio"))
        data["return_on_equity"]  = _num(info.get("returnOnEquity"))
        data["return_on_assets"]  = _num(info.get("returnOnAssets"))
        data["market_cap"]        = _num(info.get("marketCap"))
        data["enterprise_value"]  = _num(info.get("enterpriseValue"))
        data["ev_to_ebitda"]      = _num(info.get("enterpriseToEbitda"))
        data["free_cash_flow"]    = _num(info.get("freeCashflow"))
        data["beta"]              = _num(info.get("beta"))
        data["sector"]            = info.get("sector")
        data["industry"]          = info.get("industry")
        data["name"]              = info.get("longName") or info.get("shortName")

        # Position dans la range 52 semaines
        w52_high = _num(info.get("fiftyTwoWeekHigh"))
        w52_low  = _num(info.get("fiftyTwoWeekLow"))
        current  = _num(info.get("currentPrice") or info.get("regularMarketPrice"))
        data["week52_high"] = w52_high
        data["week52_low"]  = w52_low
        if w52_high and w52_low and w52_high > w52_low and current:
            data["position_52w"]      = round((current - w52_low) / (w52_high - w52_low) * 100, 1)
            data["pct_from_52w_high"] = round((current - w52_high) / w52_high * 100, 1)
            data["pct_from_52w_low"]  = round((current - w52_low) / w52_low * 100, 1)
        else:
            data["position_52w"] = data["pct_from_52w_high"] = data["pct_from_52w_low"] = None

        # Rendement dividende historique (5 ans) pour comparaison
        data["five_year_avg_dividend_yield"]    = _num(info.get("fiveYearAvgDividendYield"))
        data["trailing_annual_dividend_yield"]  = _num(info.get("trailingAnnualDividendYield"))

    except Exception:
        pass

    return data


def score_valuation(fundamentals: dict) -> dict:
    """
    Score la valorisation : est-ce que l'action est chère ou bon marché ?
    Prend en compte : prix/bénéfices, croissance vs prix, valeur comptable,
    dividende vs historique, flux de trésorerie, position 52 semaines.
    """
    scores = []
    details = []

    # ── Prix par rapport aux bénéfices (P/E) ──────────────────────────────
    # Le P/E dit combien d'euros tu paies pour 1 € de bénéfice annuel.
    # Un P/E de 15 = tu paies 15 fois les bénéfices annuels.
    pe = _num(fundamentals.get("pe_ratio"))
    if pe is not None and pe > 0:
        if pe < 10:
            scores.append(1.0)
            details.append(f"Très bon marché : tu paies seulement {pe:.1f}x les bénéfices annuels")
        elif pe < 15:
            scores.append(0.5)
            details.append(f"Prix raisonnable : {pe:.1f}x les bénéfices (dans la moyenne historique)")
        elif pe < 25:
            scores.append(0.0)
            details.append(f"Prix correct mais pas en solde : {pe:.1f}x les bénéfices")
        elif pe < 40:
            scores.append(-0.5)
            details.append(f"Action chère : {pe:.1f}x les bénéfices — la croissance doit justifier ce prix")
        else:
            scores.append(-1.0)
            details.append(f"Action très chère : {pe:.1f}x les bénéfices — risque élevé si croissance déçoit")

    # ── Croissance vs prix payé (PEG) ──────────────────────────────────────
    # Le PEG corrige le P/E par la croissance attendue.
    # PEG < 1 = tu pagues moins que ce que la croissance justifie = bonne affaire.
    peg = _num(fundamentals.get("peg_ratio"))
    if peg is not None and peg > 0:
        if peg < 1:
            scores.append(0.8)
            details.append(f"Croissance sous-payée (PEG {peg:.2f}) — la croissance vaut plus que son prix")
        elif peg < 1.5:
            scores.append(0.3)
            details.append(f"Croissance correctement valorisée (PEG {peg:.2f})")
        elif peg < 2:
            scores.append(0.0)
            details.append(f"Croissance un peu chère (PEG {peg:.2f})")
        else:
            scores.append(-0.5)
            details.append(f"Croissance survalorisée (PEG {peg:.2f}) — attention")

    # ── Prix vs valeur comptable (P/B) ─────────────────────────────────────
    # Le P/B compare le prix de l'action à ce que vaut l'entreprise sur le papier.
    # P/B < 1 = tu achètes l'entreprise moins cher que sa valeur comptable.
    ptb = _num(fundamentals.get("price_to_book"))
    if ptb is not None and ptb > 0:
        if ptb < 1:
            scores.append(0.7)
            details.append(f"Sous sa valeur comptable (P/B {ptb:.2f}) — décote intéressante")
        elif ptb < 3:
            scores.append(0.2)
            details.append(f"Valorisation comptable raisonnable (P/B {ptb:.2f})")
        else:
            scores.append(-0.3)
            details.append(f"Prime élevée sur la valeur comptable (P/B {ptb:.2f})")

    # ── Rendement dividende vs sa propre moyenne 5 ans ────────────────────
    # Si le dividende rapporte plus qu'habituellement, c'est souvent signe
    # que l'action a baissé par rapport à sa valeur normale = opportunité.
    div_yield = _num(fundamentals.get("dividend_yield"))
    div_5y    = _num(fundamentals.get("five_year_avg_dividend_yield"))
    if div_yield and div_5y and div_5y > 0:
        premium_pct = (div_yield - div_5y) / div_5y * 100
        if premium_pct >= 25:
            scores.append(0.7)
            details.append(
                f"Dividende historiquement élevé ({div_yield:.1%} vs moyenne 5 ans {div_5y:.1%}) "
                f"— l'action est moins chère qu'habituellement"
            )
        elif premium_pct >= 10:
            scores.append(0.3)
            details.append(
                f"Dividende légèrement au-dessus de sa moyenne ({div_yield:.1%} vs {div_5y:.1%} en moyenne)"
            )
        elif premium_pct <= -20:
            scores.append(-0.3)
            details.append(
                f"Dividende en dessous de sa moyenne historique ({div_yield:.1%} vs {div_5y:.1%}) "
                f"— l'action est relativement chère"
            )

    # ── Rendement en flux de trésorerie libre (FCF Yield) ─────────────────
    # Le FCF Yield = argent réellement généré / prix de l'entreprise.
    # C'est plus fiable que le bénéfice comptable car difficile à manipuler.
    # > 6% = l'entreprise génère beaucoup de cash pour son prix.
    fcf  = _num(fundamentals.get("free_cash_flow"))
    mcap = _num(fundamentals.get("market_cap"))
    if fcf and mcap and mcap > 0:
        fcf_yield = fcf / mcap * 100
        if fcf_yield >= 8:
            scores.append(0.8)
            details.append(f"Excellent rendement en flux de trésorerie libre ({fcf_yield:.1f}%) — génère beaucoup de cash")
        elif fcf_yield >= 5:
            scores.append(0.4)
            details.append(f"Bon rendement en flux de trésorerie libre ({fcf_yield:.1f}%)")
        elif fcf_yield >= 2:
            scores.append(0.0)
            details.append(f"Rendement en flux de trésorerie correct ({fcf_yield:.1f}%)")
        elif fcf_yield < 0:
            scores.append(-0.5)
            details.append(f"Flux de trésorerie négatif — l'entreprise brûle plus de cash qu'elle n'en génère")

    # ── Position dans la range 52 semaines ────────────────────────────────
    # Indique où se situe le cours actuel entre son plus bas et son plus haut
    # de l'année. Proche du bas = potentiellement une bonne zone d'entrée.
    pos_52w = fundamentals.get("position_52w")
    pct_high = fundamentals.get("pct_from_52w_high")
    if pos_52w is not None:
        if pos_52w <= 20:
            scores.append(0.6)
            details.append(
                f"Cours près de son plus bas annuel ({abs(pct_high):.0f}% sous le plus haut) "
                f"— potentiellement une bonne zone d'accumulation"
            )
        elif pos_52w <= 40:
            scores.append(0.2)
            details.append(f"Cours dans le bas de sa range annuelle — prix raisonnable")
        elif pos_52w >= 85:
            scores.append(-0.4)
            details.append(
                f"Cours proche de son plus haut annuel — peu de marge de sécurité"
            )
        elif pos_52w >= 70:
            scores.append(-0.1)
            details.append(f"Cours dans le haut de sa range annuelle — vigilance sur le prix d'entrée")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_profitability(fundamentals: dict) -> dict:
    """
    Score la rentabilité : l'entreprise gagne-t-elle bien sa vie ?
    Prend en compte : marge nette, rentabilité des capitaux propres (ROE),
    rentabilité des actifs (ROA).
    """
    scores = []
    details = []

    # ── Marge nette ────────────────────────────────────────────────────────
    # La marge nette = ce que l'entreprise garde sur 100 € de chiffre d'affaires.
    # Marge de 20% = elle garde 20€ net pour chaque 100€ vendus.
    pm = _num(fundamentals.get("profit_margin"))
    if pm is not None:
        if pm > 0.20:
            scores.append(1.0)
            details.append(f"Très rentable : garde {pm:.1%} de son CA en bénéfice net — excellent")
        elif pm > 0.10:
            scores.append(0.5)
            details.append(f"Bonne rentabilité : {pm:.1%} de marge nette")
        elif pm > 0.05:
            scores.append(0.0)
            details.append(f"Marge nette correcte ({pm:.1%}) — pas de quoi s'emballer")
        elif pm > 0:
            scores.append(-0.3)
            details.append(f"Marge nette faible ({pm:.1%}) — peu de coussin en cas de choc")
        else:
            scores.append(-1.0)
            details.append(f"Pertes nettes ({pm:.1%}) — l'entreprise perd de l'argent")

    # ── Rentabilité des capitaux propres (ROE) ─────────────────────────────
    # Le ROE = combien l'entreprise gagne avec l'argent des actionnaires.
    # ROE de 20% = elle génère 20€ de bénéfice pour 100€ d'argent investi.
    roe = _num(fundamentals.get("return_on_equity"))
    if roe is not None:
        if roe > 0.20:
            scores.append(0.8)
            details.append(f"Excellente rentabilité des capitaux : {roe:.1%} — crée beaucoup de valeur")
        elif roe > 0.10:
            scores.append(0.4)
            details.append(f"Bonne rentabilité des capitaux : {roe:.1%}")
        elif roe > 0:
            scores.append(0.0)
            details.append(f"Rentabilité des capitaux faible : {roe:.1%}")
        else:
            scores.append(-0.7)
            details.append(f"Rentabilité des capitaux négative : {roe:.1%} — signal d'alarme")

    # ── Rentabilité des actifs (ROA) ────────────────────────────────────────
    # Le ROA = combien l'entreprise gagne sur l'ensemble de ses actifs.
    roa = _num(fundamentals.get("return_on_assets"))
    if roa is not None:
        if roa > 0.10:
            scores.append(0.5)
            details.append(f"Très bonne utilisation de ses actifs ({roa:.1%})")
        elif roa > 0.05:
            scores.append(0.2)
            details.append(f"Utilisation correcte de ses actifs ({roa:.1%})")
        elif roa <= 0:
            scores.append(-0.4)
            details.append(f"Mauvaise utilisation de ses actifs ({roa:.1%})")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_growth(fundamentals: dict) -> dict:
    """
    Score la croissance : l'entreprise se développe-t-elle ?
    Prend en compte : croissance du chiffre d'affaires et des bénéfices.
    """
    scores = []
    details = []

    # ── Croissance du chiffre d'affaires ───────────────────────────────────
    # La croissance du CA montre si l'entreprise vend de plus en plus.
    # +10% = elle vend 10% de plus que l'année passée.
    rg = _num(fundamentals.get("revenue_growth"))
    if rg is not None:
        if rg > 0.20:
            scores.append(1.0)
            details.append(f"Forte croissance des ventes : +{rg:.1%} — en pleine expansion")
        elif rg > 0.10:
            scores.append(0.6)
            details.append(f"Bonne croissance des ventes : +{rg:.1%}")
        elif rg > 0:
            scores.append(0.2)
            details.append(f"Croissance des ventes modeste : +{rg:.1%}")
        else:
            scores.append(-0.5)
            details.append(f"Ventes en baisse : {rg:.1%} — à surveiller")

    # ── Croissance des bénéfices ────────────────────────────────────────────
    # La croissance des bénéfices est encore plus importante que celle des ventes :
    # une entreprise peut vendre plus tout en gagnant moins si ses coûts explosent.
    eg = _num(fundamentals.get("earnings_growth"))
    if eg is not None:
        if eg > 0.20:
            scores.append(1.0)
            details.append(f"Forte croissance des bénéfices : +{eg:.1%} — très porteur")
        elif eg > 0.10:
            scores.append(0.5)
            details.append(f"Bonne croissance des bénéfices : +{eg:.1%}")
        elif eg > 0:
            scores.append(0.1)
            details.append(f"Bénéfices en légère progression : +{eg:.1%}")
        else:
            scores.append(-0.6)
            details.append(f"Bénéfices en baisse : {eg:.1%} — signal négatif pour le long terme")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_financial_health(fundamentals: dict) -> dict:
    """
    Score la santé financière : l'entreprise est-elle solide ?
    Prend en compte : niveau d'endettement et capacité à faire face aux dettes.
    """
    scores = []
    details = []

    # ── Niveau d'endettement (Dette / Capitaux propres) ───────────────────
    # Ce ratio compare les dettes de l'entreprise à l'argent des actionnaires.
    # Un ratio faible = peu de dettes = plus résistante aux crises.
    # Attention : les banques et assurances ont naturellement beaucoup de dettes,
    # c'est normal dans leur secteur.
    dte = _num(fundamentals.get("debt_to_equity"))
    if dte is not None:
        if dte < 30:
            scores.append(0.8)
            details.append(f"Très peu de dettes (ratio {dte:.0f}%) — bilan solide, résiste bien aux crises")
        elif dte < 80:
            scores.append(0.3)
            details.append(f"Endettement raisonnable (ratio {dte:.0f}%)")
        elif dte < 150:
            scores.append(-0.2)
            details.append(f"Endettement élevé (ratio {dte:.0f}%) — vulnérable si les taux montent")
        else:
            scores.append(-0.8)
            details.append(f"Endettement très élevé (ratio {dte:.0f}%) — risque financier important")

    # ── Ratio de liquidité courante ─────────────────────────────────────────
    # Ce ratio dit si l'entreprise peut payer ses dettes à court terme.
    # > 1.5 = elle a largement de quoi faire face, > 1 = juste suffisant.
    cr = _num(fundamentals.get("current_ratio"))
    if cr is not None:
        if cr > 2:
            scores.append(0.6)
            details.append(f"Très bonne trésorerie court terme (ratio {cr:.2f}) — aucun souci de liquidité")
        elif cr > 1.2:
            scores.append(0.2)
            details.append(f"Trésorerie court terme correcte (ratio {cr:.2f})")
        elif cr > 1:
            scores.append(-0.1)
            details.append(f"Trésorerie court terme juste (ratio {cr:.2f}) — à surveiller")
        else:
            scores.append(-0.6)
            details.append(f"Trésorerie insuffisante (ratio {cr:.2f}) — risque de difficultés à court terme")

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def score_dca_opportunity(fundamentals: dict) -> dict:
    """
    Score opportunité DCA : bonne entreprise + cours en baisse = jackpot pour le DCA.

    C'est l'indicateur le plus spécifique au DCA long terme :
    une boîte de qualité qui a baissé sans raison fondamentale est une opportunité
    bien meilleure qu'une boîte médiocre qui monte.

    L'idée : si les fondamentaux sont solides (l'entreprise gagne bien sa vie,
    peu de dettes) MAIS que le cours a baissé récemment → signal DCA fort.
    """
    scores = []
    details = []

    # Mesurer la qualité intrinsèque de l'entreprise
    roe = _num(fundamentals.get("return_on_equity"))
    pm  = _num(fundamentals.get("profit_margin"))
    dte = _num(fundamentals.get("debt_to_equity"))
    fcf = _num(fundamentals.get("free_cash_flow"))
    mcap= _num(fundamentals.get("market_cap"))

    quality_points = 0
    if roe is not None and roe > 0.12:  quality_points += 1
    if pm  is not None and pm  > 0.08:  quality_points += 1
    if dte is not None and dte < 100:   quality_points += 1
    if fcf is not None and fcf > 0:     quality_points += 1

    pos_52w  = fundamentals.get("position_52w")
    pct_high = fundamentals.get("pct_from_52w_high")

    # Bonne entreprise (3+ critères) + cours en baisse = opportunité DCA
    if quality_points >= 3 and pos_52w is not None:
        if pos_52w <= 25:
            scores.append(0.9)
            details.append(
                f"Opportunité DCA forte : entreprise de qualité ({quality_points}/4 critères) "
                f"dont le cours a baissé de {abs(pct_high):.0f}% depuis son plus haut annuel "
                f"sans dégradation des fondamentaux — excellente zone d'accumulation"
            )
        elif pos_52w <= 45:
            scores.append(0.5)
            details.append(
                f"Bonne opportunité DCA : entreprise solide en repli "
                f"({abs(pct_high):.0f}% sous son plus haut) — zone d'achat intéressante"
            )
        elif pos_52w >= 80:
            scores.append(-0.2)
            details.append(
                f"Entreprise de qualité mais cours près de son plus haut annuel "
                f"— attendre un meilleur point d'entrée pour le DCA"
            )
    elif quality_points <= 1 and pos_52w is not None and pos_52w <= 30:
        # Entreprise faible qui a baissé = piège à valeur, pas une opportunité
        scores.append(-0.3)
        details.append(
            f"Attention : le cours a beaucoup baissé ({abs(pct_high):.0f}% sous le plus haut) "
            f"mais les fondamentaux sont insuffisants — risque de piège à valeur"
        )

    overall = sum(scores) / len(scores) if scores else 0.0
    return {"score": overall, "details": details}


def get_fundamental_summary(ticker: str) -> dict:
    fundamentals = get_fundamental_data(ticker)

    valuation    = score_valuation(fundamentals)
    profitability= score_profitability(fundamentals)
    growth       = score_growth(fundamentals)
    health       = score_financial_health(fundamentals)
    dca_opp      = score_dca_opportunity(fundamentals)

    # Pondérations adaptées au DCA long terme :
    # - La valorisation (est-ce bon marché ?) est primordiale
    # - La qualité (rentabilité + santé) compte beaucoup
    # - La croissance compte mais moins que la qualité pour un DCA
    # - L'opportunité DCA spécifique a un bonus distinct
    weights = {
        "valuation":     0.28,
        "profitability": 0.23,
        "growth":        0.20,
        "health":        0.17,
        "dca_opportunity": 0.12,
    }
    sub_scores = {
        "valuation":      valuation["score"],
        "profitability":  profitability["score"],
        "growth":         growth["score"],
        "health":         health["score"],
        "dca_opportunity": dca_opp["score"],
    }
    overall = sum(sub_scores[k] * weights[k] for k in weights)

    dividend_info = None
    if fundamentals.get("dividend_yield") is not None:
        dividend_info = {
            "yield":           fundamentals["dividend_yield"],
            "rate":            fundamentals.get("dividend_rate"),
            "payout_ratio":    fundamentals.get("payout_ratio"),
            "five_year_avg":   fundamentals.get("five_year_avg_dividend_yield"),
        }

    return {
        "name":          fundamentals.get("name"),
        "sector":        fundamentals.get("sector"),
        "industry":      fundamentals.get("industry"),
        "market_cap":    fundamentals.get("market_cap"),
        "beta":          fundamentals.get("beta"),
        "valuation":     valuation,
        "profitability": profitability,
        "growth":        growth,
        "health":        health,
        "dca_opportunity": dca_opp,
        "dividend":      dividend_info,
        "overall_score": overall,
        "fundamentals":  fundamentals,
        "raw_data":      fundamentals,
    }
