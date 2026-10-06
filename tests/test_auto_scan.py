"""auto_scan.py: the daily scan is off by default and runs at most once a day."""

import pytest

import auto_scan
import db
import gmail_sync
import imap_sync
import outlook_sync
from conftest import make_user


@pytest.fixture
def started(monkeypatch):
    """Fake inboxes: Gmail and one IMAP account connected, Outlook not. Returns the scans started."""
    log: list[str] = []
    monkeypatch.setattr(gmail_sync, "connection", lambda uid: {"email": "a@gmail.com"})
    monkeypatch.setattr(outlook_sync, "connection", lambda uid: None)
    monkeypatch.setattr(imap_sync, "list_accounts", lambda uid: [{"id": "acc1"}])
    monkeypatch.setattr(gmail_sync, "start_scan", lambda uid: log.append("gmail"))
    monkeypatch.setattr(outlook_sync, "start_scan", lambda uid: log.append("outlook"))
    monkeypatch.setattr(imap_sync, "start_scan", lambda uid, acc: log.append(f"imap:{acc}"))
    monkeypatch.setattr(gmail_sync, "status", lambda uid: {"state": "running", "added": 1, "needs_review": 0})
    monkeypatch.setattr(imap_sync, "status", lambda acc: {"state": "done", "added": 2, "needs_review": 1,
                                                          "memberships": 1})
    return log


def test_off_for_new_users(user):
    assert not auto_scan.is_enabled(user["id"])
    assert not auto_scan.status(user["id"])["enabled"]


def test_nothing_scanned_while_off(user, started):
    auto_scan.maybe_start(user["id"])
    assert started == []


def test_scans_every_connected_inbox_once_a_day(user, started):
    auto_scan.set_enabled(user["id"], True)
    auto_scan.maybe_start(user["id"])
    auto_scan.maybe_start(user["id"])  # opening the app again the same day
    assert started == ["gmail", "imap:acc1"]


def test_runs_again_the_next_day(user, started):
    auto_scan.set_enabled(user["id"], True)
    auto_scan.maybe_start(user["id"])
    with db.connect() as conn:
        conn.execute("UPDATE users SET auto_scan_last_on = '2000-01-01' WHERE id = ?", (user["id"],))
    auto_scan.maybe_start(user["id"])
    assert started == ["gmail", "imap:acc1", "gmail", "imap:acc1"]


def test_turning_it_off_stops_it(user, started):
    auto_scan.set_enabled(user["id"], True)
    auto_scan.set_enabled(user["id"], False)
    auto_scan.maybe_start(user["id"])
    assert started == []


def test_one_users_setting_does_not_affect_another(user, started):
    other = make_user("sam@example.com")
    auto_scan.set_enabled(user["id"], True)
    auto_scan.maybe_start(other["id"])
    assert started == []


def test_status_adds_up_the_scans_it_started(user, started):
    auto_scan.set_enabled(user["id"], True)
    auto_scan.maybe_start(user["id"])
    assert auto_scan.status(user["id"]) == {"enabled": True, "running": True, "added": 3, "needs_review": 1,
                                            "memberships": 1, "errors": 0}


def test_one_failing_inbox_does_not_stop_the_others(user, started, monkeypatch):
    def broken(uid):
        raise RuntimeError("Gmail is down")
    monkeypatch.setattr(gmail_sync, "start_scan", broken)
    auto_scan.set_enabled(user["id"], True)
    auto_scan.maybe_start(user["id"])
    assert started == ["imap:acc1"]
