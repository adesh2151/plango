// Live exchange rates from the ExchangeRate-API open endpoint (free, no key,
// fast, proper CORS, ~160 currencies). Chosen over Frankfurter because that
// host was slow/flaky from some networks. Currency display names come from the
// browser's built-in Intl.DisplayNames, so the name list needs no network.
import { getJSON } from './http.js'

const API = 'https://open.er-api.com/v6/latest'

let listCache = null
const baseCache = {} // base code -> { rates, date }

function currencyName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || code
  } catch {
    return code
  }
}

async function fetchBase(base) {
  const b = (base || 'USD').toUpperCase()
  if (baseCache[b]) return baseCache[b]
  const data = await getJSON(`${API}/${b}`)
  if (data.result === 'error') throw new Error(data['error-type'] || 'Rate lookup failed')
  const date = data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0, 10) : null
  baseCache[b] = { rates: data.rates || {}, date }
  return baseCache[b]
}

export async function listCurrencies() {
  if (listCache) return listCache
  const { rates } = await fetchBase('USD')
  const out = {}
  for (const code of Object.keys(rates).sort()) out[code] = currencyName(code)
  listCache = out
  return out
}

// Sync converter from any supported currency into `base`.
// `rates` are base->X, so to go X->base we divide.
export async function buildConverter(base) {
  const b = (base || 'USD').toUpperCase()
  let rates = {}
  let date = null
  try {
    const d = await fetchBase(b)
    rates = d.rates
    date = d.date
  } catch {
    rates = {}
  }
  rates[b] = 1
  const convert = (amount, currency) => {
    const c = (currency || b).toUpperCase()
    const n = Number(amount) || 0
    if (c === b) return n
    const r = rates[c]
    if (!r) return null
    return n / r
  }
  return { base: b, date, rates, convert, supports: (c) => !!rates[(c || '').toUpperCase()] }
}

export async function convertOne(amount, from, to) {
  const f = (from || 'USD').toUpperCase()
  const t = (to || 'USD').toUpperCase()
  if (f === t) return Number(amount) || 0
  const { rates } = await fetchBase(f)
  const r = rates[t]
  return r == null ? null : (Number(amount) || 0) * r
}
