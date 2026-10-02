"""
reminders.py

Emails users before their benefits expire. server.py starts a background
thread that calls run_due() every 15 minutes; each user gets at most one email
per check, listing every benefit whose reminder day has come.

- Each user has settings in reminder_settings: on or off, the usual number of
  days before expiry, and optionally a different number (or "off") for each
  category, like 1 month for dining and 6 months for travel. With no row yet,
  reminders are on, DEFAULT_DAYS before.
- A benefit can override both: data["reminder"] is None (use the settings),
  "off", or a number of days before expiry. Turning reminders off for the
  account stops them all.
- Each benefit is reminded once per expiry date (reminders_sent), so a
  changed date gets a new reminder. Card credits are a new benefit each
  period, so they're reminded every period.
- Benefits waiting for review are skipped: their date isn't confirmed.
- Days and SEND_FROM_HOUR follow each user's own time zone (sent by their
  browser; the server's until it is), so nothing arrives before 8am where they
  are. A reminder
  whose day has already passed when it's set up (a benefit added 2 days before
  it expires, with a 1-week reminder) goes out at the next check.
"""

import json
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Union
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import cards
import config
import db
import mailer

DEFAULT_DAYS = 7
DAY_CHOICES = (0, 1, 2, 3, 7, 14, 30, 60, 90, 180)
SEND_FROM_HOUR = 8
CHECK_EVERY_SECONDS = 15 * 60

Reminder = Union[int, str, None]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

def get_settings(conn, user_id: str) -> dict:
    row = conn.execute("SELECT enabled, days_before, categories, timezone FROM reminder_settings WHERE user_id = ?",
                       (user_id,)).fetchone()
    if row is None:
        return {"enabled": True, "days_before": DEFAULT_DAYS, "categories": {}, "timezone": None}
    return {"enabled": bool(row["enabled"]), "days_before": row["days_before"],
            "categories": json.loads(row["categories"]), "timezone": row["timezone"]}


def save_settings(conn, user_id: str, enabled: bool, days_before: int, categories: Optional[dict] = None) -> dict:
    """Saves the reminder choices. categories=None keeps the current ones; the time zone is kept."""
    if categories is None:
        categories = get_settings(conn, user_id)["categories"]
    conn.execute(
        "INSERT INTO reminder_settings (user_id, enabled, days_before, categories) VALUES (?, ?, ?, ?) "
        "ON CONFLICT (user_id) DO UPDATE SET enabled = excluded.enabled, days_before = excluded.days_before, "
        "categories = excluded.categories",
        (user_id, int(enabled), days_before, json.dumps(categories)),
    )
    return get_settings(conn, user_id)


def save_timezone(conn, user_id: str, name: str) -> None:
    """Raises ValueError if name isn't a known time zone."""
    if not valid_timezone(name):
        raise ValueError("Unknown time zone.")
    conn.execute(
        "INSERT INTO reminder_settings (user_id, enabled, days_before, timezone) VALUES (?, 1, ?, ?) "
        "ON CONFLICT (user_id) DO UPDATE SET timezone = excluded.timezone",
        (user_id, DEFAULT_DAYS, name),
    )


def valid_timezone(name) -> bool:
    if not isinstance(name, str) or not name or len(name) > 64:
        return False
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


def local_now(settings: dict, now_utc: datetime) -> datetime:
    """The time where the user is (the server's time zone until their browser has told us theirs)."""
    if settings.get("timezone") and valid_timezone(settings["timezone"]):
        return now_utc.astimezone(ZoneInfo(settings["timezone"]))
    return now_utc.astimezone()


def parse_days(value) -> int:
    """A days-before choice from a request. Raises ValueError if it isn't one of DAY_CHOICES."""
    try:
        days = int(value)
    except (TypeError, ValueError):
        raise ValueError("Pick when to be reminded from the list.") from None
    if days not in DAY_CHOICES:
        raise ValueError("Pick when to be reminded from the list.")
    return days


def parse_categories(value, known: list[str]) -> dict:
    """Per-category choices from a request: {category: days before, or "off"}. Leave a category out to use the usual."""
    if not isinstance(value, dict):
        raise ValueError("categories must be an object.")
    out = {}
    for category, choice in value.items():
        if category not in known:
            raise ValueError("Pick a category from the list.")
        reminder = parse_reminder(choice)
        if reminder is not None:
            out[category] = reminder
    return out


def parse_reminder(value) -> Reminder:
    """A benefit's own reminder from a request: None (the default), "off" or days before."""
    if value in (None, "", "default"):
        return None
    if value == "off":
        return "off"
    return parse_days(value)


# ---------------------------------------------------------------------------
# Working out what's due
# ---------------------------------------------------------------------------

