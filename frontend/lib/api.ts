/**
 * lib/api.ts — v9
 * All external API calls: backend chat, Overpass emergency services,
 * reverse geocode (Nominatim), road type detection (Overpass), mock responses.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ServiceType = 'hospital' | 'ambulance' | 'police' | 'towing' | 'puncture_shop' | 'fuel'

// Road authority — returned with road type detection
export interface RoadAuthorityInfo {
  name: string
  helpline: string
  jurisdiction: string
}

export interface EmergencyService {
  name: string
  type: ServiceType
  lat: number
  lon: number
  distance_m: number
  phone?: string
  address?: string
  openingHours?: string
}

export interface EmergencyServicesResult {
  results: EmergencyService[]
  source: 'overpass' | 'fallback'
}

export interface ChatRequest {
  message: string
  country?: string
  lat?: number
  lon?: number
  vehicle_type?: string   // from DriveLegal vehicle selector
  session_id?: string     // persistent session ID for conversation memory
}

export interface ChatResponse {
  intent:            string
  confidence:        number
  response:          string
  source?:           string
  hierarchy?:        Record<string, unknown>
  related_questions?: string[]
  safety_tip?:       string
  llm_used?:         boolean
  entities_v11?:     Record<string, unknown>
  // v7 — deep-link for Scan / Map / Authority / Dashboard intents
  action_url?:       string
  action_label?:     string
}

// Road type from Overpass
export type RoadType = 'motorway' | 'national' | 'state' | 'primary' | 'local' | 'unknown'
export interface RoadTypeResult {
  type: RoadType
  label: string
  speedLimit?: number   // km/h, from OSM maxspeed tag if available
  ref?: string          // e.g. "NH 52"
  authority?: string    // e.g. "NHAI" / "State PWD" / "Municipal"
  helpline?: string     // authority helpline number
  lastRepaired?: string // human-readable, e.g. "March 2024" — from OSM repair_date / surface:date
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const SEARCH_RADIUS_M = 5000   // 5 km for emergency services
const ROAD_RADIUS_M   = 100    // 100 m for road type snapping

// ── Overpass: emergency services ─────────────────────────────────────────────

function buildOverpassQuery(lat: number, lon: number, radiusM = SEARCH_RADIUS_M): string {
  return `
[out:json][timeout:15];
(
  node["amenity"="hospital"](around:${radiusM},${lat},${lon});
  node["amenity"="clinic"](around:${radiusM},${lat},${lon});
  node["healthcare"="hospital"](around:${radiusM},${lat},${lon});
  node["amenity"="police"](around:${radiusM},${lat},${lon});
  node["amenity"="vehicle_repair"](around:${radiusM},${lat},${lon});
  node["shop"="tyres"](around:${radiusM},${lat},${lon});
  node["shop"="bicycle_repair"](around:${radiusM},${lat},${lon});
  node["craft"="tyre_fitting"](around:${radiusM},${lat},${lon});
  node["amenity"="breakdown_service"](around:${radiusM},${lat},${lon});
  node["service"="vehicle_breakdown"](around:${radiusM},${lat},${lon});
  node["shop"="car_repair"](around:${radiusM},${lat},${lon});
  node["amenity"="fuel"](around:${radiusM},${lat},${lon});
  node["amenity"="charging_station"](around:${radiusM},${lat},${lon});
);
out body;
`.trim()
}

function classifyService(tags: Record<string, string>): ServiceType | null {
  const a = tags.amenity ?? ''
  const s = tags.shop ?? ''
  const c = tags.craft ?? ''
  const h = tags.healthcare ?? ''
  const svc = tags.service ?? ''

  if (a === 'hospital' || a === 'clinic' || h === 'hospital') return 'hospital'
  if (a === 'police') return 'police'
  if (a === 'breakdown_service' || svc === 'vehicle_breakdown' || s === 'car_repair') return 'towing'
  if (a === 'vehicle_repair' || s === 'tyres' || s === 'bicycle_repair' || c === 'tyre_fitting') return 'puncture_shop'
  if (a === 'fuel' || a === 'charging_station') return 'fuel'
  return null
}

function distMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function syntheticAmbulance(lat: number, lon: number): EmergencyService[] {
  return [{
    name: 'Government Ambulance (108)',
    type: 'ambulance',
    lat, lon,
    distance_m: 0,
    phone: '108',
    address: 'Call 108 — nationwide dispatch',
  }]
}

export async function getEmergencyServices(lat: number, lon: number): Promise<EmergencyServicesResult> {
  const MAX_RETRIES = 3
  const BACKOFF_MS = [0, 1000, 3000]  // exponential backoff: 0s, 1s, 3s

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[attempt] ?? 3000))
      }

      const query = buildOverpassQuery(lat, lon)
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(18_000),
      })

      // Overpass returns 429 or 504 on overload — retry those
      if (res.status === 429 || res.status === 504) {
        if (attempt < MAX_RETRIES - 1) continue
        throw new Error(`Overpass HTTP ${res.status} after ${MAX_RETRIES} retries`)
      }
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)

      const json = await res.json()
      const elements: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }> = json.elements ?? []

      const services: EmergencyService[] = elements
        .filter(el => el.lat !== undefined && el.lon !== undefined)
        .flatMap(el => {
          const tags = el.tags ?? {}
          const type = classifyService(tags)
          if (!type) return []
          const distance_m = distMetres(lat, lon, el.lat!, el.lon!)
          const name =
            tags['name:en'] ?? tags.name ?? tags['name:hi'] ??
            type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
          const svc: EmergencyService = {
            name, type, lat: el.lat!, lon: el.lon!, distance_m,
            phone: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'],
            address: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || undefined,
            openingHours: tags.opening_hours,
          }
          return [svc]
        })
        .sort((a, b) => a.distance_m - b.distance_m)
        .slice(0, 20)

      const ambulance = syntheticAmbulance(lat, lon)
      const final = [...ambulance, ...services]
      return { results: final.length > 1 ? final : getFallbackServices(lat, lon), source: 'overpass' }
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) continue
      console.warn('[Overpass] All retries failed:', err)
      return { results: getFallbackServices(lat, lon), source: 'fallback' }
    }
  }

  // Should never reach here, but TypeScript needs it
  return { results: getFallbackServices(lat, lon), source: 'fallback' }
}

// Hardcoded offline contacts keyed by city bounding box [minLat, maxLat, minLon, maxLon]
const CITY_FALLBACKS: Array<{
  bounds: [number, number, number, number]
  services: Omit<EmergencyService, 'distance_m'>[]
}> = [
  {
    // Dhaka, Bangladesh  (23.65–23.90 N, 90.30–90.55 E)
    bounds: [23.65, 23.90, 90.30, 90.55],
    services: [
      { name: 'National Emergency (999)', type: 'ambulance', lat: 23.810, lon: 90.412, phone: '999', address: 'Bangladesh national emergency' },
      { name: 'Dhaka Medical College Hospital', type: 'hospital', lat: 23.726, lon: 90.397, phone: '+880-2-55165088', address: 'Bakshibazar, Dhaka' },
      { name: 'Square Hospital', type: 'hospital', lat: 23.751, lon: 90.383, phone: '+880-2-8159457', address: '18/F West Panthapath, Dhaka' },
      { name: 'Dhanmondi Police Station', type: 'police', lat: 23.744, lon: 90.373, phone: '+880-2-9664901', address: 'Road 2, Dhanmondi, Dhaka' },
      { name: 'Dhaka Traffic Control Room', type: 'police', lat: 23.728, lon: 90.408, phone: '+880-2-9559781', address: 'DMP HQ, Ramna, Dhaka' },
    ],
  },
  {
    // Colombo, Sri Lanka  (6.85–6.98 N, 79.83–79.93 E)
    bounds: [6.85, 6.98, 79.83, 79.93],
    services: [
      { name: 'Suwa Seriya Ambulance (1990)', type: 'ambulance', lat: 6.921, lon: 79.876, phone: '1990', address: 'Suwa Seriya EMS — Sri Lanka' },
      { name: 'National Hospital of Sri Lanka', type: 'hospital', lat: 6.921, lon: 79.865, phone: '+94-11-2691111', address: 'Regent St, Colombo 10' },
      { name: 'Lanka Hospitals', type: 'hospital', lat: 6.895, lon: 79.858, phone: '+94-11-5430000', address: '578 Elvitigala Mawatha, Colombo 5' },
      { name: 'Colombo Central Police', type: 'police', lat: 6.934, lon: 79.848, phone: '+94-11-2421111', address: 'Janadhipathi Mawatha, Colombo 1' },
      { name: 'Traffic Police HQ Colombo', type: 'police', lat: 6.916, lon: 79.877, phone: '+94-11-2433333', address: 'Narahenpita, Colombo 5' },
    ],
  },
  {
    // Kathmandu, Nepal  (27.65–27.75 N, 85.27–85.38 E)
    bounds: [27.65, 27.75, 85.27, 85.38],
    services: [
      { name: 'Nepal Ambulance Service (102)', type: 'ambulance', lat: 27.708, lon: 85.314, phone: '102', address: 'Nationwide — Nepal' },
      { name: 'Tribhuvan University Teaching Hospital', type: 'hospital', lat: 27.732, lon: 85.331, phone: '+977-1-4412303', address: 'Maharajgunj, Kathmandu' },
      { name: 'Kathmandu Model Hospital', type: 'hospital', lat: 27.704, lon: 85.318, phone: '+977-1-4258446', address: 'Exhibition Rd, Kathmandu' },
      { name: 'Metropolitan Police Range', type: 'police', lat: 27.709, lon: 85.319, phone: '+977-1-4226998', address: 'Hanuman Dhoka, Kathmandu' },
      { name: 'Traffic Police Office Kathmandu', type: 'police', lat: 27.714, lon: 85.321, phone: '+977-1-4220289', address: 'Kantipath, Kathmandu' },
    ],
  },
  {
    // Bangkok, Thailand  (13.65–13.85 N, 100.45–100.65 E)
    bounds: [13.65, 13.85, 100.45, 100.65],
    services: [
      { name: 'Erawan Emergency Centre (1669)', type: 'ambulance', lat: 13.752, lon: 100.494, phone: '1669', address: 'Bangkok EMS — Thailand' },
      { name: 'Siriraj Hospital', type: 'hospital', lat: 13.760, lon: 100.485, phone: '+66-2-4198000', address: '2 Wang Lang Rd, Bangkok Noi' },
      { name: 'Bumrungrad International Hospital', type: 'hospital', lat: 13.744, lon: 100.549, phone: '+66-2-0667777', address: '33 Sukhumvit 3, Wattana, Bangkok' },
      { name: 'Pathumwan Police Station', type: 'police', lat: 13.745, lon: 100.530, phone: '+66-2-2527171', address: 'Henri Dunant Rd, Pathumwan' },
      { name: 'Bangkok Traffic Police Division', type: 'police', lat: 13.754, lon: 100.501, phone: '+66-2-3540394', address: 'Ratchadamnoen Nok, Bangkok' },
    ],
  },
  {
    // Yangon, Myanmar  (16.73–16.92 N, 96.10–96.25 E)
    // Source: YCDC directory, Myanmar Red Cross, Myanmar Police Force public listings
    bounds: [16.73, 16.92, 96.10, 96.25],
    services: [
      // Hospitals — 4 entries
      { name: 'Yangon General Hospital (YGH)', type: 'hospital', lat: 16.793, lon: 96.158, phone: '+95-1-256112', address: 'Bogyoke Aung San Rd, Pabedan Tsp, Yangon' },
      { name: 'Sanpya Hospital (Emergency 24×7)', type: 'hospital', lat: 16.836, lon: 96.131, phone: '+95-1-660733', address: 'Pyay Rd, Hlaing Township, Yangon' },
      { name: 'Asia Royal Hospital', type: 'hospital', lat: 16.806, lon: 96.147, phone: '+95-1-538055', address: '14 Baho St, Sanchaung Tsp, Yangon' },
      { name: 'Parami Hospital', type: 'hospital', lat: 16.858, lon: 96.138, phone: '+95-1-650588', address: 'Parami Rd, Hlaing Tsp, Yangon' },
      // Ambulance / Emergency
      { name: 'Red Cross Ambulance (Yangon)', type: 'ambulance', lat: 16.793, lon: 96.160, phone: '+95-1-383684', address: 'Myanmar Red Cross Society, Strand Rd, Yangon' },
      // Police — 2 entries
      { name: 'Yangon City Police HQ', type: 'police', lat: 16.783, lon: 96.161, phone: '+95-1-285799', address: 'Theinbyu Rd, Botahtaung Tsp, Yangon' },
      { name: 'Pabedan Township Police Station', type: 'police', lat: 16.796, lon: 96.152, phone: '+95-1-242353', address: 'Mahabandoola Rd, Pabedan, Yangon' },
    ],
  },
  {
    // Thimphu, Bhutan  (27.42–27.50 N, 89.59–89.68 E)
    // Source: JDWNRH public directory, Royal Bhutan Police, RIGSS emergency contacts
    bounds: [27.42, 27.50, 89.59, 89.68],
    services: [
      // Hospitals — 4 entries
      { name: 'Jigme Dorji Wangchuck National Referral Hospital (JDWNRH)', type: 'hospital', lat: 27.463, lon: 89.637, phone: '+975-2-322496', address: 'Gongphel Lam, Thimphu, Bhutan' },
      { name: 'Thimphu District Hospital (TDH)', type: 'hospital', lat: 27.471, lon: 89.641, phone: '+975-2-323497', address: 'Dechencholing, Thimphu' },
      { name: 'KGUMSB Health Centre', type: 'hospital', lat: 27.460, lon: 89.643, phone: '+975-2-334425', address: 'Khesar Gyalpo University of Medical Sciences, Thimphu' },
      { name: 'Metshina BHU-II (24×7 OPD)', type: 'hospital', lat: 27.480, lon: 89.630, phone: '+975-2-341200', address: 'Chubachu, Thimphu' },
      // Ambulance
      { name: 'JDWNRH Ambulance (Emergency)', type: 'ambulance', lat: 27.463, lon: 89.637, phone: '+975-2-322496', address: 'JDWNRH Emergency Bay, Gongphel Lam, Thimphu' },
      // Police — 2 entries
      { name: 'Royal Bhutan Police — Thimphu HQ', type: 'police', lat: 27.461, lon: 89.639, phone: '+975-2-322272', address: 'Lungtenzampa, Thimphu, Bhutan' },
      { name: 'Thimphu Traffic Police (RBP)', type: 'police', lat: 27.465, lon: 89.636, phone: '+975-2-323938', address: 'Chang Lam, Thimphu — near Clock Tower' },
    ],
  },
]

export function getFallbackServices(lat: number, lon: number): EmergencyService[] {
  // Check if the user's location falls within a known city bounding box
  const cityMatch = CITY_FALLBACKS.find(
    ({ bounds: [minLat, maxLat, minLon, maxLon] }) =>
      lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
  )

  const base: Omit<EmergencyService, 'distance_m'>[] = cityMatch
    ? cityMatch.services
    : [
        // Default India fallback — national emergency numbers (no city hardcoding)
        { name: 'National Emergency (112)', type: 'ambulance', lat, lon, phone: '112', address: 'India national emergency — police, fire, ambulance' },
        { name: 'Free Ambulance (108)', type: 'ambulance', lat, lon, phone: '108', address: 'Call 108 — nationwide free ambulance dispatch' },
        { name: 'Nearest Government Hospital', type: 'hospital', lat, lon, phone: '104', address: 'Health helpline 104 — nearest public hospital referral' },
        { name: 'Nearest Private Hospital', type: 'hospital', lat, lon, phone: '112', address: 'Call 112 — operator will connect to nearest hospital' },
        { name: 'Police Control Room (100)', type: 'police', lat, lon, phone: '100', address: 'India national police helpline' },
        { name: 'Traffic Police Helpline', type: 'police', lat, lon, phone: '103', address: 'National traffic police helpline' },
        { name: 'Highway Breakdown (NHAI)', type: 'towing', lat, lon, phone: '1033', address: 'NHAI highway assistance — towing & breakdown' },
        { name: 'Road Accident Relief (IRTSA)', type: 'towing', lat, lon, phone: '9810600134', address: 'Indian Road Safety & Transport Association' },
      ]

  return base
    .map(s => ({ ...s, distance_m: distMetres(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.distance_m - b.distance_m)
}

// ── Overpass: road type detection ─────────────────────────────────────────────
// Queries the nearest highway segment to determine road type & applicable speed limits.

function buildRoadTypeQuery(lat: number, lon: number, radiusM = ROAD_RADIUS_M): string {
  return `
[out:json][timeout:8];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|service|unclassified"](around:${radiusM},${lat},${lon});
);
out tags 1;
`.trim()
}

/** Parse OSM repair/surface date tags into a human-readable month + year string. */
function parseRepairDate(tags: Record<string, string>): string | undefined {
  const raw = tags['repair_date'] ?? tags['surface:date'] ?? tags['last_resurface_date']
  if (!raw) return undefined
  // Accept ISO dates like "2024-03", "2024-03-15", or plain "2024"
  const m = raw.match(/^(\d{4})(?:-(\d{2})(?:-\d{2})?)?/)
  if (!m) return undefined
  const year = parseInt(m[1])
  const month = m[2] ? parseInt(m[2]) : undefined
  if (month) {
    const date = new Date(year, month - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return String(year)
}

const HIGHWAY_RANK: Record<string, RoadType> = {
  motorway: 'motorway',
  motorway_link: 'motorway',
  trunk: 'national',
  trunk_link: 'national',
  primary: 'national',
  primary_link: 'national',
  secondary: 'state',
  secondary_link: 'state',
  tertiary: 'primary',
  residential: 'local',
  service: 'local',
  unclassified: 'local',
}

const ROAD_LABEL: Record<RoadType, string> = {
  motorway: 'Expressway / Motorway',
  national: 'National Highway',
  state: 'State Highway',
  primary: 'Primary Road',
  local: 'Local / Urban Road',
  unknown: 'Unknown Road',
}

export async function detectRoadType(lat: number, lon: number): Promise<RoadTypeResult> {
  try {
    const query = buildRoadTypeQuery(lat, lon)
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)

    const json = await res.json()
    const ways: Array<{ tags?: Record<string, string> }> = json.elements ?? []
    if (ways.length === 0) return { type: 'unknown', label: ROAD_LABEL.unknown }

    const tags = ways[0].tags ?? {}
    const hw = tags.highway ?? ''
    const roadType: RoadType = HIGHWAY_RANK[hw] ?? 'unknown'

    // Road authority based on type
    const AUTHORITY_MAP: Record<RoadType, { authority: string; helpline: string }> = {
      motorway: { authority: 'NHAI (National Highways Authority of India)', helpline: '1033' },
      national: { authority: 'NHAI / National Highways Division', helpline: '1033' },
      state:    { authority: 'State Public Works Department (PWD)', helpline: '1800-11-6446' },
      primary:  { authority: 'District / Zila Panchayat Roads', helpline: '1800-11-8500' },
      local:    { authority: 'Urban Local Body / Municipal Corporation', helpline: '1533' },
      unknown:  { authority: 'Road Transport Authority', helpline: '1033' },
    }
    const authorityInfo = AUTHORITY_MAP[roadType]

    // Parse speed limit
    let speedLimit: number | undefined
    if (tags.maxspeed) {
      const parsed = parseInt(tags.maxspeed)
      if (!isNaN(parsed)) speedLimit = parsed
    }

    const lastRepaired = parseRepairDate(tags)

    return {
      type: roadType,
      label: ROAD_LABEL[roadType],
      speedLimit,
      ref: tags.ref,
      authority: authorityInfo.authority,
      helpline: authorityInfo.helpline,
      ...(lastRepaired ? { lastRepaired } : {}),
    }
  } catch {
    return { type: 'unknown', label: ROAD_LABEL.unknown }
  }
}

// ── Reverse geocode (Nominatim) ───────────────────────────────────────────────

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'RoadSafetyAI/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    const data = await res.json()
    const a = data.address ?? {}
    return (
      [a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.village, a.state]
        .filter(Boolean)
        .join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || 'Your location'
    )
  } catch {
    return 'Your location'
  }
}

