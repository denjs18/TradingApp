"""Page Streamlit : Analyse d'Opportunites par Secteur."""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from database.db import init_db, get_db
from analysis.strategy import compute_opportunity_score
from analysis.technical import compute_indicators
from data.market_data import get_historical_data
from data.news_fetcher import get_news_for_ticker
from config import SECTORS, ALL_TICKERS, DEFAULT_FAVORITES, OPPORTUNITY_HIGH_SCORE
from utils.formatters import (
    format_currency,
    format_percentage,
    recommendation_emoji,
    score_to_stars,
)

init_db()

st.set_page_config(page_title="Opportunites", page_icon="🔍", layout="wide")
st.title("🔍 Analyse d'Opportunites")

# --- Sidebar : Configuration ---
st.sidebar.header("Configuration")

# Selection des secteurs
selected_sectors = st.sidebar.multiselect(
    "Secteurs a analyser",
    list(SECTORS.keys()),
    default=["Defense", "Aeronautique", "Technologie"],
)

# Profil de risque
risk_profile = st.sidebar.radio(
    "Profil de risque",
    ["Conservateur", "Modere", "Agressif"],
    index=1,
)

# Tickers supplementaires
extra_tickers = st.sidebar.text_input(
    "Tickers supplementaires (separes par des virgules)",
    "",
)

# Filtres d'affichage
min_score = st.sidebar.slider("Score minimum", -10.0, 10.0, 0.0, 0.5)
show_details = st.sidebar.checkbox("Afficher les details", value=True)

# Construire la liste de tickers
tickers_to_analyze = set()
for sector in selected_sectors:
    tickers_to_analyze.update(SECTORS.get(sector, []))

if extra_tickers:
    for t in extra_tickers.split(","):
        t = t.strip().upper()
        if t:
            tickers_to_analyze.add(t)

tickers_list = sorted(tickers_to_analyze)

