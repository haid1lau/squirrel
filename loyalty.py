"""
loyalty.py

Finds loyalty memberships (hotel points, airline miles) from who emails the
user, even when the program never sends a points reminder. No AI: a scan
looks for emails from each program's domains and reads only the sender,
subject and date.

- A membership is detected from any email the program sent (welcome email,
  booking, promotion...).
- The newest email that looks like account activity (a booking, stay receipt,
  points earned) dates the last activity. Plus the program's inactivity rule,
  that gives an estimated expiry date.
- Detections go to the review queue: the user confirms membership and the
  date. A dismissed detection never comes back.

PROGRAMS is hand-maintained. Programs change their rules and sending domains,
so the UI tells users to confirm with the program.
"""

import calendar
import json
from datetime import date, timedelta
from email.utils import parseaddr
from typing import Callable, Optional

import db

PROGRAMS_CHECKED = "mid-2025"
LOOKBACK_DAYS = 3 * 365  # long enough to see activity behind a 24- or 36-month rule

# expiry_months: points expire after this many months with no earning or
# redeeming; None means they don't expire. fixed_expiry_months instead: each
# batch expires that long after it was earned, whatever the activity, so email
# can't date it and the user enters it. Domains match subdomains too.
# Sending domains are best guesses; add any a program actually uses.
PROGRAMS: dict[str, dict] = {
    "marriott_bonvoy": {"name": "Marriott Bonvoy", "unit": "points", "expiry_months": 24,
                        "domains": ["marriott.com", "email-marriott.com"]},
    "hilton_honors": {"name": "Hilton Honors", "unit": "points", "expiry_months": 24,
                      "domains": ["hilton.com", "hiltonhonors.com"]},
    "world_of_hyatt": {"name": "World of Hyatt", "unit": "points", "expiry_months": 24,
                       "domains": ["hyatt.com"]},
    "ihg_one_rewards": {"name": "IHG One Rewards", "unit": "points", "expiry_months": 12,
                        "note": "Elite members' points don't expire.", "domains": ["ihg.com"]},
    "accor_all": {"name": "ALL Accor Live Limitless", "unit": "points", "expiry_months": 12,
                  "domains": ["accor.com", "accorhotels.com"]},
    "wyndham_rewards": {"name": "Wyndham Rewards", "unit": "points", "expiry_months": 18,
                        "domains": ["wyndhamhotels.com", "wyndhamrewards.com"]},
    "american_aadvantage": {"name": "American Airlines AAdvantage", "unit": "miles", "expiry_months": 24,
                            "domains": ["aa.com"]},
    "singapore_krisflyer": {"name": "Singapore Airlines KrisFlyer", "unit": "miles", "expiry_months": None,
                            "fixed_expiry_months": 36, "domains": ["singaporeair.com", "singaporeair.com.sg"]},
    "british_airways_club": {"name": "British Airways Club", "unit": "Avios", "expiry_months": 36,
                             "domains": ["ba.com", "britishairways.com"]},
    "delta_skymiles": {"name": "Delta SkyMiles", "unit": "miles", "expiry_months": None,
                       "domains": ["delta.com"]},
    "united_mileageplus": {"name": "United MileagePlus", "unit": "miles", "expiry_months": None,
                           "domains": ["united.com"]},
    "southwest_rapid_rewards": {"name": "Southwest Rapid Rewards", "unit": "points", "expiry_months": None,
                                "domains": ["southwest.com"]},
    "jetblue_trueblue": {"name": "JetBlue TrueBlue", "unit": "points", "expiry_months": None,
                         "domains": ["jetblue.com"]},
}

# Subject wording that suggests real account activity, not marketing.
ACTIVITY_PHRASES = [
    "confirmation", "receipt", "folio", "itinerary", "e-ticket", "boarding pass", "thanks for staying",
    "thank you for staying", "upcoming stay", "upcoming trip", "points earned", "miles earned",
    "you've earned", "redeemed", "check-in",
]

# A finder returns the newest email ({"from", "subject", "received_date"}) from
# the program's domains, or with activity=True the newest one whose subject
# suggests activity. Gmail and IMAP each provide one.
Finder = Callable[[dict, bool], Optional[dict]]


def sender_matches(program: dict, from_header: str) -> bool:
    """True if the sender's domain is one of the program's domains or a subdomain of one."""
    address = parseaddr(from_header or "")[1].lower()
    domain = address.rpartition("@")[2]
    return bool(domain) and any(domain == d or domain.endswith("." + d) for d in program["domains"])


def since(today: Optional[date] = None) -> date:
    return (today or date.today()) - timedelta(days=LOOKBACK_DAYS)


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year, month = d.year + month // 12, month % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def _fmt(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {calendar.month_abbr[d.month]} {d.year}"


