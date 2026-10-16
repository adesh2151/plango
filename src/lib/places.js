// Live places from OpenStreetMap: Nominatim (geocoding) + Overpass (POIs).
// Data © OpenStreetMap contributors (ODbL). We keep request volume low
// (one geocode + one Overpass query per search) to respect usage policy.
import { getJSON } from './http.js'

// Photon (komoot) geocoder — OSM-based and, unlike Nominatim's public server,
// it returns an Access-Control-Allow-Origin header so browsers can call it.
const GEOCODER = 'https://photon.komoot.io/api/'
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
  if (!query || !query.trim()) return null
  const url = `${GEOCODER}?limit=1&q=${encodeURIComponent(query)}`
  const data = await getJSON(url, { timeout: 15000 })
  const f = data?.features?.[0]
  if (!f) return null
  const [lon, lat] = f.geometry.coordinates
  const p = f.properties || {}
  const label = [p.name, p.city, p.state, p.country].filter(Boolean).join(', ')
  return { lat, lon, label }
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
