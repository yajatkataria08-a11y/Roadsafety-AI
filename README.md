<div align="center">

<!-- ANIMATED HERO SVG -->
<svg width="860" height="180" viewBox="0 0 860 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="heroGrad" x1="0" y1="0" x2="860" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF2D2D"/>
      <stop offset="50%" stop-color="#FF7A1A"/>
      <stop offset="100%" stop-color="#FFB800"/>
    </linearGradient>
    <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#111318"/>
      <stop offset="100%" stop-color="#0A0C10"/>
    </linearGradient>
    <style>
      .dash { stroke-dasharray: 36 24; animation: dash 1s linear infinite; }
      @keyframes dash { to { stroke-dashoffset: -60; } }
      .car1 { animation: car1 5s linear infinite; }
      @keyframes car1 { from { transform: translateX(-80px); } to { transform: translateX(920px); } }
      .car2 { animation: car2 8s 1.8s linear infinite; }
      @keyframes car2 { from { transform: translateX(-80px); } to { transform: translateX(920px); } }
      .siren { animation: siren 0.5s ease-in-out infinite alternate; }
      @keyframes siren { from { fill: #FF2D2D; opacity: 1; } to { fill: #FF2D2D; opacity: 0.15; } }
      .titlePulse { animation: titlePulse 3s ease-in-out infinite; }
      @keyframes titlePulse { 0%,100% { opacity:1; } 50% { opacity:0.85; } }
    </style>
  </defs>

  <!-- Background -->
  <rect width="860" height="180" rx="16" fill="#0A0C10"/>
  <!-- Glow -->
  <ellipse cx="430" cy="60" rx="320" ry="60" fill="#FF2D2D" fill-opacity="0.07"/>
  <ellipse cx="700" cy="140" rx="180" ry="40" fill="#00C9B1" fill-opacity="0.05"/>

  <!-- Road surface -->
  <rect x="0" y="120" width="860" height="60" rx="0" fill="#111318"/>
  <rect x="0" y="120" width="860" height="1" fill="#1E2330"/>

  <!-- Road dashes -->
  <line class="dash" x1="0" y1="151" x2="860" y2="151" stroke="#FFB800" stroke-width="2" stroke-dasharray="36 24"/>
  <!-- Lane lines -->
  <line x1="0" y1="134" x2="860" y2="134" stroke="white" stroke-opacity="0.07" stroke-width="1"/>
  <line x1="0" y1="168" x2="860" y2="168" stroke="white" stroke-opacity="0.07" stroke-width="1"/>

  <!-- Car 1 (ambulance / emergency) -->
  <g class="car1">
    <rect x="0" y="124" width="52" height="24" rx="6" fill="#1A2035"/>
    <rect x="8" y="128" width="36" height="12" rx="3" fill="#222C45"/>
    <circle cx="12" cy="148" r="5.5" fill="#1A1A1A"/>
    <circle cx="12" cy="148" r="3" fill="#2A2A2A"/>
    <circle cx="40" cy="148" r="5.5" fill="#1A1A1A"/>
    <circle cx="40" cy="148" r="3" fill="#2A2A2A"/>
    <rect x="50" y="129" width="5" height="8" rx="1.5" fill="#FF7A1A" fill-opacity="0.9"/>
    <circle cx="2" cy="132" r="2.5" fill="#FFB800" fill-opacity="0.95"/>
    <!-- siren bar -->
    <rect class="siren" x="18" y="121" width="16" height="5" rx="2"/>
    <!-- cross -->
    <rect x="22" y="130" width="8" height="2" rx="1" fill="white" fill-opacity="0.6"/>
    <rect x="25" y="127" width="2" height="8" rx="1" fill="white" fill-opacity="0.6"/>
  </g>

  <!-- Car 2 (regular car) -->
  <g class="car2">
    <rect x="0" y="157" width="46" height="20" rx="5" fill="#0D1420"/>
    <rect x="7" y="161" width="30" height="10" rx="3" fill="#121B2E"/>
    <circle cx="10" cy="177" r="5" fill="#1A1A1A"/>
    <circle cx="36" cy="177" r="5" fill="#1A1A1A"/>
    <rect x="44" y="161" width="4" height="7" rx="1" fill="#FF2D2D" fill-opacity="0.7"/>
    <circle cx="1" cy="163" r="2" fill="#4FC3F7" fill-opacity="0.8"/>
  </g>

  <!-- Title text -->
  <text class="titlePulse" x="430" y="56" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-weight="900" font-size="46" letter-spacing="-2">
    <tspan fill="#E8EBF0">Road</tspan><tspan fill="#FF2D2D">Safety</tspan><tspan fill="#E8EBF0"> AI</tspan>
  </text>
  <text x="430" y="84" text-anchor="middle" font-family="'Segoe UI',system-ui,monospace" font-size="13" fill="#7A8299" letter-spacing="1">
    EMERGENCY · LEGAL · SURVEILLANCE · GOVERNANCE
  </text>

  <!-- Badges row -->
  <rect x="85" y="96" width="110" height="20" rx="10" fill="#FF2D2D" fill-opacity="0.15" stroke="#FF2D2D" stroke-opacity="0.4" stroke-width="1"/>
  <text x="140" y="110" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#FF6B6B">🚨 CrashMode</text>

  <rect x="207" y="96" width="106" height="20" rx="10" fill="#0FA8FF" fill-opacity="0.12" stroke="#0FA8FF" stroke-opacity="0.4" stroke-width="1"/>
  <text x="260" y="110" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#6BC8FF">⚖️ DriveLegal</text>

  <rect x="325" y="96" width="106" height="20" rx="10" fill="#00D87F" fill-opacity="0.12" stroke="#00D87F" stroke-opacity="0.4" stroke-width="1"/>
  <text x="378" y="110" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#6BFFB8">🗺️ RoadWatch</text>

  <rect x="443" y="96" width="120" height="20" rx="10" fill="#FFB800" fill-opacity="0.12" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="503" y="110" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#FFD966">🏛️ Authority Mode</text>

  <rect x="575" y="96" width="106" height="20" rx="10" fill="#00C9B1" fill-opacity="0.12" stroke="#00C9B1" stroke-opacity="0.4" stroke-width="1"/>
  <text x="628" y="110" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#6BFFF0">📡 Offline PWA</text>

  <!-- Corner accents -->
  <rect x="0" y="0" width="4" height="40" rx="2" fill="url(#heroGrad)"/>
  <rect x="856" y="0" width="4" height="40" rx="2" fill="url(#heroGrad)"/>
  <rect x="0" y="140" width="860" height="2" fill="url(#heroGrad)" fill-opacity="0.4"/>
</svg>

<br/>

**IIT Madras · BIMSTEC Road Safety Hackathon 2026**

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

## 🗺️ Platform Modes

<!-- Architecture SVG -->
<div align="center">
<svg width="820" height="320" viewBox="0 0 820 320" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .line-anim { stroke-dasharray: 8 5; animation: lineFlow 1.6s linear infinite; }
      .line-anim2 { stroke-dasharray: 8 5; animation: lineFlow 1.6s 0.4s linear infinite; }
      .line-anim3 { stroke-dasharray: 8 5; animation: lineFlow 1.6s 0.8s linear infinite; }
      .line-anim4 { stroke-dasharray: 8 5; animation: lineFlow 1.6s 1.2s linear infinite; }
      @keyframes lineFlow { to { stroke-dashoffset: -26; } }
      .hub-ring { animation: hubPulse 2s ease-in-out infinite; }
      @keyframes hubPulse { 0%,100% { opacity:0.4; r:65; } 50% { opacity:0.15; r:72; } }
    </style>
  </defs>

  <rect width="820" height="320" rx="16" fill="#0D1018"/>

  <!-- Hub -->
  <circle class="hub-ring" cx="410" cy="160" r="65" stroke="#FF2D2D" stroke-width="1.5" fill="none"/>
  <circle cx="410" cy="160" r="54" fill="#111822" stroke="#FF2D2D" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="410" y="153" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="13" fill="#E8EBF0">Road</text>
  <text x="410" y="171" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="13" fill="#FF2D2D">Safety AI</text>

  <!-- Lines -->
  <line class="line-anim"  x1="362" y1="118" x2="220" y2="72"  stroke="#FF2D2D" stroke-opacity="0.5" stroke-width="1.5"/>
  <line class="line-anim2" x1="458" y1="118" x2="600" y2="72"  stroke="#0FA8FF" stroke-opacity="0.5" stroke-width="1.5"/>
  <line class="line-anim3" x1="362" y1="202" x2="220" y2="248" stroke="#00D87F" stroke-opacity="0.5" stroke-width="1.5"/>
  <line class="line-anim4" x1="458" y1="202" x2="600" y2="248" stroke="#FFB800" stroke-opacity="0.5" stroke-width="1.5"/>

  <!-- RoadSoS -->
  <rect x="50" y="28" width="190" height="88" rx="12" fill="#111822" stroke="#FF2D2D" stroke-opacity="0.6" stroke-width="1.5"/>
  <rect x="66" y="44" width="30" height="30" rx="8" fill="#FF2D2D" fill-opacity="0.15"/>
  <text x="81" y="64" text-anchor="middle" font-size="16">🚨</text>
  <text x="138" y="56" font-family="sans-serif" font-weight="700" font-size="13" fill="#FF6B6B">RoadSoS</text>
  <text x="138" y="72" font-family="monospace" font-size="9" fill="#7A8299">Crash Mode · Golden Hour</text>
  <text x="138" y="85" font-family="monospace" font-size="9" fill="#7A8299">112/108 dispatch</text>
  <text x="138" y="98" font-family="monospace" font-size="9" fill="#7A8299">Nearest trauma centre</text>

  <!-- DriveLegal -->
  <rect x="580" y="28" width="190" height="88" rx="12" fill="#111822" stroke="#0FA8FF" stroke-opacity="0.6" stroke-width="1.5"/>
  <rect x="596" y="44" width="30" height="30" rx="8" fill="#0FA8FF" fill-opacity="0.15"/>
  <text x="611" y="64" text-anchor="middle" font-size="16">⚖️</text>
  <text x="668" y="56" font-family="sans-serif" font-weight="700" font-size="13" fill="#6BC8FF">DriveLegal</text>
  <text x="668" y="72" font-family="monospace" font-size="9" fill="#7A8299">154 violations · 7 nations</text>
  <text x="668" y="85" font-family="monospace" font-size="9" fill="#7A8299">Challan calculator</text>
  <text x="668" y="98" font-family="monospace" font-size="9" fill="#7A8299">MV Act RAG · Hinglish</text>

  <!-- RoadWatch -->
  <rect x="50" y="204" width="190" height="88" rx="12" fill="#111822" stroke="#00D87F" stroke-opacity="0.6" stroke-width="1.5"/>
  <rect x="66" y="220" width="30" height="30" rx="8" fill="#00D87F" fill-opacity="0.15"/>
  <text x="81" y="240" text-anchor="middle" font-size="16">🗺️</text>
  <text x="138" y="232" font-family="sans-serif" font-weight="700" font-size="13" fill="#6BFFB8">RoadWatch</text>
  <text x="138" y="248" font-family="monospace" font-size="9" fill="#7A8299">Severity heatmap</text>
  <text x="138" y="261" font-family="monospace" font-size="9" fill="#7A8299">Issue reporting · OCR scan</text>
  <text x="138" y="274" font-family="monospace" font-size="9" fill="#7A8299">SLA breach detection</text>

  <!-- Authority -->
  <rect x="580" y="204" width="190" height="88" rx="12" fill="#111822" stroke="#FFB800" stroke-opacity="0.6" stroke-width="1.5"/>
  <rect x="596" y="220" width="30" height="30" rx="8" fill="#FFB800" fill-opacity="0.15"/>
  <text x="611" y="240" text-anchor="middle" font-size="16">🏛️</text>
  <text x="668" y="232" font-family="sans-serif" font-weight="700" font-size="13" fill="#FFD966">Authority Mode</text>
  <text x="668" y="248" font-family="monospace" font-size="9" fill="#7A8299">Ward choropleth map</text>
  <text x="668" y="261" font-family="monospace" font-size="9" fill="#7A8299">Budget · SLA tracking</text>
  <text x="668" y="274" font-family="monospace" font-size="9" fill="#7A8299">BIMSTEC benchmarks</text>
</svg>
</div>

---

## ✨ Key Features

| Feature | Description |
|--------|-------------|
| 🚨 **CrashMode™** | One-tap 60-minute Golden Hour countdown, offline first-aid protocols, one-tap 112/108/100 dialing, and real-time trauma centre navigation |
| ⚖️ **DriveLegal AI** | 154 verified violations × 7 nations. Vehicle-type-aware fine calculation, repeat-offence penalties, MV Act citations, Hinglish query support |
| 🗺️ **RoadWatch Heatmap** | Severity-weighted canvas heatmap over Leaflet tiles, 4-step GPS-tagged issue reporting, community upvoting, SLA breach alerts |
| 🏛️ **Authority Dashboard** | Animated choropleth ward circles, budget utilisation bars, contractor accountability, cross-city BIMSTEC comparison |
| 🤖 **5-Layer AI Pipeline** | Offline keyword classifier → BiLSTM NER → FAISS RAG → Gemini Flash → Groq Llama-3.1-70B fallback |
| 📡 **Offline-First PWA** | Service worker caches violations DB, emergency numbers, first-aid protocols. Full functionality on airplane mode |
| 📷 **Challan OCR** | Client-side Tesseract.js + server-side pytesseract. Extracts vehicle no., violation, fine, and due date automatically |
| 🔔 **Multi-Channel Alerts** | Emergency dispatch via SMS (Twilio), WhatsApp, Email (SMTP), and webhook on every CrashMode trigger |

---

## 🧠 AI Pipeline

<!-- Pipeline SVG -->
<div align="center">
<svg width="820" height="200" viewBox="0 0 820 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .flow { stroke-dasharray: 6 4; animation: flow 1.2s linear infinite; }
      @keyframes flow { to { stroke-dashoffset: -20; } }
    </style>
  </defs>

  <rect width="820" height="200" rx="16" fill="#0D1018"/>

  <!-- Layer boxes -->
  <!-- L1 -->
  <rect x="16" y="50" width="138" height="100" rx="12" fill="#111822" stroke="#00D87F" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="85" y="90" text-anchor="middle" font-size="22">🟢</text>
  <text x="85" y="112" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#00D87F">Offline</text>
  <text x="85" y="127" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">Keyword</text>
  <text x="85" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">Classifier</text>
  <text x="85" y="36" text-anchor="middle" font-family="monospace" font-size="9" fill="#4a5068">LAYER 1</text>

  <line class="flow" x1="156" y1="100" x2="178" y2="100" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>

  <!-- L2 -->
  <rect x="180" y="50" width="138" height="100" rx="12" fill="#111822" stroke="#00D87F" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="249" y="90" text-anchor="middle" font-size="22">🧠</text>
  <text x="249" y="112" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#00D87F">BiLSTM</text>
  <text x="249" y="127" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">Intent + Entity</text>
  <text x="249" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">NER</text>
  <text x="249" y="36" text-anchor="middle" font-family="monospace" font-size="9" fill="#4a5068">LAYER 2</text>

  <line class="flow" x1="320" y1="100" x2="342" y2="100" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>

  <!-- L3 -->
  <rect x="344" y="50" width="138" height="100" rx="12" fill="#111822" stroke="#00C9B1" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="413" y="90" text-anchor="middle" font-size="22">🔍</text>
  <text x="413" y="112" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#00C9B1">FAISS RAG</text>
  <text x="413" y="127" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">154 violations</text>
  <text x="413" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">semantic search</text>
  <text x="413" y="36" text-anchor="middle" font-family="monospace" font-size="9" fill="#4a5068">LAYER 3</text>

  <line class="flow" x1="484" y1="100" x2="506" y2="100" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>

  <!-- L4 -->
  <rect x="508" y="50" width="138" height="100" rx="12" fill="#111822" stroke="#0FA8FF" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="577" y="90" text-anchor="middle" font-size="22">✨</text>
  <text x="577" y="112" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#0FA8FF">Gemini Flash</text>
  <text x="577" y="127" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">Primary LLM</text>
  <text x="577" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">reasoning layer</text>
  <text x="577" y="36" text-anchor="middle" font-family="monospace" font-size="9" fill="#4a5068">LAYER 4</text>

  <line class="flow" x1="648" y1="100" x2="670" y2="100" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>

  <!-- L5 -->
  <rect x="672" y="50" width="134" height="100" rx="12" fill="#111822" stroke="#FF7A1A" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="739" y="90" text-anchor="middle" font-size="22">🦙</text>
  <text x="739" y="112" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#FF7A1A">Groq Fallback</text>
  <text x="739" y="127" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">Llama-3.1-70B</text>
  <text x="739" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#7A8299">auto-failover</text>
  <text x="739" y="36" text-anchor="middle" font-family="monospace" font-size="9" fill="#4a5068">LAYER 5</text>

  <!-- Offline bracket -->
  <rect x="16" y="162" width="302" height="22" rx="6" fill="#00D87F" fill-opacity="0.08" stroke="#00D87F" stroke-opacity="0.3" stroke-width="1"/>
  <text x="167" y="177" text-anchor="middle" font-family="monospace" font-size="9" fill="#00D87F">✓ WORKS FULLY OFFLINE</text>

  <!-- Cloud bracket -->
  <rect x="508" y="162" width="298" height="22" rx="6" fill="#0FA8FF" fill-opacity="0.08" stroke="#0FA8FF" stroke-opacity="0.3" stroke-width="1"/>
  <text x="657" y="177" text-anchor="middle" font-family="monospace" font-size="9" fill="#0FA8FF">CLOUD-AUGMENTED (optional)</text>
</svg>
</div>

Confidence threshold (`LLM_CONFIDENCE_THRESHOLD=0.65`) controls when queries escalate from local to cloud. Layers 1–3 are always offline; layers 4–5 are optional and gracefully skipped when unavailable.

---

## 🌏 BIMSTEC Coverage

<!-- Nations SVG -->
<div align="center">
<svg width="680" height="100" viewBox="0 0 680 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="680" height="100" rx="12" fill="#0D1018"/>

  <!-- India -->
  <rect x="10"  y="14" width="84" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="52"  y="48" text-anchor="middle" font-size="24">🇮🇳</text>
  <text x="52"  y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">India</text>
  <text x="52"  y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">₹ MV 2019</text>

  <!-- Bangladesh -->
  <rect x="104" y="14" width="84" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="146" y="48" text-anchor="middle" font-size="24">🇧🇩</text>
  <text x="146" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">Bangladesh</text>
  <text x="146" y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">BDT 1983</text>

  <!-- Nepal -->
  <rect x="198" y="14" width="84" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="240" y="48" text-anchor="middle" font-size="24">🇳🇵</text>
  <text x="240" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">Nepal</text>
  <text x="240" y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">NPR 2049</text>

  <!-- Sri Lanka -->
  <rect x="292" y="14" width="84" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="334" y="48" text-anchor="middle" font-size="24">🇱🇰</text>
  <text x="334" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">Sri Lanka</text>
  <text x="334" y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">LKR 1951</text>

  <!-- Myanmar -->
  <rect x="386" y="14" width="84" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="428" y="48" text-anchor="middle" font-size="24">🇲🇲</text>
  <text x="428" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">Myanmar</text>
  <text x="428" y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">MMK 2012</text>

  <!-- Thailand -->
  <rect x="480" y="14" width="84" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="522" y="48" text-anchor="middle" font-size="24">🇹🇭</text>
  <text x="522" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">Thailand</text>
  <text x="522" y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">THB 1979</text>

  <!-- Bhutan -->
  <rect x="574" y="14" width="96" height="72" rx="10" fill="#111822" stroke="#FFB800" stroke-opacity="0.4" stroke-width="1"/>
  <text x="622" y="48" text-anchor="middle" font-size="24">🇧🇹</text>
  <text x="622" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#E8EBF0">Bhutan</text>
  <text x="622" y="78" text-anchor="middle" font-family="monospace" font-size="8" fill="#7A8299">BTN 2012</text>
</svg>
</div>

Legal data sourced from official motor vehicle acts and verified against 2024–2025 gazette notifications.

---

## 🚀 Quick Start

### Backend (FastAPI)

```bash
# Clone the repo
git clone https://github.com/your-org/roadsafety-ai
cd roadsafety-ai/backend

# Environment setup
cp .env.example .env         # fill in your API keys
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs  (Swagger UI)
```

### Frontend (Next.js)

```bash
cd ../frontend
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/chat` | AI chat — intent + RAG + LLM *(30 req/min)* |
| `POST` | `/challan/calculate` | DriveLegal challan calculator |
| `POST` | `/emergency/trigger` | CrashMode — dispatches SMS/WhatsApp/email |
| `POST` | `/report/submit` | RoadWatch — submit geo-tagged road issue |
| `GET` | `/map/emergency` | Nearest hospitals & trauma centres (Overpass) |
| `GET` | `/map/legal` | CCTV & speed trap locations |
| `POST` | `/ocr/scan` | Challan image OCR |
| `POST` | `/extract` | Entity extraction from natural language |
| `POST` | `/otp/send` | Send OTP via MSG91 |

---

## 🛠 Tech Stack

<div align="center">

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React 19, Framer Motion 11, Tailwind CSS, Dexie (IndexedDB), Tesseract.js |
| **Backend** | FastAPI 0.111, SQLAlchemy 2.0, uvicorn, slowapi (rate limiting), Pillow, pdfminer.six |
| **AI / ML** | sentence-transformers 2.7, PyTorch 2.3 (CPU), FAISS-cpu 1.8, BiLSTM NER, scikit-learn |
| **LLMs** | Gemini Flash (primary), Groq Llama-3.1-70B (fallback) |
| **Maps** | Leaflet.js, OpenStreetMap, Overpass API, canvas heatmap |
| **Infra** | Docker, SQLite (dev) / PostgreSQL (prod), Twilio, MSG91, SMTP |
| **PWA** | Service Worker, Web App Manifest, offline IndexedDB sync |

</div>

---

## ⚙️ Environment Variables

### Backend `.env`

```env
# Database
USE_SQLITE=true                         # Set false for PostgreSQL
DB_HOST=localhost
DB_NAME=roadsafety

# LLM (get free keys at aistudio.google.com and console.groq.com)
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
LLM_CONFIDENCE_THRESHOLD=0.65          # Below this → escalate to LLM

# Notifications
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
SMTP_HOST=smtp.gmail.com
SMTP_USER=your@email.com
NOTIFY_WEBHOOK_URL=https://your-endpoint.com/emergency

# CORS
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

```
roadsafety-FINAL/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, rate limiting
│   │   ├── routes/              # chat · challan · emergency · map · ocr · report · otp · extract
│   │   ├── services/            # drivelegal · roadsos · roadwatch · notifier · llm_reasoner
│   │   ├── models/              # bilstm · intent_classifier · entity_extractor · schemas
│   │   ├── rag/                 # embedder · retriever · seeds (FAISS index builder)
│   │   ├── geo/                 # overpass.py — nearest hospital/trauma/ambulance queries
│   │   └── utils/               # db.py · helpers.py
│   ├── data/
│   │   ├── legal/violations.json    # 3.7 MB · 154 violations · 7 nations
│   │   └── training/intents.json
│   ├── tests/                   # pytest suites for challan & entity extractor
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── chat/                # AI chat interface
│   │   ├── challan/             # DriveLegal calculator
│   │   ├── emergency/           # CrashMode + Golden Hour
│   │   ├── map/                 # 4-mode interactive map
│   │   ├── report/              # RoadWatch issue reporter
│   │   ├── scan/                # Challan OCR scanner
│   │   └── authority/           # Authority dashboard
│   ├── components/              # Shared UI components
│   ├── lib/                     # Hooks, offline classifier, Dexie schema
│   └── public/                  # PWA manifest, service worker, icons
└── DEMO_SCRIPT_V17.md           # Judge walkthrough & Q&A prep
```

---

## 📊 Impact Numbers

<div align="center">

| Stat | Value |
|------|-------|
| 🌏 Nations covered | 7 BIMSTEC |
| ⚖️ Verified violations | 154 |
| 🚗 Vehicle types | Two-wheeler · LMV · HMV · Bus |
| 🧠 AI response layers | 5 (offline → cloud) |
| 📱 Works offline | ✅ Full PWA |
| 💀 Annual road deaths (India) | ~460,000 |
| 💀 Annual road deaths (Bangladesh) | ~80,000 |

</div>

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/test_challan.py -v
pytest tests/test_entity_extractor.py -v
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

<div align="center">

**Built with ❤️ for the IIT Madras BIMSTEC Road Safety Hackathon 2026**

*Stack: Next.js 15 · FastAPI · BiLSTM · FAISS · Gemini Flash · Groq · Offline-First PWA*

</div>
