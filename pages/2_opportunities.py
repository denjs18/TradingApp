"""Page Streamlit : Analyse d'Opportunités par Secteur."""

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
from utils.ui_theme import (
    inject_css,
    apply_chart_theme,
    candlestick_trace,
    sma_trace,
    page_header,
    section_title,
    GOLD,
    GOLD_LIGHT,
    GREEN,
    RED,
    ORANGE,
    TEXT_SECONDARY,
    TEXT_MUTED,
    BG_SURFACE,
    BG_SURFACE2,
)

init_db()

st.set_page_config(page_title="Opportunités — Euronext", page_icon="◈", layout="wide")
inject_css()

# ── Sidebar ───────────────────────────────────────────────────
st.sidebar.markdown(
    '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;'
    'letter-spacing:0.16em;color:#c9a84c;padding:0.25rem 0 1rem;">Paramètres</div>',
    unsafe_allow_html=True,
)

st.sidebar.markdown("**Secteurs**")
selected_sectors = st.sidebar.multiselect(
    "Secteurs",
    list(SECTORS.keys()),
    default=["Defense", "Aeronautique", "Technologie"],
    label_visibility="collapsed",
)

st.sidebar.markdown("---")
st.sidebar.markdown("**Profil de risque**")
risk_profile = st.sidebar.radio(
    "Profil",
    ["Conservateur", "Modéré", "Agressif"],
    index=1,
    label_visibility="collapsed",
)

st.sidebar.markdown("---")
st.sidebar.markdown("**Tickers supplémentaires**")
extra_tickers = st.sidebar.text_input(
    "Tickers (séparés par des virgules)",
    "",
    placeholder="ex : AAPL, TSLA",
    label_visibility="collapsed",
)

st.sidebar.markdown("---")
st.sidebar.markdown("**Filtres**")
min_score = st.sidebar.slider("Score minimum", -10.0, 10.0, 0.0, 0.5)
show_details = st.sidebar.checkbox("Afficher les détails", value=True)

tickers_to_analyze: set = set()
for sector in selected_sectors:
    tickers_to_analyze.update(SECTORS.get(sector, []))
if extra_tickers:
    for t in extra_tickers.split(","):
        t = t.strip().upper()
        if t:
            tickers_to_analyze.add(t)
tickers_list = sorted(tickers_to_analyze)

st.sidebar.markdown("---")
if st.sidebar.button("Lancer l'analyse", type="primary", use_container_width=True):
    if not tickers_list:
        st.sidebar.error("Sélectionnez au moins un secteur.")
    else:
        progress = st.progress(0, text="Analyse en cours…")
        results = []
        for i, ticker in enumerate(tickers_list):
            progress.progress(
                (i + 1) / len(tickers_list),
                text=f"Analyse de {ticker}…",
            )
            try:
                opp = compute_opportunity_score(ticker)
                results.append(opp)
            except Exception as e:
                st.warning(f"Erreur pour {ticker} : {e}")

        progress.empty()
        st.session_state["opportunities"] = results

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

# ── Page header ───────────────────────────────────────────────
page_header("Analyse d'Opportunités", "Scoring multi-facteurs par secteur")

if "opportunities" not in st.session_state:
    st.info("Configurez les secteurs dans la barre latérale et cliquez sur **Lancer l'analyse**.")
    st.stop()

results = st.session_state["opportunities"]
filtered = [r for r in results if r["score"] >= min_score]
filtered.sort(key=lambda x: x["score"], reverse=True)

