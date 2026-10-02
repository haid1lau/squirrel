"""
BenefitIntelligence.py

Builds on app.py's OpenAI client to add the two remaining AI features from
the design spec:

  3. Urgency/value ranking + weekly digest — takes the user's confirmed
     benefit records and produces a ranked priority list plus a short
     plain-language summary ("3 benefits need attention this week...").
  4. RAG assistant — answers open-ended user questions grounded ONLY in
     their own stored benefit records, not the model's general knowledge
     about the providers named.

Both reuse call_structured() / call_text() from app.py, and operate
on `ExtractedBenefit` records — so there's one API client
configuration and one data shape for the whole app.
"""

import json
import re
from dataclasses import asdict
from datetime import date
from typing import List, Dict, Any, Optional

from app import ExtractedBenefit, call_structured, call_text


def _days_until(expiry_date: Optional[str], today: date) -> Optional[int]:
    """Computed in code so the model never has to do date arithmetic."""
    if not expiry_date:
        return None
    try:
        return (date.fromisoformat(expiry_date) - today).days
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# 3. Urgency-ranking + weekly digest
# ---------------------------------------------------------------------------

DIGEST_SCHEMA = {
    "type": "object",
    "properties": {
        "ranked_benefits": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "integer",
                        "description": "The id of the benefit from the input list.",
                    },
                    "urgency_score": {
                        "type": "integer",
                        "enum": [1, 2, 3, 4, 5],
                        "description": "1 (low) to 5 (act now) — weighs expiry proximity against stated/inferred value.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "One short phrase, e.g. 'expires in 4 days, high value'.",
                    },
                },
                "required": ["id", "urgency_score", "reason"],
                "additionalProperties": False,
            },
        },
        "digest_text": {
            "type": "string",
            "description": (
                "2-3 sentence plain-language weekly summary, e.g. "
                "'3 benefits need attention this week: your gym credit "
                "expires Friday, ...'"
            ),
        },
    },
    "required": ["ranked_benefits", "digest_text"],
    "additionalProperties": False,
}

DIGEST_SYSTEM_PROMPT = """\
You help prioritize a user's tracked benefits/vouchers/memberships. Given a \
list of benefits with their expiry dates, days until expiry, values, and \
types and categories, rank them by urgency — weighing how soon they expire against how \
valuable they seem (use the stated value if given, otherwise your best \
judgement from the type/category/terms). Refer to each benefit by its id, and rank \
every benefit exactly once.

Only reason about the benefits given to you. Do not invent benefits that \
aren't in the list, and never state a specific expiry date for anything \
marked needs_review: true — refer to those as "needs review" instead.
"""


def build_weekly_digest(
    benefits: List[ExtractedBenefit], today: Optional[date] = None
) -> Dict[str, Any]:
    """
    benefits: the user's currently tracked ExtractedBenefit records (mix of
    confirmed and needs_review is fine — the model is told which is which).

    Returns {"ranked_benefits": [{benefit_name, provider, urgency_score,
    reason}, ...], "digest_text": str}, sorted most urgent first.
    """
    if not benefits:
        return {"ranked_benefits": [], "digest_text": "You have no tracked benefits yet."}

    today = today or date.today()
    payload = [
        {
            "id": i,
            "benefit_name": b.benefit_name,
            "provider": b.provider,
            "type": b.type,
            "category": b.category,
            "value": b.value,
            "points": b.points,
            # Unverified dates are withheld so the model can't repeat them.
            "expiry_date": None if b.needs_review else b.expiry_date,
            "days_until_expiry": None if b.needs_review else _days_until(b.expiry_date, today),
            "needs_review": b.needs_review,
        }
        for i, b in enumerate(benefits)
    ]

    result = call_structured(
        DIGEST_SYSTEM_PROMPT,
        f"Today's date: {today.isoformat()}\n\nBenefits:\n{json.dumps(payload, indent=2)}",
        DIGEST_SCHEMA,
        effort="low",
        name="digest",
    )

    # Deterministic check: keep only ids that exist, each at most once, then
    # attach the real names from our records (never the model's spelling).
    ranked, seen = [], set()
    for item in result["ranked_benefits"]:
        i = item["id"]
        if not 0 <= i < len(benefits) or i in seen:
            continue
        seen.add(i)
        ranked.append({
            "benefit_name": benefits[i].benefit_name,
            "provider": benefits[i].provider,
            "urgency_score": item["urgency_score"],
            "reason": item["reason"],
        })
    ranked.sort(key=lambda r: r["urgency_score"], reverse=True)

    return {"ranked_benefits": ranked, "digest_text": result["digest_text"]}


