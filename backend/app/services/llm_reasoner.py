"""
LLM Reasoning Layer — Road Safety AI  (v1.0 — Hackathon Edition)
═══════════════════════════════════════════════════════════════════════════════
Integrates a Gemini Flash / Groq Llama-3.1 LLM on top of the existing
rule-based + RAG pipeline.  Acts as the "brain" for complex, vague,
multi-intent, Hinglish, or emotionally charged queries.

Architecture (Hybrid Pipeline):
  ┌─────────────────────────────────────────────────────────────┐
  │ User Query                                                  │
  └────────────────────────┬────────────────────────────────────┘
                           ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  COMPLEXITY ROUTER  (is_complex_query)                      │
  │  • Multi-intent detection                                   │
  │  • Hinglish / emotional markers                             │
  │  • Confidence threshold gating  (< 0.65)                   │
  └────────────────────────┬────────────────────────────────────┘
            ┌──────────────┴──────────────┐
            ▼ FAST PATH                   ▼ LLM PATH
  ┌─────────────────────┐    ┌────────────────────────────────────┐
  │ Rule-based + RAG    │    │ Gemini Flash (primary)             │
  │ (low latency,       │    │  ├─ Fallback: Groq Llama-3.1-70B  │
  │  zero LLM cost)     │    │  └─ Fallback: graceful degradation │
  └─────────────────────┘    └────────────────────────────────────┘
                                          ▼
                             ┌────────────────────────────────────┐
                             │  Structured JSON Response           │
                             │  • intent + sub_intents             │
                             │  • entities (location, vehicle, etc)│
                             │  • tool_calls (DriveLegal/SoS/Watch)│
                             │  • final_response (Markdown)        │
                             │  • confidence + related_questions   │
                             └────────────────────────────────────┘

Key design choices:
  • Gemini Flash first — cheapest + fastest Google LLM, ~$0.075/1M tokens
  • Groq Llama-3.1-70B as hot standby — free tier, 6000 req/day
  • In-memory LRU cache (max 512 entries, 30-min TTL) for repeated queries
  • Conversation history: last 6 turns (3 user + 3 assistant) per session
  • Full structured JSON output with Pydantic validation
  • Token usage tracking across all providers
  • All LLM calls wrapped in try/except with graceful fast-path fallback
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 1.  CONFIGURATION & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# API keys — read from environment (set in .env, never hard-coded)
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY:   str = os.getenv("GROQ_API_KEY", "")

# Provider endpoints
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent?key={api_key}"
)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Models
GEMINI_MODEL = "gemini-1.5-flash"
GROQ_MODEL   = "llama-3.1-70b-versatile"   # Groq's fastest 70B

# Confidence threshold below which we escalate to LLM
LLM_CONFIDENCE_THRESHOLD = 0.65

# LRU cache settings
CACHE_MAX_SIZE = 512      # max entries
CACHE_TTL_SECS = 1800     # 30 minutes

# Conversation history window (number of prior TURNS to include)
HISTORY_WINDOW = 6        # 3 user + 3 assistant

# Max tokens per LLM call (keep cheap)
MAX_OUTPUT_TOKENS = 800

# HTTP timeout for LLM APIs
HTTP_TIMEOUT = 12.0       # seconds

# ═══════════════════════════════════════════════════════════════════════════════
# 2.  TOKEN USAGE TRACKER  (cost monitoring)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TokenUsage:
    """Cumulative token usage across all LLM calls this process lifetime."""
    gemini_input:  int = 0
    gemini_output: int = 0
    groq_input:    int = 0
    groq_output:   int = 0
    cache_hits:    int = 0
    total_calls:   int = 0

    @property
    def estimated_cost_usd(self) -> float:
        """
        Rough cost estimate.
        Gemini Flash: $0.075/1M input, $0.30/1M output
        Groq Llama-3.1-70B: free tier (0 cost here)
        """
        gemini_cost = (
            (self.gemini_input  / 1_000_000) * 0.075 +
            (self.gemini_output / 1_000_000) * 0.30
        )
        return round(gemini_cost, 6)

    def summary(self) -> Dict[str, Any]:
        return {
            "gemini_tokens": self.gemini_input + self.gemini_output,
            "groq_tokens":   self.groq_input   + self.groq_output,
            "cache_hits":    self.cache_hits,
            "total_calls":   self.total_calls,
            "est_cost_usd":  self.estimated_cost_usd,
        }


# Singleton — imported by other modules for monitoring
USAGE = TokenUsage()


# ═══════════════════════════════════════════════════════════════════════════════
# 3.  IN-MEMORY LRU CACHE  (with TTL)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class _CacheEntry:
    value:      Any
    expires_at: float   # Unix timestamp


class _TTLCache:
    """
    Simple dict-based cache with:
      - TTL expiry per entry
      - LRU eviction when max_size reached
      - Thread-safe (GIL is sufficient for CPython dict ops)
    """

    def __init__(self, max_size: int = 512, ttl: int = 1800):
        self._store: Dict[str, _CacheEntry] = {}
        self._max_size = max_size
        self._ttl = ttl

    def _make_key(self, query: str) -> str:
        """Normalise + hash the query for stable cache keys."""
        normalised = query.strip().lower()
        return hashlib.sha256(normalised.encode()).hexdigest()[:16]

    def get(self, query: str) -> Optional[Any]:
        key = self._make_key(query)
        entry = self._store.get(key)
        if entry is None:
            return None
        if time.time() > entry.expires_at:
            del self._store[key]
            return None
        # Move to end (LRU)
        self._store[key] = self._store.pop(key)
        return entry.value

    def set(self, query: str, value: Any) -> None:
        key = self._make_key(query)
        # Evict oldest if at capacity
        if len(self._store) >= self._max_size:
            oldest_key = next(iter(self._store))
            del self._store[oldest_key]
        self._store[key] = _CacheEntry(
            value=value,
            expires_at=time.time() + self._ttl
        )

    def invalidate(self, query: str) -> None:
        key = self._make_key(query)
        self._store.pop(key, None)

    @property
    def size(self) -> int:
        return len(self._store)


# Module-level cache singleton
_cache = _TTLCache(max_size=CACHE_MAX_SIZE, ttl=CACHE_TTL_SECS)


# ═══════════════════════════════════════════════════════════════════════════════
# 4.  STRUCTURED OUTPUT SCHEMAS  (Pydantic)
# ═══════════════════════════════════════════════════════════════════════════════

class ExtractedEntities(BaseModel):
    """NER output from the LLM — all fields optional."""
    location:     Optional[str]  = Field(None, description="City / area mentioned (e.g. 'Vijay Nagar, Indore')")
    state:        Optional[str]  = Field(None, description="Indian state or BIMSTEC country region")
    country:      Optional[str]  = Field(None, description="Country (default India)")
    vehicle_type: Optional[str]  = Field(None, description="bike / car / truck / auto / bus / unknown")
    violation:    Optional[str]  = Field(None, description="Specific violation (e.g. 'no helmet', 'overspeeding')")
    severity:     Optional[str]  = Field(None, description="CRITICAL / SERIOUS / MILD / NONE")
    user_emotion: Optional[str]  = Field(None, description="calm / anxious / angry / panicked / neutral")
    fine_amount:  Optional[str]  = Field(None, description="Mentioned fine amount if any")
    time_context: Optional[str]  = Field(None, description="Past / present / future context of the query")


class ToolCallSpec(BaseModel):
    """Describes a tool the LLM wants the orchestrator to invoke."""
    tool:   str              = Field(..., description="drivelegal | roadsos | roadwatch")
    reason: str              = Field(..., description="Why this tool is needed")
    params: Dict[str, Any]   = Field(default_factory=dict)


class LLMReasoningResult(BaseModel):
    """
    Full structured result from the LLM reasoning layer.
    All downstream code should consume this instead of raw LLM text.
    """
    # Classification
    primary_intent:   str            = Field(..., description="DriveLegal | RoadSoS | RoadWatch | Emergency | MultiIntent | Unknown")
    sub_intents:      List[str]      = Field(default_factory=list)
    confidence:       float          = Field(..., ge=0.0, le=1.0)
    is_multi_intent:  bool           = Field(False)
    is_hinglish:      bool           = Field(False)

    # NER
    entities:         ExtractedEntities = Field(default_factory=ExtractedEntities)

    # Tool routing
    tool_calls:       List[ToolCallSpec] = Field(default_factory=list)

    # The actual reply to show the user
    final_response:   str            = Field(..., description="Markdown-formatted response in the user's language")

    # Helpful extras
    related_questions: List[str]     = Field(default_factory=list, description="2–3 follow-up questions to show as chips")
    safety_tip:       Optional[str]  = Field(None, description="A short proactive safety tip if relevant")
    fallback_used:    bool           = Field(False, description="True if LLM failed and rule-based fallback was used")
    provider:         str            = Field("none", description="gemini | groq | cache | fallback")
    latency_ms:       int            = Field(0)


# ═══════════════════════════════════════════════════════════════════════════════
# 5.  COMPLEXITY ROUTER  (decides fast-path vs LLM)
# ═══════════════════════════════════════════════════════════════════════════════

# Signals that suggest the query needs LLM reasoning
_MULTI_INTENT_CONNECTORS = [
    " aur ", " and ", " also ", " bhi ", " ke saath ", " plus ",
    " additionally ", " moreover ", " iske alawa ", " along with ",
]
_HINGLISH_MARKERS = [
    "kya", "kitna", "kaise", "bata", "chahiye", "hoga", "hai", "nahi",
    "mujhe", "mera", "mere", "yahan", "wahan", "abhi", "jaldi",
    "kal", "aaj", "hua", "gaya", "gayi", "lagta", "lagti",
]
_EMOTIONAL_MARKERS = [
    "scared", "worried", "dar", "chinta", "please", "help",
    "i was", "main tha", "main thi", "mujhe pakda", "pakad liya",
    "officer ne", "police ne", "challan mila", "caught", "what will happen",
    "kya hoga", "ab kya", "tension",
]
_VAGUE_STARTERS = [
    "what if", "suppose", "agar", "suppose karo", "hypothetically",
    "is it true", "can you explain", "samjhao", "detail mein",
    "poori jankari", "sab kuch batao",
]


def is_complex_query(message: str, fast_path_confidence: float) -> bool:
    """
    Returns True when the query should be routed to the LLM path.

    Heuristics (any one sufficient):
      1. Fast-path classifier confidence < LLM_CONFIDENCE_THRESHOLD
      2. Multiple intent connectors detected ("and also", "aur bhi")
      3. 3+ Hinglish markers (mixed-language query)
      4. Emotional / personal distress markers present
      5. Vague / open-ended phrasing detected
      6. Query length > 100 chars (long = complex)

    This keeps the LLM invocation rate low — only ~20-30% of queries
    should hit the LLM for a typical road safety chatbot.
    """
    msg_lower = message.lower()

    # Rule 1: low confidence from existing classifier
    if fast_path_confidence < LLM_CONFIDENCE_THRESHOLD:
        return True

    # Rule 2: multi-intent connectors
    connector_count = sum(1 for c in _MULTI_INTENT_CONNECTORS if c in msg_lower)
    if connector_count >= 1:
        return True

    # Rule 3: heavy Hinglish (≥3 markers)
    hinglish_count = sum(1 for m in _HINGLISH_MARKERS if m in msg_lower)
    if hinglish_count >= 3:
        return True

    # Rule 4: emotional / personal context
    if any(m in msg_lower for m in _EMOTIONAL_MARKERS):
        return True

    # Rule 5: vague / open-ended
    if any(v in msg_lower for v in _VAGUE_STARTERS):
        return True

    # Rule 6: long queries are usually complex
    if len(message) > 100:
        return True

    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 6.  HELPER FUNCTIONS  (vehicle, severity, language detection)
# ═══════════════════════════════════════════════════════════════════════════════

_VEHICLE_KEYWORDS: Dict[str, List[str]] = {
    "two_wheeler": [
        "bike", "motorcycle", "scooter", "moped", "two wheeler",
        "motorbike", "gaadi", "scooty", "activa", "pulsar", "splendor",
        "dono pahiya", "do pahiya",
    ],
    "four_wheeler": [
        "car", "sedan", "suv", "hatchback", "mpv", "vehicle",
        "chaar pahiya", "4 wheeler", "four wheeler",
    ],
    "commercial": [
        "truck", "lorry", "bus", "mini bus", "van", "auto", "auto rickshaw",
        "tempo", "e-rickshaw", "cab", "taxi", "ola", "uber",
    ],
    "heavy": [
        "heavy vehicle", "tanker", "container", "trailer", "dump truck",
    ],
}


def detect_vehicle_type(message: str) -> str:
    """
    Returns a normalised vehicle category:
    two_wheeler | four_wheeler | commercial | heavy | unknown
    """
    msg_lower = message.lower()
    for category, keywords in _VEHICLE_KEYWORDS.items():
        if any(kw in msg_lower for kw in keywords):
            return category
    return "unknown"


_SEVERITY_SCORES: Dict[str, int] = {
    "death":         10, "died":           10, "fatal":          10,
    "dead":          10, "unconscious":    9,  "not breathing":  9,
    "severe":        8,  "critical":       8,  "serious":        7,
    "bleeding":      7,  "fracture":       7,  "broken bone":    7,
    "injured":       5,  "hurt":           5,  "pain":           4,
    "minor":         2,  "scratch":        2,  "small":          1,
    # Hinglish
    "mar gaya":      10, "hosh nahi":      9,  "saans nahi":     9,
    "bahut khoon":   8,  "haddi toot":     7,  "chot lagi":      5,
    "dard":          4,  "halki chot":     2,
}


def score_severity(message: str) -> Tuple[str, int]:
    """
    Returns (severity_label, score) where:
      score 8-10 → CRITICAL
      score 5-7  → SERIOUS
      score 1-4  → MILD
      score 0    → NONE
    """
    msg_lower = message.lower()
    max_score = 0
    for keyword, score in _SEVERITY_SCORES.items():
        if keyword in msg_lower:
            max_score = max(max_score, score)

    if max_score >= 8:
        return "CRITICAL", max_score
    if max_score >= 5:
        return "SERIOUS", max_score
    if max_score >= 1:
        return "MILD", max_score
    return "NONE", 0


def detect_language_mix(message: str) -> Tuple[bool, float]:
    """
    Returns (is_hinglish, hinglish_ratio) — ratio of Hinglish marker density.
    Useful for prompting the LLM to respond in Hinglish if needed.
    """
    words = message.lower().split()
    if not words:
        return False, 0.0
    hits = sum(1 for m in _HINGLISH_MARKERS if m in message.lower())
    ratio = min(hits / max(len(words), 1), 1.0)
    return ratio >= 0.15, round(ratio, 2)


def format_response_with_meta(
    result: LLMReasoningResult,
    include_related: bool = True,
) -> str:
    """
    Appends related questions and safety tip to the final response
    for display in the chat UI.
    """
    parts = [result.final_response.strip()]

    if result.safety_tip:
        parts.append(f"\n\n💡 **Safety Tip:** {result.safety_tip}")

    if include_related and result.related_questions:
        parts.append("\n\n**Related Questions:**")
        for q in result.related_questions[:3]:
            parts.append(f"• {q}")

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# 7.  PROMPT ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are "SafeBot", an expert AI assistant for Road Safety in India and BIMSTEC countries (Bangladesh, Bhutan, Myanmar, Nepal, Sri Lanka, Thailand).

You have deep knowledge of:
- Motor Vehicles Act 1988 (India) and its 2019 amendments
- State-specific traffic rules (MP, Maharashtra, Delhi, Karnataka, etc.)
- Traffic fines and penalties for all violations
- Emergency procedures, trauma centres, golden hour protocols
- Road hazard reporting procedures
- Hinglish (Hindi + English mixed) communication

Your personality: Calm, empathetic, authoritative — like a knowledgeable senior traffic police officer who genuinely cares about road safety. You give practical, actionable advice without legal jargon overload.

RESPONSE RULES:
1. Always respond in the SAME language mix as the user (Hinglish → Hinglish, English → English, Hindi → Hindi)
2. For LEGAL queries: cite specific MV Act sections + exact fine amounts in ₹
3. For EMERGENCY queries: be urgent, direct, and compassionate. Give immediate steps first.
4. For ROAD HAZARD reports: acknowledge, give reporting steps, be encouraging
5. Never make up fine amounts — use "approximately" if uncertain
6. For sensitive situations (user caught by police, emotionally distressed): be empathetic first, then informative
7. Always suggest 2-3 related follow-up questions as chips

OUTPUT FORMAT — You MUST respond with ONLY valid JSON (no markdown fences, no preamble):
{
  "primary_intent": "DriveLegal|RoadSoS|RoadWatch|Emergency|MultiIntent|Unknown",
  "sub_intents": ["list", "of", "intents", "if", "multi"],
  "confidence": 0.85,
  "is_multi_intent": false,
  "is_hinglish": false,
  "entities": {
    "location": "city or area name or null",
    "state": "state name or null",
    "country": "India",
    "vehicle_type": "bike|car|truck|auto|bus|unknown",
    "violation": "specific violation or null",
    "severity": "CRITICAL|SERIOUS|MILD|NONE",
    "user_emotion": "calm|anxious|angry|panicked|neutral",
    "fine_amount": "mentioned amount or null",
    "time_context": "past|present|future|null"
  },
  "tool_calls": [
    {
      "tool": "drivelegal|roadsos|roadwatch",
      "reason": "why this tool is needed",
      "params": {"key": "value"}
    }
  ],
  "final_response": "Your full Markdown response here. Use **bold** for important info, emoji for readability. Be warm and human.",
  "related_questions": [
    "Follow-up question 1?",
    "Follow-up question 2?",
    "Follow-up question 3?"
  ],
  "safety_tip": "A short proactive safety tip relevant to this conversation, or null"
}"""


