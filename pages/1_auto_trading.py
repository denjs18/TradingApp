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
from utils.ui_theme import (
    inject_css,
    apply_chart_theme,
    candlestick_trace,
    sma_trace,
    page_header,
    section_title,
    status_badge,
    GOLD,
    GREEN,
    RED,
    ORANGE,
    TEXT_SECONDARY,
    TEXT_MUTED,
)

init_db()

st.set_page_config(page_title="Trading Auto — Euronext", page_icon="◈", layout="wide")
inject_css()

# --- Profils ---
STRATEGY_PROFILES = {
    "prudent": {
        "name": "Prudent",
        "description": "Faible risque, gains modérés. Idéal pour débuter.",
        "strategy": "mean_reversion",
        "stop_loss": -1.5,
        "take_profit": 2.0,
        "max_position": 10.0,
        "max_positions": 3,
    },
    "equilibre": {
        "name": "Équilibré",
        "description": "Risque modéré, bon compromis gains / sécurité.",
        "strategy": "combined",
        "stop_loss": -2.5,
        "take_profit": 4.0,
        "max_position": 20.0,
        "max_positions": 5,
    },
    "dynamique": {
        "name": "Dynamique",
        "description": "Risque élevé, potentiel de gains importants.",
        "strategy": "momentum",
        "stop_loss": -4.0,
        "take_profit": 8.0,
        "max_position": 30.0,
        "max_positions": 7,
    },
}

STRATEGY_EXPLANATIONS = {
    "momentum": {
        "name": "Momentum",
        "short": "Suit la tendance",
        "description": """
**Comment ça marche ?**
Achète les actions qui montent déjà, en pariant que la hausse va continuer.

**Quand l'utiliser ?**
- Marché en tendance claire (hausse ou baisse)
- Actions avec forte dynamique

**Risques :**
- Peut acheter au sommet si la tendance s'inverse
- Sensible aux retournements brutaux
""",
        "risk_level": "Moyen-Élevé",
        "best_for": "Marchés en tendance",
    },
    "mean_reversion": {
        "name": "Mean Reversion",
        "short": "Retour à la moyenne",
        "description": """
**Comment ça marche ?**
Achète quand le prix est anormalement bas, vend quand il est anormalement haut.

**Quand l'utiliser ?**
- Actions stables qui oscillent autour d'une moyenne
- Marchés sans tendance claire

**Risques :**
- Peut acheter une action qui continue de baisser
- Ne fonctionne pas en tendance forte
""",
        "risk_level": "Moyen",
        "best_for": "Actions stables, marchés calmes",
    },
    "breakout": {
        "name": "Breakout",
        "short": "Cassure de niveaux",
        "description": """
**Comment ça marche ?**
Détecte quand le prix casse un niveau important (support / résistance).

**Quand l'utiliser ?**
- Après une période de consolidation
- Avec confirmation par le volume

**Risques :**
- Faux signaux fréquents (fausses cassures)
- Nécessite des stop-loss serrés
""",
        "risk_level": "Élevé",
        "best_for": "Traders actifs",
    },
    "combined": {
        "name": "Combinée",
        "short": "Mix des 3 stratégies",
        "description": """
**Comment ça marche ?**
Combine les 3 stratégies et fait la moyenne des signaux.
N'agit que si plusieurs stratégies sont d'accord.

**Quand l'utiliser ?**
- Configuration par défaut recommandée
- Réduit les faux signaux

**Risques :**
- Peut manquer certaines opportunités
- Signaux plus rares mais plus fiables
""",
        "risk_level": "Moyen",
        "best_for": "Débutants et prudents",
    },
}

PARAM_HELP = {
    "stop_loss": """
**Stop-Loss** — Limite de perte automatique

Si l'action perd ce pourcentage, elle est vendue automatiquement.

*Exemple : -2 % → achat à 100 €, vente auto à 98 €.*
""",
    "take_profit": """
**Take-Profit** — Objectif de gain automatique

Si l'action gagne ce pourcentage, elle est vendue automatiquement.

*Exemple : +3 % → achat à 100 €, vente auto à 103 €.*
""",
    "max_position": """
**Taille max position** — % du capital par trade

*Exemple : 20 % sur 10 000 € = max 2 000 € par action.*
""",
    "max_positions": """
**Max positions ouvertes** — Nombre d'actions en portefeuille simultanément.

*Conseil : 3 à 5 positions pour les débutants.*
""",
}

