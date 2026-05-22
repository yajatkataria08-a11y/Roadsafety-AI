"""
/challan  — Smart Challan Calculator  (direct structured API)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POST /challan
  Accept structured parameters and return a fully-formatted challan card.
  Bypasses the NLP pipeline — useful for frontend "Quick Challan" lookups,
  evaluation harnesses, and API consumers that already know the violation name.

GET /challan/violations
  Returns a deduplicated list of violation names (for autocomplete / UI dropdowns).

GET /challan/countries
  Returns supported BIMSTEC countries with payment portal links.
"""

from __future__ import annotations
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.drivelegal import format_smart_challan, _load_db

router = APIRouter(prefix="/challan", tags=["Smart Challan"])


# ── Request / Response models ──────────────────────────────────────────────────

class ChalllanRequest(BaseModel):
    violation:    str                = Field(...,   description="Violation name, e.g. 'No Helmet', 'Drunk Driving'")
    country:      str                = Field("India", description="Country (BIMSTEC nations supported)")
    state:        Optional[str]      = Field(None,  description="State/province for state-level fine lookup")
    city:         Optional[str]      = Field(None,  description="City for city-specific fine lookup (highest precision)")
    vehicle_type: str                = Field("all", description="two_wheeler | lmv | hmv | bus | auto | all")
    is_repeat:    bool               = Field(False, description="True if this is a repeat offence")
    repeat_count: int                = Field(1,     ge=1, description="Number of previous offences (≥2 triggers repeat rate)")


class ChallanResponse(BaseModel):
    challan:        str
    violation_input: str
    location:       str
    vehicle_type:   str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=ChallanResponse, summary="Generate Smart Challan")
async def generate_challan(req: ChalllanRequest):
    """
    Generate a fully-formatted Smart Challan breakdown for the given violation
    and location.

    Returns:
    - **challan**: Markdown-formatted challan card (ready for frontend display)
    - **violation_input**: The violation string that was queried
    - **location**: Resolved location label
    - **vehicle_type**: Vehicle type used for fine resolution
    """
    challan_text = format_smart_challan(
        violation    = req.violation,
        country      = req.country,
        state        = req.state,
        city         = req.city,
        vehicle_type = req.vehicle_type,
        is_repeat    = req.is_repeat,
        repeat_count = req.repeat_count,
    )

    loc_parts = [p for p in [req.city, req.state, req.country] if p]
    location  = " → ".join(loc_parts)

    return ChallanResponse(
        challan         = challan_text,
        violation_input = req.violation,
        location        = location,
        vehicle_type    = req.vehicle_type,
    )


@router.get("/violations", summary="List all violation names (for autocomplete)")
async def list_violations():
    """
    Returns a sorted deduplicated list of violation names from the DB.
    Useful for frontend autocomplete / dropdown widgets.
    """
    db = _load_db()
    names = sorted({e.get("violation", "") for e in db if e.get("violation")})
    return {"count": len(names), "violations": names}


@router.get("/countries", summary="Supported countries with payment links")
async def list_countries():
    """Returns BIMSTEC nations supported by the challan calculator."""
    return {
        "countries": [
            {"name": "India",      "currency": "INR (₹)",  "portal": "https://echallan.parivahan.gov.in/"},
            {"name": "Bangladesh", "currency": "BDT",      "portal": "https://brta.gov.bd/"},
            {"name": "Sri Lanka",  "currency": "LKR",      "portal": "https://www.motortraffic.gov.lk/"},
            {"name": "Nepal",      "currency": "NPR",      "portal": "https://dotm.gov.np/"},
            {"name": "Thailand",   "currency": "THB",      "portal": "https://www.dlt.go.th/"},
            {"name": "Myanmar",    "currency": "MMK",      "portal": "https://www.mot.gov.mm/"},
            {"name": "Bhutan",     "currency": "BTN",      "portal": "https://www.rsta.gov.bt/"},
        ]
    }
