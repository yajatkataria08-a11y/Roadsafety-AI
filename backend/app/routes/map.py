"""
/map — Unified Map Data API  (v1)
══════════════════════════════════════════════════════════════════
Endpoints:
  GET /map/services  — RoadSoS: emergency services via Overpass
  GET /map/issues    — RoadWatch: heatmap data from DB
  GET /map/hotspots  — DriveLegal: black spots, cameras, violation zones

All endpoints return GeoJSON-compatible arrays for Leaflet consumption.
"""

import math
import uuid
import random
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Query

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _eta_minutes(dist_km: float, type_: str = "ambulance") -> int:
    """Estimate ETA in minutes based on service type and distance."""
    speeds = {
        "hospital": 30, "ambulance": 50, "police": 45,
        "towing": 35, "puncture_shop": 25, "fuel": 20,
    }
    kmh = speeds.get(type_, 35)
    hour = datetime.now().hour
    factor = 0.65 if (7 <= hour < 10 or 17 <= hour < 20) else 1.25 if (hour >= 22 or hour < 5) else 1.0
    return max(1, round((dist_km / (kmh * factor)) * 60))


# ── /map/services ──────────────────────────────────────────────────────────────

@router.get("/services")
async def get_map_services(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    type: str = Query("all"),
    radius: int = Query(5000, ge=500, le=25000),
):
    """
    Returns emergency services near a coordinate.
    Uses Overpass (real OSM data) with fallback to static Indore dataset.
    """
    try:
        from app.geo.overpass import get_nearest_services
        raw = await get_nearest_services(lat, lon, service_type="all", radius_m=radius, max_results=30)
        results = []
        for r in raw:
            # Map overpass types → frontend ServiceType
            fe_type = {
                "hospital": "hospital", "trauma": "hospital", "clinic": "hospital",
                "ambulance_station": "ambulance",
                "police": "police",
                "fire_station": "police",   # close enough for emergency purposes
            }.get(r.get("type", ""), "hospital")
            if type != "all" and fe_type != type:
                continue
            results.append({
                "id":          f"osm-{r['lat']:.4f}-{r['lon']:.4f}",
                "name":        r["name"],
                "type":        fe_type,
                "lat":         r["lat"],
                "lon":         r["lon"],
                "distance_m":  r["distance_m"],
                "phone":       r.get("phone", ""),
                "address":     r.get("address", ""),
                "eta_min":     r.get("eta_min") or _eta_minutes(r["distance_m"] / 1000, fe_type),
                "maps_url":    r.get("maps_link") or f"https://www.google.com/maps/dir/?api=1&destination={r['lat']},{r['lon']}",
            })
        source = "overpass"
    except Exception as e:
        print(f"Overpass failed: {e}, using fallback")
        results = _fallback_services(lat, lon)
        if type != "all":
            results = [r for r in results if r.get("type") == type]
        source = "fallback"

    # Enrich fallback results that don't yet have eta_min / maps_url
    for svc in results:
        if "eta_min" not in svc:
            dist_km = svc.get("distance_m", 0) / 1000
            svc["eta_min"] = _eta_minutes(dist_km, svc.get("type", "hospital"))
        if "maps_url" not in svc:
            svc["maps_url"] = f"https://www.google.com/maps/dir/?api=1&destination={svc['lat']},{svc['lon']}"
        if "id" not in svc:
            svc["id"] = f"fb-{svc['lat']:.4f}-{svc['lon']:.4f}"

    # Sort by distance
    results.sort(key=lambda x: x.get("distance_m", 999999))

    return {"services": results[:30], "source": source, "count": len(results)}