# --- Session state ---
if "engine" not in st.session_state:
    st.session_state["engine"] = PaperTradingEngine()

if "scheduler" not in st.session_state:
    st.session_state["scheduler"] = TradingScheduler()

engine: PaperTradingEngine = st.session_state["engine"]
scheduler: TradingScheduler = st.session_state["scheduler"]

# ── Sidebar ──────────────────────────────────────────────────
st.sidebar.markdown(
    '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;'
    'letter-spacing:0.16em;color:#c9a84c;padding:0.25rem 0 1rem;">Configuration</div>',
    unsafe_allow_html=True,
)

st.sidebar.markdown("**Profil de risque**")

if "profile_applied" not in st.session_state:
    st.session_state["profile_applied"] = "equilibre"
    st.session_state["custom_stop_loss"] = STRATEGY_PROFILES["equilibre"]["stop_loss"]
    st.session_state["custom_take_profit"] = STRATEGY_PROFILES["equilibre"]["take_profit"]
    st.session_state["custom_max_position"] = STRATEGY_PROFILES["equilibre"]["max_position"]
    st.session_state["custom_max_positions"] = STRATEGY_PROFILES["equilibre"]["max_positions"]
    st.session_state["custom_strategy"] = STRATEGY_PROFILES["equilibre"]["strategy"]

selected_profile = st.sidebar.radio(
    "Profil",
    list(STRATEGY_PROFILES.keys()),
    index=list(STRATEGY_PROFILES.keys()).index(
        st.session_state.get("profile_applied", "equilibre")
    ),
    format_func=lambda p: STRATEGY_PROFILES[p]["name"],
    label_visibility="collapsed",
)

profile_info = STRATEGY_PROFILES[selected_profile]
st.sidebar.caption(profile_info["description"])

if st.sidebar.button("Appliquer ce profil", type="primary", use_container_width=True):
    st.session_state["profile_applied"] = selected_profile
    st.session_state["custom_stop_loss"] = profile_info["stop_loss"]
    st.session_state["custom_take_profit"] = profile_info["take_profit"]
    st.session_state["custom_max_position"] = profile_info["max_position"]
    st.session_state["custom_max_positions"] = profile_info["max_positions"]
    st.session_state["custom_strategy"] = profile_info["strategy"]
    st.rerun()

st.sidebar.markdown("---")
st.sidebar.markdown("**Stratégie**")

strategy = st.sidebar.selectbox(
    "Stratégie",
    STRATEGIES,
    index=STRATEGIES.index(st.session_state.get("custom_strategy", "combined")),
    format_func=lambda s: STRATEGY_EXPLANATIONS[s]["name"],
    label_visibility="collapsed",
)
st.session_state["custom_strategy"] = strategy

strat_info = STRATEGY_EXPLANATIONS[strategy]
with st.sidebar.expander(f"À propos — {strat_info['short']}"):
    st.markdown(strat_info["description"])
    st.markdown(f"**Niveau de risque :** {strat_info['risk_level']}")
    st.markdown(f"**Idéal pour :** {strat_info['best_for']}")

scheduler.set_strategy(strategy)

st.sidebar.markdown("---")
st.sidebar.markdown("**Actions surveillées**")
selected_tickers = st.sidebar.multiselect(
    "Tickers",
    ALL_TICKERS,
    default=DEFAULT_FAVORITES,
    label_visibility="collapsed",
)
scheduler.set_tickers(selected_tickers)

st.sidebar.markdown("---")
st.sidebar.markdown("**Gestion des risques**")

show_advanced = st.sidebar.toggle("Mode avancé", value=False)

