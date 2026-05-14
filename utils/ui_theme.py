"""UI theme utilities — premium dark/gold trading aesthetic."""

import streamlit as st
import plotly.graph_objects as go

# --- Color tokens ---
GOLD = "#c9a84c"
GOLD_LIGHT = "#e0bd6e"
GOLD_MUTED = "rgba(201,168,76,0.10)"
GOLD_BORDER = "rgba(201,168,76,0.22)"
BG_BASE = "#0b0b10"
BG_SURFACE = "#111119"
BG_SURFACE2 = "#18181f"
BG_SURFACE3 = "#1e1e28"
TEXT_PRIMARY = "#f0ede0"
TEXT_SECONDARY = "#9494a6"
TEXT_MUTED = "#5a5a6e"
GREEN = "#3d9e6e"
RED = "#c84848"
ORANGE = "#d4834a"

_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700&display=swap');

/* ── Base ──────────────────────────────────────────────────── */
html, body, .stApp {
    background-color: #0b0b10 !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    color: #f0ede0 !important;
}

.main .block-container {
    padding-top: 2.25rem !important;
    padding-bottom: 3rem !important;
    max-width: 1440px !important;
}

/* ── Sidebar ───────────────────────────────────────────────── */
section[data-testid="stSidebar"] {
    background-color: #0d0d14 !important;
    border-right: 1px solid rgba(201,168,76,0.15) !important;
}

section[data-testid="stSidebar"] .block-container {
    padding-top: 1.5rem !important;
}

section[data-testid="stSidebar"] h2 {
    font-size: 0.62rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.14em !important;
    color: #5a5a6e !important;
    font-weight: 600 !important;
    margin-bottom: 0.6rem !important;
    border: none !important;
    padding: 0 !important;
}

section[data-testid="stSidebar"] h3 {
    font-size: 0.62rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.14em !important;
    color: #5a5a6e !important;
    font-weight: 600 !important;
    margin-top: 1.2rem !important;
    margin-bottom: 0.4rem !important;
    border: none !important;
    padding: 0 !important;
}

section[data-testid="stSidebar"] hr {
    border-color: rgba(201,168,76,0.12) !important;
    margin: 1rem 0 !important;
}

/* ── Top-level Navigation (sidebar page links) ─────────────── */
[data-testid="stSidebarNav"] {
    background: transparent !important;
    padding-top: 0.5rem !important;
}

[data-testid="stSidebarNav"] ul {
    padding: 0 !important;
}

[data-testid="stSidebarNav"] li a {
    color: #9494a6 !important;
    font-size: 0.8rem !important;
    font-weight: 400 !important;
    letter-spacing: 0.02em !important;
    border-radius: 3px !important;
    padding: 0.4rem 0.75rem !important;
    transition: all 0.15s !important;
    text-decoration: none !important;
    display: block !important;
}

[data-testid="stSidebarNav"] li a:hover,
[data-testid="stSidebarNav"] li a[aria-current] {
    color: #c9a84c !important;
    background: rgba(201,168,76,0.08) !important;
}

/* ── Headings ──────────────────────────────────────────────── */
h1 {
    font-size: 1.45rem !important;
    font-weight: 600 !important;
    color: #f0ede0 !important;
    letter-spacing: -0.02em !important;
    border-bottom: 1px solid rgba(201,168,76,0.2) !important;
    padding-bottom: 0.8rem !important;
    margin-bottom: 1.75rem !important;
    line-height: 1.2 !important;
}

h1::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 1.2em;
    background: #c9a84c;
    margin-right: 0.65rem;
    vertical-align: middle;
    border-radius: 2px;
}

h2 {
    font-size: 0.7rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.12em !important;
    color: #c9a84c !important;
    margin-top: 2rem !important;
    margin-bottom: 1rem !important;
    border: none !important;
    padding: 0 !important;
}

h3 {
    font-size: 0.95rem !important;
    font-weight: 500 !important;
    color: #f0ede0 !important;
    letter-spacing: -0.01em !important;
}

h4 {
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    color: #9494a6 !important;
    margin-bottom: 0.5rem !important;
}

/* ── Metric Cards ──────────────────────────────────────────── */
div[data-testid="metric-container"] {
    background: #111119 !important;
    border: 1px solid rgba(201,168,76,0.18) !important;
    border-top: 2px solid #c9a84c !important;
    border-radius: 4px !important;
    padding: 1.1rem 1.25rem !important;
    transition: border-color 0.2s !important;
}

