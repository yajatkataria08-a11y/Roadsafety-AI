/**
 * lib/db.ts — Road Safety AI IndexedDB layer (Dexie.js)
 * ═══════════════════════════════════════════════════════════════════
 * Stores:
 *   violations       — cached violations.json records (2366 entries, ~3 MB raw)
 *   emergencyContacts — BIMSTEC country emergency numbers + crowdsourced puncture shops
 *   chatHistory       — local chat sessions for history page
 *   pendingReports    — queued road-issue reports for background sync
 *   intentEmbeddings  — precomputed MiniLM embeddings for offline classifier
 *   settings          — user preferences (country, notifications, etc.)
 * ═══════════════════════════════════════════════════════════════════
 */

import Dexie, { type Table } from 'dexie';

// ── Schema types ───────────────────────────────────────────────────────────────

export interface ViolationRecord {
  id?: number;
  violation_code: string;
  violation_name: string;
  mv_act_section: string;
  category: string;            // speeding | drunk_driving | helmetless | …
  base_fine_inr: number;
  enhanced_fine_inr: number;   // repeat offence
  imprisonment?: string | null;
  vehicle_types: string[];     // all | two_wheeler | lmv | hmv | bus | auto
  country: string;
  state?: string | null;
  keywords: string[];          // for offline keyword search
  raw: Record<string, unknown>; // full original object
}

export interface EmergencyContact {
  id?: number;
  country: string;
  city?: string | null;
  name: string;
  type: 'emergency' | 'ambulance' | 'police' | 'fire' | 'puncture' | 'towing' | 'hospital';
  phone: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  isOfficial: boolean;         // false = crowdsourced
  lastVerified: number;        // unix timestamp
}

export interface ChatSession {
  id?: number;
  sessionId: string;
  title: string;               // auto-generated from first message
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  country?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  confidence?: number;
  source?: string;
  timestamp: number;
  isOffline?: boolean;
}

export interface PendingReport {
  id?: number;
  ticketId: string;
  description: string;
  category: string;
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  createdAt: number;
  retries: number;
  lastAttempt?: number | null;
  status: 'pending' | 'syncing' | 'failed';
}

export interface IntentEmbedding {
  id?: number;
  intent: string;             // DriveLegal | RoadSoS | RoadWatch | Emergency
  text: string;               // prototype sentence
  embedding: number[];        // 384-dim MiniLM vector
}

export interface UserSetting {
  key: string;                // primary key
  value: unknown;
}

// ── v21 additions ─────────────────────────────────────────────────────────────

export interface ChallanRecord {
  id?:          number;
  violation:    string;
  country:      string;
  vehicle_type: string;
  fine:         number;
  currency:     string;
  law_section:  string;
  payment_url?: string | null;
  timestamp:    number;
}

export interface UserEmergencyContact {
  id?:       number;
  name:      string;
  phone:     string;
  createdAt: number;
}

// ── Database class ────────────────────────────────────────────────────────────

class RoadSafetyDatabase extends Dexie {
  violations!:            Table<ViolationRecord,      number>;
  emergencyContacts!:     Table<EmergencyContact,     number>;
  chatSessions!:          Table<ChatSession,          number>;
  pendingReports!:        Table<PendingReport,        number>;
  intentEmbeddings!:      Table<IntentEmbedding,      number>;
  settings!:              Table<UserSetting,          string>;
  challanHistory!:        Table<ChallanRecord,        number>;
  userEmergencyContacts!: Table<UserEmergencyContact, number>;

  constructor() {
    super('RoadSafetyAI');

    this.version(2).stores({
      violations:       '++id, violation_code, category, country, state, *vehicle_types, *keywords',
      emergencyContacts:'++id, country, city, type, isOfficial',
      chatSessions:     '++id, sessionId, createdAt, updatedAt',
      pendingReports:   '++id, ticketId, status, createdAt',
      intentEmbeddings: '++id, intent',
      settings:         'key',
    });

    // v21 — new tables; Dexie migrates existing data automatically
    this.version(3).stores({
      violations:            '++id, violation_code, category, country, state, *vehicle_types, *keywords',
      emergencyContacts:     '++id, country, city, type, isOfficial',
      chatSessions:          '++id, sessionId, createdAt, updatedAt',
      pendingReports:        '++id, ticketId, status, createdAt',
      intentEmbeddings:      '++id, intent',
      settings:              'key',
      challanHistory:        '++id, violation, country, vehicle_type, timestamp',
      userEmergencyContacts: '++id, createdAt',
    });
  }
}

