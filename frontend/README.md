# 🚦 Road Safety AI — Frontend

> **BIMSTEC Road Safety Hackathon 2026** · IIT Madras · CoERS · RBG Labs

A stunning, animated Next.js 15 frontend for the Road Safety AI platform — connecting citizens to traffic law knowledge, road issue reporting, and emergency services across 7 BIMSTEC nations.

---

## ✨ Features

### 🏠 Landing Page (First-Impression Hero)
- Cinematic full-screen hero with animated night road scene
- Live moving cars, traffic light, floating helmet
- Typing animation: *"AI That Saves Lives on Indian & BIMSTEC Roads"*
- Animated counters: lives saved, challans explained, response time
- Trust badges: IIT Madras, BIMSTEC, Govt. of India, CoERS, RBG Labs
- Glassmorphism module cards with hover glow

### 💬 Chat Interface (Heart of the Product)
- WhatsApp + ChatGPT hybrid design with road safety aesthetic
- Animated message bubbles (staggered slide-up + fade)
- Road-themed typing indicator (cars as bouncing dots)
- Quick Action Chips (10 pre-built queries, scrollable)
- Country context selector (7 BIMSTEC nations)
- Location sharing with GPS coordinates
- Emergency SOS shortcut button
- Desktop sidebar with emergency numbers reference
- Falls back to smart mock responses if backend is offline

### 🚨 Crash Mode / Emergency Screen
- Full-screen red siren overlay animation
- "CRASH MODE ACTIVATED" with pulse effects
- One-tap call buttons: Emergency / Ambulance / Police
- GPS-located nearest services list (hospitals, ambulances, police)
- Countdown timer for expected response
- Navigate buttons linking to Google Maps
- Filter by service type

### 📍 RoadWatch — Report Road Issues
- 4-step guided complaint form with animated progress
- 8 issue type cards (pothole, broken signal, etc.)
- Photo drag-and-drop upload with preview
- GPS location capture
- Complaint summary review
- Success screen with particle confetti + unique Ticket ID

### ⚙️ Settings & History
- Language selector (English, Hindi, Bengali, Tamil, Sinhala, Nepali)
- Toggle preferences (notifications, location, accessibility)
- Chat history with intent badges

---

## 🚀 Quick Start

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_URL to your backend URL

# 3. Start development server
npm run dev
```

Open → **http://localhost:3000**

> **Backend offline?** No problem! The chat interface uses intelligent mock responses to demo all three modules (DriveLegal, RoadWatch, RoadSoS) without the FastAPI backend.

---

## 🔌 Backend Integration

Set your backend URL in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

API endpoints consumed:
| Endpoint | Used By |
|---|---|
| `POST /chat/` | Chat interface (main conversation) |
| `POST /emergency/` | Crash Mode (locate services) |
| `POST /report/` | RoadWatch complaint form |

---

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js 15 App Router
│   ├── page.tsx            # Landing page
│   ├── chat/page.tsx       # Main chat interface
│   ├── emergency/page.tsx  # Crash Mode
│   ├── report/page.tsx     # RoadWatch form
│   ├── history/page.tsx    # Chat history
│   ├── settings/page.tsx   # Settings
│   ├── layout.tsx          # Root layout + fonts
│   └── globals.css         # Global styles + animations
├── components/
│   ├── chat/               # Chat-specific components
│   │   ├── MessageBubble.tsx  # User/AI bubbles + typing indicator
│   │   ├── QuickChips.tsx     # Scrollable quick-action chips
│   │   ├── ChatInput.tsx      # Input bar with location + image
│   │   └── types.ts           # TypeScript interfaces
│   ├── landing/            # Landing page sections
│   │   ├── HeroSection.tsx    # Cinematic hero
│   │   └── FeaturesSection.tsx # Module cards + stats
│   └── shared/
│       └── Navbar.tsx         # Responsive navigation
├── lib/
│   ├── utils.ts            # Helpers + quick chip data
│   └── api.ts              # Backend client + mock responses
├── tailwind.config.ts      # Custom design system
└── next.config.js          # Next.js config
```

---

## 🎨 Design System

| Token | Value |
|---|---|
| Primary | `#FF6200` (Safety Orange) |
| Emergency | `#FF1744` (Danger Red) |
| Background | `#0A1628` (Deep Navy) |
| Surface | `#0D1F3C` |
| Success | `#00E676` (Green) |
| Typography | Rajdhani (display) + Outfit (body) |

### Key CSS Classes
```css
.glass          /* Glassmorphism backdrop */
.glass-card     /* Card with glass effect */
.btn-primary    /* Orange CTA button */
.btn-danger     /* Red emergency button */
.bubble-user    /* User chat bubble */
.bubble-ai      /* AI response bubble */
.chip-hover     /* Animated chip lift */
.sos-ring       /* Pulsing SOS animation */
.text-urgent    /* Red urgency pulse text */
```

---

## 🌍 Countries Supported

India · Bangladesh · Sri Lanka · Nepal · Myanmar · Bhutan · Thailand

Each with correct emergency numbers for Emergency / Ambulance / Police lines.

---

## 📦 Tech Stack

- **Next.js 15** — App Router, Server Components
- **React 19** — Latest hooks
- **TypeScript** — Full type safety
- **Tailwind CSS** — Custom design tokens
- **Framer Motion** — Advanced animations
- **Lucide React** — Icons

---

## 🏆 Hackathon Notes

This frontend is designed to make judges say **"Wow"** in the first 10 seconds:

1. **Landing page** — Cinematic hero with live road animation, typing headline, animated counters
2. **Chat interface** — Production-grade, WhatsApp-like UX with road safety aesthetic
3. **Crash Mode** — Full-screen emergency UI with siren effects and one-tap calling
4. **Performance** — 60fps animations, mobile-first, < 200KB first load JS

Built for **BIMSTEC Road Safety Hackathon 2026** organized by Centre of Excellence for Road Safety (CoERS), RBG Labs, IIT Madras.
