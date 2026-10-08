"""
app.py

Core AI detection engine for the benefit/voucher tracker.

Given raw email text (or OCR'd screenshot text), this calls OpenAI to extract
a structured benefit record. It uses structured outputs (a JSON schema the
API enforces) rather than "please return JSON" prompting, so the response
always matches the schema — no brittle string parsing.

Design principles this file implements (for your README's AI Integration
and AI Safety sections):
  1. Structured extraction is the detection engine, not a chatbot feature.
  2. The model NEVER invents a specific date without a stated or computable
     basis — ambiguous/unknown cases fall back to expiry_date=None and are
     routed to a "needs review" queue instead of being silently trusted.
  3. Validation (sanity-checking the model's output) is deterministic code,
     kept separate from the AI call itself.
"""

import json
import os
import socket
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, asdict, fields
from datetime import date
from typing import Optional, Union

import config  # noqa: F401  (loads .env so OPENAI_API_KEY / OPENAI_MODEL are set)

API_URL = "https://api.openai.com/v1/responses"
# Override with OPENAI_MODEL in .env, e.g. a smaller model to cut the cost of scans.
MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.5")
MAX_ATTEMPTS = 3  # rate limits, 5xx and connection errors are retried with backoff


class ExtractionError(Exception):
    """The model call finished but didn't produce a usable result."""


class AIError(Exception):
    """
    The OpenAI API call itself failed. `fatal` means every further call will
    fail the same way (e.g. no API key), so batch work should stop.
    """

    def __init__(self, message: str, fatal: bool = False, retryable: bool = False):
        super().__init__(message)
        self.fatal = fatal
        self.retryable = retryable  # worth trying again after a short wait


def describe_ai_error(e: Exception) -> tuple[str, bool] | None:
    """
    Turns an AI-call failure into (message for the user, fatal). Returns None
    for errors that aren't from the AI call.
    """
    if isinstance(e, ExtractionError):
        return str(e), False
    if isinstance(e, AIError):
        return str(e), e.fatal
    return None


def _api_error(status: int, body: bytes) -> AIError:
    try:
        error = json.loads(body).get("error") or {}
    except (ValueError, AttributeError):
        error = {}
    detail = error.get("message") or f"HTTP {status}"
    if status == 401:
        return AIError("OpenAI API key is missing or invalid. Check OPENAI_API_KEY in .env and restart the server.",
                       fatal=True)
    if status == 429 and error.get("code") == "insufficient_quota":
        return AIError("Your OpenAI account is out of credit. Add billing at platform.openai.com.", fatal=True)
    if status == 429:
        return AIError("OpenAI API rate limit reached. Wait a minute and try again.", fatal=True, retryable=True)
    if status == 404 and "model" in detail.lower():
        return AIError(f"OpenAI model '{MODEL}' isn't available to your account. Set OPENAI_MODEL in .env.",
                       fatal=True)
    return AIError(f"OpenAI API error ({status}): {detail}", retryable=status >= 500)