def _fallback_services(lat: float, lon: float) -> list:
    """Static Indore emergency services for offline/fallback."""
    raw = [
        {"name": "MY Hospital (Govt)",        "type": "hospital",      "lat": 22.7196, "lon": 75.8685, "phone": "0731-2527272"},
        {"name": "Choithram Hospital",         "type": "hospital",      "lat": 22.7409, "lon": 75.8879, "phone": "0731-4200100"},
        {"name": "Bombay Hospital",            "type": "hospital",      "lat": 22.7264, "lon": 75.8815, "phone": "0731-4066000"},
        {"name": "Apollo Hospital",            "type": "hospital",      "lat": 22.7051, "lon": 75.8777, "phone": "0731-4299999"},
        {"name": "JAMS (Trauma Centre)",       "type": "hospital",      "lat": 22.7120, "lon": 75.8650, "phone": "108"},
        {"name": "Vijay Nagar Police",         "type": "police",        "lat": 22.7479, "lon": 75.8987, "phone": "100"},
        {"name": "Palasia Police Station",     "type": "police",        "lat": 22.7254, "lon": 75.8760, "phone": "0731-2525100"},
        {"name": "MIG Police Station",         "type": "police",        "lat": 22.7360, "lon": 75.8850, "phone": "0731-2556433"},
        {"name": "108 Ambulance Base",         "type": "ambulance",     "lat": 22.7196, "lon": 75.8577, "phone": "108"},
        {"name": "CATS Ambulance Depot",       "type": "ambulance",     "lat": 22.7300, "lon": 75.8700, "phone": "102"},
        {"name": "Singh Towing Service",       "type": "towing",        "lat": 22.7150, "lon": 75.8520, "phone": "9826012345"},
        {"name": "24x7 Road Rescue Towing",    "type": "towing",        "lat": 22.7550, "lon": 75.9100, "phone": "7415023456"},
        {"name": "Sharma Tyre Works",          "type": "puncture_shop", "lat": 22.7220, "lon": 75.8600, "phone": "9893045678"},
        {"name": "Quick Fix Tyres",            "type": "puncture_shop", "lat": 22.7380, "lon": 75.8780, "phone": "9977056789"},
        {"name": "BPCL Fuel Station",          "type": "fuel",          "lat": 22.7100, "lon": 75.8640, "phone": ""},
        {"name": "HPCL Pump Vijay Nagar",      "type": "fuel",          "lat": 22.7500, "lon": 75.8960, "phone": ""},
        {"name": "Indian Oil Rau Road",        "type": "fuel",          "lat": 22.6950, "lon": 75.8450, "phone": ""},
    ]
    for svc in raw:
        dist_m = _haversine_km(lat, lon, svc["lat"], svc["lon"]) * 1000
        svc["distance_m"] = round(dist_m)
        svc["id"] = f"fallback-{uuid.uuid4().hex[:8]}"
    return raw


# ── /map/issues ────────────────────────────────────────────────────────────────

@router.get("/issues")
async def get_map_issues(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius: int = Query(10000, ge=500, le=50000),
    category: str = Query("all"),
    status: str = Query("all"),
):
    """
    Returns RoadWatch issues from DB + mock hotspot data for heatmap.
    Real issues come from the road_issues table; augmented with demo data for hackathon.
    """
    issues = []

    # 1. Real issues from DB
    try:
        from app.utils.db import SessionLocal, RoadIssue
        db = SessionLocal()
        try:
            rows = db.query(RoadIssue).filter(
                RoadIssue.lat.isnot(None),
                RoadIssue.lon.isnot(None),
            ).order_by(RoadIssue.timestamp.desc()).limit(200).all()

            for row in rows:
                dist_km = _haversine_km(lat, lon, row.lat, row.lon)
                if dist_km * 1000 > radius:
                    continue
                if category != "all" and row.category and category.lower() not in row.category.lower():
                    continue
                if status != "all" and row.status != status:
                    continue

                issues.append({
                    "id": row.ticket_id,
                    "type": _map_category(row.category or ""),
                    "category": row.category or "General Road Issue",
                    "lat": row.lat,
                    "lon": row.lon,
                    "status": _normalise_status(row.status or "logged"),
                    "description": row.description[:120] if row.description else "",
                    "authority": row.authority or "",
                    "authority_contact": row.authority_contact or "",
                    "has_image": row.has_image,
                    "timestamp": row.timestamp.isoformat() if row.timestamp else "",
                    "distance_m": round(dist_km * 1000),
                    "source": "real",
                })
        finally:
            db.close()
    except Exception as e:
        print(f"DB query failed: {e}")

    # 2. Augment with synthetic demo data for visual richness
    demo = _demo_issues(lat, lon, radius)
    if category != "all":
        demo = [d for d in demo if d["type"] == category]
    if status != "all":
        demo = [d for d in demo if d["status"] == status]

    issues = issues + demo
    issues.sort(key=lambda x: x.get("distance_m", 999999))

    # Build heatmap weights
    heatmap = [
        {"lat": i["lat"], "lon": i["lon"], "weight": _severity_weight(i)}
        for i in issues
    ]

    return {
        "issues": issues[:100],
        "heatmap": heatmap,
        "count": len(issues),
        "counts_by_type": _count_by_type(issues),
        "counts_by_status": _count_by_status(issues),
    }


