"""
Shared Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel
from typing import Optional, List


class Violation(BaseModel):
    violation: str
    fine: int
    location: str
    law_section: str
    repeat_penalty: Optional[int] = None
    notes: Optional[str] = None


class RoadIssue(BaseModel):
    ticket_id: str
    description: str
    category: str
    lat: Optional[float]
    lon: Optional[float]
    status: str = "logged"


class NearbyService(BaseModel):
    name: str
    type: str          # hospital | police | ambulance
    lat: float
    lon: float
    distance_m: float
    phone: Optional[str] = None
