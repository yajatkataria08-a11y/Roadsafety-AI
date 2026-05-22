"""
/report — RoadWatch complaint submission
Accepts text + optional image + location.
"""

from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional
from app.services.roadwatch import log_issue_async

router = APIRouter()


@router.post("/")
async def report_issue(
    description: str             = Form(...),
    lat:         Optional[float] = Form(None),
    lon:         Optional[float] = Form(None),
    image:       Optional[UploadFile] = File(None),
):
    image_bytes = await image.read() if image else None
    result      = await log_issue_async(description, lat, lon, image_bytes)
    is_dup      = result.pop("_duplicate", False)

    if is_dup:
        return {
            "status":    "duplicate",
            "ticket_id": result["ticket_id"],
            "message":   "⚠️ This issue was already reported recently. No new ticket created.",
            "details":   result,
        }

    return {
        "status":    "reported",
        "ticket_id": result["ticket_id"],
        "message":   "✅ Your complaint has been logged and routed to the appropriate authority.",
        "details":   result,
    }
