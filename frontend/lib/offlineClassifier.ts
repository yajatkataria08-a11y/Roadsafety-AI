/**
 * lib/offlineClassifier.ts — Client-side Intent Classifier
 * ═══════════════════════════════════════════════════════════════════════
 * Mirrors the Python backend strategy exactly (intent_classifier.py v4):
 *
 *  Tier 1 (preferred)  — all-MiniLM-L6-v2 via @xenova/transformers
 *                         ONNX model runs locally in the browser/worker
 *                         Cosine similarity against stored prototype embeddings
 *
 *  Tier 2 (fallback)   — Pure keyword matching (always works, zero deps)
 *
 * The model is loaded lazily (first classify call) and cached in memory.
 * Embeddings are precomputed once and stored in IndexedDB (lib/db.ts).
 *
 * Usage:
 *   const result = await classifyIntent("fine for no helmet in Indore");
 *   // → { intent: "DriveLegal", confidence: 0.87, method: "minilm-cosine" }
 * ═══════════════════════════════════════════════════════════════════════
 */

import { getAllEmbeddings, saveEmbeddings, type IntentEmbedding } from './db';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentName = 'DriveLegal' | 'RoadSoS' | 'RoadWatch' | 'Emergency' | 'Unclear';

export interface ClassificationResult {
  intent: IntentName;
  confidence: number;            // 0–1
  method: 'minilm-cosine' | 'keyword' | 'fallback';
  allScores?: Record<IntentName, number>;
}

// ── Intent prototype sentences (mirrors Python INTENT_PROTOTYPES) ─────────────

const INTENT_PROTOTYPES: Record<IntentName, string[]> = {
  DriveLegal: [
    'What is the fine for jumping a red light?',
    'Penalty for drunk driving in India',
    'Challan for no helmet in Indore',
    'Traffic violation fine amount in MP',
    'Fine for driving without licence',
    'Penalty for using mobile while driving',
    'Traffic challan amount for triple riding',
    'MV Act section for overspeeding',
    'Bina helmet challan kitna hai',
    'Signal todne ka fine',
    'Drunk driving penalty Bangalore',
    'Wrong parking challan Indore',
    'Helmet nahi pehna toh kitna fine lagega?',
    'Red light todne par kya hoga?',
    'Bina licence gaadi chalane ka kya penalty hai?',
    'What is the seatbelt rule?',
    'PUC certificate fine India',
    'Tinted glass violation fine',
  ],
  RoadSoS: [
    'I need a puncture repair shop near me',
    'My car broke down on highway',
    'Where is the nearest towing service?',
    'Fuel pump failure on road',
    'Flat tyre emergency service',
    'Gaadi band ho gayi highway par',
    'Nearest petrol pump at midnight',
    'Mechanic shop open now',
    'Nearest CNG station from here',
    'Vehicle breakdown assistance needed',
    'Help my car is stuck',
    'Tyre puncture repair kahan milega?',
  ],
  RoadWatch: [
    'I want to report a pothole',
    'Dangerous road condition on NH-52',
    'Street light not working on my road',
    'Report road damage near me',
    'Submit complaint about broken divider',
    'Sadak mein gadhha hai report karo',
    'Report traffic signal malfunction',
    'Waterlogging on highway during rain',
    'Missing road signs report',
    'Pothole report karna hai',
    'Road construction blocking traffic',
    'Speed bump too aggressive',
  ],
  Emergency: [
    'Find nearest hospital from current location',
    'Emergency ambulance near me now',
    'I met with an accident please help',
    'Nearest trauma centre immediately',
    'Call emergency services for road accident',
    'Nearest police station for accident',
    'Accident ho gaya help karo',
    'Mujhe hospital jana hai emergency mein',
    'I am injured on road need help',
    'Blood bank near me urgent',
    'Paramedic service contact number',
    'Nearest fire station',
  ],
  Unclear: [
    'Hello how are you',
    'What can you do',
    'Tell me a joke',
    'What is the weather today',
  ],
};