def _create_response(payload: dict) -> dict:
    """POSTs to the Responses API, retrying transient failures."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise AIError("No OpenAI API key found. Set OPENAI_API_KEY in .env and restart the server.", fatal=True)

    body = json.dumps({"model": MODEL, **payload}).encode()
    for attempt in range(1, MAX_ATTEMPTS + 1):
        request = urllib.request.Request(API_URL, data=body, method="POST", headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as e:
            error = _api_error(e.code, e.read())
            if not error.retryable or attempt == MAX_ATTEMPTS:
                raise error from e
            delay = float(e.headers.get("retry-after") or 2 ** attempt)
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as e:
            if attempt == MAX_ATTEMPTS:
                raise AIError("Couldn't reach the OpenAI API. Check your internet connection.", fatal=True) from e
            delay = 2 ** attempt
        time.sleep(min(delay, 30))
    raise AssertionError("unreachable")


def _output_text(response: dict) -> str:
    """Joins the reply text, turning refusals and cut-off output into ExtractionError."""
    if response.get("status") == "incomplete":
        reason = (response.get("incomplete_details") or {}).get("reason")
        if reason == "max_output_tokens":
            raise ExtractionError("model output was cut off (max_output_tokens)")
        raise ExtractionError(f"model stopped early ({reason or 'unknown reason'})")
    if response.get("error"):
        raise ExtractionError(f"model failed: {response['error'].get('message', 'unknown error')}")

    parts = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue  # reasoning items carry no reply text
        for content in item.get("content", []):
            if content.get("type") == "refusal":
                raise ExtractionError("model declined the request")
            if content.get("type") == "output_text":
                parts.append(content.get("text", ""))
    if not parts:
        raise ExtractionError("model returned no text output")
    return "".join(parts)


def _base_payload(system: str, user_content: str, effort: str) -> dict:
    return {
        "instructions": system,
        "input": user_content,
        "max_output_tokens": 16000,
        "reasoning": {"effort": effort},
        # Emails are personal: don't let OpenAI keep the response for later retrieval.
        "store": False,
    }


def call_structured(system: str, user_content: str, schema: dict, effort: str = "medium",
                    name: str = "result") -> dict:
    """
    One model call whose reply the API constrains to `schema` (strict
    structured outputs). Shared by every AI feature in the app so there's one
    place that handles refusals, truncation and parsing.

    Raises AIError on API failures and ExtractionError when the model
    refuses or its output is unusable.
    """
    payload = _base_payload(system, user_content, effort)
    payload["text"] = {"format": {"type": "json_schema", "name": name, "schema": schema, "strict": True}}
    text = _output_text(_create_response(payload))
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ExtractionError(f"model output was not valid JSON: {e}") from e


def call_text(system: str, user_content: str, effort: str = "low") -> str:
    """One model call that returns plain text. Same error handling as call_structured."""
    return _output_text(_create_response(_base_payload(system, user_content, effort)))


# ---------------------------------------------------------------------------
# 1. Output schema — the API constrains the model's reply to this exact shape
# ---------------------------------------------------------------------------

def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


# type: what kind of benefit it is. category: what it's spent on.
TYPES = ["membership", "subscription", "voucher", "other"]
CATEGORIES = ["entertainment", "transport", "travel", "dining", "wellness", "shopping", "other"]

BENEFIT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_benefit": {
            "type": "boolean",
            "description": (
                "False if this email is not actually about a membership, "
                "voucher, or account perk (e.g. it's spam, a receipt for a "
                "one-off purchase, or unrelated). If false, other fields "
                "may be empty strings."
            ),
        },
        "benefit_name": {"type": "string"},
        "provider": {"type": "string"},
        "type": {
            "type": "string",
            "description": "What kind of benefit it is.",
            "enum": TYPES,
        },
        "category": {
            "type": "string",
            "description": "What it's spent on, e.g. a coffee voucher is dining, an Uber credit is transport.",
            "enum": CATEGORIES,
        },
        "value": _nullable({
            "type": "string",
            "description": 'e.g. "$50", "1 free item", "20% off"',
        }),
        "expiry_date": _nullable({
            "type": "string",
            "description": "ISO 8601 YYYY-MM-DD; null if not explicit/computable",
        }),
        "expiry_confidence": {
            "type": "string",
            "enum": ["explicit", "computed", "ambiguous", "unknown"],
            "description": (
                "explicit: an exact date was stated. "
                "computed: a relative duration was given and you calculated "
                "the date (e.g. 'valid 6 months from purchase on 1 Jan 2026'). "
                "ambiguous: multiple possible readings or vague wording "
                "(e.g. 'use it soon', 'valid this quarter'). "
                "unknown: no expiry information found at all."
            ),
        },
        "expiry_reasoning": {
            "type": "string",
            "description": "One short sentence on how the date was derived, or why it's uncertain.",
        },
        "terms_summary": _nullable({
            "type": "string",
            "description": "One-sentence plain-language summary of key conditions.",
        }),
        "code": _nullable({
            "type": "string",
            "description": (
                "The voucher, promo or redemption code to type or show at checkout, copied exactly "
                "as written (e.g. \"BDAY-7Q2K\"). null if the email has no such code. Not an "
                "order number, account number or membership number."
            ),
        }),
        "source_snippet": {
            "type": "string",
            "description": "The exact phrase the expiry info was drawn from, for user verification.",
        },
    },
    "required": [
        "is_benefit",
        "benefit_name",
        "provider",
        "type",
        "category",
        "value",
        "expiry_date",
        "expiry_confidence",
        "expiry_reasoning",
        "terms_summary",
        "code",
        "source_snippet",
    ],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """\
