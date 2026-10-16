// Live visa requirements from the open Passport Index dataset
// (github.com/ilyankou/passport-index-dataset, ODbL). Matrix is keyed by
// ISO-3166 alpha-3 codes: row = passport, column = destination.
const MATRIX_URL =
  'https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-matrix-iso3.csv'

let matrixCache = null

export async function loadMatrix() {
  if (matrixCache) return matrixCache
  const res = await fetch(MATRIX_URL)
  if (!res.ok) throw new Error(`Could not load visa data (HTTP ${res.status})`)
  const text = await res.text()
  matrixCache = parseMatrix(text)
  return matrixCache
}

// CSV has a destination-code header row and one row per passport. No values
// contain commas, so a plain split is safe. Result: { PASSPORT: { DEST: raw } }.
function parseMatrix(text) {
  const lines = text.trim().split(/\r?\n/)
  const dests = lines[0].split(',').slice(1)
  const matrix = {}
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const passport = cols[0]
    const row = {}
    for (let j = 0; j < dests.length; j++) row[dests[j]] = cols[j + 1]
    matrix[passport] = row
  }
  return matrix
}

// Returns a normalised requirement for travelling FROM passportCca3 TO destCca3.
export async function visaRequirement(passportCca3, destCca3) {
  const from = (passportCca3 || '').toUpperCase()
  const to = (destCca3 || '').toUpperCase()
  if (!from || !to) return { status: 'unknown', label: 'Set your passport country', raw: '' }
  if (from === to) return { status: 'home', label: 'Home country', raw: '-1' }

  const matrix = await loadMatrix()
  const raw = matrix[from] ? matrix[from][to] : undefined
  return classify(raw)
}

export function classify(raw) {
  if (raw === undefined || raw === null || raw === '')
    return { status: 'unknown', label: 'No data', raw: '' }
  const v = String(raw).trim().toLowerCase()

  if (v === '-1') return { status: 'home', label: 'Home country', raw }
  if (/^\d+$/.test(v))
    return { status: 'visa-free', label: `Visa-free · up to ${v} days`, raw, days: Number(v) }
  if (v === 'visa free' || v === 'visa-free' || v === 'freedom of movement')
    return { status: 'visa-free', label: 'Visa-free', raw }
  if (v.includes('on arrival'))
    return { status: 'voa', label: 'Visa on arrival', raw }
  if (v.includes('e-visa') || v.includes('evisa') || v.includes('eta') || v.includes('electronic'))
    return { status: 'evisa', label: 'e-Visa / ETA required', raw }
  if (v.includes('no admission') || v.includes('covid') || v.includes('ban'))
    return { status: 'no-admission', label: 'No admission', raw }
  if (v.includes('visa required') || v === 'visa')
    return { status: 'required', label: 'Visa required', raw }
  return { status: 'other', label: raw, raw }
}

export const STATUS_META = {
  'visa-free': { color: '#16a34a', emoji: '🟢' },
  voa: { color: '#0891b2', emoji: '🔵' },
  evisa: { color: '#ca8a04', emoji: '🟡' },
  required: { color: '#dc2626', emoji: '🔴' },
  'no-admission': { color: '#7f1d1d', emoji: '⛔' },
  home: { color: '#6b7280', emoji: '🏠' },
  unknown: { color: '#9ca3af', emoji: '❔' },
  other: { color: '#6b7280', emoji: '⚪' },
}