div[data-testid="metric-container"]:hover {
    border-color: rgba(201,168,76,0.4) !important;
    border-top-color: #e0bd6e !important;
}

label[data-testid="stMetricLabel"] > div {
    font-size: 0.65rem !important;
    text-transform: uppercase !important;
    letter-spacing: 0.12em !important;
    color: #5a5a6e !important;
    font-weight: 600 !important;
}

div[data-testid="stMetricValue"] > div {
    font-size: 1.5rem !important;
    font-weight: 600 !important;
    color: #f0ede0 !important;
    letter-spacing: -0.02em !important;
    line-height: 1.1 !important;
}

div[data-testid="stMetricDelta"] {
    font-size: 0.75rem !important;
    font-weight: 500 !important;
}

/* ── Buttons ───────────────────────────────────────────────── */
.stButton > button {
    background: transparent !important;
    border: 1px solid rgba(201,168,76,0.3) !important;
    color: #c9a84c !important;
    border-radius: 3px !important;
    font-size: 0.72rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    padding: 0.45rem 1.1rem !important;
    transition: all 0.15s ease !important;
    font-family: 'Inter', sans-serif !important;
}

.stButton > button:hover {
    background: rgba(201,168,76,0.1) !important;
    border-color: #c9a84c !important;
    color: #e0bd6e !important;
}

.stButton > button[kind="primary"] {
    background: #c9a84c !important;
    color: #0b0b10 !important;
    border-color: #c9a84c !important;
    font-weight: 700 !important;
}

.stButton > button[kind="primary"]:hover {
    background: #e0bd6e !important;
    border-color: #e0bd6e !important;
}

.stButton > button:disabled {
    opacity: 0.35 !important;
    cursor: not-allowed !important;
}

/* ── Form Inputs ───────────────────────────────────────────── */
div[data-baseweb="select"] > div,
div[data-baseweb="input"] > div,
div[data-baseweb="textarea"] > div {
    background: #18181f !important;
    border-color: rgba(201,168,76,0.2) !important;
    border-radius: 3px !important;
}

div[data-baseweb="select"]:focus-within > div,
div[data-baseweb="input"]:focus-within > div {
    border-color: #c9a84c !important;
}

input, textarea {
    color: #f0ede0 !important;
    background: #18181f !important;
}

div[data-baseweb="tag"] {
    background: rgba(201,168,76,0.15) !important;
    border: 1px solid rgba(201,168,76,0.3) !important;
    border-radius: 2px !important;
}

/* ── Sliders ───────────────────────────────────────────────── */
div[data-testid="stSlider"] > div > div > div > div[role="slider"] {
    background: #c9a84c !important;
    border-color: #c9a84c !important;
}

div[data-testid="stSlider"] > div > div > div > div:first-child {
    background: rgba(201,168,76,0.25) !important;
}

/* ── Radio & Checkbox ──────────────────────────────────────── */
div[data-testid="stRadio"] label {
    font-size: 0.82rem !important;
    color: #9494a6 !important;
}

div[data-testid="stRadio"] label:has(input:checked) {
    color: #c9a84c !important;
}

/* ── Toggle ────────────────────────────────────────────────── */
div[data-testid="stToggle"] p {
    font-size: 0.8rem !important;
    color: #9494a6 !important;
}

/* ── Expanders ─────────────────────────────────────────────── */
details[data-testid="stExpander"] {
    background: #111119 !important;
    border: 1px solid rgba(201,168,76,0.15) !important;
    border-radius: 4px !important;
    margin-bottom: 0.5rem !important;
    overflow: hidden !important;
}

details[data-testid="stExpander"] summary {
    background: #111119 !important;
    color: #9494a6 !important;
    font-size: 0.8rem !important;
    font-weight: 500 !important;
    padding: 0.7rem 1rem !important;
    cursor: pointer !important;
    letter-spacing: 0.02em !important;
    border-radius: 4px !important;
    transition: color 0.15s !important;
}

details[data-testid="stExpander"] summary:hover {
    color: #c9a84c !important;
    background: rgba(201,168,76,0.05) !important;
}

details[data-testid="stExpander"][open] summary {
    color: #c9a84c !important;
    border-bottom: 1px solid rgba(201,168,76,0.12) !important;
    border-radius: 4px 4px 0 0 !important;
}

details[data-testid="stExpander"] > div {
    background: #111119 !important;
    padding: 0.5rem 0.25rem !important;
}

