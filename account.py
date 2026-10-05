"""
account.py

Deleting an account with everything Squirrel holds for it. Lives apart from
auth.py because it has to reach every email connection: Gmail access is
revoked at Google, and scans in progress must finish first.
"""

import auth
import db
import gmail_sync
import imap_sync
import outlook_sync


class AccountError(Exception):
    """A reason the account can't be deleted right now, safe to show the user."""


def _scan_running(user_id: str) -> bool:
    if gmail_sync.status(user_id)["state"] == "running" or outlook_sync.status(user_id)["state"] == "running":
        return True
    return any(a["scan"]["state"] == "running" for a in imap_sync.list_accounts(user_id))


def delete_account(user_id: str, password: str, typed_email: str) -> None:
    """Raises auth.AuthError (confirmation failed) or AccountError (a scan is running)."""
    auth.confirm_deletion(user_id, password, typed_email)
    if _scan_running(user_id):
        raise AccountError("A scan is still running. Wait for it to finish, then delete your account.")
    gmail_sync.disconnect(user_id)  # also revokes Squirrel's access at Google
    outlook_sync.disconnect(user_id)
    with db.connect() as conn:
        account_ids = [r["id"] for r in conn.execute("SELECT id FROM imap_accounts WHERE user_id = ?", (user_id,))]
    for account_id in account_ids:
        imap_sync.remove_account(user_id, account_id)
    auth.delete_user(user_id)