# ── High-score alerts ─────────────────────────────────────────
high_score = [r for r in filtered if r["score"] >= OPPORTUNITY_HIGH_SCORE]
if high_score:
    section_title("Alertes")
    for opp in high_score:
        st.markdown(
            f"""
            <div style="
                background:rgba(201,168,76,0.06);
                border:1px solid rgba(201,168,76,0.3);
                border-left:3px solid #c9a84c;
                border-radius:3px;
                padding:0.7rem 1rem;
                font-size:0.82rem;
                margin-bottom:0.5rem;
                display:flex;
                align-items:center;
                gap:1rem;
            ">
                <span style="color:#c9a84c;font-weight:700;letter-spacing:0.05em;">
                    {opp['ticker']}
                </span>
                <span style="color:#9494a6;">{opp.get('name','')}</span>
                <span style="
                    margin-left:auto;
                    color:#c9a84c;
                    font-size:0.72rem;
                    font-weight:600;
                    text-transform:uppercase;
                    letter-spacing:0.1em;
                ">Score {opp['score']}/10</span>
                <span style="
                    color:#f0ede0;
                    font-size:0.72rem;
                    font-weight:600;
                    text-transform:uppercase;
                    letter-spacing:0.1em;
                ">{opp['recommendation'].upper()}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

# ── Summary table ─────────────────────────────────────────────
section_title("Tableau des Opportunités")

if not filtered:
    st.info("Aucune opportunité ne correspond aux critères.")
    st.stop()

def safe_format(fmt):
    def formatter(x):
        if x is None or (isinstance(x, float) and pd.isna(x)):
            return "—"
        return fmt.format(x)
    return formatter

table_data = []
for opp in filtered:
    table_data.append({
        "Ticker": opp["ticker"],
        "Nom": opp.get("name", ""),
        "Secteur": opp.get("sector", ""),
        "Score": opp["score"],
        "Recommandation": f"{recommendation_emoji(opp['recommendation'])} {opp['recommendation'].upper()}",
        "Cours": opp.get("current_price"),
        "Objectif": opp.get("target_price"),
        "Gain Pot.": opp.get("gain_pct"),
        "Risque": opp.get("risk_pct"),
        "Tendance": opp.get("trend", ""),
        "Tech.": opp["technical_score"],
        "Fonda.": opp["fundamental_score"],
        "Sentiment": opp["sentiment_score"],
    })

df_table = pd.DataFrame(table_data)
st.dataframe(
    df_table.style.format({
        "Score": safe_format("{:.1f}"),
        "Cours": safe_format("{:.2f}"),
        "Objectif": safe_format("{:.2f}"),
        "Gain Pot.": safe_format("{:+.1f}%"),
        "Risque": safe_format("{:.1f}%"),
        "Tech.": safe_format("{:+.2f}"),
        "Fonda.": safe_format("{:+.2f}"),
        "Sentiment": safe_format("{:+.2f}"),
    }).background_gradient(subset=["Score"], cmap="RdYlGn", vmin=-10, vmax=10),
    use_container_width=True,
    hide_index=True,
)

# ── Score comparison chart ────────────────────────────────────
section_title("Comparaison des Scores")

tickers_names = [o["ticker"] for o in filtered]

fig_scores = go.Figure()
bar_colors = {
    "Technique": GOLD,
    "Fondamental": GREEN,
    "Sentiment": ORANGE,
    "Analystes": "#7b6fc4",
}
score_keys = {
    "Technique": "technical_score",
    "Fondamental": "fundamental_score",
    "Sentiment": "sentiment_score",
    "Analystes": "analyst_score",
}

for label, key in score_keys.items():
    fig_scores.add_trace(go.Bar(
        name=label,
        x=tickers_names,
        y=[o[key] for o in filtered],
        marker_color=bar_colors[label],
        marker_line_width=0,
        opacity=0.85,
    ))

apply_chart_theme(fig_scores, height=420, title="Décomposition des scores par facteur")
fig_scores.update_layout(
    barmode="group",
    bargap=0.2,
    bargroupgap=0.05,
    yaxis=dict(side="left"),
)
st.plotly_chart(fig_scores, use_container_width=True, config={"displayModeBar": False})

# ── Per-company detail ────────────────────────────────────────
if show_details:
    section_title("Détail par Entreprise")

    for opp in filtered:
        score_color = GREEN if opp["score"] >= 6 else (ORANGE if opp["score"] >= 3 else RED)
        with st.expander(
            f"{opp['ticker']}  ·  {opp.get('name', '')}  ·  Score {opp['score']}/10",
            expanded=(opp["score"] >= OPPORTUNITY_HIGH_SCORE),
        ):
            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("Score global", f"{opp['score']}/10")
            c2.metric("Cours actuel", format_currency(opp.get("current_price")))
            c3.metric("Objectif", format_currency(opp.get("target_price")))
            if opp.get("gain_pct") is not None:
                c4.metric("Gain potentiel", format_percentage(opp["gain_pct"]))
            if opp.get("risk_pct") is not None:
                c5.metric("Risque (stop)", format_percentage(opp["risk_pct"]))

            # Sub-scores
            sc1, sc2, sc3, sc4 = st.columns(4)
            sc1.metric("Technique", f"{opp['technical_score']:+.2f}")
            sc2.metric("Fondamental", f"{opp['fundamental_score']:+.2f}")
            sc3.metric("Sentiment", f"{opp['sentiment_score']:+.2f}")
            sc4.metric("Analystes", f"{opp['analyst_score']:+.2f}")

            st.markdown(
                f'<p style="font-size:0.78rem;color:#9494a6;margin:0.75rem 0;">'
                f'<span style="color:#5a5a6e;">Justification</span> — {opp["justification"]}</p>',
                unsafe_allow_html=True,
            )

            # Chart
            hist = get_historical_data(opp["ticker"], period="6mo")
            if not hist.empty:
                hist = compute_indicators(hist)
                fig = go.Figure()
                fig.add_trace(candlestick_trace(hist))

                if "SMA_20" in hist.columns:
                    fig.add_trace(sma_trace(hist, "SMA_20", "SMA 20", GOLD, 1))
                if "SMA_50" in hist.columns:
                    fig.add_trace(sma_trace(hist, "SMA_50", "SMA 50", "rgba(201,168,76,0.45)", 1))

                details = opp.get("details", {})
                tech_details = details.get("technical", {})
                sr = tech_details.get("support_resistance", {})

                for sup in sr.get("supports", []):
                    fig.add_hline(
                        y=sup, line_dash="dash", line_color=GREEN, line_width=1,
                        annotation_text=f"Sup. {sup:.2f}",
                        annotation_font=dict(color=GREEN, size=9),
                    )
                for res in sr.get("resistances", []):
                    fig.add_hline(
                        y=res, line_dash="dash", line_color=RED, line_width=1,
                        annotation_text=f"Rés. {res:.2f}",
                        annotation_font=dict(color=RED, size=9),
                    )

                apply_chart_theme(fig, height=380, title=f"{opp['ticker']} — 6 mois")
                st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

            # News
            news = get_news_for_ticker(opp["ticker"])
            if news:
                st.markdown(
                    '<p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;'
                    'letter-spacing:0.1em;color:#5a5a6e;margin:1rem 0 0.5rem;">Actualités</p>',
                    unsafe_allow_html=True,
                )
                for item in news[:5]:
                    date_str = ""
                    if item.get("published"):
                        date_str = item["published"].strftime("%d/%m %H:%M") + " — "
                    st.markdown(
                        f'<p style="font-size:0.78rem;margin:0.2rem 0;">'
                        f'<span style="color:#5a5a6e;">{date_str}</span>'
                        f'<a href="{item["link"]}" target="_blank" style="color:#c9a84c;text-decoration:none;">'
                        f'{item["title"]}</a>'
                        f'<span style="color:#5a5a6e;"> · {item["source"]}</span></p>',
                        unsafe_allow_html=True,
                    )

st.markdown("---")
st.caption(
    "Les scores et recommandations sont générés automatiquement et ne constituent "
    "pas un conseil en investissement."
)