// ── Keyword fallback (instant, no model needed) ───────────────────────────────

const KEYWORD_RULES: Array<{ pattern: RegExp; intent: IntentName; weight: number }> = [
  // DriveLegal
  { pattern: /\b(challan|fine|penalty|violation|ticket|mvact|mv act|section|drunk|dui|dwi|helmet|seatbelt|seat belt|license|licence|overspe|speed limit|parking|signal|red light|mobile phone|puc|tinted|triple riding)\b/i, intent: 'DriveLegal', weight: 0.85 },
  { pattern: /\bkitna (fine|challan|penalty)\b/i,  intent: 'DriveLegal', weight: 0.9 },
  // RoadSoS
  { pattern: /\b(puncture|tyre|tire|breakdown|towing|mechanic|petrol pump|cng station|fuel|battery|broke down|stuck on road)\b/i, intent: 'RoadSoS', weight: 0.85 },
  { pattern: /\bgaadi (band|kharab|stuck)\b/i,     intent: 'RoadSoS', weight: 0.9 },
  // RoadWatch
  { pattern: /\b(pothole|report|complaint|road damage|divider|street light|traffic signal|waterlog|construction|speed bump|broken road)\b/i, intent: 'RoadWatch', weight: 0.82 },
  { pattern: /\b(sadak mein|gadhha|report karo)\b/i, intent: 'RoadWatch', weight: 0.9 },
  // Emergency
  { pattern: /\b(accident|ambulance|hospital|trauma|injured|emergency|help me|blood bank|paramedic|police station|fire station|hurt|crash)\b/i, intent: 'Emergency', weight: 0.88 },
  { pattern: /\b(accident ho gaya|help karo|mujhe hospital)\b/i, intent: 'Emergency', weight: 0.95 },
];

function keywordClassify(text: string): ClassificationResult | null {
  const scores: Partial<Record<IntentName, number>> = {};

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      scores[rule.intent] = Math.max(scores[rule.intent] ?? 0, rule.weight);
    }
  }

  if (Object.keys(scores).length === 0) return null;

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [topIntent, topScore] = sorted[0];

  return {
    intent: topIntent as IntentName,
    confidence: topScore,
    method: 'keyword',
    allScores: scores as Record<IntentName, number>,
  };
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Average pooling over token embeddings (matches sentence-transformers default) */
function meanPool(tokenEmbeddings: number[][], attentionMask: number[]): number[] {
  const dim = tokenEmbeddings[0].length;
  const result = new Array(dim).fill(0);
  let count = 0;
  for (let i = 0; i < tokenEmbeddings.length; i++) {
    if (attentionMask[i] === 0) continue;
    for (let j = 0; j < dim; j++) result[j] += tokenEmbeddings[i][j];
    count++;
  }
  if (count > 0) result.forEach((_, i) => (result[i] /= count));
  return result;
}

/** L2 normalise a vector */
function normalise(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

// ── Transformers.js singleton ─────────────────────────────────────────────────

type Pipeline = {
  (text: string, options?: Record<string, unknown>): Promise<{ data: Float32Array; dims: number[] }>;
};

let _pipeline: Pipeline | null = null;
let _loading: Promise<Pipeline | null> | null = null;

async function getEmbeddingPipeline(): Promise<Pipeline | null> {
  if (_pipeline) return _pipeline;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // @xenova/transformers is loaded as a dynamic import to avoid SSR issues
      const { pipeline, env } = await import('@xenova/transformers' as string);

      // Point to CDN-hosted ONNX quantised model (~23 MB, cached after first load)
      env.allowLocalModels = false;
      env.useBrowserCache  = true;

      const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,   // INT8 quantised model for ~4× speed
      });

      console.log('[Classifier] MiniLM pipeline ready ✓');
      _pipeline = pipe as unknown as Pipeline;
      return _pipeline;
    } catch (err) {
      console.warn('[Classifier] Transformers.js unavailable, will use keyword fallback:', err);
      return null;
    }
  })();

  return _loading;
}

