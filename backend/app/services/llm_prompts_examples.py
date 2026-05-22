"""
LLM Prompt Engineering Guide — Road Safety AI v5
═══════════════════════════════════════════════════════════════════════════════
This file documents:
  1. Example user queries and their expected LLM JSON outputs
  2. Prompt tuning tips
  3. Edge cases and how the system handles them
  4. How to switch between fast path and LLM path
  5. Cost optimisation strategies

Run this file directly to test the LLM layer against example queries:
  python -m app.services.llm_prompts_examples
"""

# ═══════════════════════════════════════════════════════════════════════════════
# EXAMPLE 1 — Multi-intent Hinglish query (WILL use LLM path)
# ═══════════════════════════════════════════════════════════════════════════════

EXAMPLE_1_INPUT = {
    "message": (
        "Bhai main Vijay Nagar, Indore mein bike chalate hue pakda gaya bina helmet ke. "
        "Officer ne ₹1000 challan diya. Kya yeh sahi hai? "
        "Aur agar repeat offense hai toh kya hoga? "
        "Also mujhe nearest RTO office bhi batao."
    ),
    "context": {
        "country": "India",
        "lat": 22.7196,
        "lon": 75.8577,
    },
}

EXAMPLE_1_EXPECTED_OUTPUT = {
    "primary_intent": "MultiIntent",
    "sub_intents": ["DriveLegal", "RoadSoS"],
    "confidence": 0.91,
    "is_multi_intent": True,
    "is_hinglish": True,
    "entities": {
        "location": "Vijay Nagar, Indore",
        "state": "Madhya Pradesh",
        "country": "India",
        "vehicle_type": "two_wheeler",
        "violation": "no helmet",
        "severity": "NONE",
        "user_emotion": "anxious",
        "fine_amount": "₹1000",
        "time_context": "past"
    },
    "tool_calls": [
        {
            "tool": "roadsos",
            "reason": "User needs nearest RTO office location",
            "params": {"query_type": "rto_office", "location": "Vijay Nagar, Indore"}
        }
    ],
    "final_response": (
        "Bhai, **₹1,000 challan sahi hai** — yeh Motor Vehicles Act 1988 ki "
        "**Section 129** ke under hai. Indore mein helmet na pehenne ka fine officially "
        "₹1,000 for first offense hai.\n\n"
        "### Kya repeat offense mein zyada lagega?\n"
        "Haan! MV Act 2019 amendment ke baad:\n"
        "- **First offense:** ₹1,000\n"
        "- **Second/repeat offense:** ₹2,000 + 3 months licence suspension possible\n\n"
        "**Practical tip:** Challan bharo — online bhi ho sakta hai at "
        "[echallan.parivahan.gov.in](https://echallan.parivahan.gov.in). "
        "Agar galat fine laga hai, toh challan dispute kar sakte ho within 30 days.\n\n"
        "RTO office info neeche hai! 👇"
    ),
    "related_questions": [
        "Online challan kaise bhare?",
        "Helmet fine MP mein kitna hai?",
        "Licence suspend hone par kya kare?",
    ],
    "safety_tip": (
        "Always wear an ISI-marked helmet — not just for avoiding fines, "
        "but because it reduces fatal injury risk by 69% in accidents."
    ),
}

# ═══════════════════════════════════════════════════════════════════════════════
# EXAMPLE 2 — Emotional / personal situation (WILL use LLM path)
# ═══════════════════════════════════════════════════════════════════════════════

EXAMPLE_2_INPUT = {
    "message": (
        "I was riding my bike without a helmet in Bhopal yesterday and got caught by police. "
        "They took my licence away and said I need to go to court. I'm really scared. "
        "What will actually happen to me? Is this normal?"
    ),
    "context": {"country": "India"},
}

EXAMPLE_2_EXPECTED_OUTPUT = {
    "primary_intent": "DriveLegal",
    "sub_intents": [],
    "confidence": 0.88,
    "is_multi_intent": False,
    "is_hinglish": False,
    "entities": {
        "location": "Bhopal",
        "state": "Madhya Pradesh",
        "country": "India",
        "vehicle_type": "two_wheeler",
        "violation": "no helmet",
        "severity": "NONE",
        "user_emotion": "panicked",
        "time_context": "past"
    },
    "tool_calls": [],
    "final_response": (
        "I completely understand why you're worried — take a deep breath, "
        "this is manageable. 🙏\n\n"
        "**Here's what actually happens:**\n\n"
        "What the officer likely did is called **'Seizure of Driving Licence'** — "
        "it's standard procedure under MV Act Section 206. Your licence wasn't taken "
        "permanently; it was seized temporarily as surety that you'll pay the fine "
        "or appear before the traffic magistrate.\n\n"
        "**Your next steps:**\n"
        "1. **Pay the challan online** at [echallan.parivahan.gov.in](https://echallan.parivahan.gov.in) "
        "using the challan number they gave you — this is usually enough to get your licence back\n"
        "2. **Court is NOT mandatory** for first-time simple violations like no-helmet "
        "in most cases — paying online closes it\n"
        "3. If they insist on court, it's the **Traffic Magistrate's court** — "
        "a very simple hearing, you'll likely just pay the fine (₹1,000 in MP)\n"
        "4. Take your challan receipt + ID when collecting your licence from the traffic police office\n\n"
        "**Timeline:** Usually 3-7 working days after payment to collect licence.\n\n"
        "You've got this. The fine is small and this won't affect your permanent record "
        "for a first offense. 👍"
    ),
    "related_questions": [
        "How to pay traffic challan online in MP?",
        "Can police seize licence for no helmet?",
        "What is the process to get seized licence back?",
    ],
    "safety_tip": "Always carry a digital copy of your licence via DigiLocker app — it's legally valid.",
}

