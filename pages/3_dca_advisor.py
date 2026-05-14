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
)

init_db()

# --- Base de données des ETF et actions ---
POPULAR_ASSETS = {
    "CW8.PA": "Amundi MSCI World (CW8)",
    "EWLD.PA": "Lyxor MSCI World (EWLD)",
    "MWRD.PA": "Amundi MSCI World ESG",
    "WLD.PA": "iShares MSCI World",
    "500.PA": "Amundi S&P 500 (500)",
    "ESE.PA": "BNP Paribas Easy S&P 500",
    "PSP5.PA": "Lyxor PEA S&P 500",
    "PE500.PA": "Amundi PEA S&P 500 ESG",
    "PUST.PA": "Lyxor PEA Nasdaq-100",
    "PANX.PA": "Amundi PEA Nasdaq-100",
    "UST.PA": "Lyxor Nasdaq-100",
    "ETZ.PA": "BNP Paribas Easy Stoxx 600",
    "MEUD.PA": "Amundi Euro Stoxx 50",
    "C50.PA": "Amundi CAC 40",
    "CAC.PA": "Lyxor CAC 40",
    "PCAE.PA": "Amundi PEA Euro Stoxx 50",
    "PAEEM.PA": "Amundi PEA Emerging Markets",
    "AEEM.PA": "Amundi MSCI Emerging Markets",
    "EMIM.PA": "iShares Emerging Markets",
    "TNO.PA": "Lyxor MSCI World Technology",
    "TNOW.PA": "Amundi MSCI World IT",
    "PHEA.PA": "Lyxor MSCI World Health Care",
    "AWAT.PA": "Lyxor MSCI Water",
    "ENRJ.PA": "Lyxor MSCI New Energy",
    "CLWD.PA": "Amundi MSCI World Climate",
    "OBLI.PA": "Lyxor Euro Government Bond",
    "CORP.PA": "Amundi Euro Corporate Bond",
    "AIR.PA": "Airbus",
    "SAF.PA": "Safran",
    "TKO.PA": "Thales",
    "HO.PA": "Thales (ancien)",
    "MC.PA": "LVMH",
    "KER.PA": "Kering",
    "RMS.PA": "Hermès",
    "BNP.PA": "BNP Paribas",
    "GLE.PA": "Société Générale",
    "ACA.PA": "Crédit Agricole",
    "TTE.PA": "TotalEnergies",
    "ENGI.PA": "Engie",
    "CAP.PA": "Capgemini",
    "DAS.PA": "Dassault Systèmes",
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
    "DJSC.PA": "Lyxor DJ Industrial Average",
    "RS2K.PA": "Amundi Russell 2000",
    "PAASI.PA": "Amundi PEA Asie hors Japon",
    "PJPN.PA": "Amundi PEA Japon Topix",
    "CJ1.PA": "Amundi Japan Topix",
}

ASSET_SEARCH_INDEX: dict = {}
for _ticker, _name in POPULAR_ASSETS.items():
    ASSET_SEARCH_INDEX[_ticker.lower()] = _ticker
    for _word in _name.lower().split():
        if len(_word) > 2:
            if _word not in ASSET_SEARCH_INDEX:
                ASSET_SEARCH_INDEX[_word] = []
            if isinstance(ASSET_SEARCH_INDEX[_word], list):
                ASSET_SEARCH_INDEX[_word].append(_ticker)


def search_assets(query: str) -> list:
    if not query or len(query) < 2:
        return []
    query = query.lower().strip()
    results: set = set()
    for ticker in POPULAR_ASSETS:
        if query in ticker.lower():
            results.add(ticker)
    for ticker, name in POPULAR_ASSETS.items():
        if query in name.lower():
            results.add(ticker)
    return sorted(results, key=lambda t: POPULAR_ASSETS.get(t, t))


st.set_page_config(page_title="DCA Advisor — Euronext", page_icon="◈", layout="wide")
inject_css()

# ── Sidebar ───────────────────────────────────────────────────
st.sidebar.markdown(
    '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;'
    'letter-spacing:0.16em;color:#c9a84c;padding:0.25rem 0 1rem;">Portefeuille</div>',
    unsafe_allow_html=True,
)

