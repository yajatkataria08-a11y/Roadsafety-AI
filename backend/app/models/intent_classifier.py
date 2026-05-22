"""
Intent Classifier — v4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strategy (in order of preference):
  1. Sentence-transformer cosine similarity  (semantic, robust)
  2. Trained sklearn TF-IDF + LogReg         (fast, interpretable)
  3. Keyword matching                         (last resort, always works)

Changes v4:
 - Renamed from bilstm.py → intent_classifier.py (no LSTM is used)
 - Added ~15 Hinglish prototype sentences per intent to improve
   accuracy for Hindi-English mixed queries
 - Cosine confidence threshold in chat route lowered from 0.70 → 0.55
   (MiniLM cosine rarely exceeds 0.85 even for correct matches;
    0.70 was deflecting too many valid queries as "Unclear")
"""

from __future__ import annotations
import json
import re
import unicodedata
import pickle
from pathlib import Path
from typing import Tuple
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT         = Path(__file__).parent.parent.parent
MODELS_DIR   = ROOT / "saved_models"
INTENTS_PATH = ROOT / "data" / "training" / "intents.json"

# ── Heavy-import guards ────────────────────────────────────────────────────────
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    _ST_MODEL  = SentenceTransformer("all-MiniLM-L6-v2")
    _ST_READY  = True
except ImportError:
    _ST_READY  = False
    np         = None

try:
    import joblib
    _VEC_PATH = MODELS_DIR / "tfidf_vec.pkl"
    _CLF_PATH = MODELS_DIR / "intent_clf.pkl"
    if _VEC_PATH.exists() and _CLF_PATH.exists():
        _SKLEARN_VEC   = joblib.load(_VEC_PATH)
        _SKLEARN_CLF   = joblib.load(_CLF_PATH)
        _SKLEARN_READY = True
    else:
        _SKLEARN_READY = False
except ImportError:
    _SKLEARN_READY = False

# ── Intent prototype sentences ────────────────────────────────────────────────
INTENT_PROTOTYPES: dict[str, list[str]] = {
    "DriveLegal": [
        "What is the fine for jumping a red light?",
        "Penalty for drunk driving in India",
        "Challan for no helmet in Indore",
        "Traffic violation fine amount in MP",
        "What law covers over-speeding?",
        "Fine for driving without licence",
        "Penalty for using mobile while driving",
        "What is the seatbelt rule in Maharashtra?",
        "Rule for signal jump in Delhi",
        "How much is the helmet challan in Bhopal?",
        "Traffic challan amount for triple riding",
        "MV Act section for overspeeding",
        "Bina helmet challan kitna hai",
        "Signal todne ka fine",
        "Drunk driving penalty Bangalore",
        "PUC certificate fine India",
        "Wrong parking challan Indore",
        "Tinted glass violation fine",
        # Hinglish additions
        "Helmet nahi pehna toh kitna fine lagega?",
        "Red light todne par kya hoga?",
        "Bina licence gaadi chalane ka kya penalty hai?",
        "Mobile phone use karte hue drive karne par challan?",
        "Madhya Pradesh mein speed limit kya hai?",
        "Drunken driving ke liye MV Act section kya hai?",
        "Bhopal mein wrong parking ka fine bataao",
        "Insurance nahi hai toh kya hoga?",
        "Teen sawari par fine kitna hai?",
        "Bina PUC ke gaadi chalana allowed hai kya?",
        "Ulti taraf gaadi chalane par kya penalty hai?",
        "Dark film lagane ka fine India mein kya hai?",
        "Pressure horn laga sakte hain kya?",
        "RC nahi hai toh challan kitna hoga?",
        "Bangkok mein helmet rule kya hai?",
    ],
    "RoadSoS": [
        "Find nearest hospital",
        "Ambulance needed urgently",
        "Accident happened, need emergency help",
        "Nearest trauma centre from my location",
        "Police station near me",
        "Car rescue service needed",
        "Someone is injured on the road",
        "Emergency services nearby",
        "Petrol pump near me",
        "Nearest mechanic garage",
        # Hinglish additions
        "Paas mein hospital kahan hai?",
        "Ambulance bhejo jaldi",
        "Mujhe police station ka address chahiye",
        "Gaadi kharab ho gayi, mechanic kahan milega?",
        "Petrol khatam ho gaya, petrol pump kahan hai?",
        "Nearest trauma centre Indore mein kahan hai?",
        "Accident ho gaya, madad chahiye",
        "Injured hain, hospital le jaana hai",
        "Police ko bulana hai, number kya hai?",
        "Breakdown ho gaya NH44 par, help chahiye",
    ],
    "RoadWatch": [
        "There is a pothole on MG Road",
        "Streetlight not working",
        "Want to report road damage",
        "Complaint about broken divider",
        "Waterlogging near the market",
        "Report bad road condition",
        "Footpath is blocked",
        "Missing road sign at intersection",
        "Road surface broken near my house",
        "Speed breaker needed on this road",
        # Hinglish additions
        "Sadak mein bada gadhha hai, report karna chahta hoon",
        "Street light band hai hamare mohalle mein",
        "Road toot gayi hai, shikayat karna hai",
        "Traffic signal kaam nahi kar raha",
        "Paani bhar gaya road par",
        "Divider toot gaya hai highway par",
        "Footpath par kabza kar liya gaya hai",
        "Speed breaker lagwana hai school ke paas",
        "Garbage road par dala hua hai",
        "Lane marking mit gayi hai",
    ],
    "Emergency": [
        "Help! Accident!",
        "Crash on highway, people trapped",
        "SOS urgent emergency",
        "Someone is bleeding",
        "Fire in vehicle",
        "Person unconscious after crash",
        "Bachaao! Accident ho gaya",
        # Hinglish additions
        "Madad karo! Truck palta gaya",
        "Aag lagi hai gaadi mein, help!",
        "Log faas gaye hain andar",
        "Koi behosh pada hai road par",
        "Bahut khoon aa raha hai, jaldi ambulance",
        "SOS! Hamare saath accident hua",
        "Bachao please, emergency hai!",
    ],
}