# ═══════════════════════════════════════════════════════════════════════════════
# EXAMPLE 3 — Emergency (bypasses LLM entirely, goes to Crash Mode)
# ═══════════════════════════════════════════════════════════════════════════════

EXAMPLE_3_INPUT = {
    "message": "Accident ho gaya bhai! Mere dost ko bahut khoon aa raha hai. Koi hil nahi raha. HELP!",
    "context": {"country": "India", "lat": 22.7196, "lon": 75.8577},
}

# This query scores 0.95 on detect_emergency_scored() due to primary keywords
# "bachao" patterns + "khoon" + "help" → CRASH MODE fires, NO LLM involved
EXAMPLE_3_NOTE = """
This query is handled by the emergency detection pipeline in chat.py,
BEFORE the LLM routing check. The LLM is NOT called. Instead:
  1. detect_emergency_scored() returns 0.95
  2. detect_severity() returns "CRITICAL"
  3. handle_roadsos() is called directly → returns trauma centres, ETA, maps
  4. Response time: < 500ms (no LLM latency)
"""

# ═══════════════════════════════════════════════════════════════════════════════
# EXAMPLE 4 — Simple single-intent (uses FAST PATH, no LLM)
# ═══════════════════════════════════════════════════════════════════════════════

EXAMPLE_4_INPUT = {
    "message": "no helmet fine in Indore",
    "context": {"country": "India"},
}

# is_complex_query() returns False:
#   - confidence from classifier: ~0.82 (high, clear DriveLegal)
#   - no multi-intent connectors
#   - only 0 Hinglish markers
#   - no emotional markers
#   - message length: 23 chars < 100
# → FAST PATH: handle_drivelegal() called directly, zero LLM cost
EXAMPLE_4_NOTE = """
Fast path query. Estimated latency: 30-80ms.
LLM path would add 1-3 seconds and ~$0.001 per call unnecessarily.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# EXAMPLE 5 — Follow-up query (uses LLM with conversation history)
# ═══════════════════════════════════════════════════════════════════════════════

EXAMPLE_5_HISTORY = [
    {"role": "user",      "content": "What is the fine for overspeeding in Delhi?"},
    {"role": "assistant", "content": "Overspeeding fine in Delhi: ₹1,000-2,000 for light vehicles..."},
    {"role": "user",      "content": "What about for heavy vehicles?"},
    {"role": "assistant", "content": "For heavy vehicles, overspeeding fine is ₹2,000-4,000..."},
]

EXAMPLE_5_INPUT = {
    "message": "And what if I'm a repeat offender?",
    "context": {"country": "India"},
    "history": EXAMPLE_5_HISTORY,
}

# Without history, this query would be "Unknown" intent (too vague).
# With history, the LLM understands:
#   - "repeat offender" refers to overspeeding
#   - In Delhi
#   - For heavy vehicles (last discussed)
# And responds appropriately — this is why conversation memory matters.
EXAMPLE_5_NOTE = """
Follow-up query that's ambiguous without context.
is_complex_query() returns True because confidence will be low for "And what if I'm a repeat offender?"
LLM path fires, history is passed, LLM resolves the context correctly.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# PROMPT TUNING GUIDE
# ═══════════════════════════════════════════════════════════════════════════════

