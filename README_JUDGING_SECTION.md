# Road Safety AI — v21 FINAL
## Team Bro Code · VIT Bhopal · BIMSTEC Road Safety Hackathon 2026 · IIT Madras

---

## Judging Criterion Map

| Feature | Criterion | Evidence |
|---|---|---|
| Shake-to-SOS + Golden Hour | Innovation | DeviceMotion API, 60-min trauma countdown, auto-hospital finder |
| 7-Nation Violations DB (2,756 entries) | BIMSTEC Coverage | All 7 nations, correct law sections, currencies, payment URLs |
| Voice Input en-IN + Hinglish | Accessibility | Web Speech API, 40+ regex pattern mappings |
| Canvas Heatmap | Technical Depth | Pure canvas API, real-time radial gradients, no library |
| Live Location Tracking | Real-World Utility | watchPosition hook, pulsing GPS dot, live Risk Radar re-fire |
| Authority Dashboard | Government Impact | 15 wards, SLA breach red flags, SVG chart, CSV export |
| Offline PWA | Resilience | ONNX classifier, Dexie/IndexedDB, service worker bg-sync |
| OCR Challan Scanner | Innovation | pytesseract (server) → Tesseract.js (client) fallback |
| Emergency Contacts + SOS SMS | Life Safety | IndexedDB contacts, SMS deep-links staggered 500ms |
| Onboarding Flow | UX Polish | Swipe gestures, first-run detection, 4 steps |
| AI Challan Explainer | Innovation | Typewriter-streamed AI — why law exists, consequences, contest |
| BIMSTEC Emergency Dialer | BIMSTEC Coverage | All 7 nations, accurate numbers, tappable tel: links ≥44px |
| Multi-Language Chat Input | Accessibility | Devanagari/Bengali/Thai detection, script badge, transliterate |
| Challan History (IndexedDB) | Technical Depth | Real Dexie persistence, newest-first, payment deep-links |

## v21 New Files
- `frontend/lib/hooks/useLocationTracker.ts`
- `frontend/lib/i18n/chatTranslate.ts`
- `frontend/components/challan/ChallanExplainerModal.tsx`
- `frontend/components/emergency/BIMSTECDialer.tsx`
- `frontend/components/shared/OnboardingModal.tsx`
- `frontend/app/authority/page.tsx`
- `frontend/scripts/expand-violations-v21.js`

## Running
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Patch violations DB (optional)
node frontend/scripts/expand-violations-v21.js
```
