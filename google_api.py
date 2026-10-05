"""
google_api.py

Google OAuth (sign-in + Gmail access) and the few Gmail API calls the app
needs, using only urllib. Gmail access is read-only
(https://www.googleapis.com/auth/gmail.readonly).

Setup: see "Google sign-in and Gmail" in PROGRESS.md.
"""

import base64
import hashlib
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Optional

from mailtext import html_to_text
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
# Sign-in asks only for the basic scopes, which need no restricted-scope
# verification, so anyone can sign in once the app is published. Gmail's scope
# is restricted (verification and a yearly security assessment), so it's only
# asked for by "Connect Gmail", which stays limited to test users until then.
SIGN_IN_SCOPES = ["openid", "email", "profile"]
TIMEOUT_S = 20


class GoogleError(Exception):
    """A Google API call failed. The message is safe to show the user."""


class GoogleAccessRevoked(GoogleError):
    """The stored refresh token no longer works; the user must reconnect Gmail."""


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------

def new_pkce_verifier() -> str:
    return secrets.token_urlsafe(64)


def authorization_url(state: str, code_verifier: str, *, gmail: bool, login_hint: Optional[str] = None) -> str:
    """
    gmail=True (Connect Gmail) adds read-only Gmail access and always shows
    Google's consent screen, the only way to be sure Google returns a refresh
    token (needed to scan Gmail later). Sign-in asks for the basic scopes and
    uses select_account, so returning users just pick an account.
    """
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SIGN_IN_SCOPES + ([GMAIL_SCOPE] if gmail else [])),
        "state": state,
        "code_challenge": _b64url(hashlib.sha256(code_verifier.encode()).digest()),
        "code_challenge_method": "S256",
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent" if gmail else "select_account",
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
        if body.get("error") == "invalid_grant":
            raise GoogleAccessRevoked("Google access has expired or was revoked.") from e
        err = body.get("error")
        detail = (err.get("message") if isinstance(err, dict) else body.get("error_description") or err) or e.reason
        if "/gmail/" in req.full_url:
            reasons = _error_reasons(err)
            # A disabled Gmail API is a Cloud project setting: reconnecting can't fix it.
            if reasons & {"accessNotConfigured", "SERVICE_DISABLED"}:
                raise GoogleError(
                    "The Gmail API is turned off in your Google Cloud project. Enable it under "
                    "APIs & Services → Library → Gmail API, wait a few minutes, then scan again."
                ) from e
            if e.code == 401 or reasons & {"insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"}:
                raise GoogleAccessRevoked(f"Gmail refused access: {detail}") from e
        raise GoogleError(f"Google returned an error ({e.code}): {detail}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise GoogleError("Couldn't reach Google. Check your internet connection.") from e


def _error_reasons(err) -> set[str]:
    """The machine-readable reasons in a Google API error body, e.g. {"accessNotConfigured"}."""
    if not isinstance(err, dict):
        return set()
    reasons = {e.get("reason") for e in err.get("errors", []) if isinstance(e, dict)}
    reasons |= {d.get("reason") for d in err.get("details", []) if isinstance(d, dict)}
    return {r for r in reasons if r}


def _post_form(url: str, data: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    return _request_json(req)


def exchange_code(code: str, code_verifier: str) -> dict:
    """Returns Google's token response: access_token, id_token, scope, and usually refresh_token."""
    return _post_form(TOKEN_URL, {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    })


def parse_id_token(id_token: str) -> dict:
    """
    Reads the ID token's claims. The signature isn't checked because the token
    came straight from Google's token endpoint over HTTPS (Google's docs allow
    this), but issuer, audience and expiry are.
    """
    try:
        claims = json.loads(_b64url_decode(id_token.split(".")[1]))
    except (IndexError, ValueError) as e:
        raise GoogleError("Google sent an unreadable sign-in token.") from e
    if claims.get("iss") not in ("https://accounts.google.com", "accounts.google.com"):
        raise GoogleError("Sign-in token wasn't issued by Google.")
    if claims.get("aud") != GOOGLE_CLIENT_ID:
        raise GoogleError("Sign-in token was issued for a different app.")
    if claims.get("exp", 0) < time.time():
        raise GoogleError("Sign-in token has expired. Try again.")
    if not claims.get("sub") or not claims.get("email"):
        raise GoogleError("Google didn't share your email address.")
    return claims


def refresh_access_token(refresh_token: str) -> str:
    return _post_form(TOKEN_URL, {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    })["access_token"]


def revoke(token: str) -> None:
    """Best effort: the local copy is deleted either way."""
    try:
        _post_form(REVOKE_URL, {"token": token})
    except GoogleError:
        pass


# ---------------------------------------------------------------------------
# Gmail
# ---------------------------------------------------------------------------

def _gmail_get(access_token: str, path: str, params: Optional[dict] = None) -> dict:
    url = f"{GMAIL_API}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    return _request_json(req)


def search_messages(access_token: str, query: str, limit: int) -> list[dict]:
    """Newest first. Returns [{"id": ..., "threadId": ...}, ...]."""
    messages: list[dict] = []
    page_token = None
    while len(messages) < limit:
        params = {"q": query, "maxResults": min(100, limit - len(messages))}
        if page_token:
            params["pageToken"] = page_token
        data = _gmail_get(access_token, "messages", params)
        messages.extend(data.get("messages", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return messages[:limit]


def _collect_bodies(part: dict, plain: list[str], html: list[str]) -> None:
    mime = part.get("mimeType", "")
    data = part.get("body", {}).get("data")
    if data and not part.get("filename"):  # skip attachments
        text = _b64url_decode(data).decode("utf-8", errors="replace")
        if mime == "text/plain":
            plain.append(text)
        elif mime == "text/html":
            html.append(text)
    for child in part.get("parts", []):
        _collect_bodies(child, plain, html)


def get_message_headers(access_token: str, message_id: str) -> dict:
    """Sender, subject and date only (no body): {"from", "subject", "received_date"}."""
    msg = _gmail_get(access_token, f"messages/{urllib.parse.quote(message_id)}",
                     {"format": "metadata", "metadataHeaders": ["From", "Subject"]})
    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
    received = None
    if msg.get("internalDate"):
        received = datetime.fromtimestamp(int(msg["internalDate"]) / 1000, tz=timezone.utc).date().isoformat()
    return {"from": headers.get("from", ""), "subject": headers.get("subject", ""), "received_date": received}


def get_message(access_token: str, message_id: str) -> dict:
    """
    Returns {"text", "received_date", "thread_id", "subject"}. The text starts
    with From/Subject/Date lines, then the body (plain text preferred; HTML is
    converted to text).
    """
    msg = _gmail_get(access_token, f"messages/{urllib.parse.quote(message_id)}", {"format": "full"})
    payload = msg.get("payload", {})
    headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}

    plain: list[str] = []
    html: list[str] = []
    _collect_bodies(payload, plain, html)
    body = "\n\n".join(plain).strip() if plain else html_to_text("\n".join(html))
    if not body:
        body = msg.get("snippet", "")

    received = None
    if msg.get("internalDate"):
        received = datetime.fromtimestamp(int(msg["internalDate"]) / 1000, tz=timezone.utc).date().isoformat()

    header_lines = [f"{label}: {headers[key]}" for key, label in
                    (("from", "From"), ("subject", "Subject"), ("date", "Date")) if key in headers]
    return {
        "text": "\n".join(header_lines) + "\n\n" + body,
        "received_date": received,
        "thread_id": msg.get("threadId", message_id),
        "subject": headers.get("subject", ""),
    }
