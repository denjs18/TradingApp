"""Page Streamlit : Trading Automatique (Paper Trading)."""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

from database.db import init_db, get_db
from trading.paper_engine import PaperTradingEngine
from trading.risk_manager import RiskManager
from trading.scheduler import TradingScheduler
from analysis.technical import compute_indicators
from analysis.strategy import STRATEGY_MAP
from data.market_data import get_historical_data, get_market_status
from config import (
    DEFAULT_FAVORITES,
    ALL_TICKERS,
    STRATEGIES,
    DEFAULT_INITIAL_BALANCE,
    DEFAULT_STOP_LOSS_PCT,
    DEFAULT_TAKE_PROFIT_PCT,
    DEFAULT_MAX_POSITION_PCT,
    DEFAULT_MAX_OPEN_POSITIONS,
)
from utils.formatters import format_currency, format_percentage

init_db()

st.set_page_config(page_title="Trading Auto", page_icon="🤖", layout="wide")
st.title("🤖 Trading Automatique (Paper Trading)")

# --- Profils predefinis pour debutants ---
STRATEGY_PROFILES = {
    "prudent": {
        "name": "🛡️ Prudent",
        "description": "Faible risque, gains moderes. Ideal pour debuter.",
        "strategy": "mean_reversion",
        "stop_loss": -1.5,
        "take_profit": 2.0,
        "max_position": 10.0,
        "max_positions": 3,
    },
    "equilibre": {
        "name": "⚖️ Equilibre",
        "description": "Risque modere, bon compromis gains/securite.",
        "strategy": "combined",
        "stop_loss": -2.5,
        "take_profit": 4.0,
        "max_position": 20.0,
        "max_positions": 5,
    },
    "dynamique": {
        "name": "🚀 Dynamique",
        "description": "Risque eleve, potentiel de gains importants.",
        "strategy": "momentum",
        "stop_loss": -4.0,
        "take_profit": 8.0,
        "max_position": 30.0,
        "max_positions": 7,
    },
}

STRATEGY_EXPLANATIONS = {
    "momentum": {
        "name": "📈 Momentum",
        "short": "Suit la tendance",
        "description": """
**Comment ca marche ?**
Achete les actions qui montent deja, en pariant que la hausse va continuer.

**Quand l'utiliser ?**
- Marche en tendance claire (hausse ou baisse)
- Actions avec forte dynamique

**Risques :**
- Peut acheter au sommet si la tendance s'inverse
- Sensible aux retournements brutaux
""",
        "risk_level": "Moyen-Eleve",
        "best_for": "Marches en tendance",
    },
    "mean_reversion": {
        "name": "🔄 Mean Reversion",
        "short": "Retour a la moyenne",
        "description": """
**Comment ca marche ?**
Achete quand le prix est anormalement bas, vend quand il est anormalement haut.
Parie sur un retour a la "normale".

**Quand l'utiliser ?**
- Actions stables qui oscillent autour d'une moyenne
- Marches sans tendance claire

**Risques :**
- Peut acheter une action qui continue de baisser
- Ne fonctionne pas en tendance forte
""",
        "risk_level": "Moyen",
        "best_for": "Actions stables, marches calmes",
    },
    "breakout": {
        "name": "💥 Breakout",
        "short": "Cassure de niveaux",
        "description": """
**Comment ca marche ?**
Detecte quand le prix casse un niveau important (support/resistance).
Achete sur cassure haussiere, vend sur cassure baissiere.

**Quand l'utiliser ?**
- Apres une periode de consolidation
- Avec confirmation par le volume

**Risques :**
- Faux signaux frequents (fausses cassures)
- Necessite des stop-loss serres
""",
        "risk_level": "Eleve",
        "best_for": "Traders actifs",
    },
    "combined": {
        "name": "🎯 Combinee",
        "short": "Mix des 3 strategies",
        "description": """
**Comment ca marche ?**
Combine les 3 strategies et fait la moyenne des signaux.
N'agit que si plusieurs strategies sont d'accord.

**Quand l'utiliser ?**
- Configuration par defaut recommandee
- Reduit les faux signaux

**Risques :**
- Peut manquer certaines opportunites
- Signaux plus rares mais plus fiables
""",
        "risk_level": "Moyen",
        "best_for": "Debutants et prudents",
    },
}

