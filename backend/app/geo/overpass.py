"""
Geo Module — OpenStreetMap Overpass API  (v3 — Crash Mode Edition)
═══════════════════════════════════════════════════════════════════
Upgrades in v3:
  • Trauma-Centre priority: dedicated Overpass tags for trauma / emergency dept
  • Way + relation support (large hospitals are mapped as polygons, not nodes)
  • Richer result dict: address, google_maps_link, estimated_eta_min
  • Extended service-type taxonomy: trauma, fire, tow
  • Expanded cache TTL (120 s) + LRU-style bounded size (512 entries)
  • Adaptive radius: auto-widens to 15 km if nothing found within 5 km
  • Country-aware fallback numbers (India, Nepal, Bangladesh, …)
  • All Overpass queries use `out center` for ways/relations
"""

from __future__ import annotations

import math
import time
import asyncio
from typing import Optional

try:
    import httpx
    _HTTPX_READY = True
except ImportError:
    _HTTPX_READY = False
    import requests  # sync fallback

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ── Overpass query templates ───────────────────────────────────────────────────
# Each template uses `{radius}`, `{lat}`, `{lon}` placeholders.
# We request `out center` so polygon-based hospitals return a centroid lat/lon.

_TRAUMA_QUERY = """
(
  node["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  way["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  relation["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  node["healthcare"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  node["trauma_centre"="yes"](around:{radius},{lat},{lon});
  node["emergency"="trauma_centre"](around:{radius},{lat},{lon});
);
"""

_HOSPITAL_QUERY = """
(
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  relation["amenity"="hospital"](around:{radius},{lat},{lon});
  node["healthcare"="hospital"](around:{radius},{lat},{lon});
  node["amenity"="clinic"](around:{radius},{lat},{lon});
);
"""

_POLICE_QUERY = """
(
  node["amenity"="police"](around:{radius},{lat},{lon});
  way["amenity"="police"](around:{radius},{lat},{lon});
);
"""

_AMBULANCE_QUERY = """
(
  node["emergency"="ambulance_station"](around:{radius},{lat},{lon});
  node["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  way["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
);
"""

_FIRE_QUERY = """
(
  node["amenity"="fire_station"](around:{radius},{lat},{lon});
  way["amenity"="fire_station"](around:{radius},{lat},{lon});
);
"""

_ALL_QUERY = """
(
  node["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  way["amenity"="hospital"]["emergency"="yes"](around:{radius},{lat},{lon});
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  node["amenity"="police"](around:{radius},{lat},{lon});
  node["emergency"="ambulance_station"](around:{radius},{lat},{lon});
);
"""

SERVICE_QUERIES: dict[str, str] = {
    "trauma":    _TRAUMA_QUERY,
    "hospital":  _HOSPITAL_QUERY,
    "police":    _POLICE_QUERY,
    "ambulance": _AMBULANCE_QUERY,
    "fire":      _FIRE_QUERY,
    "all":       _ALL_QUERY,
}

# Service priority order for the "all" response (lower number = shown first)
_TYPE_PRIORITY: dict[str, int] = {
    "trauma":           0,   # trauma centre / emergency dept — always first
    "hospital":         1,
    "ambulance_station":2,
    "police":           3,
    "fire_station":     4,
    "clinic":           5,
}

# ── In-memory LRU-bounded cache ────────────────────────────────────────────────
_CACHE: dict = {}
_CACHE_TTL  = 120   # seconds
_CACHE_MAX  = 512   # max entries (evict oldest on overflow)


def _cache_key(lat: float, lon: float, service_type: str) -> tuple:
    """Round to 3 dp (~110 m grid) for cache bucketing."""
    return (round(lat, 3), round(lon, 3), service_type)


def _cache_get(key: tuple) -> Optional[list]:
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: tuple, results: list) -> None:
    if len(_CACHE) >= _CACHE_MAX:
        # Evict oldest entry
        oldest = min(_CACHE, key=lambda k: _CACHE[k][0])
        del _CACHE[oldest]
    _CACHE[key] = (time.time(), results)


# ── Geo helpers ────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in metres between two WGS-84 coordinates."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _eta_minutes(distance_m: float, service_type: str) -> int:
    """
    Rough ETA estimate.
    Ambulance ~40 km/h in city traffic; police patrol ~50 km/h.
    Returns ceiling minutes (never 0).
    """
    speed_kmh = 50.0 if service_type == "police" else 40.0
    hours = (distance_m / 1000) / speed_kmh
    return max(1, math.ceil(hours * 60))


