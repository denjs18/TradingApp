"""Connexion SQLite et initialisation de la base de donnees."""

import sqlite3
from contextlib import contextmanager

from config import DB_PATH


def get_connection() -> sqlite3.Connection:
    """Retourne une connexion SQLite avec row_factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager pour une connexion SQLite."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Cree toutes les tables si elles n'existent pas."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL UNIQUE,
                name TEXT,
                sector TEXT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS portfolio_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                shares REAL NOT NULL,
                avg_price REAL NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(ticker)
            );

            CREATE TABLE IF NOT EXISTS paper_portfolio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cash_balance REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS paper_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                shares REAL NOT NULL,
                entry_price REAL NOT NULL,
                current_price REAL,
                stop_loss REAL,
                take_profit REAL,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'open'
            );

            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                side TEXT NOT NULL,
                shares REAL NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                strategy TEXT,
                reason TEXT,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trading_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total_value REAL NOT NULL,
                cash REAL NOT NULL,
                positions_value REAL NOT NULL,
                snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS opportunity_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                score REAL NOT NULL,
                technical_score REAL,
                fundamental_score REAL,
                sentiment_score REAL,
                recommendation TEXT,
                entry_price REAL,
                target_price REAL,
                stop_price REAL,
                justification TEXT,
                computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS dca_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                action TEXT NOT NULL,
                reason TEXT,
                short_term_outlook TEXT,
                medium_term_outlook TEXT,
                long_term_outlook TEXT,
                computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)


def get_setting(key: str, default: str = "") -> str:
    """Recupere un parametre de la table settings."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str):
    """Enregistre un parametre dans la table settings."""
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
