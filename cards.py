"""
cards.py

Credit card perks. The user picks which cards they hold (no card numbers or
bank connection); each card's recurring credits become benefits whose expiry
is the end of the current reset period, worked out in plain code.

Each card has:
- perks: things that reset on a schedule (credits, lounge visits, a free
  night). These become benefits with reminders.
- features: what the card always gives (cashback and miles rates, caps,
  fees). Shown for reference only: nothing to expire or remind about.

CATALOG is hand-maintained. Issuers change perks often, so every card says
when it was last checked, and the UI tells users to confirm with their
issuer. Add or correct cards here.
"""

import sqlite3
from calendar import monthrange
from datetime import date
from typing import Optional

import db
import reminders
from app import ExtractedBenefit
from dataclasses import asdict

CATALOG_CHECKED = "October 2026"  # the US cards, against each issuer's own card page
SG_CHECKED = "October 2026"  # the Singapore cards, against each issuer's own pages
COUNTRIES = {"SG": "Singapore", "US": "United States"}  # dropdown groups, in this order

# period: monthly | quarterly | semiannual (Jan–Jun, Jul–Dec) | calendar_year
#         | card_year (resets on the account anniversary; needs its month)
CATALOG: dict[str, dict] = {
    "amex_platinum": {
        "country": "US",
        "name": "American Express Platinum",
        "perks": [
            {"key": "uber_cash", "name": "Uber Cash", "value": "$15 ($35 in December)", "period": "monthly",
             "type": "voucher", "category": "transport",
             "terms": "Add the card to your Uber account; unused Uber Cash doesn't roll over."},
            {"key": "uber_one", "name": "Uber One credit", "value": "$120", "period": "calendar_year",
             "type": "subscription", "category": "transport",
             "terms": "An auto-renewing Uber One membership paid with the card."},
            {"key": "walmart_plus", "name": "Walmart+ credit", "value": "$12.95 plus tax", "period": "monthly",
             "type": "subscription", "category": "shopping",
             "terms": "A monthly Walmart+ membership paid with the card."},
            {"key": "digital_entertainment", "name": "Digital entertainment credit", "value": "$25",
             "period": "monthly", "type": "subscription", "category": "entertainment",
             "terms": "Enrollment required; Disney+, Hulu, ESPN streaming, Peacock, Paramount+, YouTube Premium "
                      "and TV, The New York Times and The Wall Street Journal."},
            {"key": "resy", "name": "Resy dining credit", "value": "$100", "period": "quarterly",
             "type": "membership", "category": "dining",
             "terms": "Enrollment required; at eligible US Resy restaurants."},
            {"key": "lululemon", "name": "lululemon credit", "value": "$75", "period": "quarterly",
             "type": "voucher", "category": "shopping",
             "terms": "Enrollment required; US lululemon stores and online."},
            {"key": "hotel", "name": "Hotel credit", "value": "$300", "period": "semiannual",
             "type": "voucher", "category": "travel",
             "terms": "Prepaid Fine Hotels + Resorts or The Hotel Collection (2 nights or more) bookings "
                      "through Amex Travel."},
            {"key": "airline_fee", "name": "Airline fee credit", "value": "$200", "period": "calendar_year",
             "type": "voucher", "category": "travel",
             "terms": "Incidental fees on the one airline you select each year."},
            {"key": "clear", "name": "CLEAR+ credit", "value": "$219", "period": "calendar_year",
             "type": "membership", "category": "travel",
             "terms": "An auto-renewing CLEAR+ membership charged to the card."},
        ],
    },
    "amex_gold": {
        "country": "US",
        "name": "American Express Gold",
        "perks": [
            {"key": "uber_cash", "name": "Uber Cash", "value": "$10", "period": "monthly",
             "type": "voucher", "category": "transport",
             "terms": "Add the card to your Uber account; US Uber Eats orders or rides."},
            {"key": "dining", "name": "Dining credit", "value": "$10", "period": "monthly",
             "type": "membership", "category": "dining",
             "terms": "Enrollment required; Grubhub (and Seamless), Buffalo Wild Wings, Five Guys, "
                      "The Cheesecake Factory and Wonder."},
            {"key": "dunkin", "name": "Dunkin' credit", "value": "$7", "period": "monthly",
             "type": "voucher", "category": "dining", "terms": "Enrollment required; US Dunkin' locations."},
            {"key": "resy", "name": "Resy dining credit", "value": "$50", "period": "semiannual",
             "type": "membership", "category": "dining",
             "terms": "Enrollment required; at eligible US Resy restaurants."},
        ],
    },
    "chase_sapphire_reserve": {
        "country": "US",
        "name": "Chase Sapphire Reserve",
        "perks": [
            {"key": "lyft", "name": "Lyft credit", "value": "$10", "period": "monthly",
             "type": "voucher", "category": "transport",
             "terms": "Add the card to the Lyft app and pay for rides with it; through Sep 2027."},
            {"key": "doordash", "name": "DoorDash promos", "value": "$25 ($5 restaurant + two $10 other orders)",
             "period": "monthly", "type": "voucher", "category": "dining",
             "terms": "Activate the complimentary DashPass and pay with the card; unused promos don't roll over."},
            {"key": "peloton", "name": "Peloton membership credit", "value": "$10", "period": "monthly",
             "type": "subscription", "category": "wellness",
             "terms": "Activation required; a Peloton membership paid with the card, through 2027."},
            {"key": "the_edit", "name": "The Edit hotel credit", "value": "$500 (up to $250 a stay)",
             "period": "calendar_year", "type": "voucher", "category": "travel",
             "terms": "Prepaid stays of 2 nights or more booked through The Edit by Chase Travel."},
            {"key": "dining", "name": "Exclusive Tables dining credit", "value": "$150", "period": "semiannual",
             "type": "membership", "category": "dining",
             "terms": "At Sapphire Reserve Exclusive Tables restaurants on OpenTable."},
            {"key": "stubhub", "name": "StubHub credit", "value": "$150", "period": "semiannual",
             "type": "voucher", "category": "entertainment",
             "terms": "Activation required; StubHub and viagogo purchases, through 2027."},
            {"key": "travel", "name": "Annual travel credit", "value": "$300", "period": "card_year",
             "type": "voucher", "category": "travel", "terms": "Applied automatically to travel purchases."},
        ],
    },
    "chase_sapphire_preferred": {
        "country": "US",
        "name": "Chase Sapphire Preferred",
        "perks": [
            {"key": "hotel", "name": "Chase Travel hotel credit", "value": "$100", "period": "card_year",
             "type": "voucher", "category": "travel", "terms": "Hotel stays booked through Chase Travel."},
            {"key": "doordash", "name": "DoorDash non-restaurant promo", "value": "$10", "period": "monthly",
             "type": "voucher", "category": "shopping",
             "terms": "Activate the complimentary DashPass; one grocery, retail or other non-restaurant order, "
                      "through 2027."},
        ],
    },
    "capital_one_venture_x": {
        "country": "US",
        "name": "Capital One Venture X",
        "perks": [
            {"key": "travel", "name": "Capital One Travel credit", "value": "$300", "period": "card_year",
             "type": "voucher", "category": "travel",
             "terms": "Applied at checkout on Capital One Travel bookings (no miles on the credited amount)."},
        ],
    },
}

