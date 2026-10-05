"""
config.py

Settings for Squirrel, read from environment variables. A `.env` file next
to this file is loaded first (without overriding variables already set), so
keys can live there instead of being exported in every shell:

    OPENAI_API_KEY=sk-...
    GOOGLE_CLIENT_ID=....apps.googleusercontent.com
    GOOGLE_CLIENT_SECRET=...

Import this module before anything that reads those variables.
"""

import os
from email.utils import parseaddr
from pathlib import Path

ROOT = Path(__file__).parent
INSTANCE_DIR = ROOT / "instance"  # database and encryption key; never commit


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        os.environ.setdefault(key, value.strip().strip("'\""))


_load_dotenv(ROOT / ".env")

HOST, PORT = "127.0.0.1", 8000
APP_URL = os.environ.get("APP_URL", f"http://{HOST}:{PORT}").rstrip("/")
SECURE_COOKIES = APP_URL.startswith("https://")

# Origins allowed to make state-changing requests: the app itself plus the
# Vite dev server, which proxies /api to this server.
ALLOWED_ORIGINS = {APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"}

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = f"{APP_URL}/api/auth/google/callback"
GOOGLE_ENABLED = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

# Outlook / Hotmail / Microsoft 365 (outlook_sync.py). Microsoft only accepts
# plain-http redirect URIs on localhost, so on this computer the callback goes
# to localhost and the server sends the browser on to APP_URL.
MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.environ.get("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_REDIRECT_URI = f"{APP_URL.replace('://127.0.0.1', '://localhost')}/api/auth/microsoft/callback"
MICROSOFT_ENABLED = bool(MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET)

# Outgoing email (password reset links and reminders). Without SMTP_HOST, links are printed
# in the server terminal instead, which is fine for local use only.
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "") or SMTP_USER
# Just the address ("Squirrel Support <a@b.com>" gives "a@b.com"). Inbox scans
# skip email from it, so Squirrel's own reminders aren't read as benefits.
MAIL_FROM_ADDRESS = parseaddr(MAIL_FROM)[1].lower()
EMAIL_ENABLED = bool(SMTP_HOST and MAIL_FROM)
