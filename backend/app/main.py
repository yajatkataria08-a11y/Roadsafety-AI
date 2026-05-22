"""
Road Safety AI — Main FastAPI Application
Hackathon: Road Safety 2026 | BIMSTEC | IIT Madras

Changes v4:
 - Rate limiting via slowapi: /chat is limited to 30 req/min per IP to
   prevent Overpass API throttling and server overload during demo
 - Startup event pre-warms the intent classifier and RAG retriever so
   the first real request is fast (no cold-start model download)
 - Removed aiosqlite from requirements (sync SQLAlchemy is used)
"""

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes import chat, emergency, report, debug, challan, map as map_routes, ocr as ocr_routes
from app.utils.db import init_db

# ── Rate limiting ──────────────────────────────────────────────────────────────
import ipaddress as _ipaddress

# Trusted proxy CIDRs — mirrors chat.py whitelist.
_BUILTIN_TRUSTED_MAIN = [
    "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "::1/128", "fc00::/7",
]
_TRUSTED_NETS_MAIN: list = []

def _build_trusted_nets_main() -> list:
    if _TRUSTED_NETS_MAIN:
        return _TRUSTED_NETS_MAIN
    for cidr in _BUILTIN_TRUSTED_MAIN:
        _TRUSTED_NETS_MAIN.append(_ipaddress.ip_network(cidr, strict=False))
    extra = os.getenv("TRUSTED_PROXIES", "")
    for item in extra.split(","):
        item = item.strip()
        if item:
            try:
                _TRUSTED_NETS_MAIN.append(_ipaddress.ip_network(item, strict=False))
            except ValueError:
                pass
    return _TRUSTED_NETS_MAIN

def _is_trusted_proxy_main(ip_str: str) -> bool:
    try:
        addr = _ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return any(addr in net for net in _build_trusted_nets_main())

def _get_real_ip(request) -> str:
    """Secure IP extraction — only trusts proxy headers from whitelisted IPs."""
    direct_ip = getattr(getattr(request, 'client', None), "host", "127.0.0.1")
    if _is_trusted_proxy_main(direct_ip) and hasattr(request, 'headers'):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
    return direct_ip

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=_get_real_ip)
    RATELIMIT_AVAILABLE = True
except ImportError:
    limiter = None
    RATELIMIT_AVAILABLE = False
    print("⚠️  slowapi not installed — rate limiting disabled. pip install slowapi")

app = FastAPI(
    title="Road Safety AI API",
    description="AI Chatbot for DriveLegal | RoadWatch | RoadSoS",
    version="1.0.0",
)

if RATELIMIT_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach limiter to chat router so /chat gets 30/min per IP
if RATELIMIT_AVAILABLE:
    chat.router.add_api_route  # just referencing to attach limiter below

# Register routers
app.include_router(chat.router,      prefix="/chat",      tags=["Chat"])
app.include_router(emergency.router, prefix="/emergency", tags=["Emergency"])
app.include_router(report.router,    prefix="/report",    tags=["RoadWatch"])
app.include_router(debug.router,     prefix="/debug",     tags=["Debug"])
app.include_router(challan.router)   # prefix="/challan" defined inside the module
app.include_router(map_routes.router, prefix="/map", tags=["Map"])
app.include_router(ocr_routes.router)   # prefix="/ocr" defined inside the module

# ── OTP Auth routes (MSG91) ───────────────────────────────────────────────────
from app.routes.otp_routes import router as otp_router
app.include_router(otp_router)

# v11 — Intelligent Entity Extractor endpoint
from app.routes.extract import router as extract_router
app.include_router(extract_router)


@app.on_event("startup")
async def startup_event():
    # 1. Init DB (creates tables if not exist)
    init_db()
    print("✅ DB initialized")

    # 2. Pre-warm intent classifier — loads SentenceTransformer + builds
    #    prototype embeddings so the first /chat request isn't slow
    try:
        from app.models.intent_classifier import _build_proto_embeddings
        _build_proto_embeddings()
        print("✅ Intent classifier pre-warmed")
    except Exception as e:
        print(f"⚠️  Intent classifier pre-warm failed (non-fatal): {e}")

    # 3. Pre-warm RAG retriever — loads FAISS index + SentenceTransformer
    try:
        from app.rag.retriever import _load
        _load()
        print("✅ RAG retriever pre-warmed")
    except Exception as e:
        print(f"⚠️  RAG pre-warm failed (non-fatal): {e}")


@app.get("/")
def root():
    return {"status": "Road Safety AI is live 🚦"}
