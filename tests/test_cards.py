"""cards.py: reset dates, the card list itself, and turning perks into benefits."""

from datetime import date

import pytest

import cards
import db
import server


# --- Reset dates ------------------------------------------------------------------

@pytest.mark.parametrize("period, today, end", [
    ("monthly", date(2026, 10, 7), date(2026, 10, 31)),
    ("monthly", date(2028, 2, 10), date(2028, 2, 29)),  # leap year
    ("monthly", date(2027, 2, 10), date(2027, 2, 28)),
    ("quarterly", date(2026, 1, 1), date(2026, 3, 31)),
    ("quarterly", date(2026, 10, 7), date(2026, 12, 31)),
    ("semiannual", date(2026, 6, 30), date(2026, 6, 30)),
    ("semiannual", date(2026, 7, 1), date(2026, 12, 31)),
    ("calendar_year", date(2026, 10, 7), date(2026, 12, 31)),
])
def test_period_end(period, today, end):
    assert cards.period_end(period, today) == end


@pytest.mark.parametrize("anniversary, today, end", [
    (3, date(2026, 10, 7), date(2027, 2, 28)),  # ends the month before the anniversary month
    (3, date(2026, 2, 10), date(2026, 2, 28)),
    (1, date(2026, 10, 7), date(2026, 12, 31)),  # January anniversary: the period ends in December
    (11, date(2026, 10, 31), date(2026, 10, 31)),  # the last day still counts
    (11, date(2026, 11, 1), date(2027, 10, 31)),
])
def test_card_year_end(anniversary, today, end):
    assert cards.period_end("card_year", today, anniversary) == end


def test_card_year_needs_the_month():
    with pytest.raises(ValueError):
        cards.period_end("card_year", date(2026, 10, 7))


# --- The card list ------------------------------------------------------------------

def test_catalog_is_consistent():
    names = [c["name"].lower() for c in cards.CATALOG.values()]
    assert len(names) == len(set(names)), "a card is listed twice"
    for key, card in cards.CATALOG.items():
        assert card["country"] in cards.COUNTRIES, key
        perk_keys = [p["key"] for p in card["perks"]]
        assert len(perk_keys) == len(set(perk_keys)), key
        for perk in card["perks"]:
            assert perk["period"] in cards.PERIOD_LABELS, (key, perk["key"])
            assert perk["type"] in server.TYPES, (key, perk["key"])
            assert perk["category"] in server.CATEGORIES, (key, perk["key"])
        if card["country"] == "SG":
            assert card.get("features"), f"{key} has no benefits listed"
            assert card.get("checked") == cards.SG_CHECKED


def test_twenty_singapore_cards():
    assert sum(c["country"] == "SG" for c in cards.CATALOG.values()) == 20


def test_public_catalog_shape():
    catalog = cards.public_catalog()
    assert [c["code"] for c in catalog["countries"]] == list(cards.COUNTRIES)
    ascend = next(c for c in catalog["cards"] if c["key"] == "amex_krisflyer_ascend")
    assert ascend["needs_anniversary"]
    assert ascend["perks"][0]["resets"] == "on your card anniversary"
    uob_one = next(c for c in catalog["cards"] if c["key"] == "uob_one")
    assert uob_one["perks"] == [] and not uob_one["needs_anniversary"]


# --- Adding cards ------------------------------------------------------------------------

def card_benefits(user_id: str) -> list[dict]:
    with db.connect() as conn:
        return [b for b in db.list_benefits(conn, user_id) if b["source"] == "card"]


def test_adding_a_card_tracks_its_resetting_perks(user):
    cards.add_user_card(user["id"], "hsbc_travelone", None)
    (lounge,) = card_benefits(user["id"])
    assert lounge["benefit_name"] == "Airport lounge visits"
    assert lounge["value"] == "4 visits"
    assert lounge["expiry_date"].endswith("-12-31")
    # Not a dollar credit, so there's no amount to log spending against.
    assert server.credit_total({**lounge, "source": "card"}) is None


def test_card_with_only_features_adds_no_benefits(user):
    cards.add_user_card(user["id"], "uob_one", None)
    assert card_benefits(user["id"]) == []


def test_anniversary_month_is_required_when_a_perk_needs_it(user):
    with pytest.raises(ValueError):
        cards.add_user_card(user["id"], "dbs_altitude", None)
    cards.add_user_card(user["id"], "dbs_altitude", 3)


def test_unknown_and_duplicate_cards_are_refused(user):
    with pytest.raises(ValueError):
        cards.add_user_card(user["id"], "not_a_card", None)
    cards.add_user_card(user["id"], "uob_one", None)
    with pytest.raises(ValueError):
        cards.add_user_card(user["id"], "uob_one", None)


def test_new_period_replaces_the_old_perk(user):
    cards.add_user_card(user["id"], "amex_gold", None)
    with db.connect() as conn:
        cards.sync_card_benefits(conn, user["id"], date(2026, 10, 7))
        october = {b["expiry_date"] for b in db.list_benefits(conn, user["id"]) if b["value"] == "$7"}
        cards.sync_card_benefits(conn, user["id"], date(2026, 11, 2))
        november = {b["expiry_date"] for b in db.list_benefits(conn, user["id"]) if b["value"] == "$7"}
    assert october == {"2026-10-31"}
    assert november == {"2026-11-30"}


def test_removing_a_card_removes_its_perks(user):
    card = cards.add_user_card(user["id"], "citi_premiermiles", None)
    assert card_benefits(user["id"])
    assert cards.remove_user_card(user["id"], card["id"])
    assert card_benefits(user["id"]) == []


def test_december_uber_cash_is_larger():
    record = {"source": "card", "value": "$15 ($35 in December)", "expiry_date": "2026-12-31"}
    assert server.credit_total(record) == 35
    assert server.credit_total({**record, "expiry_date": "2026-11-30"}) == 15