// ── Chat API ──────────────────────────────────────────────────────────────────

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/chat/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.session_id ? { 'X-Session-ID': req.session_id } : {}),
    },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (!res.ok) throw new Error(`Chat API ${res.status}`)
  return res.json()
}

// ── Mock chat response (offline / backend down) ───────────────────────────────

export function getMockChatResponse(text: string): ChatResponse {
  const lower = text.toLowerCase()

  if (lower.includes('helmet')) {
    return {
      intent: 'DriveLegal',
      confidence: 0.94,
      response: `🪖 **No Helmet Fine — India (MV Act 2019)**\n\n| Offence | Fine |\n|---|---|\n| Riding without helmet | ₹1,000 |\n| Pillion without helmet | ₹1,000 |\n| Repeat offence | ₹2,000 |\n\n> Section 129 & 194D, Motor Vehicles (Amendment) Act 2019`,
      source: 'offline_rag',
    }
  }

  if (lower.includes('pothole') || lower.includes('road') || lower.includes('report')) {
    return {
      intent: 'RoadWatch',
      confidence: 0.89,
      response: `🕳️ **Report a Road Hazard**\n\nYou can report this issue through:\n\n• **MyGov App** or **CPGRAMS** portal\n• **State PWD** helpline\n• Share your location and I can file a report with GPS coordinates\n\nWould you like me to create a road issue report?`,
      source: 'offline_rag',
    }
  }

  if (lower.includes('hospital') || lower.includes('emergency') || lower.includes('ambulance')) {
    return {
      intent: 'RoadSoS',
      confidence: 0.97,
      response: `🚨 **Emergency Services**\n\n• **Call 112** — All emergencies\n• **Call 108** — Free ambulance\n• **Call 100** — Police\n\nTap **Emergency Mode** for real-time nearest services with GPS.`,
      source: 'offline_rag',
    }
  }

  return {
    intent: 'General',
    confidence: 0.6,
    response: `I can help with traffic fines, road issues, and emergencies. Try asking:\n\n• *"What is the fine for jumping a red light in MP?"*\n• *"Find nearest hospital to my location"*\n• *"I want to report a pothole"*`,
    source: 'offline_fallback',
  }
}