PARAM_HELP = {
    "stop_loss": """
**Stop-Loss** = Limite de perte automatique

Si l'action perd ce pourcentage, elle est vendue automatiquement
pour limiter les pertes.

*Exemple : -2% signifie que si vous achetez a 100€,
la vente automatique se declenchera a 98€.*

**Conseil :** Plus le stop-loss est serre (proche de 0),
plus vous limitez les pertes mais plus vous risquez
d'etre sorti trop tot.
""",
    "take_profit": """
**Take-Profit** = Objectif de gain automatique

Si l'action gagne ce pourcentage, elle est vendue
automatiquement pour securiser les gains.

*Exemple : +3% signifie que si vous achetez a 100€,
la vente automatique se declenchera a 103€.*

**Conseil :** Un ratio gain/risque de 1.5x minimum est recommande.
(ex: stop-loss -2%, take-profit +3%)
""",
    "max_position": """
**Taille max position** = % du capital par trade

Pourcentage maximum du portefeuille investi dans une seule action.

*Exemple : 20% signifie que sur 10 000€, vous n'investirez
jamais plus de 2 000€ dans une meme action.*

**Conseil :** Ne jamais depasser 25% pour diversifier le risque.
""",
    "max_positions": """
**Max positions ouvertes** = Nombre d'actions en portefeuille

Limite le nombre d'actions differentes que vous pouvez
detenir en meme temps.

*Exemple : 5 positions max = 5 actions differentes maximum.*

**Conseil :** 3-5 positions pour les debutants,
permet de suivre facilement.
""",
}

# --- Initialiser les composants dans session_state ---
if "engine" not in st.session_state:
    st.session_state["engine"] = PaperTradingEngine()

if "scheduler" not in st.session_state:
    st.session_state["scheduler"] = TradingScheduler()

engine: PaperTradingEngine = st.session_state["engine"]
scheduler: TradingScheduler = st.session_state["scheduler"]

# --- Sidebar : Configuration ---
st.sidebar.header("Configuration du Trading")

# --- Section 1: Profils predefinis ---
st.sidebar.subheader("1. Choisir un profil")

# Initialiser les valeurs dans session_state si necessaire
if "profile_applied" not in st.session_state:
    st.session_state["profile_applied"] = "equilibre"
    st.session_state["custom_stop_loss"] = STRATEGY_PROFILES["equilibre"]["stop_loss"]
    st.session_state["custom_take_profit"] = STRATEGY_PROFILES["equilibre"]["take_profit"]
    st.session_state["custom_max_position"] = STRATEGY_PROFILES["equilibre"]["max_position"]
    st.session_state["custom_max_positions"] = STRATEGY_PROFILES["equilibre"]["max_positions"]
    st.session_state["custom_strategy"] = STRATEGY_PROFILES["equilibre"]["strategy"]

# Afficher les profils comme des boutons radio avec descriptions
profile_options = list(STRATEGY_PROFILES.keys())
profile_names = [STRATEGY_PROFILES[p]["name"] for p in profile_options]

selected_profile = st.sidebar.radio(
    "Profil de risque",
    profile_options,
    index=profile_options.index(st.session_state.get("profile_applied", "equilibre")),
    format_func=lambda p: STRATEGY_PROFILES[p]["name"],
    help="Choisissez un profil adapte a votre tolerance au risque",
)

# Afficher la description du profil selectionne
profile_info = STRATEGY_PROFILES[selected_profile]
st.sidebar.info(profile_info["description"])

# Bouton pour appliquer le profil
if st.sidebar.button("✨ Appliquer ce profil", type="primary", use_container_width=True):
    st.session_state["profile_applied"] = selected_profile
    st.session_state["custom_stop_loss"] = profile_info["stop_loss"]
    st.session_state["custom_take_profit"] = profile_info["take_profit"]
    st.session_state["custom_max_position"] = profile_info["max_position"]
    st.session_state["custom_max_positions"] = profile_info["max_positions"]
    st.session_state["custom_strategy"] = profile_info["strategy"]
    st.rerun()

st.sidebar.markdown("---")

# --- Section 2: Strategie ---
st.sidebar.subheader("2. Strategie de trading")

# Selecteur de strategie avec aide
strategy = st.sidebar.selectbox(
    "Strategie",
    STRATEGIES,
    index=STRATEGIES.index(st.session_state.get("custom_strategy", "combined")),
    format_func=lambda s: STRATEGY_EXPLANATIONS[s]["name"],
    help="La strategie determine quand acheter et vendre",
)
st.session_state["custom_strategy"] = strategy

