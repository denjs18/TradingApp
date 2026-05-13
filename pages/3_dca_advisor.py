"""Page Streamlit : Suivi DCA et Conseils."""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

from database.db import init_db
from trading.portfolio import (
    get_all_positions,
    add_position,
    update_position,
    remove_position,
    get_portfolio_summary,
    get_sector_allocation,
    get_portfolio_history,
    save_portfolio_snapshot,
)
from data.market_data import get_historical_data, get_price_change
from data.analyst_data import get_analyst_recommendations, get_analyst_price_targets
from data.news_fetcher import get_news_for_ticker
from analysis.technical import get_technical_summary, compute_indicators
from analysis.fundamental import get_fundamental_summary
from utils.formatters import (
    format_currency,
    format_percentage,
    format_large_number,
    color_value,
    recommendation_emoji,
)

init_db()

# --- Base de donnees des ETF et indices populaires ---
POPULAR_ASSETS = {
    # ETF World / Global
    "CW8.PA": "Amundi MSCI World (CW8)",
    "EWLD.PA": "Lyxor MSCI World (EWLD)",
    "MWRD.PA": "Amundi MSCI World ESG",
    "WLD.PA": "iShares MSCI World",

    # ETF S&P 500
    "500.PA": "Amundi S&P 500 (500)",
    "ESE.PA": "BNP Paribas Easy S&P 500",
    "PSP5.PA": "Lyxor PEA S&P 500",
    "PE500.PA": "Amundi PEA S&P 500 ESG",

    # ETF Nasdaq
    "PUST.PA": "Lyxor PEA Nasdaq-100",
    "PANX.PA": "Amundi PEA Nasdaq-100",
    "UST.PA": "Lyxor Nasdaq-100",

    # ETF Europe
    "ETZ.PA": "BNP Paribas Easy Stoxx 600",
    "MEUD.PA": "Amundi Euro Stoxx 50",
    "C50.PA": "Amundi CAC 40",
    "CAC.PA": "Lyxor CAC 40",
    "PCAE.PA": "Amundi PEA Euro Stoxx 50",

    # ETF Emerging Markets
    "PAEEM.PA": "Amundi PEA Emerging Markets",
    "AEEM.PA": "Amundi MSCI Emerging Markets",
    "EMIM.PA": "iShares Emerging Markets",

    # ETF Sectoriels
    "TNO.PA": "Lyxor MSCI World Technology",
    "TNOW.PA": "Amundi MSCI World IT",
    "PHEA.PA": "Lyxor MSCI World Health Care",
    "AWAT.PA": "Lyxor MSCI Water",
    "ENRJ.PA": "Lyxor MSCI New Energy",
    "CLWD.PA": "Amundi MSCI World Climate",

    # ETF Obligataires
    "OBLI.PA": "Lyxor Euro Government Bond",
    "CORP.PA": "Amundi Euro Corporate Bond",

    # Actions Euronext (du config.py)
    "AIR.PA": "Airbus",
    "SAF.PA": "Safran",
    "TKO.PA": "Thales",
    "HO.PA": "Thales (ancien)",
    "MC.PA": "LVMH",
    "KER.PA": "Kering",
    "RMS.PA": "Hermes",
    "BNP.PA": "BNP Paribas",
    "GLE.PA": "Societe Generale",
    "ACA.PA": "Credit Agricole",
    "TTE.PA": "TotalEnergies",
    "ENGI.PA": "Engie",
    "CAP.PA": "Capgemini",
    "DAS.PA": "Dassault Systemes",
    "STM.PA": "STMicroelectronics",
    "RNO.PA": "Renault",
    "STL.PA": "Stellantis",
    "SAN.PA": "Sanofi",
    "BN.PA": "Danone",
    "ORA.PA": "Orange",
    "SU.PA": "Schneider Electric",
    "SGO.PA": "Saint-Gobain",
    "LR.PA": "Legrand",
    "AM.PA": "Dassault Aviation",

    # Autres ETF populaires
    "DJSC.PA": "Lyxor DJ Industrial Average",
    "RS2K.PA": "Amundi Russell 2000",
    "PAASI.PA": "Amundi PEA Asie hors Japon",
    "PJPN.PA": "Amundi PEA Japon Topix",
    "CJ1.PA": "Amundi Japan Topix",
}

