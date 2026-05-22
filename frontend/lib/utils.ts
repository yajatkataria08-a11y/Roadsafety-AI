import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function generateTicketId(): string {
  return `RW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(1)} km`
}

export function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function buildShareText(lat: number, lon: number, address?: string): string {
  const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`
  return `🚨 ROAD EMERGENCY — I need help!\n📍 ${address ?? 'My location'}\n🗺️ ${mapsUrl}`
}

export async function shareLocation(
  lat: number, lon: number, address?: string
): Promise<'native' | 'whatsapp' | 'sms' | 'clipboard'> {
  const text = buildShareText(lat, lon, address)
  const url  = `https://maps.google.com/?q=${lat},${lon}`

  if (navigator.share) {
    try { await navigator.share({ title: '🚨 Road Emergency — My Location', text, url }); return 'native' }
    catch { /* user cancelled — fall through */ }
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    return 'whatsapp'
  }

  await navigator.clipboard.writeText(text)
  return 'clipboard'
}

export const QUICK_CHIPS = [
  // DriveLegal
  { label: '🪖 Helmet Fine — Indore',       query: 'What is the fine for riding without helmet in Indore, MP?' },
  { label: '🚦 Signal Jump — MP',            query: 'What is the challan for jumping traffic signal in Madhya Pradesh?' },
  { label: '🍺 Drunk Driving Penalty',       query: 'What are the penalties for drunk driving in India?' },
  { label: '📱 Mobile While Driving',        query: 'Fine for using mobile phone while driving in India' },
  { label: '🚗 Overspeeding Challan',        query: 'What is the penalty for over-speeding on highways?' },
  { label: '⚠️ Bangladesh Traffic Rules',    query: 'What are traffic rules and fines in Bangladesh?' },
  { label: '🛵 No Insurance Fine',           query: 'What happens if caught driving without vehicle insurance?' },
  // RoadSoS
  { label: '🏥 Nearest Trauma Centre',       query: 'Find nearest trauma centre near me' },
  { label: '🚑 Ambulance Near Me',           query: 'Where is the nearest ambulance service?' },
  { label: '🚔 Nearest Police Station',      query: 'Find nearest police station near my location' },
  // RoadWatch
  { label: '🕳️ Report a Pothole',           query: 'I want to report a dangerous pothole on my road' },
  { label: '🏗️ Road Budget — Indore',       query: 'Who built Ring Road in Indore and what was the budget?' },
  { label: '💡 Broken Streetlight',          query: 'Streetlight not working near my house, how to report?' },
  // UI Features
  { label: '📷 Scan My Challan',            query: 'I want to scan my challan photo' },
  { label: '🗺️ Open AI Map',               query: 'Show me the map with blackspots and speed cameras' },
  { label: '🏛 Authority Dashboard',         query: 'Show ward-level authority complaint dashboard' },
  { label: '📊 BIMSTEC Analytics',          query: 'Show BIMSTEC road safety analytics dashboard' },
]

export const EMERGENCY_NUMBERS = {
  India:       { emergency: '112', ambulance: '108', police: '100', highway: '1033', roadAccident: '1073' },
  Bangladesh:  { emergency: '999', ambulance: '199', police: '999', highway: '16516', roadAccident: '999' },
  'Sri Lanka': { emergency: '119', ambulance: '110', police: '118', highway: '1969',  roadAccident: '119' },
  Nepal:       { emergency: '100', ambulance: '102', police: '100', highway: '103',   roadAccident: '100' },
  Myanmar:     { emergency: '199', ambulance: '192', police: '199', highway: '199',   roadAccident: '199' },
  Bhutan:      { emergency: '113', ambulance: '112', police: '113', highway: '113',   roadAccident: '113' },
  Thailand:    { emergency: '191', ambulance: '1669',police: '191', highway: '1193',  roadAccident: '1669'},
} as const

export type Country = keyof typeof EMERGENCY_NUMBERS

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