# Afficher l'explication de la strategie
strat_info = STRATEGY_EXPLANATIONS[strategy]
with st.sidebar.expander(f"📖 Comprendre : {strat_info['short']}", expanded=False):
    st.markdown(strat_info["description"])
    st.markdown(f"**Niveau de risque :** {strat_info['risk_level']}")
    st.markdown(f"**Ideal pour :** {strat_info['best_for']}")

scheduler.set_strategy(strategy)

# Tickers
st.sidebar.markdown("---")
st.sidebar.subheader("3. Actions a surveiller")
selected_tickers = st.sidebar.multiselect(
    "Tickers",
    ALL_TICKERS,
    default=DEFAULT_FAVORITES,
    help="Selectionnez les actions sur lesquelles le robot va trader",
)
scheduler.set_tickers(selected_tickers)

# --- Section 3: Parametres de risque ---
st.sidebar.markdown("---")
st.sidebar.subheader("4. Gestion des risques")

# Toggle pour mode avance
show_advanced = st.sidebar.toggle(
    "Mode avance",
    value=False,
    help="Affiche les parametres detailles pour les utilisateurs experimentes",
)

if show_advanced:
    # Afficher les sliders avec aide contextuelle
    with st.sidebar.expander("❓ Aide : Stop-Loss", expanded=False):
        st.markdown(PARAM_HELP["stop_loss"])

    stop_loss = st.sidebar.slider(
        "Stop-Loss (%)",
        -10.0, -0.5,
        st.session_state.get("custom_stop_loss", DEFAULT_STOP_LOSS_PCT),
        0.5,
        help="Limite de perte automatique",
    )
    st.session_state["custom_stop_loss"] = stop_loss

    with st.sidebar.expander("❓ Aide : Take-Profit", expanded=False):
        st.markdown(PARAM_HELP["take_profit"])

    take_profit = st.sidebar.slider(
        "Take-Profit (%)",
        0.5, 15.0,
        st.session_state.get("custom_take_profit", DEFAULT_TAKE_PROFIT_PCT),
        0.5,
        help="Objectif de gain automatique",
    )
    st.session_state["custom_take_profit"] = take_profit

    # Afficher le ratio risque/gain
    ratio = abs(take_profit / stop_loss) if stop_loss != 0 else 0
    ratio_color = "green" if ratio >= 1.5 else ("orange" if ratio >= 1 else "red")
    st.sidebar.markdown(
        f"**Ratio gain/risque :** :{ratio_color}[{ratio:.1f}x] "
        f"{'✅' if ratio >= 1.5 else '⚠️'}"
    )

    with st.sidebar.expander("❓ Aide : Taille position", expanded=False):
        st.markdown(PARAM_HELP["max_position"])

    max_position = st.sidebar.slider(
        "Taille max position (%)",
        5.0, 50.0,
        st.session_state.get("custom_max_position", DEFAULT_MAX_POSITION_PCT),
        5.0,
        help="% maximum du capital par trade",
    )
    st.session_state["custom_max_position"] = max_position

    with st.sidebar.expander("❓ Aide : Max positions", expanded=False):
        st.markdown(PARAM_HELP["max_positions"])

    max_positions = st.sidebar.slider(
        "Max positions ouvertes",
        1, 10,
        st.session_state.get("custom_max_positions", DEFAULT_MAX_OPEN_POSITIONS),
        help="Nombre maximum d'actions en portefeuille",
    )
    st.session_state["custom_max_positions"] = max_positions
else:
    # Mode simple : afficher un resume des parametres
    stop_loss = st.session_state.get("custom_stop_loss", DEFAULT_STOP_LOSS_PCT)
    take_profit = st.session_state.get("custom_take_profit", DEFAULT_TAKE_PROFIT_PCT)
    max_position = st.session_state.get("custom_max_position", DEFAULT_MAX_POSITION_PCT)
    max_positions = st.session_state.get("custom_max_positions", DEFAULT_MAX_OPEN_POSITIONS)

    st.sidebar.markdown(f"""
    **Parametres actuels :**
    - 🛑 Stop-Loss : **{stop_loss}%**
    - 🎯 Take-Profit : **+{take_profit}%**
    - 📊 Max par position : **{max_position}%**
    - 📈 Max positions : **{max_positions}**

    *Activez le "Mode avance" pour modifier.*
    """)

