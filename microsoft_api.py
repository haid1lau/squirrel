"""
microsoft_api.py

Microsoft sign-in (OAuth with PKCE) and the few Microsoft Graph mail calls
"Connect Outlook" needs, using only urllib. Works for personal accounts
(Outlook.com, Hotmail, Live) and work or school Microsoft 365 accounts.
Mail access is read-only (Mail.Read).

- Message ids are requested as immutable ids, so moving an email to another
  folder doesn't make it look new.
- Microsoft replaces the refresh token each time it's used; refresh() returns
  the new one so the caller can save it.

Setup: see "Outlook" in PROGRESS.md.
"""

import hashlib
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Optional

from config import MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI
from google_api import _b64url
from mailtext import html_to_text

# "common" accepts both personal and work or school accounts.
AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
GRAPH = "https://graph.microsoft.com/v1.0/me"
SCOPES = ["openid", "email", "profile", "offline_access", "User.Read", "Mail.Read"]
# Where people remove Squirrel's access to a personal Microsoft account.
PERSONAL_APPS_URL = "https://account.live.com/consent/Manage"
TIMEOUT_S = 20

# Folders a scan leaves out (Graph's well-known names).
SKIPPED_FOLDERS = ("sentitems", "drafts", "deleteditems", "junkemail")


class MicrosoftError(Exception):
    """A Microsoft call failed. The message is safe to show the user."""


class MicrosoftAccessRevoked(MicrosoftError):
    """The stored refresh token no longer works; the user must connect Outlook again."""


def new_pkce_verifier() -> str:
    return secrets.token_urlsafe(64)


def authorization_url(state: str, code_verifier: str, login_hint: Optional[str] = None) -> str:
    params = {
        "client_id": MICROSOFT_CLIENT_ID,
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "response_type": "code",
        "response_mode": "query",
        "scope": " ".join(SCOPES),
        "state": state,
        "code_challenge": _b64url(hashlib.sha256(code_verifier.encode()).digest()),
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    if login_hint:
        params["login_hint"] = login_hint
    return f"{AUTH_URL}?{urllib.parse.urlencode(params)}"


def _request_json(req: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read() or b"{}")
        except json.JSONDecodeError:
            body = {}
        err = body.get("error")
        if err in ("invalid_grant", "interaction_required"):
            raise MicrosoftAccessRevoked("Microsoft access has expired or was removed.") from e
        detail = (err.get("message") if isinstance(err, dict) else body.get("error_description") or err) or e.reason
        if req.full_url.startswith(GRAPH) and e.code in (401, 403):
            raise MicrosoftAccessRevoked(f"Outlook refused access: {detail}") from e
        raise MicrosoftError(f"Microsoft returned an error ({e.code}): {detail}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise MicrosoftError("Couldn't reach Microsoft. Check your internet connection.") from e


def _post_token(data: dict) -> dict:
    req = urllib.request.Request(
        TOKEN_URL,
        data=urllib.parse.urlencode({
            "client_id": MICROSOFT_CLIENT_ID,
            "client_secret": MICROSOFT_CLIENT_SECRET,
            "scope": " ".join(SCOPES),
            **data,
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    return _request_json(req)


def exchange_code(code: str, code_verifier: str) -> dict:
    """Microsoft's token response: access_token, refresh_token, scope."""
    return _post_token({
        "code": code,
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    })


def refresh(refresh_token: str) -> tuple[str, str]:
    """(access token, refresh token to save from now on)."""
    tokens = _post_token({"refresh_token": refresh_token, "grant_type": "refresh_token"})
    return tokens["access_token"], tokens.get("refresh_token") or refresh_token


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

def _graph_get(access_token: str, url: str, params: Optional[dict] = None, text_body: bool = False) -> dict:
    if params:
        url += "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    prefer = ['IdType="ImmutableId"'] + (['outlook.body-content-type="text"'] if text_body else [])
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}", "Prefer": ", ".join(prefer)})
    return _request_json(req)


def mailbox_address(access_token: str) -> str:
    me = _graph_get(access_token, GRAPH, {"$select": "mail,userPrincipalName"})
    address = me.get("mail") or me.get("userPrincipalName")
    if not address:
        raise MicrosoftError("Microsoft didn't share the account's email address.")
    return address


def search_value(kql: str) -> str:
    """A KQL query as Graph's $search value: the whole query in double quotes, inner ones escaped."""
    return '"' + kql.replace("\\", "\\\\").replace('"', '\\"') + '"'


def skipped_folder_ids(access_token: str) -> set[str]:
    ids = set()
    for name in SKIPPED_FOLDERS:
        try:
            ids.add(_graph_get(access_token, f"{GRAPH}/mailFolders/{name}", {"$select": "id"})["id"])
        except MicrosoftAccessRevoked:
            raise
        except MicrosoftError:
            pass  # a mailbox without that folder
    return ids


def search_messages(access_token: str, kql: str, limit: int, select: str = "id,parentFolderId") -> list[dict]:
    """Messages matching a KQL query across every folder, newest first (Graph's order for $search)."""
    messages: list[dict] = []
    url: Optional[str] = f"{GRAPH}/messages"
    params: Optional[dict] = {"$search": search_value(kql), "$select": select, "$top": min(100, limit)}
    while url and len(messages) < limit:
        data = _graph_get(access_token, url, params)
        messages.extend(data.get("value", []))
        url, params = data.get("@odata.nextLink"), None  # the next link already has the query
    return messages[:limit]


def from_header(message: dict) -> str:
    """Graph's from field as an email header ("Name <address>")."""
    sender = (message.get("from") or {}).get("emailAddress") or {}
    name, address = sender.get("name") or "", sender.get("address") or ""
    return f"{name} <{address}>" if name else address


def received_date(message: dict) -> Optional[str]:
    try:
        return datetime.fromisoformat(message["receivedDateTime"].replace("Z", "+00:00")).date().isoformat()
    except (KeyError, TypeError, ValueError):
        return None


def get_message(access_token: str, message_id: str) -> dict:
    """
    Same shape as google_api.get_message, plus "link" (the email in Outlook on
    the web): {"text", "received_date", "subject", "link"}.
    """
    msg = _graph_get(access_token, f"{GRAPH}/messages/{urllib.parse.quote(message_id, safe='')}",
                     {"$select": "subject,from,receivedDateTime,body,webLink"}, text_body=True)
    body = msg.get("body") or {}
    content = body.get("content") or ""
    text = html_to_text(content) if body.get("contentType") == "html" else content.strip()
    subject = msg.get("subject") or ""
    header_lines = [f"From: {from_header(msg)}", f"Subject: {subject}", f"Date: {msg.get('receivedDateTime', '')}"]
    return {
        "text": "\n".join(header_lines) + "\n\n" + text,
        "received_date": received_date(msg),
        "subject": subject,
        "link": msg.get("webLink"),
    }
