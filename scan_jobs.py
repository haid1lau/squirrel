"""
scan_jobs.py

What every inbox scan shares, whatever the provider (gmail_sync.py,
imap_sync.py):

- the words that make an email a likely benefit email, and the scan limits;
- background jobs with progress the dashboard polls;
- the per-email step: AI extraction, then storing the benefit, run for
  several emails at once.

Each scan also runs loyalty.detect first (no AI), so memberships are found
even when the AI step can't run.

Scan progress lives in memory, so restarting the server mid-scan loses it
(emails already read stay processed).
"""

import threading
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import asdict
from typing import Callable, Iterable

import db
from app import describe_ai_error, extract_benefit_from_email

# An email must mention one of these to be read at all, so the AI model only
# sees likely candidates.
KEYWORDS = [
    "voucher", "coupon", "gift card", "e-gift", "membership", "perk", "perks", "reward", "rewards",
    "points expire", "credit", "valid until", "expires on", "expiring", "free trial", "renewal", "complimentary",
]
SEARCH_DAYS = 180
SEARCH_LIMIT = 200  # newest matching emails considered per scan
MAX_EMAILS_PER_SCAN = 50  # caps API cost and wait time per press; the next scan continues
AI_WORKERS = 5  # emails read by the AI model at the same time

_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def status(key: str) -> dict:
    with _jobs_lock:
        job = _jobs.get(key)
        return dict(job) if job else {"state": "idle"}


def start(key: str, target: Callable[[dict], None]) -> dict:
    """Runs target(job) in a background thread unless a job with this key is running."""
    with _jobs_lock:
        job = _jobs.get(key)
        if job and job["state"] == "running":
            return dict(job)
        job = {"state": "running", "checked": 0, "total": None, "added": 0, "needs_review": 0,
               "skipped": 0, "failed": 0, "remaining": 0, "memberships": 0, "message": None}
        _jobs[key] = job
    threading.Thread(target=target, args=(job,), daemon=True).start()
    return dict(job)


def update(job: dict, **changes) -> None:
    with _jobs_lock:
        job.update(changes)


def bump(job: dict, *counters: str) -> None:
    """Adds 1 to each counter. Safe while several emails are processed at once."""
    with _jobs_lock:
        for c in counters:
            job[c] += 1


def forget(key: str) -> None:
    with _jobs_lock:
        _jobs.pop(key, None)


def extract_and_store(user_id: str, job: dict, message_key: str, email: dict,
                      source: str, source_ref: str, extra: dict) -> bool:
    """
    Reads one email ({"text", "received_date"}) with the AI model and stores
    any benefit found. `message_key` marks the email as processed; `extra` is
    merged into the stored benefit (e.g. a link back to the email).

    Returns False when the scan must stop (an error every email would hit,
    like a missing API key); the job then already holds the message.
    Failed emails aren't marked processed, so the next scan retries them.
    """
    try:
        result = extract_benefit_from_email(email["text"], email["received_date"])
    except Exception as e:
        described = describe_ai_error(e)
        if described is None:
            raise
        text, fatal = described
        if fatal:
            update(job, state="error", message=text)
            return False
        bump(job, "failed", "checked")
        return True

    with db.connect() as conn:
        conn.execute("INSERT OR IGNORE INTO processed_emails (user_id, message_id) VALUES (?, ?)",
                     (user_id, message_key))
        if result.is_benefit:
            db.add_benefit(conn, user_id, source, source_ref, {**asdict(result), **extra})

    if not result.is_benefit:
        bump(job, "skipped", "checked")
    elif result.needs_review:
        bump(job, "needs_review", "checked")
    else:
        bump(job, "added", "checked")
    return True


# (message_key, email, source, source_ref, extra): extract_and_store's arguments.
EmailTask = tuple[str, dict, str, str, dict]


def extract_all(user_id: str, job: dict, tasks: Iterable[EmailTask]) -> bool:
    """
    Runs extract_and_store for each task, AI_WORKERS at a time. `tasks` is
    consumed in this thread, so a provider can fetch each email lazily (an
    IMAP connection can't be shared between threads). Returns False if the
    scan had to stop.
    """
    stop = threading.Event()

    def work(task: EmailTask) -> None:
        if not stop.is_set() and not extract_and_store(user_id, job, *task):
            stop.set()

    with ThreadPoolExecutor(AI_WORKERS) as pool:
        pending: set = set()
        for task in tasks:
            if stop.is_set():
                break
            pending.add(pool.submit(work, task))
            if len(pending) >= AI_WORKERS * 2:  # don't fetch far ahead of the AI model
                finished, pending = wait(pending, return_when=FIRST_COMPLETED)
                for f in finished:
                    f.result()  # re-raises unexpected errors
        for f in pending:
            f.result()
    return not stop.is_set()