def build_user_prompt(
    message: str,
    history: List[Dict[str, str]],
    context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds the user-facing part of the prompt with conversation history
    and optional context (location, country, fast-path result).
    """
    parts: List[str] = []

    # Inject conversation history as readable context
    if history:
        parts.append("=== CONVERSATION HISTORY (most recent last) ===")
        for turn in history[-HISTORY_WINDOW:]:
            role = "User" if turn["role"] == "user" else "SafeBot"
            parts.append(f"{role}: {turn['content']}")
        parts.append("=== END HISTORY ===\n")

    # Inject context signals if available
    if context:
        ctx_lines = []
        if context.get("country"):
            ctx_lines.append(f"User country: {context['country']}")
        if context.get("lat") and context.get("lon"):
            ctx_lines.append(f"User GPS: {context['lat']:.4f}, {context['lon']:.4f}")
        if context.get("fast_path_intent"):
            ctx_lines.append(f"Rule-based classifier guessed: {context['fast_path_intent']} (confidence: {context.get('fast_path_confidence', '?')})")
        if ctx_lines:
            parts.append("=== CONTEXT ===")
            parts.extend(ctx_lines)
            parts.append("=== END CONTEXT ===\n")

    # The actual new message
    parts.append(f"User's new message: {message}")
    parts.append("\nRespond ONLY with the JSON object described in the system prompt.")

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# 8.  LLM PROVIDER CALLS
# ═══════════════════════════════════════════════════════════════════════════════

async def _call_gemini(
    system_prompt: str,
    user_prompt: str,
    client: httpx.AsyncClient,
) -> Tuple[str, int, int]:
    """
    Calls Gemini Flash.
    Returns (raw_text, input_tokens, output_tokens).
    Raises httpx.HTTPError or ValueError on failure.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    url = GEMINI_URL.format(api_key=GEMINI_API_KEY)
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,           # low temp = structured, reliable output
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "candidateCount": 1,
            "responseMimeType": "application/json",  # Gemini JSON mode
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ],
    }

    resp = await client.post(url, json=payload, timeout=HTTP_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()

    # Extract text
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

    # Token counts (Gemini provides usageMetadata)
    usage = data.get("usageMetadata", {})
    in_tok  = usage.get("promptTokenCount", 0)
    out_tok = usage.get("candidatesTokenCount", 0)

    return raw_text, in_tok, out_tok


async def _call_groq(
    system_prompt: str,
    user_prompt: str,
    client: httpx.AsyncClient,
) -> Tuple[str, int, int]:
    """
    Calls Groq Llama-3.1-70B (OpenAI-compatible API).
    Returns (raw_text, input_tokens, output_tokens).
    Raises on failure.
    """
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "response_format": {"type": "json_object"},  # Groq JSON mode
    }

    resp = await client.post(
        GROQ_URL,
        json=payload,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        timeout=HTTP_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    raw_text = data["choices"][0]["message"]["content"]
    usage    = data.get("usage", {})
    in_tok   = usage.get("prompt_tokens", 0)
    out_tok  = usage.get("completion_tokens", 0)

    return raw_text, in_tok, out_tok


def _parse_llm_json(raw_text: str) -> LLMReasoningResult:
    """
    Parses raw LLM text → LLMReasoningResult.
    Strips markdown fences if the LLM added them despite instructions.
    """
    # Strip ```json ... ``` if present
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text  = "\n".join(lines[1:])
    if text.endswith("```"):
        text = text[: text.rfind("```")]

    data = json.loads(text)

    # Normalise entities sub-dict into Pydantic model
    ent_raw  = data.get("entities", {})
    entities = ExtractedEntities(**{k: v for k, v in ent_raw.items() if v is not None})

    # Normalise tool_calls
    raw_tools = data.get("tool_calls", [])
    tool_calls = [
        ToolCallSpec(
            tool=t.get("tool", ""),
            reason=t.get("reason", ""),
            params=t.get("params", {}),
        )
        for t in raw_tools
        if t.get("tool")
    ]

    return LLMReasoningResult(
        primary_intent=data.get("primary_intent", "Unknown"),
        sub_intents=data.get("sub_intents", []),
        confidence=float(data.get("confidence", 0.7)),
        is_multi_intent=bool(data.get("is_multi_intent", False)),
        is_hinglish=bool(data.get("is_hinglish", False)),
        entities=entities,
        tool_calls=tool_calls,
        final_response=data.get("final_response", ""),
        related_questions=data.get("related_questions", [])[:3],
        safety_tip=data.get("safety_tip"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 9.  GRACEFUL FALLBACK RESPONSE
# ═══════════════════════════════════════════════════════════════════════════════

def _make_fallback_result(
    message: str,
    fast_path_intent: str,
    fast_path_confidence: float,
) -> LLMReasoningResult:
    """
    Returns a sensible fallback LLMReasoningResult when all LLM providers fail.
    The fast-path result will still be used by chat.py for the actual response;
    this result is just for metadata consistency.
    """
    is_hinglish, _ = detect_language_mix(message)
    severity_label, _ = score_severity(message)
    vehicle = detect_vehicle_type(message)

    return LLMReasoningResult(
        primary_intent=fast_path_intent or "Unknown",
        sub_intents=[],
        confidence=fast_path_confidence,
        is_multi_intent=False,
        is_hinglish=is_hinglish,
        entities=ExtractedEntities(
            vehicle_type=vehicle if vehicle != "unknown" else None,
            severity=severity_label if severity_label != "NONE" else None,
        ),
        tool_calls=[],
        final_response="",   # chat.py will fill this from fast-path
        related_questions=[],
        safety_tip=None,
        fallback_used=True,
        provider="fallback",
        latency_ms=0,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 10.  MAIN PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

async def llm_reason(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    context: Optional[Dict[str, Any]] = None,
    fast_path_intent: str = "Unknown",
    fast_path_confidence: float = 0.0,
    skip_cache: bool = False,
) -> LLMReasoningResult:
    """
    Primary entry point for the LLM Reasoning Layer.

    Args:
        message:               The user's current message.
        history:               List of prior turns: [{"role": "user"|"assistant", "content": "..."}]
        context:               Dict with optional keys: country, lat, lon, fast_path_intent, fast_path_confidence
        fast_path_intent:      Intent label from rule-based classifier (for fallback + cache key)
        fast_path_confidence:  Confidence from rule-based classifier
        skip_cache:            If True, bypasses cache lookup (useful for follow-up queries)

    Returns:
        LLMReasoningResult — structured output with intent, entities, response, etc.

    Failure modes (all handled gracefully):
        - GEMINI_API_KEY missing  → try Groq
        - Gemini rate limit / timeout  → try Groq
        - Groq fails too  → return fallback result (fast-path takes over)
        - JSON parse error  → return fallback result
    """
    history = history or []
    context = context or {}

    # ── Cache lookup ──────────────────────────────────────────────────────────
    # We only cache single-turn queries (no prior history in context).
    # Multi-turn conversations are context-dependent and shouldn't be cached.
    cache_key_msg = message if not history else None
    if not skip_cache and cache_key_msg:
        cached = _cache.get(cache_key_msg)
        if cached is not None:
            USAGE.cache_hits += 1
            logger.debug("[LLM] Cache hit for: %s...", message[:40])
            cached.provider = "cache"
            return cached

    # ── Build prompts ─────────────────────────────────────────────────────────
    full_context = {
        **context,
        "fast_path_intent":      fast_path_intent,
        "fast_path_confidence":  fast_path_confidence,
    }
    user_prompt = build_user_prompt(message, history, full_context)

    start_ms = int(time.time() * 1000)
    raw_text  = ""
    provider  = "none"
    in_tok    = 0
    out_tok   = 0

    async with httpx.AsyncClient() as client:

        # ── Try Gemini Flash first ────────────────────────────────────────────
        try:
            raw_text, in_tok, out_tok = await _call_gemini(
                SYSTEM_PROMPT, user_prompt, client
            )
            provider = "gemini"
            USAGE.gemini_input  += in_tok
            USAGE.gemini_output += out_tok
            logger.info("[LLM] Gemini OK | tokens: %d in / %d out", in_tok, out_tok)

        except Exception as gemini_err:
            logger.warning("[LLM] Gemini failed: %s — trying Groq", gemini_err)

            # ── Fallback to Groq ─────────────────────────────────────────────
            try:
                raw_text, in_tok, out_tok = await _call_groq(
                    SYSTEM_PROMPT, user_prompt, client
                )
                provider = "groq"
                USAGE.groq_input  += in_tok
                USAGE.groq_output += out_tok
                logger.info("[LLM] Groq OK | tokens: %d in / %d out", in_tok, out_tok)

            except Exception as groq_err:
                logger.error(
                    "[LLM] Both providers failed. Gemini: %s | Groq: %s",
                    gemini_err, groq_err
                )
                # Return graceful fallback — chat.py will use fast-path response
                fallback = _make_fallback_result(
                    message, fast_path_intent, fast_path_confidence
                )
                fallback.latency_ms = int(time.time() * 1000) - start_ms
                USAGE.total_calls  += 1
                return fallback

    # ── Parse JSON response ───────────────────────────────────────────────────
    try:
        result = _parse_llm_json(raw_text)
    except (json.JSONDecodeError, ValidationError, KeyError) as parse_err:
        logger.error("[LLM] JSON parse failed: %s | raw: %s...", parse_err, raw_text[:200])
        fallback = _make_fallback_result(message, fast_path_intent, fast_path_confidence)
        fallback.latency_ms = int(time.time() * 1000) - start_ms
        USAGE.total_calls  += 1
        return fallback

    # ── Augment result with local helper scores ───────────────────────────────
    # If LLM missed vehicle type, fill in from local heuristic
    if not result.entities.vehicle_type or result.entities.vehicle_type == "unknown":
        detected_vehicle = detect_vehicle_type(message)
        if detected_vehicle != "unknown":
            result.entities.vehicle_type = detected_vehicle

    # Severity cross-check
    if not result.entities.severity or result.entities.severity == "NONE":
        severity_label, _ = score_severity(message)
        if severity_label != "NONE":
            result.entities.severity = severity_label

    # Set metadata
    result.provider    = provider
    result.latency_ms  = int(time.time() * 1000) - start_ms
    result.fallback_used = False

    # ── Cache result (single-turn only) ───────────────────────────────────────
    if cache_key_msg and not skip_cache:
        _cache.set(cache_key_msg, result)

    USAGE.total_calls += 1
    logger.info(
        "[LLM] Done | provider=%s intent=%s confidence=%.2f latency=%dms",
        provider, result.primary_intent, result.confidence, result.latency_ms
    )

    return result


def get_usage_stats() -> Dict[str, Any]:
    """Returns current token usage + cost stats. Useful for /debug endpoint."""
    return {
        **USAGE.summary(),
        "cache_size": _cache.size,
        "cache_max":  CACHE_MAX_SIZE,
        "cache_ttl_secs": CACHE_TTL_SECS,
    }
