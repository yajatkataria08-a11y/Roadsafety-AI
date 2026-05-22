"""
/chat  — Core chatbot route  (v6 — Smart Crash Mode Edition)
════════════════════════════════════════════════════════════════════════════════
What's new in v6:

  SMART EMERGENCY DETECTION
  ──────────────────────────
  • Expanded Hindi + Hinglish keyword coverage in detect_emergency_scored()
    (helpers.py v6): "accident ho gaya", "madad", "takkar", "bachao", etc.
  • Two-tier keyword scoring:
      CRITICAL keywords → 0.98  (bahut khoon, hosh nahi, saans nahi …)
      PRIMARY keywords  → 0.95  (madad, help, ambulance chahiye …)
      Regex patterns    → 0.85  (accident + injury combo phrases)
      Ambiguous + urgency → 0.65
  • Hard guard: 2+ fine/legal signals → score = 0.0 (no false emergency for
    "accident ka fine kitna hoga" style queries)
  • Emergency fires ONLY if intent != DriveLegal (unchanged guard)

  CRASH MODE RESPONSE (handle_roadsos v6)
  ─────────────────────────────────────────
  • Severity banner (CRITICAL 🔴 / SERIOUS 🟠 / MILD 🟡)
  • Colour-coded urgency block with first-aid advice
  • Always-visible hotline bar: Emergency | Ambulance | Police
  • Per-service cards: distance, ETA, phone, Google Maps deep link
    Priority: Trauma Centre → Hospital → Ambulance Station → Police
  • Authority dispatch badge (incident_id, channels notified)
  • No-location flow: NER city extraction → Nominatim → GPS prompt

  Everything else (LLM path, session history, rate limiting) is unchanged
  from v5 for backward compatibility.
"""

from __future__ import annotations

import time
from typing import Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

# ── Optional rate limiting ─────────────────────────────────────────────────────
import ipaddress as _ipaddress, os as _os

# Trusted proxy CIDRs — only these direct-client IPs may set X-Forwarded-For.
# Extend via TRUSTED_PROXIES env var (comma-separated CIDRs or IPs).
_BUILTIN_TRUSTED = [
    "127.0.0.0/8",      # localhost / loopback
    "10.0.0.0/8",       # Docker / private-A
    "172.16.0.0/12",    # Docker compose / private-B
    "192.168.0.0/16",   # LAN / private-C
    "::1/128",          # IPv6 loopback
    "fc00::/7",         # IPv6 ULA
]
_TRUSTED_PROXY_NETS: list = []

def _build_trusted_nets() -> list:
    """Build once on first call — merges built-in + env-supplied CIDRs."""
    if _TRUSTED_PROXY_NETS:
        return _TRUSTED_PROXY_NETS
    for cidr in _BUILTIN_TRUSTED:
        _TRUSTED_PROXY_NETS.append(_ipaddress.ip_network(cidr, strict=False))
    extra = _os.getenv("TRUSTED_PROXIES", "")
    for item in extra.split(","):
        item = item.strip()
        if item:
            try:
                _TRUSTED_PROXY_NETS.append(_ipaddress.ip_network(item, strict=False))
            except ValueError:
                pass  # ignore malformed entries
    return _TRUSTED_PROXY_NETS


def _is_trusted_proxy(ip_str: str) -> bool:
    """Check if the direct-connecting client IP is a trusted proxy."""
    try:
        addr = _ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return any(addr in net for net in _build_trusted_nets())


def _get_real_ip(request: Request) -> str:
    """
    Secure IP extraction with trusted-proxy whitelist.

    Only honours X-Forwarded-For / X-Real-IP when the direct TCP peer
    (request.client.host) is a known proxy.  Otherwise the client could
    spoof the header to bypass rate limiting.
    """
    direct_ip = getattr(request.client, "host", "127.0.0.1")

    if _is_trusted_proxy(direct_ip):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

    return direct_ip

try:
    from slowapi import Limiter
    _limiter = Limiter(key_func=_get_real_ip)
    def rate_limit(limit_str: str):
        return _limiter.limit(limit_str)
except ImportError:
    def rate_limit(limit_str: str):
        def noop(fn): return fn
        return noop

