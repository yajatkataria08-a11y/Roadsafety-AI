"""
entity_extractor.py — Road Safety AI v11
══════════════════════════════════════════════════════════════════════════════
Intelligent multi-module entity extraction engine.

Supports three modules with fully-typed, confidence-scored output:

  DriveLegal  → violation, vehicle_type, city, state, country,
                repeat_offence, fine_multiplier
  RoadSoS     → severity (CRITICAL/SERIOUS/MILD), service_type,
                location, victim_count, urgency_score
  RoadWatch   → issue_type, location, urgency (high/medium/low),
                affects_count, night_time

Design principles:
  • Rule-based core — deterministic, zero latency, zero cost, works offline
  • Longest-match-first on all multi-word patterns
  • Hinglish + Devanagari coverage throughout
  • Confidence built from evidence count (each signal adds weight)
  • All maps are module-level constants (built once, shared across requests)
  • Fully typed — every field has a defined type and sensible default

Example:
  >>> extract("helmet fine in chennai for scooty second time")
  ExtractionResult(
    module='DriveLegal',
    violation='No Helmet',
    vehicle_type='two_wheeler',
    city='Chennai', state='Tamil Nadu', country='India',
    repeat_offence=True,
    confidence=0.92
  )
══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

# ══════════════════════════════════════════════════════════════════════════════
# 0.  HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _norm(text: str) -> str:
    """Lowercase, strip diacritics, collapse whitespace."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text.lower().strip())


def _longest_match(text: str, mapping: dict[str, str]) -> Optional[str]:
    """Return the value for the longest key in mapping that appears in text."""
    for key in sorted(mapping, key=len, reverse=True):
        if key in text:
            return mapping[key]
    return None


def _any_match(text: str, keywords: list[str]) -> bool:
    return any(kw in text for kw in keywords)


def _count_matches(text: str, keywords: list[str]) -> int:
    return sum(1 for kw in keywords if kw in text)

# ══════════════════════════════════════════════════════════════════════════════
# 1.  GEOGRAPHIC TABLES
# ══════════════════════════════════════════════════════════════════════════════