def _map_category(category: str) -> str:
    cat = category.lower()
    if "pothole" in cat: return "pothole"
    if "damage" in cat or "surface" in cat: return "road_damage"
    if "light" in cat or "lighting" in cat: return "bad_lighting"
    if "signal" in cat or "traffic" in cat: return "broken_signal"
    if "construction" in cat or "encroachment" in cat: return "construction"
    if "drainage" in cat or "flood" in cat: return "flooding"
    if "sign" in cat: return "missing_sign"
    return "other"


def _normalise_status(status: str) -> str:
    mapping = {
        "logged": "pending",
        "submitted": "pending",
        "acknowledged": "in_progress",
        "in_progress": "in_progress",
        "resolved": "resolved",
        "rejected": "rejected",
    }
    return mapping.get(status, "pending")


def _severity_weight(issue: dict) -> float:
    weights = {
        "pothole": 0.8, "road_damage": 0.7, "flooding": 0.9,
        "broken_signal": 0.6, "bad_lighting": 0.5, "construction": 0.4,
        "missing_sign": 0.3, "other": 0.2,
    }
    base = weights.get(issue.get("type", "other"), 0.3)
    if issue.get("status") == "pending": base *= 1.2
    return min(1.0, base)


def _count_by_type(issues: list) -> dict:
    counts = {}
    for i in issues:
        t = i.get("type", "other")
        counts[t] = counts.get(t, 0) + 1
    return counts