# --- Lancer l'analyse ---
if st.sidebar.button("Lancer l'analyse", type="primary") or "opportunities" in st.session_state:
    if not tickers_list:
        st.warning("Selectionnez au moins un secteur ou ajoutez des tickers.")
        st.stop()

    # Progress bar
    progress_bar = st.progress(0, text="Analyse en cours...")
    results = []

    for i, ticker in enumerate(tickers_list):
        progress_bar.progress(
            (i + 1) / len(tickers_list),
            text=f"Analyse de {ticker}...",
        )
        try:
            opp = compute_opportunity_score(ticker)
            results.append(opp)
        except Exception as e:
            st.warning(f"Erreur pour {ticker}: {e}")

    progress_bar.empty()

    # Stocker en session
    st.session_state["opportunities"] = results

    # Sauvegarder en base
    with get_db() as conn:
        for opp in results:
            conn.execute(
                """INSERT INTO opportunity_scores
                   (ticker, score, technical_score, fundamental_score,
                    sentiment_score, recommendation, entry_price,
                    target_price, stop_price, justification)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    opp["ticker"], opp["score"], opp["technical_score"],
                    opp["fundamental_score"], opp["sentiment_score"],
                    opp["recommendation"], opp.get("entry_price"),
                    opp.get("target_price"), opp.get("stop_price"),
                    opp["justification"],
                ),
            )

if "opportunities" not in st.session_state:
    st.info("Cliquez sur 'Lancer l'analyse' dans la barre laterale pour commencer.")
    st.stop()

results = st.session_state["opportunities"]

# Filtrer par score minimum
filtered = [r for r in results if r["score"] >= min_score]
filtered.sort(key=lambda x: x["score"], reverse=True)

# --- Alertes pour scores eleves ---
high_score = [r for r in filtered if r["score"] >= OPPORTUNITY_HIGH_SCORE]
if high_score:
    for opp in high_score:
        st.success(
            f"🚨 **Opportunite forte** : {opp['ticker']} ({opp.get('name', '')}) "
            f"— Score: {opp['score']}/10 — {opp['recommendation'].upper()}"
        )

# --- Tableau recapitulatif ---
st.header("Tableau des Opportunites")

if not filtered:
    st.info("Aucune opportunite ne correspond aux criteres.")
    st.stop()

table_data = []
for opp in filtered:
    table_data.append({
        "Ticker": opp["ticker"],
        "Nom": opp.get("name", ""),
        "Secteur": opp.get("sector", ""),
        "Score": opp["score"],
        "Reco.": f"{recommendation_emoji(opp['recommendation'])} {opp['recommendation'].upper()}",
        "Cours": opp.get("current_price"),
        "Objectif": opp.get("target_price"),
        "Gain Pot.": opp.get("gain_pct"),
        "Risque": opp.get("risk_pct"),
        "Tendance": opp.get("trend", ""),
        "Tech": opp["technical_score"],
        "Fonda": opp["fundamental_score"],
        "Sentiment": opp["sentiment_score"],
    })

df_table = pd.DataFrame(table_data)

# Formateur personnalise pour gerer les valeurs None
def safe_format(fmt):
    def formatter(x):
        if x is None or (isinstance(x, float) and pd.isna(x)):
            return "-"
        return fmt.format(x)
    return formatter

st.dataframe(
    df_table.style.format({
        "Score": safe_format("{:.1f}"),
        "Cours": safe_format("{:.2f}"),
        "Objectif": safe_format("{:.2f}"),
        "Gain Pot.": safe_format("{:+.1f}%"),
        "Risque": safe_format("{:.1f}%"),
        "Tech": safe_format("{:+.2f}"),
        "Fonda": safe_format("{:+.2f}"),
        "Sentiment": safe_format("{:+.2f}"),
    }).background_gradient(
        subset=["Score"], cmap="RdYlGn", vmin=-10, vmax=10,
    ),
    use_container_width=True,
    hide_index=True,
)

# --- Graphique des scores ---
st.subheader("Comparaison des Scores")

fig_scores = go.Figure()
tickers_names = [f"{o['ticker']}" for o in filtered]

fig_scores.add_trace(go.Bar(
    name="Technique",
    x=tickers_names,
    y=[o["technical_score"] for o in filtered],
    marker_color="royalblue",
))
fig_scores.add_trace(go.Bar(
    name="Fondamental",
    x=tickers_names,
    y=[o["fundamental_score"] for o in filtered],
    marker_color="green",
))
fig_scores.add_trace(go.Bar(
    name="Sentiment",
    x=tickers_names,
    y=[o["sentiment_score"] for o in filtered],
    marker_color="orange",
))
fig_scores.add_trace(go.Bar(
    name="Analystes",
    x=tickers_names,
    y=[o["analyst_score"] for o in filtered],
    marker_color="purple",
))

fig_scores.update_layout(
    barmode="group",
    title="Decomposition des scores par facteur",
    yaxis_title="Score",
    height=450,
)
st.plotly_chart(fig_scores, use_container_width=True)

# --- Detail par entreprise ---
if show_details:
    st.header("Detail par Entreprise")

    for opp in filtered:
        emoji = recommendation_emoji(opp["recommendation"])
        with st.expander(
            f"{emoji} {opp['ticker']} — {opp.get('name', '')} "
            f"— Score: {opp['score']}/10 — {opp['recommendation'].upper()}",
            expanded=(opp["score"] >= OPPORTUNITY_HIGH_SCORE),
        ):
            # Metriques
            col1, col2, col3, col4, col5 = st.columns(5)
            col1.metric("Score Global", f"{opp['score']}/10")
            col2.metric(
                "Cours Actuel",
                format_currency(opp.get("current_price")),
            )
            col3.metric(
                "Objectif",
                format_currency(opp.get("target_price")),
            )
            if opp.get("gain_pct") is not None:
                col4.metric(
                    "Gain Potentiel",
                    format_percentage(opp["gain_pct"]),
                )
            if opp.get("risk_pct") is not None:
                col5.metric(
                    "Risque (stop)",
                    format_percentage(opp["risk_pct"]),
                )

            # Scores detailles
            st.markdown("**Scores detailles :**")
            scol1, scol2, scol3, scol4 = st.columns(4)
            scol1.metric("Technique", f"{opp['technical_score']:+.2f}")
            scol2.metric("Fondamental", f"{opp['fundamental_score']:+.2f}")
            scol3.metric("Sentiment", f"{opp['sentiment_score']:+.2f}")
            scol4.metric("Analystes", f"{opp['analyst_score']:+.2f}")

            # Justification
            st.markdown(f"**Justification :** {opp['justification']}")

            # Graphique technique
            hist = get_historical_data(opp["ticker"], period="6mo")
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
                        line=dict(width=1, color="orange"),
                    ))
                if "SMA_50" in hist.columns:
                    fig.add_trace(go.Scatter(
                        x=hist.index, y=hist["SMA_50"],
                        mode="lines", name="SMA 50",
                        line=dict(width=1, color="blue"),
                    ))

                # Niveaux cles
                details = opp.get("details", {})
                tech_details = details.get("technical", {})
                sr = tech_details.get("support_resistance", {})

                for sup in sr.get("supports", []):
                    fig.add_hline(
                        y=sup, line_dash="dash", line_color="green",
                        annotation_text=f"Support {sup:.2f}",
                    )
                for res in sr.get("resistances", []):
                    fig.add_hline(
                        y=res, line_dash="dash", line_color="red",
                        annotation_text=f"Resistance {res:.2f}",
                    )

                fig.update_layout(
                    title=f"{opp['ticker']} - Graphique 6 mois",
                    height=400,
                    xaxis_rangeslider_visible=False,
                )
                st.plotly_chart(fig, use_container_width=True)

            # News
            news = get_news_for_ticker(opp["ticker"])
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

st.markdown("---")
st.caption(
    "Les scores et recommandations sont generes automatiquement et ne constituent "
    "pas un conseil en investissement."
)