def _google_maps_link(dest_lat: float, dest_lon: float,
                      origin_lat: float, origin_lon: float) -> str:
    """Deep link that opens Google Maps directions from origin to destination."""
    return (
        f"https://www.google.com/maps/dir/{origin_lat},{origin_lon}/"
        f"{dest_lat},{dest_lon}"
    )


def _is_trauma_centre(tags: dict) -> bool:
    """Heuristic: returns True if OSM tags suggest a trauma / emergency centre."""
    return (
        tags.get("emergency") in ("yes", "trauma_centre")
        or tags.get("trauma_centre") == "yes"
        or "trauma" in tags.get("name", "").lower()
        or "emergency" in tags.get("name", "").lower()
    )


def _service_type_from_tags(tags: dict, fallback: str) -> str:
    """Derive a clean service-type string from OSM tags."""
    if _is_trauma_centre(tags):
        return "trauma"
    amenity = tags.get("amenity", "")
    if amenity == "hospital":
        return "hospital"
    if amenity == "police":
        return "police"
    if amenity == "fire_station":
        return "fire_station"
    if amenity == "clinic":
        return "clinic"
    if tags.get("emergency") == "ambulance_station":
        return "ambulance_station"
    return fallback


def _build_address(tags: dict) -> str:
    """Assemble a human-readable address from OSM addr:* tags."""
    parts = []
    for key in ("addr:housenumber", "addr:street", "addr:suburb",
                 "addr:city", "addr:state"):
        val = tags.get(key, "").strip()
        if val:
            parts.append(val)
    return ", ".join(parts) if parts else ""


def _parse_element(el: dict, origin_lat: float, origin_lon: float,
                   fallback_type: str) -> Optional[dict]:
    """
    Convert a raw Overpass element (node / way / relation) into a
    normalised service dict.  Returns None for elements with no coordinates.
    """
    tags = el.get("tags", {})

    # Nodes have lat/lon directly; ways/relations have a 'center' block
    if el.get("type") == "node":
        el_lat, el_lon = el.get("lat"), el.get("lon")
    else:
        center = el.get("center", {})
        el_lat = center.get("lat")
        el_lon = center.get("lon")

    if el_lat is None or el_lon is None:
        return None

    dist  = _haversine(origin_lat, origin_lon, el_lat, el_lon)
    stype = _service_type_from_tags(tags, fallback_type)

    phone = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("phone_1")
        or ""
    )
    # Clean phone: strip leading/trailing spaces
    phone = phone.strip()

    return {
        "name":         tags.get("name", "Unnamed Facility"),
        "type":         stype,
        "lat":          el_lat,
        "lon":          el_lon,
        "distance_m":   round(dist, 1),
        "address":      _build_address(tags),
        "phone":        phone,
        "is_trauma":    _is_trauma_centre(tags),
        "eta_min":      _eta_minutes(dist, stype),
        "maps_link":    _google_maps_link(el_lat, el_lon, origin_lat, origin_lon),
        "priority":     _TYPE_PRIORITY.get(stype, 9),
    }


# ── Core query ─────────────────────────────────────────────────────────────────

async def _run_overpass_query(query: str) -> list:
    """Execute an Overpass QL query and return raw element list."""
    if _HTTPX_READY:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            return resp.json().get("elements", [])
    else:
        # Sync fallback — run in thread-pool so we don't block the event loop
        def _sync():
            r = requests.post(OVERPASS_URL, data={"data": query}, timeout=15)
            r.raise_for_status()
            return r.json().get("elements", [])
        return await asyncio.get_event_loop().run_in_executor(None, _sync)


async def get_nearest_services(
    lat: float,
    lon: float,
    service_type: str = "all",
    radius_m: int = 5_000,
    max_results: int = 5,
) -> list:
    """
    Async — query Overpass API and return a sorted list of nearby services.

    Priority order within results:
      Trauma Centre → Hospital → Ambulance Station → Police → Fire → Clinic

    If nothing is found within `radius_m`, automatically retries at 15 km.
    Results are cached per (lat_bucket, lon_bucket, type) for _CACHE_TTL s.

    Returns [] on failure (caller should use fallback_services()).
    """
    key = _cache_key(lat, lon, service_type)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    template = SERVICE_QUERIES.get(service_type, SERVICE_QUERIES["all"])

    # For "all" mode, also run a dedicated trauma query and merge
    radii_to_try = [radius_m, 15_000]

    results: list[dict] = []

    for radius in radii_to_try:
        query = (
            "[out:json][timeout:15];\n"
            + template.format(radius=radius, lat=lat, lon=lon)
            + "\nout center body;"
        )
        try:
            elements = await _run_overpass_query(query)
        except Exception as e:
            print(f"[Overpass] query error (radius={radius}): {e}")
            break  # don't retry; use fallback

        for el in elements:
            parsed = _parse_element(el, lat, lon, service_type)
            if parsed:
                results.append(parsed)

        if results:
            break  # found something — no need to widen radius

    if not results:
        return []   # caller uses _fallback_services()

    # De-duplicate by (lat, lon) keeping the richest entry
    seen: dict[tuple, dict] = {}
    for r in results:
        key2 = (round(r["lat"], 4), round(r["lon"], 4))
        if key2 not in seen or r["priority"] < seen[key2]["priority"]:
            seen[key2] = r

    deduped = list(seen.values())

    # Sort: primary key = priority tier, secondary = distance
    deduped.sort(key=lambda x: (x["priority"], x["distance_m"]))
    top = deduped[:max_results]

    _cache_set(_cache_key(lat, lon, service_type), top)
    return top


