"""
tests/test_entity_extractor.py — v11
══════════════════════════════════════════════════════════════════════════════
Comprehensive test suite for the entity_extractor module.

Run with:   cd backend && pytest tests/test_entity_extractor.py -v
Coverage:   pytest tests/test_entity_extractor.py --cov=app.models.entity_extractor
══════════════════════════════════════════════════════════════════════════════
"""

import importlib.util, sys, types, pathlib, pytest

# ── Minimal package stubs so we can import without full FastAPI stack ─────────
def _load_extractor():
    app_pkg = types.ModuleType("app")
    app_pkg.__path__ = [str(pathlib.Path("app").resolve())]
    models_pkg = types.ModuleType("app.models")
    models_pkg.__path__ = [str(pathlib.Path("app/models").resolve())]
    sys.modules.setdefault("app", app_pkg)
    sys.modules.setdefault("app.models", models_pkg)
    spec = importlib.util.spec_from_file_location(
        "app.models.entity_extractor", "app/models/entity_extractor.py"
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["app.models.entity_extractor"] = mod
    spec.loader.exec_module(mod)
    return mod

_ee = _load_extractor()
extract     = _ee.extract
extract_all = _ee.extract_all


# ══════════════════════════════════════════════════════════════════════════════
# 1.  DriveLegal — Module Routing
# ══════════════════════════════════════════════════════════════════════════════

class TestDriveLegalRouting:
    def test_basic_fine_query(self):
        assert extract("what is the fine for no helmet").module == "DriveLegal"

    def test_challan_keyword(self):
        assert extract("challan for signal jump in delhi").module == "DriveLegal"

    def test_hinglish_fine(self):
        assert extract("helmet ka fine kitna hota hai").module == "DriveLegal"

    def test_devanagari(self):
        assert extract("बिना हेलमेट के जुर्माना").module == "DriveLegal"

    def test_accident_fine_not_sos(self):
        # "accident ka fine" must NOT trigger emergency routing
        assert extract("accident ka fine kitna hai").module == "DriveLegal"

    def test_insurance_query(self):
        assert extract("no insurance challan amount in karnataka").module == "DriveLegal"

    def test_repeat_fine_bhopal(self):
        assert extract("wrong parking bhopal second time fine").module == "DriveLegal"


# ══════════════════════════════════════════════════════════════════════════════
# 2.  DriveLegal — Violation Extraction
# ══════════════════════════════════════════════════════════════════════════════

class TestViolationExtraction:
    @pytest.mark.parametrize("text,expected", [
        ("helmet fine",                        "No Helmet"),
        ("bina helmet scooty challan",         "No Helmet"),
        ("without helmet",                     "No Helmet"),
        ("helmet nahi pehna",                  "No Helmet"),
        ("बिना हेलमेट",                        "No Helmet"),
        ("signal jump fine",                   "Signal Jumping"),
        ("red light toda",                     "Signal Jumping"),
        ("laal batti pe ruka nahi",            "Signal Jumping"),
        ("drunk driving penalty",              "Drunk Driving"),
        ("daaru pi ke gaadi chalana",          "Drunk Driving"),
        ("over speeding",                      "Overspeeding"),
        ("tez speed challan",                  "Overspeeding"),
        ("using mobile while driving fine",    "Mobile Phone While Driving"),
        ("gaadi chalate phone",                "Mobile Phone While Driving"),
        ("no seatbelt",                        "No Seatbelt"),
        ("wrong parking fine",                 "Wrong Parking"),
        ("triple riding",                      "Triple Riding"),
        ("teen sawari fine",                   "Triple Riding"),
        ("wrong side driving",                 "Wrong Side Driving"),
        ("bina licence penalty",               "No Driving Licence"),
        ("no insurance",                       "No Insurance"),
        ("no puc certificate",                 "No PUC Certificate"),
        ("overloading penalty",                "Overloading"),
        ("tinted glass fine",                  "Tinted Glass"),
        ("pressure horn challan",              "Pressure Horn"),
    ])
    def test_violation(self, text, expected):
        r = extract(text)
        assert r.violation == expected, f"Input: '{text}' → got {r.violation!r}"


# ══════════════════════════════════════════════════════════════════════════════
# 3.  DriveLegal — Vehicle Type Extraction
# ══════════════════════════════════════════════════════════════════════════════

class TestVehicleExtraction:
    @pytest.mark.parametrize("text,expected", [
        ("helmet fine for bike",          "two_wheeler"),
        ("scooty bina helmet",            "two_wheeler"),
        ("activa challan",                "two_wheeler"),
        ("motorcycle penalty",            "two_wheeler"),
        ("royal enfield challan",         "two_wheeler"),
        ("car fine for no seatbelt",      "lmv"),
        ("innova parking challan",        "lmv"),
        ("swift signal jump",             "lmv"),
        ("truck overloading fine",        "hmv"),
        ("lorry penalty for overload",    "hmv"),
        ("bus signal fine",               "bus"),
        ("school bus parking",            "bus"),
        ("auto rickshaw parking challan", "auto"),
        ("tuk tuk fine",                  "auto"),
    ])
    def test_vehicle(self, text, expected):
        r = extract(text, predicted_intent="DriveLegal")
        assert r.vehicle_type == expected, f"Input: '{text}' → got {r.vehicle_type!r}"


# ══════════════════════════════════════════════════════════════════════════════
# 4.  DriveLegal — Geo Extraction
# ══════════════════════════════════════════════════════════════════════════════

class TestGeoExtraction:
    def test_city_chennai(self):
        r = extract("helmet fine in chennai")
        assert r.city == "Chennai"
        assert r.state == "Tamil Nadu"
        assert r.country == "India"

    def test_city_indore(self):
        r = extract("challan in indore for bike")
        assert r.city == "Indore"
        assert r.state == "Madhya Pradesh"

    def test_city_dhaka(self):
        r = extract("helmet fine in dhaka")
        assert r.country == "Bangladesh"

    def test_city_colombo(self):
        r = extract("traffic fine in colombo")
        assert r.country == "Sri Lanka"

    def test_city_bangkok(self):
        r = extract("drunk driving penalty in bangkok")
        assert r.country == "Thailand"

    def test_state_mp_abbreviation(self):
        r = extract("helmet fine in mp for scooty")
        assert r.state == "Madhya Pradesh"

    def test_state_up_abbreviation(self):
        r = extract("signal jump challan up")
        assert r.state == "Uttar Pradesh"

    def test_country_bangladesh_direct(self):
        r = extract("traffic rules bangladesh")
        assert r.country == "Bangladesh"

    def test_city_overrides_state(self):
        r = extract("drunk driving in bengaluru karnataka")
        assert r.city == "Bengaluru"
        assert r.state == "Karnataka"

    def test_no_city_defaults_india(self):
        r = extract("helmet fine challan amount")
        assert r.country == "India"
        assert r.city is None


# ══════════════════════════════════════════════════════════════════════════════
# 5.  DriveLegal — Repeat Offence Detection
# ══════════════════════════════════════════════════════════════════════════════

class TestRepeatOffence:
    @pytest.mark.parametrize("text", [
        "helmet fine second time",
        "caught again without helmet",
        "repeat offence challan",
        "doosri baar helmet nahi",
        "pehle bhi fine mila tha",
        "teen baar signal jump",
        "already fined for no seatbelt twice",
    ])
    def test_repeat_detected(self, text):
        r = extract(text, predicted_intent="DriveLegal")
        assert r.repeat_offence is True, f"Expected repeat for: '{text}'"
        assert r.fine_multiplier == 2.0

    @pytest.mark.parametrize("text", [
        "helmet fine in chennai",
        "signal jump penalty amount",
        "drunk driving fine today",
    ])
    def test_no_repeat(self, text):
        r = extract(text)
        assert r.repeat_offence is False


# ══════════════════════════════════════════════════════════════════════════════
# 6.  DriveLegal — Confidence Scoring
# ══════════════════════════════════════════════════════════════════════════════

class TestDriveLegalConfidence:
    def test_full_query_high_confidence(self):
        r = extract("helmet fine in chennai for scooty second time")
        assert r.confidence >= 0.85

    def test_partial_query_lower_confidence(self):
        r = extract("fine")
        assert r.confidence < 0.60

    def test_confidence_in_range(self):
        for text in ["fine for bike in indore", "drunk driving bangalore"]:
            r = extract(text)
            assert 0.0 <= r.confidence <= 1.0


# ══════════════════════════════════════════════════════════════════════════════
# 7.  RoadSoS — Module Routing
# ══════════════════════════════════════════════════════════════════════════════

class TestRoadSoSRouting:
    def test_unconscious(self):
        assert extract("driver is unconscious please help").module == "RoadSoS"

    def test_bleeding_hindi(self):
        assert extract("bahut khoon aa raha hai please ambulance bhejo").module == "RoadSoS"

    def test_hospital_request(self):
        assert extract("nearest hospital from my location now").module == "RoadSoS"

    def test_fire_emergency(self):
        assert extract("aag lag gayi gaadi mein please fire brigade").module == "RoadSoS"

    def test_multi_injured(self):
        assert extract("multiple injured please send ambulance now").module == "RoadSoS"


# ══════════════════════════════════════════════════════════════════════════════
# 8.  RoadSoS — Severity Classification
# ══════════════════════════════════════════════════════════════════════════════

class TestSeverityClassification:
    def test_critical_unconscious(self):
        r = extract("person is unconscious no pulse")
        assert r.severity == "CRITICAL"
        assert r.urgency_score >= 0.90

    def test_critical_cardiac(self):
        r = extract("cardiac arrest on highway please help dying")
        assert r.severity == "CRITICAL"

    def test_serious_bleeding(self):
        r = extract("accident hua bleeding hai sar pe chot hai")
        assert r.severity == "SERIOUS"

    def test_serious_trapped(self):
        r = extract("person trapped in car need help fire")
        assert r.severity in ("SERIOUS", "CRITICAL")

    def test_mild_fender_bender(self):
        r = extract("minor accident scratch hi hai no injury")
        assert r.severity == "MILD"

    def test_mild_puncture(self):
        r = extract("tyre flat on highway need mechanic", predicted_intent="RoadSoS")
        assert r.module == "RoadSoS"
        assert r.severity == "MILD"


# ══════════════════════════════════════════════════════════════════════════════
# 9.  RoadSoS — Service Type & Victim Count
# ══════════════════════════════════════════════════════════════════════════════

class TestRoadSoSServiceAndVictims:
    @pytest.mark.parametrize("text,expected_svc", [
        ("send ambulance quickly",               "ambulance"),
        ("nearest trauma centre",                "trauma"),
        ("police help needed",                   "police"),
        ("thana ko bulao",                       "police"),
        ("car breakdown need towing",            "towing"),
        ("gaadi bandh mechanic chahiye",         "towing"),
        ("fire brigade urgent",                  "fire"),
    ])
    def test_service_type(self, text, expected_svc):
        r = extract(text, predicted_intent="RoadSoS")
        assert r.service_type == expected_svc, f"Input: '{text}' → got {r.service_type!r}"

    def test_victim_count_numeric(self):
        r = extract("5 people injured in accident send help")
        assert r.victim_count == 5

    def test_victim_count_word(self):
        r = extract("multiple people trapped need rescue")
        assert r.victim_count is not None
        assert r.victim_count >= 2


# ══════════════════════════════════════════════════════════════════════════════
# 10. RoadWatch — Module Routing
# ══════════════════════════════════════════════════════════════════════════════

class TestRoadWatchRouting:
    def test_pothole(self):
        assert extract("there is a big pothole on MG Road").module == "RoadWatch"

    def test_broken_signal(self):
        assert extract("signal nahi kaam kar raha vizag mein").module == "RoadWatch"

    def test_waterlogging(self):
        assert extract("waterlogging blocking traffic on Linking Road Mumbai").module == "RoadWatch"

    def test_streetlight(self):
        assert extract("street light not working dark road at night").module == "RoadWatch"

    def test_open_manhole(self):
        assert extract("open manhole on MG road dangerous night time").module == "RoadWatch"

    def test_report_keyword(self):
        assert extract("I want to report a broken divider near indore").module == "RoadWatch"


# ══════════════════════════════════════════════════════════════════════════════
# 11. RoadWatch — Issue Type Extraction
# ══════════════════════════════════════════════════════════════════════════════

class TestIssueTypeExtraction:
    @pytest.mark.parametrize("text,expected", [
        ("big pothole on NH 52",                  "pothole"),
        ("gaddha on the road very dangerous",     "pothole"),
        ("signal not working near metro station", "broken_signal"),
        ("batti nahi jal rahi signal ki",         "broken_signal"),
        ("waterlogging after rain in mumbai",     "waterlogging"),
        ("paani jama hai on main road",           "waterlogging"),
        ("streetlight not working dark road",     "streetlight"),
        ("andhera hai lamp post kharab",          "streetlight"),
        ("broken divider on highway",             "broken_divider"),
        ("speed breaker missing paint",           "speed_breaker"),
        ("open manhole near school very unsafe",  "open_manhole"),
        ("garbage dumped on road",                "garbage_dumping"),
    ])
    def test_issue_type(self, text, expected):
        r = extract(text, predicted_intent="RoadWatch")
        assert r.issue_type == expected, f"Input: '{text}' → got {r.issue_type!r}"


# ══════════════════════════════════════════════════════════════════════════════
# 12. RoadWatch — Urgency & Night Detection
# ══════════════════════════════════════════════════════════════════════════════

class TestRoadWatchUrgency:
    def test_high_urgency_blocking(self):
        assert extract("pothole blocking entire road urgent fix needed").urgency == "high"

    def test_high_urgency_dangerous(self):
        assert extract("khatarnak gaddha highway pe accident ho sakta hai").urgency == "high"

    def test_low_urgency(self):
        assert extract("minor pothole near my house not too bad").urgency == "low"

    def test_night_detected(self):
        assert extract("streetlight not working on main road at night very dark").night_time is True

    def test_raat_ko_night(self):
        assert extract("raat ko signal kaam nahi karta bahut andhera").night_time is True

    def test_no_night_default(self):
        assert extract("pothole on MG road report karna hai").night_time is False


# ══════════════════════════════════════════════════════════════════════════════
# 13. Extract All
# ══════════════════════════════════════════════════════════════════════════════

class TestExtractAll:
    def test_returns_all_three_modules(self):
        result = extract_all("helmet fine in chennai for scooty second time")
        assert set(result.keys()) == {"DriveLegal", "RoadSoS", "RoadWatch"}

    def test_each_has_confidence(self):
        result = extract_all("drunk driving bangalore")
        for module, data in result.items():
            assert "confidence" in data
            assert 0.0 <= data["confidence"] <= 1.0

    def test_module_specific_fields(self):
        result = extract_all("ambulance needed unconscious person highway")
        assert "severity" in result["RoadSoS"]
        assert "violation" in result["DriveLegal"]
        assert "issue_type" in result["RoadWatch"]


# ══════════════════════════════════════════════════════════════════════════════
# 14. Force Module Override
# ══════════════════════════════════════════════════════════════════════════════

class TestForceModule:
    def test_force_roadsos_on_fine_text(self):
        r = extract("accident ka fine", force_module="RoadSoS")
        assert r.module == "RoadSoS"

    def test_force_roadwatch(self):
        r = extract("help me", force_module="RoadWatch")
        assert r.module == "RoadWatch"

    def test_force_drivelegal_on_pothole_text(self):
        r = extract("there is a pothole", force_module="DriveLegal")
        assert r.module == "DriveLegal"


# ══════════════════════════════════════════════════════════════════════════════
# 15. Edge Cases
# ══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    def test_minimal_input(self):
        r = extract("fine")
        assert r is not None
        assert 0.0 <= r.confidence <= 1.0

    def test_very_long_message(self):
        long = "helmet " * 300 + "fine in chennai for scooty"
        r = extract(long)
        assert r.module == "DriveLegal"
        assert r.city == "Chennai"

    def test_mixed_language(self):
        r = extract("Mujhe helmet challan ki jankari chahiye Chennai mein")
        assert r.module == "DriveLegal"
        assert r.city == "Chennai"

    def test_all_caps(self):
        r = extract("HELMET FINE IN DELHI FOR BIKE SECOND TIME")
        assert r.violation == "No Helmet"
        assert r.repeat_offence is True

    def test_to_dict_has_required_fields_drivelegal(self):
        r = extract("helmet fine in chennai for scooty second time")
        d = r.to_dict()
        for f in ("module", "confidence", "violation", "vehicle_type",
                  "city", "state", "country", "repeat_offence"):
            assert f in d

    def test_predicted_intent_hint(self):
        r = extract("accident near my house report", predicted_intent="RoadWatch")
        assert r.module == "RoadWatch"


# ══════════════════════════════════════════════════════════════════════════════
# 16. BIMSTEC Nations Coverage
# ══════════════════════════════════════════════════════════════════════════════

class TestBIMSTECCoverage:
    @pytest.mark.parametrize("text,expected_country", [
        ("helmet fine in dhaka for bike",           "Bangladesh"),
        ("traffic rule violation in colombo",       "Sri Lanka"),
        ("drunk driving penalty kathmandu",         "Nepal"),
        ("speed limit fine in bangkok",             "Thailand"),
        ("parking challan in yangon",               "Myanmar"),
        ("no helmet fine in thimphu",               "Bhutan"),
        ("signal jump fine in chittagong",          "Bangladesh"),
        ("no seatbelt penalty in kandy sri lanka",  "Sri Lanka"),
    ])
    def test_bimstec_country(self, text, expected_country):
        r = extract(text)
        assert r.country == expected_country, \
            f"Expected {expected_country} for '{text}', got {r.country!r}"
