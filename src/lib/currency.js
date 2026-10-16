// Live exchange rates from Frankfurter (ECB data, free, no key).
// NOTE: use the canonical api.frankfurter.dev host — api.frankfurter.app
// answers cross-origin requests with a 301 that carries no CORS header, which
// browsers reject as "Failed to fetch".
import { getJSON } from './http.js'

const API = 'https://api.frankfurter.dev/v1'

let currencyListCache = null

export async function listCurrencies() {
  if (currencyListCache) return currencyListCache
  const data = await getJSON(`${API}/currencies`)
  currencyListCache = data // { USD: "United States Dollar", ... }
  return data
}

// Returns a sync converter from any supported currency into `base`.
// `base=X` gives X->Y rates; to go Y->base we divide.
export async function buildConverter(base) {
  const b = (base || 'USD').toUpperCase()
  let rates = {}
  let date = null
  try {
    const data = await getJSON(`${API}/latest?base=${b}`)
    rates = data.rates || {}
    date = data.date
  } catch {
    rates = {}
  }
  rates[b] = 1

  const convert = (amount, currency) => {
    const c = (currency || b).toUpperCase()
    const n = Number(amount) || 0
    if (c === b) return n
    const r = rates[c]
    if (!r) return null // currency not supported by the rate feed
    return n / r
  }

  return { base: b, date, rates, convert, supports: (c) => !!rates[(c || '').toUpperCase()] }
}

// Convenience: convert a single amount live.
export async function convertOne(amount, from, to) {
  const f = (from || 'USD').toUpperCase()
  const t = (to || 'USD').toUpperCase()
  if (f === t) return Number(amount) || 0
  const data = await getJSON(`${API}/latest?base=${f}&symbols=${t}&amount=${encodeURIComponent(amount)}`)
  return data.rates ? data.rates[t] : null
}