def _count_by_status(issues: list) -> dict:
    counts = {}
    for i in issues:
        s = i.get("status", "pending")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _demo_issues(lat: float, lon: float, radius: int) -> list:
    """
    Generate plausible demo issues clustered near known Indore hotspots.
    Used when the DB is empty so the hackathon demo looks populated.
    Now includes contractor, budget, severity, BIMSTEC context fields.
    """
    HOTSPOTS = [
        (22.7196, 75.8577, "pothole",       "critical", "🕳️ Deep pothole near Vijay Nagar square",
         "M/s Sharma Construction", 4_20_00_000, 3_10_00_000, "2024-08-15", "NH52 Ring Road Segment",
         "Pothole density in Indore averages 8/km during monsoon season."),
        (22.7350, 75.8820, "bad_lighting",  "medium",   "💡 Streetlight out on MG Road",
         "Roop Telecom & Electrical", 85_00_000, 62_00_000, "2024-06-10", "MG Road Urban Stretch",
         "Poorly lit roads account for 31% of night fatalities in BIMSTEC region."),
        (22.7100, 75.8650, "pothole",       "high",     "🕳️ Multiple craters on AB Road",
         "Dilip Buildcon Ltd.", 12_50_00_000, 11_80_00_000, "2024-11-01", "AB Road Vijay Nagar",
         "Post-monsoon pothole repair backlog affects 40% of city roads."),
        (22.7420, 75.8950, "construction",  "medium",   "🏗️ Drainage work blocking 2 lanes",
         "M/s Rajesh Infra Works", 2_80_00_000, 1_90_00_000, "2023-12-10", "Sapna Sangeeta Road",
         "Encroachments from unplanned works reduce road width by 30%."),
        (22.7240, 75.8760, "broken_signal", "critical", "🚦 Traffic signal malfunction at peak hours",
         "Siemens Traffic Systems", 3_60_00_000, 3_40_00_000, "2024-09-05", "Palasia Square Junction",
         "Dysfunctional signals cause 23% of urban intersection accidents in South Asia."),
        (22.7500, 75.8700, "flooding",      "high",     "🌊 Waterlogging near Rau bridge",
         "IMC Drainage Division", 1_20_00_000, 70_00_000, "2023-07-20", "Rau Bridge Approach",
         "Monsoon flooding contributes to 18% of Indore road accidents (2023)."),
        (22.7080, 75.8480, "road_damage",   "high",     "⚠️ Collapsed road edge near NH52",
         "NHAI Contract Works", 8_90_00_000, 7_20_00_000, "2024-03-12", "NH52 Pithampur Road",
         "Post-monsoon road damage repair backlog affects 40% of State Highway network."),
        (22.7300, 75.8650, "missing_sign",  "medium",   "🪧 Speed limit sign missing near school zone",
         "Bright Way Signage Pvt.", 45_00_000, 38_00_000, "2024-05-01", "Scheme 54 PU4 Road",
         "Missing road signs are cited in 18% of rural accident reports in South Asia."),
        (22.7460, 75.9000, "pothole",       "high",     "🕳️ Dangerous pothole near Banganga bus stop",
         "M/s Vikram Infrastructure", 2_10_00_000, 1_80_00_000, "2024-07-30", "Banganga Road East",
         "Similar pothole cluster reported in Dhaka Highway NH2 (Bangladesh, 2024)."),
        (22.7150, 75.8900, "bad_lighting",  "high",     "💡 Dark 800m stretch near overpass",
         "Roop Telecom & Electrical", 95_00_000, 55_00_000, "2023-11-15", "Rajwada Overpass Approach",
         "Street lighting deficiency linked to 28% of night-time pedestrian fatalities."),
        (22.7600, 75.8800, "construction",  "low",      "🏗️ Flyover construction — 3-year project",
         "L&T Construction Ltd.", 45_00_00_000, 28_00_00_000, "2024-12-01", "Super Corridor Flyover",
         "Infrastructure projects reduce accident rates by 35% post-completion."),
        (22.7050, 75.8550, "flooding",      "critical", "🌊 Storm drain blocked — flood risk zone",
         "IMC Drainage Division", 1_50_00_000, 60_00_000, "2022-09-10", "Old Palasia Storm Drain",
         "Blocked storm drains cause 12% of urban flash flood accidents regionally."),
        (22.7330, 75.8770, "pothole",       "medium",   "🕳️ Pothole cluster near Racecourse roundabout",
         "M/s Aryan Road Works", 1_80_00_000, 1_50_00_000, "2024-10-20", "Racecourse Road",
         "Pothole-related tyre blowouts account for 9% of Indore accidents."),
        (22.7450, 75.8620, "road_damage",   "high",     "⚠️ Alligator cracking on Ring Road",
         "Dilip Buildcon Ltd.", 9_80_00_000, 8_40_00_000, "2024-08-01", "Ring Road Segment 4",
         "Surface cracking indicates sub-base failure requiring full resurfacing."),
        (22.7200, 75.8700, "broken_signal", "critical", "🚦 Flashing amber — full signal failure",
         "Siemens Traffic Systems", 4_20_00_000, 4_10_00_000, "2024-10-01", "Vijay Nagar Main Cross",
         "Signal failures during peak hour increase accident probability by 3.2x."),
    ]

    statuses = ["pending", "pending", "pending", "in_progress", "resolved"]
    authorities = [
        ("Indore Municipal Corporation – Roads Dept.", "0731-2700000"),
        ("MP Public Works Department", "1800-11-0031"),
        ("NHAI / NH Division", "1033"),
    ]

    severity_to_days = {"critical": 3, "high": 14, "medium": 21, "low": 60}

    now = datetime.utcnow()
    demo = []
    for i, (hlat, hlon, htype, severity, hdesc, contractor,
            sanctioned, spent, last_repair, road_name, bimstec) in enumerate(HOTSPOTS):
        jlat = hlat + random.uniform(-0.002, 0.002)
        jlon = hlon + random.uniform(-0.002, 0.002)
        dist_km = _haversine_km(lat, lon, jlat, jlon)
        if dist_km * 1000 > radius:
            continue
        auth = authorities[i % len(authorities)]
        days_ago = random.randint(0, 14)
        demo.append({
            "id": f"DEMO-{i+1:04d}",
            "type": htype,
            "category": hdesc.split(" ", 1)[1] if " " in hdesc else hdesc,
            "lat": jlat,
            "lon": jlon,
            "status": statuses[i % len(statuses)],
            "description": hdesc,
            "severity": severity,
            "authority": auth[0],
            "authority_contact": auth[1],
            "contractor": contractor,
            "road_name": road_name,
            "sanctioned_inr": sanctioned,
            "spent_inr": spent,
            "last_repair_date": last_repair,
            "estimated_resolution_days": severity_to_days.get(severity, 14),
            "bimstec_context": bimstec,
            "has_image": (i % 3 == 0),
            "timestamp": (now - timedelta(days=days_ago)).isoformat(),
            "distance_m": round(dist_km * 1000),
            "source": "demo",
        })
    return demo


