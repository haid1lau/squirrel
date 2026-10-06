"""auth.py: accounts, passwords, sessions, reset and confirmation links."""

import re

import pytest

import account
import auth
import db
from conftest import add_benefit, make_user

PASSWORD = "correct horse battery"


def token_from(link: str) -> str:
    return re.search(r"#token=(.+)$", link).group(1)


# --- Sign-up and sign-in ------------------------------------------------------------

def test_register_and_sign_in():
    created = auth.register("Alex@Example.com ", PASSWORD, "Alex")
    assert created["email"] == "alex@example.com"  # tidied up
    assert not created["email_verified"]
    assert auth.login("ALEX@example.com", PASSWORD)["id"] == created["id"]


def test_password_is_not_stored_in_plain_text():
    auth.register("alex@example.com", PASSWORD)
    with db.connect() as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert PASSWORD not in stored and stored.startswith("scrypt$")


@pytest.mark.parametrize("email, password", [
    ("not-an-email", PASSWORD),
    ("alex@example.com", "short"),
])
def test_register_rejects_bad_input(email, password):
    with pytest.raises(auth.AuthError):
        auth.register(email, password)


def test_same_email_cannot_register_twice():
    auth.register("alex@example.com", PASSWORD)
    with pytest.raises(auth.AuthError, match="already exists"):
        auth.register("alex@example.com", "another long password")


def test_wrong_password_and_unknown_email_get_the_same_message():
    auth.register("alex@example.com", PASSWORD)
    with pytest.raises(auth.AuthError) as wrong_password:
        auth.login("alex@example.com", "wrong password!!")
    with pytest.raises(auth.AuthError) as unknown_email:
        auth.login("nobody@example.com", PASSWORD)
    assert str(wrong_password.value) == str(unknown_email.value)


def test_too_many_wrong_passwords_locks_sign_in():
    auth.register("alex@example.com", PASSWORD)
    for _ in range(auth.MAX_FAILED_LOGINS):
        with pytest.raises(auth.AuthError):
            auth.login("alex@example.com", "wrong password!!")
    # Even the right password is refused until the wait is over.
    with pytest.raises(auth.AuthError, match="Too many"):
        auth.login("alex@example.com", PASSWORD)


# --- Sessions ---------------------------------------------------------------------------

def test_session_lifecycle(user):
    token = auth.create_session(user["id"])
    assert auth.user_for_session(token)["id"] == user["id"]
    auth.end_session(token)
    assert auth.user_for_session(token) is None
    assert auth.user_for_session("made-up-token") is None
    assert auth.user_for_session(None) is None


def test_session_token_is_stored_hashed(user):
    token = auth.create_session(user["id"])
    with db.connect() as conn:
        stored = [r[0] for r in conn.execute("SELECT token_hash FROM sessions")]
    assert token not in stored


def test_using_the_app_records_activity(user):
    auth.user_for_session(auth.create_session(user["id"]))
    with db.connect() as conn:
        assert conn.execute("SELECT last_active_at FROM users").fetchone()[0] is not None


# --- Password reset ----------------------------------------------------------------------

def test_reset_link_works_once_and_signs_out_everywhere(user):
    session = auth.create_session(user["id"])
    _, link = auth.create_reset_link(user["email"])
    auth.reset_password(token_from(link), "a brand new password")
    assert auth.login(user["email"], "a brand new password")
    assert auth.user_for_session(session) is None
    with pytest.raises(auth.AuthError, match="expired or was already used"):
        auth.reset_password(token_from(link), "yet another password")


def test_reset_for_unknown_email_reveals_nothing():
    assert auth.create_reset_link("nobody@example.com") is None


def test_reset_links_are_rate_limited(user):
    for _ in range(auth.MAX_RESET_EMAILS):
        assert auth.create_reset_link(user["email"]) is not None
    assert auth.create_reset_link(user["email"]) is None


# --- Email confirmation ---------------------------------------------------------------------

def test_confirmation_link_confirms_the_address():
    created = auth.register("alex@example.com", PASSWORD)
    _, link = auth.create_verification_link(created["id"])
    assert auth.verify_email(token_from(link))["email_verified"]
    with pytest.raises(auth.AuthError):
        auth.verify_email(token_from(link))  # only once


def test_link_stops_working_if_the_address_changes():
    created = auth.register("alex@example.com", PASSWORD)
    _, link = auth.create_verification_link(created["id"])
    auth.change_unverified_email(created["id"], "alex.tan@example.com")
    with pytest.raises(auth.AuthError):
        auth.verify_email(token_from(link))


# --- Google sign-in -----------------------------------------------------------------------------

def test_google_takes_over_an_unconfirmed_password_account():
    """Someone signed up with another person's address; the real owner then signs in with Google."""
    squatter = auth.register("alex@example.com", PASSWORD)
    squatter_session = auth.create_session(squatter["id"])
    owner, password_removed = auth.find_or_create_google_user("google-123", "alex@example.com", True, "Alex")
    assert owner["id"] == squatter["id"]
    assert password_removed and not owner["has_password"]
    assert auth.user_for_session(squatter_session) is None
    with pytest.raises(auth.AuthError):
        auth.login("alex@example.com", PASSWORD)


def test_google_keeps_the_password_of_a_confirmed_account(user):
    linked, password_removed = auth.find_or_create_google_user("google-123", user["email"], True, "Alex")
    assert linked["id"] == user["id"] and not password_removed
    assert auth.login(user["email"], PASSWORD)


def test_unverified_google_email_is_not_linked(user):
    with pytest.raises(auth.AuthError):
        auth.find_or_create_google_user("google-123", user["email"], False, "Alex")


# --- Deleting an account ---------------------------------------------------------------------------

def test_delete_account_removes_everything(user):
    other = make_user("sam@example.com")
    add_benefit(user["id"])
    kept = add_benefit(other["id"])
    auth.create_session(user["id"])
    account.delete_account(user["id"], PASSWORD, "")
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users WHERE id = ?", (user["id"],)).fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM benefits WHERE user_id = ?", (user["id"],)).fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM sessions WHERE user_id = ?", (user["id"],)).fetchone()[0] == 0
        assert conn.execute("SELECT id FROM benefits").fetchone()[0] == kept  # other users untouched


def test_delete_account_needs_the_password(user):
    with pytest.raises(auth.AuthError):
        account.delete_account(user["id"], "wrong password!!", "")
    assert auth.login(user["email"], PASSWORD)
