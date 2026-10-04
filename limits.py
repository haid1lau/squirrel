"""
limits.py

Per-user caps on the requests that call OpenAI (assistant questions, digests,
inbox scans), so one account can't run up the API bill. Like auth.py's
sign-in limits, counts live in memory: a restart resets them, and each server
process counts on its own.
"""

import math
import threading
import time
from collections import defaultdict, deque
from typing import Optional

WINDOW_S = 3600
# Per user, per hour. Scans count Gmail and every other email account together.
LIMITS = {"ask": 30, "digest": 10, "scan": 10}

_calls: dict[tuple[str, str], deque] = defaultdict(deque)
_lock = threading.Lock()


def take(user_id: str, kind: str) -> Optional[int]:
    """
    Uses up one of the user's `kind` requests for this hour. Returns None when
    allowed, or the minutes until the next one is (the request isn't counted).
    """
    now = time.monotonic()
    with _lock:
        calls = _calls[(user_id, kind)]
        while calls and calls[0] <= now - WINDOW_S:
            calls.popleft()
        if len(calls) >= LIMITS[kind]:
            return max(1, math.ceil((calls[0] + WINDOW_S - now) / 60))
        calls.append(now)
        return None
