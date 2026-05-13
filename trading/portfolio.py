"""Gestion du portefeuille DCA (positions reelles)."""

from database.db import get_db
from data.market_data import get_current_price, get_multiple_prices


def get_all_positions() -> list[dict]:
    """Retourne toutes les positions du portefeuille DCA."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portfolio_positions ORDER BY ticker"
        ).fetchall()
        return [dict(r) for r in rows]


def add_position(ticker: str, shares: float, avg_price: float):
    """Ajoute ou met a jour une position."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT * FROM portfolio_positions WHERE ticker = ?", (ticker,)
        ).fetchone()

        if existing:
            # Calculer le nouveau PRU
            old_shares = existing["shares"]
            old_avg = existing["avg_price"]
            total_cost = (old_shares * old_avg) + (shares * avg_price)
            new_shares = old_shares + shares
            new_avg = total_cost / new_shares if new_shares > 0 else 0

            conn.execute(
                """UPDATE portfolio_positions
                   SET shares = ?, avg_price = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE ticker = ?""",
                (new_shares, new_avg, ticker),
            )
        else:
            conn.execute(
                """INSERT INTO portfolio_positions (ticker, shares, avg_price)
                   VALUES (?, ?, ?)""",
                (ticker, shares, avg_price),
            )


def update_position(ticker: str, shares: float, avg_price: float):
    """Met a jour une position existante (ecrase les valeurs)."""
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO portfolio_positions (ticker, shares, avg_price, updated_at)
               VALUES (?, ?, ?, CURRENT_TIMESTAMP)""",
            (ticker, shares, avg_price),
        )


def remove_position(ticker: str):
    """Supprime une position du portefeuille."""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM portfolio_positions WHERE ticker = ?", (ticker,)
        )


def get_portfolio_summary() -> dict:
    """Calcule un resume du portefeuille avec valeurs actuelles.

    Returns:
        dict avec positions enrichies, totaux, performance.
    """
    positions = get_all_positions()
    if not positions:
        return {
            "positions": [],
            "total_invested": 0.0,
            "total_current_value": 0.0,
            "total_pnl": 0.0,
            "total_pnl_pct": 0.0,
        }

    tickers = [p["ticker"] for p in positions]
    prices = get_multiple_prices(tickers)

    enriched = []
    total_invested = 0.0
    total_current = 0.0

    for pos in positions:
        ticker = pos["ticker"]
        current_price = prices.get(ticker)
        invested = pos["shares"] * pos["avg_price"]
        current_value = pos["shares"] * current_price if current_price else None
        pnl = (current_value - invested) if current_value is not None else None
        pnl_pct = (pnl / invested * 100) if pnl is not None and invested > 0 else None

        enriched.append({
            **pos,
            "current_price": current_price,
            "invested": invested,
            "current_value": current_value,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
        })

        total_invested += invested
        if current_value is not None:
            total_current += current_value

    total_pnl = total_current - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    return {
        "positions": enriched,
        "total_invested": total_invested,
        "total_current_value": total_current,
        "total_pnl": total_pnl,
        "total_pnl_pct": total_pnl_pct,
    }


def get_sector_allocation(positions: list[dict]) -> dict[str, float]:
    """Calcule l'allocation sectorielle du portefeuille."""
    from config import SECTORS

    # Creer un mapping ticker -> secteur
    ticker_to_sector = {}
    for sector, tickers in SECTORS.items():
        for t in tickers:
            ticker_to_sector[t] = sector

    allocation = {}
    total = sum(p.get("current_value", 0) or 0 for p in positions)

    if total <= 0:
        return allocation

    for pos in positions:
        sector = ticker_to_sector.get(pos["ticker"], "Autre")
        value = pos.get("current_value", 0) or 0
        allocation[sector] = allocation.get(sector, 0) + (value / total * 100)

    return allocation


def save_portfolio_snapshot():
    """Enregistre un snapshot de la valeur du portefeuille."""
    summary = get_portfolio_summary()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO portfolio_snapshots (total_value, cash, positions_value)
               VALUES (?, 0, ?)""",
            (summary["total_current_value"], summary["total_current_value"]),
        )


def get_portfolio_history() -> list[dict]:
    """Retourne l'historique des snapshots du portefeuille."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portfolio_snapshots ORDER BY snapshot_at"
        ).fetchall()
        return [dict(r) for r in rows]
