# Road Safety AI — BIMSTEC Edition
### IIT Madras Road Safety Hackathon 2026

---

## 🏆 Judging Criteria Coverage

| Criterion | Implementation | Evidence |
|-----------|----------------|----------|
| **Technical Innovation** | RAG + LLM hierarchy resolution, offline AI reasoning (TF-IDF), fine-by-vehicle differentiation | `lib/offlineClassifier.ts`, `services/llm_reasoner.py`, `violations.json` |
| **Social Impact** | 3 modules covering legal rights, emergency response, infrastructure accountability | All 3 app modules — `/chat`, `/emergency`, `/report` |
| **BIMSTEC Relevance** | 7-country fine data with vehicle-tier breakdown, BIMSTEC emergency numbers, city-level fallback contacts | `services/drivelegal.py`, `IssueReportCard.tsx`, `lib/api.ts` |
| **Scalability** | FastAPI + IndexedDB offline cache + PWA service worker, FAISS vector store | `sw.js`, `lib/db.ts`, `app/rag/` |
| **UI/UX** | Glassmorphism design, Framer Motion animations, 4-mode map, dark/light toggle, skeleton loaders, toast notifications | All frontend components |
| **Data Integrity** | Real MV Act sections, BIMSTEC fine schedules, Overpass OSM live data, repair_date from OSM tags | `SCHEMA_AND_SAMPLES.md`, `violations.json` |
| **Offline Capability** | Full offline fallback with city-specific hardcoded contacts (Dhaka, Colombo, Kathmandu, Bangkok) | `lib/api.ts` → `getFallbackServices()`, `lib/offlineClassifier.ts` |
| **Contractor Accountability** | Budget transparency, escalation path, SLA tracking in every road issue report | `services/roadwatch.py`, `ComplaintTracker.tsx` |

---

## 🌏 BIMSTEC Coverage

| Nation | DriveLegal | RoadSoS | RoadWatch |
|--------|-----------|---------|-----------|
| 🇮🇳 India | ✅ MV Act 2019, state amendments, city-level | ✅ 108/112/100 | ✅ IMC, PMGSY, PWD |
| 🇧🇩 Bangladesh | ✅ Road Transport Act, bike/car/truck fines | ✅ 999 + Dhaka hospitals | ✅ BRTA routing |
| 🇳🇵 Nepal | ✅ Motor Vehicles Act, tiered fines | ✅ 102 + Kathmandu contacts | ✅ DoR routing |
| 🇱🇰 Sri Lanka | ✅ Motor Traffic Act 1951, tiered fines | ✅ 1990 + Colombo contacts | ✅ RDA routing |
| 🇹🇭 Thailand | ✅ Land Traffic Act, tiered fines | ✅ 1669 + Bangkok contacts | ✅ DRR routing |
| 🇲🇲 Myanmar | ✅ Road Traffic Rules, tiered fines | ✅ 999/192 | ✅ DOT routing |
| 🇧🇹 Bhutan | ✅ Road Safety and Transport Act, tiered fines | ✅ 112 | ✅ DOR routing |

---

## Features — three modules

| Module | What it does |
|--------|-------------|
| **DriveLegal** | Smart Challan Calculator — violation → fine by city/state/country, vehicle type (bike/car/truck), repeat offence, live OSM road detection |
| **RoadWatch** | Report road issues with ticket ID, authority routing, contractor name, budget transparency, SLA countdown, escalation path |
| **RoadSoS** | Emergency crash response — Golden Hour countdown, nearest trauma centre, GPS deep-links, city-level offline contacts for BIMSTEC capitals |

---

## v15 Changes (current)

| # | Change | Files |
|---|--------|-------|
| 1 | **fine_by_vehicle for all 6 BIMSTEC nations** — bike/car/truck differentiated fines for helmet, signal, drunk driving, speeding | `violations.json` (+104 entries) |
| 2 | **pytest path fix** — `conftest.py` in `backend/` so `pytest tests/` resolves `app.*` imports | `backend/conftest.py` |
| 3 | **Offline city contacts** — Dhaka, Colombo, Kathmandu, Bangkok hardcoded with hospitals + police, bounding-box routing | `lib/api.ts → getFallbackServices()` |
| 4 | **Road card repair date** — Overpass `repair_date`/`surface:date` tags shown as "Last repaired: March 2024" | `lib/api.ts`, `app/chat/page.tsx` |
| 5 | **MapController integration** — `/map` now uses MapController with 4 mode tabs; crisis URL param triggers `forceEmergency` | `app/map/page.tsx` |
| 6 | **ThemeToggle** — dark/light mode toggle in Navbar, persisted to localStorage | `components/shared/ThemeToggle.tsx`, `Navbar.tsx` |
| 7 | **Toast notifications** — react-hot-toast on SOS, ticket creation, offline transitions | `app/layout.tsx`, `app/emergency/page.tsx`, `app/report/page.tsx`, `PWAProvider.tsx` |
| 8 | **Skeleton loaders** — 5 skeleton variants replacing spinners: chat, map services, report card, stats, generic card | `components/shared/Skeleton.tsx` |

---

## API surface

```
POST /chat                   → main chatbot (all three modules)
POST /challan                → direct challan lookup (no NLP)
GET  /challan/violations     → autocomplete list
GET  /challan/countries      → BIMSTEC portals
POST /ocr/scan               → image → OCR → challan card
GET  /ocr/health             → pytesseract health check
POST /extract/               → entity extraction (debug)
POST /report/                → RoadWatch issue submission
GET  /map/...                → crowdsourced incident map
GET  /emergency/...          → emergency broadcast
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   ROAD SAFETY AI  v15                        │
│                 IIT Madras Hackathon 2026                     │
├──────────────┬──────────────────┬───────────────────────────┤
│  DriveLegal  │    RoadSoS       │       RoadWatch            │
│  Legal AI    │  Emergency       │  Infrastructure            │
│              │                  │                            │
│ • MV Act RAG │ • OSM Overpass   │ • Pothole heatmap          │
│ • 7-nation   │ • Golden Hour    │ • Contractor accountability│
│   fine DB    │   Protocol       │ • Budget transparency      │
│ • Hierarchy  │ • City contacts  │ • SLA tracking             │
│   resolution │ • Crash Mode     │ • Authority escalation     │
├──────────────┴──────────────────┴───────────────────────────┤
│         AI MAP — MapController (4 Modes)                     │
│    Emergency | Legal | RoadWatch | Authority                  │
│    + Risk Radar + Layer Controls + Crisis URL param          │
├──────────────────────────────────────────────────────────────┤
│  FastAPI | FAISS RAG | LLM Reasoner | Twilio Notifier        │
├──────────────────────────────────────────────────────────────┤
│  PWA + Service Worker | IndexedDB | Offline AI Classifier    │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick start

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY or GROQ_API_KEY
uvicorn app.main:app --reload
# Swagger: http://localhost:8000/docs

# Run tests:
cd backend && pytest tests/ -v
```

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
# App: http://localhost:3000
```
