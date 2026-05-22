"""
RoadSoS Service  (v6 — Smart Crash Mode Edition)
══════════════════════════════════════════════════════════════════════════════
Upgrades in v6:
  • Richer severity detection — CRITICAL / SERIOUS / MILD with Hinglish keywords
  • Rich Markdown crash response:
      - Severity banner + colour-coded urgency header
      - Nearest Trauma Centre → Hospital → Ambulance Station → Police
      - Distance, ETA, phone number, Google Maps deep link per service
      - Bold "Call 112 / 108 NOW" always visible at top
      - Country-aware fallback numbers
  • No-location flow:
      - Extracts city name from message via NER shim
      - Nominatim geocoding fallback (rate-limited)
      - Prompts for GPS / city if nothing found
  • Authority dispatch badge (v4 notifier integration retained)
  • All Overpass queries use trauma-first priority (v3 geo module)
"""

from __future__ import annotations

import asyncio
from typing import Optional

from app.geo.overpass import get_nearest_services, get_country_numbers
from app.models.bilstm import extract_entities
from app.services.notifier import dispatch_emergency


# ══════════════════════════════════════════════════════════════════════════════
# 1.  SEVERITY DETECTION
# ══════════════════════════════════════════════════════════════════════════════

_CRITICAL_KEYWORDS = [
    "unconscious", "not breathing", "no pulse", "cardiac arrest",
    "heart attack", "severe bleeding", "blood everywhere", "critical",
    "not responding", "coma", "paralysed", "paralyzed",
    # Hinglish
    "hosh nahi", "saans nahi", "bahut khoon", "pulse nahi",
    "hil nahi raha", "chal nahi raha", "mar gaya", "mar raha",
    "aankhein band", "dil ka daura", "uth nahi raha",
    "bol nahi raha", "jaan ja rahi", "last saans",
    # Devanagari
    "बेहोश", "सांस नहीं", "नब्ज़ नहीं",
]
_SERIOUS_KEYWORDS = [
    "bleeding", "broken bone", "fracture", "injured badly", "head injury",
    "spine", "chest pain", "multiple injured", "trapped", "can't move", "fire",
    # Hinglish
    "haddi toot", "khoon aa raha", "sar pe chot", "aag lag gayi",
    "phansa hua", "bahut dard", "zyada chot", "serious hai",
    "chot lagi", "ghav hai", "sir pe lagi", "naak se khoon",
    # Devanagari
    "खून", "आग", "फंसा", "दर्द",
]
_MILD_KEYWORDS = [
    "minor accident", "fender bender", "scratch", "small crash",
    "slight injury", "bumped", "tyre flat",
    # Hinglish
    "halki chot", "chhoti takkar", "scratch aaya", "tyre puncture",
    "thodi si chot", "chhota accident", "no injury", "koi chot nahi",
]


def detect_severity(text: str) -> str:
    """Returns 'CRITICAL', 'SERIOUS', or 'MILD'. Defaults to 'SERIOUS'."""
    tl = text.lower()
    if any(kw in tl for kw in _CRITICAL_KEYWORDS):
        return "CRITICAL"
    if any(kw in tl for kw in _SERIOUS_KEYWORDS):
        return "SERIOUS"
    if any(kw in tl for kw in _MILD_KEYWORDS):
        return "MILD"
    return "SERIOUS"


def _severity_banner(severity: str) -> str:
    return {
        "CRITICAL": "🔴 CRITICAL EMERGENCY",
        "SERIOUS":  "🟠 SERIOUS EMERGENCY",
        "MILD":     "🟡 MINOR INCIDENT",
    }.get(severity, "🟠 EMERGENCY")


