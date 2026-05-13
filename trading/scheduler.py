"""Planificateur pour l'execution periodique du trading automatique."""

import json
import threading
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from trading.paper_engine import PaperTradingEngine
from trading.risk_manager import RiskManager
from analysis.strategy import run_strategy, STRATEGY_MAP
from data.market_data import get_market_status
from database.db import get_db
from config import (
    SCHEDULER_INTERVAL_SECONDS,
    MARKET_TIMEZONE,
    DEFAULT_FAVORITES,
    SCORE_BUY_THRESHOLD,
    SCORE_SELL_THRESHOLD,
)


class TradingScheduler:
    """Planificateur de trading automatique."""

    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone=MARKET_TIMEZONE)
        self.engine = PaperTradingEngine()
        self.risk_manager = RiskManager()
        self.is_running = False
        self.strategy_name = "combined"
        self.tickers: list[str] = list(DEFAULT_FAVORITES)
        self._lock = threading.Lock()
        self.last_run: Optional[datetime] = None
        self.last_result: Optional[dict] = None

    def set_strategy(self, strategy_name: str):
        """Change la strategie active."""
        if strategy_name in STRATEGY_MAP:
            self.strategy_name = strategy_name

    def set_tickers(self, tickers: list[str]):
        """Change la liste de tickers a surveiller."""
        self.tickers = list(tickers)

    def start(self):
        """Demarre le trading automatique."""
        if self.is_running:
            return

        self.scheduler.add_job(
            self._trading_cycle,
            trigger=IntervalTrigger(seconds=SCHEDULER_INTERVAL_SECONDS),
            id="trading_cycle",
            replace_existing=True,
        )
        self.scheduler.start()
        self.is_running = True
        self._log("INFO", "Trading automatique demarre")

    def stop(self):
        """Arrete le trading automatique."""
        if not self.is_running:
            return

        self.scheduler.remove_all_jobs()
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            # Re-creer le scheduler pour pouvoir redemarrer
            self.scheduler = BackgroundScheduler(timezone=MARKET_TIMEZONE)
        self.is_running = False
        self._log("INFO", "Trading automatique arrete")

    def pause(self):
        """Met en pause le trading."""
        if self.is_running:
            self.scheduler.pause_job("trading_cycle")
            self._log("INFO", "Trading automatique en pause")

    def resume(self):
        """Reprend le trading apres une pause."""
        if self.is_running:
            self.scheduler.resume_job("trading_cycle")
            self._log("INFO", "Trading automatique repris")

    def _trading_cycle(self):
        """Un cycle de trading : analyse + decisions + execution."""
        with self._lock:
            self.last_run = datetime.now(ZoneInfo(MARKET_TIMEZONE))
            cycle_results = {
                "timestamp": self.last_run.isoformat(),
                "actions": [],
                "checks": [],
            }

            try:
                # Verifier si on peut trader
                can_trade = self.risk_manager.can_trade()
                if not can_trade["allowed"]:
                    cycle_results["skipped"] = can_trade["reason"]
                    self.last_result = cycle_results
                    return

                # 1. Verifier stop-loss / take-profit
                executed_stops = self.engine.check_stop_loss_take_profit()
                for trade in executed_stops:
                    cycle_results["actions"].append({
                        "type": "stop_loss_or_take_profit",
                        "trade": trade,
                    })

                # 2. Analyser chaque ticker
                for ticker in self.tickers:
                    try:
                        result = run_strategy(ticker, self.strategy_name)
                        cycle_results["checks"].append({
                            "ticker": ticker,
                            "signal": result["signal"],
                            "score": result["score"],
                        })

                        # Traiter le signal
                        if result["signal"] == "achat" and result["score"] > SCORE_BUY_THRESHOLD:
                            self._handle_buy_signal(ticker, result, cycle_results)

                        elif result["signal"] == "vente" and result["score"] < SCORE_SELL_THRESHOLD:
                            self._handle_sell_signal(ticker, result, cycle_results)

                    except Exception as e:
                        self._log("ERROR", f"Erreur analyse {ticker}: {e}")

                # 3. Sauvegarder un snapshot
                self.engine.save_snapshot()

            except Exception as e:
                self._log("ERROR", f"Erreur cycle trading: {e}")
                cycle_results["error"] = str(e)

            self.last_result = cycle_results

    def _handle_buy_signal(self, ticker: str, strategy_result: dict, cycle_results: dict):
        """Traite un signal d'achat."""
        # Verifier si on n'a pas deja une position
        if self.engine.get_position_for_ticker(ticker):
            return

        # Calculer la taille de position
        portfolio_value = self.engine._get_portfolio_value()
        from data.market_data import get_current_price
        price = get_current_price(ticker)
        if not price:
            return

        sizing = self.risk_manager.calculate_position_size(portfolio_value, price)

        # Calculer stop-loss et take-profit
        stop_loss = self.risk_manager.calculate_stop_loss(price, ticker)
        take_profit = self.risk_manager.calculate_take_profit(price, ticker)

        # Valider le trade
        open_positions = self.engine.get_open_positions()
        validation = self.risk_manager.validate_trade(
            ticker, "buy", sizing["shares"], price, portfolio_value, open_positions
        )

        if not validation["valid"]:
            self._log(
                "WARNING",
                f"Trade rejete pour {ticker}: {', '.join(validation['errors'])}",
            )
            return

        # Executer l'achat
        result = self.engine.buy(
            ticker=ticker,
            shares=sizing["shares"],
            stop_loss=stop_loss,
            take_profit=take_profit,
            strategy=self.strategy_name,
            reason=strategy_result.get("details", "Signal d'achat"),
        )

        if result["success"]:
            cycle_results["actions"].append({
                "type": "buy",
                "trade": result,
            })
            self._log(
                "INFO",
                f"Achat execute: {ticker} x{sizing['shares']:.2f} a {price:.2f} EUR",
            )

    def _handle_sell_signal(self, ticker: str, strategy_result: dict, cycle_results: dict):
        """Traite un signal de vente."""
        position = self.engine.get_position_for_ticker(ticker)
        if not position:
            return

        result = self.engine.sell(
            ticker=ticker,
            strategy=self.strategy_name,
            reason=strategy_result.get("details", "Signal de vente"),
        )

        if result["success"]:
            cycle_results["actions"].append({
                "type": "sell",
                "trade": result,
            })
            self._log(
                "INFO",
                f"Vente executee: {ticker} P&L: {result.get('pnl', 0):+.2f} EUR",
            )

    def _log(self, level: str, message: str, details: str = ""):
        """Enregistre un log."""
        try:
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO trading_logs (level, message, details) VALUES (?, ?, ?)",
                    (level, message, details),
                )
        except Exception:
            pass

    def get_status(self) -> dict:
        """Retourne l'etat actuel du scheduler."""
        return {
            "is_running": self.is_running,
            "strategy": self.strategy_name,
            "tickers": self.tickers,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_result": self.last_result,
        }
