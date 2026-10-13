"""
capture_demo_data.py

Builds src/demo/data.json for the demo frontend from the real app: runs
demo_seed.py against a throwaway database, then saves what server.py answers
for the demo account. Nothing leaves the computer and instance/ is untouched.

    python3 demo-frontend/capture_demo_data.py
"""

import json
import os
import sys
import tempfile
import threading
import urllib.request
from datetime import date
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

# Before config.py loads .env: no real email, AI or OAuth.
for name in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "OPENAI_API_KEY", "GOOGLE_CLIENT_ID",
             "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "BENEFITAPP_SECRET_KEY",
             "APP_URL"):
    os.environ[name] = ""

import cards  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
import demo_seed  # noqa: E402
import server  # noqa: E402


def main() -> None:
    tmp = Path(tempfile.mkdtemp())
    db.INSTANCE_DIR, db.DB_PATH, db.KEY_PATH = tmp, tmp / "demo.db", tmp / "secret.key"
    demo_seed.main()

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_port}"
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

    def call(path: str, body=None):
        req = urllib.request.Request(base + path, method="POST" if body is not None else "GET",
                                     data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Content-Type": "application/json", "Origin": config.APP_URL})
        with opener.open(req) as res:
            return json.load(res)

    login = call("/api/auth/login", {"email": demo_seed.EMAIL, "password": demo_seed.PASSWORD})
    session = call("/api/session")
    benefits = call("/api/benefits")
    cards_response = call("/api/cards")
    ask_history = call("/api/ask/history")

    # The benefits each catalog card adds, so "Add a card" works in the demo.
    card_benefits = {}
    for key in cards.CATALOG:
        for c in call("/api/cards")["cards"]:
            call(f"/api/cards/{c['id']}/remove", {})
        month = 1 if cards.needs_anniversary(key) else None
        call("/api/cards", {"card_key": key, "anniversary_month": month})
        card_benefits[key] = [b for b in call("/api/benefits") if b["source"] == "card"]

    data = {
        "captured_on": date.today().isoformat(),
        "user": login["user"],
        "gmail": session["gmail"],
        "benefits": benefits,
        "cards": cards_response,
        "card_benefits": card_benefits,
        "ask_history": ask_history,
    }
    httpd.shutdown()
    out = HERE / "src" / "demo" / "data.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    # The demo's sample person is Clayton, not demo_seed.py's Alex.
    text = json.dumps(data, indent=1).replace("Alex Demo", "Clayton Lau").replace("alex.demo", "clayton.demo")
    out.write_text(text.replace("Alex", "Clayton") + "\n")
    print(f"Wrote {out.relative_to(HERE.parent)}: {len(benefits)} benefits, {len(card_benefits)} cards.")


if __name__ == "__main__":
    main()
