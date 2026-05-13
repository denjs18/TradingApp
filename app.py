"""Point d'entree de l'application Streamlit Trading & Analyse Financiere."""

import streamlit as st
from database.db import init_db

# Initialiser la base de donnees au demarrage
init_db()

st.set_page_config(
    page_title="Trading & Analyse Financiere",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Trading & Analyse Financiere")
st.markdown("---")

st.markdown("""
### Bienvenue

Application personnelle de trading automatique et d'analyse financiere
pour le marche Euronext.

**Fonctionnalites :**

- **Trading Automatique** : Paper trading avec strategies automatisees
  (Momentum, Mean Reversion, Breakout)
- **Analyse d'Opportunites** : Scan des secteurs et scoring multi-facteurs
  pour detecter les meilleures opportunites
- **Suivi DCA & Conseils** : Suivi de votre portefeuille reel avec
  recommandations de renforcement

Utilisez le menu lateral pour naviguer entre les pages.
""")

st.markdown("---")

# Afficher un resume rapide
col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("#### 🤖 Trading Auto")
    st.caption("Paper trading en temps reel avec gestion des risques automatique.")
    st.page_link("pages/1_auto_trading.py", label="Ouvrir", icon="➡️")

with col2:
    st.markdown("#### 🔍 Opportunites")
    st.caption("Analyse multi-facteurs des opportunites par secteur.")
    st.page_link("pages/2_opportunities.py", label="Ouvrir", icon="➡️")

with col3:
    st.markdown("#### 💼 DCA Advisor")
    st.caption("Suivi de portefeuille et recommandations DCA.")
    st.page_link("pages/3_dca_advisor.py", label="Ouvrir", icon="➡️")

st.markdown("---")
st.caption(
    "⚠️ Cet outil est a usage personnel et ne constitue pas "
    "un conseil en investissement."
)