def _severity_color_bar(severity: str) -> str:
    """Top-of-response colour bar with call-to-action."""
    bars = {
        "CRITICAL": (
            "---\n"
            "> ### 🆘 LIFE-THREATENING — CALL **112 + 108** RIGHT NOW\n"
            "> Keep person still. Do NOT give food/water. Stay on the call.\n"
            "---"
        ),
        "SERIOUS": (
            "---\n"
            "> ### ⚠️ Serious Injury — Call **108** (Ambulance) immediately\n"
            "> Apply firm pressure on wounds. Do not move the person.\n"
            "---"
        ),
        "MILD": (
            "---\n"
            "> ### ℹ️ Minor Incident — Call **112** if anyone feels pain\n"
            "> Document the scene. Exchange details with other driver.\n"
            "---"
        ),
    }
    return bars.get(severity, bars["SERIOUS"])


# ══════════════════════════════════════════════════════════════════════════════
# 2.  SERVICE-TYPE DETECTION
# ══════════════════════════════════════════════════════════════════════════════

def _detect_service_type(message: str) -> str:
    tl = message.lower()
    if any(w in tl for w in ["fire", "burning", "aag", "jal raha"]):
        return "fire"
    if any(w in tl for w in ["police", "thana", "fir", "crime", "gunda"]):
        return "police"
    if any(w in tl for w in ["ambulance", "stretcher", "paramedic", "108"]):
        return "ambulance"
    if any(w in tl for w in ["hospital", "doctor", "injured", "hurt", "chot"]):
        return "hospital"
    return "all"


# ══════════════════════════════════════════════════════════════════════════════
# 3.  NOMINATIM GEOCODING
# ══════════════════════════════════════════════════════════════════════════════

_NOMINATIM_SEM = asyncio.Semaphore(1)
_GEOCODE_CACHE: dict[str, Optional[tuple[float, float]]] = {}


async def _geocode_city(city: str) -> Optional[tuple[float, float]]:
    """City name → (lat, lon) via Nominatim. Rate-limited 1 req/s."""
    key = city.strip().lower()
    if key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[key]
    try:
        import httpx
        async with _NOMINATIM_SEM:
            async with httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": city, "format": "json", "limit": 1},
                    headers={"User-Agent": "RoadSafetyAI-IITMadras/6.0"},
                )
                resp.raise_for_status()
                data = resp.json()
            await asyncio.sleep(1.1)
        result = (float(data[0]["lat"]), float(data[0]["lon"])) if data else None
        _GEOCODE_CACHE[key] = result
        return result
    except Exception as e:
        print(f"[Nominatim] error for '{city}': {e}")
        _GEOCODE_CACHE[city.strip().lower()] = None
        return None


# ══════════════════════════════════════════════════════════════════════════════
# 4.  RESPONSE FORMATTERS
# ══════════════════════════════════════════════════════════════════════════════

def _fmt_dist(m: float) -> str:
    return f"{int(m)} m" if m < 1000 else f"{m/1000:.1f} km"


def _type_label(stype: str) -> str:
    return {
        "trauma":            "🏥 TRAUMA CENTRE",
        "hospital":          "🏥 Hospital",
        "ambulance_station": "🚑 Ambulance Station",
        "police":            "👮 Police Station",
        "fire_station":      "🚒 Fire Station",
        "clinic":            "🏥 Clinic",
    }.get(stype, stype.upper())


def _service_card(svc: dict, idx: int, fallback_phone: str) -> str:
    """Format a single service as a rich Markdown card."""
    phone = svc.get("phone", "").strip() or fallback_phone
    lines = [f"**{idx}. {_type_label(svc['type'])} — {svc['name']}**"]
    lines.append(f"   📍 {_fmt_dist(svc['distance_m'])} away  |  ⏱ ~{svc.get('eta_min', '?')} min")
    if svc.get("address"):
        lines.append(f"   🗺 {svc['address']}")
    lines.append(f"   📞 **{phone}**")
    if svc.get("maps_link"):
        lines.append(f"   🔗 [Open in Google Maps]({svc['maps_link']})")
    return "\n".join(lines)


def _dispatch_badge(dispatch: dict) -> str:
    """Confirmation block shown at the bottom of every crash-mode response."""
    n   = dispatch.get("notified", 0)
    iid = dispatch.get("incident_id", "—")
    addr = dispatch.get("address", "")

    if n > 0:
        addr_line = f"**Location sent:** {addr}  \n" if addr and addr != "Unknown" else ""
        return (
            "\n---\n"
            "### ✅ Authorities Have Been Notified\n"
            f"**Incident ID:** `{iid}`  \n"
            f"{addr_line}"
            f"**Channels reached:** {n} (SMS / WhatsApp / Email / Webhook)  \n"
            "Emergency services have been alerted with your location and incident details.  \n"
            f"📌 Show this ID to arriving responders: **`{iid}`**"
        )
    else:
        return (
            "\n---\n"
            "### ⚠️ Auto-Dispatch Not Configured\n"
            f"**Incident ID:** `{iid}`  \n"
            "Notification channels are not set up in this deployment.  \n"
            "**Please call 112 / 108 directly — they respond 24×7.**"
        )


def _full_response(
    services: list[dict], severity: str, nums: dict, dispatch: dict
) -> str:
    emg = nums.get("emergency", "112")
    amb = nums.get("ambulance", "108")
    pol = nums.get("police", "100")

    lines = [
        f"## 🚨 {_severity_banner(severity)}",
        "",
        _severity_color_bar(severity),
        "",
        # Always-visible emergency hotline bar
        f"📞 **Emergency: {emg}** &nbsp;|&nbsp; 🚑 **Ambulance: {amb}** &nbsp;|&nbsp; 👮 **Police: {pol}**",
        "",
        "---",
        "",
        "### 🗺 Nearest Emergency Services",
        "",
    ]

    for i, svc in enumerate(services, 1):
        lines.append(_service_card(svc, i, emg))
        lines.append("")

    lines += [
        "---",
        "",
        "**While waiting for help:**  \n"
        "✅ Keep the injured person calm and still  \n"
        "✅ Apply firm pressure on bleeding wounds  \n"
        "✅ Do not give food or water  \n"
        "✅ Turn unconscious person to recovery position if breathing  \n"
        f"✅ Stay on line with **{emg}** — operators will guide you",
        "",
        _dispatch_badge(dispatch),
    ]
    return "\n".join(lines)


def _fallback_response(severity: str, nums: dict, dispatch: dict) -> str:
    emg = nums.get("emergency", "112")
    amb = nums.get("ambulance", "108")
    pol = nums.get("police", "100")

    return (
        f"## 🚨 {_severity_banner(severity)}\n\n"
        f"{_severity_color_bar(severity)}\n\n"
        "⚠️ No nearby services found via map data — please use national numbers:\n\n"
        f"- 🆘 **Emergency: {emg}** *(dial anytime, free)*\n"
        f"- 🚑 **Ambulance: {amb}**\n"
        f"- 👮 **Police:    {pol}**\n\n"
        "---\n\n"
        "**While waiting:**  \n"
        "✅ Stay with the injured  \n"
        "✅ Apply pressure on wounds  \n"
        "✅ Do not move spinal injuries\n\n"
        + _dispatch_badge(dispatch)
    )


def _no_location_response(severity: str, nums: dict, dispatch: dict,
                           city: str = "", geocode_failed: bool = False) -> str:
    emg = nums.get("emergency", "112")
    amb = nums.get("ambulance", "108")

    header = (
        f"## 🚨 {_severity_banner(severity)}\n\n"
        f"📞 **Call {emg} or {amb} NOW!**\n\n"
    )

    if geocode_failed and city:
        body = (
            f"📍 Found **{city}** in your message but couldn't pinpoint exact coordinates.\n\n"
            "Please share your **GPS location** or type a nearby landmark.\n\n"
        )
    else:
        body = (
            "📍 I need your location to find the nearest help.\n\n"
            "- **Share GPS** using the 📎 button in the chat, OR\n"
            "- **Type your city / area** (e.g. *'near Indore railway station'*)\n\n"
            "> ⚡ Calling **112** does NOT need GPS — operators locate you automatically.\n\n"
        )

    return header + body + _dispatch_badge(dispatch)