def build_record(program: dict, latest: dict, activity: Optional[dict], today: Optional[date] = None) -> dict:
    """The benefit stored for a detected membership (always needs review)."""
    today = today or date.today()
    unit, months = program["unit"], program["expiry_months"]
    fixed = program.get("fixed_expiry_months")
    expiry, confidence = None, "unknown"
    if fixed:
        reasoning = (f"{program['name']} {unit} expire {fixed} months after they're earned, each batch separately, "
                     "so the date can't be worked out from email. Check your account for the next "
                     f"{unit} to expire.")
        review = f"Found {program['name']} emails. Confirm you're a member and enter when your next {unit} expire."
    elif months is None:
        reasoning = f"{program['name']} {unit} don't expire."
        review = f"Found emails from {program['name']}. Confirm you're a member."
    elif activity and activity.get("received_date"):
        expiry = add_months(date.fromisoformat(activity["received_date"]), months).isoformat()
        confidence = "computed"
        reasoning = (f"{unit.capitalize()} expire after {months} months without earning or redeeming. "
                     f"Estimated from your last activity email on {_fmt(activity['received_date'])}.")
        review = f"Found {program['name']} emails. Confirm you're a member and check the estimated date"
        review += " (it may have passed already)." if expiry < today.isoformat() else "."
    else:
        reasoning = (f"{unit.capitalize()} expire after {months} months without earning or redeeming, "
                     "but no booking or stay email was found to date your last activity.")
        review = f"Found {program['name']} emails. Confirm you're a member and enter when your {unit} expire."

    if fixed:
        terms = f"{unit.capitalize()} expire {fixed} months after they're earned."
    elif months:
        terms = f"{unit.capitalize()} expire after {months} months without activity."
    else:
        terms = f"{unit.capitalize()} don't expire."
    if program.get("note"):
        terms += " " + program["note"]
    return {
        "is_benefit": True,
        "benefit_name": f"{program['name']} {unit}",
        "provider": program["name"],
        "type": "membership",
        "category": "travel",
        "value": None,
        "points": None,
        "points_unit": unit,  # display only: "points", "miles" or "Avios"
        "expiry_date": expiry,
        "expiry_confidence": confidence,
        "expiry_reasoning": reasoning,
        "terms_summary": terms + f" Rules last checked {PROGRAMS_CHECKED}; confirm with {program['name']}.",
        "source_snippet": (activity or latest).get("subject", "")[:200],
        "needs_review": True,
        "review_reason": review,
        "source_label": f"Latest email {_fmt(latest['received_date'])}" if latest.get("received_date") else None,
    }


def record_detection(user_id: str, key: str, record: dict) -> bool:
    """
    Stores a detection. Returns True if it's new. An existing detection is
    refreshed only while it's still waiting for review; once confirmed or
    dismissed, it's the user's.
    """
    source_ref = f"loyalty:{key}"
    with db.connect() as conn:
        if db.add_benefit(conn, user_id, "loyalty", source_ref, record):
            return True
        row = conn.execute("SELECT id, status, data FROM benefits WHERE user_id = ? AND source_ref = ?",
                           (user_id, source_ref)).fetchone()
        if row and row["status"] == "active":
            current = json.loads(row["data"])
            if current.get("needs_review"):
                db.update_benefit_data(conn, user_id, row["id"], {**record, "points": current.get("points")})
    return False


def detect(user_id: str, find: Finder, today: date) -> int:
    """
    Checks every program with the given finder. Returns how many new memberships
    were found. `today` is the date where the user is.
    """
    found = 0
    for key, program in PROGRAMS.items():
        latest = find(program, False)
        if latest is None:
            continue
        activity = find(program, True) if program["expiry_months"] else None
        if record_detection(user_id, key, build_record(program, latest, activity, today)):
            found += 1
    return found


# ---------------------------------------------------------------------------
# Search wording for each email reader
# ---------------------------------------------------------------------------

def _quoted(word: str) -> str:
    return f'"{word}"' if not word.isalpha() else word


def gmail_query(program: dict, activity: bool) -> str:
    query = f"from:({' OR '.join(program['domains'])}) newer_than:{LOOKBACK_DAYS}d"
    if activity:
        query += f" subject:({' OR '.join(_quoted(p) for p in ACTIVITY_PHRASES)})"
    return query


def _imap_or(terms: list[str]) -> str:
    expr = terms[-1]
    for term in reversed(terms[:-1]):
        expr = f"OR {term} {expr}"
    return expr


def imap_criteria(program: dict, activity: bool, since_date: str) -> str:
    """since_date is IMAP's DD-Mon-YYYY."""
    criteria = f"SINCE {since_date} " + _imap_or([f'FROM "{d}"' for d in program["domains"]])
    if activity:
        criteria += " " + _imap_or([f'SUBJECT "{p}"' for p in ACTIVITY_PHRASES])
    return criteria
