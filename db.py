"""
db.py

SQLite storage (standard library) for users, sessions, connections and
benefits, plus encryption for stored Google tokens.

Everything lives in instance/: the database and, unless BENEFITAPP_SECRET_KEY
is set, the key that encrypts Gmail refresh tokens and IMAP app passwords.
Losing the key means users have to reconnect their email; nothing else
depends on it.
"""

import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator, Optional

from cryptography.fernet import Fernet

from config import INSTANCE_DIR

DB_PATH = INSTANCE_DIR / "benefitapp.db"
KEY_PATH = INSTANCE_DIR / "secret.key"

SCHEMA = """
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT,
    password_hash TEXT,             -- NULL for Google-only accounts
    google_sub    TEXT UNIQUE,      -- Google's stable account id
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,    -- sha256 of the cookie value; the raw token is never stored
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

-- One-time password reset links. Like sessions, only the token's sha256 is stored.
CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
    state         TEXT PRIMARY KEY,
    purpose       TEXT NOT NULL,    -- 'login' or 'connect'
    user_id       TEXT,             -- set for 'connect'
    code_verifier TEXT NOT NULL,    -- PKCE
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gmail_connections (
    user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email             TEXT NOT NULL,
    refresh_token_enc BLOB NOT NULL,
    connected_at      TEXT NOT NULL,
    last_sync_at      TEXT
);

-- Email accounts read over IMAP (Yahoo, iCloud, AOL, ...) with an app password.
CREATE TABLE IF NOT EXISTS imap_accounts (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email        TEXT NOT NULL COLLATE NOCASE,
    host         TEXT NOT NULL,
    password_enc BLOB NOT NULL,     -- app password, encrypted like Gmail tokens
    connected_at TEXT NOT NULL,
    last_sync_at TEXT,
    UNIQUE (user_id, email)
);

-- Emails already sent to the AI model, so each is read only once. message_id
-- is Gmail's id, or 'imap:<account id>:<uidvalidity>:<uid>'.
CREATE TABLE IF NOT EXISTS processed_emails (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    PRIMARY KEY (user_id, message_id)
);

CREATE TABLE IF NOT EXISTS user_cards (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_key          TEXT NOT NULL,
    anniversary_month INTEGER,
    added_at          TEXT NOT NULL,
    UNIQUE (user_id, card_key)
);

-- data is an ExtractedBenefit (app.py) as JSON. source_ref identifies where a
-- benefit came from ('gmail:<message id>', 'imap:<account>:<uidvalidity>:<uid>',
-- 'card:<card>:<perk>:<period end>' or 'manual:<id>')
-- so the same benefit is never added twice. Dismissed rows are kept so they
-- don't come back on the next scan.
CREATE TABLE IF NOT EXISTS benefits (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source     TEXT NOT NULL,       -- 'gmail', 'imap', 'card' or 'manual' (added by the user)
    source_ref TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'active',  -- 'active' or 'dismissed'
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, source_ref)
);

-- Email reminders (reminders.py). No row means on. days_before and categories
-- are left from account-wide reminder settings, replaced by each benefit's own.
CREATE TABLE IF NOT EXISTS reminder_settings (
    user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled     INTEGER NOT NULL,
    days_before INTEGER NOT NULL,
    categories  TEXT NOT NULL DEFAULT '{}',  -- JSON {category: days before, or "off"}
    timezone    TEXT                         -- IANA name from the browser, e.g. "Asia/Singapore"
);

-- One row per benefit and expiry date already reminded about.
CREATE TABLE IF NOT EXISTS reminders_sent (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    benefit_id  TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    sent_at     TEXT NOT NULL,
    PRIMARY KEY (benefit_id, expiry_date)
);

-- Assistant questions and answers, newest shown first.
CREATE TABLE IF NOT EXISTS ask_history (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ask_history_user ON ask_history (user_id, created_at);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return secrets.token_hex(6)


def init() -> None:
    INSTANCE_DIR.mkdir(mode=0o700, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        _add_columns(conn, "reminder_settings", {"categories": "TEXT NOT NULL DEFAULT '{}'", "timezone": "TEXT"})
        _add_benefit_types(conn)


def _add_columns(conn: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    """Adds columns that a database made by an older version doesn't have yet."""
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    for name, definition in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


# Words that suggest a spending category, checked in this order. Used once, to
# give benefits saved before categories existed a best guess.
_CATEGORY_WORDS = {
    "dining": ["dining", "restaurant", "resy", "coffee", "cafe", "bakery", "drink", "food", "eats", "doordash",
               "grubhub", "dunkin", "pizza", "burger", "meal", "brunch"],
    "transport": ["uber", "lyft", "grab", "gojek", "ride", "taxi", "transit", "parking", "fuel", "petrol"],
    "travel": ["hotel", "airline", "airways", "flight", "fare", "miles", "night", "travel", "resort", "lounge"],
    "entertainment": ["movie", "cinema", "theatre", "stream", "music", "concert", "ticket", "stubhub", "netflix",
                      "spotify", "game"],
    "wellness": ["gym", "fitness", "spa", "dental", "health", "clinic", "yoga", "massage", "pharmacy"],
    "shopping": ["store", "shop", "retail", "gift card", "books", "grocery", "mall", "outdoor"],
}
_CATEGORY_FROM_TYPE = {"travel": "travel", "health": "wellness", "retail": "shopping"}
# Types that were dropped because the categories cover them.
_RETIRED_TYPES = {"travel", "health", "retail"}
_MEMBERSHIP_WORDS = ["points", "miles", "avios", "member", "plan", "rewards"]


