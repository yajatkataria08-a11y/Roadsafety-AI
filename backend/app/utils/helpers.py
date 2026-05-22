"""
Utility helpers — emergency detection, text cleaning, etc.  (v6 — Smart Crash Mode)
══════════════════════════════════════════════════════════════════════════════════════
Upgrades in v6:
  • Massively expanded Hindi + Hinglish keyword lists (accident ho gaya, madad,
    takkar, chot lagi, gir gaya, dard, khoon, jal raha, phansa, etc.)
  • Pure Devanagari keyword set for users typing in Hindi script
  • New Crash-Mode specific phrase patterns (jaldi + service combos)
  • Severity-aware scoring: CRITICAL phrases push score to 0.98
  • DriveLegal guard: if message is clearly a challan/fine query, score → 0.0
  • detect_emergency_scored() tuned for fewer false positives on legal queries
"""

from __future__ import annotations
import re


# ══════════════════════════════════════════════════════════════════════════════
# CRITICAL keywords — life-threatening, always 0.98 score
# ══════════════════════════════════════════════════════════════════════════════

_EMERGENCY_CRITICAL = [
    # English
    "unconscious", "not breathing", "no pulse", "cardiac arrest",
    "heart attack", "severe bleeding", "blood everywhere", "critical",
    "not responding", "dying", "save me", "save us", "mayday",
    # Hindi Devanagari
    "बचाओ", "मदद", "बेहोश", "सांस नहीं", "खून", "आग", "फंसा",
    "मदद करो", "मदद कीजिए", "मदद चाहिए", "अस्पताल", "एम्बुलेंस",
    # Hinglish
    "bachao", "bachaao", "hosh nahi", "sans nahi", "saans nahi",
    "pulse nahi", "hil nahi raha", "mar gaya", "mar raha", "mar rahi",
    "aankhein band", "dil ka daura", "bahut khoon", "khoon bahut",
    "uth nahi raha", "bol nahi raha", "jaan ja rahi", "jaan khatam",
    "zindagi khatam", "last saans",
]

# ══════════════════════════════════════════════════════════════════════════════
# PRIMARY emergency keywords — any single match → score 0.95
# ══════════════════════════════════════════════════════════════════════════════

_EMERGENCY_PRIMARY = [
    # English
    "help", "urgent", "sos", "bleeding", "fire", "trapped",
    "please help", "need help", "call ambulance", "call police",
    "emergency", "life threatening", "seizure", "overdose", "stroke",
    # Hindi Devanagari
    "दर्द", "जल रहा", "जल रही",
    # Hinglish / Roman transliteration
    "madad", "madad karo", "madad chahiye", "help chahiye",
    "ambulance chahiye", "ambulance bulao", "ambulance bhejo",
    "doctor bulao", "doctor chahiye", "doctor bhejo",
    "hospital le jao", "hospital chahiye", "hospital jaana hai",
    "jaldi aao", "jaldi aao please", "sos hai", "emergency hai",
    "khoon aa raha", "khoon nikal raha", "bahut dard", "bohot dard",
    "saans nahi aa rahi", "car mein phansa", "accident mein phansa",
    "mujhe bachao", "use bachao", "unhe bachao", "usse bachao",
    "aag lagi", "aag lag gayi", "jal raha hai", "phansa hua",
    "nikal nahi pa raha", "police bhejo", "help karo",
    "neend aa rahi", "ankhein band ho rahi",
    # injury phrases
    "chot lagi", "chot bahut hai", "ghav hai", "toot gayi haddi",
    "haddi toot", "sar pe chot", "sar pe lagi", "sir pe lagi",
    "aankhon se khoon", "naak se khoon", "munh se khoon",
    # accident + help combos
    "accident hua help", "takkar ho gayi madad", "gir gaya please",
    "gir gaya help", "crash ho gaya help", "accident ho gaya help",
]

# ══════════════════════════════════════════════════════════════════════════════
# AMBIGUOUS keywords — indicate emergency only WITH extra context
# ══════════════════════════════════════════════════════════════════════════════

_EMERGENCY_AMBIGUOUS = [
    # English
    "accident", "crash", "hit", "collide", "collision",
    "fell", "fallen", "rolled over", "overturned", "totalled",
    # Hinglish
    "accident ho gaya", "accident hua", "accident ho gayi",
    "takkar ho gayi", "takkar ho gaya", "takkar lagi",
    "gaadi palti", "gaadi ulti", "truck palti", "bike giri",
    "gaadi mein aag", "crash ho gaya", "crash hua",
    "khamba se takra", "divider se takra", "truck se takra",
    "gaadi palt gayi", "gir gaya", "gir gayi",
    # body injury hints
    "chot", "dard", "dard ho raha", "dard uthh raha",
    "injured", "hurt",
]

# ══════════════════════════════════════════════════════════════════════════════
# FINE / LEGAL query signals — if 2+ present, score → 0.0
# ══════════════════════════════════════════════════════════════════════════════