st.sidebar.markdown("**Ajouter / Renforcer**")

search_query = st.sidebar.text_input(
    "Rechercher",
    placeholder="Nom ou ticker (ex: World, CW8, LVMH…)",
    label_visibility="collapsed",
)

selected_ticker = None
if search_query and len(search_query) >= 2:
    search_results = search_assets(search_query)
    if search_results:
        options = [""] + search_results
        option_labels = {
            "": "— Sélectionnez —",
            **{t: f"{POPULAR_ASSETS.get(t, t)} ({t})" for t in search_results},
        }
        selected_ticker = st.sidebar.selectbox(
            f"{len(search_results)} résultat(s)",
            options,
            format_func=lambda x: option_labels.get(x, x),
            label_visibility="collapsed",
        )
    else:
        st.sidebar.caption("Aucun résultat. Entrez le ticker manuellement.")

with st.sidebar.expander("Ticker personnalisé", expanded=not search_query):
    manual_ticker = st.text_input(
        "Ticker",
        "",
        placeholder="ex: AAPL, MSFT.US",
        label_visibility="collapsed",
    ).upper().strip()

final_ticker = selected_ticker if selected_ticker else manual_ticker

if final_ticker:
    asset_name = POPULAR_ASSETS.get(final_ticker, "Actif personnalisé")
    st.sidebar.markdown(
        f'<div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);'
        f'border-radius:3px;padding:0.5rem 0.75rem;font-size:0.75rem;margin-bottom:0.75rem;">'
        f'<span style="color:#c9a84c;font-weight:600;">{final_ticker}</span>'
        f'<span style="color:#5a5a6e;"> · {asset_name}</span></div>',
        unsafe_allow_html=True,
    )

with st.sidebar.form("add_position_form"):
    st.markdown(
        f'<div style="font-size:0.72rem;color:#5a5a6e;margin-bottom:0.5rem;">'
        f'Ticker : <span style="color:#f0ede0;font-weight:600;">'
        f'{final_ticker if final_ticker else "Non sélectionné"}</span></div>',
        unsafe_allow_html=True,
    )
    shares_input = st.number_input("Actions / parts", min_value=0.0, step=0.01, label_visibility="visible")
    price_input = st.number_input("Prix moyen (EUR)", min_value=0.0, step=0.01, label_visibility="visible")
    submit_add = st.form_submit_button("Ajouter la position", type="primary", use_container_width=True)

    if submit_add:
        if not final_ticker:
            st.error("Sélectionnez ou entrez un ticker.")
        elif shares_input <= 0:
            st.error("Entrez un nombre d'actions > 0.")
        elif price_input <= 0:
            st.error("Entrez un prix > 0.")
        else:
            add_position(final_ticker, shares_input, price_input)
            st.success(f"{final_ticker} ajouté au portefeuille.")
            st.rerun()

st.sidebar.markdown("---")
with st.sidebar.expander("ETF populaires"):
    st.markdown(
        """
**World / Global**
CW8.PA · EWLD.PA

**S&P 500**
500.PA · PE500.PA

**Nasdaq**
PUST.PA · PANX.PA

**Europe**
C50.PA · ETZ.PA · MEUD.PA

**Émergents**
PAEEM.PA · AEEM.PA
        """
    )

positions_list = get_all_positions()
if positions_list:
    st.sidebar.markdown("---")
    st.sidebar.markdown("**Supprimer une position**")
    ticker_to_remove = st.sidebar.selectbox(
        "Ticker",
        [""] + [p["ticker"] for p in positions_list],
        label_visibility="collapsed",
    )
    if st.sidebar.button("Supprimer", use_container_width=True) and ticker_to_remove:
        remove_position(ticker_to_remove)
        st.sidebar.success(f"{ticker_to_remove} supprimé.")
        st.rerun()

# ── Page header ───────────────────────────────────────────────
page_header("Conseiller DCA", "Suivi de portefeuille & recommandations personnalisées")