You extract structured membership/benefit/voucher details from raw email text \
for a benefit-tracking app. Reply with one record per email.

Critical rule: NEVER guess a specific expiry_date without either an explicit \
stated date or a clearly computable one (e.g. an explicit duration plus an \
explicit start date). If the wording is vague, contradictory, or missing, set \
expiry_date to null and expiry_confidence to "ambiguous" or "unknown" — do not \
provide a plausible-sounding date. A missed reminder is a minor inconvenience; \
a wrong reminder date is a real failure for the user.

Copy any voucher or promo code exactly as written. Never make one up: if \
there's no code in the email, set code to null.

Reading dates (the user is in Singapore):
- Numeric dates are day/month/year unless the email is clearly American: \
"11/10/2026" is 11 October 2026 and "4/10/26" is 4 October 2026. A date \
written this way is explicit.
- "End of October 2026" means 31 October 2026 (explicit). A month or day \
with no year means the next one on or after the email's received date \
(computed).
- For a date range ("7 to 9 Oct", "valid 28 Sep - 18 Oct"), the expiry is \
the last day.
- If the email lists several coupons or deals, each with its own "valid \
until" or offer date, the expiry is the latest of those dates (explicit), \
even if it has passed. Only use the offers' own dates: never the date of an \
event, a campaign the benefit isn't part of, a travel period or an \
application deadline.
- The ongoing perks of a membership (member discounts, earning rates) have \
no expiry. A points or miles balance with some points expiring on a date \
expires on that date.