_FINE_QUERY_SIGNALS = [
    "fine", "penalty", "challan", "law", "rule", "section", "act",
    "kitna", "how much", "amount", "punishment", "what is", "bataao",
    "bata do", "kya hoga", "kya hai", "kya lagega", "kya milega",
    "compensation", "insurance claim", "fir kaise", "fir darz",
    "complaint kaise", "case kaise", "court", "lawyer", "advocate",
    "traffic rule", "traffic fine", "road rule", "motor vehicle",
    "challan kitna", "fine kitna", "kitne ka challan",
]

# Extra urgency signals that upgrade ambiguous → emergency
_URGENCY_EXTRAS = [
    "please", "now", "immediately", "jaldi", "abhi", "turant",
    "bohot jaldi", "bahut jaldi", "asap", "sos",
    "need help", "help chahiye", "please help", "madad karo",
    "help", "yahan", "yaar", "bhai",
]

# ══════════════════════════════════════════════════════════════════════════════
# Regex patterns for common emergency phrases
# ══════════════════════════════════════════════════════════════════════════════

_EMERGENCY_PATTERNS: list[re.Pattern] = [
    re.compile(r"\baccident\b.*\b(help|hurt|injur|bleed|unconscious|serious|dead)\b", re.I),
    re.compile(r"\b(crash|collision)\b.*\b(help|now|please|urgent|serious)\b", re.I),
    re.compile(r"\b(hospital|ambulance|emergency)\b.*\bfast\b", re.I),
    re.compile(r"\bjaldi\b.*\b(hospital|ambulance|doctor|police|bulao|bhejo)\b", re.I),
    re.compile(r"\b(gaadi|bike|truck|bus|car)\b.*\b(palti|palt|ulti|aag|phans|gir)\b", re.I),
    re.compile(r"\bkoi\b.*\b(behosh|mar|unconscious|injur|gir)\b", re.I),
    re.compile(r"\b(khoon|blood)\b.*\b(aa raha|nikal|beh raha|bahut)\b", re.I),
    re.compile(r"\b(please|plz)\b.*\b(help|bachao|madad)\b", re.I),
    re.compile(r"\baccident\b.*\b(ho gaya|hua|ho gayi|lag gayi)\b", re.I),
    re.compile(r"\b(takkar|crash)\b.*\b(lagi|ho gaya|ho gayi|hua)\b", re.I),
    re.compile(r"\b(gir|gira|giri)\b.*\b(gaya|gayi|please|help|madad)\b", re.I),
    re.compile(r"\b(chot|dard|injury)\b.*\b(bahut|serious|zyada|kafi)\b", re.I),
    re.compile(r"\b(nearest|nazdik|paas|paas mein)\b.*\b(hospital|clinic|doctor)\b", re.I),
]


# ══════════════════════════════════════════════════════════════════════════════
# Public API
# ══════════════════════════════════════════════════════════════════════════════

def detect_emergency(text: str) -> bool:
    """
    Returns True when the message represents a live / genuine emergency.
    Calls detect_emergency_scored() internally.
    """
    return detect_emergency_scored(text) >= 0.5


def detect_emergency_scored(text: str) -> float:
    """
    Returns a confidence score 0.0–1.0 for emergency likelihood.
      • 0.98 : life-threatening critical keyword
      • 0.95 : primary emergency keyword hit
      • 0.85 : regex pattern match
      • 0.65 : ambiguous keyword + urgency signal (no fine context)
      • 0.35 : ambiguous keyword only
      • 0.05 : ambiguous keyword but clear fine/legal context
      • 0.0  : nothing detected / clearly a legal query
    """
    tl = text.lower()

    # Rule 0 — hard block: 2+ fine/legal signals → definitely not emergency
    fine_hits = sum(1 for sig in _FINE_QUERY_SIGNALS if sig in tl)
    if fine_hits >= 2:
        return 0.0

    # Rule 1 — critical keyword (life-threatening)
    if any(kw in tl for kw in _EMERGENCY_CRITICAL):
        return 0.98

    # Rule 2 — primary emergency keyword
    if any(kw in tl for kw in _EMERGENCY_PRIMARY):
        return 0.95

    # Rule 3 — regex pattern match
    if any(pat.search(tl) for pat in _EMERGENCY_PATTERNS):
        return 0.85

    # Rule 4 — ambiguous keyword logic
    has_ambiguous = any(kw in tl for kw in _EMERGENCY_AMBIGUOUS)
    if not has_ambiguous:
        return 0.0

    if fine_hits >= 1:
        return 0.05   # definitely a fine/legal query

    has_urgency = any(u in tl for u in _URGENCY_EXTRAS)
    return 0.65 if has_urgency else 0.35


def clean_text(text: str) -> str:
    """Basic text normalisation — collapse whitespace, strip edges."""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def format_distance(metres: float) -> str:
    """Human-readable distance string."""
    if metres < 1000:
        return f"{int(metres)} m"
    return f"{round(metres / 1000, 1)} km"
