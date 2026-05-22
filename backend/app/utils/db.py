"""
Database Utility — v4  (Authority Dispatch Edition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tables:
  road_issues         — RoadWatch complaint log
  chat_logs           — Intent + confidence audit trail
  emergency_dispatch  — NEW: every authority notification attempt (v4)

Default: SQLite (USE_SQLITE=true).
Production: set USE_SQLITE=false + DB_* env vars for PostgreSQL.
"""

import os
import asyncio
import json
from datetime import datetime
from functools import partial

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String, Text, create_engine
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv

load_dotenv()

USE_SQLITE = os.getenv("USE_SQLITE", "true").lower() == "true"

if USE_SQLITE:
    DATABASE_URL = "sqlite:///./roadsafety.db"
else:
    DATABASE_URL = (
        f"postgresql+psycopg2://{os.getenv('DB_USER', 'postgres')}:"
        f"{os.getenv('DB_PASS', 'password')}@"
        f"{os.getenv('DB_HOST', 'localhost')}/"
        f"{os.getenv('DB_NAME', 'roadsafety')}"
    )

engine       = None
SessionLocal = None


class Base(DeclarativeBase):
    pass


# ── ORM Models ─────────────────────────────────────────────────────────────────

class RoadIssue(Base):
    """Persists every RoadWatch complaint."""
    __tablename__ = "road_issues"

    id                = Column(Integer, primary_key=True, index=True)
    ticket_id         = Column(String(20),  unique=True, index=True, nullable=False)
    description       = Column(Text,        nullable=False)
    category          = Column(String(80))
    lat               = Column(Float,       nullable=True)
    lon               = Column(Float,       nullable=True)
    authority         = Column(String(120))
    authority_contact = Column(String(40))
    routed_to         = Column(String(60))
    image_file        = Column(String(120), nullable=True)
    has_image         = Column(Boolean,     default=False)
    status            = Column(String(20),  default="logged")
    is_duplicate      = Column(Boolean,     default=False)
    timestamp         = Column(DateTime,    default=datetime.utcnow)


class ChatLog(Base):
    """Audit trail: every /chat request + its intent classification."""
    __tablename__ = "chat_logs"

    id         = Column(Integer, primary_key=True, index=True)
    message    = Column(Text,       nullable=False)
    intent     = Column(String(20))
    confidence = Column(Float)
    source     = Column(String(30))
    country    = Column(String(40))
    lat        = Column(Float,  nullable=True)
    lon        = Column(Float,  nullable=True)
    timestamp  = Column(DateTime, default=datetime.utcnow)


class EmergencyDispatch(Base):
    """
    Records every authority notification attempt triggered by Crash Mode.
    Stores the full dispatch log as JSON so the /debug route can surface it.
    """
    __tablename__ = "emergency_dispatch"

    id               = Column(Integer, primary_key=True, index=True)
    incident_id      = Column(String(30),  unique=True, index=True, nullable=False)
    severity         = Column(String(10))           # CRITICAL | SERIOUS | MILD
    message          = Column(Text)                 # caller's original message
    lat              = Column(Float,  nullable=True)
    lon              = Column(Float,  nullable=True)
    address          = Column(Text,   default="")   # reverse-geocoded address
    city             = Column(String(120), default="")
    country          = Column(String(60),  default="India")
    maps_link        = Column(Text,   default="")   # Google Maps deep link
    dispatch_results = Column(Text,   default="[]") # JSON: list of channel results
    notified_count   = Column(Integer, default=0)   # number of successful sends
    timestamp        = Column(DateTime, default=datetime.utcnow)

    def dispatch_log(self) -> list:
        """Deserialize the stored JSON dispatch log."""
        try:
            return json.loads(self.dispatch_results or "[]")
        except Exception:
            return []


class SessionHistory(Base):
    """
    Persists chat session history so it survives server restarts.
    Each row = one session's full conversation (as JSON array).
    """
    __tablename__ = "session_history"

    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(String(128), unique=True, index=True, nullable=False)
    history_json = Column(Text,    default="[]")
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow)


# ── Init ───────────────────────────────────────────────────────────────────────

def init_db():
    global engine, SessionLocal
    connect_args = {"check_same_thread": False} if USE_SQLITE else {}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    print(
        f"📦 DB ready — {'SQLite' if USE_SQLITE else 'PostgreSQL'} | "
        "tables: road_issues, chat_logs, emergency_dispatch, session_history"
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Async helpers ──────────────────────────────────────────────────────────────

async def run_sync_db(fn, *args, **kwargs):
    """
    Run a synchronous DB function in the thread-pool executor.
    Prevents sync SQLAlchemy from blocking the async event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))
