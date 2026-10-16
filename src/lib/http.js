// Small fetch helper: JSON, timeout, and a clear error message.
export async function getJSON(url, { timeout = 15000, headers } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${shortUrl(url)}`)
    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Timed out contacting ${shortUrl(url)}`)
    throw err
  } finally {
    clearTimeout(t)
  }
}

export async function postForm(url, body, { timeout = 15000, headers } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
      body: new URLSearchParams(body).toString(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error_description || data.error || `HTTP ${res.status}`)
    return data
  } finally {
    clearTimeout(t)
  }
}

function shortUrl(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