// ── Report submission ─────────────────────────────────────────────────────────

export interface ReportResponse {
  status: 'reported' | 'duplicate' | 'error'
  ticket_id: string
  message: string
  details: {
    ticket_id: string
    description: string
    category: string
    lat: number | null
    lon: number | null
    jurisdiction: {
      authority: string
      contact: string
      routed_to: string
    }
    status: string
    timestamp: string
  }
}

// ── Map API Types ─────────────────────────────────────────────────────────────

export interface MapService extends EmergencyService {
  id: string
  eta_min: number
  maps_url: string
}

export interface MapServicesResult {
  services: MapService[]
  source: 'overpass' | 'fallback'
  count: number
}

export interface MapIssue {
  id: string
  type: 'pothole' | 'road_damage' | 'bad_lighting' | 'broken_signal' | 'construction' | 'flooding' | 'missing_sign' | 'other'
  category: string
  lat: number
  lon: number
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected'
  description: string
  authority: string
  authority_contact: string
  has_image: boolean
  timestamp: string
  distance_m: number
  source: 'real' | 'demo'
}

export interface HeatmapPoint {
  lat: number
  lon: number
  weight: number
}

export interface MapIssuesResult {
  issues: MapIssue[]
  heatmap: HeatmapPoint[]
  count: number
  counts_by_type: Record<string, number>
  counts_by_status: Record<string, number>
}