PROMPT_TUNING_TIPS = """
SYSTEM PROMPT TUNING:
─────────────────────

1. TEMPERATURE (0.3 recommended):
   - Lower (0.1-0.2): More deterministic JSON, less creative responses
   - Higher (0.5-0.7): More natural language but JSON may break
   - 0.3 is the sweet spot: structured JSON + natural response text

2. JSON MODE:
   - Gemini: set "responseMimeType": "application/json" in generationConfig
   - Groq: set "response_format": {"type": "json_object"} in request body
   - Both will ONLY output JSON — no markdown fences, no preamble
   - Still parse defensively in case of minor format issues

3. SYSTEM PROMPT LENGTH:
   - Current: ~600 tokens — optimal for Flash/Groq
   - Going over 1000 tokens reduces instruction-following reliability
   - Keep examples OUT of system prompt — add them to user prompt context only

4. HINGLISH HANDLING:
   - The LLM is instructed to "respond in the same language mix"
   - Test: send a Hinglish message → verify response is Hinglish
   - If response is pure English: add to system prompt:
     "IMPORTANT: If user writes in Hinglish (Hindi + English mixed),
      you MUST respond in Hinglish. Never switch to pure English."

5. ENTITY EXTRACTION ACCURACY:
   - The LLM's entities are cross-validated by local helpers (detect_vehicle_type,
     score_severity) — if LLM missed something, helpers fill it in
   - If extraction quality is poor, add few-shot examples to the user prompt:
     "Example entity extraction:
      Input: 'Meri car mein koi takkar maar gaya'
      Entities: {vehicle_type: 'four_wheeler', violation: 'hit and run', ...}"

6. RELATED QUESTIONS:
   - Always 2-3, phrased as quick-chip buttons (short, < 50 chars)
   - They should be DIFFERENT from the current query (not rephrasing)
   - Good: ["Online challan kaise bhare?", "Licence suspend hone par kya kare?"]
   - Bad:  ["What is the helmet fine?", "What is the no-helmet penalty?"]

SWITCHING BETWEEN FAST PATH AND LLM PATH:
──────────────────────────────────────────

Option A — Via threshold (recommended):
  In .env: LLM_CONFIDENCE_THRESHOLD=0.65
  - Set to 0.0  → ALL queries use LLM (expensive, max quality)
  - Set to 1.0  → NO queries use LLM (free, rule-based only)
  - Set to 0.65 → ~20-30% use LLM (production balance)

Option B — Force fast path for a session:
  Add header: X-Force-Fast-Path: true
  (Requires adding a check in chat.py — not implemented by default)

Option C — Per-query override in request body:
  Add to ChatRequest: force_fast_path: bool = False
  Then in chat.py: if req.force_fast_path: use_llm = False

COST OPTIMISATION:
──────────────────
  At LLM_CONFIDENCE_THRESHOLD=0.65 with ~20% LLM rate:
  - 1,000 queries/day × 20% LLM = 200 LLM calls
  - ~300 tokens/call average (system + user + response)
  - 200 × 300 = 60,000 tokens/day
  - Gemini Flash cost: 60,000 × $0.075/1M = $0.0045/day  ← basically free
  
  Even at 10,000 queries/day: $0.045/day = $1.35/month 🎉
  
  Cache hit rate of 40-60% in production further halves this.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# Manual test runner
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import asyncio
    import json
    import os
    import sys

    # Add backend root to path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

    from app.services.llm_reasoner import llm_reason

    async def run_tests():
        print("=" * 70)
        print("LLM REASONER — Manual Test Runner")
        print("=" * 70)

        test_cases = [
            {
                "name": "Multi-intent Hinglish (Example 1)",
                "message": EXAMPLE_1_INPUT["message"],
                "context": EXAMPLE_1_INPUT["context"],
            },
            {
                "name": "Emotional / personal (Example 2)",
                "message": EXAMPLE_2_INPUT["message"],
                "context": EXAMPLE_2_INPUT["context"],
            },
            {
                "name": "Follow-up with history (Example 5)",
                "message": EXAMPLE_5_INPUT["message"],
                "context": EXAMPLE_5_INPUT["context"],
                "history": EXAMPLE_5_HISTORY,
            },
        ]

        for i, tc in enumerate(test_cases, 1):
            print(f"\n{'─'*70}")
            print(f"Test {i}: {tc['name']}")
            print(f"Input: {tc['message'][:80]}...")
            print()

            result = await llm_reason(
                message=tc["message"],
                history=tc.get("history", []),
                context=tc.get("context", {}),
                fast_path_intent="Unknown",
                fast_path_confidence=0.4,
            )

            print(f"Provider:   {result.provider}")
            print(f"Intent:     {result.primary_intent} (confidence: {result.confidence:.2f})")
            print(f"Hinglish:   {result.is_hinglish}")
            print(f"Multi:      {result.is_multi_intent}")
            print(f"Entities:   {result.entities.model_dump(exclude_none=True)}")
            print(f"Tool calls: {[t.tool for t in result.tool_calls]}")
            print(f"Latency:    {result.latency_ms}ms")
            print()
            print("Response preview:")
            print(result.final_response[:400])
            if result.related_questions:
                print("\nRelated:")
                for q in result.related_questions:
                    print(f"  • {q}")

        print(f"\n{'='*70}")
        print("All tests complete.")

    asyncio.run(run_tests())