# Mettre a jour le risk manager
scheduler.risk_manager = RiskManager(
    stop_loss_pct=stop_loss,
    take_profit_pct=take_profit,
    max_position_pct=max_position,
    max_open_positions=max_positions,
)

# --- Controles Start/Stop/Pause ---
st.subheader("Controles")

market_status = get_market_status()
status_text = "🟢 Marche ouvert" if market_status["is_open"] else "🔴 Marche ferme"
st.markdown(f"**Statut du marche** : {status_text}")

col_ctrl1, col_ctrl2, col_ctrl3, col_ctrl4 = st.columns(4)

with col_ctrl1:
    if st.button(
        "▶️ Demarrer" if not scheduler.is_running else "⏸️ En cours...",
        type="primary" if not scheduler.is_running else "secondary",
        disabled=scheduler.is_running,
    ):
        scheduler.start()
        st.success("Trading automatique demarre.")
        st.rerun()

with col_ctrl2:
    if st.button("⏹️ Arreter", disabled=not scheduler.is_running):
        scheduler.stop()
        st.info("Trading automatique arrete.")
        st.rerun()

with col_ctrl3:
    if st.button("🔄 Reset Portefeuille"):
        scheduler.stop()
        balance = st.session_state.get("reset_balance", DEFAULT_INITIAL_BALANCE)
        engine.reset(balance)
        st.warning("Portefeuille reinitialise.")
        st.rerun()

with col_ctrl4:
    st.number_input(
        "Solde initial (EUR)",
        min_value=100.0,
        value=DEFAULT_INITIAL_BALANCE,
        step=100.0,
        key="reset_balance",
    )

# Statut du scheduler
sched_status = scheduler.get_status()
st.markdown(
    f"**Trading** : {'🟢 Actif' if sched_status['is_running'] else '🔴 Inactif'} "
    f"| **Strategie** : {sched_status['strategy']} "
    f"| **Tickers** : {len(sched_status['tickers'])} "
    f"| **Dernier cycle** : {sched_status['last_run'] or 'N/A'}"
)

st.markdown("---")

# --- Etat du portefeuille ---
st.header("Portefeuille Virtuel")

summary = engine.get_portfolio_summary()

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("💰 Cash", format_currency(summary["cash"]))
col2.metric("📊 Positions", format_currency(summary["positions_value"]))
col3.metric("💼 Total", format_currency(summary["total_value"]))
col4.metric("📈 Positions ouvertes", summary["num_positions"])

# P&L total
initial = DEFAULT_INITIAL_BALANCE
total_pnl = summary["total_value"] - initial
total_pnl_pct = (total_pnl / initial * 100) if initial > 0 else 0
col5.metric(
    "P&L Total",
    format_currency(total_pnl),
    delta=format_percentage(total_pnl_pct),
)

# --- Positions ouvertes ---
if summary["positions"]:
    st.subheader("Positions Ouvertes")

    pos_data = []
    for pos in summary["positions"]:
        pos_data.append({
            "Ticker": pos["ticker"],
            "Actions": pos["shares"],
            "Prix Entree": pos["entry_price"],
            "Prix Actuel": pos.get("current_price", 0),
            "Valeur": pos.get("current_value", 0),
            "P&L (EUR)": pos.get("pnl", 0),
            "P&L (%)": pos.get("pnl_pct", 0),
            "Stop-Loss": pos.get("stop_loss"),
            "Take-Profit": pos.get("take_profit"),
        })

    pos_df = pd.DataFrame(pos_data)
    st.dataframe(
        pos_df.style.format({
            "Actions": "{:.2f}",
            "Prix Entree": "{:.2f}",
            "Prix Actuel": "{:.2f}",
            "Valeur": "{:.2f}",
            "P&L (EUR)": "{:+.2f}",
            "P&L (%)": "{:+.2f}%",
            "Stop-Loss": "{:.2f}",
            "Take-Profit": "{:.2f}",
        }).map(
            lambda v: f"color: {'green' if v > 0 else 'red' if v < 0 else 'gray'}"
            if isinstance(v, (int, float)) else "",
            subset=["P&L (EUR)", "P&L (%)"],
        ),
        use_container_width=True,
        hide_index=True,
    )

    # Graphiques des positions
    st.subheader("Graphiques des Positions")

    for pos in summary["positions"]:
        with st.expander(f"{pos['ticker']} — P&L: {pos.get('pnl', 0):+.2f} EUR"):
            hist = get_historical_data(pos["ticker"], period="1mo")
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

                # Ligne d'entree
                fig.add_hline(
                    y=pos["entry_price"],
                    line_dash="dash",
                    line_color="blue",
                    annotation_text=f"Entree: {pos['entry_price']:.2f}",
                )

                # Stop-loss
                if pos.get("stop_loss"):
                    fig.add_hline(
                        y=pos["stop_loss"],
                        line_dash="dot",
                        line_color="red",
                        annotation_text=f"SL: {pos['stop_loss']:.2f}",
                    )

                # Take-profit
                if pos.get("take_profit"):
                    fig.add_hline(
                        y=pos["take_profit"],
                        line_dash="dot",
                        line_color="green",
                        annotation_text=f"TP: {pos['take_profit']:.2f}",
                    )

                fig.update_layout(
                    title=pos["ticker"],
                    height=350,
                    xaxis_rangeslider_visible=False,
                )
                st.plotly_chart(fig, use_container_width=True)