export interface BlackSpot {
  id: string
  name: string
  lat: number
  lon: number
  severity: number
  description: string
  distance_m: number
  type: 'blackspot'
  alert_radius_m: number
}

export interface SpeedCamera {
  id: string
  type: 'speed' | 'helmet' | 'redlight'
  name: string
  lat: number
  lon: number
  speed_limit_kmh: number
  operator: string
  distance_m: number
  alert_radius_m: number
}

export interface ViolationZone {
  id: string
  name: string
  type: string
  lat: number
  lon: number
  radius_m: number
  description: string
  distance_m: number
  fine_inr: string
}

export interface MapHotspotsResult {
  blackspots: BlackSpot[]
  cameras: SpeedCamera[]
  violation_zones: ViolationZone[]
  heatmap: HeatmapPoint[]
  alert_radius_m: number
}

// ── Map API Functions ─────────────────────────────────────────────────────────

export async function getMapServices(
  lat: number, lon: number,
  type = 'all', radius = 5000
): Promise<MapServicesResult> {
  try {
    const params = new URLSearchParams({
      lat: String(lat), lon: String(lon), type, radius: String(radius)
    })
    const res = await fetch(`${BACKEND_URL}/map/services?${params}`, {
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) throw new Error(`Map services API ${res.status}`)
    return res.json()
  } catch {
    // Pure frontend fallback using Overpass
    const svcResult = await getEmergencyServices(lat, lon)
    const services = svcResult.results.map(s => ({
      ...s,
      id: `local-${s.name}`,
      eta_min: Math.max(1, Math.round((s.distance_m / 1000 / 40) * 60)),
      maps_url: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`,
    }))
    return { services, source: svcResult.source, count: services.length }
  }
}

export async function getMapIssues(
  lat: number, lon: number,
  radius = 10000, category = 'all', status = 'all'
): Promise<MapIssuesResult> {
  try {
    const params = new URLSearchParams({
      lat: String(lat), lon: String(lon),
      radius: String(radius), category, status,
    })
    const res = await fetch(`${BACKEND_URL}/map/issues?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Map issues API ${res.status}`)
    return res.json()
  } catch {
    return { issues: [], heatmap: [], count: 0, counts_by_type: {}, counts_by_status: {} }
  }
}

export async function getMapHotspots(
  lat: number, lon: number, radius = 15000
): Promise<MapHotspotsResult> {
  try {
    const params = new URLSearchParams({
      lat: String(lat), lon: String(lon), radius: String(radius),
    })
    const res = await fetch(`${BACKEND_URL}/map/hotspots?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Map hotspots API ${res.status}`)
    return res.json()
  } catch {
    return { blackspots: [], cameras: [], violation_zones: [], heatmap: [], alert_radius_m: 300 }
  }
}

/**
 * Submit a road issue report to the backend.
 * Falls back gracefully — the report page has its own offline mock.
 */
export async function submitReport(
  description: string,
  lat?: number,
  lon?: number,
  image?: File,
): Promise<ReportResponse> {
  const formData = new FormData()
  formData.append('description', description)
  if (lat !== undefined) formData.append('lat', String(lat))
  if (lon !== undefined) formData.append('lon', String(lon))
  if (image) formData.append('image', image)

  const res = await fetch(`${BACKEND_URL}/report/`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`Report API ${res.status}`)
  return res.json()
}
