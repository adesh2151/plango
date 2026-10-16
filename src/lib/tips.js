// Live destination guidance from Wikivoyage (CC BY-SA, free). We surface the
// practical sections travellers need — etiquette (do's & don'ts), safety,
// entry rules, when to go — fetched live for essentially any city/region.
const API = 'https://en.wikivoyage.org/w/api.php'

// Section name (lowercased, matched by `includes`) → friendly label + emoji.
// Order here is the order shown.
const WANTED = [
  { key: 'understand', label: 'Overview', emoji: '📖' },
  { key: 'when to go', label: 'When to go', emoji: '🗓️' },
  { key: 'climate', label: 'Climate', emoji: '🌤️' },
  { key: 'get in', label: 'Getting in & entry', emoji: '🛂' },
  { key: 'respect', label: "Do's & don'ts (etiquette)", emoji: '🙏' },
  { key: 'stay safe', label: 'Stay safe', emoji: '🛟' },
  { key: 'stay healthy', label: 'Stay healthy', emoji: '💊' },
  { key: 'talk', label: 'Language', emoji: '🗣️' },
]

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Wikivoyage HTTP ${res.status}`)
  return res.json()
}

export async function getGuide(query) {
  if (!query || !query.trim()) return null
  const search = await api({ action: 'query', list: 'search', srsearch: query, srlimit: '1' })
  const hit = search?.query?.search?.[0]
  if (!hit) return { title: query, url: '', sections: [], notFound: true }
  const title = hit.title

  const secData = await api({ action: 'parse', page: title, prop: 'sections' })
  const allSections = secData?.parse?.sections || []

  const picks = []
  for (const w of WANTED) {
    const match = allSections.find((s) => s.line.toLowerCase().includes(w.key) && s.toclevel <= 2)
    if (match) picks.push({ ...w, index: match.index })
  }

  const sections = []
  for (const p of picks.slice(0, 6)) {
    try {
      const data = await api({ action: 'parse', page: title, section: p.index, prop: 'text' })
      const html = data?.parse?.text?.['*'] || ''
      const text = htmlToText(html)
      if (text) sections.push({ label: p.label, emoji: p.emoji, text })
    } catch {
      /* skip a failed section */
    }
  }

  return { title, url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title)}`, sections }
}

function htmlToText(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('sup.reference, table, .mw-editsection, style, .thumb, .navbox').forEach((n) => n.remove())
    const parts = []
    doc.querySelectorAll('p, li').forEach((el) => {
      const t = el.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
      if (t && t.length > 2) parts.push(el.tagName === 'LI' ? `• ${t}` : t)
    })
    return parts.join('\n').slice(0, 900).trim()
  } catch {
    return ''
  }
}