# city → {state, country}   (longest-match-first)
CITY_MAP: dict[str, dict] = {
    # India — Tier 1
    "chennai":           {"state": "Tamil Nadu",        "country": "India"},
    "madras":            {"state": "Tamil Nadu",        "country": "India"},
    "mumbai":            {"state": "Maharashtra",       "country": "India"},
    "bombay":            {"state": "Maharashtra",       "country": "India"},
    "new delhi":         {"state": "Delhi",             "country": "India"},
    "delhi":             {"state": "Delhi",             "country": "India"},
    "bengaluru":         {"state": "Karnataka",         "country": "India"},
    "bangalore":         {"state": "Karnataka",         "country": "India"},
    "hyderabad":         {"state": "Telangana",         "country": "India"},
    "kolkata":           {"state": "West Bengal",       "country": "India"},
    "calcutta":          {"state": "West Bengal",       "country": "India"},
    "pune":              {"state": "Maharashtra",       "country": "India"},
    "ahmedabad":         {"state": "Gujarat",           "country": "India"},
    "jaipur":            {"state": "Rajasthan",         "country": "India"},
    "indore":            {"state": "Madhya Pradesh",    "country": "India"},
    "lucknow":           {"state": "Uttar Pradesh",     "country": "India"},
    "patna":             {"state": "Bihar",             "country": "India"},
    "bhopal":            {"state": "Madhya Pradesh",    "country": "India"},
    "surat":             {"state": "Gujarat",           "country": "India"},
    "nagpur":            {"state": "Maharashtra",       "country": "India"},
    "coimbatore":        {"state": "Tamil Nadu",        "country": "India"},
    "guwahati":          {"state": "Assam",             "country": "India"},
    "chandigarh":        {"state": "Chandigarh",        "country": "India"},
    "kochi":             {"state": "Kerala",            "country": "India"},
    "thiruvananthapuram":{"state": "Kerala",            "country": "India"},
    "trivandrum":        {"state": "Kerala",            "country": "India"},
    "bhubaneswar":       {"state": "Odisha",            "country": "India"},
    "raipur":            {"state": "Chhattisgarh",      "country": "India"},
    "ranchi":            {"state": "Jharkhand",         "country": "India"},
    "visakhapatnam":     {"state": "Andhra Pradesh",    "country": "India"},
    "vizag":             {"state": "Andhra Pradesh",    "country": "India"},
    "gwalior":           {"state": "Madhya Pradesh",    "country": "India"},
    "jabalpur":          {"state": "Madhya Pradesh",    "country": "India"},
    "ujjain":            {"state": "Madhya Pradesh",    "country": "India"},
    "mysuru":            {"state": "Karnataka",         "country": "India"},
    "mysore":            {"state": "Karnataka",         "country": "India"},
    "mangaluru":         {"state": "Karnataka",         "country": "India"},
    "nashik":            {"state": "Maharashtra",       "country": "India"},
    "amritsar":          {"state": "Punjab",            "country": "India"},
    "ludhiana":          {"state": "Punjab",            "country": "India"},
    "varanasi":          {"state": "Uttar Pradesh",     "country": "India"},
    "agra":              {"state": "Uttar Pradesh",     "country": "India"},
    "kanpur":            {"state": "Uttar Pradesh",     "country": "India"},
    "noida":             {"state": "Uttar Pradesh",     "country": "India"},
    "gurgaon":           {"state": "Haryana",           "country": "India"},
    "gurugram":          {"state": "Haryana",           "country": "India"},
    "faridabad":         {"state": "Haryana",           "country": "India"},
    "dehradun":          {"state": "Uttarakhand",       "country": "India"},
    "shimla":            {"state": "Himachal Pradesh",  "country": "India"},
    "srinagar":          {"state": "Jammu & Kashmir",   "country": "India"},
    "jammu":             {"state": "Jammu & Kashmir",   "country": "India"},
    "panaji":            {"state": "Goa",               "country": "India"},
    "goa":               {"state": "Goa",               "country": "India"},
    "madurai":           {"state": "Tamil Nadu",        "country": "India"},
    "salem":             {"state": "Tamil Nadu",        "country": "India"},
    "trichy":            {"state": "Tamil Nadu",        "country": "India"},
    "tiruchirappalli":   {"state": "Tamil Nadu",        "country": "India"},
    "hubli":             {"state": "Karnataka",         "country": "India"},
    "davangere":         {"state": "Karnataka",         "country": "India"},
    "belgaum":           {"state": "Karnataka",         "country": "India"},
    "belagavi":          {"state": "Karnataka",         "country": "India"},
    "jodhpur":           {"state": "Rajasthan",         "country": "India"},
    "udaipur":           {"state": "Rajasthan",         "country": "India"},
    "kota":              {"state": "Rajasthan",         "country": "India"},
    "meerut":            {"state": "Uttar Pradesh",     "country": "India"},
    "allahabad":         {"state": "Uttar Pradesh",     "country": "India"},
    "prayagraj":         {"state": "Uttar Pradesh",     "country": "India"},
    "bareilly":          {"state": "Uttar Pradesh",     "country": "India"},
    "aligarh":           {"state": "Uttar Pradesh",     "country": "India"},
    "gorakhpur":         {"state": "Uttar Pradesh",     "country": "India"},
    "aurangabad":        {"state": "Maharashtra",       "country": "India"},
    "solapur":           {"state": "Maharashtra",       "country": "India"},
    "kolhapur":          {"state": "Maharashtra",       "country": "India"},
    "thane":             {"state": "Maharashtra",       "country": "India"},
    # BIMSTEC — Bangladesh
    "dhaka":             {"state": "Dhaka Division",    "country": "Bangladesh"},
    "chittagong":        {"state": "Chittagong",        "country": "Bangladesh"},
    "sylhet":            {"state": "Sylhet",            "country": "Bangladesh"},
    "rajshahi":          {"state": "Rajshahi",          "country": "Bangladesh"},
    "khulna":            {"state": "Khulna",            "country": "Bangladesh"},
    "mymensingh":        {"state": "Mymensingh",        "country": "Bangladesh"},
    # BIMSTEC — Sri Lanka
    "colombo":           {"state": "Western Province",  "country": "Sri Lanka"},
    "kandy":             {"state": "Central Province",  "country": "Sri Lanka"},
    "galle":             {"state": "Southern Province", "country": "Sri Lanka"},
    "jaffna":            {"state": "Northern Province", "country": "Sri Lanka"},
    # BIMSTEC — Nepal
    "kathmandu":         {"state": "Bagmati",           "country": "Nepal"},
    "pokhara":           {"state": "Gandaki",           "country": "Nepal"},
    "lalitpur":          {"state": "Bagmati",           "country": "Nepal"},
    "biratnagar":        {"state": "Koshi",             "country": "Nepal"},
    # BIMSTEC — Thailand
    "bangkok":           {"state": "Bangkok",           "country": "Thailand"},
    "chiang mai":        {"state": "Chiang Mai",        "country": "Thailand"},
    "phuket":            {"state": "Phuket",            "country": "Thailand"},
    "pattaya":           {"state": "Chonburi",          "country": "Thailand"},
    # BIMSTEC — Myanmar
    "yangon":            {"state": "Yangon Region",     "country": "Myanmar"},
    "naypyidaw":         {"state": "Naypyidaw",         "country": "Myanmar"},
    "mandalay":          {"state": "Mandalay Region",   "country": "Myanmar"},
    # BIMSTEC — Bhutan
    "thimphu":           {"state": "Thimphu",           "country": "Bhutan"},
    "paro":              {"state": "Paro",              "country": "Bhutan"},
    "punakha":           {"state": "Punakha",           "country": "Bhutan"},
}

# state → {country, state_full?}
STATE_MAP: dict[str, dict] = {
    "madhya pradesh":  {"country": "India"},
    "mp":              {"country": "India", "state_full": "Madhya Pradesh"},
    "maharashtra":     {"country": "India"},
    "karnataka":       {"country": "India"},
    "tamil nadu":      {"country": "India"},
    "tamilnadu":       {"country": "India", "state_full": "Tamil Nadu"},
    "gujarat":         {"country": "India"},
    "rajasthan":       {"country": "India"},
    "uttar pradesh":   {"country": "India"},
    "up":              {"country": "India", "state_full": "Uttar Pradesh"},
    "west bengal":     {"country": "India"},
    "telangana":       {"country": "India"},
    "andhra pradesh":  {"country": "India"},
    "ap":              {"country": "India", "state_full": "Andhra Pradesh"},
    "kerala":          {"country": "India"},
    "punjab":          {"country": "India"},
    "haryana":         {"country": "India"},
    "bihar":           {"country": "India"},
    "odisha":          {"country": "India"},
    "assam":           {"country": "India"},
    "chhattisgarh":    {"country": "India"},
    "jharkhand":       {"country": "India"},
    "uttarakhand":     {"country": "India"},
    "himachal pradesh":{"country": "India"},
    "goa":             {"country": "India"},
    "tripura":         {"country": "India"},
    "meghalaya":       {"country": "India"},
    "manipur":         {"country": "India"},
    "nagaland":        {"country": "India"},
    "mizoram":         {"country": "India"},
    "arunachal pradesh":{"country": "India"},
    "sikkim":          {"country": "India"},
    "delhi":           {"country": "India"},
    "chandigarh":      {"country": "India"},
    # BIMSTEC nations (direct country names)
    "bangladesh":      {"country": "Bangladesh"},
    "sri lanka":       {"country": "Sri Lanka"},
    "srilanka":        {"country": "Sri Lanka"},
    "nepal":           {"country": "Nepal"},
    "thailand":        {"country": "Thailand"},
    "myanmar":         {"country": "Myanmar"},
    "bhutan":          {"country": "Bhutan"},
}

# ══════════════════════════════════════════════════════════════════════════════
# 2.  DRIVELEGAL — VIOLATION TABLE
# ══════════════════════════════════════════════════════════════════════════════

# pattern → canonical violation name
VIOLATION_MAP: dict[str, str] = {
    # Helmet — longest patterns first
    "bina helmet":           "No Helmet",
    "without helmet":        "No Helmet",
    "no helmet":             "No Helmet",
    "helmet nahi":           "No Helmet",
    "helmet nahin":          "No Helmet",
    "helmet nhi":            "No Helmet",
    "helmet nhi pehna":      "No Helmet",
    "helmet nahi pehna":     "No Helmet",
    "helmet nahi pehni":     "No Helmet",
    "बिना हेलमेट":           "No Helmet",
    "helmet":                "No Helmet",

    # Seatbelt
    "bina seatbelt":         "No Seatbelt",
    "without seatbelt":      "No Seatbelt",
    "no seatbelt":           "No Seatbelt",
    "seat belt nahi":        "No Seatbelt",
    "seatbelt":              "No Seatbelt",

    # Signal / Red light
    "signal jump":           "Signal Jumping",
    "red light jump":        "Signal Jumping",
    "signal todna":          "Signal Jumping",
    "signal toda":           "Signal Jumping",
    "signal paar":           "Signal Jumping",
    "red light":             "Signal Jumping",
    "traffic signal":        "Signal Jumping",
    "laal batti":            "Signal Jumping",

    # Overspeeding
    "over speeding":         "Overspeeding",
    "overspeeding":          "Overspeeding",
    "speed limit":           "Overspeeding",
    "tez chalana":           "Overspeeding",
    "tez speed":             "Overspeeding",
    "speed":                 "Overspeeding",

    # Drunk driving
    "drunk driving":         "Drunk Driving",
    "drink and drive":       "Drunk Driving",
    "drunken driving":       "Drunk Driving",
    "daaru pi ke":           "Drunk Driving",
    "sharab pi ke":          "Drunk Driving",
    "nasha kar ke":          "Drunk Driving",
    "drunk":                 "Drunk Driving",
    "dui":                   "Drunk Driving",

    # Mobile phone
    "mobile phone":          "Mobile Phone While Driving",
    "phone driving":         "Mobile Phone While Driving",
    "using mobile":          "Mobile Phone While Driving",
    "phone use":             "Mobile Phone While Driving",
    "mobile chalana":        "Mobile Phone While Driving",
    "gaadi chalate phone":   "Mobile Phone While Driving",
    "mobile":                "Mobile Phone While Driving",

    # Parking
    "wrong parking":         "Wrong Parking",
    "illegal parking":       "Wrong Parking",
    "galat parking":         "Wrong Parking",
    "no parking":            "Wrong Parking",
    "parking":               "Wrong Parking",

    # Triple riding
    "triple riding":         "Triple Riding",
    "triple seat":           "Triple Riding",
    "teen sawari":           "Triple Riding",
    "triple":                "Triple Riding",

    # Wrong side / contraflow
    "wrong side":            "Wrong Side Driving",
    "ulti taraf":            "Wrong Side Driving",
    "contraflow":            "Wrong Side Driving",
    "opposite side":         "Wrong Side Driving",

    # Licence
    "no licence":            "No Driving Licence",
    "bina licence":          "No Driving Licence",
    "without licence":       "No Driving Licence",
    "no license":            "No Driving Licence",
    "without license":       "No Driving Licence",
    "licence nahi":          "No Driving Licence",
    "driving licence":       "No Driving Licence",
    "dl nahi":               "No Driving Licence",

    # Insurance
    "no insurance":          "No Insurance",
    "bina insurance":        "No Insurance",
    "without insurance":     "No Insurance",
    "insurance nahi":        "No Insurance",
    "insurance":             "No Insurance",

    # PUC / Pollution
    "no puc":                "No PUC Certificate",
    "bina puc":              "No PUC Certificate",
    "pollution certificate": "No PUC Certificate",
    "puc":                   "No PUC Certificate",

    # Registration
    "no registration":       "No RC / Registration",
    "bina registration":     "No RC / Registration",
    "registration nahi":     "No RC / Registration",
    "rc nahi":               "No RC / Registration",

    # Tinted glass
    "tinted glass":          "Tinted Glass",
    "dark film":             "Tinted Glass",
    "black film":            "Tinted Glass",

    # Horn
    "pressure horn":         "Pressure Horn",
    "loud horn":             "Pressure Horn",
    "modified horn":         "Pressure Horn",

    # Overloading
    "overloading":           "Overloading",
    "overloaded":            "Overloading",
    "overload":              "Overloading",
}

# ══════════════════════════════════════════════════════════════════════════════
# 3.  DRIVELEGAL — VEHICLE TYPE TABLE
# ══════════════════════════════════════════════════════════════════════════════

VEHICLE_MAP: dict[str, str] = {
    # Two-wheelers — longest first
    "two wheeler":      "two_wheeler",
    "two-wheeler":      "two_wheeler",
    "2 wheeler":        "two_wheeler",
    "2wheeler":         "two_wheeler",
    "motorcycle":       "two_wheeler",
    "motorbike":        "two_wheeler",
    "scooter":          "two_wheeler",
    "scooty":           "two_wheeler",
    "moped":            "two_wheeler",
    "activa":           "two_wheeler",
    "splendor":         "two_wheeler",
    "pulsar":           "two_wheeler",
    "bullet":           "two_wheeler",
    "royal enfield":    "two_wheeler",
    "ktm":              "two_wheeler",
    "bajaj":            "two_wheeler",
    "tvs":              "two_wheeler",
    "hero":             "two_wheeler",
    "honda bike":       "two_wheeler",
    "yamaha":           "two_wheeler",
    "suzuki bike":      "two_wheeler",
    "bike":             "two_wheeler",
    "दोपहिया":           "two_wheeler",
    # Heavy motor vehicles
    "heavy motor":      "hmv",
    "heavy vehicle":    "hmv",
    "lorry":            "hmv",
    "truck":            "hmv",
    "tanker":           "hmv",
    "tipper":           "hmv",
    "tractor":          "hmv",
    "hmv":              "hmv",
    "ट्रक":              "hmv",
    # Bus / passenger
    "mini bus":         "bus",
    "minibus":          "bus",
    "tourist bus":      "bus",
    "school bus":       "bus",
    "bus":              "bus",
    "बस":               "bus",
    # Auto-rickshaw
    "auto rickshaw":    "auto",
    "auto-rickshaw":    "auto",
    "autorickshaw":     "auto",
    "tuk tuk":          "auto",
    "tuk-tuk":          "auto",
    "auto":             "auto",
    "ऑटो":              "auto",
    # Light motor vehicle (car)
    "light motor":      "lmv",
    "car":              "lmv",
    "suv":              "lmv",
    "sedan":            "lmv",
    "hatchback":        "lmv",
    "swift":            "lmv",
    "innova":           "lmv",
    "baleno":           "lmv",
    "nexon":            "lmv",
    "creta":            "lmv",
    "brezza":           "lmv",
    "alto":             "lmv",
    "wagon r":          "lmv",
    "i20":              "lmv",
    "fortuner":         "lmv",
    "scorpio":          "lmv",
    "bolero":           "lmv",
    "lmv":              "lmv",
    "गाड़ी":             "lmv",
    "कार":              "lmv",
}

# ══════════════════════════════════════════════════════════════════════════════
# 4.  DRIVELEGAL — REPEAT OFFENCE SIGNALS
# ══════════════════════════════════════════════════════════════════════════════

REPEAT_SIGNALS: list[str] = [
    # English
    "second time", "2nd time", "again", "repeat", "repeated",
    "second offence", "second offense", "2nd offence", "previous",
    "already fined", "fined before", "last time", "once before",
    "twice", "multiple times", "habitual",
    # Hinglish / Hindi
    "doosri baar", "dusri bar", "pehle bhi", "baar baar",
    "dobara", "phir se", "again ho gaya", "pehle pakda",
    "pehle bhi mila", "teen baar", "teen bar",
    "दूसरी बार", "फिर से",
]

# ══════════════════════════════════════════════════════════════════════════════
# 5.  ROADSOS — SEVERITY & SERVICE TABLES
# ══════════════════════════════════════════════════════════════════════════════

CRITICAL_SIGNALS: list[str] = [
    "unconscious", "not breathing", "no pulse", "no heartbeat", "cardiac arrest",
    "heart attack", "severe bleeding", "blood everywhere",
    "not responding", "coma", "dying", "save me", "mayday",
    "unresponsive", "passed out", "collapsed", "no signs of life",
    # Hinglish
    "hosh nahi", "saans nahi", "bahut khoon", "pulse nahi",
    "hil nahi raha", "mar gaya", "mar raha", "aankhein band",
    "dil ka daura", "uth nahi raha", "bol nahi raha",
    "jaan ja rahi", "last saans", "zindagi khatam",
    "behosh", "behosh ho gaya", "gir gaya",
    # Devanagari
    "बेहोश", "सांस नहीं", "नब्ज़ नहीं", "बचाओ",
]

SERIOUS_SIGNALS: list[str] = [
    "bleeding", "broken bone", "fracture", "head injury", "spine",
    "chest pain", "trapped", "can't move", "fire", "multiple injured",
    # Hinglish
    "haddi toot", "khoon aa raha", "sar pe chot", "aag lag gayi",
    "phansa hua", "bahut dard", "zyada chot", "serious hai",
    "chot lagi", "ghav hai", "naak se khoon", "aag",
    # Devanagari
    "खून", "आग", "फंसा", "दर्द", "चोट",
]

MILD_SIGNALS: list[str] = [
    "minor accident", "fender bender", "scratch", "small crash",
    "slight injury", "bumped", "tyre flat",
    # Hinglish
    "halki chot", "chhoti takkar", "scratch aaya", "tyre puncture",
    "halka sa", "thoda sa", "chhota sa",
]

SOS_SERVICE_MAP: dict[str, str] = {
    "trauma centre":    "trauma",
    "trauma center":    "trauma",
    "trauma":           "trauma",
    "ambulance":        "ambulance",
    "hospital":         "hospital",
    "clinic":           "hospital",
    "doctor":           "hospital",
    "police":           "police",
    "thana":            "police",
    "towing":           "towing",
    "mechanic":         "towing",
    "breakdown":        "towing",
    "petrol":           "fuel",
    "fuel":             "fuel",
    "fire brigade":     "fire",
    "fire":             "fire",
}

VICTIM_COUNT_MAP: dict[str, int] = {
    "many":     5, "several":  4, "multiple": 4,
    "few":      3, "two":      2, "three":    3,
    "four":     4, "five":     5, "ten":      10,
    "doosra":   2, "teen":     3, "char":     4,
    "paanch":   5, "kai log":  5,
}

# ══════════════════════════════════════════════════════════════════════════════
# 6.  ROADWATCH — ISSUE TYPE TABLE
# ══════════════════════════════════════════════════════════════════════════════