# --- Metriques de performance ---
st.header("Performance")

metrics = engine.get_performance_metrics()

mcol1, mcol2, mcol3, mcol4, mcol5, mcol6 = st.columns(6)
mcol1.metric("Trades Total", metrics["total_trades"])
mcol2.metric("Trades Clotures", metrics.get("closed_trades", 0))
mcol3.metric("Win Rate", f"{metrics['win_rate']:.1f}%")
mcol4.metric("P&L Total", format_currency(metrics["total_pnl"]))
mcol5.metric("Max Drawdown", format_currency(metrics["max_drawdown"]))
mcol6.metric("Sharpe Ratio", f"{metrics['sharpe_ratio']:.2f}")

# --- Courbe de performance ---
st.subheader("Courbe de Performance")

with get_db() as conn:
    snapshots = conn.execute(
        "SELECT * FROM portfolio_snapshots ORDER BY snapshot_at"
    ).fetchall()

if snapshots and len(snapshots) > 1:
    snap_df = pd.DataFrame([dict(s) for s in snapshots])
    snap_df["snapshot_at"] = pd.to_datetime(snap_df["snapshot_at"])

    fig_perf = px.line(
        snap_df,
        x="snapshot_at",
        y="total_value",
        title="Evolution de la valeur du portefeuille",
        labels={"snapshot_at": "Date", "total_value": "Valeur (EUR)"},
    )
    fig_perf.add_hline(
        y=DEFAULT_INITIAL_BALANCE,
        line_dash="dash",
        line_color="gray",
        annotation_text="Capital initial",
    )
    fig_perf.update_layout(height=400)
    st.plotly_chart(fig_perf, use_container_width=True)
else:
    st.info("La courbe de performance sera disponible apres quelques cycles de trading.")

# --- Historique des trades ---
st.header("Historique des Trades")

trades = engine.get_all_trades()
if trades:
    trades_df = pd.DataFrame(trades)
    display_cols = ["executed_at", "ticker", "side", "shares", "price", "total", "strategy", "reason"]
    available_cols = [c for c in display_cols if c in trades_df.columns]
    trades_df = trades_df[available_cols]

    trades_df = trades_df.rename(columns={
        "executed_at": "Date",
        "ticker": "Ticker",
        "side": "Type",
        "shares": "Actions",
        "price": "Prix",
        "total": "Total",
        "strategy": "Strategie",
        "reason": "Raison",
    })

    st.dataframe(
        trades_df.style.format({
            "Actions": "{:.2f}",
            "Prix": "{:.2f}",
            "Total": "{:.2f}",
        }),
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("Aucun trade execute.")

# --- Logs ---
st.header("Logs de Trading")

logs = engine.get_logs(limit=30)
if logs:
    for log in logs:
        level = log["level"]
        icon = {"INFO": "ℹ️", "WARNING": "⚠️", "ERROR": "❌"}.get(level, "📋")
        st.text(f"{icon} [{log['created_at']}] {log['message']}")
else:
    st.info("Aucun log disponible.")

st.markdown("---")
st.caption(
    "Paper trading — simulation avec argent fictif. "
    "Les resultats passes ne garantissent pas les performances futures."
)
