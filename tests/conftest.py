"""
Shared setup for the server tests (run `python3 -m pytest` in the project folder).

Every test gets its own empty database in a temporary folder, so the real
instance/ is never read or changed. Nothing leaves the computer: email is
captured instead of sent (fixture `sent_emails`), and any attempt to reach
OpenAI, Google, Microsoft or an SMTP server fails the test.
"""

import http.client
import json
import os
import smtplib
import threading
import urllib.request
from http.server import ThreadingHTTPServer
from typing import Optional

import pytest

# Before config.py loads .env (which only fills in what isn't set already):
# switch off real email, AI keys and OAuth, and use a throwaway encryption key.
for _name in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "OPENAI_API_KEY",
              "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET",
              "BENEFITAPP_SECRET_KEY", "APP_URL"):
    os.environ[_name] = ""

import auth  # noqa: E402
import auto_scan  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
import limits  # noqa: E402
import mailer  # noqa: E402
import reminders  # noqa: E402
import scan_jobs  # noqa: E402

assert not config.EMAIL_ENABLED, "tests must never send real email"


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """An empty database and encryption key in a temporary folder, for every test."""
    monkeypatch.setattr(db, "INSTANCE_DIR", tmp_path)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(db, "KEY_PATH", tmp_path / "secret.key")
    monkeypatch.setattr(db, "_fernet", None)
    db.init()
    # In-memory state that would otherwise leak between tests.
    for store in (auth._failed_logins, auth._reset_requests, auth._verify_requests, limits._calls,
                  scan_jobs._jobs, auto_scan._started):
        store.clear()
    yield tmp_path


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Fails any request to the outside world (OpenAI, Google, Microsoft, SMTP)."""
    def blocked(*args, **kwargs):
        raise AssertionError("a test tried to reach the network")
    monkeypatch.setattr(urllib.request, "urlopen", blocked)
    monkeypatch.setattr(smtplib, "SMTP", blocked)
    monkeypatch.setattr(smtplib, "SMTP_SSL", blocked)


@pytest.fixture(autouse=True)
def sent_emails(monkeypatch):
    """Emails the app tried to send, as (to, subject, text), instead of sending them."""
    outbox: list[tuple[str, str, str]] = []
    monkeypatch.setattr(mailer, "send", lambda to, subject, text: outbox.append((to, subject, text)))
    return outbox


def make_user(email: str = "alex@example.com", password: str = "correct horse battery", *,
              verified: bool = True, timezone: Optional[str] = "Asia/Singapore") -> dict:
    """Creates an account; by default with a confirmed address and Singapore time."""
    user = auth.register(email, password, "Alex Tan")
    with db.connect() as conn:
        if verified:
            conn.execute("UPDATE users SET email_verified_at = ? WHERE id = ?", (db.now_iso(), user["id"]))
        if timezone:
            reminders.save_timezone(conn, user["id"], timezone)
    return user


def add_benefit(user_id: str, **data) -> str:
    """Stores a manual benefit with sensible defaults; returns its id."""
    record = {"is_benefit": True, "benefit_name": "Coffee voucher", "provider": "Kopi Co", "type": "voucher",
              "category": "dining", "value": "S$5", "expiry_date": None, "expiry_confidence": "explicit",
              "expiry_reasoning": "", "source_snippet": "", "terms_summary": None, "needs_review": False,
              "review_reason": None, **data}
    benefit_id = db.new_id()
    with db.connect() as conn:
        db.add_benefit(conn, user_id, "manual", f"manual:{benefit_id}", record, benefit_id)
    return benefit_id


@pytest.fixture
def user():
    return make_user()


# ---------------------------------------------------------------------------
# The real web server, on a free port, for the API tests
# ---------------------------------------------------------------------------

class Client:
    """A browser stand-in: keeps the session cookie and sends JSON like the app does."""

    def __init__(self, port: int):
        self.port = port
        self.cookie: Optional[str] = None

    def request(self, method: str, path: str, body=None, headers: Optional[dict] = None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        sent_headers = dict(headers or {})
        payload = None
        if body is not None:
            payload = json.dumps(body).encode()
            sent_headers.setdefault("Content-Type", "application/json")
        if self.cookie:
            sent_headers["Cookie"] = self.cookie
        conn.request(method, path, body=payload, headers=sent_headers)
        resp = conn.getresponse()
        raw = resp.read()
        for value in resp.headers.get_all("Set-Cookie") or []:
            pair = value.split(";", 1)[0]
            if pair.startswith(auth.SESSION_COOKIE + "="):
                self.cookie = pair if pair.split("=", 1)[1] else None
        conn.close()
        try:
            data = json.loads(raw) if raw else None
        except ValueError:
            data = raw
        return resp.status, data

    def get(self, path: str):
        return self.request("GET", path)

    def post(self, path: str, body=None, **kwargs):
        return self.request("POST", path, {} if body is None else body, **kwargs)

    def sign_up(self, email: str, password: str = "correct horse battery") -> dict:
        status, data = self.post("/api/auth/register", {"email": email, "password": password, "name": "Test"})
        assert status == 200, data
        return data["user"]


@pytest.fixture
def server():
    import server as app_server
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), app_server.Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield httpd.server_address[1]
    httpd.shutdown()
    httpd.server_close()


@pytest.fixture
def client(server):
    return Client(server)


@pytest.fixture
def other_client(server):
    return Client(server)