def _guess_category(data: dict) -> str:
    text = " ".join(filter(None, [data.get("benefit_name"), data.get("provider"), data.get("terms_summary")])).lower()
    for category, words in _CATEGORY_WORDS.items():
        if any(w in text for w in words):
            return category
    return _CATEGORY_FROM_TYPE.get(data.get("type"), "other")


def _add_benefit_types(conn: sqlite3.Connection) -> None:
    """
    Benefits used to have one "category" (membership, voucher...). That is now
    "type", and "category" is what it's spent on (dining, travel...). Moves the
    old value across and guesses the new one, then turns the dropped types
    (travel, health, retail) into a membership or a voucher. Rows already
    updated are left alone.
    """
    for row in conn.execute("SELECT id, source, data FROM benefits").fetchall():
        data = json.loads(row["data"])
        if "type" in data and data["type"] not in _RETIRED_TYPES:
            continue
        if "type" not in data:
            data["type"] = data.get("category") or "other"
            data["category"] = _guess_category(data)
        if data["type"] in _RETIRED_TYPES:
            name = f"{data.get('benefit_name') or ''} {data.get('provider') or ''}".lower()
            loyalty = row["source"] == "loyalty" or any(w in name for w in _MEMBERSHIP_WORDS)
            data["type"] = "membership" if loyalty else "voucher"
        conn.execute("UPDATE benefits SET data = ? WHERE id = ?", (json.dumps(data), row["id"]))


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """One short-lived connection per unit of work; commits on success, rolls back on error."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Benefits
# ---------------------------------------------------------------------------

def _row_to_record(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "source": row["source"], **json.loads(row["data"])}


def list_benefits(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM benefits WHERE user_id = ? AND status = 'active' ORDER BY created_at, rowid",
        (user_id,),
    )
    return [_row_to_record(r) for r in rows]


def get_benefit(conn: sqlite3.Connection, user_id: str, benefit_id: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT * FROM benefits WHERE id = ? AND user_id = ? AND status = 'active'",
        (benefit_id, user_id),
    ).fetchone()
    return _row_to_record(row) if row else None


def add_benefit(conn: sqlite3.Connection, user_id: str, source: str, source_ref: str, data: dict,
                benefit_id: Optional[str] = None) -> bool:
    """Returns False if a benefit with this source_ref already exists (active or dismissed)."""
    cur = conn.execute(
        "INSERT OR IGNORE INTO benefits (id, user_id, source, source_ref, data, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (benefit_id or new_id(), user_id, source, source_ref, json.dumps(data), now_iso()),
    )
    return cur.rowcount == 1


def update_benefit_data(conn: sqlite3.Connection, user_id: str, benefit_id: str, data: dict) -> None:
    conn.execute(
        "UPDATE benefits SET data = ? WHERE id = ? AND user_id = ?",
        (json.dumps(data), benefit_id, user_id),
    )


def dismiss_benefit(conn: sqlite3.Connection, user_id: str, benefit_id: str) -> bool:
    cur = conn.execute(
        "UPDATE benefits SET status = 'dismissed' WHERE id = ? AND user_id = ? AND status = 'active'",
        (benefit_id, user_id),
    )
    return cur.rowcount == 1


# ---------------------------------------------------------------------------
# Assistant history
# ---------------------------------------------------------------------------

ASK_HISTORY_LIMIT = 50  # older entries are deleted as new ones arrive


def list_ask_history(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, question, answer, created_at FROM ask_history WHERE user_id = ? "
        "ORDER BY created_at DESC, rowid DESC LIMIT ?",
        (user_id, ASK_HISTORY_LIMIT),
    )
    return [dict(r) for r in rows]


def add_ask_history(conn: sqlite3.Connection, user_id: str, question: str, answer: str) -> dict:
    entry = {"id": new_id(), "question": question, "answer": answer, "created_at": now_iso()}
    conn.execute(
        "INSERT INTO ask_history (id, user_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?)",
        (entry["id"], user_id, question, answer, entry["created_at"]),
    )
    conn.execute(
        "DELETE FROM ask_history WHERE user_id = ? AND id NOT IN "
        "(SELECT id FROM ask_history WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)",
        (user_id, user_id, ASK_HISTORY_LIMIT),
    )
    return entry


def clear_ask_history(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("DELETE FROM ask_history WHERE user_id = ?", (user_id,))


# ---------------------------------------------------------------------------
# Token encryption
# ---------------------------------------------------------------------------

_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = os.environ.get("BENEFITAPP_SECRET_KEY", "").encode()
        if not key:
            if not KEY_PATH.exists():
                INSTANCE_DIR.mkdir(mode=0o700, exist_ok=True)
                # O_EXCL: never overwrite a key that appeared in the meantime.
                fd = os.open(KEY_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "wb") as f:
                    f.write(Fernet.generate_key())
            key = KEY_PATH.read_bytes().strip()
        _fernet = Fernet(key)
    return _fernet


def encrypt(value: str) -> bytes:
    return _get_fernet().encrypt(value.encode())


def decrypt(token: bytes) -> str:
    return _get_fernet().decrypt(token).decode()
