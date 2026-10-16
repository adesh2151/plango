// Detect whether a query is a region/country and, if so, list its main cities
// to visit — from Wikivoyage (open, CC BY-SA). Region/country articles have a
// "Cities" section; city articles don't, which is our region signal.
const API = 'https://en.wikivoyage.org/w/api.php'

// Entries that appear in Cities sections but aren't really a city to plan.
const NOISE = /mela|festival|fair|list of|see also|template/i

async function wv(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Wikivoyage ${res.status}`)
  return res.json()
}

export async function getRegionCities(name) {
  if (!name || !name.trim()) return []
  try {
    const search = await wv({ action: 'query', list: 'search', srsearch: name, srlimit: '1' })
    const title = search?.query?.search?.[0]?.title
    if (!title) return []

    const secData = await wv({ action: 'parse', page: title, prop: 'sections' })
    const section = (secData?.parse?.sections || []).find(
      (s) => s.line.trim().toLowerCase() === 'cities' && s.toclevel <= 2,
    )
    if (!section) return [] // no Cities section => treat as a city, not a region

    const data = await wv({ action: 'parse', page: title, prop: 'text', section: section.index })
    const html = data?.parse?.text?.['*'] || ''
    const out = []
    const seen = new Set()
    const re = /<a href="\/wiki\/([^":#]+)"[^>]*title="([^"]+)"/g
    let m
    while ((m = re.exec(html)) !== null) {
      const t = decodeURIComponent(m[2]).replace(/_/g, ' ').trim()
      if (t.includes(':') || NOISE.test(t) || seen.has(t)) continue
      seen.add(t)
      out.push({ name: t, region: title })
      if (out.length >= 9) break
    }
    return out
  } catch {
    return []
  }
}
