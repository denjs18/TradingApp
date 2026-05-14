"""Point d'entree de l'application Streamlit Trading & Analyse Financiere."""

import streamlit as st
from database.db import init_db
from utils.ui_theme import inject_css

init_db()

st.set_page_config(
    page_title="Trading — Euronext",
    page_icon="◈",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_css()

# ── Hero ─────────────────────────────────────────────────────
st.markdown(
    """
    <div style="
        padding: 3rem 0 2.5rem;
        border-bottom: 1px solid rgba(201,168,76,0.15);
        margin-bottom: 3rem;
    ">
        <div style="
            font-size: 0.62rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: #c9a84c;
            margin-bottom: 0.9rem;
        ">Euronext · Paris</div>

        <h1 style="
            font-size: 2.4rem;
            font-weight: 700;
            color: #f0ede0;
            letter-spacing: -0.035em;
            line-height: 1.1;
            margin: 0 0 0.9rem;
            border: none;
            padding: 0;
        ">
            Plateforme de Trading<br>
            <span style="color:#c9a84c;">& Analyse Financière</span>
        </h1>

        <p style="
            color: #5a5a6e;
            font-size: 0.85rem;
            margin: 0;
            letter-spacing: 0.01em;
            line-height: 1.7;
        ">
            Paper trading automatisé · Scoring multi-facteurs · Suivi de portefeuille DCA
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ── Navigation cards ─────────────────────────────────────────
col1, col2, col3 = st.columns(3, gap="large")

_card_style = """
    background: #111119;
    border: 1px solid rgba(201,168,76,0.18);
    border-top: 2px solid {accent};
    border-radius: 4px;
    padding: 1.75rem 1.5rem 1.5rem;
    height: 100%;
"""

with col1:
    st.markdown(
        f"""
        <div style="{_card_style.format(accent='#c9a84c')}">
            <div style="
                font-size:0.6rem;font-weight:700;text-transform:uppercase;
                letter-spacing:0.15em;color:#c9a84c;margin-bottom:0.9rem;
            ">Trading · Automatisé</div>
            <div style="
                font-size:1.05rem;font-weight:600;color:#f0ede0;
                letter-spacing:-0.01em;margin-bottom:0.7rem;
            ">Trading Automatique</div>
            <p style="
                font-size:0.8rem;color:#5a5a6e;line-height:1.6;margin:0;
            ">
                Paper trading en temps réel avec gestion des risques
                automatique — stop-loss, take-profit, position sizing.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)
    st.page_link("pages/1_auto_trading.py", label="Ouvrir le module")

with col2:
    st.markdown(
        f"""
        <div style="{_card_style.format(accent='rgba(201,168,76,0.5)')}">
            <div style="
                font-size:0.6rem;font-weight:700;text-transform:uppercase;
                letter-spacing:0.15em;color:#c9a84c;margin-bottom:0.9rem;
            ">Analyse · Multi-facteurs</div>
            <div style="
                font-size:1.05rem;font-weight:600;color:#f0ede0;
                letter-spacing:-0.01em;margin-bottom:0.7rem;
            ">Opportunités de Marché</div>
            <p style="
                font-size:0.8rem;color:#5a5a6e;line-height:1.6;margin:0;
            ">
                Scan sectoriel avec scoring technique, fondamental,
                sentiment et consensus analystes.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)
    st.page_link("pages/2_opportunities.py", label="Ouvrir le module")

with col3:
    st.markdown(
        f"""
        <div style="{_card_style.format(accent='rgba(201,168,76,0.5)')}">
            <div style="
                font-size:0.6rem;font-weight:700;text-transform:uppercase;
                letter-spacing:0.15em;color:#c9a84c;margin-bottom:0.9rem;
            ">Portefeuille · DCA</div>
            <div style="
                font-size:1.05rem;font-weight:600;color:#f0ede0;
                letter-spacing:-0.01em;margin-bottom:0.7rem;
            ">Conseiller DCA</div>
            <p style="
                font-size:0.8rem;color:#5a5a6e;line-height:1.6;margin:0;
            ">
                Suivi de vos positions réelles avec recommandations
                de renforcement personnalisées.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)
    st.page_link("pages/3_dca_advisor.py", label="Ouvrir le module")

# ── Footer ────────────────────────────────────────────────────
st.markdown(
    """
    <div style="
        margin-top: 4rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(201,168,76,0.1);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    ">
        <span style="
            font-size: 0.65rem;
            color: #5a5a6e;
            letter-spacing: 0.05em;
        ">
            Usage personnel uniquement — Ne constitue pas un conseil en investissement.
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)
