// Live exchange rates from the open-source @fawazahmed0/currency-api (served
// free via jsDelivr, no key, proper CORS, 150+ currencies, updated daily).
// Fully open — https://github.com/fawazahmed0/exchange-api. Crypto codes are
// filtered out via Intl so only real-world currencies show.
import { getJSON } from './http.js'

const BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'

let listCache = null
const baseCache = {} // lowercase base code -> { rates (UPPER keys), date }

function currencyName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code.toUpperCase()) || null
  } catch {
    return null
  }
}
// A real-world currency: 3-letter ISO code that Intl recognises (so BTC/ADA/etc. drop out).
function isFiat(code) {
  if (!/^[a-z]{3}$/i.test(code)) return false
  const n = currencyName(code)
  return !!n && n.toUpperCase() !== code.toUpperCase()
}

async function fetchBase(base) {
  const b = (base || 'USD').toLowerCase()
  if (baseCache[b]) return baseCache[b]
  const d = await getJSON(`${BASE}/${b}.min.json`)
  const raw = d[b] || {}
  const rates = {}
  for (const [k, v] of Object.entries(raw)) rates[k.toUpperCase()] = v
  baseCache[b] = { rates, date: d.date || null }
  return baseCache[b]
}

export async function listCurrencies() {
  if (listCache) return listCache
  const { rates } = await fetchBase('usd')
  const out = { USD: 'US Dollar' }
  for (const code of Object.keys(rates)) if (isFiat(code)) out[code] = currencyName(code)
  listCache = Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])))
  return listCache
}

// Sync converter into `base` (rates are base->X, so X->base divides).
export async function buildConverter(base) {
  const b = (base || 'USD').toUpperCase()
  let rates = {}
  let date = null
  try {
    const d = await fetchBase(b)
    rates = { ...d.rates }
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