def lead_days(benefit: dict, settings: dict) -> Optional[int]:
    """Days before expiry to remind about this benefit, or None for no reminder."""
    if not settings["enabled"]:
        return None
    choice = benefit.get("reminder")  # the benefit's own choice wins
    if choice is None:
        choice = settings["categories"].get(benefit.get("category"))
    if choice == "off":
        return None
    return choice if isinstance(choice, int) else settings["days_before"]


def due(benefits: list[dict], settings: dict, sent: set[tuple[str, str]], today: date) -> list[dict]:
    """The benefits to remind about today, soonest expiry first."""
    out = []
    for b in benefits:
        if b.get("needs_review") or not b.get("expiry_date"):
            continue
        lead = lead_days(b, settings)
        if lead is None or (b["id"], b["expiry_date"]) in sent:
            continue
        try:
            expiry = date.fromisoformat(b["expiry_date"])
        except ValueError:
            continue
        if expiry - timedelta(days=lead) <= today <= expiry:
            out.append(b)
    return sorted(out, key=lambda b: b["expiry_date"])


# ---------------------------------------------------------------------------
# The email
# ---------------------------------------------------------------------------

def _when(expiry: date, today: date) -> str:
    days = (expiry - today).days
    on = f"{expiry:%a} {expiry.day} {expiry:%b}" + (f" {expiry.year}" if expiry.year != today.year else "")
    if days == 0:
        return "expires today"
    if days == 1:
        return f"expires tomorrow, {on}"
    return f"expires in {days} days, on {on}"


def _worth(b: dict) -> Optional[str]:
    if b.get("points") is not None:
        return f"{b['points']:,} {b.get('points_unit') or 'points'}"
    return b.get("value")


def compose(name: Optional[str], benefits: list[dict], today: date) -> tuple[str, str]:
    """(subject, text) of the reminder email."""
    if len(benefits) == 1:
        b = benefits[0]
        subject = f"Reminder: {b['benefit_name']} {_when(date.fromisoformat(b['expiry_date']), today).split(',')[0]}"
    else:
        subject = f"Reminder: {len(benefits)} benefits expiring soon"

    lines = [f"Hi {name.split()[0]}," if name else "Hi,", "",
             "This benefit is expiring soon:" if len(benefits) == 1 else "These benefits are expiring soon:", ""]
    for b in benefits:
        details = ", ".join(filter(None, [b.get("provider"), _worth(b)]))
        lines.append(f"- {b['benefit_name']}{f' ({details})' if details else ''}: "
                     f"{_when(date.fromisoformat(b['expiry_date']), today)}")
        if b.get("terms_summary"):
            lines.append(f"  {b['terms_summary']}")
    lines += ["", f"See everything in Squirrel: {config.APP_URL}/benefits", "",
              "You're getting this because email reminders are on. To change when you're reminded, "
              f"or turn reminders off, go to Connections in Squirrel: {config.APP_URL}/connections#reminders"]
    return subject, "\n".join(lines)


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------

def run_due(now: Optional[datetime] = None) -> int:
    """Sends every reminder that's due. Returns how many emails were sent."""
    now = now or datetime.now(timezone.utc)
    with db.connect() as conn:
        users = conn.execute("SELECT id, email, name FROM users").fetchall()

    emails = 0
    for user in users:
        with db.connect() as conn:
            settings = get_settings(conn, user["id"])
            local = local_now(settings, now)
            if not settings["enabled"] or local.hour < SEND_FROM_HOUR:
                continue
            today = local.date()
            cards.sync_card_benefits(conn, user["id"])  # so a new period's credits are included
            benefits = db.list_benefits(conn, user["id"])
            sent = {(r["benefit_id"], r["expiry_date"]) for r in conn.execute(
                "SELECT benefit_id, expiry_date FROM reminders_sent WHERE user_id = ?", (user["id"],))}
        items = due(benefits, settings, sent, today)
        if not items:
            continue
        try:
            mailer.send(user["email"], *compose(user["name"], items, today))
        except Exception as e:  # noqa: BLE001 - try again at the next check
            print(f"  Reminder email to user {user['id']} failed: {e}", flush=True)
            continue
        with db.connect() as conn:
            conn.executemany(
                "INSERT OR IGNORE INTO reminders_sent (user_id, benefit_id, expiry_date, sent_at) VALUES (?, ?, ?, ?)",
                [(user["id"], b["id"], b["expiry_date"], db.now_iso()) for b in items],
            )
        emails += 1
    return emails


def _loop() -> None:
    while True:
        try:
            run_due()
        except Exception as e:  # noqa: BLE001 - keep checking even if one run fails
            print(f"  Reminder check failed: {e}", flush=True)
        time.sleep(CHECK_EVERY_SECONDS)


def start() -> None:
    threading.Thread(target=_loop, name="reminders", daemon=True).start()
