"""app.validate: the plain-code checks on what the AI model reads from an email."""

from datetime import date

from app import ExtractedBenefit, validate

TODAY = date(2026, 10, 7)


def benefit(**changes) -> ExtractedBenefit:
    fields = {"is_benefit": True, "benefit_name": "S$10 voucher", "provider": "Kopi Co", "type": "voucher",
              "category": "dining", "expiry_confidence": "explicit", "expiry_reasoning": "Stated in the email.",
              "source_snippet": "valid until 31 Dec 2026", "expiry_date": "2026-12-31"}
    return ExtractedBenefit(**{**fields, **changes})


def test_clear_future_date_is_trusted():
    result = validate(benefit(), today=TODAY)
    assert result.expiry_date == "2026-12-31"
    assert not result.needs_review


def test_vague_expiry_goes_to_review_without_a_date():
    for confidence in ("ambiguous", "unknown"):
        result = validate(benefit(expiry_confidence=confidence), today=TODAY)
        assert result.expiry_date is None
        assert result.needs_review
        assert confidence in result.review_reason


def test_claimed_date_that_is_missing_goes_to_review():
    result = validate(benefit(expiry_date=None), today=TODAY)
    assert result.needs_review


def test_unreadable_date_is_dropped_and_reviewed():
    result = validate(benefit(expiry_date="31/12/2026"), today=TODAY)
    assert result.expiry_date is None
    assert result.needs_review


def test_past_date_goes_to_review():
    result = validate(benefit(expiry_date="2026-10-06"), today=TODAY)
    assert result.needs_review
    assert "past" in result.review_reason


def test_expiring_today_is_not_past():
    assert not validate(benefit(expiry_date="2026-10-07"), today=TODAY).needs_review


def test_date_more_than_five_years_away_goes_to_review():
    result = validate(benefit(expiry_date="2032-01-01"), today=TODAY)
    assert result.needs_review


def test_code_is_kept_only_if_it_is_in_the_email():
    email = "Use code KOPI10 at checkout."
    assert validate(benefit(code="KOPI10"), today=TODAY, email_text=email).code == "KOPI10"
    # A code the model made up is dropped: a wrong code at the till is worse than none.
    assert validate(benefit(code="KOPI20"), today=TODAY, email_text=email).code is None
    assert validate(benefit(code="   "), today=TODAY, email_text=email).code is None


def test_model_cannot_set_review_points_reminder_or_usage():
    data = {"is_benefit": True, "benefit_name": "x", "provider": "y", "type": "voucher", "category": "dining",
            "expiry_confidence": "explicit", "expiry_reasoning": "", "source_snippet": "",
            "needs_review": False, "points": 999999, "reminder": "off", "used_on": "2026-01-01", "used_amount": 5}
    result = ExtractedBenefit.from_model_output(data)
    assert result.points is None
    assert result.reminder is None
    assert result.used_on is None
    assert result.used_amount is None