# Creer un index inverse pour la recherche
ASSET_SEARCH_INDEX = {}
for ticker, name in POPULAR_ASSETS.items():
    # Indexer par ticker
    ASSET_SEARCH_INDEX[ticker.lower()] = ticker
    # Indexer par nom (mots cles)
    for word in name.lower().split():
        if len(word) > 2:
            if word not in ASSET_SEARCH_INDEX:
                ASSET_SEARCH_INDEX[word] = []
            if isinstance(ASSET_SEARCH_INDEX[word], list):
                ASSET_SEARCH_INDEX[word].append(ticker)


def search_assets(query: str) -> list:
    """Recherche d'actifs par nom ou ticker."""
    if not query or len(query) < 2:
        return []

    query = query.lower().strip()
    results = set()

    # Recherche exacte par ticker
    for ticker in POPULAR_ASSETS:
        if query in ticker.lower():
            results.add(ticker)

    # Recherche par nom
    for ticker, name in POPULAR_ASSETS.items():
        if query in name.lower():
            results.add(ticker)

    return sorted(results, key=lambda t: POPULAR_ASSETS.get(t, t))

st.set_page_config(page_title="DCA Advisor", page_icon="💼", layout="wide")
st.title("💼 Suivi DCA & Conseils")

# --- Sidebar : Gestion des positions ---
st.sidebar.header("Gestion du Portefeuille")

st.sidebar.subheader("Ajouter / Renforcer")

# --- Recherche d'actifs ---
search_query = st.sidebar.text_input(
    "Rechercher un actif",
    placeholder="Tapez un nom ou ticker (ex: World, CW8, LVMH...)",
    help="Recherchez par nom d'ETF, d'indice ou d'action",
)

# Afficher les resultats de recherche
selected_ticker = None
if search_query and len(search_query) >= 2:
    search_results = search_assets(search_query)
    if search_results:
        # Creer les options avec nom + ticker
        options = [""] + search_results
        option_labels = {
            "": "-- Selectionnez --",
            **{t: f"{POPULAR_ASSETS.get(t, t)} ({t})" for t in search_results}
        }

        selected_ticker = st.sidebar.selectbox(
            f"{len(search_results)} resultat(s)",
            options,
            format_func=lambda x: option_labels.get(x, x),
        )
    else:
        st.sidebar.warning("Aucun resultat. Vous pouvez entrer le ticker manuellement.")

# Option pour ticker manuel
with st.sidebar.expander("Ticker personnalise", expanded=not search_query):
    manual_ticker = st.text_input(
        "Ticker (ex: AAPL, MSFT.US)",
        "",
        help="Entrez le ticker exact si non trouve dans la recherche",
    ).upper().strip()

# Determiner le ticker final
final_ticker = selected_ticker if selected_ticker else manual_ticker

# Afficher l'actif selectionne
if final_ticker:
    asset_name = POPULAR_ASSETS.get(final_ticker, "Actif personnalise")
    st.sidebar.success(f"Selection: **{asset_name}** ({final_ticker})")

# Formulaire d'ajout
with st.sidebar.form("add_position_form"):
    st.markdown(f"**Ticker:** {final_ticker if final_ticker else 'Non selectionne'}")

    shares_input = st.number_input("Nombre d'actions/parts", min_value=0.0, step=0.01)
    price_input = st.number_input("Prix moyen d'achat (EUR)", min_value=0.0, step=0.01)
    submit_add = st.form_submit_button("Ajouter", type="primary", use_container_width=True)

    if submit_add:
        if not final_ticker:
            st.error("Selectionnez ou entrez un ticker.")
        elif shares_input <= 0:
            st.error("Entrez un nombre d'actions > 0.")
        elif price_input <= 0:
            st.error("Entrez un prix > 0.")
        else:
            add_position(final_ticker, shares_input, price_input)
            st.success(f"{final_ticker} ajoute au portefeuille.")
            st.rerun()

