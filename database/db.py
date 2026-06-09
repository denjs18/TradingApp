"""Connexion base de données — SQLite (local) ou PostgreSQL (Vercel)."""

import os
import sqlite3
from contextlib import contextmanager

DATABASE_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL", "")
USE_POSTGRES = "postgres" in DATABASE_URL.lower() if DATABASE_URL else False

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
else:
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve().parent.parent
    # Sur Vercel, le filesystem est read-only sauf /tmp
    _default_path = BASE_DIR / "trading.db"
    if os.environ.get("VERCEL") or not os.access(str(BASE_DIR), os.W_OK):
        DB_PATH = Path("/tmp") / "trading.db"
    else:
        DB_PATH = _default_path


def _adapt_sql(query: str) -> str:
    """Convertit les placeholders SQLite (?) en PostgreSQL (%s)."""
    return query.replace("?", "%s")


class _Cursor:
    def __init__(self, raw_cursor, use_postgres: bool):
        self._cur = raw_cursor
        self._pg = use_postgres

    def fetchone(self):
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        return [dict(r) for r in self._cur.fetchall()]

    def __iter__(self):
        for row in self._cur:
            yield dict(row)


class _Connection:
    def __init__(self, raw_conn, use_postgres: bool):
        self._conn = raw_conn
        self._pg = use_postgres

    def execute(self, query: str, params=None):
        if self._pg:
            query = _adapt_sql(query)
            cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(query, params or ())
        else:
            cur = self._conn.execute(query, params or ())
        return _Cursor(cur, self._pg)

    def executemany(self, query: str, params_list):
        if self._pg:
            query = _adapt_sql(query)
            cur = self._conn.cursor()
            cur.executemany(query, params_list)
        else:
            self._conn.executemany(query, params_list)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


@contextmanager
def get_db():
    if USE_POSTGRES:
        raw = psycopg2.connect(DATABASE_URL)
        conn = _Connection(raw, use_postgres=True)
    else:
        raw = sqlite3.connect(str(DB_PATH))
        raw.row_factory = sqlite3.Row
        raw.execute("PRAGMA journal_mode=WAL")
        raw.execute("PRAGMA foreign_keys=ON")
        conn = _Connection(raw, use_postgres=False)

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Crée toutes les tables si elles n'existent pas."""
    if USE_POSTGRES:
        _init_postgres()
    else:
        _init_sqlite()


def _init_sqlite():
    with get_db() as conn:
        stmts = """
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
        """
        for stmt in stmts.split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(stmt)


def _init_postgres():
    with get_db() as conn:
        tables = [
            """CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )""",
            """CREATE TABLE IF NOT EXISTS watchlist (
                id SERIAL PRIMARY KEY,
                ticker TEXT NOT NULL UNIQUE,
                name TEXT,
                sector TEXT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS portfolio_positions (
                id SERIAL PRIMARY KEY,
                ticker TEXT NOT NULL UNIQUE,
                shares REAL NOT NULL,
                avg_price REAL NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS paper_portfolio (
                id SERIAL PRIMARY KEY,
                cash_balance REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS paper_positions (
                id SERIAL PRIMARY KEY,
                ticker TEXT NOT NULL,
                shares REAL NOT NULL,
                entry_price REAL NOT NULL,
                current_price REAL,
                stop_loss REAL,
                take_profit REAL,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'open'
            )""",
            """CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                ticker TEXT NOT NULL,
                side TEXT NOT NULL,
                shares REAL NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                strategy TEXT,
                reason TEXT,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS trading_logs (
                id SERIAL PRIMARY KEY,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id SERIAL PRIMARY KEY,
                total_value REAL NOT NULL,
                cash REAL NOT NULL,
                positions_value REAL NOT NULL,
                snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS opportunity_scores (
                id SERIAL PRIMARY KEY,
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
            )""",
            """CREATE TABLE IF NOT EXISTS dca_recommendations (
                id SERIAL PRIMARY KEY,
                ticker TEXT NOT NULL,
                action TEXT NOT NULL,
                reason TEXT,
                short_term_outlook TEXT,
                medium_term_outlook TEXT,
                long_term_outlook TEXT,
                computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
        ]
        for stmt in tables:
            conn.execute(stmt)


def get_setting(key: str, default: str = "") -> str:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str):
    with get_db() as conn:
        if USE_POSTGRES:
            conn.execute(
                """INSERT INTO settings (key, value) VALUES (?, ?)
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
                (key, value),
            )
        else:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )
