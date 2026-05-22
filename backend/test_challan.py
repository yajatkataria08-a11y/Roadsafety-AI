"""
test_challan.py — Smart Challan Calculator Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Standalone test runner — does NOT require FastAPI or sentence-transformers.
Tests the pure logic of:
  - detect_vehicle_type()
  - _detect_repeat_offence()
  - _resolve_fine()
  - _find_best_match()
  - _generate_challan_summary()

Run with:
    cd backend
    python -m test_challan

Expected output: PASS for all 30+ test cases.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Minimal stubs so we can import drivelegal without full FastAPI stack ───────
import types

# Stub bilstm / extract_entities
bilstm_mod = types.ModuleType("app.models.bilstm")
def _stub_extract_entities(text):
    """Minimal NER stub for tests — uses simple keyword matching."""
    text_l = text.lower()
    city_map = {
        "indore": ("Indore", "Madhya Pradesh", "India"),
        "bhopal": ("Bhopal", "Madhya Pradesh", "India"),
        "delhi":  ("Delhi",  "Delhi",           "India"),
        "mumbai": ("Mumbai", "Maharashtra",     "India"),
        "bangalore": ("Bengaluru", "Karnataka", "India"),
        "bengaluru": ("Bengaluru", "Karnataka", "India"),
        "bangkok": ("Bangkok", "Bangkok",       "Thailand"),
        "dhaka":   ("Dhaka",  "Dhaka Division", "Bangladesh"),
    }
    state_map = {
        "madhya pradesh": ("Madhya Pradesh", "India"),
        " mp ":           ("Madhya Pradesh", "India"),
    }
    result = {"location": None, "state": None, "country": None,
              "violation": None, "service_type": None}
    for city, (loc, st, co) in city_map.items():
        if city in text_l:
            result.update({"location": loc, "state": st, "country": co})
            break
    for st_key, (st, co) in state_map.items():
        if st_key in text_l and not result["state"]:
            result.update({"state": st, "country": co})
            break
    if not result["country"]:
        if "india" in text_l:
            result["country"] = "India"
        elif "thailand" in text_l:
            result["country"] = "Thailand"
        elif "bangladesh" in text_l:
            result["country"] = "Bangladesh"
    return result

bilstm_mod.extract_entities = _stub_extract_entities
sys.modules["app"] = types.ModuleType("app")
sys.modules["app.models"] = types.ModuleType("app.models")
sys.modules["app.models.bilstm"] = bilstm_mod

# Stub RAG retriever
rag_mod = types.ModuleType("app.rag.retriever")
rag_mod.rag_search = lambda q: None
sys.modules["app.rag"] = types.ModuleType("app.rag")
sys.modules["app.rag.retriever"] = rag_mod

# Now import the actual drivelegal module
import json
from pathlib import Path

# Point LEGAL_DB_PATH to correct location
import app.services.drivelegal as dl

# Override DB path to point to actual data
dl.LEGAL_DB_PATH = (
    Path(__file__).parent.parent / "data" / "legal" / "violations.json"
)
dl._DB = None  # force reload


# ══════════════════════════════════════════════════════════════════════════════
# TEST HELPERS
# ══════════════════════════════════════════════════════════════════════════════

PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"
results = []

def check(name: str, got, expected_contains=None, expected_equals=None):
    """Run one assertion and print result."""
    ok = True
    if expected_contains is not None:
        if isinstance(expected_contains, list):
            ok = all(e in got for e in expected_contains)
        else:
            ok = expected_contains in got
    if expected_equals is not None:
        ok = got == expected_equals

    status = PASS if ok else FAIL
    results.append(ok)
    print(f"  {status}  {name}")
    if not ok:
        print(f"        got: {repr(got)[:200]}")
        if expected_contains:
            print(f"        expected to contain: {expected_contains}")
        if expected_equals:
            print(f"        expected: {expected_equals}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST SECTION 1 — Vehicle Type Detection
# ══════════════════════════════════════════════════════════════════════════════

print("\n🚗 SECTION 1 — Vehicle Type Detection")
print("─" * 50)

check("Scooter detection",
      dl.detect_vehicle_type("bina helmet scooter wala challan"), "two_wheeler")

check("Bike (implicit via 'bina helmet')",
      dl.detect_vehicle_type("bina helmet indore"), "two_wheeler")

check("Truck detection (English)",
      dl.detect_vehicle_type("truck mein overloading fine kya hai"), "hmv")

check("Lorry detection",
      dl.detect_vehicle_type("lorry overloading challan"), "hmv")

check("Car detection",
      dl.detect_vehicle_type("my car seatbelt challan in indore"), "lmv")

check("SUV detection (Fortuner)",
      dl.detect_vehicle_type("fortuner speed limit violation delhi"), "lmv")

check("Bus detection",
      dl.detect_vehicle_type("school bus overloading fine india"), "bus")

check("Auto-rickshaw detection",
      dl.detect_vehicle_type("auto rickshaw overloading passengers"), "auto")

check("No vehicle = all",
      dl.detect_vehicle_type("signal jump challan kya hai"), "all")

check("Royal Enfield = two_wheeler",
      dl.detect_vehicle_type("royal enfield helmet rule india"), "two_wheeler")

check("Pillion keyword = two_wheeler",
      dl.detect_vehicle_type("pillion rider helmet rule mp"), "two_wheeler")


# ══════════════════════════════════════════════════════════════════════════════
# TEST SECTION 2 — Repeat Offence Detection
# ══════════════════════════════════════════════════════════════════════════════

print("\n🔁 SECTION 2 — Repeat Offence Detection")
print("─" * 50)

check("'second time' triggers repeat",
      dl._detect_repeat_offence("second time helmet challan kya hoga"), True)

check("'repeat offence' triggers repeat",
      dl._detect_repeat_offence("repeat offence fine for drunk driving"), True)

check("'dobara challan' triggers repeat",
      dl._detect_repeat_offence("dobara challan kitna hoga"), True)

check("'phir se' triggers repeat",
      dl._detect_repeat_offence("phir se pakda gaya bina helmet"), True)

check("'already got challan' triggers repeat",
      dl._detect_repeat_offence("I already got a challan last month, got caught again"), True)

check("Normal query = not repeat",
      dl._detect_repeat_offence("helmet challan indore kya hai"), False)

check("'again' triggers repeat",
      dl._detect_repeat_offence("caught again without seatbelt"), True)


# ══════════════════════════════════════════════════════════════════════════════
# TEST SECTION 3 — Fine Resolution
# ══════════════════════════════════════════════════════════════════════════════

print("\n💰 SECTION 3 — Fine Resolution (vehicle-type awareness)")
print("─" * 50)

# Create a mock tiered-fine entry
tiered_entry = {
    "fine_by_vehicle": {"two_wheeler": 1000, "lmv": 1500, "hmv": 2000}
}

fine_tw, note = dl._resolve_fine(tiered_entry, "two_wheeler")
check("Tiered fine — two_wheeler", fine_tw, expected_equals=1000)

fine_lmv, note = dl._resolve_fine(tiered_entry, "lmv")
check("Tiered fine — lmv", fine_lmv, expected_equals=1500)

fine_hmv, note = dl._resolve_fine(tiered_entry, "hmv")
check("Tiered fine — hmv", fine_hmv, expected_equals=2000)

flat_entry = {"fine": 1000}
fine_flat, _ = dl._resolve_fine(flat_entry, "two_wheeler")
check("Flat fine — any vehicle", fine_flat, expected_equals=1000)

fine_all, _ = dl._resolve_fine(tiered_entry, "all")
check("Tiered fine — vehicle='all' returns string description",
      isinstance(fine_all, str), expected_equals=True)


# ══════════════════════════════════════════════════════════════════════════════
# TEST SECTION 4 — Best Match Finder (structured DB lookup)
# ══════════════════════════════════════════════════════════════════════════════

print("\n🔍 SECTION 4 — Best Match Finder")
print("─" * 50)

match = dl._find_best_match("helmet challan indore", "India", "Madhya Pradesh", "Indore")
check("Indore helmet → city-level match (city='Indore')",
      match is not None and match.get("city") == "Indore", expected_equals=True)

match = dl._find_best_match("helmet challan madhya pradesh", "India", "Madhya Pradesh", None)
check("MP helmet → state-level match",
      match is not None and match.get("state") == "Madhya Pradesh", expected_equals=True)

match = dl._find_best_match("drunk driving india", "India", None, None)
check("National drunk driving match found",
      match is not None and "drunk" in match.get("violation","").lower(), expected_equals=True)

match = dl._find_best_match("garbage in the river", "India", None, None)
check("Irrelevant query → None", match, expected_equals=None)

# Vehicle type filter: scooter overloading → should prefer two_wheeler entries
match_tw = dl._find_best_match("triple riding scooter indore", "India", "Madhya Pradesh", "Indore", vehicle_type="two_wheeler")
check("Triple riding + two_wheeler → match found",
      match_tw is not None, expected_equals=True)


# ══════════════════════════════════════════════════════════════════════════════
# TEST SECTION 5 — Full Challan Summary Output Format
# ══════════════════════════════════════════════════════════════════════════════

print("\n📋 SECTION 5 — Challan Summary Output")
print("─" * 50)

# Test 1: Indore helmet fine — city specific
result = dl.handle_drivelegal(
    "helmet challan indore",
    country="India", user_state="Madhya Pradesh", user_city="Indore"
)
check("Indore helmet — contains challan header",    result, "SMART CHALLAN CALCULATOR")
check("Indore helmet — contains base fine",         result, "Base Fine")
check("Indore helmet — contains total payable",     result, "TOTAL PAYABLE")
check("Indore helmet — contains legal section",     result, "MV Act Section 129")
check("Indore helmet — contains payment link",      result, "echallan.parivahan.gov.in")
check("Indore helmet — city-specific note",         result, "City-specific")

# Test 2: Drunk driving repeat offence
result = dl.handle_drivelegal(
    "drunk driving dobara pakda gaya indore",
    country="India", user_state="Madhya Pradesh", user_city="Indore"
)
check("Drunk driving repeat — REPEAT flag shown",   result, "REPEAT OFFENCE")
check("Drunk driving repeat — repeat penalty shown",result, "repeat offender")
check("Drunk driving repeat — consequences shown",  result, "Imprisonment")

# Test 3: Truck overspeeding (HMV)
result = dl.handle_drivelegal(
    "truck overspeeding fine madhya pradesh",
    country="India", user_state="Madhya Pradesh"
)
check("Truck overspeeding — vehicle type detected", result, "Heavy Motor Vehicle")

# Test 4: Signal jump Delhi
result = dl.handle_drivelegal(
    "signal jump challan delhi",
    country="India", user_state="Delhi", user_city="Delhi"
)
check("Delhi signal jump — found",                  result, "Signal Jump")
check("Delhi signal jump — MV Act 119",             result, "119")

# Test 5: Thailand helmet
result = dl.handle_drivelegal(
    "no helmet challan thailand",
    country="Thailand"
)
check("Thailand helmet — THB currency",             result, "THB")
check("Thailand helmet — found",                    result, "No Helmet")

# Test 6: Bangladesh drunk driving
result = dl.handle_drivelegal(
    "drunk driving fine dhaka bangladesh",
    country="Bangladesh"
)
check("Bangladesh drunk driving — BDT currency",    result, "BDT")

# Test 7: No licence India
result = dl.handle_drivelegal(
    "bina licence gaadi chalana india",
    country="India"
)
check("No licence India — found",                   result, "Driving Without Licence")
check("No licence India — fine shown",              result, "5,000")

# Test 8: Wrong parking Indore
result = dl.handle_drivelegal(
    "wrong parking indore",
    country="India", user_city="Indore"
)
check("Wrong parking Indore — towing info",         result, "Towing")

# Test 9: No insurance
result = dl.handle_drivelegal(
    "bina insurance car challan india",
    country="India"
)
check("No insurance — found",                       result, "No Insurance")
check("No insurance — LMV vehicle detected",        result, "Light Motor Vehicle")

# Test 10: Irrelevant query
result = dl.handle_drivelegal("what is the best restaurant in indore", country="India")
check("Irrelevant query — graceful fallback",       result, "couldn't find")


# ══════════════════════════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

total  = len(results)
passed = sum(results)
failed = total - passed

print(f"\n{'━'*50}")
print(f"🏁 RESULTS: {passed}/{total} passed  |  {failed} failed")
if failed == 0:
    print("🎉 ALL TESTS PASSED — Smart Challan Calculator is hackathon-ready!")
else:
    print(f"⚠️  {failed} test(s) failed — review output above.")
print(f"{'━'*50}\n")

sys.exit(0 if failed == 0 else 1)