# ── Country-aware fallbacks ────────────────────────────────────────────────────

# (country code or name → {service: number})
_COUNTRY_NUMBERS: dict[str, dict[str, str]] = {
    "india":       {"emergency": "112", "ambulance": "108", "police": "100", "fire": "101"},
    "in":          {"emergency": "112", "ambulance": "108", "police": "100", "fire": "101"},
    "nepal":       {"emergency": "100", "ambulance": "102", "police": "100", "fire": "101"},
    "np":          {"emergency": "100", "ambulance": "102", "police": "100", "fire": "101"},
    "bangladesh":  {"emergency": "999", "ambulance": "199", "police": "999", "fire": "199"},
    "bd":          {"emergency": "999", "ambulance": "199", "police": "999", "fire": "199"},
    "pakistan":    {"emergency": "1122","ambulance": "1122","police": "15",  "fire": "16"},
    "pk":          {"emergency": "1122","ambulance": "1122","police": "15",  "fire": "16"},
    "sri lanka":   {"emergency": "119", "ambulance": "110", "police": "119", "fire": "111"},
    "lk":          {"emergency": "119", "ambulance": "110", "police": "119", "fire": "111"},
    "usa":         {"emergency": "911", "ambulance": "911", "police": "911", "fire": "911"},
    "us":          {"emergency": "911", "ambulance": "911", "police": "911", "fire": "911"},
    "uk":          {"emergency": "999", "ambulance": "999", "police": "999", "fire": "999"},
    "gb":          {"emergency": "999", "ambulance": "999", "police": "999", "fire": "999"},
    "australia":   {"emergency": "000", "ambulance": "000", "police": "000", "fire": "000"},
    "au":          {"emergency": "000", "ambulance": "000", "police": "000", "fire": "000"},
    # BIMSTEC additions
    "thailand":    {"emergency": "191", "ambulance": "1669","police": "191", "fire": "199"},
    "th":          {"emergency": "191", "ambulance": "1669","police": "191", "fire": "199"},
    "myanmar":     {"emergency": "999", "ambulance": "192", "police": "199", "fire": "191"},
    "mm":          {"emergency": "999", "ambulance": "192", "police": "199", "fire": "191"},
    "bhutan":      {"emergency": "112", "ambulance": "112", "police": "113", "fire": "110"},
    "bt":          {"emergency": "112", "ambulance": "112", "police": "113", "fire": "110"},
}

_DEFAULT_NUMBERS = {"emergency": "112", "ambulance": "108", "police": "100", "fire": "101"}


def get_country_numbers(country: str) -> dict[str, str]:
    """Return emergency phone numbers for the given country (case-insensitive)."""
    return _COUNTRY_NUMBERS.get(country.lower().strip(), _DEFAULT_NUMBERS)


def fallback_services(country: str = "India") -> list:
    """
    Returns hardcoded national emergency numbers when the Overpass API fails.
    Used as the last-resort response in handle_roadsos.
    """
    nums = get_country_numbers(country)
    return [
        {
            "name": f"National Emergency ({country})",
            "type": "emergency",
            "lat": 0, "lon": 0,
            "distance_m": 0,
            "address": "",
            "phone": nums["emergency"],
            "is_trauma": False,
            "eta_min": 0,
            "maps_link": "",
            "priority": 0,
        },
        {
            "name": "Ambulance",
            "type": "ambulance_station",
            "lat": 0, "lon": 0,
            "distance_m": 0,
            "address": "",
            "phone": nums["ambulance"],
            "is_trauma": False,
            "eta_min": 0,
            "maps_link": "",
            "priority": 2,
        },
        {
            "name": "Police",
            "type": "police",
            "lat": 0, "lon": 0,
            "distance_m": 0,
            "address": "",
            "phone": nums["police"],
            "is_trauma": False,
            "eta_min": 0,
            "maps_link": "",
            "priority": 3,
        },
    ]