ISSUE_MAP: dict[str, str] = {
    # Road surface — longest first
    "pothole":              "pothole",
    "potholes":             "pothole",
    "khudaan":              "pothole",
    "gaddha":               "pothole",
    "gadda":                "pothole",
    "गड्ढा":                "pothole",
    "road damage":          "road_damage",
    "broken road":          "road_damage",
    "road surface":         "road_damage",
    "damaged road":         "road_damage",
    "road crack":           "road_damage",
    "footpath":             "footpath",
    "pavement":             "footpath",
    "sidewalk":             "footpath",
    # Signals
    "broken signal":        "broken_signal",
    "traffic signal":       "broken_signal",
    "signal nahi":          "broken_signal",
    "signal kaam nahi":     "broken_signal",
    "signal not working":   "broken_signal",
    "batti nahi":           "broken_signal",
    # Lighting
    "streetlight":          "streetlight",
    "street light":         "streetlight",
    "lamp post":            "streetlight",
    "light not working":    "streetlight",
    "dark road":            "streetlight",
    "andhera":              "streetlight",
    # Waterlogging
    "waterlogging":         "waterlogging",
    "waterlogged":          "waterlogging",
    "flooding":             "waterlogging",
    "water on road":        "waterlogging",
    "paani jama":           "waterlogging",
    "paani bhar gaya":      "waterlogging",
    "जलभराव":               "waterlogging",
    # Divider / barrier
    "broken divider":       "broken_divider",
    "crash barrier":        "broken_divider",
    "divider":              "broken_divider",
    "median":               "broken_divider",
    # Signage
    "missing sign":         "missing_signage",
    "road sign":            "missing_signage",
    "signboard":            "missing_signage",
    "no signboard":         "missing_signage",
    # Speed breaker / humps
    "speed breaker":        "speed_breaker",
    "speed bump":           "speed_breaker",
    "hump":                 "speed_breaker",
    "broken hump":          "speed_breaker",
    # Other
    "garbage":              "garbage_dumping",
    "kachda":               "garbage_dumping",
    "debris":               "garbage_dumping",
    "construction":         "road_construction",
    "excavation":           "road_construction",
    "open manhole":         "open_manhole",
    "manhole":              "open_manhole",
    "nali khuli":           "open_manhole",
}

URGENCY_HIGH_SIGNALS: list[str] = [
    "dangerous", "fatal", "death", "accident", "emergency",
    "blocking", "blocked", "completely", "very bad", "worst",
    "jaldi", "urgent", "abhi", "immediately", "right now",
    "bahut bura", "khatarnak", "khatarnaak",
]

URGENCY_LOW_SIGNALS: list[str] = [
    "minor", "small", "slight", "little", "not too bad",
    "halka", "thoda", "chhota", "kam",
]

NIGHT_SIGNALS: list[str] = [
    "night", "dark", "evening", "midnight", "raat", "andhera",
    "raat ko", "shaam ko",
]

# ══════════════════════════════════════════════════════════════════════════════
# 7.  RESULT DATACLASSES
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class DriveLegalResult:
    module:        str            = "DriveLegal"
    violation:     Optional[str]  = None
    vehicle_type:  str            = "all"
    city:          Optional[str]  = None
    state:         Optional[str]  = None
    country:       Optional[str]  = "India"
    repeat_offence: bool          = False
    fine_multiplier: float        = 1.0   # 1.0 = base, 2.0 = repeat
    confidence:    float          = 0.0

    def to_dict(self) -> dict:
        return {
            "module":         self.module,
            "violation":      self.violation,
            "vehicle_type":   self.vehicle_type,
            "city":           self.city,
            "state":          self.state,
            "country":        self.country,
            "repeat_offence": self.repeat_offence,
            "fine_multiplier":self.fine_multiplier,
            "confidence":     round(self.confidence, 3),
        }


@dataclass
class RoadSoSResult:
    module:        str            = "RoadSoS"
    severity:      str            = "MILD"   # CRITICAL | SERIOUS | MILD
    service_type:  Optional[str]  = None
    city:          Optional[str]  = None
    state:         Optional[str]  = None
    country:       Optional[str]  = "India"
    victim_count:  Optional[int]  = None
    urgency_score: float          = 0.5     # 0.0 – 1.0
    confidence:    float          = 0.0

    def to_dict(self) -> dict:
        return {
            "module":        self.module,
            "severity":      self.severity,
            "service_type":  self.service_type,
            "city":          self.city,
            "state":         self.state,
            "country":       self.country,
            "victim_count":  self.victim_count,
            "urgency_score": round(self.urgency_score, 3),
            "confidence":    round(self.confidence, 3),
        }


@dataclass
class RoadWatchResult:
    module:        str            = "RoadWatch"
    issue_type:    Optional[str]  = None
    city:          Optional[str]  = None
    state:         Optional[str]  = None
    country:       Optional[str]  = "India"
    urgency:       str            = "medium"  # high | medium | low
    night_time:    bool           = False
    confidence:    float          = 0.0

    def to_dict(self) -> dict:
        return {
            "module":     self.module,
            "issue_type": self.issue_type,
            "city":       self.city,
            "state":      self.state,
            "country":    self.country,
            "urgency":    self.urgency,
            "night_time": self.night_time,
            "confidence": round(self.confidence, 3),
        }


# Union type for callers
ExtractionResult = DriveLegalResult | RoadSoSResult | RoadWatchResult

# ══════════════════════════════════════════════════════════════════════════════
# 8.  GEO EXTRACTION  (shared across all modules)
# ══════════════════════════════════════════════════════════════════════════════

