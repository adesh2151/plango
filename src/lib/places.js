// Live places from OpenStreetMap: Nominatim (geocoding) + Overpass (POIs).
// Data © OpenStreetMap contributors (ODbL). We keep request volume low
// (one geocode + one Overpass query per search) to respect usage policy.
import { getJSON } from './http.js'

// Open-Meteo geocoder — free, no key, fast, proper CORS. (Nominatim sends no
// CORS header and Photon was slow/timed out from some networks.)
const GEOCODER = 'https://geocoding-api.open-meteo.com/v1/search'
// Several public Overpass mirrors — tried in order; some rate-limit or soft-
// block (HTTP 406/429) at times, so we fail over to the next.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export const CATEGORIES = {
  attractions: {
    label: 'Attractions',
    filter: 'tourism~"attraction|museum|viewpoint|zoo|artwork|theme_park|gallery|aquarium"',
  },
  food: {
    label: 'Food & drink',
    filter: 'amenity~"restaurant|cafe|fast_food|bar|pub|ice_cream"',
  },
  hotels: {
    label: 'Stays',
    filter: 'tourism~"hotel|hostel|guest_house|motel|apartment"',
  },
  nature: {
    label: 'Nature & parks',
    filter: 'leisure~"park|garden|nature_reserve"',
  },
}

export async function geocode(query) {
  const q = (query || '').trim()
  if (!q) return null
  const tryName = async (name) => {
    const url = `${GEOCODER}?count=1&language=en&format=json&name=${encodeURIComponent(name)}`
    const data = await getJSON(url, { timeout: 12000 })
    return data?.results?.[0] || null
  }
  // Open-Meteo matches on a place name, so retry with the part before a comma.
  let r = await tryName(q)
  if (!r && q.includes(',')) r = await tryName(q.split(',')[0].trim())
  if (!r) return null
  return { lat: r.latitude, lon: r.longitude, label: [r.name, r.admin1, r.country].filter(Boolean).join(', ') }
}

async function overpass(query) {
  let lastErr
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
      clearTimeout(t)
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`)
        continue
      }
      return await res.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error('Places service is busy right now — please try again in a moment.')
}

export async function nearby(lat, lon, category = 'attractions', radius = 5000) {
  const cat = CATEGORIES[category] || CATEGORIES.attractions
  const q = `[out:json][timeout:25];(nwr[${cat.filter}](around:${radius},${lat},${lon}););out center 60;`
  const data = await overpass(q)
  const seen = new Set()
  const out = []
  for (const el of data.elements || []) {
    const tags = el.tags || {}
    const name = tags.name || tags['name:en']
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({
      id: `${el.type}/${el.id}`,
      name,
      category,
      kind: tags.tourism || tags.amenity || tags.leisure || '',
      cuisine: tags.cuisine || '',
      stars: tags.stars || '',
      website: tags.website || tags['contact:website'] || '',
      phone: tags.phone || tags['contact:phone'] || '',
      wikipedia: tags.wikipedia || '',
      image: tags.image || '',
      openingHours: tags.opening_hours || '',
      fee: tags.fee || '',
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
    })
  }
  return out
}

export async function explore(query, category = 'attractions') {
  const center = await geocode(query)
  if (!center) throw new Error(`Couldn't find "${query}"`)
  const results = await nearby(center.lat, center.lon, category)
  return { center, results }
}