async function embed(text: string): Promise<number[] | null> {
  const pipe = await getEmbeddingPipeline();
  if (!pipe) return null;

  try {
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.warn('[Classifier] Embedding failed:', err);
    return null;
  }
}

// ── Prototype embedding cache ─────────────────────────────────────────────────

let _prototypeEmbeddings: IntentEmbedding[] | null = null;

/** Load or build prototype embeddings (stored in IndexedDB for offline use) */
async function getPrototypeEmbeddings(): Promise<IntentEmbedding[]> {
  if (_prototypeEmbeddings) return _prototypeEmbeddings;

  // Try IndexedDB first
  const stored = await getAllEmbeddings();
  if (stored.length > 0) {
    _prototypeEmbeddings = stored;
    return stored;
  }

  // Compute and store (happens once, ~2–5 s on first run)
  console.log('[Classifier] Computing prototype embeddings (first run) …');
  const records: Omit<IntentEmbedding, 'id'>[] = [];

  for (const [intent, sentences] of Object.entries(INTENT_PROTOTYPES)) {
    for (const text of sentences) {
      const embedding = await embed(text);
      if (embedding) {
        records.push({ intent, text, embedding });
      }
    }
  }

  if (records.length > 0) {
    await saveEmbeddings(records);
    console.log(`[Classifier] Stored ${records.length} embeddings in IndexedDB ✓`);
  }

  _prototypeEmbeddings = records as IntentEmbedding[];
  return _prototypeEmbeddings;
}

// ── Main classify function ────────────────────────────────────────────────────

/**
 * Classify the intent of a user query.
 * Tries MiniLM cosine similarity first, falls back to keyword matching.
 * Threshold 0.55 matches backend (lowered in v4 for Hinglish accuracy).
 */
export async function classifyIntent(
  text: string,
  options: { threshold?: number } = {}
): Promise<ClassificationResult> {
  const threshold = options.threshold ?? 0.55;

  // ── Tier 1: MiniLM cosine similarity ──────────────────────────────────────
  const queryEmbedding = await embed(text);
  if (queryEmbedding) {
    try {
      const prototypes = await getPrototypeEmbeddings();
      if (prototypes.length > 0) {
        // Aggregate scores per intent: take max similarity among its prototypes
        const intentScores: Partial<Record<IntentName, number>> = {};

        for (const proto of prototypes) {
          const sim = cosineSimilarity(queryEmbedding, proto.embedding);
          const intent = proto.intent as IntentName;
          intentScores[intent] = Math.max(intentScores[intent] ?? 0, sim);
        }

        const sorted = (Object.entries(intentScores) as [IntentName, number][])
          .sort(([, a], [, b]) => b - a);

        const [topIntent, topScore] = sorted[0];

        if (topScore >= threshold && topIntent !== 'Unclear') {
          return {
            intent:    topIntent,
            confidence: Math.min(topScore, 1),
            method:    'minilm-cosine',
            allScores: intentScores as Record<IntentName, number>,
          };
        }
      }
    } catch (err) {
      console.warn('[Classifier] Cosine pass failed:', err);
    }
  }

  // ── Tier 2: Keyword matching ───────────────────────────────────────────────
  const kwResult = keywordClassify(text);
  if (kwResult) return kwResult;

  // ── Tier 3: Fallback ──────────────────────────────────────────────────────
  return {
    intent:     'Unclear',
    confidence: 0,
    method:     'fallback',
  };
}

/** Warm up the pipeline (call on app mount to avoid cold-start delay) */
export function warmUpClassifier(): void {
  getEmbeddingPipeline().catch(() => {});
}

/** Force-rebuild prototype embeddings (call after model update) */
export async function rebuildEmbeddings(): Promise<void> {
  _prototypeEmbeddings = null;
  const { saveEmbeddings: save } = await import('./db');
  await save([]);   // clear
  await getPrototypeEmbeddings();
}