# Categories populaires pour decouverte
st.sidebar.markdown("---")
with st.sidebar.expander("ETF populaires par categorie"):
    st.markdown("""
    **World / Global:**
    - CW8.PA - Amundi MSCI World
    - EWLD.PA - Lyxor MSCI World

    **S&P 500:**
    - 500.PA - Amundi S&P 500
    - PE500.PA - Amundi PEA S&P 500

    **Nasdaq:**
    - PUST.PA - Lyxor PEA Nasdaq
    - PANX.PA - Amundi PEA Nasdaq

    **Europe:**
    - C50.PA - Amundi CAC 40
    - ETZ.PA - Stoxx 600

    **Emergents:**
    - PAEEM.PA - Amundi Emerging
    """)

# Option de suppression
positions_list = get_all_positions()
if positions_list:
    st.sidebar.subheader("Supprimer une position")
    ticker_to_remove = st.sidebar.selectbox(
        "Choisir un ticker",
        [""] + [p["ticker"] for p in positions_list],
    )
    if st.sidebar.button("Supprimer") and ticker_to_remove:
        remove_position(ticker_to_remove)
        st.sidebar.success(f"{ticker_to_remove} supprime.")
        st.rerun()

# --- Contenu principal ---
summary = get_portfolio_summary()

if not summary["positions"]:
    st.info(
        "Aucune position dans le portefeuille. "
        "Utilisez le formulaire dans la barre laterale pour ajouter vos positions."
    )
    st.stop()

# --- Vue globale ---
st.header("Vue Globale du Portefeuille")

col1, col2, col3, col4 = st.columns(4)
col1.metric("Investissement Total", format_currency(summary["total_invested"]))
col2.metric("Valeur Actuelle", format_currency(summary["total_current_value"]))
col3.metric(
    "P&L Total",
    format_currency(summary["total_pnl"]),
    delta=format_percentage(summary["total_pnl_pct"]),
)
col4.metric("Positions", len(summary["positions"]))

# Allocation sectorielle
st.subheader("Allocation Sectorielle")
allocation = get_sector_allocation(summary["positions"])
if allocation:
    fig_alloc = px.pie(
        values=list(allocation.values()),
        names=list(allocation.keys()),
        title="Repartition par secteur",
    )
    fig_alloc.update_layout(height=350)
    st.plotly_chart(fig_alloc, use_container_width=True)

# --- Tableau des positions ---
st.header("Detail des Positions")

positions_df = pd.DataFrame(summary["positions"])
display_cols = {
    "ticker": "Ticker",
    "shares": "Actions",
    "avg_price": "PRU (EUR)",
    "current_price": "Cours (EUR)",
    "invested": "Investi (EUR)",
    "current_value": "Valeur (EUR)",
    "pnl": "P&L (EUR)",
    "pnl_pct": "P&L (%)",
}
display_df = positions_df[list(display_cols.keys())].rename(columns=display_cols)

st.dataframe(
    display_df.style.format({
        "PRU (EUR)": "{:.2f}",
        "Cours (EUR)": "{:.2f}",
        "Investi (EUR)": "{:.2f}",
        "Valeur (EUR)": "{:.2f}",
        "P&L (EUR)": "{:+.2f}",
        "P&L (%)": "{:+.2f}%",
    }).map(
        lambda v: f"color: {'green' if v > 0 else 'red' if v < 0 else 'gray'}"
        if isinstance(v, (int, float)) else "",
        subset=["P&L (EUR)", "P&L (%)"],
    ),
    use_container_width=True,
    hide_index=True,
)

