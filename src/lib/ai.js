// Optional AI refinement for itineraries — grounded, not generative.
// We send only the REAL places our data layer already found and ask a free,
// keyless open-model endpoint (Pollinations, routes to Llama/Mistral) to order
// them into days and add a short tip each. The AI cannot invent places: any
// name it returns is matched back to our real list, anything else is dropped.
// If the call fails or returns junk, callers fall back to the heuristic plan.

const ENDPOINT = 'https://text.pollinations.ai/'

// Ask the AI to recommend the best city (from our real Wikivoyage list) for the
// traveller's interests. Grounded: the answer must be one of the given cities.
export async function pickCity({ region, cities, interests = [], days = 3 }) {
  const names = cities.map((c) => c.name)
  const prompt =
    `I'm planning a ${days}-day trip to ${region} and I like: ${interests.join(', ') || 'general sightseeing'}. ` +
    `Which ONE of these cities is the best base for that? Reply with ONLY the city name, exactly as written, ` +
    `chosen from this list: ${names.join('; ')}.`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 28000)
  let text
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(prompt), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`AI ${res.status}`)
    text = await res.text()
  } finally {
    clearTimeout(timer)
  }
  const n = norm(text)
  const match =
    cities.find((c) => norm(c.name) === n) ||
    cities.find((c) => n.includes(norm(c.name))) ||
    cities.find((c) => norm(c.name).includes(n))
  if (!match) throw new Error('AI did not return a known city')
  return match
}

export async function refineDays({ place, days, interests = [], places }) {
  const names = places.map((p) => p.name)
  const prompt =
    `You are an expert local travel planner. Arrange these REAL attractions in ${place} into a ${days}-day ` +
    `itinerary. Group places that are near each other on the same day and respect these interests: ` +
    `${interests.join(', ') || 'general sightseeing'}. For each place add a tip of at most 12 words. ` +
    `Use ONLY these exact names, do not add or invent any: ${names.join('; ')}. ` +
    `Reply with ONLY JSON in this shape: {"days":[[{"name":"...","tip":"..."}]]} with exactly ${days} day arrays.`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 28000)
  let text
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(prompt), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`AI ${res.status}`)
    text = await res.text()
  } finally {
    clearTimeout(timer)
  }

  const parsed = extractJson(text)
  if (!parsed || !Array.isArray(parsed.days)) throw new Error('AI returned an unexpected format')

  const byName = new Map(places.map((p) => [norm(p.name), p]))
  const used = new Set()
  const out = parsed.days.slice(0, days).map((day) =>
    (Array.isArray(day) ? day : [])
      .map((entry) => {
        const name = typeof entry === 'string' ? entry : entry?.name
        const tip = typeof entry === 'object' ? entry?.tip : ''
        const match = byName.get(norm(name)) || fuzzy(places, name)
        if (!match || used.has(match.id)) return null
        used.add(match.id)
        return { ...match, tip: tip || '' }
      })
      .filter(Boolean),
  )

  // Append any real places the AI dropped onto the lightest day so nothing is lost.
  const leftovers = places.filter((p) => !used.has(p.id))
  for (const p of leftovers) {
    const lightest = out.reduce((a, b) => (b.length < a.length ? b : a), out[0] || [])
    if (lightest) lightest.push({ ...p, tip: '' })
  }
  while (out.length < days) out.push([])
  if (!out.flat().length) throw new Error('AI produced an empty plan')
  return out
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
function fuzzy(places, name) {
  const n = norm(name)
  if (!n) return null
  return places.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name)))
}
function extractJson(text) {
  if (!text) return null
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}
