/**
 * lib/i18n/chatTranslate.ts — Script detection + Hinglish transliteration (v21)
 * ════════════════════════════════════════════════════════════════════════════════
 * Unicode ranges:
 *   Devanagari  U+0900–U+097F
 *   Bengali     U+0980–U+09FF
 *   Thai        U+0E00–U+0E7F
 */

export type ScriptType = 'devanagari' | 'bengali' | 'thai' | 'latin'

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export function detectScript(text: string): ScriptType {
  let devanagari = 0, bengali = 0, thai = 0
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? 0
    if      (cp >= 0x0900 && cp <= 0x097F) devanagari++
    else if (cp >= 0x0980 && cp <= 0x09FF) bengali++
    else if (cp >= 0x0E00 && cp <= 0x0E7F) thai++
  }
  const max = Math.max(devanagari, bengali, thai)
  if (max === 0)              return 'latin'
  if (max === devanagari)     return 'devanagari'
  if (max === bengali)        return 'bengali'
  return 'thai'
}

export function getScriptLabel(script: ScriptType): string {
  return { devanagari: 'हिंदी', bengali: 'বাংলা', thai: 'ภาษาไทย', latin: 'English' }[script]
}

// ─────────────────────────────────────────────────────────────────────────────
// HINGLISH → ENGLISH MAP  (40+ entries, order matters — longer patterns first)
// ─────────────────────────────────────────────────────────────────────────────

const HINGLISH_MAP: Array<[RegExp, string]> = [
  [/\bbina\s+helmet\b/gi,                   'no helmet'],
  [/\bhelmet\s+nahi\b/gi,                   'no helmet'],
  [/\bsignal\s+tod(na|a|e)\b/gi,           'signal jumping'],
  [/\bred\s+light\s+tod(na|a|e)\b/gi,      'signal jumping'],
  [/\bdaaru\s+pi\s+ke\b/gi,                'drunk driving'],
  [/\bshraab\s+pi\s+ke\b/gi,               'drunk driving'],
  [/\bnasha\s+me(n)?\b/gi,                 'drunk driving'],
  [/\bdrunk\s+drive\b/gi,                  'drunk driving'],
  [/\btez\s+gaadi\b/gi,                    'overspeeding'],
  [/\bspeed\s+se\s+chala(na)?\b/gi,        'overspeeding'],
  [/\bgalat\s+taraf\b/gi,                  'wrong side driving'],
  [/\bulti\s+side\b/gi,                    'wrong side driving'],
  [/\bwrong\s+side\b/gi,                   'wrong side driving'],
  [/\bmobile\s+chalate\s+waqt\b/gi,        'mobile phone while driving'],
  [/\bphone\s+pe\s+baat\b/gi,              'mobile phone while driving'],
  [/\bbina\s+seat\s+belt\b/gi,             'no seat belt'],
  [/\bseat\s+belt\s+nahi\b/gi,             'no seat belt'],
  [/\bbina\s+licence\b/gi,                 'no driving licence'],
  [/\blicence\s+nahi\b/gi,                 'no driving licence'],
  [/\bbina\s+insurance\b/gi,               'no insurance'],
  [/\bbina\s+rc\b/gi,                      'no registration certificate'],
  [/\bbina\s+puc\b/gi,                     'no PUC certificate'],
  [/\boverloading\b/gi,                    'vehicle overloading'],
  [/\bkitna\s+fine\b/gi,                   'how much is the fine'],
  [/\bkitna\s+challan\b/gi,                'how much is the challan'],
  [/\bchallan\s+kitna\b/gi,                'how much is the challan'],
  [/\bfine\s+kitna\b/gi,                   'how much is the fine'],
  [/\bjurmaana\b/gi,                       'penalty fine'],
  [/\bpenalty\s+kitni\b/gi,                'how much is the penalty'],
  [/\bgaadi\b/gi,                          'vehicle'],
  [/\bbike\s+wala\b/gi,                    'motorcycle rider'],
  [/\bscooter\s+wala\b/gi,                 'scooter rider'],
  [/\btraffic\s+police\b/gi,               'traffic police'],
  [/\bpolice\s+wala\b/gi,                  'police officer'],
  [/\baccident\s+ho\s+gaya\b/gi,           'accident happened'],
  [/\btakkar\s+ho\s+gayi\b/gi,             'vehicle collision accident'],
  [/\bkhatarnak\s+sadak\b/gi,              'dangerous road'],
  [/\bgadha\b/gi,                          'pothole'],
  [/\bkhada\b/gi,                          'pothole road damage'],
  [/\bkyaa\s+rule\b/gi,                    'what is the rule'],
  [/\bniyam\s+kya\s+hai\b/gi,              'what is the traffic rule'],
  [/\bbachao\b/gi,                         'emergency help'],
  [/\bmadad\s+chahiye\b/gi,                'need emergency help'],
  [/\bhal\s+kya\s+hoga\b/gi,              'what will happen'],
  [/\bmaafi\s+mil\s+sakti\s+hai\b/gi,     'can I get fine waived'],
]

export function transliterateHinglish(text: string): string {
  let result = text
  for (const [pattern, replacement] of HINGLISH_MAP) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * prepareForBackend — full pipeline used by chat/page.tsx handleSend
 * Returns:
 *   displayText  — original (shown in bubble)
 *   backendText  — transliterated (sent to API)
 *   script       — detected script type
 */
export function prepareForBackend(text: string): {
  displayText: string
  backendText: string
  script:      ScriptType
} {
  const script      = detectScript(text)
  const displayText = text
  const backendText = (script === 'devanagari' || script === 'latin')
    ? transliterateHinglish(text)
    : text   // Bengali/Thai passed through — backend NLP handles it
  return { displayText, backendText, script }
}
