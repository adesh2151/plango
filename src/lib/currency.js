// Live exchange rates from frankfurter.app (ECB data, free, no key).
import { getJSON } from './http.js'

const API = 'https://api.frankfurter.app'

let currencyListCache = null

export async function listCurrencies() {
  if (currencyListCache) return currencyListCache
  const data = await getJSON(`${API}/currencies`)
  currencyListCache = data // { USD: "United States Dollar", ... }
  return data
}

// Returns a sync converter from any supported currency into `base`.
// frankfurter `from=base` gives base->X rates; to go X->base we divide.
export async function buildConverter(base) {
  const b = (base || 'USD').toUpperCase()
  let rates = {}
  let date = null
  try {
    const data = await getJSON(`${API}/latest?from=${b}`)
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
    if (!r) return null // currency not supported by frankfurter
    return n / r
  }

  return { base: b, date, rates, convert, supports: (c) => !!rates[(c || '').toUpperCase()] }
}

// Convenience: convert a single amount live.
export async function convertOne(amount, from, to) {
  const f = (from || 'USD').toUpperCase()
  const t = (to || 'USD').toUpperCase()
  if (f === t) return Number(amount) || 0
  const data = await getJSON(`${API}/latest?amount=${encodeURIComponent(amount)}&from=${f}&to=${t}`)
  return data.rates ? data.rates[t] : null
}