summary = get_portfolio_summary()

if not summary["positions"]:
    st.info(
        "Aucune position dans le portefeuille. "
        "Utilisez le formulaire dans la barre latérale pour ajouter vos positions."
    )
    st.stop()

# ── Portfolio overview ────────────────────────────────────────
section_title("Vue Globale")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Investi", format_currency(summary["total_invested"]))
c2.metric("Valeur actuelle", format_currency(summary["total_current_value"]))
c3.metric(
    "P&L total",
    format_currency(summary["total_pnl"]),
    delta=format_percentage(summary["total_pnl_pct"]),
)
c4.metric("Positions", len(summary["positions"]))

# ── Sector allocation ─────────────────────────────────────────
allocation = get_sector_allocation(summary["positions"])
if allocation:
    section_title("Allocation Sectorielle")

    _gold_palette = [
        "#c9a84c", "#3d9e6e", "#7b6fc4", "#d4834a",
        "#4a8fd4", "#c84848", "#6e9e8a", "#a07b40",
    ]

    fig_alloc = go.Figure(go.Pie(
        values=list(allocation.values()),
        labels=list(allocation.keys()),
        hole=0.55,
        marker=dict(
            colors=_gold_palette[:len(allocation)],
            line=dict(color="#0b0b10", width=3),
        ),
        textfont=dict(size=11, color="#f0ede0"),
        hovertemplate="<b>%{label}</b><br>%{value:.0f} €<br>%{percent}<extra></extra>",
    ))
    fig_alloc.update_layout(
        height=300,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Inter, sans-serif", color="#9494a6"),
        margin=dict(l=0, r=0, t=0, b=0),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            font=dict(size=11, color="#9494a6"),
            orientation="v",
            yanchor="middle",
            y=0.5,
        ),
        annotations=[dict(
            text=f"<b>{len(allocation)}</b><br><span style='font-size:10px'>secteurs</span>",
            x=0.5, y=0.5, font_size=14, showarrow=False,
            font=dict(color="#f0ede0", family="Inter"),
        )],
    )
    st.plotly_chart(fig_alloc, use_container_width=True, config={"displayModeBar": False})

# ── Positions table ───────────────────────────────────────────
section_title("Détail des Positions")

positions_df = pd.DataFrame(summary["positions"])
display_cols = {
    "ticker": "Ticker",
    "shares": "Actions",
    "avg_price": "PRU (€)",
    "current_price": "Cours (€)",
    "invested": "Investi (€)",
    "current_value": "Valeur (€)",
    "pnl": "P&L (€)",
    "pnl_pct": "P&L (%)",
}
display_df = positions_df[list(display_cols.keys())].rename(columns=display_cols)

st.dataframe(
    display_df.style.format({
        "PRU (€)": "{:.2f}",
        "Cours (€)": "{:.2f}",
        "Investi (€)": "{:.2f}",
        "Valeur (€)": "{:.2f}",
        "P&L (€)": "{:+.2f}",
        "P&L (%)": "{:+.2f}%",
    }).map(
        lambda v: (
            f"color: {GREEN}" if isinstance(v, (int, float)) and v > 0
            else f"color: {RED}" if isinstance(v, (int, float)) and v < 0
            else ""
        ),
        subset=["P&L (€)", "P&L (%)"],
    ),
    use_container_width=True,
    hide_index=True,
)

# ── DCA Recommendations ───────────────────────────────────────
section_title("Recommandations du Jour")