# ── /map/hotspots ──────────────────────────────────────────────────────────────

@router.get("/hotspots")
async def get_map_hotspots(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius: int = Query(15000, ge=1000, le=50000),
):
    """
    DriveLegal: returns black spots, speed/helmet cameras, violation zones.
    Based on known Indore hotspots + national highway data.
    Includes geo-fence radius so frontend can alert when user enters zone.
    """
    black_spots = _get_black_spots(lat, lon, radius)
    cameras = _get_cameras(lat, lon, radius)
    violation_zones = _get_violation_zones(lat, lon, radius)

    # Heatmap for black spots
    heatmap = [
        {"lat": b["lat"], "lon": b["lon"], "weight": b["severity"] / 10.0}
        for b in black_spots
    ]

    return {
        "blackspots": black_spots,
        "cameras": cameras,
        "violation_zones": violation_zones,
        "heatmap": heatmap,
        "alert_radius_m": 300,  # alert when within 300m of camera/zone
    }


def _get_black_spots(lat, lon, radius):
    SPOTS = [
        (22.7264, 75.8477, "Bypass Junction",      8, "High-speed rear-end collisions — avg 3/month"),
        (22.7100, 75.8650, "AB Road NH-52 Overpass",9, "Drunk driving & speeding hot zone"),
        (22.7500, 75.9150, "Nemawar Road Bend",     7, "Sharp curve — 4 fatalities in 2024"),
        (22.6900, 75.8400, "Rau Industrial Stretch",8, "Heavy vehicle + two-wheeler mix"),
        (22.7420, 75.8320, "Pithampur Toll",        6, "Fatigue-related accidents post midnight"),
        (22.7200, 75.9000, "Rajendra Nagar X-road", 7, "Blind junction — no visibility"),
        (22.7600, 75.8700, "Bicholi Mardana",       5, "Waterlogging causes skids in monsoon"),
        (22.7050, 75.8700, "Palasiya Chowk",        6, "Pedestrian-vehicle conflict zone"),
        (22.7350, 75.8650, "MG Road Central",       7, "Heavy turning traffic conflicts"),
        (22.7300, 75.8900, "Ring Road Segment 7",   8, "Illegal overtaking — 2 deaths 2024"),
    ]
    result = []
    for slat, slon, name, sev, desc in SPOTS:
        dist_km = _haversine_km(lat, lon, slat, slon)
        if dist_km * 1000 > radius:
            continue
        result.append({
            "id": f"BS-{uuid.uuid4().hex[:6].upper()}",
            "name": name,
            "lat": slat,
            "lon": slon,
            "severity": sev,
            "description": desc,
            "distance_m": round(dist_km * 1000),
            "type": "blackspot",
            "alert_radius_m": 400,
        })
    result.sort(key=lambda x: x["distance_m"])
    return result


