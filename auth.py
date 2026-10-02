"""
auth.py

Accounts and sessions: email + password sign-up/sign-in, Google sign-in
accounts, and cookie sessions. Standard library only.

- Passwords are hashed with scrypt and a per-user salt.
- A session cookie holds a random token; only its SHA-256 is stored, so a
  leaked database can't be used to sign in.
- Repeated wrong passwords for one email are throttled in memory.
- Forgotten passwords are reset with a one-time emailed link (1 hour).
  Resetting signs out every other session.
"""

import base64
import hashlib
import hmac
import re
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional

import config
import db

SESSION_COOKIE = "benefitapp_session"
SESSION_DAYS = 30
MIN_PASSWORD_LENGTH = 10

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

RESET_LINK_MINUTES = 60
MAX_RESET_EMAILS = 3  # per email address per hour
_reset_requests: dict[str, list[float]] = defaultdict(list)

MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW_S = 15 * 60
_failed_logins: dict[str, list[float]] = defaultdict(list)
_failed_lock = Lock()


class AuthError(Exception):
    """A sign-in or sign-up problem whose message is safe to show the user."""


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, digest = stored.split("$")
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt),
            n=int(n), r=int(r), p=int(p), dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Checked against when the email doesn't exist, so a wrong email takes as
# long as a wrong password and response times don't reveal who has an account.
_DUMMY_HASH = hash_password(secrets.token_hex(16))


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def public_user(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "has_password": row["password_hash"] is not None,
    }


def _normalize_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise AuthError("Enter a valid email address.")
    return email


def _check_new_password(password: str) -> None:
    if len(password or "") < MIN_PASSWORD_LENGTH:
        raise AuthError(f"Use a password of at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password) > 1024:
        raise AuthError("That password is too long.")


def register(email: str, password: str, name: str = "") -> dict:
    email = _normalize_email(email)
    _check_new_password(password)
    name = (name or "").strip()[:100] or None

    with db.connect() as conn:
        existing = conn.execute("SELECT password_hash FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            if existing["password_hash"] is None:
                raise AuthError("This email already signs in with Google. Use “Continue with Google”.")
            raise AuthError("An account with this email already exists. Sign in instead.")
        user_id = db.new_id()
        conn.execute(
            "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email, name, hash_password(password), db.now_iso()),
        )
        return public_user(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


def _too_many_failures(email: str) -> bool:
    cutoff = time.monotonic() - FAILED_LOGIN_WINDOW_S
    with _failed_lock:
        recent = [t for t in _failed_logins[email] if t > cutoff]
        _failed_logins[email] = recent
        return len(recent) >= MAX_FAILED_LOGINS


def _record_failure(email: str) -> None:
    with _failed_lock:
        _failed_logins[email].append(time.monotonic())


def login(email: str, password: str) -> dict:
    email = _normalize_email(email)
    if _too_many_failures(email):
        raise AuthError("Too many wrong passwords. Wait 15 minutes and try again.")

    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if row is None or row["password_hash"] is None:
        verify_password(password or "", _DUMMY_HASH)
        _record_failure(email)
        if row is not None:
            raise AuthError("This account signs in with Google. Use “Continue with Google”.")
        raise AuthError("Wrong email or password.")
    if not verify_password(password or "", row["password_hash"]):
        _record_failure(email)
        raise AuthError("Wrong email or password.")

    with _failed_lock:
        _failed_logins.pop(email, None)
    return public_user(row)


def find_or_create_google_user(sub: str, email: str, email_verified: bool, name: Optional[str]) -> dict:
    """
    Signs in the account linked to this Google id. If there is none yet, links
    an existing account with the same email (only when Google has verified the
    address), or creates a new Google-only account.
    """
    email = _normalize_email(email)
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
        if row:
            return public_user(row)

        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            if not email_verified:
                raise AuthError("Google hasn't verified this email address, so it can't be linked to your account.")
            conn.execute("UPDATE users SET google_sub = ? WHERE id = ?", (sub, row["id"]))
            user_id = row["id"]
        else:
            user_id = db.new_id()
            conn.execute(
                "INSERT INTO users (id, email, name, google_sub, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, email, (name or "").strip()[:100] or None, sub, db.now_iso()),
            )
        return public_user(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

def _reset_allowed(email: str) -> bool:
    cutoff = time.monotonic() - 3600
    with _failed_lock:
        recent = [t for t in _reset_requests[email] if t > cutoff]
        if len(recent) >= MAX_RESET_EMAILS:
            _reset_requests[email] = recent
            return False
        _reset_requests[email] = recent + [time.monotonic()]
        return True


def create_reset_link(email: str) -> Optional[tuple[str, str]]:
    """
    Returns (address, link) to email for this account, or None when there is
    no such account or too many links were asked for. Callers must answer
    the same either way, so the form doesn't reveal who has an account.
    Works for Google-only accounts too: the link lets them add a password.
    """
    email = _normalize_email(email)
    if not _reset_allowed(email):
        return None
    with db.connect() as conn:
        row = conn.execute("SELECT id, email FROM users WHERE email = ?", (email,)).fetchone()
        if row is None:
            return None
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_LINK_MINUTES)
        conn.execute("DELETE FROM password_resets WHERE expires_at < ?", (db.now_iso(),))
        conn.execute("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                     (_token_hash(token), row["id"], expires.isoformat(timespec="seconds")))
    # The token goes after "#", so it never reaches server logs or other sites.
    return row["email"], f"{config.APP_URL}/reset-password#token={token}"


def reset_password(token: str, password: str) -> dict:
    """Sets a new password from a reset link and signs out every session. Returns the user."""
    _check_new_password(password)
    with db.connect() as conn:
        row = conn.execute(
            "SELECT users.* FROM password_resets JOIN users ON users.id = password_resets.user_id "
            "WHERE password_resets.token_hash = ? AND password_resets.expires_at > ?",
            (_token_hash(token or ""), db.now_iso()),
        ).fetchone()
        if row is None:
            raise AuthError("This reset link has expired or was already used. Ask for a new one.")
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), row["id"]))
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (row["id"],))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
    with _failed_lock:
        _failed_logins.pop(row["email"], None)
    return public_user(row)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    with db.connect() as conn:
        # Opportunistic cleanup, so expired sessions don't pile up.
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (db.now_iso(),))
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), user_id, expires.isoformat(timespec="seconds")),
        )
    return token


def user_for_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    with db.connect() as conn:
        row = conn.execute(
            "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id "
            "WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
            (_token_hash(token), db.now_iso()),
        ).fetchone()
    return public_user(row) if row else None


def end_session(token: Optional[str]) -> None:
    if token:
        with db.connect() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