# --- Recommandations DCA ---
st.header("Recommandations du Jour")

recommendations = []

for pos in summary["positions"]:
    ticker = pos["ticker"]
    current_price = pos.get("current_price")
    avg_price = pos["avg_price"]

    if current_price is None:
        continue

    # Analyse technique
    hist = get_historical_data(ticker, period="6mo")
    tech_summary = get_technical_summary(hist) if not hist.empty else None

    # Analyse fondamentale
    fund_summary = get_fundamental_summary(ticker)

    # Consensus analystes
    analyst = get_analyst_recommendations(ticker)
    targets = get_analyst_price_targets(ticker)

    # Variations de prix
    changes = get_price_change(ticker)

    # Logique de recommandation
    action = "conserver"
    reasons = []

    # Factor 1 : Prix vs PRU
    if current_price < avg_price * 0.95:
        reasons.append(f"Prix ({current_price:.2f}) sous le PRU ({avg_price:.2f})")

    # Factor 2 : Technique
    tech_score = tech_summary["overall_score"] if tech_summary else 0
    if tech_score > 0.3:
        reasons.append(f"Signal technique favorable ({tech_score:+.2f})")
    elif tech_score < -0.3:
        reasons.append(f"Signal technique defavorable ({tech_score:+.2f})")

    # Factor 3 : Fondamental
    fund_score = fund_summary["overall_score"]
    if fund_score > 0.3:
        reasons.append("Fondamentaux solides")
    elif fund_score < -0.3:
        reasons.append("Fondamentaux deteriores")

    # Factor 4 : Consensus analystes
    if analyst.get("recommendation") in ("buy", "strong_buy"):
        reasons.append(f"Consensus analystes: {analyst['recommendation']}")
    elif analyst.get("recommendation") in ("sell", "strong_sell"):
        reasons.append(f"Consensus analystes: {analyst['recommendation']}")

    # Factor 5 : Objectif de prix
    if targets.get("upside_pct") and targets["upside_pct"] > 15:
        reasons.append(f"Upside potentiel: {targets['upside_pct']:.1f}%")

    # Decision
    bullish_count = sum(1 for r in reasons if any(
        w in r.lower() for w in ["favorable", "solide", "buy", "sous le pru", "upside"]
    ))
    bearish_count = sum(1 for r in reasons if any(
        w in r.lower() for w in ["defavorable", "deteriore", "sell"]
    ))

    if bullish_count >= 2:
        action = "renforcer"
    elif bearish_count >= 2:
        action = "alleger"
    else:
        action = "conserver"

    # Previsions
    trend = tech_summary["trend"] if tech_summary else "neutre"
    short_term = f"Tendance {trend}"
    if tech_score > 0.3:
        short_term += " - momentum positif"
    elif tech_score < -0.3:
        short_term += " - momentum negatif"

    medium_term = "Neutre"
    if fund_score > 0.3 and analyst.get("recommendation") in ("buy", "strong_buy"):
        medium_term = "Favorable - fondamentaux et consensus positifs"
    elif fund_score < -0.3:
        medium_term = "Defavorable - fondamentaux en baisse"

    long_term = "Neutre"
    if targets.get("upside_pct"):
        if targets["upside_pct"] > 20:
            long_term = f"Favorable - objectif moyen +{targets['upside_pct']:.0f}%"
        elif targets["upside_pct"] < -10:
            long_term = f"Defavorable - objectif moyen {targets['upside_pct']:.0f}%"

    recommendations.append({
        "ticker": ticker,
        "action": action,
        "reasons": reasons,
        "tech_score": tech_score,
        "fund_score": fund_score,
        "short_term": short_term,
        "medium_term": medium_term,
        "long_term": long_term,
        "current_price": current_price,
        "target_mean": targets.get("target_mean"),
        "changes": changes,
    })