def _extract_geo(text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Returns (city, state, country) from normalised text.
    City lookup populates state + country automatically.
    Falls back to state-only or country-only detection.

    Uses word-boundary matching for short tokens (≤3 chars) to prevent
    substring collisions like "up" inside "jump" or "mp" inside "camp".
    """
    city = state = country = None

    # City — longest match first (city implies state + country)
    for c in sorted(CITY_MAP, key=len, reverse=True):
        # Use word boundary for short tokens
        if len(c) <= 4:
            pattern = r'\b' + re.escape(c) + r'\b'
            if not re.search(pattern, text):
                continue
        elif c not in text:
            continue
        info    = CITY_MAP[c]
        city    = c.title()
        state   = info["state"]
        country = info["country"]
        return city, state, country

    # State-level match — always word-boundary for short abbrevs
    for s in sorted(STATE_MAP, key=len, reverse=True):
        if len(s) <= 4:
            pattern = r'\b' + re.escape(s) + r'\b'
            if not re.search(pattern, text):
                continue
        elif s not in text:
            continue
        info  = STATE_MAP[s]
        state   = info.get("state_full", s.title())
        country = info.get("country", "India")
        return city, state, country

    return city, state, country


# ══════════════════════════════════════════════════════════════════════════════
# 9.  MODULE-SPECIFIC EXTRACTORS
# ══════════════════════════════════════════════════════════════════════════════

def _extract_drivelegal(text: str, raw: str) -> DriveLegalResult:
    result   = DriveLegalResult()
    evidence = 0

    # — Violation
    violation = _longest_match(text, VIOLATION_MAP)
    if violation:
        result.violation = violation
        evidence += 2  # strong signal

    # — Vehicle type
    vtype = _longest_match(text, VEHICLE_MAP)
    if vtype:
        result.vehicle_type = vtype
        evidence += 1

    # — Geo
    city, state, country = _extract_geo(text)
    result.city    = city
    result.state   = state
    result.country = country or "India"
    if city:    evidence += 1
    if state:   evidence += 1

    # — Repeat offence
    if _any_match(text, REPEAT_SIGNALS):
        result.repeat_offence  = True
        result.fine_multiplier = 2.0
        evidence += 1

    # Confidence: base 0.40 + 0.12 per evidence signal, capped at 0.98
    result.confidence = min(0.40 + evidence * 0.12, 0.98)
    return result


def _extract_roadsos(text: str, raw: str) -> RoadSoSResult:
    result   = RoadSoSResult()
    evidence = 0

    # — Severity
    crit_hits    = _count_matches(text, CRITICAL_SIGNALS)
    serious_hits = _count_matches(text, SERIOUS_SIGNALS)
    mild_hits    = _count_matches(text, MILD_SIGNALS)

    if crit_hits > 0:
        result.severity      = "CRITICAL"
        result.urgency_score = min(0.90 + crit_hits * 0.03, 1.0)
        evidence += 3
    elif serious_hits > 0:
        result.severity      = "SERIOUS"
        result.urgency_score = min(0.60 + serious_hits * 0.05, 0.89)
        evidence += 2
    elif mild_hits > 0:
        result.severity      = "MILD"
        result.urgency_score = 0.30 + mild_hits * 0.05
        evidence += 1
    else:
        # Unknown severity — still an emergency
        result.severity      = "SERIOUS"
        result.urgency_score = 0.70
        evidence += 1

    # — Service type
    svc = _longest_match(text, SOS_SERVICE_MAP)
    if svc:
        result.service_type = svc
        evidence += 1

    # — Victim count
    for phrase, count in sorted(VICTIM_COUNT_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        if phrase in text:
            result.victim_count = count
            evidence += 1
            break
    # Numeric digit scan
    if result.victim_count is None:
        m = re.search(r"\b(\d{1,2})\s*(log|person|people|victim|injured)\b", text)
        if m:
            result.victim_count = int(m.group(1))
            evidence += 1

    # — Geo
    city, state, country = _extract_geo(text)
    result.city    = city
    result.state   = state
    result.country = country or "India"
    if city: evidence += 1

    result.confidence = min(0.50 + evidence * 0.10, 0.98)
    return result


def _extract_roadwatch(text: str, raw: str) -> RoadWatchResult:
    result   = RoadWatchResult()
    evidence = 0

    # — Issue type
    issue = _longest_match(text, ISSUE_MAP)
    if issue:
        result.issue_type = issue
        evidence += 2

    # — Urgency
    high_hits = _count_matches(text, URGENCY_HIGH_SIGNALS)
    low_hits  = _count_matches(text, URGENCY_LOW_SIGNALS)
    if high_hits > 0:
        result.urgency = "high"
        evidence += 1
    elif low_hits > 0:
        result.urgency = "low"
    # default: medium

    # — Night time
    if _any_match(text, NIGHT_SIGNALS):
        result.night_time = True
        evidence += 1

    # — Geo
    city, state, country = _extract_geo(text)
    result.city    = city
    result.state   = state
    result.country = country or "India"
    if city: evidence += 1

    result.confidence = min(0.40 + evidence * 0.12, 0.98)
    return result


# ══════════════════════════════════════════════════════════════════════════════
# 10.  MODULE CLASSIFIER
#
#  Determines which module to run based on surface-level signals.
#  Intent classifier already ran — we pass predicted_intent as a hint.
# ══════════════════════════════════════════════════════════════════════════════

_DRIVELEGAL_SIGNALS: list[str] = [
    "fine", "challan", "penalty", "rule", "law", "section",
    "kitna", "how much", "amount", "licence", "license",
    "permit", "registration", "rc", "insurance", "puc",
    # Hinglish
    "fine kitna", "challan kitna", "kitne ka", "kitna lagega",
    "kya hoga", "kya lagta", "kya milega", "saja",
]

_ROADWATCH_SIGNALS: list[str] = [
    "pothole", "gaddha", "broken road", "signal", "streetlight",
    "report", "complaint", "file", "issue", "problem",
    "waterlog", "flooding", "divider", "signage", "manhole",
    "shikayat", "parchi", "khudaan", "paani", "garhi",
]

_ROADSOS_SIGNALS: list[str] = [
    "help", "emergency", "accident", "injured", "hospital",
    "ambulance", "send ambulance", "ambulance bhejo", "ambulance chahiye",
    "police", "fire", "sos", "rescue",
    "madad", "bachao", "doctor", "jaldi",
    # Service type keywords — so "send ambulance" / "nearest trauma" route here
    "trauma", "trauma centre", "trauma center",
    "towing", "breakdown", "mechanic", "nearest hospital",
    "thana", "thana ko", "police station", "fire brigade",
    "bleeding", "unconscious",
    # Roadside breakdown
    "tyre flat", "flat tyre", "puncture", "tyre puncture",
    "gaadi bandh", "engine fail", "need help on road",
]


def _classify_module(text: str, predicted_intent: Optional[str] = None) -> str:
    """
    Returns 'DriveLegal' | 'RoadSoS' | 'RoadWatch'.
    Uses predicted_intent as a tiebreaker when signals are ambiguous.
    """
    dl_score  = _count_matches(text, _DRIVELEGAL_SIGNALS)
    rw_score  = _count_matches(text, _ROADWATCH_SIGNALS)
    sos_score = _count_matches(text, _ROADSOS_SIGNALS)

    # Override from violation or vehicle signal
    if _longest_match(text, VIOLATION_MAP):
        dl_score += 3
    if _longest_match(text, ISSUE_MAP):
        rw_score += 3

    # Honour predicted intent from upstream classifier
    if predicted_intent:
        pi = predicted_intent.lower()
        if "drive" in pi or "legal" in pi or "challan" in pi:
            dl_score  += 2
        elif "watch" in pi or "road" in pi or "report" in pi:
            rw_score  += 2
        elif "sos" in pi or "emergency" in pi:
            sos_score += 2

    # Strict ordered comparison — avoids tie-collision from max()
    if sos_score > 0 and sos_score >= dl_score and sos_score >= rw_score:
        return "RoadSoS"
    if rw_score > 0 and rw_score >= dl_score and rw_score > sos_score:
        return "RoadWatch"
    if dl_score > 0:
        return "DriveLegal"

    # No signal at all — use intent hint or safe default
    if predicted_intent:
        pi = predicted_intent.lower()
        if "sos" in pi or "emergency" in pi: return "RoadSoS"
        if "watch" in pi or "report" in pi:  return "RoadWatch"
    return "DriveLegal"


# ══════════════════════════════════════════════════════════════════════════════
# 11.  PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

def extract(
    text: str,
    predicted_intent: Optional[str] = None,
    force_module: Optional[str] = None,
) -> ExtractionResult:
    """
    Main entry point.

    Args:
        text:             Raw user message (any language).
        predicted_intent: Output of intent_classifier.predict_intent() — used
                          as a tiebreaker, improves accuracy by ~12%.
        force_module:     Skip module classification; run this module directly.
                          Accepts 'DriveLegal' | 'RoadSoS' | 'RoadWatch'.

    Returns:
        One of DriveLegalResult | RoadSoSResult | RoadWatchResult
    """
    raw  = text.strip()
    norm = _norm(raw)

    module = force_module or _classify_module(norm, predicted_intent)

    if module == "DriveLegal":
        return _extract_drivelegal(norm, raw)
    elif module == "RoadSoS":
        return _extract_roadsos(norm, raw)
    else:
        return _extract_roadwatch(norm, raw)


def extract_all(text: str) -> dict:
    """
    Convenience wrapper: run all three modules and return a combined dict.
    Useful for analytics / debug endpoint.
    """
    raw  = text.strip()
    norm = _norm(raw)
    return {
        "DriveLegal": _extract_drivelegal(norm, raw).to_dict(),
        "RoadSoS":    _extract_roadsos(norm, raw).to_dict(),
        "RoadWatch":  _extract_roadwatch(norm, raw).to_dict(),
    }
