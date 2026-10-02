"""
cards.py

Credit card perks. The user picks which cards they hold (no card numbers or
bank connection); each card's recurring credits become benefits whose expiry
is the end of the current reset period, worked out in plain code.

CATALOG is hand-maintained sample data. Issuers change perks often, so every
perk says when the list was last checked, and the UI tells users to confirm
with their issuer. Add or correct cards here.
"""

import sqlite3
from calendar import monthrange
from datetime import date
from typing import Optional

import db
from app import ExtractedBenefit
from dataclasses import asdict

CATALOG_CHECKED = "mid-2025"

# period: monthly | quarterly | semiannual (Jan–Jun, Jul–Dec) | calendar_year
#         | card_year (resets on the account anniversary; needs its month)
CATALOG: dict[str, dict] = {
    "amex_platinum": {
        "name": "American Express Platinum",
        "perks": [
            {"key": "uber_cash", "name": "Uber Cash", "value": "$15 ($35 in December)", "period": "monthly",
             "type": "voucher", "category": "transport",
             "terms": "Add the card to your Uber account; unused Uber Cash doesn't roll over."},
            {"key": "digital_entertainment", "name": "Digital entertainment credit", "value": "$25",
             "period": "monthly", "type": "subscription", "category": "entertainment",
             "terms": "Enrollment required; eligible streaming and news subscriptions only."},
            {"key": "resy", "name": "Resy dining credit", "value": "$100", "period": "quarterly",
             "type": "membership", "category": "dining",
             "terms": "Enrollment required; at eligible US Resy restaurants."},
            {"key": "lululemon", "name": "lululemon credit", "value": "$75", "period": "quarterly",
             "type": "voucher", "category": "shopping",
             "terms": "Enrollment required; US lululemon stores and online."},
            {"key": "hotel", "name": "Hotel credit", "value": "$300", "period": "semiannual",
             "type": "voucher", "category": "travel",
             "terms": "Prepaid Fine Hotels + Resorts or The Hotel Collection bookings through Amex Travel."},
            {"key": "airline_fee", "name": "Airline fee credit", "value": "$200", "period": "calendar_year",
             "type": "voucher", "category": "travel",
             "terms": "Incidental fees on the one airline you select each year."},
            {"key": "clear", "name": "CLEAR Plus credit", "value": "$209", "period": "calendar_year",
             "type": "membership", "category": "travel",
             "terms": "Covers a CLEAR Plus membership charged to the card."},
        ],
    },
    "amex_gold": {
        "name": "American Express Gold",
        "perks": [
            {"key": "uber_cash", "name": "Uber Cash", "value": "$10", "period": "monthly",
             "type": "voucher", "category": "transport",
             "terms": "Add the card to your Uber account; US Uber Eats orders or rides."},
            {"key": "dining", "name": "Dining credit", "value": "$10", "period": "monthly",
             "type": "membership", "category": "dining",
             "terms": "Enrollment required; Grubhub, The Cheesecake Factory, Goldbelly, Wine.com and Five Guys."},
            {"key": "dunkin", "name": "Dunkin' credit", "value": "$7", "period": "monthly",
             "type": "voucher", "category": "dining", "terms": "Enrollment required; US Dunkin' locations."},
            {"key": "resy", "name": "Resy dining credit", "value": "$50", "period": "semiannual",
             "type": "membership", "category": "dining",
             "terms": "Enrollment required; at eligible US Resy restaurants."},
        ],
    },
    "chase_sapphire_reserve": {
        "name": "Chase Sapphire Reserve",
        "perks": [
            {"key": "lyft", "name": "Lyft credit", "value": "$10", "period": "monthly",
             "type": "voucher", "category": "transport", "terms": "In-app Lyft credit; activate in the Lyft app."},
            {"key": "doordash", "name": "DoorDash restaurant promo", "value": "$5", "period": "monthly",
             "type": "voucher", "category": "dining", "terms": "Requires complimentary DashPass activation."},
            {"key": "the_edit", "name": "The Edit hotel credit", "value": "$250", "period": "semiannual",
             "type": "voucher", "category": "travel",
             "terms": "Prepaid 2-night+ stays booked through The Edit by Chase Travel."},
            {"key": "dining", "name": "Exclusive Tables dining credit", "value": "$150", "period": "semiannual",
             "type": "membership", "category": "dining",
             "terms": "At Sapphire Reserve Exclusive Tables restaurants on OpenTable."},
            {"key": "stubhub", "name": "StubHub credit", "value": "$150", "period": "semiannual",
             "type": "voucher", "category": "entertainment",
             "terms": "Activation required; StubHub and viagogo purchases."},
            {"key": "travel", "name": "Annual travel credit", "value": "$300", "period": "card_year",
             "type": "voucher", "category": "travel", "terms": "Applied automatically to travel purchases."},
        ],
    },
    "chase_sapphire_preferred": {
        "name": "Chase Sapphire Preferred",
        "perks": [
            {"key": "hotel", "name": "Chase Travel hotel credit", "value": "$50", "period": "card_year",
             "type": "voucher", "category": "travel", "terms": "Hotel stays booked through Chase Travel."},
        ],
    },
    "capital_one_venture_x": {
        "name": "Capital One Venture X",
        "perks": [
            {"key": "travel", "name": "Capital One Travel credit", "value": "$300", "period": "card_year",
             "type": "voucher", "category": "travel", "terms": "Bookings made through Capital One Travel."},
        ],
    },
}

