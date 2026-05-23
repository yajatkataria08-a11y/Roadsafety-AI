<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Road Safety AI — README</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --red: #FF2D2D;
    --orange: #FF7A1A;
    --amber: #FFB800;
    --green: #00D87F;
    --teal: #00C9B1;
    --blue: #0FA8FF;
    --dark: #0A0C10;
    --surface: #111318;
    --surface2: #181C24;
    --border: rgba(255,255,255,0.08);
    --text: #E8EBF0;
    --muted: #7A8299;
    --mono: 'Space Mono', monospace;
    --sans: 'Syne', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--sans);
    background: var(--dark);
    color: var(--text);
    line-height: 1.6;
    overflow-x: hidden;
  }

  /* ── HERO ── */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px 24px;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,45,45,0.12) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 80% 80%, rgba(0,200,177,0.08) 0%, transparent 60%);
  }

  /* Animated road SVG */
  .hero-road {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    pointer-events: none;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,45,45,0.15);
    border: 1px solid rgba(255,45,45,0.3);
    border-radius: 100px;
    padding: 6px 16px;
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--red);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 28px;
    animation: fadeDown 0.6s ease both;
  }

  .badge-dot {
    width: 7px; height: 7px;
    background: var(--red);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .hero h1 {
    font-size: clamp(3rem, 8vw, 6.5rem);
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: -0.03em;
    animation: fadeDown 0.6s 0.1s ease both;
  }

  .hero h1 .accent { color: var(--red); }
  .hero h1 .sub { display: block; font-size: 0.45em; color: var(--muted); font-weight: 400; letter-spacing: 0.05em; margin-top: 8px; }

  .tagline {
    font-family: var(--mono);
    font-size: 1rem;
    color: var(--muted);
    margin-top: 20px;
    max-width: 580px;
    animation: fadeDown 0.6s 0.2s ease both;
  }

  .hero-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 32px;
    animation: fadeDown 0.6s 0.3s ease both;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 100px;
    font-size: 0.78rem;
    font-family: var(--mono);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  .pill.red { border-color: rgba(255,45,45,0.4); background: rgba(255,45,45,0.08); color: #ff7a7a; }
  .pill.green { border-color: rgba(0,216,127,0.4); background: rgba(0,216,127,0.08); color: var(--green); }
  .pill.blue { border-color: rgba(15,168,255,0.4); background: rgba(15,168,255,0.08); color: var(--blue); }
  .pill.amber { border-color: rgba(255,184,0,0.4); background: rgba(255,184,0,0.08); color: var(--amber); }
  .pill.teal { border-color: rgba(0,201,177,0.4); background: rgba(0,201,177,0.08); color: var(--teal); }

  /* ── SECTIONS ── */
  .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }

  section { padding: 80px 0; }

  .section-label {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--red);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  h2 {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 20px;
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 0;
  }

  /* ── FEATURE GRID ── */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 40px;
  }

  .feature-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s, border-color 0.2s;
  }

  .feature-card:hover { transform: translateY(-3px); }
  .feature-card.red:hover { border-color: rgba(255,45,45,0.4); }
  .feature-card.green:hover { border-color: rgba(0,216,127,0.4); }
  .feature-card.blue:hover { border-color: rgba(15,168,255,0.4); }
  .feature-card.amber:hover { border-color: rgba(255,184,0,0.4); }

  .feature-icon {
    width: 48px; height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
    font-size: 1.5rem;
  }
  .feature-card.red .feature-icon { background: rgba(255,45,45,0.15); }
  .feature-card.green .feature-icon { background: rgba(0,216,127,0.15); }
  .feature-card.blue .feature-icon { background: rgba(15,168,255,0.15); }
  .feature-card.amber .feature-icon { background: rgba(255,184,0,0.15); }

  .feature-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  .feature-card p { font-size: 0.88rem; color: var(--muted); line-height: 1.6; }

  /* ── ARCHITECTURE ── */
  .arch-svg-wrap { margin-top: 40px; }

  /* ── STACK GRID ── */
  .stack-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 36px;
  }

  .stack-col h4 {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .stack-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    font-size: 0.88rem;
    color: var(--text);
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .stack-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── INSTALL ── */
  .code-block {
    background: #0d0f14;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    font-family: var(--mono);
    font-size: 0.82rem;
    line-height: 1.8;
    margin-top: 24px;
    overflow-x: auto;
  }

  .code-block .line { display: flex; gap: 12px; }
  .code-block .prompt { color: var(--red); user-select: none; }
  .code-block .comment { color: #4a5068; }
  .code-block .cmd { color: #c8d3f5; }
  .code-block .str { color: var(--green); }

  /* ── BIMSTEC ── */
  .nations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-top: 36px;
  }

  .nation-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 12px;
    text-align: center;
    transition: transform 0.2s, border-color 0.2s;
  }
  .nation-card:hover { transform: translateY(-3px); border-color: rgba(255,184,0,0.4); }
  .nation-flag { font-size: 2rem; margin-bottom: 8px; }
  .nation-name { font-size: 0.8rem; font-weight: 700; margin-bottom: 4px; }
  .nation-curr { font-family: var(--mono); font-size: 0.7rem; color: var(--muted); }

  /* ── API TABLE ── */
  .api-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 32px;
    font-size: 0.85rem;
  }
  .api-table th {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .api-table td {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    vertical-align: top;
  }
  .api-table tr:hover td { background: rgba(255,255,255,0.02); }
  .method {
    font-family: var(--mono);
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 700;
  }
  .method.get { background: rgba(0,216,127,0.15); color: var(--green); }
  .method.post { background: rgba(15,168,255,0.15); color: var(--blue); }
  .endpoint { font-family: var(--mono); font-size: 0.82rem; color: var(--teal); }
  .ep-desc { color: var(--muted); font-size: 0.82rem; }

  /* ── STATS ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    margin-top: 36px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 28px 20px;
    text-align: center;
  }
  .stat-num {
    font-size: 2.4rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .stat-label { font-family: var(--mono); font-size: 0.72rem; color: var(--muted); margin-top: 8px; letter-spacing: 0.06em; text-transform: uppercase; }

  /* ── ANIMATIONS ── */
  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  @keyframes dash {
    to { stroke-dashoffset: -30; }
  }
  @keyframes car-move {
    from { transform: translateX(-60px); }
    to { transform: translateX(calc(100vw + 60px)); }
  }
  @keyframes siren {
    0%, 100% { fill: rgba(255,45,45,0.8); }
    50% { fill: rgba(255,45,45,0.2); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  }
  .reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── FOOTER ── */
  footer {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 40px 24px;
    text-align: center;
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--muted);
  }
  footer a { color: var(--red); text-decoration: none; }

  .section-dark { background: var(--surface); }
  .section-dark2 { background: var(--surface2); }
</style>
</head>
<body>

<!-- ═══════════════════════════ HERO ═══════════════════════════ -->
<section class="hero">
  <div class="hero-bg"></div>

  <!-- Animated Road SVG -->
  <svg class="hero-road" viewBox="0 0 1440 160" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <!-- road surface -->
    <rect y="80" width="1440" height="80" fill="#111318"/>
    <!-- center dashes animated -->
    <line x1="0" y1="120" x2="1440" y2="120" stroke="#FFB800" stroke-width="2" stroke-dasharray="40 30"
          style="animation: dash 1s linear infinite;"/>
    <!-- lane lines -->
    <line x1="0" y1="100" x2="1440" y2="100" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <line x1="0" y1="140" x2="1440" y2="140" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <!-- animated car 1 -->
    <g style="animation: car-move 5s linear infinite;">
      <rect x="0" y="88" width="44" height="22" rx="5" fill="#1A2035"/>
      <rect x="8" y="93" width="28" height="12" rx="3" fill="#2A3555"/>
      <circle cx="10" cy="110" r="5" fill="#333"/>
      <circle cx="34" cy="110" r="5" fill="#333"/>
      <rect x="42" y="95" width="4" height="6" rx="1" fill="#FF7A1A" opacity="0.9"/>
      <circle cx="2" cy="96" r="2" fill="#FFB800" opacity="0.9"/>
      <!-- siren -->
      <rect x="18" y="86" width="8" height="4" rx="1" style="animation: siren 0.6s ease-in-out infinite;"/>
    </g>
    <!-- animated car 2 (ambulance) -->
    <g style="animation: car-move 7s 1.5s linear infinite;">
      <rect x="0" y="126" width="48" height="24" rx="5" fill="#FFFFFF" opacity="0.08"/>
      <rect x="10" y="130" width="28" height="12" rx="3" fill="#FFFFFF" opacity="0.05"/>
      <circle cx="12" cy="150" r="5" fill="#222"/>
      <circle cx="36" cy="150" r="5" fill="#222"/>
      <rect x="44" y="132" width="5" height="8" rx="1" fill="#FF2D2D" opacity="0.8"/>
    </g>
  </svg>

  <div class="badge">
    <span class="badge-dot"></span>
    IIT Madras · BIMSTEC Road Safety Hackathon 2026
  </div>

  <h1>
    Road<span class="accent">Safety</span> AI
    <span class="sub">Unified Platform for Emergency · Legal · Surveillance · Governance</span>
  </h1>

  <p class="tagline">
    Covering all 7 BIMSTEC nations with offline-first AI — crash response, traffic law, road issue tracking & authority accountability in one platform.
  </p>

  <div class="hero-badges">
    <span class="pill red">🚨 Crash Mode</span>
    <span class="pill blue">⚖️ DriveLegal AI</span>
    <span class="pill green">🗺️ RoadWatch</span>
    <span class="pill amber">🏛️ Authority Mode</span>
    <span class="pill teal">📡 Offline-First PWA</span>
  </div>
</section>

<!-- ═══════════════════════════ OVERVIEW SVG ═══════════════════════════ -->
<div class="divider"></div>
<section>
  <div class="container">
    <div class="section-label">What it does</div>
    <h2>One Platform, Four Life-Saving Modes</h2>
    <p style="color:var(--muted); max-width:620px;">Road Safety AI brings together emergency response, legal compliance, civic issue reporting, and governance accountability — all in a single app that works even without internet.</p>

    <!-- Animated SVG diagram -->
    <div class="arch-svg-wrap reveal">
      <svg viewBox="0 0 880 340" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:880px;display:block;margin:0 auto;">
        <!-- Center hub -->
        <circle cx="440" cy="170" r="58" fill="#181C24" stroke="rgba(255,45,45,0.4)" stroke-width="2"/>
        <text x="440" y="163" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="800" font-size="14" fill="#E8EBF0">Road</text>
        <text x="440" y="181" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="800" font-size="14" fill="#FF2D2D">Safety AI</text>

        <!-- Connecting lines with animation -->
        <!-- RoadSoS -->
        <line x1="388" y1="130" x2="210" y2="80" stroke="rgba(255,45,45,0.3)" stroke-width="1.5" stroke-dasharray="6 4"
              style="animation: dash 1.5s linear infinite;"/>
        <!-- DriveLegal -->
        <line x1="492" y1="130" x2="670" y2="80" stroke="rgba(15,168,255,0.3)" stroke-width="1.5" stroke-dasharray="6 4"
              style="animation: dash 1.5s 0.4s linear infinite;"/>
        <!-- RoadWatch -->
        <line x1="388" y1="210" x2="210" y2="260" stroke="rgba(0,216,127,0.3)" stroke-width="1.5" stroke-dasharray="6 4"
              style="animation: dash 1.5s 0.8s linear infinite;"/>
        <!-- Authority -->
        <line x1="492" y1="210" x2="670" y2="260" stroke="rgba(255,184,0,0.3)" stroke-width="1.5" stroke-dasharray="6 4"
              style="animation: dash 1.5s 1.2s linear infinite;"/>

        <!-- RoadSoS card -->
        <rect x="70" y="38" width="180" height="82" rx="12" fill="#181C24" stroke="rgba(255,45,45,0.5)" stroke-width="1.5"/>
        <rect x="82" y="52" width="28" height="28" rx="8" fill="rgba(255,45,45,0.15)"/>
        <text x="96" y="71" text-anchor="middle" font-size="14">🚨</text>
        <text x="122" y="62" font-family="'Syne',sans-serif" font-weight="700" font-size="12" fill="#E8EBF0">RoadSoS</text>
        <text x="122" y="77" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Crash Mode · Golden Hour</text>
        <text x="122" y="91" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">112/108 dispatch · trauma map</text>
        <circle cx="232" cy="52" r="6" fill="rgba(255,45,45,0.8)" style="animation: pulse 1.2s ease-in-out infinite;"/>

        <!-- DriveLegal card -->
        <rect x="630" y="38" width="180" height="82" rx="12" fill="#181C24" stroke="rgba(15,168,255,0.5)" stroke-width="1.5"/>
        <rect x="642" y="52" width="28" height="28" rx="8" fill="rgba(15,168,255,0.15)"/>
        <text x="656" y="71" text-anchor="middle" font-size="14">⚖️</text>
        <text x="682" y="62" font-family="'Syne',sans-serif" font-weight="700" font-size="12" fill="#E8EBF0">DriveLegal</text>
        <text x="682" y="77" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">154 violations · 7 nations</text>
        <text x="682" y="91" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Challan calc · MV Act RAG</text>

        <!-- RoadWatch card -->
        <rect x="70" y="218" width="180" height="82" rx="12" fill="#181C24" stroke="rgba(0,216,127,0.5)" stroke-width="1.5"/>
        <rect x="82" y="232" width="28" height="28" rx="8" fill="rgba(0,216,127,0.15)"/>
        <text x="96" y="251" text-anchor="middle" font-size="14">🗺️</text>
        <text x="122" y="246" font-family="'Syne',sans-serif" font-weight="700" font-size="12" fill="#E8EBF0">RoadWatch</text>
        <text x="122" y="261" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Heatmap · issue reporting</text>
        <text x="122" y="275" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">OCR scan · community verify</text>

        <!-- Authority card -->
        <rect x="630" y="218" width="180" height="82" rx="12" fill="#181C24" stroke="rgba(255,184,0,0.5)" stroke-width="1.5"/>
        <rect x="642" y="232" width="28" height="28" rx="8" fill="rgba(255,184,0,0.15)"/>
        <text x="656" y="251" text-anchor="middle" font-size="14">🏛️</text>
        <text x="682" y="246" font-family="'Syne',sans-serif" font-weight="700" font-size="12" fill="#E8EBF0">Authority Mode</text>
        <text x="682" y="261" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">SLA breach · ward choropleth</text>
        <text x="682" y="275" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Budget tracking · escalation</text>

        <!-- Outer ring decoration -->
        <circle cx="440" cy="170" r="100" stroke="rgba(255,45,45,0.06)" stroke-width="60" fill="none"/>
      </svg>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ FEATURES ═══════════════════════════ -->
<div class="divider"></div>
<section class="section-dark">
  <div class="container">
    <div class="section-label">Core Features</div>
    <h2>Built for Real Emergencies</h2>

    <div class="feature-grid">
      <div class="feature-card red reveal">
        <div class="feature-icon">🚨</div>
        <h3>CrashMode™ — Golden Hour</h3>
        <p>One-tap activation starts a 60-minute countdown with offline first-aid protocols, one-tap 112/108/100 dialing, and real-time trauma center navigation with distance & ETA.</p>
      </div>
      <div class="feature-card blue reveal">
        <div class="feature-icon">⚖️</div>
        <h3>DriveLegal — BIMSTEC Challan AI</h3>
        <p>154 verified traffic violations across 7 nations. Vehicle-type-aware fine calculation, repeat-offence penalties, MV Act section citations, and Hinglish query support.</p>
      </div>
      <div class="feature-card green reveal">
        <div class="feature-icon">🗺️</div>
        <h3>RoadWatch Heatmap</h3>
        <p>Severity-weighted canvas heatmap over Leaflet tiles. 4-step issue reporting wizard with GPS tagging, photo upload, community upvoting, and SLA breach detection.</p>
      </div>
      <div class="feature-card amber reveal">
        <div class="feature-icon">🏛️</div>
        <h3>Authority Mode Dashboard</h3>
        <p>Animated choropleth ward circles showing SLA compliance, budget utilisation bars, contractor accountability tracking, and BIMSTEC cross-city comparison benchmarks.</p>
      </div>
      <div class="feature-card blue reveal">
        <div class="feature-icon">🤖</div>
        <h3>Multi-Tier AI Reasoning</h3>
        <p>Offline intent classifier → BiLSTM entity extractor → FAISS RAG retrieval → Gemini Flash / Groq LLM fallback. Zero API calls needed for basic queries.</p>
      </div>
      <div class="feature-card green reveal">
        <div class="feature-icon">📡</div>
        <h3>Offline-First PWA</h3>
        <p>Service worker caches violations DB, emergency numbers, and first-aid protocols. IndexedDB for local issue storage. Full functionality on airplane mode.</p>
      </div>
      <div class="feature-card red reveal">
        <div class="feature-icon">📷</div>
        <h3>Challan OCR Scanner</h3>
        <p>Client-side Tesseract.js + server-side pytesseract for offline challan scanning. Extracts vehicle number, violation, fine amount, and payment due date automatically.</p>
      </div>
      <div class="feature-card amber reveal">
        <div class="feature-icon">🔔</div>
        <h3>Authority Notification Engine</h3>
        <p>Multi-channel dispatch via SMS (Twilio), WhatsApp, Email (SMTP), and webhook on crash events. OTP authentication with MSG91 integration.</p>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ AI PIPELINE SVG ═══════════════════════════ -->
<div class="divider"></div>
<section>
  <div class="container">
    <div class="section-label">AI Architecture</div>
    <h2>5-Layer Intelligence Pipeline</h2>
    <p style="color:var(--muted); max-width:560px; margin-bottom:8px;">Every query flows through multiple fallback layers — fully offline at layer 1–3, cloud-augmented at layer 4–5.</p>

    <div class="arch-svg-wrap reveal">
      <svg viewBox="0 0 860 220" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:860px;display:block;margin:0 auto;">
        <!-- Layers -->
        <!-- L1 -->
        <rect x="0" y="60" width="140" height="100" rx="12" fill="#181C24" stroke="rgba(0,216,127,0.4)" stroke-width="1.5"/>
        <text x="70" y="100" text-anchor="middle" font-size="20">🟢</text>
        <text x="70" y="120" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="700" font-size="11" fill="#00D87F">Offline</text>
        <text x="70" y="135" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Keyword</text>
        <text x="70" y="148" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Classifier</text>
        <text x="70" y="44" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#4a5068">LAYER 1</text>

        <!-- arrow -->
        <path d="M143 110 L175 110" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" marker-end="url(#arrow)"/>

        <!-- L2 -->
        <rect x="178" y="60" width="140" height="100" rx="12" fill="#181C24" stroke="rgba(0,216,127,0.4)" stroke-width="1.5"/>
        <text x="248" y="100" text-anchor="middle" font-size="20">🧠</text>
        <text x="248" y="120" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="700" font-size="11" fill="#00D87F">BiLSTM</text>
        <text x="248" y="135" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Intent +</text>
        <text x="248" y="148" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Entity NER</text>
        <text x="248" y="44" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#4a5068">LAYER 2</text>

        <path d="M321 110 L353 110" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" marker-end="url(#arrow)"/>

        <!-- L3 -->
        <rect x="356" y="60" width="140" height="100" rx="12" fill="#181C24" stroke="rgba(0,201,177,0.4)" stroke-width="1.5"/>
        <text x="426" y="100" text-anchor="middle" font-size="20">🔍</text>
        <text x="426" y="120" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="700" font-size="11" fill="#00C9B1">RAG</text>
        <text x="426" y="135" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">FAISS · 154</text>
        <text x="426" y="148" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">violations DB</text>
        <text x="426" y="44" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#4a5068">LAYER 3</text>

        <path d="M499 110 L531 110" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" marker-end="url(#arrow)"/>

        <!-- L4 -->
        <rect x="534" y="60" width="140" height="100" rx="12" fill="#181C24" stroke="rgba(15,168,255,0.4)" stroke-width="1.5"/>
        <text x="604" y="100" text-anchor="middle" font-size="20">✨</text>
        <text x="604" y="120" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="700" font-size="11" fill="#0FA8FF">Gemini</text>
        <text x="604" y="135" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Flash primary</text>
        <text x="604" y="148" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">LLM layer</text>
        <text x="604" y="44" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#4a5068">LAYER 4</text>

        <path d="M677 110 L709 110" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" marker-end="url(#arrow)"/>

        <!-- L5 -->
        <rect x="712" y="60" width="140" height="100" rx="12" fill="#181C24" stroke="rgba(255,122,26,0.4)" stroke-width="1.5"/>
        <text x="782" y="100" text-anchor="middle" font-size="20">🦙</text>
        <text x="782" y="120" text-anchor="middle" font-family="'Syne',sans-serif" font-weight="700" font-size="11" fill="#FF7A1A">Groq</text>
        <text x="782" y="135" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">Llama-3.1-70B</text>
        <text x="782" y="148" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#7A8299">fallback LLM</text>
        <text x="782" y="44" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#4a5068">LAYER 5</text>

        <!-- offline badge -->
        <rect x="0" y="175" width="318" height="26" rx="6" fill="rgba(0,216,127,0.08)" stroke="rgba(0,216,127,0.2)" stroke-width="1"/>
        <text x="159" y="192" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#00D87F">✓ WORKS FULLY OFFLINE</text>

        <!-- cloud badge -->
        <rect x="534" y="175" width="318" height="26" rx="6" fill="rgba(15,168,255,0.08)" stroke="rgba(15,168,255,0.2)" stroke-width="1"/>
        <text x="693" y="192" text-anchor="middle" font-family="'Space Mono',monospace" font-size="9" fill="#0FA8FF">CLOUD-AUGMENTED (optional)</text>

        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.2)"/>
          </marker>
        </defs>
      </svg>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ BIMSTEC ═══════════════════════════ -->
<div class="divider"></div>
<section class="section-dark">
  <div class="container">
    <div class="section-label">Coverage</div>
    <h2>All 7 BIMSTEC Nations</h2>
    <p style="color:var(--muted); max-width:560px;">Legal violations, emergency numbers, and road safety data verified against official motor vehicle acts and 2024–2025 gazette notifications.</p>

    <div class="nations-grid reveal">
      <div class="nation-card">
        <div class="nation-flag">🇮🇳</div>
        <div class="nation-name">India</div>
        <div class="nation-curr">₹ INR · MV Act 2019</div>
      </div>
      <div class="nation-card">
        <div class="nation-flag">🇧🇩</div>
        <div class="nation-name">Bangladesh</div>
        <div class="nation-curr">BDT · MV Ord. 1983</div>
      </div>
      <div class="nation-card">
        <div class="nation-flag">🇳🇵</div>
        <div class="nation-name">Nepal</div>
        <div class="nation-curr">NPR · MVA 2049</div>
      </div>
      <div class="nation-card">
        <div class="nation-flag">🇱🇰</div>
        <div class="nation-name">Sri Lanka</div>
        <div class="nation-curr">LKR · MVA 37/1951</div>
      </div>
      <div class="nation-card">
        <div class="nation-flag">🇲🇲</div>
        <div class="nation-name">Myanmar</div>
        <div class="nation-curr">MMK · RTL 2012</div>
      </div>
      <div class="nation-card">
        <div class="nation-flag">🇹🇭</div>
        <div class="nation-name">Thailand</div>
        <div class="nation-curr">THB · LTA 1979</div>
      </div>
      <div class="nation-card">
        <div class="nation-flag">🇧🇹</div>
        <div class="nation-name">Bhutan</div>
        <div class="nation-curr">BTN · RSA 2012</div>
      </div>
    </div>

    <div class="stats-row reveal" style="margin-top:40px;">
      <div class="stat-card">
        <div class="stat-num" style="color:var(--red);">460K</div>
        <div class="stat-label">Road Deaths / yr · India</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:var(--amber);">154</div>
        <div class="stat-label">Verified Violations</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:var(--green);">7</div>
        <div class="stat-label">BIMSTEC Nations</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:var(--blue);">4</div>
        <div class="stat-label">Platform Modes</div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ TECH STACK ═══════════════════════════ -->
<div class="divider"></div>
<section>
  <div class="container">
    <div class="section-label">Tech Stack</div>
    <h2>What Powers It</h2>

    <div class="stack-grid reveal">
      <div class="stack-col">
        <h4>Frontend</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#0FA8FF;"></span>Next.js 15 (App Router)</div>
        <div class="stack-item"><span class="stack-dot" style="background:#61DAFB;"></span>React 19</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FFB800;"></span>Framer Motion 11</div>
        <div class="stack-item"><span class="stack-dot" style="background:#06B6D4;"></span>Tailwind CSS</div>
        <div class="stack-item"><span class="stack-dot" style="background:#00D87F;"></span>Dexie (IndexedDB)</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF7A1A;"></span>Xenova Transformers</div>
        <div class="stack-item"><span class="stack-dot" style="background:#7A8299;"></span>Tesseract.js OCR</div>
      </div>
      <div class="stack-col">
        <h4>Backend</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#00C9B1;"></span>FastAPI 0.111</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FFB800;"></span>SQLAlchemy 2.0</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF2D2D;"></span>slowapi rate limiting</div>
        <div class="stack-item"><span class="stack-dot" style="background:#0FA8FF;"></span>uvicorn ASGI</div>
        <div class="stack-item"><span class="stack-dot" style="background:#7A8299;"></span>pytesseract OCR</div>
        <div class="stack-item"><span class="stack-dot" style="background:#00D87F;"></span>Pillow imaging</div>
        <div class="stack-item"><span class="stack-dot" style="background:#61DAFB;"></span>pdfminer.six</div>
      </div>
      <div class="stack-col">
        <h4>AI / ML</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#FFB800;"></span>sentence-transformers 2.7</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF7A1A;"></span>PyTorch 2.3 (CPU)</div>
        <div class="stack-item"><span class="stack-dot" style="background:#00C9B1;"></span>FAISS-cpu 1.8</div>
        <div class="stack-item"><span class="stack-dot" style="background:#0FA8FF;"></span>Gemini Flash (primary)</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF2D2D;"></span>Groq Llama-3.1-70B</div>
        <div class="stack-item"><span class="stack-dot" style="background:#00D87F;"></span>scikit-learn</div>
        <div class="stack-item"><span class="stack-dot" style="background:#7A8299;"></span>BiLSTM entity NER</div>
      </div>
      <div class="stack-col">
        <h4>Infrastructure</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#0FA8FF;"></span>Docker (multi-stage)</div>
        <div class="stack-item"><span class="stack-dot" style="background:#00D87F;"></span>SQLite (dev) / PG (prod)</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FFB800;"></span>Twilio SMS / WhatsApp</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF7A1A;"></span>MSG91 OTP</div>
        <div class="stack-item"><span class="stack-dot" style="background:#00C9B1;"></span>OpenStreetMap / Overpass</div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF2D2D;"></span>Leaflet + canvas heatmap</div>
        <div class="stack-item"><span class="stack-dot" style="background:#7A8299;"></span>PWA Service Worker</div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ SETUP ═══════════════════════════ -->
<div class="divider"></div>
<section class="section-dark2">
  <div class="container">
    <div class="section-label">Quick Start</div>
    <h2>Get Running in 5 Minutes</h2>

    <!-- Backend -->
    <p style="color:var(--muted); margin-bottom:4px; font-weight:700;">Backend (FastAPI)</p>
    <div class="code-block reveal">
      <div class="line"><span class="comment"># Clone & enter project</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">git clone https://github.com/your-org/roadsafety-ai && cd roadsafety-ai/backend</span></div>
      <div class="line" style="margin-top:8px;"><span class="comment"># Set up environment</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">cp .env.example .env</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">python -m venv venv && source venv/bin/activate</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">pip install -r requirements.txt</span></div>
      <div class="line" style="margin-top:8px;"><span class="comment"># Run the API server</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">uvicorn app.main:app --reload --port <span class="str">8000</span></span></div>
    </div>

    <!-- Frontend -->
    <p style="color:var(--muted); margin-top:32px; margin-bottom:4px; font-weight:700;">Frontend (Next.js)</p>
    <div class="code-block reveal">
      <div class="line"><span class="prompt">$</span><span class="cmd">cd ../frontend</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">cp .env.example .env.local</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">npm install</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">npm run dev</span></div>
      <div class="line" style="margin-top:8px;"><span class="comment"># Open http://localhost:3000</span></div>
    </div>

    <!-- Docker -->
    <p style="color:var(--muted); margin-top:32px; margin-bottom:4px; font-weight:700;">Or with Docker</p>
    <div class="code-block reveal">
      <div class="line"><span class="prompt">$</span><span class="cmd">docker build -t roadsafety-api ./backend</span></div>
      <div class="line"><span class="prompt">$</span><span class="cmd">docker run -p <span class="str">8000</span>:<span class="str">8000</span> --env-file .env roadsafety-api</span></div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ API REFERENCE ═══════════════════════════ -->
<div class="divider"></div>
<section>
  <div class="container">
    <div class="section-label">API Reference</div>
    <h2>REST Endpoints</h2>
    <p style="color:var(--muted);">Base URL: <code style="font-family:var(--mono);color:var(--teal);">http://localhost:8000</code> — Swagger UI at <code style="font-family:var(--mono);color:var(--teal);">/docs</code></p>

    <table class="api-table reveal">
      <thead>
        <tr>
          <th>Method</th>
          <th>Endpoint</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="method get">GET</span></td>
          <td class="endpoint">/</td>
          <td class="ep-desc">Health check — returns API status</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/chat</td>
          <td class="ep-desc">AI chat — intent classification + RAG + LLM reasoning (30 req/min)</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/challan/calculate</td>
          <td class="ep-desc">DriveLegal challan calculator — geo-fenced violation lookup</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/emergency/trigger</td>
          <td class="ep-desc">RoadSoS — dispatches SMS/WhatsApp/email to authorities</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/report/submit</td>
          <td class="ep-desc">RoadWatch — submit geo-tagged road issue with photo</td>
        </tr>
        <tr>
          <td><span class="method get">GET</span></td>
          <td class="endpoint">/map/emergency</td>
          <td class="ep-desc">Nearest hospitals, trauma centres & ambulance stations via Overpass</td>
        </tr>
        <tr>
          <td><span class="method get">GET</span></td>
          <td class="endpoint">/map/legal</td>
          <td class="ep-desc">CCTV camera & speed trap locations (geo-fenced)</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/ocr/scan</td>
          <td class="ep-desc">Challan image OCR — extracts vehicle no., violation & fine</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/extract</td>
          <td class="ep-desc">Entity extraction — location, vehicle, violation from natural language</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="endpoint">/otp/send</td>
          <td class="ep-desc">Send OTP via MSG91 for user authentication</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<!-- ═══════════════════════════ ENV CONFIG ═══════════════════════════ -->
<div class="divider"></div>
<section class="section-dark">
  <div class="container">
    <div class="section-label">Configuration</div>
    <h2>Key Environment Variables</h2>

    <div class="stack-grid reveal">
      <div class="stack-col">
        <h4>Database</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#00D87F;"></span><code style="font-family:var(--mono);font-size:0.78rem;">USE_SQLITE</code> — true / false</div>
        <div class="stack-item"><span class="stack-dot" style="background:#7A8299;"></span><code style="font-family:var(--mono);font-size:0.78rem;">DB_HOST / DB_NAME</code></div>
      </div>
      <div class="stack-col">
        <h4>LLM Keys</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#FFB800;"></span><code style="font-family:var(--mono);font-size:0.78rem;">GEMINI_API_KEY</code></div>
        <div class="stack-item"><span class="stack-dot" style="background:#FF7A1A;"></span><code style="font-family:var(--mono);font-size:0.78rem;">GROQ_API_KEY</code></div>
        <div class="stack-item"><span class="stack-dot" style="background:#7A8299;"></span><code style="font-family:var(--mono);font-size:0.78rem;">LLM_CONFIDENCE_THRESHOLD</code></div>
      </div>
      <div class="stack-col">
        <h4>Notifications</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#FF2D2D;"></span><code style="font-family:var(--mono);font-size:0.78rem;">TWILIO_ACCOUNT_SID</code></div>
        <div class="stack-item"><span class="stack-dot" style="background:#0FA8FF;"></span><code style="font-family:var(--mono);font-size:0.78rem;">SMTP_HOST / SMTP_USER</code></div>
        <div class="stack-item"><span class="stack-dot" style="background:#00C9B1;"></span><code style="font-family:var(--mono);font-size:0.78rem;">NOTIFY_WEBHOOK_URL</code></div>
      </div>
      <div class="stack-col">
        <h4>OAuth (Frontend)</h4>
        <div class="stack-item"><span class="stack-dot" style="background:#4285F4;"></span><code style="font-family:var(--mono);font-size:0.78rem;">GOOGLE_CLIENT_ID</code></div>
        <div class="stack-item"><span class="stack-dot" style="background:#0077B5;"></span><code style="font-family:var(--mono);font-size:0.78rem;">LINKEDIN_CLIENT_ID</code></div>
        <div class="stack-item"><span class="stack-dot" style="background:#333;"></span><code style="font-family:var(--mono);font-size:0.78rem;">GITHUB_CLIENT_ID</code></div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ PROJECT STRUCTURE SVG ═══════════════════════════ -->
<div class="divider"></div>
<section>
  <div class="container">
    <div class="section-label">Project Layout</div>
    <h2>Repository Structure</h2>
    <div class="code-block reveal" style="font-size:0.78rem;">
      <div class="line"><span class="str">roadsafety-FINAL/</span></div>
      <div class="line"><span class="comment">├── backend/                     # FastAPI Python server</span></div>
      <div class="line"><span class="comment">│   ├── app/</span></div>
      <div class="line"><span class="comment">│   │   ├── main.py              # App entry, CORS, rate limiting</span></div>
      <div class="line"><span class="comment">│   │   ├── routes/              # chat, challan, emergency, map, ocr, report, otp</span></div>
      <div class="line"><span class="comment">│   │   ├── services/            # drivelegal, roadsos, roadwatch, notifier, llm_reasoner</span></div>
      <div class="line"><span class="comment">│   │   ├── models/              # bilstm, intent_classifier, entity_extractor, schemas</span></div>
      <div class="line"><span class="comment">│   │   ├── rag/                 # embedder, retriever, seeds</span></div>
      <div class="line"><span class="comment">│   │   ├── geo/                 # overpass.py (OSM nearest-service queries)</span></div>
      <div class="line"><span class="comment">│   │   └── utils/               # db.py, helpers.py</span></div>
      <div class="line"><span class="comment">│   ├── data/</span></div>
      <div class="line"><span class="comment">│   │   ├── legal/violations.json    # 3.7 MB · 154 violations · 7 nations</span></div>
      <div class="line"><span class="comment">│   │   └── training/intents.json</span></div>
      <div class="line"><span class="comment">│   ├── tests/                   # pytest test suites</span></div>
      <div class="line"><span class="comment">│   ├── Dockerfile</span></div>
      <div class="line"><span class="comment">│   └── requirements.txt</span></div>
      <div class="line"><span class="comment">├── frontend/                    # Next.js 15 app</span></div>
      <div class="line"><span class="comment">│   ├── app/                     # App Router pages: chat, challan, emergency, map, report…</span></div>
      <div class="line"><span class="comment">│   ├── components/              # Shared UI components</span></div>
      <div class="line"><span class="comment">│   ├── lib/                     # Hooks, utils, offline classifier</span></div>
      <div class="line"><span class="comment">│   └── public/                  # PWA manifest, icons, service worker</span></div>
      <div class="line"><span class="comment">└── DEMO_SCRIPT_V17.md           # Judge walkthrough & Q&A prep</span></div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════ FOOTER ═══════════════════════════ -->
<div class="divider"></div>
<footer>
  <div style="margin-bottom:12px; font-size:1rem; font-weight:700; font-family:var(--sans); color:var(--text);">
    🚦 Road Safety AI
  </div>
  <p>Built for the <strong>IIT Madras Road Safety Hackathon 2026 — BIMSTEC Edition</strong></p>
  <p style="margin-top:8px;">Stack: Next.js 15 · FastAPI · BiLSTM · FAISS · Gemini · Groq · Offline-First PWA</p>
  <p style="margin-top:12px; color:#4a5068;">
    Licensed under MIT · Violations data sourced from official motor vehicle acts
  </p>
</footer>

<script>
  // Intersection observer for reveal animations
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 60);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  reveals.forEach(r => observer.observe(r));
</script>
</body>
</html>
