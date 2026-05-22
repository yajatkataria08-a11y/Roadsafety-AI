"""
routes/extract.py — v11
══════════════════════════════════════════════════════════════════════════════
REST endpoint exposing the entity extractor for:
  • Frontend pre-validation (show vehicle selector, issue type before send)
  • Analytics / telemetry
  • Debug / judging demos

Endpoints
─────────
POST /extract/          → run best-fit module, return single ExtractionResult
POST /extract/all       → run all three modules, return side-by-side dict
GET  /extract/health    → sanity check (no I/O)
══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.entity_extractor import extract, extract_all

router = APIRouter(prefix="/extract", tags=["Entity Extractor"])


# ── Request / Response schemas ────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    text:             str            = Field(..., min_length=2, max_length=2000,
                                             example="helmet fine in chennai for scooty second time")
    predicted_intent: str | None     = Field(None, example="DriveLegal")
    force_module:     str | None     = Field(None, example=None,
                                             description="Skip classifier; force 'DriveLegal' | 'RoadSoS' | 'RoadWatch'")


class ExtractResponse(BaseModel):
    module:     str
    entities:   dict
    text_echo:  str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ExtractResponse, summary="Extract entities (best-fit module)")
async def extract_entities_endpoint(req: ExtractRequest) -> ExtractResponse:
    """
    Run the intelligent entity extractor on the user message.

    Returns the single best-fit module result (DriveLegal / RoadSoS / RoadWatch)
    with all extracted fields and a confidence score.

    **Example request:**
    ```json
    { "text": "helmet fine in chennai for scooty second time" }
    ```
    **Example response:**
    ```json
    {
      "module": "DriveLegal",
      "entities": {
        "violation":      "No Helmet",
        "vehicle_type":   "two_wheeler",
        "city":           "Chennai",
        "state":          "Tamil Nadu",
        "country":        "India",
        "repeat_offence": true,
        "fine_multiplier": 2.0,
        "confidence":     0.92
      }
    }
    ```
    """
    if req.force_module and req.force_module not in ("DriveLegal", "RoadSoS", "RoadWatch"):
        raise HTTPException(status_code=422, detail="force_module must be DriveLegal, RoadSoS, or RoadWatch")

    result = extract(
        req.text,
        predicted_intent=req.predicted_intent,
        force_module=req.force_module,
    )
    return ExtractResponse(
        module    = result.module,
        entities  = result.to_dict(),
        text_echo = req.text,
    )


@router.post("/all", summary="Extract entities across all three modules")
async def extract_all_endpoint(req: ExtractRequest) -> dict:
    """
    Run all three extraction modules in parallel and return side-by-side results.
    Useful for analytics, A/B testing intent routing, and demo dashboards.
    """
    return {
        "text":    req.text,
        "modules": extract_all(req.text),
    }


@router.get("/health", summary="Extractor health check")
async def extract_health() -> dict:
    """Fast sanity check — verifies extractor import and basic round-trip."""
    probe = extract("helmet fine in delhi for bike")
    return {
        "status":   "ok",
        "module":   probe.module,
        "confidence": probe.confidence,
    }