// Singleton
export const db = new RoadSafetyDatabase();

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATIONS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Seed violations from violations.json (run once on first launch) */
export async function seedViolationsIfEmpty(): Promise<void> {
  const count = await db.violations.count();
  if (count > 0) return; // already seeded

  console.log('[DB] Seeding violations from /violations.json …');
  try {
    const res = await fetch('/violations.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: unknown[] = await res.json();

    const records: ViolationRecord[] = raw.map((v: any) => ({
      violation_code:      v.violation_code   ?? v.code ?? '',
      violation_name:      v.violation_name   ?? v.name ?? v.title ?? '',
      mv_act_section:      v.mv_act_section   ?? v.section ?? '',
      category:            v.category         ?? 'other',
      base_fine_inr:       Number(v.base_fine_inr ?? v.fine ?? v.penalty ?? 0),
      enhanced_fine_inr:   Number(v.enhanced_fine_inr ?? v.repeat_fine ?? 0),
      imprisonment:        v.imprisonment     ?? null,
      vehicle_types:       Array.isArray(v.vehicle_types) ? v.vehicle_types : ['all'],
      country:             v.country          ?? 'India',
      state:               v.state            ?? null,
      keywords:            buildKeywords(v),
      raw:                 v,
    }));

    // Bulk insert in chunks to avoid UI jank on main thread
    const CHUNK = 200;
    for (let i = 0; i < records.length; i += CHUNK) {
      await db.violations.bulkAdd(records.slice(i, i + CHUNK));
    }
    console.log(`[DB] Seeded ${records.length} violations ✓`);
  } catch (err) {
    console.error('[DB] Failed to seed violations:', err);
  }
}

function buildKeywords(v: any): string[] {
  const words = new Set<string>();
  const addWords = (str: string) => {
    if (!str) return;
    str.toLowerCase().split(/[\s,;|\/\-]+/).forEach((w) => {
      if (w.length > 2) words.add(w);
    });
  };
  addWords(v.violation_name ?? '');
  addWords(v.category ?? '');
  addWords(v.mv_act_section ?? '');
  if (Array.isArray(v.keywords)) v.keywords.forEach(addWords);
  return [...words];
}

/** Search violations offline */
export async function searchViolations(query: string, options?: {
  country?: string;
  vehicleType?: string;
  limit?: number;
}): Promise<ViolationRecord[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const limit = options?.limit ?? 10;

  let col = db.violations.toCollection();

  if (options?.country) {
    col = db.violations.where("country").equals(options.country) as unknown as typeof col;
  }

  return col
    .filter((v) => {
      const matchesKeyword = terms.some((t) =>
        v.keywords.some((k) => k.includes(t)) ||
        v.violation_name.toLowerCase().includes(t)
      );
      const matchesVehicle =
        !options?.vehicleType ||
        v.vehicle_types.includes('all') ||
        v.vehicle_types.includes(options.vehicleType);
      return matchesKeyword && matchesVehicle;
    })
    .limit(limit)
    .toArray();
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY CONTACTS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Seed hardcoded BIMSTEC emergency contacts */
export async function seedEmergencyContactsIfEmpty(): Promise<void> {
  const count = await db.emergencyContacts.count();
  if (count > 0) return;

  const contacts: Omit<EmergencyContact, 'id'>[] = [
    // ── India ──
    { country: 'India', name: 'National Emergency',     type: 'emergency', phone: '112',           isOfficial: true,  lastVerified: Date.now() },
    { country: 'India', name: 'Ambulance (CATS)',        type: 'ambulance', phone: '108',           isOfficial: true,  lastVerified: Date.now() },
    { country: 'India', name: 'Police',                  type: 'police',    phone: '100',           isOfficial: true,  lastVerified: Date.now() },
    { country: 'India', name: 'Fire',                    type: 'fire',      phone: '101',           isOfficial: true,  lastVerified: Date.now() },
    { country: 'India', name: 'Women Helpline',          type: 'emergency', phone: '1091',          isOfficial: true,  lastVerified: Date.now() },
    { country: 'India', name: 'Road Accident Emergency', type: 'ambulance', phone: '1073',          isOfficial: true,  lastVerified: Date.now() },
    // ── India / Indore ──
    { country: 'India', city: 'Indore', name: 'Bombay Hospital',        type: 'hospital',  phone: '0731-4077000', isOfficial: true, lastVerified: Date.now(), lat: 22.725, lon: 75.861 },
    { country: 'India', city: 'Indore', name: 'Choithram Hospital',     type: 'hospital',  phone: '0731-4201000', isOfficial: true, lastVerified: Date.now(), lat: 22.731, lon: 75.872 },
    { country: 'India', city: 'Indore', name: 'Traffic Control Room',   type: 'police',    phone: '0731-2525526', isOfficial: true, lastVerified: Date.now(), lat: 22.719, lon: 75.859 },
    { country: 'India', city: 'Indore', name: 'Tyre Repair — AB Road',  type: 'puncture',  phone: '+91-9876543210', isOfficial: false, lastVerified: Date.now(), address: 'Near Vijay Nagar Sq, AB Rd' },
    // ── Bangladesh ──
    { country: 'Bangladesh', name: 'National Emergency', type: 'emergency', phone: '999',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Bangladesh', name: 'Ambulance',          type: 'ambulance', phone: '199',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Bangladesh', name: 'Police',             type: 'police',    phone: '999',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Bangladesh', name: 'Fire',               type: 'fire',      phone: '199',  isOfficial: true, lastVerified: Date.now() },
    // ── Nepal ──
    { country: 'Nepal',      name: 'Emergency',          type: 'emergency', phone: '100',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Nepal',      name: 'Ambulance',          type: 'ambulance', phone: '102',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Nepal',      name: 'Police',             type: 'police',    phone: '100',  isOfficial: true, lastVerified: Date.now() },
    // ── Sri Lanka ──
    { country: 'Sri Lanka',  name: 'Emergency',          type: 'emergency', phone: '119',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Sri Lanka',  name: 'Ambulance',          type: 'ambulance', phone: '110',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Sri Lanka',  name: 'Police',             type: 'police',    phone: '118',  isOfficial: true, lastVerified: Date.now() },
    // ── Myanmar ──
    { country: 'Myanmar',    name: 'Emergency',          type: 'emergency', phone: '199',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Myanmar',    name: 'Ambulance',          type: 'ambulance', phone: '192',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Myanmar',    name: 'Police',             type: 'police',    phone: '199',  isOfficial: true, lastVerified: Date.now() },
    // ── Bhutan ──
    { country: 'Bhutan',     name: 'Emergency',          type: 'emergency', phone: '113',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Bhutan',     name: 'Ambulance',          type: 'ambulance', phone: '112',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Bhutan',     name: 'Police',             type: 'police',    phone: '113',  isOfficial: true, lastVerified: Date.now() },
    // ── Thailand ──
    { country: 'Thailand',   name: 'Emergency',          type: 'emergency', phone: '191',  isOfficial: true, lastVerified: Date.now() },
    { country: 'Thailand',   name: 'Ambulance',          type: 'ambulance', phone: '1669', isOfficial: true, lastVerified: Date.now() },
    { country: 'Thailand',   name: 'Police',             type: 'police',    phone: '191',  isOfficial: true, lastVerified: Date.now() },
  ];

  await db.emergencyContacts.bulkAdd(contacts as EmergencyContact[]);
  console.log(`[DB] Seeded ${contacts.length} emergency contacts ✓`);
}

export async function getEmergencyContactsByCountry(country: string): Promise<EmergencyContact[]> {
  return db.emergencyContacts
    .where('country')
    .equals(country)
    .sortBy('isOfficial');
}

export async function addCrowdsourcedContact(contact: Omit<EmergencyContact, 'id'>): Promise<number> {
  return db.emergencyContacts.add({ ...contact, isOfficial: false, lastVerified: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT HISTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveChat(session: ChatSession): Promise<number> {
  if (session.id) {
    await db.chatSessions.put(session);
    return session.id;
  }
  return db.chatSessions.add({ ...session, updatedAt: Date.now() });
}

export async function getAllChats(limit = 50): Promise<ChatSession[]> {
  return db.chatSessions.orderBy('updatedAt').reverse().limit(limit).toArray();
}

export async function deleteChat(id: number): Promise<void> {
  return db.chatSessions.delete(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// PENDING REPORTS HELPERS (Background Sync)
// ─────────────────────────────────────────────────────────────────────────────

export async function queueReport(report: Omit<PendingReport, 'id' | 'retries' | 'status'>): Promise<number> {
  return db.pendingReports.add({ ...report, retries: 0, status: 'pending', lastAttempt: null });
}

export async function getPendingReports(): Promise<PendingReport[]> {
  return db.pendingReports.where('status').anyOf(['pending', 'failed']).toArray();
}

export async function markReportSynced(id: number): Promise<void> {
  await db.pendingReports.delete(id);
}

export async function markReportFailed(id: number): Promise<void> {
  const report = await db.pendingReports.get(id);
  if (!report) return;
  await db.pendingReports.update(id, {
    status: report.retries >= 3 ? 'failed' : 'pending',
    retries: report.retries + 1,
    lastAttempt: Date.now(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT EMBEDDINGS HELPERS (for offline classifier)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveEmbeddings(embeddings: Omit<IntentEmbedding, 'id'>[]): Promise<void> {
  await db.intentEmbeddings.clear();
  await db.intentEmbeddings.bulkAdd(embeddings as IntentEmbedding[]);
  console.log(`[DB] Saved ${embeddings.length} intent embeddings ✓`);
}

export async function getEmbeddingsByIntent(intent: string): Promise<IntentEmbedding[]> {
  return db.intentEmbeddings.where('intent').equals(intent).toArray();
}

export async function getAllEmbeddings(): Promise<IntentEmbedding[]> {
  return db.intentEmbeddings.toArray();
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const record = await db.settings.get(key);
  return (record?.value as T) ?? defaultValue;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — call once on app boot
// ─────────────────────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  try {
    await Promise.all([
      seedViolationsIfEmpty(),
      seedEmergencyContactsIfEmpty(),
    ]);
  } catch (err) {
    console.error('[DB] Init failed (non-fatal):', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLAN HISTORY HELPERS  (v21)
// ─────────────────────────────────────────────────────────────────────────────

export async function addChallanRecord(record: Omit<ChallanRecord, 'id'>): Promise<void> {
  await db.challanHistory.add({ ...record, timestamp: record.timestamp ?? Date.now() });
}

export async function getChallanHistory(): Promise<ChallanRecord[]> {
  return db.challanHistory.orderBy('timestamp').reverse().limit(50).toArray();
}

export async function clearChallanHistory(): Promise<void> {
  await db.challanHistory.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// USER EMERGENCY CONTACTS HELPERS  (v21)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserEmergencyContacts(): Promise<UserEmergencyContact[]> {
  return db.userEmergencyContacts.orderBy('createdAt').toArray();
}

export async function saveUserEmergencyContact(
  contact: Omit<UserEmergencyContact, 'id' | 'createdAt'>
): Promise<number> {
  const existing = await db.userEmergencyContacts.count();
  if (existing >= 3) throw new Error('Maximum 3 emergency contacts allowed.');
  return db.userEmergencyContacts.add({ ...contact, createdAt: Date.now() });
}

export async function deleteUserEmergencyContact(id: number): Promise<void> {
  await db.userEmergencyContacts.delete(id);
}
