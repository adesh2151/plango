// Share a trip with no backend: the whole trip is encoded into the URL hash,
// so the link itself carries the plan. Unicode-safe base64.
export function encodeTrip(trip) {
  const json = JSON.stringify(trip)
  return btoa(unescape(encodeURIComponent(json)))
}

export function decodeTrip(str) {
  const json = decodeURIComponent(escape(atob(str)))
  return JSON.parse(json)
}

export function tripShareUrl(trip) {
  const base = location.origin + location.pathname
  return `${base}#t=${encodeTrip(trip)}`
}

// Read a shared trip from the current URL hash, if present (and clear it).
export function readSharedTrip() {
  const m = /[#&]t=([^&]+)/.exec(location.hash)
  if (!m) return null
  try {
    const trip = decodeTrip(decodeURIComponent(m[1]))
    history.replaceState(null, '', location.pathname)
    return trip
  } catch {
    return null
  }
}

export function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 500)
}