PERIOD_LABELS = {
    "monthly": "every month",
    "quarterly": "every quarter",
    "semiannual": "every six months (Jan–Jun, Jul–Dec)",
    "calendar_year": "every calendar year",
    "card_year": "on your card anniversary",
}


def needs_anniversary(card_key: str) -> bool:
    return any(p["period"] == "card_year" for p in CATALOG[card_key]["perks"])


def public_catalog() -> dict:
    return {
        "checked": CATALOG_CHECKED,
        "cards": [
            {
                "key": key,
                "name": card["name"],
                "needs_anniversary": needs_anniversary(key),
                "perks": [{"name": p["name"], "value": p["value"], "resets": PERIOD_LABELS[p["period"]]}
                          for p in card["perks"]],
            }
            for key, card in CATALOG.items()
        ],
    }


# ---------------------------------------------------------------------------
# Period maths
# ---------------------------------------------------------------------------

def _month_end(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])


def period_end(period: str, today: date, anniversary_month: Optional[int] = None) -> date:
    """Last day the current period's credit can be used."""
    y, m = today.year, today.month
    if period == "monthly":
        return _month_end(y, m)
    if period == "quarterly":
        return _month_end(y, (m - 1) // 3 * 3 + 3)
    if period == "semiannual":
        return _month_end(y, 6 if m <= 6 else 12)
    if period == "calendar_year":
        return date(y, 12, 31)
    if period == "card_year":
        if not anniversary_month:
            raise ValueError("card_year perks need the anniversary month")
        # The exact anniversary day isn't known, so the period is treated as
        # ending the month before: reminders come early, never late.
        end_month = anniversary_month - 1 or 12
        end = _month_end(y, end_month)
        return end if end >= today else _month_end(y + 1, end_month)
    raise ValueError(f"unknown period {period!r}")


def _perk_benefit(card: dict, perk: dict, end: date) -> dict:
    reasoning = f"Resets {PERIOD_LABELS[perk['period']]}."
    if perk["period"] == "card_year":
        reasoning += " Shown as ending the month before your anniversary month, so you're reminded early."
    benefit = ExtractedBenefit(
        is_benefit=True,
        benefit_name=perk["name"],
        provider=card["name"],
        type=perk["type"],
        category=perk["category"],
        value=perk["value"],
        expiry_date=end.isoformat(),
        expiry_confidence="computed",
        expiry_reasoning=reasoning,
        terms_summary=perk["terms"],
        source_snippet=f"{card['name']} perk list (last checked {CATALOG_CHECKED}; confirm with your issuer).",
    )
    return asdict(benefit)


# ---------------------------------------------------------------------------
# User cards
# ---------------------------------------------------------------------------

def list_user_cards(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, card_key, anniversary_month FROM user_cards WHERE user_id = ? ORDER BY added_at", (user_id,)
    )
    return [{**dict(r), "name": CATALOG[r["card_key"]]["name"]} for r in rows if r["card_key"] in CATALOG]


def add_user_card(user_id: str, card_key: str, anniversary_month: Optional[int]) -> dict:
    if card_key not in CATALOG:
        raise ValueError("Pick a card from the list.")
    if needs_anniversary(card_key):
        if not isinstance(anniversary_month, int) or not 1 <= anniversary_month <= 12:
            raise ValueError("Pick the month you opened the card, so annual credits get the right date.")
    else:
        anniversary_month = None
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM user_cards WHERE user_id = ? AND card_key = ?",
                        (user_id, card_key)).fetchone():
            raise ValueError("You've already added this card.")
        card_id = db.new_id()
        conn.execute(
            "INSERT INTO user_cards (id, user_id, card_key, anniversary_month, added_at) VALUES (?, ?, ?, ?, ?)",
            (card_id, user_id, card_key, anniversary_month, db.now_iso()),
        )
        sync_card_benefits(conn, user_id)
    return {"id": card_id, "card_key": card_key, "anniversary_month": anniversary_month,
            "name": CATALOG[card_key]["name"]}


def remove_user_card(user_id: str, card_id: str) -> bool:
    with db.connect() as conn:
        cur = conn.execute("DELETE FROM user_cards WHERE id = ? AND user_id = ?", (card_id, user_id))
        if cur.rowcount == 0:
            return False
        conn.execute("DELETE FROM benefits WHERE user_id = ? AND source = 'card' AND source_ref LIKE ?",
                     (user_id, f"card:{card_id}:%"))
    return True


def sync_card_benefits(conn: sqlite3.Connection, user_id: str, today: Optional[date] = None) -> None:
    """
    Makes sure each perk has a benefit for its current period, and removes
    benefits for periods that have ended. Cheap; runs whenever benefits are listed.
    """
    today = today or date.today()
    current: set[str] = set()
    for user_card in conn.execute(
        "SELECT id, card_key, anniversary_month FROM user_cards WHERE user_id = ?", (user_id,)
    ).fetchall():
        card = CATALOG.get(user_card["card_key"])
        if card is None:
            continue
        for perk in card["perks"]:
            end = period_end(perk["period"], today, user_card["anniversary_month"])
            ref = f"card:{user_card['id']}:{perk['key']}:{end.isoformat()}"
            current.add(ref)
            db.add_benefit(conn, user_id, "card", ref, _perk_benefit(card, perk, end))

    stale = [r["source_ref"] for r in conn.execute(
        "SELECT source_ref FROM benefits WHERE user_id = ? AND source = 'card'", (user_id,)
    ) if r["source_ref"] not in current]
    conn.executemany("DELETE FROM benefits WHERE user_id = ? AND source_ref = ?",
                     [(user_id, ref) for ref in stale])
