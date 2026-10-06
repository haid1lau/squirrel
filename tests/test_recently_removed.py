"""Recently removed: restore within 30 days, then deleted for good."""

from datetime import datetime, timedelta, timezone

import db
import loyalty
from conftest import add_benefit, make_user


def active_ids(user_id: str) -> set[str]:
    with db.connect() as conn:
        return {b["id"] for b in db.list_benefits(conn, user_id)}


def removed(user_id: str) -> list[dict]:
    with db.connect() as conn:
        return db.list_removed_benefits(conn, user_id)


def backdate_removal(benefit_id: str, days: int) -> None:
    when = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    with db.connect() as conn:
        conn.execute("UPDATE benefits SET dismissed_at = ? WHERE id = ?", (when, benefit_id))


def test_removed_benefit_moves_to_the_list(user):
    bid = add_benefit(user["id"])
    with db.connect() as conn:
        assert db.dismiss_benefit(conn, user["id"], bid)
    assert bid not in active_ids(user["id"])
    (item,) = removed(user["id"])
    assert item["id"] == bid
    removed_at = datetime.fromisoformat(item["removed_at"])
    assert datetime.fromisoformat(item["delete_on"]) - removed_at == timedelta(days=db.REMOVED_KEEP_DAYS)


def test_restore_brings_it_back_as_it_was(user):
    bid = add_benefit(user["id"], benefit_name="Spa day", code="SPA50")
    with db.connect() as conn:
        db.dismiss_benefit(conn, user["id"], bid)
        restored = db.restore_benefit(conn, user["id"], bid)
    assert restored["benefit_name"] == "Spa day" and restored["code"] == "SPA50"
    assert bid in active_ids(user["id"])
    assert removed(user["id"]) == []


def test_still_restorable_on_day_29(user):
    bid = add_benefit(user["id"])
    with db.connect() as conn:
        db.dismiss_benefit(conn, user["id"], bid)
    backdate_removal(bid, 29)
    with db.connect() as conn:
        assert db.restore_benefit(conn, user["id"], bid) is not None


def test_deleted_for_good_after_30_days(user):
    bid = add_benefit(user["id"], benefit_name="Old voucher", terms_summary="private details")
    with db.connect() as conn:
        db.dismiss_benefit(conn, user["id"], bid)
    backdate_removal(bid, 31)
    assert removed(user["id"]) == []
    with db.connect() as conn:
        assert db.restore_benefit(conn, user["id"], bid) is None
        row = conn.execute("SELECT status, data FROM benefits WHERE id = ?", (bid,)).fetchone()
    assert row["status"] == "deleted"
    assert row["data"] == "{}"  # the details are gone


def test_purge_covers_users_who_never_open_the_list(user):
    other = make_user("sam@example.com")
    old = add_benefit(other["id"])
    recent = add_benefit(other["id"])
    with db.connect() as conn:
        db.dismiss_benefit(conn, other["id"], old)
        db.dismiss_benefit(conn, other["id"], recent)
    backdate_removal(old, 31)
    with db.connect() as conn:
        assert db.purge_removed_benefits(conn) == 1
    assert [b["id"] for b in removed(other["id"])] == [recent]


def test_deleted_benefit_is_not_added_back(user):
    with db.connect() as conn:
        assert db.add_benefit(conn, user["id"], "gmail", "gmail:abc", {"benefit_name": "Voucher"})
        bid = conn.execute("SELECT id FROM benefits WHERE source_ref = 'gmail:abc'").fetchone()["id"]
        db.dismiss_benefit(conn, user["id"], bid)
    backdate_removal(bid, 31)
    with db.connect() as conn:
        db.purge_removed_benefits(conn)
        # A rescan finding the same email again:
        assert not db.add_benefit(conn, user["id"], "gmail", "gmail:abc", {"benefit_name": "Voucher"})
    assert bid not in active_ids(user["id"])


def test_loyalty_check_does_not_bring_back_a_removed_membership(user):
    record = {"benefit_name": "KrisFlyer", "needs_review": True}
    assert loyalty.record_detection(user["id"], "krisflyer", record)
    with db.connect() as conn:
        bid = conn.execute("SELECT id FROM benefits WHERE source_ref = 'loyalty:krisflyer'").fetchone()["id"]
        db.dismiss_benefit(conn, user["id"], bid)
    assert not loyalty.record_detection(user["id"], "krisflyer", record)
    assert bid not in active_ids(user["id"])


def test_one_user_cannot_restore_another_users_benefit(user):
    other = make_user("sam@example.com")
    bid = add_benefit(user["id"])
    with db.connect() as conn:
        db.dismiss_benefit(conn, user["id"], bid)
        assert db.restore_benefit(conn, other["id"], bid) is None
    assert removed(other["id"]) == []
    assert len(removed(user["id"])) == 1
