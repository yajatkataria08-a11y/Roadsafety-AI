"""
/debug — Development-only diagnostic endpoint

⚠️  This route is disabled unless the environment variable DEBUG_MODE=true is set.
    Never expose this in production — it leaks intent scores and internal state.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.models.bilstm import predict_intent, extract_entities
from app.rag.retriever import rag_search_multi
from app.utils.helpers import detect_emergency

router = APIRouter()

_DEBUG_ENABLED = os.environ.get("DEBUG_MODE", "").lower() in ("1", "true", "yes")


def _require_debug():
    if not _DEBUG_ENABLED:
        raise HTTPException(
            status_code=403,
            detail=(
                "Debug endpoint is disabled in production. "
                "Set DEBUG_MODE=true to enable it."
            ),
        )


class DebugRequest(BaseModel):
    message: str
    country: Optional[str] = "India"


@router.post("/")
async def debug_query(req: DebugRequest):
    _require_debug()

    intent, confidence = predict_intent(req.message)
    entities           = extract_entities(req.message)
    is_emergency       = detect_emergency(req.message)
    rag_hits           = rag_search_multi(req.message, top_k=3)

    return {
        "query":   req.message,
        "intent": {
            "label":                  intent,
            "confidence":             confidence,
            "is_emergency":           is_emergency,
            "would_ask_clarification": confidence < 0.55 and not is_emergency,
        },
        "entities":       entities,
        "rag_top3":       rag_hits,
        "resolution_path": _resolution_path(entities, req.country, rag_hits),
    }


def _resolution_path(entities: dict, fallback_country: str,
                     rag_hits: list) -> str:
    country   = entities.get("country") or fallback_country
    state     = entities.get("state")
    city      = entities.get("location")
    violation = entities.get("violation")

    if not violation:
        if rag_hits:
            return "RAG (no violation entity found in query)"
        return "Generic fallback (no violation, no RAG results)"

    if city:
        return f"Structured DB → city match [{city}]"
    if state:
        return f"Structured DB → state match [{state}]"
    if country:
        return f"Structured DB → country match [{country}]"
    if rag_hits:
        return "RAG (location too generic)"
    return "Generic fallback"


# ── v5: LLM Reasoning Layer diagnostics ───────────────────────────────────────

@router.get("/llm-stats")
async def llm_stats():
    """Returns current LLM token usage, cost estimate, and cache stats."""
    _require_debug()
    from app.services.llm_reasoner import get_usage_stats
    return get_usage_stats()


@router.post("/llm-test")
async def llm_test(req: DebugRequest):
    """
    Runs a query directly through llm_reason() and returns the full
    LLMReasoningResult for inspection. Useful for prompt tuning.
    """
    _require_debug()
    from app.services.llm_reasoner import llm_reason, is_complex_query
    from app.models.intent_classifier import predict_intent

    intent, confidence = predict_intent(req.message)
    would_use_llm = is_complex_query(req.message, confidence)

    result = await llm_reason(
        message=req.message,
        context={"country": req.country},
        fast_path_intent=intent,
        fast_path_confidence=confidence,
    )

    return {
        "fast_path": {
            "intent":        intent,
            "confidence":    confidence,
            "would_use_llm": would_use_llm,
        },
        "llm_result": result.model_dump(),
    }
