# Smart Challan Calculator — Schema & Sample Outputs
## IIT Madras Road Safety Hackathon 2026 | DriveLegal v4

---

## 📐 Enhanced violations.json Schema

Each entry in `violations.json` now supports the following fields:

```jsonc
{
  // ── Core (unchanged from v3) ────────────────────────────────────────
  "violation": "No Helmet",                    // Human-readable violation name
  "aliases": ["bina helmet indore", ...],       // Hinglish + English search terms
  "fine": 1000,                                 // Base fine (integer, in local currency)
  "repeat_penalty": 2000,                       // Fine for repeat offenders
  "location": "India",                          // Country (required)
  "state": "Madhya Pradesh",                   // State (null = national rule)
  "city": "Indore",                             // City (null = state/national rule)
  "law_section": "MV Act Section 129 + ...",   // Legal reference
  "notes": "Enforcement context...",            // City-specific enforcement notes

  // ── NEW IN v4 — Smart Challan Calculator ──────────────────────────
  "vehicle_type": "two_wheeler",
  // One of: "two_wheeler" | "lmv" | "hmv" | "bus" | "auto" | "all"
  // Controls which violations appear for which vehicle queries.

  "fine_by_vehicle": {                          // OPTIONAL — overrides "fine" if present
    "two_wheeler": 1000,
    "lmv":         1500,
    "hmv":         2000
  },
  // When violations have different fines by vehicle (e.g. overspeeding),
  // fine_by_vehicle takes priority over the flat "fine" field.

  "points": 2,
  // Integer — licence demerit points deducted. India: advisory (not yet enforced).
  // BIMSTEC: varies. 0 = no points deducted.

  "possible_consequences": "Disqualification on 3rd offence...",
  // Plain-English description of non-monetary consequences:
  // imprisonment, impoundment, licence suspension, FIR, etc.

  "discount_info": "Pay within 15 days for 50% discount.",
  // State/city early-payment schemes or "No discount applicable."

  "payment_link": "https://echallan.parivahan.gov.in/"
  // Official portal for paying this challan. State-specific where available.
}
```

### Vehicle Type Values Reference

| Value | Vehicles Covered |
|-------|-----------------|
| `two_wheeler` | Motorcycle, scooter, moped, e-bike |
| `lmv` | Car, SUV, jeep, minivan, pickup truck |
| `hmv` | Truck, lorry, tanker, tipper, trailer |
| `bus` | Bus, mini-bus, school bus, tourist bus |
| `auto` | Auto-rickshaw, e-rickshaw, tempo |
| `all` | All vehicle categories (default) |

---

## 🧪 Sample Test Queries & Expected Outputs

---

### Query 1 — City-specific, vehicle-specific, first offence
**Input:**
```
"scooter bina helmet indore ka challan kya hoga?"
```
**Detected:** vehicle_type=`two_wheeler`, city=`Indore`, repeat=`False`

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚔 SMART CHALLAN CALCULATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Violation: No Helmet
📍 Location:  Indore, Madhya Pradesh
🚗 Vehicle:   Two-Wheeler (Bike/Scooter)

━━ 💰 FINE BREAKDOWN ━━━━━━━━━━━━━━━━━
  Base Fine:           ₹ 1,000
  Repeat Offence Fine: ₹ 2,000 (if repeated)
  ─────────────────────────────────
  TOTAL PAYABLE:   ₹ 1,000

━━ 📊 LICENCE IMPACT ━━━━━━━━━━━━━━━━━
  ⚠️ 2 point(s) deducted from your driving licence

━━ ⚖️  POSSIBLE ADDITIONAL PENALTIES ━━
  Licence suspension on 3rd offence. Pillion rider also issued
  separate challan. AI-camera detection — no on-spot cop needed.

━━ 📜 LEGAL SECTION ━━━━━━━━━━━━━━━━━━
  MV Act Section 129 + MP Motor Vehicles Rules 2022

━━ 🏙️  ENFORCEMENT NOTES ━━━━━━━━━━━━━
  ₹1000 fine. AI-powered cameras at AB Road, Ring Road, Vijay Nagar,
  Palasia, and Rajwada detect helmetless riders. E-challan sent to
  registered mobile. Pillion rider equally liable.

━━ 💳 PAYMENT INFO ━━━━━━━━━━━━━━━━━━━
  No discount. E-challan sent to registered mobile within 24 hours.
  🔗 Pay online: https://echallan.parivahan.gov.in/

📍 City-specific data for Indore (highest precision)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Query 2 — Repeat offence, drunk driving, Indore
**Input:**
```
"drunk driving Indore dobara pakda gaya, second time"
```
**Detected:** vehicle_type=`all`, city=`Indore`, repeat=`True`

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚔 SMART CHALLAN CALCULATOR 🔁 REPEAT OFFENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Violation: Drunk Driving
📍 Location:  Indore, Madhya Pradesh
🚗 Vehicle:   All Vehicle Types

━━ 💰 FINE BREAKDOWN ━━━━━━━━━━━━━━━━━
  Base Fine:           ₹ 10,000
  Repeat Offence Fine: ₹ 15,000 ← You are a repeat offender
  ─────────────────────────────────
  TOTAL PAYABLE:   ₹ 15,000 (repeat offence rate)

