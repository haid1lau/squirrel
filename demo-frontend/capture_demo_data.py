"""
capture_demo_data.py

Builds src/demo/data.json for the demo frontend from the real app: runs
demo_seed.py and creates the other demo accounts (PERSONAS) in a throwaway
database, then saves what server.py answers for each of them. Nothing leaves the computer and instance/ is untouched.

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

import auth  # noqa: E402
import cards  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
import demo_seed  # noqa: E402
import loyalty  # noqa: E402
import reminders  # noqa: E402
import server  # noqa: E402


B = demo_seed._benefit
_in = demo_seed._in

# The other demo accounts, beside demo_seed.py's Alex. Made up, like demo_seed.py.
PERSONAS = [
    {
        "email": "priya@demo.com", "name": "Priya Nair", "gmail": "priya.demo@gmail.com",
        "cards": [("dbs_altitude", 3)],
        "loyalty": [("singapore_krisflyer", {"subject": "Your KrisFlyer statement", "received_date": _in(-12)},
                     {"subject": "Miles credited for SQ 318", "received_date": _in(-140)})],
        "benefits": [
            B("1-for-1 brunch mains", "Kopi & Toast", "voucher", "dining", "1-for-1", 4, "explicit",
              "The email gives an exact end date.", "Weekends before 2pm, dine-in only.",
              f"Valid till {_in(4)}.", "Brunch is better with a friend", code="KT1FOR1"),
            B("$8 off GrabFood", "Grab", "voucher", "dining", "$8 off", 2, "explicit",
              "An exact expiry date is stated.", "Minimum order $25; one use.",
              f"Use by {_in(2)}.", "Hungry? Here's $8 off", code="GFPRIYA8"),
            B("Free week of classes", "Pulse Yoga", "subscription", "wellness", "7 days free", 10, "computed",
              "7 days from the trial start date in the email.", "Cancel before day 7 to avoid the $159 monthly fee.",
              "Your 7-day trial has started.", "Welcome to Pulse Yoga"),
            B("Birthday movie ticket", "Golden Screen Cinemas", "voucher", "entertainment", "1 free ticket", 18,
              "explicit", "The voucher's expiry date is given.", "Standard 2D seats; book at the counter or app.",
              f"Expires {_in(18)}.", "Happy birthday, Priya! Your free ticket", code="GSC-BDAY-2291"),
            B("Student plan renewal", "Melodia Music", "subscription", "entertainment", "$5.99/month", 21, "explicit",
              "The renewal date is stated.", "Re-verify student status each year.",
              f"Renews on {_in(21)}.", "Your student plan renews soon"),
            B("$10 welcome voucher", "Lumiere Beauty", "voucher", "shopping", "$10", 38, "explicit",
              "An exact expiry date is given.", "Minimum spend $50, in store or online.",
              f"Valid until {_in(38)}.", "Welcome to Lumiere Rewards", code="LUM10WELCOME"),
            B("Free bubble tea upsize", "Chatime Rewards", "membership", "dining", "Free upsize", None, "ambiguous",
              "Says 'for a limited time' with no date.", "Show the app at the counter.",
              "Free upsize for members, for a limited time.", "Members-only treat",
              needs_review=True, review_reason="expiry is ambiguous"),
        ],
        "ask": [("Where can I eat for cheap this week?",
                 "Use the Kopi & Toast 1-for-1 brunch before the weekend ends, and your $8 GrabFood voucher, "
                 "which expires in 2 days.")],
    },
    {
        "email": "marcus@demo.com", "name": "Marcus Tan", "gmail": "marcus.demo@gmail.com",
        "cards": [("chase_sapphire_reserve", 2), ("amex_gold", None)],
        "loyalty": [("hilton_honors", {"subject": "Your Hilton Honors points summary", "received_date": _in(-6)},
                     {"subject": "Thanks for staying at Hilton Tokyo", "received_date": _in(-200)}),
                    ("united_mileageplus", {"subject": "Your MileagePlus statement", "received_date": _in(-15)},
                     None),
                    ("world_of_hyatt", {"subject": "World of Hyatt: your account update", "received_date": _in(-30)},
                     None)],
        "benefits": [
            B("Lounge day pass", "Horizon Lounges", "voucher", "travel", "1 visit", 8, "explicit",
              "The pass's expiry date is given.", "One guest each; valid at any Horizon lounge worldwide.",
              f"Valid until {_in(8)}.", "Your lounge pass is ready", code="HZL-88231"),
            B("Free checked bag", "Pacific Jet", "voucher", "travel", "1 bag", 26, "explicit",
              "Book by the stated date.", "Up to 23 kg on one booking; not for basic fares.",
              f"Book by {_in(26)}.", "A free bag for your next trip", code="PJBAG23"),
            B("Fourth night free", "Azure Resorts", "voucher", "travel", "1 free night", 64, "explicit",
              "An exact booking deadline is stated.", "Stays of 4+ nights; blackout dates apply.",
              f"Book by {_in(64)}.", "Stay longer, pay less"),
            B("$25 car rental credit", "Velo Car Rental", "voucher", "transport", "$25", 15, "explicit",
              "The credit's expiry date is given.", "Rentals of 2+ days at airport locations.",
              f"Use by {_in(15)}.", "$25 off your next rental", code="VELO25"),
            B("Global Entry renewal", "Trusted Traveler Programs", "membership", "travel", "5-year membership", 120,
              "explicit", "The membership's expiry date is stated.", "Renew up to a year before it expires.",
              f"Your membership expires on {_in(120)}.", "Time to renew Global Entry"),
            B("Upgrade certificate", "Pacific Jet", "voucher", "travel", "1 cabin upgrade", None, "ambiguous",
              "Says 'valid for travel in the next season' without dates.", "Subject to availability.",
              "Use it for travel next season.", "Your upgrade certificate",
              needs_review=True, review_reason="expiry is ambiguous"),
        ],
        "ask": [("Which travel credits should I use first?",
                 "Use your Horizon Lounges day pass first: it expires in 8 days. Then your Chase Sapphire Reserve "
                 "travel credit, which resets at the end of your card year.")],
    },
    # A new account: nothing found or connected yet, to show the first steps.
    {"email": "sam@demo.com", "name": "Sam Lee", "gmail": None, "cards": [], "loyalty": [], "benefits": [],
     "ask": []},
]


def seed_persona(p: dict) -> None:
    user = auth.register(p["email"], demo_seed.PASSWORD, p["name"])
    uid = user["id"]
    with db.connect() as conn:
        if p["gmail"]:
            now = db.now_iso()
            conn.execute("INSERT INTO gmail_connections (user_id, email, refresh_token_enc, connected_at, "
                         "last_sync_at) VALUES (?, ?, ?, ?, ?)",
                         (uid, p["gmail"], db.encrypt("demo-not-a-real-token"), now, now))
        for i, data in enumerate(p["benefits"]):
            db.add_benefit(conn, uid, "gmail", f"gmail:{uid}{i}", data)
        for key, latest, activity in p["loyalty"]:
            db.add_benefit(conn, uid, "loyalty", f"loyalty:{key}",
                           loyalty.build_record(loyalty.PROGRAMS[key], latest, activity))
        for question, answer in p["ask"]:
            db.add_ask_history(conn, uid, question, answer)
        reminders.set_enabled(conn, uid, False)
    for key, month in p["cards"]:
        cards.add_user_card(uid, key, month)


def main() -> None:
    tmp = Path(tempfile.mkdtemp())
    db.INSTANCE_DIR, db.DB_PATH, db.KEY_PATH = tmp, tmp / "demo.db", tmp / "secret.key"
    demo_seed.main()
    for p in PERSONAS:
        seed_persona(p)
    auth.register("catalog@example.com", demo_seed.PASSWORD, "Catalog")

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_port}"

    def signed_in(email: str):
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

        def call(path: str, body=None):
            req = urllib.request.Request(base + path, method="POST" if body is not None else "GET",
                                         data=json.dumps(body).encode() if body is not None else None,
                                         headers={"Content-Type": "application/json", "Origin": config.APP_URL})
            with opener.open(req) as res:
                return json.load(res)
        call("/api/auth/login", {"email": email, "password": demo_seed.PASSWORD})
        return call

    def account(email: str, demo_email: str) -> dict:
        call = signed_in(email)
        session = call("/api/session")
        return {"email": demo_email, "user": session["user"], "gmail": session["gmail"],
                "benefits": call("/api/benefits"), "cards": call("/api/cards")["cards"],
                "ask_history": call("/api/ask/history")}

    # The first account is also the one any other email signs in to.
    accounts = [account(demo_seed.EMAIL, "alex@demo.com")] + [account(p["email"], p["email"]) for p in PERSONAS]

    # The benefits each catalog card adds, so "Add a card" works in the demo.
    call = signed_in("catalog@example.com")
    catalog = call("/api/cards")["catalog"]
    card_benefits = {}
    for key in cards.CATALOG:
        for c in call("/api/cards")["cards"]:
            call(f"/api/cards/{c['id']}/remove", {})
        month = 1 if cards.needs_anniversary(key) else None
        call("/api/cards", {"card_key": key, "anniversary_month": month})
        card_benefits[key] = [b for b in call("/api/benefits") if b["source"] == "card"]
    httpd.shutdown()

    data = {"captured_on": date.today().isoformat(), "accounts": accounts, "catalog": catalog,
            "card_benefits": card_benefits}
    out = HERE / "src" / "demo" / "data.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=1) + "\n")
    for a in accounts:
        print(f"  {a['email']}: {a['user']['name']}, {len(a['benefits'])} benefits, {len(a['cards'])} cards")
    print(f"Wrote {out.relative_to(HERE.parent)}, with the perks of {len(card_benefits)} cards.")


if __name__ == "__main__":
    main()
