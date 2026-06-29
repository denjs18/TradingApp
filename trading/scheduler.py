"""Planificateur pour l'execution periodique du trading automatique."""

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from trading.paper_engine import PaperTradingEngine
from trading.risk_manager import RiskManager
from analysis.strategy import run_strategy, STRATEGY_MAP
from data.market_data import get_market_status, get_current_price
from database.db import get_db
from config import (
    MARKET_TIMEZONE,
    DEFAULT_FAVORITES,
    ALL_PEA_TICKERS,
    TRADING_MODES,
    DEFAULT_TRADING_MODE,
)


def _analyse_ticker(ticker: str, strategy_name: str) -> dict:
    """Analyse un ticker dans un thread séparé."""
    try:
        result = run_strategy(ticker, strategy_name)
        price = get_current_price(ticker)
        return {
            "ticker": ticker,
            "signal": result.get("signal", "neutre"),
            "score": result.get("score", 0.0),
            "price": price,
            "details": result.get("details", ""),
            "error": None,
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "signal": "neutre",
            "score": 0.0,
            "price": None,
            "details": "",
            "error": str(e),
        }


class TradingScheduler:
    """Planificateur de trading automatique avec support multi-mode."""

    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone=MARKET_TIMEZONE)
        self.engine = PaperTradingEngine()
        self.risk_manager = RiskManager()
        self.is_running = False
        self.strategy_name = "combined"
        self._lock = threading.Lock()
        self.last_run: Optional[datetime] = None
        self.last_result: Optional[dict] = None

        # Appliquer le mode par défaut
        self._apply_mode(DEFAULT_TRADING_MODE)

    def _apply_mode(self, mode_name: str):
        """Applique les paramètres d'un mode de trading."""
        mode = TRADING_MODES.get(mode_name, TRADING_MODES[DEFAULT_TRADING_MODE])
        self.current_mode = mode_name
        self.interval_seconds = mode["interval_seconds"]
        self.buy_threshold = mode["buy_threshold"]
        self.sell_threshold = mode["sell_threshold"]
        self.max_positions = mode["max_positions"]
        self.max_position_pct = mode["max_position_pct"]
        self.max_workers = mode["max_workers"]

        count = mode.get("ticker_count")
        if count is None:
            self.tickers = list(ALL_PEA_TICKERS)
        elif count <= len(DEFAULT_FAVORITES):
            self.tickers = list(DEFAULT_FAVORITES)
        else:
            self.tickers = list(ALL_PEA_TICKERS[:count])

    def set_mode(self, mode_name: str) -> bool:
        """Change le mode de trading à la volée."""
        if mode_name not in TRADING_MODES:
            return False
        was_running = self.is_running
        if was_running:
            self.stop()
        self._apply_mode(mode_name)
        self._log("INFO", f"Mode de trading changé: {TRADING_MODES[mode_name]['name']} ({len(self.tickers)} tickers, cycle {self.interval_seconds}s)")
        if was_running:
            self.start()
        return True

    def set_strategy(self, strategy_name: str):
        if strategy_name in STRATEGY_MAP:
            self.strategy_name = strategy_name

    def set_tickers(self, tickers: list):
        self.tickers = list(tickers)

    def start(self):
        if self.is_running:
            return
        self.scheduler.add_job(
            self._trading_cycle,
            trigger=IntervalTrigger(seconds=self.interval_seconds),
            id="trading_cycle",
            replace_existing=True,
        )
        self.scheduler.start()
        self.is_running = True
        mode_info = TRADING_MODES.get(self.current_mode, {})
        self._log("INFO", f"Trading démarré — mode {mode_info.get('name','?')}, {len(self.tickers)} tickers, cycle {self.interval_seconds}s, max {self.max_positions} positions")

    def stop(self):
        if not self.is_running:
            return
        self.scheduler.remove_all_jobs()
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            self.scheduler = BackgroundScheduler(timezone=MARKET_TIMEZONE)
        self.is_running = False
        self._log("INFO", "Trading automatique arrêté")

    def pause(self):
        if self.is_running:
            self.scheduler.pause_job("trading_cycle")

    def resume(self):
        if self.is_running:
            self.scheduler.resume_job("trading_cycle")

    def _trading_cycle(self):
        """Cycle de trading : analyse parallèle + décisions + rotation auto."""
        with self._lock:
            self.last_run = datetime.now(ZoneInfo(MARKET_TIMEZONE))
            cycle_results = {
                "timestamp": self.last_run.isoformat(),
                "mode": self.current_mode,
                "tickers_count": len(self.tickers),
                "actions": [],
                "checks": [],
            }

            try:
                can_trade = self.risk_manager.can_trade()
                if not can_trade["allowed"]:
                    cycle_results["skipped"] = can_trade["reason"]
                    self.last_result = cycle_results
                    return

                # 1. Stop-loss / take-profit
                executed_stops = self.engine.check_stop_loss_take_profit()
                for trade in executed_stops:
                    cycle_results["actions"].append({"type": "stop_loss_or_take_profit", "trade": trade})

                # 2. Analyse parallèle de tous les tickers
                results_map: dict[str, dict] = {}
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    futures = {executor.submit(_analyse_ticker, t, self.strategy_name): t for t in self.tickers}
                    for future in as_completed(futures):
                        res = future.result()
                        results_map[res["ticker"]] = res

                # Trier par score décroissant pour prioriser les meilleurs signaux
                sorted_results = sorted(results_map.values(), key=lambda r: r["score"], reverse=True)

                # Enrichir avec has_position et décision
                open_positions = self.engine.get_open_positions()
                position_tickers = {p["ticker"] for p in open_positions}

                for res in sorted_results:
                    ticker = res["ticker"]
                    has_pos = ticker in position_tickers
                    res["has_position"] = has_pos

                    if res["signal"] == "achat" and res["score"] > self.buy_threshold and not has_pos:
                        # Vérifier si on peut ouvrir une position ou si on doit faire une rotation
                        if len(open_positions) < self.max_positions:
                            action = self._handle_buy_signal(ticker, res, cycle_results, open_positions)
                            if action:
                                open_positions = self.engine.get_open_positions()
                                position_tickers = {p["ticker"] for p in open_positions}
                                res["decision"] = f"✓ ACHAT @ {res['price']:.2f}€" if res["price"] else "✓ ACHAT"
                            else:
                                res["decision"] = "✗ Rejeté"
                        else:
                            # Auto-rotation : vendre la position la plus faible si ce signal est meilleur
                            rotated = self._try_rotate(ticker, res, cycle_results, open_positions, results_map)
                            if rotated:
                                open_positions = self.engine.get_open_positions()
                                position_tickers = {p["ticker"] for p in open_positions}
                                res["decision"] = f"⟳ ROTATION"
                            else:
                                res["decision"] = "Max positions"
                    elif res["signal"] == "vente" and res["score"] < self.sell_threshold and has_pos:
                        self._handle_sell_signal(ticker, res, cycle_results)
                        position_tickers.discard(ticker)
                        open_positions = [p for p in open_positions if p["ticker"] != ticker]
                        res["decision"] = f"✓ VENTE"
                    else:
                        res["decision"] = ""

                    cycle_results["checks"].append({
                        "ticker": ticker,
                        "signal": res["signal"],
                        "score": res["score"],
                        "price": res["price"],
                        "has_position": res["has_position"],
                        "decision": res.get("decision", ""),
                        "details": res["details"],
                        "error": res["error"],
                    })

                # 3. Snapshot
                self.engine.save_snapshot()

            except Exception as e:
                self._log("ERROR", f"Erreur cycle trading: {e}")
                cycle_results["error"] = str(e)

            self.last_result = cycle_results

    def _try_rotate(self, ticker: str, signal: dict, cycle_results: dict, open_positions: list, results_map: dict) -> bool:
        """
        Auto-rotation : si max positions atteint et un signal fort arrive,
        vendre la position avec le score le plus bas si le nouveau signal est meilleur.
        """
        if not open_positions:
            return False

        # Trouver la position avec le score courant le plus bas.
        # Le nouveau signal doit être meilleur d'au moins ROTATION_SCORE_MARGIN (anti-churn).
        from config import ROTATION_SCORE_MARGIN
        worst_pos = None
        worst_score = signal["score"] - ROTATION_SCORE_MARGIN
        for pos in open_positions:
            pos_ticker = pos["ticker"]
            pos_result = results_map.get(pos_ticker)
            if pos_result and pos_result["score"] < worst_score:
                worst_score = pos_result["score"]
                worst_pos = pos

        if worst_pos is None:
            return False  # Aucune position n'est moins bonne que ce signal

        # Vendre la pire position
        sell_result = self.engine.sell(
            ticker=worst_pos["ticker"],
            strategy=self.strategy_name,
            reason=f"Rotation vers {ticker} (score {signal['score']:+.2f})",
        )
        if sell_result.get("success"):
            cycle_results["actions"].append({"type": "sell", "trade": sell_result, "reason": "rotation"})
            self._log("INFO", f"Rotation: vente {worst_pos['ticker']} (score {worst_score:+.2f}) → achat {ticker} (score {signal['score']:+.2f})")
            # Puis acheter le nouveau ticker
            return self._handle_buy_signal(ticker, signal, cycle_results, self.engine.get_open_positions())
        return False

    def _handle_buy_signal(self, ticker: str, signal: dict, cycle_results: dict, open_positions: list) -> bool:
        if self.engine.get_position_for_ticker(ticker):
            return False
        price = signal.get("price") or get_current_price(ticker)
        if not price:
            return False

        portfolio_value = self.engine._get_portfolio_value()
        sizing = self.risk_manager.calculate_position_size(portfolio_value, price)
        stop_loss = self.risk_manager.calculate_stop_loss(price, ticker)
        take_profit = self.risk_manager.calculate_take_profit(price, ticker)

        validation = self.risk_manager.validate_trade(
            ticker, "buy", sizing["shares"], price, portfolio_value, open_positions
        )
        if not validation["valid"]:
            return False

        result = self.engine.buy(
            ticker=ticker,
            shares=sizing["shares"],
            stop_loss=stop_loss,
            take_profit=take_profit,
            strategy=self.strategy_name,
            reason=signal.get("details", "Signal d'achat"),
        )
        if result.get("success"):
            cycle_results["actions"].append({"type": "buy", "ticker": ticker, "price": price, "shares": sizing["shares"], "trade": result})
            self._log("INFO", f"Achat: {ticker} x{sizing['shares']:.2f} @ {price:.2f}€ (score {signal['score']:+.2f})")
            return True
        return False

    def _handle_sell_signal(self, ticker: str, signal: dict, cycle_results: dict):
        position = self.engine.get_position_for_ticker(ticker)
        if not position:
            return
        result = self.engine.sell(
            ticker=ticker,
            strategy=self.strategy_name,
            reason=signal.get("details", "Signal de vente"),
        )
        if result.get("success"):
            cycle_results["actions"].append({"type": "sell", "ticker": ticker, "trade": result})
            self._log("INFO", f"Vente: {ticker} P&L: {result.get('pnl', 0):+.2f}€")

    def _log(self, level: str, message: str, details: str = ""):
        try:
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO trading_logs (level, message, details) VALUES (?, ?, ?)",
                    (level, message, details),
                )
        except Exception:
            pass

    def get_status(self) -> dict:
        mode_info = TRADING_MODES.get(self.current_mode, {})
        return {
            "is_running": self.is_running,
            "mode": self.current_mode,
            "mode_name": mode_info.get("name", "?"),
            "mode_description": mode_info.get("description", ""),
            "strategy": self.strategy_name,
            "tickers": self.tickers,
            "tickers_count": len(self.tickers),
            "interval_seconds": self.interval_seconds,
            "buy_threshold": self.buy_threshold,
            "sell_threshold": self.sell_threshold,
            "max_positions": self.max_positions,
            "max_workers": self.max_workers,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_result": self.last_result,
        }