# ══════════════════════════════════════════════════════════════════════════════
# 5.  MAIN HANDLER
# ══════════════════════════════════════════════════════════════════════════════

async def handle_roadsos(
    message: str,
    lat:     Optional[float] = None,
    lon:     Optional[float] = None,
    country: str             = "India",
    # v11 hints from entity_extractor
    severity_hint:      Optional[str] = None,
    service_type_hint:  Optional[str] = None,
) -> str:
    """
    Primary RoadSoS Crash Mode handler (v6 + v11 hint integration).

    Steps:
      1. Detect severity (CRITICAL / SERIOUS / MILD)
         v11: uses pre-extracted severity_hint when available
      2. Resolve coordinates:
           GPS present → use directly
           GPS absent  → NER city extraction → Nominatim geocoding
           No city     → prompt user for location
      3. Fetch nearby services from Overpass:
           Trauma Centre (priority 0) → Hospital → Ambulance → Police → Fire
           Auto-widens radius from 5 km to 15 km if nothing found
      4. Dispatch alert to authorities (SMS/WA/Email/Webhook)
      5. Return rich Markdown response with:
           - Severity banner + first-aid advice
           - Emergency hotline bar (always visible)
           - Per-service cards (distance, ETA, phone, Maps link)
           - Authority dispatch badge (incident_id)
    """
    # v11: prefer pre-extracted severity; fall back to message detection
    severity = severity_hint or detect_severity(message)
    nums     = get_country_numbers(country)
    # v11: prefer pre-extracted service type
    svc_type = service_type_hint or _detect_service_type(message)
    city     = "Unknown"

    # ── Step 2: coordinate resolution ─────────────────────────────────────────
    if lat is None or lon is None:
        entities = extract_entities(message)
        city = (
            entities.get("location") or entities.get("city")
            or entities.get("place") or ""
        )

        if city:
            coords = await _geocode_city(city)
            if coords:
                lat, lon = coords
            else:
                dispatch = await dispatch_emergency(
                    message=message, severity=severity,
                    lat=None, lon=None,
                    city=city, country=country, nearest_services=[],
                )
                return _no_location_response(
                    severity, nums, dispatch, city=city, geocode_failed=True
                )
        else:
            dispatch = await dispatch_emergency(
                message=message, severity=severity,
                lat=None, lon=None,
                city="Unknown", country=country, nearest_services=[],
            )
            return _no_location_response(severity, nums, dispatch)

    # ── Step 3: fetch services ─────────────────────────────────────────────────
    services: list[dict] = []
    try:
        if svc_type in ("all", "hospital"):
            # Parallel query: trauma (wider radius) + general services
            trauma_r, all_r = await asyncio.gather(
                get_nearest_services(lat, lon, "trauma", radius_m=10_000, max_results=3),
                get_nearest_services(lat, lon, "all",    radius_m=5_000,  max_results=8),
            )
            seen: dict[tuple, dict] = {}
            for s in (all_r + trauma_r):
                k = (round(s["lat"], 4), round(s["lon"], 4))
                if k not in seen or s["priority"] < seen[k]["priority"]:
                    seen[k] = s
            services = sorted(
                seen.values(), key=lambda x: (x["priority"], x["distance_m"])
            )[:5]
        else:
            services = await get_nearest_services(lat, lon, svc_type, max_results=5)
    except Exception as e:
        print(f"[RoadSoS] Overpass error: {e}")

    # ── Step 4: dispatch to authorities ───────────────────────────────────────
    dispatch = await dispatch_emergency(
        message=message, severity=severity,
        lat=lat, lon=lon,
        city=city, country=country,
        nearest_services=services,
    )

    # ── Step 5: format response ────────────────────────────────────────────────
    if services:
        return _full_response(services, severity, nums, dispatch)
    return _fallback_response(severity, nums, dispatch)