recommendations = []
for pos in summary["positions"]:
    ticker = pos["ticker"]
    current_price = pos.get("current_price")
    avg_price = pos["avg_price"]

    if current_price is None:
        continue

    hist = get_historical_data(ticker, period="6mo")
    tech_summary = get_technical_summary(hist) if not hist.empty else None
    fund_summary = get_fundamental_summary(ticker)
    analyst = get_analyst_recommendations(ticker)
    targets = get_analyst_price_targets(ticker)
    changes = get_price_change(ticker)

    action = "conserver"
    reasons = []

    if current_price < avg_price * 0.95:
        reasons.append(f"Prix ({current_price:.2f}) sous le PRU ({avg_price:.2f})")

    tech_score = tech_summary["overall_score"] if tech_summary else 0
    if tech_score > 0.3:
        reasons.append(f"Signal technique favorable ({tech_score:+.2f})")
    elif tech_score < -0.3:
        reasons.append(f"Signal technique défavorable ({tech_score:+.2f})")

    fund_score = fund_summary["overall_score"]
    if fund_score > 0.3:
        reasons.append("Fondamentaux solides")
    elif fund_score < -0.3:
        reasons.append("Fondamentaux détériorés")

    if analyst.get("recommendation") in ("buy", "strong_buy"):
        reasons.append(f"Consensus analystes : {analyst['recommendation']}")
    elif analyst.get("recommendation") in ("sell", "strong_sell"):
        reasons.append(f"Consensus analystes : {analyst['recommendation']}")

    if targets.get("upside_pct") and targets["upside_pct"] > 15:
        reasons.append(f"Upside potentiel : {targets['upside_pct']:.1f}%")

    bullish_count = sum(1 for r in reasons if any(
        w in r.lower() for w in ["favorable", "solide", "buy", "sous le pru", "upside"]
    ))
    bearish_count = sum(1 for r in reasons if any(
        w in r.lower() for w in ["défavorable", "détérioré", "sell"]
    ))

    if bullish_count >= 2:
        action = "renforcer"
    elif bearish_count >= 2:
        action = "alléger"
    else:
        action = "conserver"

    trend = tech_summary["trend"] if tech_summary else "neutre"
    short_term = f"Tendance {trend}"
    if tech_score > 0.3:
        short_term += " — momentum positif"
    elif tech_score < -0.3:
        short_term += " — momentum négatif"

    medium_term = "Neutre"
    if fund_score > 0.3 and analyst.get("recommendation") in ("buy", "strong_buy"):
        medium_term = "Favorable — fondamentaux et consensus positifs"
    elif fund_score < -0.3:
        medium_term = "Défavorable — fondamentaux en baisse"

    long_term = "Neutre"
    if targets.get("upside_pct"):
        if targets["upside_pct"] > 20:
            long_term = f"Favorable — objectif moyen +{targets['upside_pct']:.0f}%"
        elif targets["upside_pct"] < -10:
            long_term = f"Défavorable — objectif moyen {targets['upside_pct']:.0f}%"

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

recommendations.sort(
    key=lambda r: (
        {"renforcer": 0, "conserver": 1, "alléger": 2}.get(r["action"], 1),
        -r["tech_score"],
    )
)

_action_config = {
    "renforcer": {"color": GREEN, "label": "RENFORCER", "bg": "rgba(61,158,110,0.08)", "border": "rgba(61,158,110,0.3)"},
    "conserver": {"color": GOLD, "label": "CONSERVER", "bg": "rgba(201,168,76,0.06)", "border": "rgba(201,168,76,0.25)"},
    "alléger":   {"color": RED,  "label": "ALLÉGER",   "bg": "rgba(200,72,72,0.06)",   "border": "rgba(200,72,72,0.25)"},
}