# ---------------------------------------------------------------------------
# 4. RAG assistant — grounded Q&A over the user's own benefit records
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "before", "by", "can", "do",
    "does", "for", "from", "have", "how", "i", "in", "is", "it", "my", "of",
    "on", "or", "should", "that", "the", "this", "to", "use", "what", "when",
    "which", "will", "with", "any", "all", "me", "benefit", "benefits",
}


def _words(text: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOPWORDS}


def _retrieve_relevant_benefits(
    question: str, benefits: List[ExtractedBenefit], max_results: int = 8
) -> List[ExtractedBenefit]:
    """
    Simple keyword-overlap retrieval. A personal benefit tracker is a small
    dataset (tens, not millions, of records) — a full vector DB is overkill
    for the hackathon prototype, so this scores each record by how many
    question words (minus stopwords, whole-word match) appear in its text
    fields and returns the top matches. Swap in embeddings later if the
    dataset grows large enough to need it — worth noting as a known
    limitation in your README.
    """
    question_words = _words(question)

    def score(b: ExtractedBenefit) -> int:
        text = " ".join(
            filter(None, [b.benefit_name, b.provider, b.type, b.category, b.value, b.terms_summary])
        )
        return len(question_words & _words(text))

    scored = [(score(b), b) for b in benefits]
    scored.sort(key=lambda pair: pair[0], reverse=True)

    relevant = [b for s, b in scored if s > 0][:max_results]
    # Nothing scored above 0 — small dataset, so just hand over everything
    # rather than return an empty context.
    return relevant or benefits[:max_results]


ASSISTANT_SYSTEM_PROMPT = """\
You are a helpful assistant for a personal benefit/voucher tracker app. \
Answer the user's question using ONLY the benefit records provided below — \
never use outside knowledge about the providers named, and never invent a \
benefit, date, or term that isn't in the data. If the data doesn't contain \
enough information to answer, say so plainly rather than guessing.

Records with needs_review: true have not been verified — don't state their \
expiry dates as fact; tell the user to check them in the review queue.

When you reference a specific benefit, name it so the user can find it in \
their dashboard.
"""


def ask_about_benefits(
    question: str, benefits: List[ExtractedBenefit], today: Optional[date] = None
) -> str:
    """
    Grounded Q&A: retrieves the user's own relevant records and answers only
    from those — this is what keeps answers accurate to what the user
    actually has, rather than the model's general knowledge.
    """
    if not benefits:
        return "You don't have any tracked benefits yet, so there's nothing to answer from."

    today = today or date.today()
    relevant = _retrieve_relevant_benefits(question, benefits)
    records = [
        {**asdict(b), "days_until_expiry": _days_until(b.expiry_date, today)}
        for b in relevant
    ]

    return call_text(
        ASSISTANT_SYSTEM_PROMPT,
        f"Today's date: {today.isoformat()}\n\n"
        f"My tracked benefits:\n{json.dumps(records, indent=2)}\n\n"
        f"Question: {question}",
    )


if __name__ == "__main__":
    from app import extract_benefit_from_email

    sample = extract_benefit_from_email(
        """
        Subject: Your Gold Membership Renewal
        Hi Alex, your Gold Membership renews automatically. Your current benefits
        (free companion flight, lounge access) are valid for 6 months from your
        last renewal on 1 September 2026.
        """,
        received_date="2026-09-02",
    )

    digest = build_weekly_digest([sample])
    print("Digest:\n", json.dumps(digest, indent=2))

    answer = ask_about_benefits(
        "Which travel benefits should I use before March?", [sample]
    )
    print("\nAssistant answer:\n", answer)