# Afficher les recommandations triees
recommendations.sort(
    key=lambda r: (
        {"renforcer": 0, "conserver": 1, "alleger": 2}[r["action"]],
        -r["tech_score"],
    )
)

for rec in recommendations:
    emoji = recommendation_emoji(rec["action"])
    with st.expander(
        f"{emoji} {rec['ticker']} — {rec['action'].upper()} "
        f"(cours: {rec['current_price']:.2f} EUR)",
        expanded=(rec["action"] == "renforcer"),
    ):
        # Metriques principales
        mcol1, mcol2, mcol3, mcol4 = st.columns(4)
        mcol1.metric("Score Technique", f"{rec['tech_score']:+.2f}")
        mcol2.metric("Score Fondamental", f"{rec['fund_score']:+.2f}")

        if rec.get("target_mean"):
            mcol3.metric("Objectif Moyen", f"{rec['target_mean']:.2f} EUR")

        changes = rec["changes"]
        if changes.get("week") is not None:
            mcol4.metric("Var. Semaine", format_percentage(changes["week"]))

        # Raisons
        if rec["reasons"]:
            st.markdown("**Raisons :**")
            for reason in rec["reasons"]:
                st.markdown(f"- {reason}")

        # Previsions
        st.markdown("**Previsions :**")
        pcol1, pcol2, pcol3 = st.columns(3)
        pcol1.info(f"**Court terme (1-4 sem.)** : {rec['short_term']}")
        pcol2.info(f"**Moyen terme (1-6 mois)** : {rec['medium_term']}")
        pcol3.info(f"**Long terme (6-12 mois)** : {rec['long_term']}")

        # Graphique
        hist = get_historical_data(rec["ticker"], period="6mo")
        if not hist.empty:
            hist = compute_indicators(hist)
            fig = go.Figure()
            fig.add_trace(go.Candlestick(
                x=hist.index,
                open=hist["Open"],
                high=hist["High"],
                low=hist["Low"],
                close=hist["Close"],
                name="Prix",
            ))
            if "SMA_20" in hist.columns:
                fig.add_trace(go.Scatter(
                    x=hist.index, y=hist["SMA_20"],
                    mode="lines", name="SMA 20",
                    line=dict(width=1),
                ))
            if "SMA_50" in hist.columns:
                fig.add_trace(go.Scatter(
                    x=hist.index, y=hist["SMA_50"],
                    mode="lines", name="SMA 50",
                    line=dict(width=1),
                ))
            fig.update_layout(
                title=f"{rec['ticker']} - 6 mois",
                height=400,
                xaxis_rangeslider_visible=False,
            )
            st.plotly_chart(fig, use_container_width=True)

        # Actualites
        news = get_news_for_ticker(rec["ticker"])
        if news:
            st.markdown("**Actualites recentes :**")
            for item in news[:5]:
                date_str = ""
                if item.get("published"):
                    date_str = item["published"].strftime("%d/%m %H:%M") + " - "
                st.markdown(
                    f"- {date_str}[{item['title']}]({item['link']}) "
                    f"*({item['source']})*"
                )

# --- Historique de performance ---
st.header("Evolution de la Valeur du Portefeuille")

# Sauvegarder un snapshot
save_portfolio_snapshot()

history = get_portfolio_history()
if len(history) > 1:
    hist_df = pd.DataFrame(history)
    hist_df["snapshot_at"] = pd.to_datetime(hist_df["snapshot_at"])
    fig_perf = px.line(
        hist_df,
        x="snapshot_at",
        y="total_value",
        title="Valeur du portefeuille dans le temps",
        labels={"snapshot_at": "Date", "total_value": "Valeur (EUR)"},
    )
    fig_perf.update_layout(height=400)
    st.plotly_chart(fig_perf, use_container_width=True)
else:
    st.info("L'historique sera disponible apres plusieurs visites de cette page.")

st.markdown("---")
st.caption(
    "Les recommandations sont generees automatiquement et ne constituent "
    "pas un conseil en investissement."
)
