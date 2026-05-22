"""
/emergency — Crash Mode endpoint  (v3 — Authority Dispatch Edition)
════════════════════════════════════════════════════════════════════
Upgrades in v3:
  • Calls handle_roadsos() for the full rich response (trauma centres,
    maps links, ETA) — same as the chat emergency override
  • Authorities are notified via dispatch_emergency() inside handle_roadsos
  • lat/lon optional — Nominatim city-resolution fallback is used if missing
  • country param forwarded for localised emergency numbers
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from app.services.roadsos import handle_roadsos

router = APIRouter()


class EmergencyRequest(BaseModel):
    lat:     Optional[float] = Field(None, ge=-90,  le=90)
    lon:     Optional[float] = Field(None, ge=-180, le=180)
    message: Optional[str]  = Field("Emergency — need immediate help", max_length=500)
    country: Optional[str]  = Field("India", max_length=64)


@router.post("/")
async def emergency_endpoint(req: EmergencyRequest):
    """
    Direct Crash Mode endpoint — bypasses intent classification.
    Used by the frontend emergency button and hardware SOS triggers.

    Returns the full Markdown crash response AND fires authority notifications.
    """
    response = await handle_roadsos(
        message = req.message or "Emergency — need immediate help",
        lat     = req.lat,
        lon     = req.lon,
        country = req.country or "India",
    )
    return {
        "status":   "CRASH_MODE",
        "message":  "🚨 Emergency services alerted. Authorities notified.",
        "response": response,
    }