_PROTO_EMBEDDINGS: dict[str, "np.ndarray"] | None = None


def _normalise(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _build_proto_embeddings():
    global _PROTO_EMBEDDINGS
    if not _ST_READY or _PROTO_EMBEDDINGS is not None:
        return
    _PROTO_EMBEDDINGS = {}
    for intent, sentences in INTENT_PROTOTYPES.items():
        vecs = _ST_MODEL.encode(sentences, normalize_embeddings=True)
        _PROTO_EMBEDDINGS[intent] = vecs.mean(axis=0)


def _cosine_classify(text: str) -> Tuple[str, float]:
    _build_proto_embeddings()
    query_vec = _ST_MODEL.encode([text], normalize_embeddings=True)[0]
    scores = {intent: float(np.dot(query_vec, centroid))
              for intent, centroid in _PROTO_EMBEDDINGS.items()}
    best = max(scores, key=scores.get)
    confidence = (scores[best] + 1) / 2
    return best, round(confidence, 3)


def _sklearn_classify(text: str) -> Tuple[str, float]:
    X     = _SKLEARN_VEC.transform([text])
    label = _SKLEARN_CLF.predict(X)[0]
    proba = float(_SKLEARN_CLF.predict_proba(X).max())
    return label, round(proba, 3)


# ── Keyword fallback ───────────────────────────────────────────────────────────
_KEYWORD_MAP: dict[str, list[str]] = {
    "DriveLegal": [
        "fine", "penalty", "challan", "traffic", "signal", "helmet",
        "license", "licence", "law", "rule", "violation", "speed",
        "drunk", "seatbelt", "registration", "permit", "section",
        "puc", "insurance", "rc", "parking", "tint", "horn",
        "bina", "nahi", "kitna", "challan", "todna", "tez",
    ],
    "RoadSoS": [
        "hospital", "ambulance", "police", "accident", "injured",
        "emergency", "crash", "rescue", "near me", "trauma",
        "petrol", "mechanic", "garage", "breakdown",
    ],
    "RoadWatch": [
        "pothole", "streetlight", "road damage", "broken", "report",
        "complaint", "repair", "divider", "footpath", "waterlogging",
        "sign", "speed breaker", "road condition",
    ],
}

_EMERGENCY_KEYWORDS = [
    "accident", "crash", "help", "urgent", "emergency", "bleeding",
    "unconscious", "fire", "trapped", "dying", "sos", "मदद", "फंसा",
    "bachaao", "help me", "madat karo",
]


def _keyword_classify(text: str) -> Tuple[str, float]:
    t = _normalise(text)
    scores = {i: sum(1 for kw in kws if kw in t)
              for i, kws in _KEYWORD_MAP.items()}
    best  = max(scores, key=scores.get)
    total = sum(scores.values()) or 1
    conf  = scores[best] / total if scores[best] > 0 else 0.35
    return best, round(min(conf, 0.65), 3)


# ── Public intent API ──────────────────────────────────────────────────────────

def predict_intent(text: str) -> Tuple[str, float]:
    """
    Returns (intent_label, confidence ∈ [0,1]).
    confidence < 0.55 → chat route asks user for clarification.

    NOTE: Emergency detection is intentionally NOT done here.
    chat.py calls detect_emergency() separately, AFTER seeing the intent,
    so that DriveLegal queries mentioning "accident" or "crash" are never
    mis-routed to crash mode (e.g. "fine for hit-and-run accident?").
    """
    if _ST_READY:
        return _cosine_classify(text)
    if _SKLEARN_READY:
        return _sklearn_classify(text)
    return _keyword_classify(text)


# ── Named Entity Recognition ──────────────────────────────────────────────────

# City → (state, country)
CITY_MAP: dict[str, dict] = {
    # India — Metros & major cities
    "chennai":      {"state": "Tamil Nadu",       "country": "India"},
    "madras":       {"state": "Tamil Nadu",       "country": "India"},
    "mumbai":       {"state": "Maharashtra",      "country": "India"},
    "bombay":       {"state": "Maharashtra",      "country": "India"},
    "delhi":        {"state": "Delhi",            "country": "India"},
    "new delhi":    {"state": "Delhi",            "country": "India"},
    "bengaluru":    {"state": "Karnataka",        "country": "India"},
    "bangalore":    {"state": "Karnataka",        "country": "India"},
    "hyderabad":    {"state": "Telangana",        "country": "India"},
    "kolkata":      {"state": "West Bengal",      "country": "India"},
    "calcutta":     {"state": "West Bengal",      "country": "India"},
    "pune":         {"state": "Maharashtra",      "country": "India"},
    "ahmedabad":    {"state": "Gujarat",          "country": "India"},
    "jaipur":       {"state": "Rajasthan",        "country": "India"},
    "indore":       {"state": "Madhya Pradesh",   "country": "India"},
    "lucknow":      {"state": "Uttar Pradesh",    "country": "India"},
    "patna":        {"state": "Bihar",            "country": "India"},
    "bhopal":       {"state": "Madhya Pradesh",   "country": "India"},
    "surat":        {"state": "Gujarat",          "country": "India"},
    "nagpur":       {"state": "Maharashtra",      "country": "India"},
    "coimbatore":   {"state": "Tamil Nadu",       "country": "India"},
    "guwahati":     {"state": "Assam",            "country": "India"},
    "chandigarh":   {"state": "Chandigarh",       "country": "India"},
    "kochi":        {"state": "Kerala",           "country": "India"},
    "thiruvananthapuram": {"state": "Kerala",     "country": "India"},
    "trivandrum":   {"state": "Kerala",           "country": "India"},
    "bhubaneswar":  {"state": "Odisha",           "country": "India"},
    "raipur":       {"state": "Chhattisgarh",     "country": "India"},
    "ranchi":       {"state": "Jharkhand",        "country": "India"},
    "visakhapatnam":{"state": "Andhra Pradesh",   "country": "India"},
    "vizag":        {"state": "Andhra Pradesh",   "country": "India"},
    "gwalior":      {"state": "Madhya Pradesh",   "country": "India"},
    "jabalpur":     {"state": "Madhya Pradesh",   "country": "India"},
    "ujjain":       {"state": "Madhya Pradesh",   "country": "India"},
    "mysuru":       {"state": "Karnataka",        "country": "India"},
    "mysore":       {"state": "Karnataka",        "country": "India"},
    "mangaluru":    {"state": "Karnataka",        "country": "India"},
    "nashik":       {"state": "Maharashtra",      "country": "India"},
    "amritsar":     {"state": "Punjab",           "country": "India"},
    "ludhiana":     {"state": "Punjab",           "country": "India"},
    "varanasi":     {"state": "Uttar Pradesh",    "country": "India"},
    "agra":         {"state": "Uttar Pradesh",    "country": "India"},
    "kanpur":       {"state": "Uttar Pradesh",    "country": "India"},
    "noida":        {"state": "Uttar Pradesh",    "country": "India"},
    "gurgaon":      {"state": "Haryana",          "country": "India"},
    "gurugram":     {"state": "Haryana",          "country": "India"},
    "faridabad":    {"state": "Haryana",          "country": "India"},
    "dehradun":     {"state": "Uttarakhand",      "country": "India"},
    "shimla":       {"state": "Himachal Pradesh", "country": "India"},
    # BIMSTEC — Bangladesh
    "dhaka":        {"state": "Dhaka Division",   "country": "Bangladesh"},
    "chittagong":   {"state": "Chittagong",       "country": "Bangladesh"},
    "sylhet":       {"state": "Sylhet",           "country": "Bangladesh"},
    "rajshahi":     {"state": "Rajshahi",         "country": "Bangladesh"},
    # BIMSTEC — Sri Lanka
    "colombo":      {"state": "Western Province", "country": "Sri Lanka"},
    "kandy":        {"state": "Central Province", "country": "Sri Lanka"},
    "galle":        {"state": "Southern Province","country": "Sri Lanka"},
    # BIMSTEC — Nepal
    "kathmandu":    {"state": "Bagmati",          "country": "Nepal"},
    "pokhara":      {"state": "Gandaki",          "country": "Nepal"},
    # BIMSTEC — Thailand
    "bangkok":      {"state": "Bangkok",          "country": "Thailand"},
    "chiang mai":   {"state": "Chiang Mai",       "country": "Thailand"},
    "phuket":       {"state": "Phuket",           "country": "Thailand"},
    # BIMSTEC — Myanmar
    "yangon":       {"state": "Yangon Region",    "country": "Myanmar"},
    "naypyidaw":    {"state": "Naypyidaw",        "country": "Myanmar"},
    "mandalay":     {"state": "Mandalay Region",  "country": "Myanmar"},
    # BIMSTEC — Bhutan
    "thimphu":      {"state": "Thimphu",          "country": "Bhutan"},
    "paro":         {"state": "Paro",             "country": "Bhutan"},
}

# Direct state-name lookup (for queries like "madhya pradesh me helmet")
STATE_MAP: dict[str, dict] = {
    "madhya pradesh": {"country": "India"},
    "mp":             {"country": "India", "state_full": "Madhya Pradesh"},
    "maharashtra":    {"country": "India"},
    "karnataka":      {"country": "India"},
    "tamil nadu":     {"country": "India"},
    "gujarat":        {"country": "India"},
    "rajasthan":      {"country": "India"},
    "uttar pradesh":  {"country": "India"},
    "up":             {"country": "India", "state_full": "Uttar Pradesh"},
    "west bengal":    {"country": "India"},
    "telangana":      {"country": "India"},
    "andhra pradesh": {"country": "India"},
    "ap":             {"country": "India", "state_full": "Andhra Pradesh"},
    "kerala":         {"country": "India"},
    "punjab":         {"country": "India"},
    "haryana":        {"country": "India"},
    "bihar":          {"country": "India"},
    "odisha":         {"country": "India"},
    "assam":          {"country": "India"},
    "delhi":          {"country": "India"},
}

VIOLATION_KEYWORDS = [
    # Multi-word first (longest match wins)
    "drunk driving", "drink and drive", "drunken driving",
    "no helmet", "bina helmet", "without helmet",
    "no seatbelt", "bina seatbelt", "without seatbelt",
    "signal jump", "red light jump", "signal todna",
    "over speeding", "overspeeding", "speed limit",
    "mobile phone", "phone driving", "using mobile",
    "wrong parking", "illegal parking", "galat parking",
    "triple riding", "triple seat", "teen sawari",
    "wrong side", "ulti taraf", "contraflow",
    "no licence", "bina licence", "without licence",
    "no insurance", "bina insurance",
    "no puc", "bina puc", "pollution certificate",
    "tinted glass", "dark film",
    "pressure horn", "loud horn",
    # Single word
    "helmet", "seatbelt", "signal", "speed", "mobile",
    "parking", "licence", "license", "insurance", "registration", "rc",
    "fitness", "permit",
]

SERVICE_KEYWORDS = [
    "hospital", "ambulance", "police", "petrol", "rescue",
    "mechanic", "trauma", "garage", "breakdown",
]


def extract_entities(text: str) -> dict:
    """
    Returns {location, state, country, violation, service_type}.
    Resolution order: multi-word city names → single-word cities → state names.
    Normalised matching removes diacritics and extra whitespace.
    """
    result = {
        "location":     None,
        "state":        None,
        "country":      None,
        "violation":    None,
        "service_type": None,
    }
    tl = _normalise(text)

    # ── City / location (longest match first) ──
    for city in sorted(CITY_MAP, key=len, reverse=True):
        if city in tl:
            result["location"] = city.title()
            result["state"]    = CITY_MAP[city]["state"]
            result["country"]  = CITY_MAP[city]["country"]
            break

    # ── State-level match (if no city found) ──
    if result["state"] is None:
        for state_key in sorted(STATE_MAP, key=len, reverse=True):
            if state_key in tl:
                info = STATE_MAP[state_key]
                result["state"]   = info.get("state_full", state_key.title())
                result["country"] = info["country"]
                break

    # ── Direct country mention (if no city/state matched) ──
    if result["country"] is None:
        for country in ["india", "bangladesh", "sri lanka", "nepal",
                        "myanmar", "thailand", "bhutan"]:
            if country in tl:
                result["country"] = country.title()
                break

    # ── Violation — longest match first ──
    for kw in sorted(VIOLATION_KEYWORDS, key=len, reverse=True):
        if kw in tl:
            result["violation"] = kw
            break

    # ── Service type ──
    for svc in SERVICE_KEYWORDS:
        if svc in tl:
            result["service_type"] = svc
            break

    return result
