# 🚦 Road Safety AI — BIMSTEC Hackathon 2026

> **IIT Madras | CoERS | RBG Labs**
> Theme: *AI in Road Safety*

A unified AI chatbot covering three modules:
| Module | Function |
|---|---|
| **DriveLegal** | Traffic laws, fines, penalties — by country |
| **RoadWatch** | Road issue reporting & complaint tracking |
| **RoadSoS** | Live emergency service locator (hospitals, police, ambulance) |

---

## 🚀 Quick Start

```bash
cd backend
cp .env.example .env          # configure as needed
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit → `http://localhost:8000/docs` (Swagger UI)

---

## 📁 Folder Structure

```
roadsafety-ai/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint
│   │   ├── routes/            # /chat  /emergency  /report
│   │   ├── services/          # DriveLegal | RoadSoS | RoadWatch logic
│   │   ├── models/            # BiLSTM stub → real model
│   │   ├── rag/               # FAISS embedder + retriever
│   │   ├── geo/               # Overpass API (OSM)
│   │   └── utils/             # DB, helpers
│   ├── data/
│   │   ├── legal/violations.json   # Seed legal DB (India, BD, LK)
│   │   └── training/intents.json   # BiLSTM training data
│   ├── saved_models/          # Trained model weights
│   └── requirements.txt
├── scripts/
│   ├── train_bilstm.py        # Phase 2: Train intent classifier
│   ├── scrape_legal_data.py   # Phase 1: Data acquisition
│   └── retrain_pipeline.py   # Phase 5: Weekly self-learning
└── frontend/                  # React/HTML chat interface (Phase 4)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat/` | Main chatbot — auto-routes to module |
| POST | `/emergency/` | Crash mode — nearest services |
| POST | `/report/` | Submit road issue (text + image) |

### Example: Chat
```bash
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the fine for no helmet in India?", "country": "India"}'
```

### Example: Emergency
```bash
curl -X POST http://localhost:8000/emergency/ \
  -H "Content-Type: application/json" \
  -d '{"lat": 13.0827, "lon": 80.2707, "type": "hospital"}'
```

---

## 🧠 Phase Roadmap

- [x] **Phase 1** — Data + Legal DB + OSM Geo + FAISS RAG
- [x] **Phase 2** — BiLSTM stub + intent routing + NER
- [ ] **Phase 3** — Crash Mode + Fine Predictor + Smart Reporting
- [ ] **Phase 4** — Web UI + WhatsApp integration
- [ ] **Phase 5** — Feedback loop + auto-retraining
- [ ] **Phase 6** — Polish + demo script

---

## 🌍 Countries Covered
India · Bangladesh · Sri Lanka · Nepal · Myanmar · Bhutan · Thailand

---

## 📞 Emergency Numbers (Fallback)
| Country | Emergency | Ambulance | Police |
|---|---|---|---|
| India | 112 | 108 | 100 |
| Bangladesh | 999 | 199 | 999 |
| Sri Lanka | 119 | 110 | 118 |
