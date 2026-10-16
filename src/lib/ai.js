// Optional AI refinement for itineraries — grounded, not generative.
// We send only the REAL places our data layer already found and ask a free,
// keyless open-model endpoint (Pollinations, routes to Llama/Mistral) to order
// them into days and add a short tip each. The AI cannot invent places: any
// name it returns is matched back to our real list, anything else is dropped.
// If the call fails or returns junk, callers fall back to the heuristic plan.

const ENDPOINT = 'https://text.pollinations.ai/'

// Shared request with JSON mode + a model pick + one retry (the free endpoint
// is occasionally slow/returns prose, so json=true greatly improves reliability).
// The free Pollinations tier allows ~1 request per 30s per IP, so we do NOT
// auto-retry (a quick retry just hits the same limit). One clean attempt.
async function askAI(prompt, { json = false, timeout = 30000 } = {}) {
  const qs = json ? '?json=true' : ''
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(prompt) + qs, { signal: ctrl.signal })
    const body = await res.text()
    if (res.status === 402 || /"FREE_LIMIT"|"success"\s*:\s*false/.test(body)) {
      throw new Error('RATE_LIMIT')
    }
    if (!res.ok) throw new Error(`AI ${res.status}`)
    return body
  } finally {
    clearTimeout(timer)
  }
}

// Ask the AI to recommend the best city (from our real Wikivoyage list) for the
// traveller's interests. Grounded: the answer must be one of the given cities.
export async function pickCity({ region, cities, interests = [], days = 3 }) {
  const names = cities.map((c) => c.name)
  const prompt =
    `I'm planning a ${days}-day trip to ${region} and I like: ${interests.join(', ') || 'general sightseeing'}. ` +
    `Which ONE of these cities is the best base for that? Reply with ONLY the city name, exactly as written, ` +
    `chosen from this list: ${names.join('; ')}.`
  const text = await askAI(prompt)
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

  // One attempt (rate limit forbids quick retries). Tolerant of reply shapes.
  const text = await askAI(prompt, { json: true })
  const dayArrays = toDayArrays(parseAI(text), days)
  if (!dayArrays) throw new Error('AI returned an unexpected format')

  const byName = new Map(places.map((p) => [norm(p.name), p]))
  const used = new Set()
  const out = dayArrays.slice(0, days).map((day) =>
    day
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

// Coerce whatever the model returned into an array of day-arrays of entries.
function toDayArrays(parsed, days) {
  if (!parsed) return null
  let d = Array.isArray(parsed) ? parsed : parsed.days || parsed.itinerary || parsed.plan
  if (!Array.isArray(d)) return null
  // Each day may be an array, or an object like {places:[...]}/{stops:[...]}/{name,tip}.
  const norm = d.map((day) => {
    if (Array.isArray(day)) return day
    if (day && typeof day === 'object') {
      const inner = day.places || day.stops || day.items || day.activities
      if (Array.isArray(inner)) return inner
      if (day.name) return [day] // flat list of places
    }
    return []
  })
  // Flat list of places (no day grouping) -> chunk evenly into `days`.
  if (norm.every((x) => x.length <= 1) && norm.flat().length > days) {
    const flat = norm.flat()
    const chunked = Array.from({ length: days }, () => [])
    const size = Math.ceil(flat.length / days)
    flat.forEach((p, i) => chunked[Math.min(days - 1, Math.floor(i / size))].push(p))
    return chunked
  }
  return norm.length ? norm : null
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
function fuzzy(places, name) {
  const n = norm(name)
  if (!n) return null
  return places.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name)))
}
// Parse the AI reply, unwrapping chat envelopes some models return
// (e.g. {role, reasoning, content:"...json..."} or OpenAI {choices:[{message:{content}}]}).
function parseAI(text) {
  let obj = extractJson(text)
  if (!obj) return null
  if (!obj.days && !obj.itinerary && !obj.plan) {
    const content =
      obj.content ??
      obj.choices?.[0]?.message?.content ??
      obj.message?.content ??
      obj.tool_calls?.[0]?.function?.arguments ??
      obj.tool_calls?.[0]?.arguments
    if (typeof content === 'string') {
      const inner = extractJson(content)
      if (inner) obj = inner
    } else if (content && typeof content === 'object') {
      obj = content
    }
  }
  // Last resort: pull a "days":[...] array out of anywhere in the raw text
  // (handles reasoning envelopes that embed the answer in prose/fields).
  if (!obj.days && !obj.itinerary && !obj.plan) {
    const embedded = findDaysArray(text)
    if (embedded) return { days: embedded }
  }
  return obj
}

function findDaysArray(text) {
  const i = text.indexOf('"days"')
  if (i < 0) return null
  const start = text.indexOf('[', i)
  if (start < 0) return null
  let depth = 0
  for (let j = start; j < text.length; j++) {
    const c = text[j]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, j + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
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
