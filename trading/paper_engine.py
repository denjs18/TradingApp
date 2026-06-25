"""Moteur de paper trading (simulation)."""

import json
from datetime import datetime
from typing import Optional

from database.db import get_db
from data.market_data import get_current_price
from config import (
    DEFAULT_INITIAL_BALANCE,
    DEFAULT_SPREAD_PCT,
    DEFAULT_MAX_OPEN_POSITIONS,
    DEFAULT_MAX_POSITION_PCT,
)


class PaperTradingEngine:
    """Moteur de paper trading avec portefeuille virtuel."""

    def __init__(self):
        self._ensure_portfolio()

    def _ensure_portfolio(self):
        """Cree le portefeuille paper s'il n'existe pas."""
        with get_db() as conn:
            row = conn.execute("SELECT * FROM paper_portfolio LIMIT 1").fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO paper_portfolio (cash_balance) VALUES (?)",
                    (DEFAULT_INITIAL_BALANCE,),
                )

    def get_cash_balance(self) -> float:
        with get_db() as conn:
            row = conn.execute("SELECT cash_balance FROM paper_portfolio LIMIT 1").fetchone()
            return row["cash_balance"] if row else 0.0

    def set_cash_balance(self, amount: float):
        with get_db() as conn:
            conn.execute(
                "UPDATE paper_portfolio SET cash_balance = ?, updated_at = CURRENT_TIMESTAMP",
                (amount,),
            )

    def get_open_positions(self) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM paper_positions WHERE status = 'open'"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_all_trades(self) -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM trades ORDER BY executed_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_position_for_ticker(self, ticker: str) -> Optional[dict]:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM paper_positions WHERE ticker = ? AND status = 'open'",
                (ticker,),
            ).fetchone()
            return dict(row) if row else None

    def buy(
        self,
        ticker: str,
        shares: Optional[float] = None,
        amount: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        strategy: str = "",
        reason: str = "",
    ) -> dict:
        """Execute un ordre d'achat paper.

        Args:
            ticker: Symbole de l'action
            shares: Nombre d'actions (prioritaire sur amount)
            amount: Montant en EUR a investir
            stop_loss: Prix de stop-loss
            take_profit: Prix de take-profit
            strategy: Nom de la strategie
            reason: Raison de l'achat

        Returns:
            dict avec details de l'execution ou erreur.
        """
        price = get_current_price(ticker)
        if price is None:
            return {"success": False, "error": f"Impossible d'obtenir le prix de {ticker}"}

        # Simuler le spread (prix d'achat legerement plus haut)
        exec_price = price * (1 + DEFAULT_SPREAD_PCT / 100)

        # Calculer le nombre d'actions
        if shares is None and amount is not None:
            shares = amount / exec_price
        elif shares is None:
            return {"success": False, "error": "Specifier shares ou amount"}

        total_cost = shares * exec_price
        cash = self.get_cash_balance()

        # Verifications
        if total_cost > cash:
            return {"success": False, "error": f"Fonds insuffisants ({cash:.2f} EUR disponibles)"}

        # Verifier le nombre max de positions (lire depuis les settings pour respecter le mode)
        open_positions = self.get_open_positions()
        try:
            from database.db import get_db as _gdb
            from config import DEFAULT_MAX_OPEN_POSITIONS as _def_max
            with _gdb() as _conn:
                _row = _conn.execute("SELECT value FROM settings WHERE key = 'max_positions'").fetchone()
                effective_max_positions = int(_row["value"]) if _row else _def_max
        except Exception:
            effective_max_positions = DEFAULT_MAX_OPEN_POSITIONS
        if len(open_positions) >= effective_max_positions:
            return {"success": False, "error": f"Max {effective_max_positions} positions ouvertes"}

        # Verifier la taille max de position (avec tolérance spread pour éviter rejet sur arrondi)
        portfolio_value = self._get_portfolio_value()
        if portfolio_value > 0:
            position_pct = (total_cost / portfolio_value) * 100
            # +0.5% de tolérance pour absorber le spread simulé et les arrondis
            if position_pct > DEFAULT_MAX_POSITION_PCT + 0.5:
                return {
                    "success": False,
                    "error": f"Position trop grande ({position_pct:.1f}% > max {DEFAULT_MAX_POSITION_PCT}%)",
                }

        # Verifier si on a deja une position ouverte
        existing = self.get_position_for_ticker(ticker)
        if existing:
            return {"success": False, "error": f"Position deja ouverte pour {ticker}"}

        # Executer l'achat
        with get_db() as conn:
            # Ouvrir la position
            conn.execute(
                """INSERT INTO paper_positions
                   (ticker, shares, entry_price, current_price, stop_loss, take_profit, status)
                   VALUES (?, ?, ?, ?, ?, ?, 'open')""",
                (ticker, shares, exec_price, price, stop_loss, take_profit),
            )

            # Enregistrer le trade
            conn.execute(
                """INSERT INTO trades (ticker, side, shares, price, total, strategy, reason)
                   VALUES (?, 'buy', ?, ?, ?, ?, ?)""",
                (ticker, shares, exec_price, total_cost, strategy, reason),
            )

            # Mettre a jour le solde
            conn.execute(
                "UPDATE paper_portfolio SET cash_balance = cash_balance - ?, updated_at = CURRENT_TIMESTAMP",
                (total_cost,),
            )

            # Log
            conn.execute(
                "INSERT INTO trading_logs (level, message, details) VALUES (?, ?, ?)",
                ("INFO", f"ACHAT {ticker}: {shares:.2f} actions a {exec_price:.2f} EUR",
                 json.dumps({"strategy": strategy, "reason": reason})),
            )

        return {
            "success": True,
            "ticker": ticker,
            "side": "buy",
            "shares": shares,
            "price": exec_price,
            "total": total_cost,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
        }

    def sell(
        self,
        ticker: str,
        strategy: str = "",
        reason: str = "",
    ) -> dict:
        """Ferme une position paper (vente totale).

        Returns:
            dict avec details de l'execution ou erreur.
        """
        position = self.get_position_for_ticker(ticker)
        if not position:
            return {"success": False, "error": f"Pas de position ouverte pour {ticker}"}

        price = get_current_price(ticker)
        if price is None:
            return {"success": False, "error": f"Impossible d'obtenir le prix de {ticker}"}

        # Simuler le spread (prix de vente legerement plus bas)
        exec_price = price * (1 - DEFAULT_SPREAD_PCT / 100)
        total = position["shares"] * exec_price
        pnl = total - (position["shares"] * position["entry_price"])

        with get_db() as conn:
            # Fermer la position
            conn.execute(
                """UPDATE paper_positions SET status = 'closed', current_price = ?
                   WHERE id = ?""",
                (exec_price, position["id"]),
            )

            # Enregistrer le trade
            conn.execute(
                """INSERT INTO trades (ticker, side, shares, price, total, strategy, reason)
                   VALUES (?, 'sell', ?, ?, ?, ?, ?)""",
                (ticker, position["shares"], exec_price, total, strategy, reason),
            )

            # Mettre a jour le solde
            conn.execute(
                "UPDATE paper_portfolio SET cash_balance = cash_balance + ?, updated_at = CURRENT_TIMESTAMP",
                (total,),
            )

            # Log
            conn.execute(
                "INSERT INTO trading_logs (level, message, details) VALUES (?, ?, ?)",
                ("INFO",
                 f"VENTE {ticker}: {position['shares']:.2f} actions a {exec_price:.2f} EUR (P&L: {pnl:+.2f} EUR)",
                 json.dumps({"strategy": strategy, "reason": reason, "pnl": pnl})),
            )

        return {
            "success": True,
            "ticker": ticker,
            "side": "sell",
            "shares": position["shares"],
            "price": exec_price,
            "total": total,
            "pnl": pnl,
            "entry_price": position["entry_price"],
        }

    def check_stop_loss_take_profit(self) -> list[dict]:
        """Verifie et execute les stop-loss et take-profit.

        Returns:
            Liste des trades executes.
        """
        executed = []
        positions = self.get_open_positions()

        for pos in positions:
            price = get_current_price(pos["ticker"])
            if price is None:
                continue

            # Mettre a jour le prix courant
            with get_db() as conn:
                conn.execute(
                    "UPDATE paper_positions SET current_price = ? WHERE id = ?",
                    (price, pos["id"]),
                )

            # Stop-loss
            if pos["stop_loss"] and price <= pos["stop_loss"]:
                result = self.sell(
                    pos["ticker"],
                    strategy="risk_management",
                    reason=f"Stop-loss atteint ({price:.2f} <= {pos['stop_loss']:.2f})",
                )
                if result["success"]:
                    executed.append(result)
                continue

            # Take-profit
            if pos["take_profit"] and price >= pos["take_profit"]:
                result = self.sell(
                    pos["ticker"],
                    strategy="risk_management",
                    reason=f"Take-profit atteint ({price:.2f} >= {pos['take_profit']:.2f})",
                )
                if result["success"]:
                    executed.append(result)

        return executed

    def _get_portfolio_value(self) -> float:
        """Calcule la valeur totale du portefeuille paper."""
        cash = self.get_cash_balance()
        positions_value = 0.0

        for pos in self.get_open_positions():
            price = pos.get("current_price") or get_current_price(pos["ticker"])
            if price:
                positions_value += pos["shares"] * price

        return cash + positions_value

    def get_portfolio_summary(self) -> dict:
        """Retourne un resume complet du portefeuille paper."""
        cash = self.get_cash_balance()
        positions = self.get_open_positions()

        positions_enriched = []
        positions_value = 0.0

        for pos in positions:
            price = get_current_price(pos["ticker"]) or pos.get("current_price", 0)
            current_value = pos["shares"] * price if price else 0
            invested = pos["shares"] * pos["entry_price"]
            pnl = current_value - invested
            pnl_pct = (pnl / invested * 100) if invested > 0 else 0

            positions_enriched.append({
                **pos,
                "current_price": price,
                "current_value": current_value,
                "invested": invested,
                "pnl": pnl,
                "pnl_pct": pnl_pct,
            })
            positions_value += current_value

        total_value = cash + positions_value

        return {
            "cash": cash,
            "positions": positions_enriched,
            "positions_value": positions_value,
            "total_value": total_value,
            "num_positions": len(positions),
        }

    def get_performance_metrics(self) -> dict:
        """Calcule les metriques de performance."""
        trades = self.get_all_trades()

        if not trades:
            return {
                "total_trades": 0,
                "win_rate": 0.0,
                "total_pnl": 0.0,
                "avg_pnl": 0.0,
                "max_drawdown": 0.0,
                "sharpe_ratio": 0.0,
            }

        # Calculer les P&L des trades fermes
        sells = [t for t in trades if t["side"] == "sell"]
        buys = {t["ticker"]: t for t in trades if t["side"] == "buy"}

        pnls = []
        for sell in sells:
            entry_price = None
            for buy in reversed(trades):
                if buy["side"] == "buy" and buy["ticker"] == sell["ticker"]:
                    entry_price = buy["price"]
                    break
            if entry_price:
                pnl = (sell["price"] - entry_price) * sell["shares"]
                pnls.append(pnl)

        if not pnls:
            return {
                "total_trades": len(trades),
                "win_rate": 0.0,
                "total_pnl": 0.0,
                "avg_pnl": 0.0,
                "max_drawdown": 0.0,
                "sharpe_ratio": 0.0,
            }

        wins = sum(1 for p in pnls if p > 0)
        total_pnl = sum(pnls)
        avg_pnl = total_pnl / len(pnls)
        win_rate = (wins / len(pnls)) * 100

        # Max drawdown simplifie
        cumulative = []
        running = 0
        for p in pnls:
            running += p
            cumulative.append(running)

        peak = cumulative[0]
        max_dd = 0
        for val in cumulative:
            if val > peak:
                peak = val
            dd = peak - val
            if dd > max_dd:
                max_dd = dd

        # Sharpe ratio simplifie (annualise)
        import numpy as np
        if len(pnls) > 1:
            returns = np.array(pnls)
            sharpe = (np.mean(returns) / np.std(returns)) * np.sqrt(252) if np.std(returns) > 0 else 0
        else:
            sharpe = 0.0

        return {
            "total_trades": len(trades),
            "closed_trades": len(pnls),
            "win_rate": win_rate,
            "total_pnl": total_pnl,
            "avg_pnl": avg_pnl,
            "max_drawdown": max_dd,
            "sharpe_ratio": sharpe,
        }

    def save_snapshot(self):
        """Enregistre un snapshot du portefeuille."""
        summary = self.get_portfolio_summary()
        with get_db() as conn:
            conn.execute(
                """INSERT INTO portfolio_snapshots (total_value, cash, positions_value)
                   VALUES (?, ?, ?)""",
                (summary["total_value"], summary["cash"], summary["positions_value"]),
            )

    def get_logs(self, limit: int = 50) -> list[dict]:
        """Retourne les logs de trading."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM trading_logs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def reset(self, initial_balance: float = DEFAULT_INITIAL_BALANCE):
        """Reinitialise le portefeuille paper."""
        with get_db() as conn:
            conn.execute("DELETE FROM paper_positions")
            conn.execute("DELETE FROM trades")
            conn.execute("DELETE FROM trading_logs")
            conn.execute(
                "UPDATE paper_portfolio SET cash_balance = ?, updated_at = CURRENT_TIMESTAMP",
                (initial_balance,),
            )