if show_advanced:
    with st.sidebar.expander("Stop-Loss"):
        st.markdown(PARAM_HELP["stop_loss"])

    stop_loss = st.sidebar.slider(
        "Stop-Loss (%)",
        -10.0, -0.5,
        st.session_state.get("custom_stop_loss", DEFAULT_STOP_LOSS_PCT),
        0.5,
    )
    st.session_state["custom_stop_loss"] = stop_loss

    with st.sidebar.expander("Take-Profit"):
        st.markdown(PARAM_HELP["take_profit"])

    take_profit = st.sidebar.slider(
        "Take-Profit (%)",
        0.5, 15.0,
        st.session_state.get("custom_take_profit", DEFAULT_TAKE_PROFIT_PCT),
        0.5,
    )
    st.session_state["custom_take_profit"] = take_profit

    ratio = abs(take_profit / stop_loss) if stop_loss != 0 else 0
    ratio_color = GREEN if ratio >= 1.5 else (ORANGE if ratio >= 1 else RED)
    st.sidebar.markdown(
        f'<span style="font-size:0.75rem;color:{TEXT_MUTED};">Ratio gain/risque : </span>'
        f'<span style="font-size:0.8rem;font-weight:600;color:{ratio_color};">{ratio:.1f}×</span>',
        unsafe_allow_html=True,
    )

    with st.sidebar.expander("Taille de position"):
        st.markdown(PARAM_HELP["max_position"])

    max_position = st.sidebar.slider(
        "Taille max position (%)",
        5.0, 50.0,
        st.session_state.get("custom_max_position", DEFAULT_MAX_POSITION_PCT),
        5.0,
    )
    st.session_state["custom_max_position"] = max_position

    with st.sidebar.expander("Max positions"):
        st.markdown(PARAM_HELP["max_positions"])

    max_positions = st.sidebar.slider(
        "Max positions ouvertes",
        1, 10,
        st.session_state.get("custom_max_positions", DEFAULT_MAX_OPEN_POSITIONS),
    )
    st.session_state["custom_max_positions"] = max_positions