# ── Existing fast-path services ────────────────────────────────────────────────
from app.models.intent_classifier import predict_intent
from app.services.drivelegal      import handle_drivelegal
from app.services.roadsos         import handle_roadsos, detect_severity
from app.services.roadwatch       import handle_roadwatch_async as handle_roadwatch
from app.utils.helpers            import detect_emergency_scored

# ── v11: Intelligent Entity Extractor ─────────────────────────────────────────
from app.models.entity_extractor  import extract as extract_entities_v11

# ── LLM Reasoning Layer (v5) ──────────────────────────────────────────────────
from app.services.llm_reasoner import (
    llm_reason,
    is_complex_query,
    format_response_with_meta,
    LLMReasoningResult,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Request / Response schemas
# ═══════════════════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    message:      str             = Field(..., min_length=1, max_length=2000)
    lat:          Optional[float] = Field(None, ge=-90,  le=90)
    lon:          Optional[float] = Field(None, ge=-180, le=180)
    country:      Optional[str]   = Field("India", max_length=64)
    session_id:   Optional[str]   = Field(None, max_length=128,
                                          description="Client session ID for conversation memory")
    vehicle_type: Optional[str]   = Field(None, max_length=32,
                                          description="Vehicle type: two_wheeler|lmv|hmv|bus|auto|all")


class ChatResponse(BaseModel):
    intent:            str
    confidence:        float
    response:          str
    source:            str
    # v5+ enrichment — optional, frontend can ignore
    related_questions: List[str]     = Field(default_factory=list)
    safety_tip:        Optional[str] = None
    llm_used:          bool          = False
    # v11 — extracted entities (DriveLegalResult | RoadSoSResult | RoadWatchResult as dict)
    entities_v11:      Optional[dict] = None


# ═══════════════════════════════════════════════════════════════════════════════
# Session history management  (v10 — DB-backed with in-memory LRU cache)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Architecture: DB (SQLite/Postgres) is the source of truth.
# In-memory dict is an L1 cache for single-worker deploys (dev/hackathon).
#
# For multi-worker (gunicorn -w N):
#   Set DISABLE_SESSION_CACHE=1 → all reads go directly to DB.
#   For production at scale, replace with Redis (REDIS_URL env).
# ═══════════════════════════════════════════════════════════════════════════════

import json as _json
from functools import lru_cache as _lru_cache

SESSION_TTL_SECS  = 1800   # 30 min inactivity clears history
HISTORY_MAX_TURNS = 12     # max turns kept per session

# In-memory LRU cache — disabled for multi-worker deploys
_USE_MEMORY_CACHE = not os.environ.get("DISABLE_SESSION_CACHE", "").strip()
_session_cache: Dict[str, Dict] = {}
_CACHE_MAX = 256


def _get_session_id(request: Request, req: ChatRequest) -> str:
    if req.session_id:
        return req.session_id
    header = request.headers.get("X-Session-ID")
    if header:
        return header
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return getattr(request.client, "host", "default")


def _get_history(session_id: str) -> List[dict]:
    """Load session history from cache → DB. Respects TTL."""
    now = time.time()

    # Check in-memory cache first (skipped in multi-worker mode)
    if _USE_MEMORY_CACHE:
        cached = _session_cache.get(session_id)
        if cached:
            if now - cached["ts"] > SESSION_TTL_SECS:
                _session_cache.pop(session_id, None)
                _clear_db_session(session_id)
                return []
            return list(cached["history"])

    # Fall back to DB
    try:
        from app.utils.db import SessionLocal, SessionHistory
        db = SessionLocal()
        try:
            row = db.query(SessionHistory).filter(
                SessionHistory.session_id == session_id
            ).first()
            if row:
                if now - row.updated_at.timestamp() > SESSION_TTL_SECS:
                    db.delete(row)
                    db.commit()
                    return []
                history = _json.loads(row.history_json or "[]")
                if _USE_MEMORY_CACHE:
                    _session_cache[session_id] = {"history": history, "ts": row.updated_at.timestamp()}
                return list(history)
        finally:
            db.close()
    except Exception as e:
        print(f"[Session] DB read failed (non-fatal): {e}")
    return []


def _update_history(session_id: str, user_msg: str, bot_msg: str) -> None:
    """Append to session history in cache + DB."""
    now = time.time()
    cached = _session_cache.get(session_id, {"history": [], "ts": now})
    history = cached["history"]
    history.append({"role": "user",      "content": user_msg})
    history.append({"role": "assistant", "content": bot_msg[:500]})
    if len(history) > HISTORY_MAX_TURNS:
        history = history[-HISTORY_MAX_TURNS:]

    # Update in-memory cache (skipped in multi-worker mode)
    if _USE_MEMORY_CACHE:
        if len(_session_cache) >= _CACHE_MAX and session_id not in _session_cache:
            oldest = next(iter(_session_cache))
            _session_cache.pop(oldest, None)
        _session_cache[session_id] = {"history": history, "ts": now}

    # Persist to DB asynchronously
    try:
        from app.utils.db import SessionLocal, SessionHistory
        from datetime import datetime
        db = SessionLocal()
        try:
            row = db.query(SessionHistory).filter(
                SessionHistory.session_id == session_id
            ).first()
            if row:
                row.history_json = _json.dumps(history)
                row.updated_at = datetime.utcnow()
            else:
                db.add(SessionHistory(
                    session_id=session_id,
                    history_json=_json.dumps(history),
                ))
            db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"[Session] DB write failed (non-fatal): {e}")