A benefit is something the user holds or can redeem: a voucher or promo code, \
a credit or rebate, a points balance, a membership or its perks, a free trial, \
a birthday reward, or a time-limited offer they can claim. Set is_benefit to \
false for marketing spam, an unrelated receipt or newsletter, a product or \
feature announcement, a menu or shelf price ("now $6.50"), a bonus for buying \
more of something ("buy 2,500 coins, get 200 free"), and ads for opening a new \
card, loan or account that the user doesn't have yet (including bonuses that \
need one, like "apply by 31 Oct for 20,000 miles").
"""


# ---------------------------------------------------------------------------
# 2. Result type
# ---------------------------------------------------------------------------

@dataclass
class ExtractedBenefit:
    is_benefit: bool
    benefit_name: str
    provider: str
    type: str
    category: str
    expiry_confidence: str
    expiry_reasoning: str
    source_snippet: str
    value: Optional[str] = None
    expiry_date: Optional[str] = None
    terms_summary: Optional[str] = None
    code: Optional[str] = None  # a voucher or promo code; kept only if it appears in the email (see validate)
    points: Optional[int] = None  # a points/miles balance, entered by the user (never by the model)
    reminder: Union[int, str, None] = None  # set by the user: None (their default), "off" or days before expiry
    needs_review: bool = False  # set by validate(), not by the model
    review_reason: Optional[str] = None  # set by validate(), not by the model
    used_on: Optional[str] = None  # set by the user: the date they used it up (YYYY-MM-DD)
    used_amount: Optional[float] = None  # set by the user: card credits only, how much of this period's credit is spent

    @classmethod
    def from_model_output(cls, data: dict) -> "ExtractedBenefit":
        # Only accept schema fields; never let the model set review, points, reminder or usage fields.
        allowed = {f.name for f in fields(cls)} - {
            "needs_review", "review_reason", "points", "reminder", "used_on", "used_amount"}
        return cls(**{k: v for k, v in data.items() if k in allowed})


# ---------------------------------------------------------------------------
# 3. The AI call itself
# ---------------------------------------------------------------------------

def extract_benefit_from_email(
    email_text: str,
    received_date: Optional[str] = None,
    today: Optional[date] = None,
) -> ExtractedBenefit:
    """
    Calls the model once to extract a structured benefit record from raw email text.
    Truncates very long emails (forwarded chains, quoted history) to keep the
    signal-to-noise ratio high — see README 'known failure modes' re: long
    forwarded threads.

    Raises AIError on API failures and ExtractionError when the
    model refuses or its output is unusable.
    """
    today = today or date.today()
    # Dates go in the user turn (not the system prompt) so the system prompt
    # stays byte-identical across calls and remains cacheable.
    context = f"Today's date: {today.isoformat()}\n"
    if received_date:
        context += f"Email received date: {received_date}\n"
    truncated = email_text[:8000]  # keep prompt focused; long threads are a documented limitation

    data = call_structured(SYSTEM_PROMPT, context + "\n" + truncated, BENEFIT_SCHEMA, name="benefit")
    extracted = ExtractedBenefit.from_model_output(data)
    return validate(extracted, today=today, email_text=truncated)


# ---------------------------------------------------------------------------
# 4. Deterministic validation layer — NOT an AI call
#    This is where you can show judges you don't blindly trust model output.
# ---------------------------------------------------------------------------

def _flag(extracted: ExtractedBenefit, reason: str) -> None:
    extracted.needs_review = True
    extracted.review_reason = extracted.review_reason or reason


def validate(
    extracted: ExtractedBenefit, today: Optional[date] = None, email_text: Optional[str] = None
) -> ExtractedBenefit:
    """
    Sanity-checks the model's output with plain code. Anything suspicious
    routes the record into the "needs review" queue instead of silently
    entering the main tracker.
    """
    today = today or date.today()

    # A code is only kept if it appears in the email word for word, so the
    # model can't invent one. A wrong code at the till is worse than none.
    code = (extracted.code or "").strip()
    if not code or len(code) > 64 or (email_text is not None and code not in email_text):
        code = None
    extracted.code = code

    if extracted.expiry_confidence in ("ambiguous", "unknown"):
        extracted.expiry_date = None
        _flag(extracted, f"expiry is {extracted.expiry_confidence}")

    elif not extracted.expiry_date:
        # Model claimed explicit/computed confidence but gave no date.
        _flag(extracted, f"confidence '{extracted.expiry_confidence}' but no date given")

    if extracted.expiry_date:
        try:
            parsed = date.fromisoformat(extracted.expiry_date)
        except ValueError:
            extracted.expiry_date = None
            _flag(extracted, "expiry date is not a valid YYYY-MM-DD date")
        else:
            days_out = (parsed - today).days
            # Already expired or implausibly far out — likely a misread date.
            # Flag rather than trust.
            if days_out < 0:
                _flag(extracted, "expiry date is in the past")
            elif days_out > 365 * 5:
                _flag(extracted, "expiry date is more than 5 years away")

    return extracted


# ---------------------------------------------------------------------------
# 5. Example batch runner — wire this to your Gmail/Outlook connector
# ---------------------------------------------------------------------------

def process_inbox_batch(emails: list[dict]) -> dict:
    """
    emails: list of {"text": str, "received_date": str | None}
    Returns {"confirmed": [...], "needs_review": [...], "skipped": int,
             "errors": [{"index": int, "error": str}, ...]}

    One failed email is recorded in "errors" and never stops the batch.
    (_create_response already retries rate limits, 5xx and connection errors.)
    """
    confirmed, needs_review, errors, skipped = [], [], [], 0

    for i, email in enumerate(emails):
        try:
            result = extract_benefit_from_email(
                email["text"], email.get("received_date")
            )
        except (AIError, ExtractionError) as e:
            errors.append({"index": i, "error": f"{type(e).__name__}: {e}"})
            continue

        if not result.is_benefit:
            skipped += 1
            continue
        if result.needs_review:
            needs_review.append(result)
        else:
            confirmed.append(result)

    return {
        "confirmed": confirmed,
        "needs_review": needs_review,
        "skipped": skipped,
        "errors": errors,
    }


if __name__ == "__main__":
    # Quick manual test — replace with a real sample email before demo day.
    sample_email = """
    Subject: Your Gold Membership Renewal

    Hi Alex, your Gold Membership renews automatically. Your current benefits
    (free companion flight, lounge access) are valid for 6 months from your
    last renewal on 1 September 2026.
    """
    result = extract_benefit_from_email(sample_email, received_date="2026-09-02")
    print(json.dumps(asdict(result), indent=2))
