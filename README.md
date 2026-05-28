<div align="center">

![Hero](https://raw.githubusercontent.com/yajatkataria08-a11y/Roadsafety-AI/main/asset/hero.svg)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)
[![BIMSTEC](https://img.shields.io/badge/Coverage-7%20BIMSTEC%20Nations-FF2D2D?style=flat-square)](#-bimstec-coverage)

</div>

---

## 🧭 Overview

Road Safety AI is a unified platform covering all **7 BIMSTEC nations** with four life-saving modes — crash emergency response, AI-powered legal compliance, civic road issue reporting, and authority accountability — all in a single **offline-first Progressive Web App**.

> *Every year 460,000 Indians and 80,000 Bangladeshis die on roads. This is the only solution that works offline, covers all 7 nations, and connects citizens directly to authorities with SLA accountability.*

---

## 📊 Impact at a Glance

<div align="center">

![Stats](https://raw.githubusercontent.com/yajatkataria08-a11y/Roadsafety-AI/main/asset/stats.svg)

</div>

---

## 🗺️ Platform Modes

<div align="center">

![Architecture](https://raw.githubusercontent.com/yajatkataria08-a11y/Roadsafety-AI/main/asset/architecture.svg)

</div>

| Mode | Description |
|------|-------------|
| 🚨 **RoadSoS — CrashMode™** | One-tap 60-minute Golden Hour countdown, offline first-aid, 112/108/100 dialing, real-time trauma centre navigation |
| ⚖️ **DriveLegal AI** | 154 verified violations × 7 nations, vehicle-type-aware fine calc, repeat-offence penalties, MV Act citations, Hinglish support |
| 🗺️ **RoadWatch Heatmap** | Severity-weighted heatmap over Leaflet tiles, 4-step GPS-tagged issue reporting, community upvoting, SLA breach alerts |
| 🏛️ **Authority Dashboard** | Animated choropleth ward map, budget utilisation, contractor accountability, cross-city BIMSTEC benchmarks |

---

## 🧠 AI Pipeline

<div align="center">

![AI Pipeline](https://raw.githubusercontent.com/yajatkataria08-a11y/Roadsafety-AI/main/asset/pipeline.svg)

</div>

Every query flows through up to 5 layers — fully offline at layers 1–3, cloud-augmented at 4–5. The confidence threshold (`LLM_CONFIDENCE_THRESHOLD=0.65`) controls when queries escalate from local to cloud. Layers 4–5 gracefully degrade when unavailable.

| Layer | Component | Role |
|-------|-----------|------|
| 1 | Keyword Classifier | Offline intent detection |
| 2 | BiLSTM NER | Intent + entity extraction |
| 3 | FAISS RAG | Semantic search over 154 violations |
| 4 | Gemini Flash | Primary LLM reasoning |
| 5 | Groq Llama-3.1-70B | Auto-failover fallback |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📡 **Offline-First PWA** | Service worker caches violations DB, emergency numbers, first-aid. Full functionality on airplane mode |
| 📷 **Challan OCR** | Client-side Tesseract.js + server pytesseract. Extracts vehicle no., violation, fine & due date |
| 🔔 **Multi-Channel Alerts** | Emergency dispatch via SMS (Twilio), WhatsApp, Email (SMTP), webhook on every CrashMode trigger |
| 🗺️ **OSM Integration** | Overpass API queries for nearest hospitals, trauma centres & ambulance stations in real-time |
| 🔐 **OTP Auth** | MSG91 SMS-based OTP login. OAuth2 via Google, GitHub, LinkedIn |
| ⏱️ **Rate Limiting** | slowapi middleware — 30 req/min on `/chat`, configurable per route |

---

## 🌏 BIMSTEC Coverage

<div align="center">

![BIMSTEC Nations](https://raw.githubusercontent.com/yajatkataria08-a11y/Roadsafety-AI/main/asset/nations.svg)

</div>

Legal violation data sourced from official motor vehicle acts and verified against 2024–2025 gazette notifications for all 7 nations.

---

## 🚀 Quick Start

### Backend (FastAPI)

```bash
git clone https://github.com/yajatkataria08-a11y/Roadsafety-AI
cd Roadsafety-AI/backend
cp .env.example .env
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Swagger UI → http://localhost:8000/docs
```

### Frontend (Next.js)

```bash
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

### Docker

```bash
docker build -t roadsafety-api ./backend
docker run -p 8000:8000 --env-file ./backend/.env roadsafety-api
```

---

## 📡 API Reference

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `GET` | `/` | Health check | — |
| `POST` | `/chat` | AI chat — intent + RAG + LLM | 30/min |
| `POST` | `/challan/calculate` | DriveLegal challan calculator | 60/min |
| `POST` | `/emergency/trigger` | CrashMode — SMS/WhatsApp/email dispatch | 10/min |
| `POST` | `/report/submit` | RoadWatch — geo-tagged issue submission | 30/min |
| `GET` | `/map/emergency` | Nearest hospitals & trauma centres (Overpass) | 60/min |
| `GET` | `/map/legal` | CCTV & speed trap locations | 60/min |
| `POST` | `/ocr/scan` | Challan image OCR | 20/min |
| `POST` | `/extract` | Entity extraction from natural language | 60/min |
| `POST` | `/otp/send` | Send OTP via MSG91 | 5/min |

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React 19, Framer Motion 11, Tailwind CSS, Dexie (IndexedDB), Tesseract.js |
| **Backend** | FastAPI 0.111, SQLAlchemy 2.0, uvicorn, slowapi, Pillow, pdfminer.six |
| **AI / ML** | sentence-transformers 2.7, PyTorch 2.3 (CPU), FAISS-cpu 1.8, BiLSTM NER, scikit-learn |
| **LLMs** | Gemini Flash (primary), Groq Llama-3.1-70B (fallback) |
| **Maps** | Leaflet.js, OpenStreetMap, Overpass API, canvas heatmap |
| **Notifications** | Twilio SMS/WhatsApp, MSG91 OTP, SMTP email, webhook |
| **Infra** | Docker, SQLite (dev) / PostgreSQL (prod), PWA Service Worker |

---

## ⚙️ Environment Variables

### Backend `.env`

```env
USE_SQLITE=true
DB_HOST=localhost
DB_NAME=roadsafety
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
LLM_CONFIDENCE_THRESHOLD=0.65
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
SMTP_HOST=smtp.gmail.com
SMTP_USER=your@email.com
NOTIFY_WEBHOOK_URL=https://your-endpoint.com/emergency
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
GOOGLE_CLIENT_ID=your_google_oauth_id
GOOGLE_CLIENT_SECRET=your_google_secret
```

---

## 📁 Project Structure
## 📁 Project Structure

<div align="center">

![Structure](https://raw.githubusercontent.com/yajatkataria08-a11y/Roadsafety-AI/main/asset/structure.svg)

</div>
---

## 🧪 Tests

```bash
cd backend
pytest tests/test_challan.py -v
pytest tests/test_entity_extractor.py -v
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

<div align="center">

**Built with ❤️ for IIT Madras · BIMSTEC Road Safety Hackathon 2026**

*Next.js 15 · FastAPI · BiLSTM · FAISS · Gemini Flash · Groq · Offline-First PWA*

</div>