def _clear_db_session(session_id: str) -> None:
    """Remove expired session from DB."""
    try:
        from app.utils.db import SessionLocal, SessionHistory
        db = SessionLocal()
        try:
            db.query(SessionHistory).filter(
                SessionHistory.session_id == session_id
            ).delete()
            db.commit()
        finally:
            db.close()
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# Async DB logger
# ═══════════════════════════════════════════════════════════════════════════════

def _sync_write_chat_log(
    message: str, intent: str, confidence: float,
    source: str, country: str,
    lat: Optional[float], lon: Optional[float],
) -> None:
    from app.utils.db import SessionLocal, ChatLog
    db = SessionLocal()
    try:
        db.add(ChatLog(
            message=message, intent=intent, confidence=confidence,
            source=source, country=country, lat=lat, lon=lon,
        ))
        db.commit()
    finally:
        db.close()


async def _log_chat(
    message: str, intent: str, confidence: float,
    source: str, country: str,
    lat: Optional[float], lon: Optional[float],
) -> None:
    try:
        from app.utils.db import run_sync_db
        await run_sync_db(
            _sync_write_chat_log,
            message, intent, confidence, source, country, lat, lon,
        )
    except Exception as e:
        print(f"[ChatLog] write failed (non-fatal): {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# Emergency detection  (v6 — tuned threshold + DriveLegal guard)
# ═══════════════════════════════════════════════════════════════════════════════

_EMERGENCY_THRESHOLD = 0.5


def _is_emergency(message: str, intent: str) -> bool:
    """
    Returns True if the message is a live emergency AND intent != DriveLegal.

    Uses detect_emergency_scored() from helpers v6 which has:
      - Expanded Hindi / Hinglish keyword lists
      - Hard block for legal/fine queries (2+ fine signals → 0.0)
      - Severity-tiered scoring (critical 0.98, primary 0.95, pattern 0.85)
    """
    if intent == "DriveLegal":
        return False
    score = detect_emergency_scored(message)
    return score >= _EMERGENCY_THRESHOLD


# ═══════════════════════════════════════════════════════════════════════════════
# LLM-path response builder
# ═══════════════════════════════════════════════════════════════════════════════

async def _handle_with_llm(
    message: str,
    llm_result: LLMReasoningResult,
    lat: Optional[float],
    lon: Optional[float],
    country: str,
    vehicle_type: str = "all",
) -> str:
    """
    Executes any tool_calls requested by the LLM and builds the final response.

    Decision tree:
      1. LLM has final_response + no tool_calls → use LLM response directly
      2. LLM has tool_calls → execute them, merge with LLM framing
      3. LLM response empty + no tool_calls → fallback string

    vehicle_type is propagated from the request context so that LLM-routed
    DriveLegal calls get the same vehicle-aware fine lookup as the fast path.
    """
    if llm_result.final_response and not llm_result.tool_calls:
        return format_response_with_meta(llm_result)

    tool_responses: List[str] = []

    for tool_call in llm_result.tool_calls:
        tool_name = tool_call.tool.lower()

        if tool_name == "drivelegal":
            # Resolve vehicle_type: tool_call params > LLM entities > request context
            vt = (
                tool_call.params.get("vehicle_type")
                or (llm_result.entities.vehicle_type if llm_result.entities else None)
                or vehicle_type
                or "all"
            )
            tool_responses.append(
                handle_drivelegal(message, country, vehicle_type=vt)
            )

        elif tool_name == "roadsos":
            tool_responses.append(await handle_roadsos(
                message=message, lat=lat, lon=lon, country=country,
            ))

        elif tool_name == "roadwatch":
            tool_responses.append(await handle_roadwatch(message, lat, lon))

    if tool_responses:
        base = llm_result.final_response.strip()
        if base:
            merged = base + "\n\n---\n\n" + "\n\n".join(tool_responses)
        else:
            merged = "\n\n".join(tool_responses)
        enriched = llm_result.model_copy(update={"final_response": merged})
        return format_response_with_meta(enriched)

    return format_response_with_meta(llm_result) or (
        "I'm having trouble generating a response. Please try rephrasing."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@rate_limit("30/minute")
@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: Request, req: ChatRequest) -> ChatResponse:
    """
    Hybrid chat endpoint v6.

    Pipeline:
      1. Intent classification (fast path, always)
      2. Emergency override (Crash Mode v6 — Hindi/Hinglish aware)
         → Fires handle_roadsos() which returns rich Markdown with:
           severity banner, hotline bar, nearest services, dispatch badge
      3. Complexity check → FAST PATH or LLM PATH
         FAST PATH: DriveLegal / RoadSoS / RoadWatch handlers
         LLM PATH:  llm_reason() → structured output → tool execution
      4. Session history update
      5. Async DB log
    """
    message    = req.message.strip()
    country    = req.country or "India"
    session_id = _get_session_id(request, req)

    # v11 — initialise here so all code paths can reference it
    entities_v11 = None

    # ── Step 1: Intent classification ──────────────────────────────────────────
    intent, confidence = predict_intent(message)

    # ── Step 2: Emergency override (Crash Mode v6 + v11 severity hint) ─────────
    if _is_emergency(message, intent):
        # Run extractor early so severity hint flows into handle_roadsos
        entities_v11  = extract_entities_v11(message, predicted_intent="RoadSoS")
        severity      = getattr(entities_v11, "severity", None) or detect_severity(message)
        em_source     = f"crash_mode_{severity.lower()}"
        crash_response = await handle_roadsos(
            message=message, lat=req.lat, lon=req.lon, country=country,
            severity_hint=severity,
        )
        _update_history(session_id, message, crash_response)
        await _log_chat(message, "Emergency", 1.0, em_source, country, req.lat, req.lon)

        return ChatResponse(
            intent="Emergency",
            confidence=1.0,
            response=crash_response,
            source=em_source,
            related_questions=[
                "What to do while waiting for ambulance?",
                "How to give first aid after road accident?",
                "How to file an accident FIR?",
                "What is the Golden Hour in road accidents?",
            ],
            safety_tip=(
                "Always keep these saved: 112 (Emergency), 108 (Ambulance), "
                "100 (Police). Calling 112 locates you automatically — no GPS needed."
            ),
            llm_used=False,
        )

    # ── Step 3: Complexity routing ─────────────────────────────────────────────
    history = _get_history(session_id)
    use_llm = is_complex_query(message, confidence)

    # ── LLM PATH ───────────────────────────────────────────────────────────────
    if use_llm:
        context = {
            "country":              country,
            "lat":                  req.lat,
            "lon":                  req.lon,
            "fast_path_intent":     intent,
            "fast_path_confidence": confidence,
            "vehicle_type":         req.vehicle_type or "all",
        }
        llm_result = await llm_reason(
            message=message,
            history=history,
            context=context,
            fast_path_intent=intent,
            fast_path_confidence=confidence,
            skip_cache=bool(history),
        )

        if not llm_result.fallback_used:
            final_intent     = llm_result.primary_intent
            final_confidence = llm_result.confidence
            llm_source       = f"{final_intent.lower()}_llm_{llm_result.provider}"

            response_text = await _handle_with_llm(
                message, llm_result, req.lat, req.lon, country,
                vehicle_type=req.vehicle_type or context.get("vehicle_type", "all"),
            )

            _update_history(session_id, message, response_text)
            await _log_chat(
                message, final_intent, final_confidence,
                llm_source, country, req.lat, req.lon,
            )

            return ChatResponse(
                intent=final_intent,
                confidence=round(final_confidence, 2),
                response=response_text,
                source=llm_source,
                related_questions=llm_result.related_questions,
                safety_tip=llm_result.safety_tip,
                llm_used=True,
            )

        # LLM fallback_used=True → continue to fast path

    # ── FAST PATH: Low-confidence clarification ────────────────────────────────
    if confidence < 0.55:
        clarification = (
            "मुझे समझ नहीं आया / I'm not sure what you need. Are you asking about:\n\n"
            "- 🚔 **Traffic fine or road rule?** (e.g. 'helmet challan kitna hai')\n"
            "- 🚨 **Emergency help?** (e.g. 'accident ho gaya, madad chahiye')\n"
            "- 🛣 **Road hazard report?** (e.g. 'pothole on MG Road')\n\n"
            "Please rephrase your question and I'll assist right away! 🙏"
        )
        _update_history(session_id, message, clarification)
        await _log_chat(message, "Unclear", confidence, "low_confidence", country, req.lat, req.lon)

        return ChatResponse(
            intent="Unclear",
            confidence=round(confidence, 2),
            response=clarification,
            source="low_confidence",
            related_questions=[
                "Helmet fine in Indore?",
                "Nearest hospital from my location?",
                "How to report a pothole?",
            ],
            llm_used=False,
        )

    # ── FAST PATH: Route to handler (v11 — entity-extractor aware) ────────────
    # Run entity extraction once; downstream handlers consume the rich result.
    entities_v11 = extract_entities_v11(message, predicted_intent=intent)

    if intent == "DriveLegal":
        # Prefer: explicit UI selection > extractor > "all"
        vehicle_type = (
            req.vehicle_type
            or getattr(entities_v11, "vehicle_type", None)
            or "all"
        )
        # Feed extracted geo context to drivelegal for tighter city/state match
        ent_city    = getattr(entities_v11, "city",    None)
        ent_state   = getattr(entities_v11, "state",   None)
        ent_country = getattr(entities_v11, "country", None) or country
        ent_repeat  = getattr(entities_v11, "repeat_offence", False)
        response = handle_drivelegal(
            message, ent_country,
            vehicle_type=vehicle_type,
            city=ent_city,
            state=ent_state,
            repeat_offence=ent_repeat,
        )

    elif intent == "RoadSoS":
        response = await handle_roadsos(
            message=message, lat=req.lat, lon=req.lon, country=country,
            severity_hint=getattr(entities_v11, "severity", None),
            service_type_hint=getattr(entities_v11, "service_type", None),
        )

    elif intent == "RoadWatch":
        response = await handle_roadwatch(
            message, req.lat, req.lon,
            issue_type_hint=getattr(entities_v11, "issue_type", None),
            urgency_hint=getattr(entities_v11, "urgency", None),
        )

    else:
        response = (
            "Sorry, I couldn't understand your request. Please try again.\n\n"
            "You can ask me about:\n"
            "- 🚔 Traffic fines and road rules\n"
            "- 🚨 Emergency services near you\n"
            "- 🛣 Road hazard reporting"
        )

    # ── Step 4 & 5: History + log ──────────────────────────────────────────────
    _update_history(session_id, message, response)
    await _log_chat(message, intent, confidence, intent.lower(), country, req.lat, req.lon)

    return ChatResponse(
        intent=intent,
        confidence=round(confidence, 2),
        response=response,
        source=intent.lower(),
        llm_used=False,
        entities_v11=entities_v11.to_dict() if entities_v11 is not None else None,
    )
