// Money & date formatting helpers.

export function money(amount, currency = 'USD') {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    // Unknown currency code: fall back to plain number + code.
    return `${n.toFixed(2)} ${currency}`
  }
}

export function plain(amount) {
  return (Number(amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d)) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Add n days to a YYYY-MM-DD string (UTC-safe, no timezone drift).
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Today as YYYY-MM-DD (UTC).
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// Inclusive list of ISO dates between start and end (YYYY-MM-DD strings).
export function dateRange(start, end) {
  if (!start) return []
  const out = []
  const d = new Date(start + 'T00:00:00Z')
  const last = new Date((end || start) + 'T00:00:00Z')
  if (isNaN(d) || isNaN(last) || last < d) return [start]
  let guard = 0
  while (d <= last && guard < 400) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
    guard++
  }
  return out
}

export function daysBetween(start, end) {
  return dateRange(start, end).length
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
