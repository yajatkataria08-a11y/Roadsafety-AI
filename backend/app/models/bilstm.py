"""
bilstm.py — Compatibility Shim + extract_entities upgrade v4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This file is a thin shim: old imports from bilstm.py continue working
while the real logic lives in intent_classifier.py.

UPGRADE IN v4:
- extract_entities() now also returns "vehicle_type" key
- vehicle_type detection delegated to drivelegal.detect_vehicle_type()
  to keep a single source of truth.
- This means the chat route, DriveLegal handler, and any future route
  all get vehicle_type from the same detection logic.

NOTE: The actual detect_vehicle_type() function lives in drivelegal.py
to avoid circular imports (drivelegal imports from bilstm/intent_classifier,
so vehicle-type detection must either be in intent_classifier or drivelegal).
We place it in drivelegal (where it's consumed) and expose a wrapper here.
"""
from __future__ import annotations

# Re-export everything from intent_classifier for backward compatibility
from app.models.intent_classifier import (  # noqa: F401
    predict_intent,
    extract_entities as _extract_entities_base,
    INTENT_PROTOTYPES,
    CITY_MAP,
    STATE_MAP,
    VIOLATION_KEYWORDS,
)


def extract_entities(text: str) -> dict:
    """
    Extended extract_entities — wraps intent_classifier version and
    adds 'vehicle_type' field for Smart Challan Calculator (v4).

    Returns:
    {
        "location":     str | None,   # City name (title-cased)
        "state":        str | None,   # State name
        "country":      str | None,   # Country name
        "violation":    str | None,   # Matched violation keyword
        "service_type": str | None,   # Emergency service type
        "vehicle_type": str,          # "two_wheeler"|"lmv"|"hmv"|"bus"|"auto"|"all"
    }

    Vehicle type detection is done by drivelegal.detect_vehicle_type()
    to keep a single source of truth and avoid circular imports.
    """
    # Get the base entity dict (location, state, country, violation, service_type)
    result = _extract_entities_base(text)

    # Lazy import to avoid circular dependency:
    # intent_classifier ← bilstm ← drivelegal (circular if drivelegal imported at top)
    try:
        from app.services.drivelegal import detect_vehicle_type
        result["vehicle_type"] = detect_vehicle_type(text)
    except Exception:
        # Graceful degradation: if drivelegal import fails for any reason,
        # return "all" as safe default (won't break any downstream logic)
        result["vehicle_type"] = "all"

    return result


# ── v11: Re-export entity_extractor for unified import ───────────────────────
from app.models.entity_extractor import (  # noqa: F401
    extract as extract_entities_v11,
    extract_all as extract_entities_all,
    DriveLegalResult,
    RoadSoSResult,
    RoadWatchResult,
    ExtractionResult,
)