# Singapore: 20 of the most popular cards (cashback, rewards and miles) as
# ranked by Singapore comparison sites in 2026. Rates and caps are from each
# issuer's own pages, checked SG_CHECKED.
def _lounge(visits: int, period: str, terms: str) -> dict:
    return {"key": "lounge", "name": "Airport lounge visits", "value": f"{visits} visits", "period": period,
            "type": "membership", "category": "travel", "terms": terms}


CATALOG.update({
    "uob_one": {
        "country": "SG", "checked": SG_CHECKED, "name": "UOB One Card",
        "features": [
            "Up to 3.33% cashback: S$60, S$100 or S$200 a quarter for spending at least S$600, S$1,000 or "
            "S$2,000 every month of the quarter, with at least 10 transactions each statement month",
            "Extra cashback at Grab, McDonald's, Shopee and SimplyGo, on groceries at the higher tiers, and 1% "
            "on SP utilities bills; extra cashback capped at S$120 a month",
            "Annual fee S$196.20, first year waived",
        ],
        "perks": [],
    },
    "dbs_live_fresh": {
        "country": "SG", "checked": SG_CHECKED, "name": "DBS Live Fresh Card",
        "features": [
            "Up to 6% cashback on shopping, transport and in-store overseas spend with at least S$800 spend in "
            "the month; bonus capped at S$120 per calendar month",
            "0.3% cashback on all other spend",
        ],
        "perks": [],
    },
    "citi_cash_back": {
        "country": "SG", "checked": SG_CHECKED, "name": "Citi Cash Back Card",
        "features": [
            "8% cashback on petrol (worldwide) and private commute; 6% on dining and groceries (worldwide), "
            "with at least S$800 spend in a statement month",
            "0.2% on other spend; total cashback capped at S$80 per statement month",
            "Annual fee S$196.20",
        ],
        "perks": [],
    },
    "citi_cash_back_plus": {
        "country": "SG", "checked": SG_CHECKED, "name": "Citi Cash Back+ Card",
        "features": [
            "1.6% cashback on spend, with no minimum spend and no cap",
            "Extra 0.4% for Citi Plus customers, capped at S$8 per calendar month",
        ],
        "perks": [],
    },
    "ocbc_365": {
        "country": "SG", "checked": SG_CHECKED, "name": "OCBC 365 Credit Card",
        "features": [
            "6% cashback on petrol; 5% on dining and food delivery; 3% on groceries, land transport, Watsons, "
            "streaming, EV charging and utilities/telco (rates until 31 Oct 2026)",
            "Needs S$800 spend per calendar month; cashback capped at S$80 a month (S$160 with S$1,600 spend); "
            "0.25% if the minimum isn't met",
            "Annual fee S$196.20, waived for the first two years, then waived with S$10,000 spend a year",
        ],
        "perks": [],
    },
    "ocbc_frank": {
        "country": "SG", "checked": SG_CHECKED, "name": "OCBC FRANK Credit Card",
        "features": [
            "8% cashback on foreign currency spend and on online and mobile contactless spend in SGD, with at "
            "least S$800 spend a month; 0.3% otherwise",
            "Extra 2% at selected green merchants",
            "Capped at S$25 per cashback category, S$100 a month",
            "Annual fee S$196.20, waived for the first two years, then waived with S$10,000 spend a year",
        ],
        "perks": [],
    },
    "uob_absolute_cashback": {
        "country": "SG", "checked": SG_CHECKED, "name": "UOB Absolute Cashback Card",
        "features": [
            "1.7% cashback with no minimum spend and no cap",
            "0.3% on spend that other cards often exclude: charity, education, healthcare, professional "
            "services, utilities and Grab top-ups",
            "An American Express card, so not accepted everywhere",
            "Annual fee S$196.20, first year waived",
        ],
        "perks": [],
    },
    "uob_evol": {
        "country": "SG", "checked": SG_CHECKED, "name": "UOB EVOL Card",
        "features": [
            "10% cashback on local online and mobile contactless spend, and on selected gym, telco and "
            "streaming spend, with at least S$800 per statement month; 0.3% otherwise",
            "Capped at S$80 per statement month (S$30 online and contactless, S$20 gym, telco and streaming, "
            "S$30 other spend)",
            "1% cashback on overseas foreign currency spend (0.5% in China and Europe) until 31 Dec 2026",
            "No annual fee from 1 July 2026",
        ],
        "perks": [],
    },
    "uob_ladys": {
        "country": "SG", "checked": SG_CHECKED, "name": "UOB Lady's Card",
        "features": [
            "4 miles per S$1 (10X UNI$) on your chosen rewards category, with no minimum spend",
            "Up to 10 miles per S$1 on that category when you also save with a UOB Lady's Savings Account",
            "Bonus capped at S$1,000 spend per category a month",
            "Annual fee S$196.20, first year waived",
        ],
        "perks": [],
    },
    "maybank_family_friends": {
        "country": "SG", "checked": SG_CHECKED, "name": "Maybank Family & Friends Card",
        "features": [
            "Choose 5 of 10 cashback categories, such as groceries, dining, transport, streaming, retail and "
            "pets, entertainment, online fashion, and pharmacy and wellness",
            "6% cashback with S$800 spend in a calendar month (up to S$20 per category), or 8% with S$1,600 "
            "(up to S$30 per category)",
        ],
        "perks": [],
    },
    "sc_simply_cash": {
        "country": "SG", "checked": SG_CHECKED, "name": "Standard Chartered Simply Cash Credit Card",
        "features": [
            "1.5% cashback on eligible spend, with no minimum spend and no cap",
            "Annual fee S$196.20, first year waived",
        ],
        "perks": [],
    },
    "hsbc_revolution": {
        "country": "SG", "checked": SG_CHECKED, "name": "HSBC Revolution Credit Card",
        "features": [
            "Up to 4 miles per S$1 (10X points) on selected online and contactless spend in travel, retail, "
            "dining and transport; 1X on other spend",
            "Bonus capped at 9,000 points per calendar month (22,800 with S$50,000 deposits at HSBC)",
            "No annual fee",
        ],
        "perks": [],
    },
    "citi_rewards": {
        "country": "SG", "checked": SG_CHECKED, "name": "Citi Rewards Card",
        "features": [
            "4 miles per S$1 (10X points) on eligible online purchases and on in-store shopping for clothes, "
            "bags, shoes and at department stores",
            "Bonus capped at 9,000 points per statement month",
            "Annual fee S$196.20",
        ],
        "perks": [],
    },
    "dbs_womans_world": {
        "country": "SG", "checked": SG_CHECKED, "name": "DBS Woman's World Card",
        "features": [
            "4 miles per S$1 (10X DBS Points) on online spend, up to S$2,000 per calendar month",
            "Annual fee S$196.20; the waiver for S$25,000 yearly spend ended on 1 August 2026",
        ],
        "perks": [],
    },
    "citi_premiermiles": {
        "country": "SG", "checked": SG_CHECKED, "name": "Citi PremierMiles Card",
        "features": [
            "1.2 miles per S$1 on local spend, 2.2 miles per S$1 on foreign currency spend",
            "Citi Miles don't expire while the card is open",
            "Annual fee S$196.20; 10,000 bonus miles when you pay it at renewal",
        ],
        "perks": [
            _lounge(2, "calendar_year", "Principal cardmember only, through Priority Pass."),
        ],
    },
    "dbs_altitude": {
        "country": "SG", "checked": SG_CHECKED, "name": "DBS Altitude Visa Signature Card",
        "features": [
            "Up to 1.3 miles per S$1 on local spend, up to 2.2 miles per S$1 on overseas spend",
            "Annual fee S$194.40, waived with S$25,000 spend a year; 10,000 bonus miles when you pay it",
        ],
        "perks": [
            _lounge(2, "card_year", "Principal cardmember only, through Priority Pass, per 12-month membership "
                                    "period. Extra visits and guests are US$35 each."),
        ],
    },
    "uob_prvi_miles": {
        "country": "SG", "checked": SG_CHECKED, "name": "UOB PRVI Miles Card",
        "features": [
            "1.4 miles per S$1 on local spend, 2.4 miles per S$1 overseas, and 3 miles per S$1 in Malaysia, "
            "Indonesia, Thailand and Vietnam",
            "Annual fee S$261.60, first year waived",
        ],
        "perks": [
            _lounge(4, "calendar_year", "Principal cardmember only, through Priority Pass."),
        ],
    },
    "hsbc_travelone": {
        "country": "SG", "checked": SG_CHECKED, "name": "HSBC TravelOne Credit Card",
        "features": [
            "Up to 1.2 miles per S$1 on local spend, up to 2.4 miles per S$1 on foreign currency spend",
            "Annual fee S$196.20, waived with S$25,000 spend a year; up to 12,000 bonus miles when you pay it "
            "(from 2026)",
        ],
        "perks": [
            _lounge(4, "calendar_year", "Primary cardholder only, at over 1,300 airport lounges worldwide."),
        ],
    },
    "uob_krisflyer": {
        "country": "SG", "checked": SG_CHECKED, "name": "KrisFlyer UOB Credit Card",
        "features": [
            "3 miles per S$1 on Singapore Airlines, Scoot, KrisShop, Kris+ and Pelago",
            "2.4 miles per S$1 on dining, food delivery, online shopping, online travel and transport, once you "
            "spend S$1,000 a year on Singapore Airlines, Scoot and KrisShop",
            "1.2 miles per S$1 on all other spend",
            "Annual fee S$196.20, first year waived",
        ],
        "perks": [],
    },
    "amex_krisflyer_ascend": {
        "country": "SG", "checked": SG_CHECKED, "name": "American Express Singapore Airlines KrisFlyer Ascend",
        "features": [
            "2 miles per S$1 on Singapore Airlines and Scoot flights, KrisShop and Pelago",
            "Up to 2 miles per S$1 on Grab Singapore, up to S$200 spend a calendar month",
            "1.2 miles per S$1 on all other spend",
            "Annual fee S$397.85",
        ],
        "perks": [
            {"key": "hilton_night", "name": "Hilton complimentary night", "value": "1 night",
             "period": "card_year", "type": "voucher", "category": "travel",
             "terms": "One voucher each year once the annual fee is paid, at participating Hilton hotels in "
                      "Asia Pacific."},
        ],
    },
})