def _get_cameras(lat, lon, radius):
    CAMS = [
        (22.7264, 75.8577, "speed",  "AB Road Speed Camera",       60, "IMC Traffic"),
        (22.7350, 75.8820, "helmet", "Vijay Nagar Helmet Camera",  0,  "MP Police"),
        (22.7100, 75.8900, "speed",  "Palasiya Speed Trap",        50, "IMC Traffic"),
        (22.7500, 75.8700, "redlight","LIG Square Red-Light Camera",0, "MP Police"),
        (22.7150, 75.8550, "speed",  "Bypass Speed Camera",        80, "NHAI"),
        (22.7430, 75.8960, "helmet", "C21 Mall Junction Camera",   0,  "MP Police"),
        (22.7060, 75.8640, "speed",  "Bhanwarkuan Speed Trap",     50, "IMC Traffic"),
        (22.7300, 75.9100, "redlight","Rajendra Nagar Signal Cam", 0,  "MP Police"),
    ]
    result = []
    for clat, clon, ctype, name, limit, operator in CAMS:
        dist_km = _haversine_km(lat, lon, clat, clon)
        if dist_km * 1000 > radius:
            continue
        result.append({
            "id": f"CAM-{uuid.uuid4().hex[:6].upper()}",
            "type": ctype,
            "name": name,
            "lat": clat,
            "lon": clon,
            "speed_limit_kmh": limit,
            "operator": operator,
            "distance_m": round(dist_km * 1000),
            "alert_radius_m": 250,
        })
    result.sort(key=lambda x: x["distance_m"])
    return result


def _get_violation_zones(lat, lon, radius):
    ZONES = [
        (22.7264, 75.8577, 500, "No Helmet Zone", "helmet",  "Strict enforcement — cameras active"),
        (22.7350, 75.8820, 400, "School Zone",    "speed",   "40 km/h limit · 8am-2pm"),
        (22.7100, 75.8650, 600, "Highway Stretch","speed",   "80 km/h · No overtaking"),
        (22.7500, 75.9000, 300, "Hospital Zone",  "horn",    "No horn · 24-hour"),
        (22.7200, 75.8700, 350, "No Parking Zone","parking", "Tow zone active"),
        (22.7420, 75.8450, 450, "CCTV Zone",      "multi",   "All violations tracked digitally"),
    ]
    result = []
    for zlat, zlon, zrad, name, vtype, desc in ZONES:
        dist_km = _haversine_km(lat, lon, zlat, zlon)
        if dist_km * 1000 > radius:
            continue
        result.append({
            "id": f"ZONE-{uuid.uuid4().hex[:6].upper()}",
            "name": name,
            "type": vtype,
            "lat": zlat,
            "lon": zlon,
            "radius_m": zrad,
            "description": desc,
            "distance_m": round(dist_km * 1000),
            "fine_inr": _get_fine(vtype),
        })
    result.sort(key=lambda x: x["distance_m"])
    return result


def _get_fine(vtype: str) -> str:
    fines = {
        "helmet": "₹1,000 (1st) · ₹2,000 (2nd)",
        "speed": "₹1,000–₹2,000",
        "horn": "₹1,000",
        "parking": "₹500 + tow charges",
        "multi": "Multiple applicable",
    }
    return fines.get(vtype, "₹1,000+")