/* ── Alert / Info / Success / Warning / Error ─────────────── */
div[data-testid="stAlert"] {
    border-radius: 3px !important;
    background: #111119 !important;
    border: 1px solid rgba(201,168,76,0.12) !important;
    font-size: 0.82rem !important;
}

div[data-testid="stAlert"][kind="info"],
div.stInfo {
    border-left: 3px solid #c9a84c !important;
}

div[data-testid="stAlert"][kind="success"],
div.stSuccess {
    border-left: 3px solid #3d9e6e !important;
    background: rgba(61,158,110,0.06) !important;
}

div[data-testid="stAlert"][kind="warning"],
div.stWarning {
    border-left: 3px solid #d4834a !important;
    background: rgba(212,131,74,0.06) !important;
}

div[data-testid="stAlert"][kind="error"],
div.stError {
    border-left: 3px solid #c84848 !important;
    background: rgba(200,72,72,0.06) !important;
}

/* ── DataFrames ────────────────────────────────────────────── */
div[data-testid="stDataFrame"],
div[data-testid="stDataFrameResizable"] {
    border: 1px solid rgba(201,168,76,0.15) !important;
    border-radius: 4px !important;
    overflow: hidden !important;
}

/* ── Progress bar ──────────────────────────────────────────── */
div[data-testid="stProgressBar"] > div > div {
    background: linear-gradient(90deg, #c9a84c, #e0bd6e) !important;
}

div[data-testid="stProgressBar"] > div {
    background: rgba(201,168,76,0.12) !important;
    border-radius: 2px !important;
}

/* ── Divider ───────────────────────────────────────────────── */
hr {
    border: none !important;
    border-top: 1px solid rgba(201,168,76,0.15) !important;
    margin: 1.75rem 0 !important;
}

/* ── Caption ───────────────────────────────────────────────── */
div[data-testid="stCaptionContainer"] p,
.stCaption {
    font-size: 0.7rem !important;
    color: #5a5a6e !important;
    letter-spacing: 0.02em !important;
}

/* ── Page link ─────────────────────────────────────────────── */
a[data-testid="stPageLink-NavLink"] {
    background: #111119 !important;
    border: 1px solid rgba(201,168,76,0.2) !important;
    border-radius: 3px !important;
    color: #c9a84c !important;
    font-size: 0.72rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    padding: 0.4rem 1rem !important;
    text-decoration: none !important;
    display: inline-block !important;
    transition: all 0.15s !important;
}

a[data-testid="stPageLink-NavLink"]:hover {
    background: rgba(201,168,76,0.1) !important;
    border-color: #c9a84c !important;
}

/* ── Scrollbar ─────────────────────────────────────────────── */
::-webkit-scrollbar {
    width: 5px;
    height: 5px;
}
::-webkit-scrollbar-track {
    background: #0b0b10;
}
::-webkit-scrollbar-thumb {
    background: rgba(201,168,76,0.2);
    border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(201,168,76,0.4);
}

/* ── Tooltip ───────────────────────────────────────────────── */
div[data-testid="tooltipHoverTarget"] {
    color: #5a5a6e !important;
}

/* ── Number input ──────────────────────────────────────────── */
div[data-testid="stNumberInput"] input {
    background: #18181f !important;
    border-color: rgba(201,168,76,0.2) !important;
    color: #f0ede0 !important;
    border-radius: 3px !important;
}

/* ── Text ──────────────────────────────────────────────────── */
p {
    color: #9494a6 !important;
    font-size: 0.85rem !important;
    line-height: 1.65 !important;
}

strong {
    color: #f0ede0 !important;
    font-weight: 600 !important;
}

/* ── Multiselect tags ──────────────────────────────────────── */
span[data-baseweb="tag"] {
    background: rgba(201,168,76,0.12) !important;
    border: 1px solid rgba(201,168,76,0.25) !important;
    border-radius: 2px !important;
}

span[data-baseweb="tag"] span {
    color: #c9a84c !important;
    font-size: 0.72rem !important;
}
</style>
"""


def inject_css() -> None:
    """Inject the global trading UI theme CSS into the current page."""
    st.markdown(_CSS, unsafe_allow_html=True)


def apply_chart_theme(
    fig: go.Figure,
    height: int = 420,
    title: str = "",
    show_rangeslider: bool = False,
) -> go.Figure:
    """Apply the dark/gold trading theme to a Plotly figure."""
    fig.update_layout(
        height=height,
        title=dict(
            text=title,
            font=dict(size=11, color="#9494a6", family="Inter, sans-serif"),
            x=0,
            xanchor="left",
            pad=dict(l=0, b=12),
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#111119",
        font=dict(
            family="Inter, -apple-system, sans-serif",
            color="#9494a6",
            size=11,
        ),
        margin=dict(l=0, r=0, t=36 if title else 12, b=0),
        xaxis=dict(
            gridcolor="rgba(201,168,76,0.07)",
            zerolinecolor="rgba(201,168,76,0.12)",
            tickfont=dict(size=10, color="#5a5a6e"),
            showline=False,
            rangeslider=dict(visible=show_rangeslider),
        ),
        yaxis=dict(
            gridcolor="rgba(201,168,76,0.07)",
            zerolinecolor="rgba(201,168,76,0.12)",
            tickfont=dict(size=10, color="#5a5a6e"),
            showline=False,
            side="right",
        ),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            bordercolor="rgba(201,168,76,0.15)",
            borderwidth=1,
            font=dict(size=10, color="#9494a6"),
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="left",
            x=0,
        ),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#18181f",
            bordercolor="rgba(201,168,76,0.3)",
            font=dict(size=11, color="#f0ede0", family="Inter, sans-serif"),
        ),
    )
    return fig


def candlestick_trace(
    df,
    name: str = "Prix",
    increasing_color: str = GREEN,
    decreasing_color: str = RED,
) -> go.Candlestick:
    """Return a styled candlestick trace."""
    return go.Candlestick(
        x=df.index,
        open=df["Open"],
        high=df["High"],
        low=df["Low"],
        close=df["Close"],
        name=name,
        increasing=dict(
            line=dict(color=increasing_color, width=1),
            fillcolor=increasing_color,
        ),
        decreasing=dict(
            line=dict(color=decreasing_color, width=1),
            fillcolor=decreasing_color,
        ),
    )


def sma_trace(df, col: str, name: str, color: str, width: int = 1) -> go.Scatter:
    """Return a styled SMA/EMA line trace."""
    return go.Scatter(
        x=df.index,
        y=df[col],
        mode="lines",
        name=name,
        line=dict(color=color, width=width),
        opacity=0.8,
    )


def page_header(title: str, subtitle: str = "") -> None:
    """Render a styled page header (replaces st.title)."""
    sub_html = f'<p style="color:#5a5a6e;font-size:0.78rem;margin:0.3rem 0 0;letter-spacing:0.02em;">{subtitle}</p>' if subtitle else ""
    st.markdown(
        f"""
        <div style="
            border-bottom: 1px solid rgba(201,168,76,0.2);
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        ">
            <h1 style="
                font-size:1.45rem;
                font-weight:600;
                color:#f0ede0;
                letter-spacing:-0.02em;
                margin:0;
                display:flex;
                align-items:center;
                gap:0.65rem;
                border:none;
                padding:0;
            ">
                <span style="
                    display:inline-block;
                    width:3px;
                    height:1.2em;
                    background:#c9a84c;
                    border-radius:2px;
                    flex-shrink:0;
                "></span>
                {title}
            </h1>
            {sub_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def section_title(label: str) -> None:
    """Render a styled section divider label."""
    st.markdown(
        f"""
        <div style="
            display:flex;
            align-items:center;
            gap:0.75rem;
            margin: 2rem 0 1rem;
        ">
            <span style="
                font-size:0.62rem;
                font-weight:700;
                text-transform:uppercase;
                letter-spacing:0.14em;
                color:#c9a84c;
            ">{label}</span>
            <div style="
                flex:1;
                height:1px;
                background:rgba(201,168,76,0.15);
            "></div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def status_badge(label: str, active: bool) -> str:
    """Return HTML for an inline status badge."""
    color = GREEN if active else "#5a5a6e"
    dot = "●"
    return (
        f'<span style="'
        f'display:inline-flex;align-items:center;gap:0.35rem;'
        f'font-size:0.72rem;font-weight:500;color:{color};'
        f'background:{"rgba(61,158,110,0.1)" if active else "rgba(90,90,110,0.1)"};'
        f'border:1px solid {"rgba(61,158,110,0.25)" if active else "rgba(90,90,110,0.2)"};'
        f'border-radius:2px;padding:0.2rem 0.6rem;letter-spacing:0.05em;'
        f'">{dot} {label}</span>'
    )