// ── Entity extraction (mirrors bilstm.py extract_entities) ───────────────────

export interface ExtractedEntities {
  location: string | null;
  state: string | null;
  country: string | null;
  violation: string | null;
  vehicleType: 'two_wheeler' | 'lmv' | 'hmv' | 'bus' | 'auto' | 'all';
}

const CITY_MAP: Record<string, string> = {
  indore: 'Indore', bhopal: 'Bhopal', delhi: 'Delhi', mumbai: 'Mumbai',
  pune: 'Pune', chennai: 'Chennai', bangalore: 'Bangalore', bengaluru: 'Bangalore',
  hyderabad: 'Hyderabad', kolkata: 'Kolkata', jaipur: 'Jaipur', surat: 'Surat',
  ahmedabad: 'Ahmedabad', lucknow: 'Lucknow', nagpur: 'Nagpur', patna: 'Patna',
  dhaka: 'Dhaka', kathmandu: 'Kathmandu', colombo: 'Colombo', naypyidaw: 'Naypyidaw',
  thimphu: 'Thimphu', bangkok: 'Bangkok',
};

const STATE_MAP: Record<string, string> = {
  mp: 'Madhya Pradesh', 'madhya pradesh': 'Madhya Pradesh',
  mh: 'Maharashtra',    maharashtra: 'Maharashtra',
  dl: 'Delhi',          delhi: 'Delhi',
  ka: 'Karnataka',      karnataka: 'Karnataka',
  tn: 'Tamil Nadu',     'tamil nadu': 'Tamil Nadu',
  up: 'Uttar Pradesh',  'uttar pradesh': 'Uttar Pradesh',
  rj: 'Rajasthan',      rajasthan: 'Rajasthan',
  gj: 'Gujarat',        gujarat: 'Gujarat',
};

const COUNTRY_MAP: Record<string, string> = {
  india: 'India', indian: 'India',
  bangladesh: 'Bangladesh', bangladeshi: 'Bangladesh',
  nepal: 'Nepal', 'sri lanka': 'Sri Lanka', 'srilanka': 'Sri Lanka',
  myanmar: 'Myanmar', bhutan: 'Bhutan', thailand: 'Thailand',
};

const VEHICLE_PATTERNS: Array<{ re: RegExp; type: ExtractedEntities['vehicleType'] }> = [
  { re: /\b(bike|motorcycle|two.?wheel|scooter|moped|scooty)\b/i, type: 'two_wheeler' },
  { re: /\b(car|sedan|suv|hatchback|lmv|light motor)\b/i,        type: 'lmv' },
  { re: /\b(truck|lorry|hmv|heavy motor|goods vehicle)\b/i,       type: 'hmv' },
  { re: /\b(bus|coach|minibus)\b/i,                               type: 'bus' },
  { re: /\b(auto|autorickshaw|tuk.?tuk|three.?wheel)\b/i,        type: 'auto' },
];

export function extractEntities(text: string): ExtractedEntities {
  const lower = text.toLowerCase();

  // Location
  let location: string | null = null;
  for (const [key, val] of Object.entries(CITY_MAP)) {
    if (lower.includes(key)) { location = val; break; }
  }

  // State
  let state: string | null = null;
  for (const [key, val] of Object.entries(STATE_MAP)) {
    if (lower.includes(key)) { state = val; break; }
  }

  // Country
  let country: string | null = null;
  for (const [key, val] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(key)) { country = val; break; }
  }

  // Vehicle type
  let vehicleType: ExtractedEntities['vehicleType'] = 'all';
  for (const { re, type } of VEHICLE_PATTERNS) {
    if (re.test(text)) { vehicleType = type; break; }
  }

  // Violation keyword
  const violationMatch = text.match(
    /\b(helmet|seatbelt|signal|red light|drunk|alcohol|speeding|parking|mobile|puc|license|triple)\b/i
  );
  const violation = violationMatch ? violationMatch[1].toLowerCase() : null;

  return { location, state, country, violation, vehicleType };
}