PERIOD_LABELS = {
    "monthly": "every month",
    "quarterly": "every quarter",
    "semiannual": "every six months (Jan–Jun, Jul–Dec)",
    "calendar_year": "every calendar year",
    "card_year": "on your card anniversary",
}


def needs_anniversary(card_key: str) -> bool:
    return any(p["period"] == "card_year" for p in CATALOG[card_key]["perks"])


def _checked(card: dict) -> str:
    return card.get("checked", CATALOG_CHECKED)


def public_catalog() -> dict:
    return {
        "checked": f"{SG_CHECKED} for Singapore cards, {CATALOG_CHECKED} for US cards",
        "countries": [{"code": code, "name": name} for code, name in COUNTRIES.items()],
        "cards": [
            {
                "key": key,
                "name": card["name"],
                "country": card["country"],
                "needs_anniversary": needs_anniversary(key),
                "features": card.get("features", []),
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
        source_snippet=f"{card['name']} perk list (last checked {_checked(card)}; confirm with your issuer).",
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
        sync_card_benefits(conn, user_id, reminders.user_today(conn, user_id))
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


def sync_card_benefits(conn: sqlite3.Connection, user_id: str, today: date) -> None:
    """
    Makes sure each perk has a benefit for its current period, and removes
    benefits for periods that have ended. Cheap; runs whenever benefits are
    listed. `today` is the date where the user is (reminders.user_today).
    """
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
