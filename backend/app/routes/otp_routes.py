"""
OTP Routes — MSG91 Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Endpoints:
  POST /api/auth/send-otp    — MSG91 se SMS + Email OTP bhejo
  POST /api/auth/verify-otp  — MSG91 se OTP verify karo + user DB mein save karo

Place this file in your backend folder and include router in main.py:
  from otp_routes import router as otp_router
  app.include_router(otp_router)
"""

import os
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database import Base, get_db   # aapki existing database.py

router = APIRouter(prefix="/api/auth", tags=["Auth OTP"])

# ── ENV vars ──────────────────────────────────────────────────────────────────
MSG91_AUTH_KEY    = os.getenv("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID", "")
MSG91_SENDER_ID   = os.getenv("MSG91_SENDER_ID", "RDSAFE")
ADMIN_EMAIL       = os.getenv("ADMIN_EMAIL", "admin@roadsafety.ai")

# ── User Model (aapke existing Base se) ──────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(120), nullable=True)
    email      = Column(String(200), unique=True, index=True, nullable=True)
    phone      = Column(String(20),  unique=True, index=True, nullable=True)
    role       = Column(String(20),  default="user")   # 'user' | 'admin'
    is_active  = Column(Boolean,     default=True)
    created_at = Column(DateTime,    default=datetime.utcnow)


# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class SendOtpRequest(BaseModel):
    email:  str | None = None
    phone:  str | None = None
    action: str        = "login"   # 'login' | 'signup'
    name:   str | None = None

class VerifyOtpRequest(BaseModel):
    otp:      str
    email:    str | None = None
    phone:    str | None = None
    action:   str        = "login"
    name:     str | None = None
    password: str | None = None


# ── MSG91 Helpers ─────────────────────────────────────────────────────────────
async def msg91_send_sms(phone: str) -> dict:
    """MSG91 SMS OTP bhejo"""
    clean_phone = phone.lstrip("+")   # +919876543210 → 919876543210
    url = (
        f"https://control.msg91.com/api/v5/otp"
        f"?template_id={MSG91_TEMPLATE_ID}"
        f"&mobile={clean_phone}"
        f"&authkey={MSG91_AUTH_KEY}"
        f"&sender={MSG91_SENDER_ID}"
    )
    async with httpx.AsyncClient() as client:
        res = await client.post(url, timeout=10)
        data = res.json()
    return data   # { "type": "success", "message": "..." }


async def msg91_send_email(email: str) -> dict:
    """MSG91 Email OTP bhejo"""
    url = (
        f"https://control.msg91.com/api/v5/otp"
        f"?template_id={MSG91_TEMPLATE_ID}"
        f"&mobile={email}"
        f"&authkey={MSG91_AUTH_KEY}"
    )
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json={"email": email}, timeout=10)
        data = res.json()
    return data


async def msg91_verify(identifier: str, otp: str) -> dict:
    """MSG91 OTP verify karo"""
    clean = identifier.lstrip("+")
    url = (
        f"https://control.msg91.com/api/v5/otp/verify"
        f"?otp={otp}"
        f"&mobile={clean}"
        f"&authkey={MSG91_AUTH_KEY}"
    )
    async with httpx.AsyncClient() as client:
        res = await client.get(url, timeout=10)
        data = res.json()
    return data   # { "type": "success" | "error", "message": "..." }


# ── POST /api/auth/send-otp ───────────────────────────────────────────────────
@router.post("/send-otp")
async def send_otp(body: SendOtpRequest):
    if not body.email and not body.phone:
        raise HTTPException(400, "Email ya phone number zaroori hai")

    results = []
    errors  = []

    # SMS OTP
    if body.phone:
        data = await msg91_send_sms(body.phone)
        if data.get("type") == "success":
            results.append("SMS")
        else:
            errors.append(f"SMS: {data.get('message', 'Failed')}")

    # Email OTP
    if body.email:
        data = await msg91_send_email(body.email)
        if data.get("type") == "success":
            results.append("Email")
        else:
            errors.append(f"Email: {data.get('message', 'Failed')}")

    if results:
        return {
            "success":  True,
            "message":  f"OTP sent via {' & '.join(results)}",
            "channels": results,
        }

    raise HTTPException(500, detail=", ".join(errors) or "OTP send karne mein error aayi")


# ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    if len(body.otp) != 6:
        raise HTTPException(400, "6-digit OTP daalna zaroori hai")

    if not body.email and not body.phone:
        raise HTTPException(400, "Email ya phone zaroori hai")

    # ── MSG91 se verify ───────────────────────────────────────────────────────
    identifier = body.phone or body.email
    result = await msg91_verify(identifier, body.otp)

    if result.get("type") != "success":
        raise HTTPException(400, result.get("message", "Invalid OTP — dobara try karo"))

    # ── OTP verified ✓ ────────────────────────────────────────────────────────

    if body.action == "signup":
        # Check if user already exists
        existing = db.query(User).filter(
            (User.email == body.email) | (User.phone == body.phone)
        ).first()

        if existing:
            raise HTTPException(400, "Yeh email/phone already registered hai")

        # New user create karo
        new_user = User(
            name=body.name or "",
            email=body.email,
            phone=body.phone,
            role="admin" if body.email == ADMIN_EMAIL else "user",
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "success": True,
            "message": "Account successfully bana!",
            "action":  "signup",
            "role":    new_user.role,
        }

    if body.action == "login":
        # User DB se fetch karo
        user = db.query(User).filter(
            (User.email == body.email) | (User.phone == body.phone)
        ).first()

        if not user:
            raise HTTPException(404, "User nahi mila — pehle signup karo")

        if not user.is_active:
            raise HTTPException(403, "Account inactive hai — support se contact karo")

        return {
            "success": True,
            "message": "Login successful!",
            "action":  "login",
            "role":    user.role,   # 'admin' | 'user' → frontend redirect karta hai
        }

    raise HTTPException(400, "Invalid action")