else:
    stop_loss = st.session_state.get("custom_stop_loss", DEFAULT_STOP_LOSS_PCT)
    take_profit = st.session_state.get("custom_take_profit", DEFAULT_TAKE_PROFIT_PCT)
    max_position = st.session_state.get("custom_max_position", DEFAULT_MAX_POSITION_PCT)
    max_positions = st.session_state.get("custom_max_positions", DEFAULT_MAX_OPEN_POSITIONS)

    st.sidebar.markdown(
        f"""
        <div style="
            background:#111119;
            border:1px solid rgba(201,168,76,0.15);
            border-radius:3px;
            padding:0.85rem 1rem;
            font-size:0.75rem;
            line-height:1.9;
            color:#9494a6;
        ">
            <span style="color:#5a5a6e;">Stop-Loss</span>&nbsp;&nbsp;
            <span style="color:#f0ede0;font-weight:600;">{stop_loss}%</span><br>
            <span style="color:#5a5a6e;">Take-Profit</span>&nbsp;&nbsp;
            <span style="color:#f0ede0;font-weight:600;">+{take_profit}%</span><br>
            <span style="color:#5a5a6e;">Max / position</span>&nbsp;&nbsp;
            <span style="color:#f0ede0;font-weight:600;">{max_position}%</span><br>
            <span style="color:#5a5a6e;">Max positions</span>&nbsp;&nbsp;
            <span style="color:#f0ede0;font-weight:600;">{max_positions}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

scheduler.risk_manager = RiskManager(
    stop_loss_pct=stop_loss,
    take_profit_pct=take_profit,
    max_position_pct=max_position,
    max_open_positions=max_positions,
)

# ── Page header ───────────────────────────────────────────────
page_header("Trading Automatique", "Paper trading — simulation temps réel")

# ── Market status + controls ──────────────────────────────────
market_status = get_market_status()
sched_status = scheduler.get_status()

status_col, ctrl_col = st.columns([1, 3])

with status_col:
    market_html = status_badge(
        "Marché ouvert" if market_status["is_open"] else "Marché fermé",
        market_status["is_open"],
    )
    trading_html = status_badge(
        "Trading actif" if sched_status["is_running"] else "Trading inactif",
        sched_status["is_running"],
    )
    st.markdown(
        f'<div style="display:flex;flex-direction:column;gap:0.5rem;padding-top:0.35rem;">'
        f"{market_html}{trading_html}</div>",
        unsafe_allow_html=True,
    )

with ctrl_col:
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        if st.button(
            "Démarrer" if not scheduler.is_running else "En cours…",
            type="primary" if not scheduler.is_running else "secondary",
            disabled=scheduler.is_running,
            use_container_width=True,
        ):
            scheduler.start()
            st.success("Trading automatique démarré.")
            st.rerun()
    with c2:
        if st.button("Arrêter", disabled=not scheduler.is_running, use_container_width=True):
            scheduler.stop()
            st.info("Trading automatique arrêté.")
            st.rerun()
    with c3:
        if st.button("Réinitialiser", use_container_width=True):
            scheduler.stop()
            balance = st.session_state.get("reset_balance", DEFAULT_INITIAL_BALANCE)
            engine.reset(balance)
            st.warning("Portefeuille réinitialisé.")
            st.rerun()
    with c4:
        st.number_input(
            "Solde initial (EUR)",
            min_value=100.0,
            value=DEFAULT_INITIAL_BALANCE,
            step=100.0,
            key="reset_balance",
            label_visibility="collapsed",
        )

st.markdown(
    f'<p style="font-size:0.7rem;color:#5a5a6e;margin-top:0.5rem;">'
    f'Stratégie : <span style="color:#9494a6;">{sched_status["strategy"]}</span>'
    f'&ensp;·&ensp;Tickers : <span style="color:#9494a6;">{len(sched_status["tickers"])}</span>'
    f'&ensp;·&ensp;Dernier cycle : <span style="color:#9494a6;">{sched_status["last_run"] or "—"}</span>'
    f'</p>',
    unsafe_allow_html=True,
)

# ── Portfolio summary ─────────────────────────────────────────
section_title("Portefeuille Virtuel")

summary = engine.get_portfolio_summary()
initial = DEFAULT_INITIAL_BALANCE
total_pnl = summary["total_value"] - initial
total_pnl_pct = (total_pnl / initial * 100) if initial > 0 else 0

m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Cash disponible", format_currency(summary["cash"]))
m2.metric("Positions", format_currency(summary["positions_value"]))
m3.metric("Valeur totale", format_currency(summary["total_value"]))
m4.metric("Positions ouvertes", summary["num_positions"])
m5.metric("P&L Total", format_currency(total_pnl), delta=format_percentage(total_pnl_pct))

# ── Open positions ────────────────────────────────────────────
if summary["positions"]:
    section_title("Positions Ouvertes")

    pos_data = []
    for pos in summary["positions"]:
        pos_data.append({
            "Ticker": pos["ticker"],
            "Actions": pos["shares"],
            "Entrée": pos["entry_price"],
            "Cours": pos.get("current_price", 0),
            "Valeur": pos.get("current_value", 0),
            "P&L €": pos.get("pnl", 0),
            "P&L %": pos.get("pnl_pct", 0),
            "Stop-Loss": pos.get("stop_loss"),
            "Take-Profit": pos.get("take_profit"),
        })

    pos_df = pd.DataFrame(pos_data)
    st.dataframe(
        pos_df.style.format({
            "Actions": "{:.2f}",
            "Entrée": "{:.2f}",
            "Cours": "{:.2f}",
            "Valeur": "{:.2f}",
            "P&L €": "{:+.2f}",
            "P&L %": "{:+.2f}%",
            "Stop-Loss": "{:.2f}",
            "Take-Profit": "{:.2f}",
        }).map(
            lambda v: (
                f"color: {GREEN}" if isinstance(v, (int, float)) and v > 0
                else f"color: {RED}" if isinstance(v, (int, float)) and v < 0
                else ""
            ),
            subset=["P&L €", "P&L %"],
        ),
        use_container_width=True,
        hide_index=True,
    )

    section_title("Graphiques des Positions")

    for pos in summary["positions"]:
        pnl_val = pos.get("pnl", 0)
        pnl_color = GREEN if pnl_val >= 0 else RED
        with st.expander(
            f"{pos['ticker']}  ·  P&L {pnl_val:+.2f} €"
        ):
            hist = get_historical_data(pos["ticker"], period="1mo")
            if not hist.empty:
                hist = compute_indicators(hist)
                fig = go.Figure()
                fig.add_trace(candlestick_trace(hist))

                fig.add_hline(
                    y=pos["entry_price"],
                    line_dash="dash",
                    line_color=GOLD,
                    line_width=1,
                    annotation_text=f"Entrée {pos['entry_price']:.2f}",
                    annotation_font=dict(color=GOLD, size=10),
                )
                if pos.get("stop_loss"):
                    fig.add_hline(
                        y=pos["stop_loss"],
                        line_dash="dot",
                        line_color=RED,
                        line_width=1,
                        annotation_text=f"SL {pos['stop_loss']:.2f}",
                        annotation_font=dict(color=RED, size=10),
                    )
                if pos.get("take_profit"):
                    fig.add_hline(
                        y=pos["take_profit"],
                        line_dash="dot",
                        line_color=GREEN,
                        line_width=1,
                        annotation_text=f"TP {pos['take_profit']:.2f}",
                        annotation_font=dict(color=GREEN, size=10),
                    )

                apply_chart_theme(fig, height=340, title=pos["ticker"])
                st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

# ── Performance metrics ───────────────────────────────────────
section_title("Performance")

metrics = engine.get_performance_metrics()

pm1, pm2, pm3, pm4, pm5, pm6 = st.columns(6)
pm1.metric("Trades total", metrics["total_trades"])
pm2.metric("Trades clôturés", metrics.get("closed_trades", 0))
pm3.metric("Win Rate", f"{metrics['win_rate']:.1f}%")
pm4.metric("P&L total", format_currency(metrics["total_pnl"]))
pm5.metric("Max Drawdown", format_currency(metrics["max_drawdown"]))
pm6.metric("Sharpe Ratio", f"{metrics['sharpe_ratio']:.2f}")

# ── Performance curve ─────────────────────────────────────────
section_title("Courbe de Performance")

with get_db() as conn:
    snapshots = conn.execute(
        "SELECT * FROM portfolio_snapshots ORDER BY snapshot_at"
    ).fetchall()

if snapshots and len(snapshots) > 1:
    snap_df = pd.DataFrame([dict(s) for s in snapshots])
    snap_df["snapshot_at"] = pd.to_datetime(snap_df["snapshot_at"])

    fig_perf = go.Figure()
    fig_perf.add_trace(go.Scatter(
        x=snap_df["snapshot_at"],
        y=snap_df["total_value"],
        mode="lines",
        name="Valeur",
        line=dict(color=GOLD, width=2),
        fill="tozeroy",
        fillcolor="rgba(201,168,76,0.06)",
    ))
    fig_perf.add_hline(
        y=DEFAULT_INITIAL_BALANCE,
        line_dash="dash",
        line_color="rgba(201,168,76,0.3)",
        line_width=1,
        annotation_text="Capital initial",
        annotation_font=dict(color=TEXT_MUTED, size=10),
    )
    apply_chart_theme(fig_perf, height=380, title="Évolution de la valeur du portefeuille")
    fig_perf.update_layout(yaxis=dict(side="right"))
    st.plotly_chart(fig_perf, use_container_width=True, config={"displayModeBar": False})
else:
    st.info("La courbe de performance sera disponible après quelques cycles de trading.")

# ── Trade history ─────────────────────────────────────────────
section_title("Historique des Trades")

trades = engine.get_all_trades()
if trades:
    trades_df = pd.DataFrame(trades)
    display_cols = ["executed_at", "ticker", "side", "shares", "price", "total", "strategy", "reason"]
    available_cols = [c for c in display_cols if c in trades_df.columns]
    trades_df = trades_df[available_cols].rename(columns={
        "executed_at": "Date",
        "ticker": "Ticker",
        "side": "Type",
        "shares": "Actions",
        "price": "Prix",
        "total": "Total",
        "strategy": "Stratégie",
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
    st.info("Aucun trade exécuté.")

# ── Logs ──────────────────────────────────────────────────────
section_title("Logs de Trading")

logs = engine.get_logs(limit=30)
if logs:
    log_html = '<div style="background:#111119;border:1px solid rgba(201,168,76,0.12);border-radius:4px;padding:0.75rem 1rem;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;line-height:1.9;max-height:280px;overflow-y:auto;">'
    for log in logs:
        level = log["level"]
        color = {"INFO": TEXT_SECONDARY, "WARNING": ORANGE, "ERROR": RED}.get(level, TEXT_MUTED)
        log_html += (
            f'<div><span style="color:{TEXT_MUTED};">{log["created_at"]}</span>'
            f'&ensp;<span style="color:{color};font-weight:500;">[{level}]</span>'
            f'&ensp;<span style="color:{TEXT_SECONDARY};">{log["message"]}</span></div>'
        )
    log_html += "</div>"
    st.markdown(log_html, unsafe_allow_html=True)
else:
    st.info("Aucun log disponible.")

st.markdown("---")
st.caption(
    "Paper trading — simulation avec argent fictif. "
    "Les résultats passés ne garantissent pas les performances futures."
)
