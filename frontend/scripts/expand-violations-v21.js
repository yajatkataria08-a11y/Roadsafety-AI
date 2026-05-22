#!/usr/bin/env node
/**
 * scripts/expand-violations-v21.js
 * Patches existing violations.json:
 *   - Ensures every record has country, vehicle_types, currency, payment_url
 *   - Does NOT rewrite or remove any existing records
 * Usage: node scripts/expand-violations-v21.js
 */
const fs   = require('fs')
const path = require('path')

const PATHS = [
  path.resolve(__dirname, '..', '..', 'backend', 'data', 'legal', 'violations.json'),
  path.resolve(__dirname, '..', 'public', 'violations.json'),
]

const COUNTRY_META = {
  India:       { currency: '₹',   payment_url: 'https://echallan.parivahan.gov.in'    },
  Bangladesh:  { currency: 'BDT', payment_url: 'https://police.gov.bd/echallan'       },
  'Sri Lanka': { currency: 'LKR', payment_url: 'https://www.police.lk/echallan'       },
  Nepal:       { currency: 'NPR', payment_url: 'https://nepalpolice.gov.np/challan'   },
  Myanmar:     { currency: 'MMK', payment_url: 'https://www.mpt.net.mm/echallan'      },
  Bhutan:      { currency: 'BTN', payment_url: 'https://rsta.gov.bt/echallan'         },
  Thailand:    { currency: 'THB', payment_url: 'https://www.thaitrafficcourt.or.th'   },
}

for (const filePath of PATHS) {
  if (!fs.existsSync(filePath)) { console.log('Skipping (not found):', filePath); continue }
  console.log('📖 Reading:', filePath)
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  let patched = 0
  const result = raw.map(v => {
    let changed = false
    if (!v.country) { v.country = 'India'; changed = true }
    if (!Array.isArray(v.vehicle_types) || !v.vehicle_types.length) { v.vehicle_types = ['all']; changed = true }
    const m = COUNTRY_META[v.country] ?? COUNTRY_META.India
    if (!v.currency)    { v.currency    = m.currency;    changed = true }
    if (!v.payment_url) { v.payment_url = m.payment_url; changed = true }
    if (changed) patched++
    return v
  })
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`✅ Patched ${patched}/${result.length} records → ${filePath}`)
}