━━ 📊 LICENCE IMPACT ━━━━━━━━━━━━━━━━━
  ⚠️ 6 point(s) deducted from your driving licence

━━ ⚖️  POSSIBLE ADDITIONAL PENALTIES ━━
  Imprisonment up to 2 years (repeat). Mandatory 6-month licence
  suspension. Vehicle impounded 72+ hours. FIR registered.
  Court appearance mandatory.

━━ 📜 LEGAL SECTION ━━━━━━━━━━━━━━━━━━
  MV Act Section 185 + IPC 279/304A

━━ 🏙️  ENFORCEMENT NOTES ━━━━━━━━━━━━━
  Naka checking every Fri-Sun 9 PM near Palasia, Vijay Nagar clubs.
  FIR registered immediately. Vehicle kept in police yard.

━━ 💳 PAYMENT INFO ━━━━━━━━━━━━━━━━━━━
  No discount. Judicial fine — not payable online. Must appear in court.
  🔗 Pay online: https://www.mphighcourt.gov.in/

📍 City-specific data for Indore (highest precision)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Query 3 — HMV vehicle, state-level, overspeeding
**Input:**
```
"truck overspeeding fine madhya pradesh highway"
```
**Detected:** vehicle_type=`hmv`, state=`Madhya Pradesh`, repeat=`False`

**Fine Resolution:** `fine_by_vehicle["hmv"]` = ₹2,000 (higher than LMV ₹1,000)

**Expected Output (key sections):**
```
📋 Violation: Overspeeding
🚗 Vehicle:   Heavy Motor Vehicle (Truck/Lorry)

  Base Fine:   ₹ 2,000 (specific to Heavy Motor Vehicle)
  TOTAL PAYABLE:   ₹ 2,000

  HMV drivers: commercial licence suspension (repeat).

📍 State-level data for Madhya Pradesh
```

---

### Query 4 — BIMSTEC country (Thailand), currency switch
**Input:**
```
"no helmet challan thailand"
```
**Detected:** vehicle_type=`two_wheeler` (implicit), country=`Thailand`

**Expected Output (key sections):**
```
📋 Violation: No Helmet
📍 Location:  Thailand
🚗 Vehicle:   Two-Wheeler (Bike/Scooter)

  Base Fine:   THB 500
  Repeat:      THB 1,000 (if repeated)
  TOTAL PAYABLE: THB 500

  Law: Thailand Traffic and Transport Act B.E. 2522 Section 122
```

---

### Query 5 — Multi-violation ambiguous query
**Input:**
```
"drunk driving accident fine"
```
**Detected:** Matches multiple violations → multi-violation output

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚔 MULTIPLE VIOLATIONS DETECTED
Showing top 3 matches for your query:

1. Drunk Driving  📍National
   Fine: ₹ 10,000  |  Law: MV Act Section 185 + IPC 279/304A
   Repeat: ₹ 15,000
   Licence points: -6

2. Dangerous Driving  📍State
   Fine: ₹ 1,000  |  Law: MV Act Section 184
   Repeat: ₹ 5,000
   Licence points: -4

3. Wrong Side Driving  🌐National
   Fine: ₹ 1,000  |  Law: MV Act Section 184 + Section 119
   Repeat: ₹ 5,000
   Licence points: -4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Ask about a specific violation for full challan details.
```

---

## 🏛️ Coverage Summary — violations_final.json

| Region | Violations Covered | Notes |
|--------|--------------------|-------|
| Indore, MP | 7 | Helmet, Signal, Parking, Speed, Triple Riding, Mobile, Drunk |
| Bhopal, MP | 2 | Helmet, Parking |
| Madhya Pradesh (state) | 8 | All major violations |
| Delhi | 4 | Helmet, Signal, Drunk, Parking |
| Mumbai, Maharashtra | 2 | Helmet, Speed |
| Bengaluru, Karnataka | 2 | Helmet, Signal |
| India (national) | 10+ | All major MV Act 2019 violations |
| Thailand | 2 | Helmet, Drunk |
| Bangladesh/Dhaka | 2 | Helmet, Drunk |
| Nepal/Kathmandu | 1 | Helmet |
| Sri Lanka | 1 | Helmet |
| Bhutan | 1 | Helmet |
| Myanmar/Yangon | 1 | Helmet |
| **Total** | **154** | Original 139 + 15 enhanced |

---

## 🏆 Judging Criteria Addressed

| Criterion | Implementation |
|-----------|---------------|
| **Geo-fenced lookup** | 3-tier city→state→country hierarchy |
| **Automated Challan Calculator** | Complete breakdown with base+repeat+total |
| **Legal Accuracy** | MV Act 2019 + state-specific rules + BIMSTEC laws |
| **Vehicle-type awareness** | `detect_vehicle_type()` + `fine_by_vehicle` schema |
| **Innovation** | AI camera notes, Smart City enforcement, Hinglish support |
| **Multi-language** | English + Hinglish aliases (30+ per violation) |
| **BIMSTEC coverage** | Thailand, Bangladesh, Nepal, Sri Lanka, Bhutan, Myanmar |
| **Payment integration** | Direct links: Parivahan, state portals, BRTA, DLT |
