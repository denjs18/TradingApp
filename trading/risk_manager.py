"""Gestion des risques pour le paper trading."""

from data.market_data import get_current_price, get_market_status
from analysis.technical import find_support_resistance, get_technical_summary
from data.market_data import get_historical_data
from config import (
    DEFAULT_STOP_LOSS_PCT,
    DEFAULT_TAKE_PROFIT_PCT,
    DEFAULT_MAX_POSITION_PCT,
    DEFAULT_MAX_OPEN_POSITIONS,
    MARKET_BUFFER_MINUTES,
)


class RiskManager:
    """Gere les risques des trades paper."""

    def __init__(
        self,
        stop_loss_pct: float = DEFAULT_STOP_LOSS_PCT,
        take_profit_pct: float = DEFAULT_TAKE_PROFIT_PCT,
        max_position_pct: float = DEFAULT_MAX_POSITION_PCT,
        max_open_positions: int = DEFAULT_MAX_OPEN_POSITIONS,
    ):
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
        self.max_position_pct = max_position_pct
        self.max_open_positions = max_open_positions

    def can_trade(self) -> dict:
        """Verifie si les conditions de marche permettent de trader.

        Returns:
            dict avec 'allowed' (bool) et 'reason' (str).
        """
        status = get_market_status()

        if not status["is_weekday"]:
            return {"allowed": False, "reason": "Marche ferme (week-end)"}

        if not status["is_open"]:
            return {"allowed": False, "reason": "Marche ferme (hors horaires)"}

        # Buffer debut/fin de seance
        now = status["current_time"]
        market_open = status["market_open"]
        market_close = status["market_close"]

        from datetime import timedelta
        buffer = timedelta(minutes=MARKET_BUFFER_MINUTES)

        if now < market_open + buffer:
            return {
                "allowed": False,
                "reason": f"Buffer debut de seance ({MARKET_BUFFER_MINUTES} min)",
            }

        if now > market_close - buffer:
            return {
                "allowed": False,
                "reason": f"Buffer fin de seance ({MARKET_BUFFER_MINUTES} min)",
            }

        return {"allowed": True, "reason": "OK"}

    def calculate_stop_loss(self, entry_price: float, ticker: str = "") -> float:
        """Calcule le prix de stop-loss.

        Utilise le support technique si disponible, sinon le pourcentage par defaut.
        """
        default_stop = entry_price * (1 + self.stop_loss_pct / 100)

        if ticker:
            try:
                df = get_historical_data(ticker, period="3mo")
                if not df.empty:
                    sr = find_support_resistance(df)
                    if sr["supports"]:
                        technical_stop = sr["supports"][0] * 0.99
                        # Utiliser le plus protecteur des deux
                        return max(technical_stop, default_stop)
            except Exception:
                pass

        return default_stop

    def calculate_take_profit(self, entry_price: float, ticker: str = "") -> float:
        """Calcule le prix de take-profit.

        Utilise la resistance technique si disponible, sinon le pourcentage par defaut.
        """
        default_tp = entry_price * (1 + self.take_profit_pct / 100)

        if ticker:
            try:
                df = get_historical_data(ticker, period="3mo")
                if not df.empty:
                    sr = find_support_resistance(df)
                    if sr["resistances"]:
                        technical_tp = sr["resistances"][0] * 0.99
                        # Utiliser le plus conservateur des deux
                        return min(technical_tp, default_tp)
            except Exception:
                pass

        return default_tp

    def calculate_position_size(
        self,
        portfolio_value: float,
        price: float,
        risk_per_trade_pct: float = 1.0,
    ) -> dict:
        """Calcule la taille optimale de position.

        Methode : % du portefeuille a risquer par trade.

        Returns:
            dict avec shares, amount, position_pct.
        """
        # Montant max de la position
        max_amount = portfolio_value * (self.max_position_pct / 100)

        # Montant base sur le risque par trade
        stop_distance_pct = abs(self.stop_loss_pct)
        if stop_distance_pct > 0:
            risk_amount = portfolio_value * (risk_per_trade_pct / 100)
            amount = risk_amount / (stop_distance_pct / 100)
        else:
            amount = max_amount

        # Limiter au max
        amount = min(amount, max_amount)

        shares = amount / price if price > 0 else 0
        position_pct = (amount / portfolio_value * 100) if portfolio_value > 0 else 0

        return {
            "shares": round(shares, 2),
            "amount": round(amount, 2),
            "position_pct": round(position_pct, 2),
        }

    def validate_trade(
        self,
        ticker: str,
        side: str,
        shares: float,
        price: float,
        portfolio_value: float,
        open_positions: list[dict],
    ) -> dict:
        """Valide un trade avant execution.

        Returns:
            dict avec 'valid' (bool), 'warnings' (list), 'errors' (list).
        """
        errors = []
        warnings = []

        # Verifier si le marche est ouvert
        can_trade = self.can_trade()
        if not can_trade["allowed"]:
            errors.append(can_trade["reason"])

        if side == "buy":
            # Verifier le nombre de positions
            if len(open_positions) >= self.max_open_positions:
                errors.append(
                    f"Nombre max de positions atteint ({self.max_open_positions})"
                )

            # Verifier la taille de position
            total_cost = shares * price
            if portfolio_value > 0:
                position_pct = (total_cost / portfolio_value) * 100
                if position_pct > self.max_position_pct:
                    errors.append(
                        f"Position trop grande ({position_pct:.1f}% > max {self.max_position_pct}%)"
                    )
                elif position_pct > self.max_position_pct * 0.8:
                    warnings.append(
                        f"Position proche du maximum ({position_pct:.1f}%)"
                    )

            # Verifier si on a deja une position
            existing = [p for p in open_positions if p["ticker"] == ticker]
            if existing:
                errors.append(f"Position deja ouverte pour {ticker}")

        # Analyse technique pour warnings
        try:
            df = get_historical_data(ticker, period="1mo")
            if not df.empty:
                tech = get_technical_summary(df)
                if side == "buy" and tech["overall_score"] < -0.3:
                    warnings.append(
                        f"Signal technique defavorable (score: {tech['overall_score']:.2f})"
                    )
                elif side == "sell" and tech["overall_score"] > 0.3:
                    warnings.append(
                        f"Signal technique encore favorable (score: {tech['overall_score']:.2f})"
                    )
        except Exception:
            pass

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }
