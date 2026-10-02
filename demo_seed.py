"""
demo_seed.py

Creates (or resets) a demo account filled with sample data, so you can see
the app as it looks for someone with a scanned Gmail inbox and a credit card:

    /opt/anaconda3/bin/python3 demo_seed.py
    # then sign in at http://127.0.0.1:8000 with the email and password printed

Everything is made up: fictional providers (plus two loyalty programs
"detected" by the real detector), dates relative to today, and a
fake Gmail connection (pressing "Scan inbox" fails safely and disconnects it).
The two assistant answers are hand-written samples, not real AI output.
Run it again at any time to reset the demo; `--delete` removes the account.
"""

import sys
from datetime import date, datetime, timedelta, timezone

import config  # noqa: F401  (loads .env)

import auth
import cards
import db
import loyalty
import reminders

EMAIL = "demo@example.com"
PASSWORD = "demo-benefits-2026"
NAME = "Alex Demo"
GMAIL_ADDRESS = "alex.demo@gmail.com"


def _in(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def _benefit(name, provider, type_, category, value, expiry_days, confidence, reasoning, terms, snippet, subject,
             needs_review=False, review_reason=None, code=None) -> dict:
    return {
        "is_benefit": True,
        "benefit_name": name,
        "provider": provider,
        "type": type_,
        "category": category,
        "value": value,
        "expiry_date": _in(expiry_days) if expiry_days is not None else None,
        "expiry_confidence": confidence,
        "expiry_reasoning": reasoning,
        "terms_summary": terms,
        "code": code,
        "source_snippet": snippet,
        "needs_review": needs_review,
        "review_reason": review_reason,
        "source_label": subject,
    }


GMAIL_BENEFITS = [
    _benefit("Birthday drink voucher", "Harbor Coffee Co.", "voucher", "dining", "$25", 3, "explicit",
             "The email gives an exact expiry date.", "Any drink or pastry, one use, in store only.",
             f"Redeem by {_in(3)}.", "Happy birthday, Alex! A treat on us", code="BDAY-7Q2K"),
    _benefit("$10 off your next 3 rides", "UrbanRide", "voucher", "transport", "$10 off × 3", 6, "explicit",
             "An exact end date is stated.", "Applies automatically to rides under $40.",
             f"Offer ends {_in(6)}.", "We miss you: $10 off your next 3 rides"),
    _benefit("3 free guest passes", "FitLab Gym", "membership", "wellness", "3 passes", 12, "computed",
             "Valid 30 days from the issue date stated in the email.", "Guests must be 18+ and sign a waiver.",
             "Guest passes are valid for 30 days from issue.", "Your quarterly guest passes are here"),
    _benefit("Store credit", "Northwind Books", "voucher", "shopping", "$15", 20, "explicit",
             "The credit's expiry date is given.", "Online or in store; can't be used on gift cards.",
             f"Your $15 credit expires on {_in(20)}.", "You've earned $15 in store credit", code="NWB15-K8RT"),
    _benefit("Annual plan renewal", "StreamBox Premium", "subscription", "entertainment", "$119/year", 27, "explicit",
             "The renewal date is stated; cancel before it to avoid the charge.",
             "Renews automatically; cancel any time before the renewal date.",
             f"Your plan renews on {_in(27)}.", "Your StreamBox Premium plan renews soon"),
    _benefit("Companion fare", "Skyline Airways", "voucher", "travel", "Companion flies for taxes only", 45, "explicit",
             "An exact booking deadline is given.", "Economy only; book by the date, travel within 12 months.",
             f"Book by {_in(45)}.", "Your Skyline companion fare is ready", code="SKYCMP4471"),
    _benefit("20% off your next treatment", "Glow Spa", "voucher", "wellness", "20% off", 70, "explicit",
             "An exact expiry date is stated.", "Weekdays only; not with other offers.",
             f"Valid until {_in(70)}.", "Thanks for visiting Glow Spa", code="GLOW20"),
    _benefit("Free night certificate", "Lumen Hotels", "voucher", "travel", "1 free night", 160, "explicit",
             "The certificate's expiry date is given.", "Standard room, any participating hotel, blackout dates apply.",
             f"Certificate expires {_in(160)}.", "Your free night certificate has arrived"),
    _benefit("Member discount", "Evergreen Outdoor Co-op", "membership", "shopping", "10% off", None, "unknown",
             "You confirmed this benefit has no expiry.", "Lifetime co-op membership; show your card at checkout.",
             "Your lifetime membership includes 10% off.", "Welcome to the Evergreen co-op"),
    # Unclear dates: these land in the review queue.
    _benefit("2-for-1 movie tickets", "CineMax Theatres", "voucher", "entertainment", "2 for 1", None, "ambiguous",
             "Says 'this season' with no dates.", "Standard 2D showings, Monday to Thursday.",
             "Valid this season at participating theatres.", "Bring a friend: 2-for-1 tickets",
             needs_review=True, review_reason="expiry is ambiguous"),
    _benefit("Loyalty points", "Maple Grocery", "membership", "shopping", "2,340 points", None, "ambiguous",
             "Points expire after 12 months without activity, but the last activity date isn't given.",
             "500 points = $5 off at checkout.", "Points expire after 12 months of inactivity.",
             "Your Maple Rewards summary", needs_review=True, review_reason="expiry is ambiguous"),
    _benefit("Annual dental check-up", "BrightSmile Dental Plan", "membership", "wellness", "1 free check-up", None,
             "unknown",
             "The email doesn't say when the benefit resets.", "Includes a clean and X-rays at in-network clinics.",
             "Your plan includes one check-up per plan year.", "Your BrightSmile plan benefits",
             needs_review=True, review_reason="expiry is unknown"),
]

# Typed in by the user on the All Benefits page ("Added by you").
MANUAL_BENEFITS = [
    {"is_benefit": True, "benefit_name": "Gift card", "provider": "Corner Bakery", "type": "voucher",
     "category": "dining", "value": "$30", "expiry_date": _in(46), "expiry_confidence": "explicit",
     "expiry_reasoning": "Added by you.",
     "terms_summary": "Paper card in my wallet.", "source_snippet": "", "needs_review": False, "review_reason": None},
]

# Memberships "spotted" from who emails the user, built by the real detector.
LOYALTY_DETECTIONS = [
    ("marriott_bonvoy", {"subject": "Your fall getaway: save up to 20%", "received_date": _in(-9)},
     {"subject": "Reservation Confirmation #84712", "received_date": _in(-570)}),
    ("delta_skymiles", {"subject": "Your SkyMiles account summary", "received_date": _in(-20)}, None),
]

ASK_SAMPLES = [
    ("What expires this week?",
     "Two benefits expire in the next 7 days: your Harbor Coffee Co. birthday drink voucher ($25) and "
     "UrbanRide's $10 off your next 3 rides. The coffee voucher is the most urgent."),
    ("Which travel perks do I have?",
     "You have a Skyline Airways companion fare (book within the next few weeks) and a Lumen Hotels free "
     "night certificate, which has the most time left. Your card's travel credits are listed under All benefits."),
]


def delete_demo(conn) -> bool:
    return conn.execute("DELETE FROM users WHERE email = ?", (EMAIL,)).rowcount > 0


def main() -> None:
    db.init()
    with db.connect() as conn:
        existed = delete_demo(conn)
    if "--delete" in sys.argv:
        print("Demo account deleted." if existed else "No demo account to delete.")
        return

    user = auth.register(EMAIL, PASSWORD, NAME)
    uid = user["id"]
    now = datetime.now(timezone.utc)
    with db.connect() as conn:
        # Fake connection: the token is not real, so a scan fails and disconnects it.
        conn.execute(
            "INSERT INTO gmail_connections (user_id, email, refresh_token_enc, connected_at, last_sync_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (uid, GMAIL_ADDRESS, db.encrypt("demo-not-a-real-token"),
             (now - timedelta(days=14)).isoformat(timespec="seconds"),
             (now - timedelta(hours=3)).isoformat(timespec="seconds")),
        )
        for i, data in enumerate(GMAIL_BENEFITS):
            db.add_benefit(conn, uid, "gmail", f"gmail:demo{i}", data)
            conn.execute("INSERT INTO processed_emails (user_id, message_id) VALUES (?, ?)", (uid, f"demo{i}"))
        for data in MANUAL_BENEFITS:
            benefit_id = db.new_id()
            db.add_benefit(conn, uid, "manual", f"manual:{benefit_id}", data, benefit_id)
        for key, latest, activity in LOYALTY_DETECTIONS:
            db.add_benefit(conn, uid, "loyalty", f"loyalty:{key}",
                           loyalty.build_record(loyalty.PROGRAMS[key], latest, activity))
        for question, answer in ASK_SAMPLES:
            db.add_ask_history(conn, uid, question, answer)
        # example.com isn't a real inbox: keep reminder emails off.
        reminders.set_enabled(conn, uid, False)
    cards.add_user_card(uid, "amex_platinum", (date.today().month + 4) % 12 + 1)

    print(f"Demo account {'reset' if existed else 'created'}.")
    print(f"  Open http://127.0.0.1:8000 and sign in with {EMAIL} / {PASSWORD}")


if __name__ == "__main__":
    main()