for rec in recommendations:
    cfg = _action_config.get(rec["action"], _action_config["conserver"])
    with st.expander(
        f"{rec['ticker']}  ·  {rec['action'].upper()}  ·  {rec['current_price']:.2f} €",
        expanded=(rec["action"] == "renforcer"),
    ):
        # Action badge
        st.markdown(
            f'<div style="'
            f'display:inline-flex;align-items:center;gap:0.5rem;'
            f'background:{cfg["bg"]};border:1px solid {cfg["border"]};'
            f'border-radius:3px;padding:0.3rem 0.8rem;margin-bottom:0.75rem;">'
            f'<span style="font-size:0.7rem;font-weight:700;text-transform:uppercase;'
            f'letter-spacing:0.1em;color:{cfg["color"]};">{cfg["label"]}</span>'
            f'</div>',
            unsafe_allow_html=True,
        )

        mc1, mc2, mc3, mc4 = st.columns(4)
        mc1.metric("Score technique", f"{rec['tech_score']:+.2f}")
        mc2.metric("Score fondamental", f"{rec['fund_score']:+.2f}")
        if rec.get("target_mean"):
            mc3.metric("Objectif moyen", f"{rec['target_mean']:.2f} €")
        changes = rec["changes"]
        if changes.get("week") is not None:
            mc4.metric("Variation semaine", format_percentage(changes["week"]))

        if rec["reasons"]:
            st.markdown(
                '<p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;'
                'letter-spacing:0.1em;color:#5a5a6e;margin:1rem 0 0.4rem;">Facteurs</p>',
                unsafe_allow_html=True,
            )
            for reason in rec["reasons"]:
                st.markdown(
                    f'<p style="font-size:0.8rem;color:#9494a6;margin:0.15rem 0;">'
                    f'<span style="color:#c9a84c;margin-right:0.5rem;">–</span>{reason}</p>',
                    unsafe_allow_html=True,
                )

        # Forecasts
        st.markdown(
            '<p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;'
            'letter-spacing:0.1em;color:#5a5a6e;margin:1rem 0 0.5rem;">Prévisions</p>',
            unsafe_allow_html=True,
        )
        pc1, pc2, pc3 = st.columns(3)

        def _forecast_card(col, period, text):
            col.markdown(
                f"""
                <div style="
                    background:#111119;
                    border:1px solid rgba(201,168,76,0.12);
                    border-radius:3px;
                    padding:0.85rem;
                ">
                    <div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.12em;color:#5a5a6e;margin-bottom:0.4rem;">{period}</div>
                    <div style="font-size:0.78rem;color:#9494a6;line-height:1.5;">{text}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        _forecast_card(pc1, "Court terme · 1-4 sem.", rec["short_term"])
        _forecast_card(pc2, "Moyen terme · 1-6 mois", rec["medium_term"])
        _forecast_card(pc3, "Long terme · 6-12 mois", rec["long_term"])

        # Chart
        hist = get_historical_data(rec["ticker"], period="6mo")
        if not hist.empty:
            hist = compute_indicators(hist)
            fig = go.Figure()
            fig.add_trace(candlestick_trace(hist))
            if "SMA_20" in hist.columns:
                fig.add_trace(sma_trace(hist, "SMA_20", "SMA 20", GOLD, 1))
            if "SMA_50" in hist.columns:
                fig.add_trace(sma_trace(hist, "SMA_50", "SMA 50", "rgba(201,168,76,0.45)", 1))
            apply_chart_theme(fig, height=360, title=f"{rec['ticker']} — 6 mois")
            st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

        # News
        news = get_news_for_ticker(rec["ticker"])
        if news:
            st.markdown(
                '<p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;'
                'letter-spacing:0.1em;color:#5a5a6e;margin:1rem 0 0.4rem;">Actualités</p>',
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

# ── Portfolio history ─────────────────────────────────────────
section_title("Évolution de la Valeur")

save_portfolio_snapshot()
history = get_portfolio_history()

if len(history) > 1:
    hist_df = pd.DataFrame(history)
    hist_df["snapshot_at"] = pd.to_datetime(hist_df["snapshot_at"])

    fig_perf = go.Figure()
    fig_perf.add_trace(go.Scatter(
        x=hist_df["snapshot_at"],
        y=hist_df["total_value"],
        mode="lines",
        name="Valeur",
        line=dict(color=GOLD, width=2),
        fill="tozeroy",
        fillcolor="rgba(201,168,76,0.06)",
    ))
    apply_chart_theme(fig_perf, height=360, title="Valeur du portefeuille dans le temps")
    fig_perf.update_layout(yaxis=dict(side="right"))
    st.plotly_chart(fig_perf, use_container_width=True, config={"displayModeBar": False})
else:
    st.info("L'historique sera disponible après plusieurs visites de cette page.")

st.markdown("---")
st.caption(
    "Les recommandations sont générées automatiquement et ne constituent "
    "pas un conseil en investissement."
)
