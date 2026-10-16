// Live places from OpenStreetMap: Nominatim (geocoding) + Overpass (POIs).
// Data © OpenStreetMap contributors (ODbL). We keep request volume low
// (one geocode + one Overpass query per search) to respect usage policy.
import { getJSON } from './http.js'

// Photon geocoder (open-source, OSM-based, proper CORS). Chosen over Open-Meteo
// because Open-Meteo mis-matches many place names (e.g. Goa -> Genoa, Italy),
// which is unacceptable for a travel app. Nominatim sends no CORS header.
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

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
// Non-place articles that geosearch sometimes returns (events at a location).
const NOT_A_PLACE = /\b(battle|rebellion|siege|war|uprising|massacre|treaty|election|incident|campaign|dynasty|constituency|parliamentary|legislative|assembly)\b/i

// Attractions near a point, straight from Wikipedia — fast, reliable CORS, and
// each result already carries a photo + description. Great for sightseeing.
export async function wikiNearby(lat, lon, limit = 28) {
  const url =
    `${WIKI_API}?action=query&format=json&origin=*&generator=geosearch` +
    `&ggscoord=${lat}%7C${lon}&ggsradius=10000&ggslimit=${limit}` +
    `&prop=pageimages%7Cdescription%7Ccoordinates&piprop=thumbnail&pithumbsize=400`
  const data = await getJSON(url, { timeout: 12000 })
  const pages = Object.values(data?.query?.pages || {})
  return pages
    .filter((p) => p.coordinates && p.coordinates.length)
    .filter((p) => !NOT_A_PLACE.test(p.description || ''))
    .map((p) => ({
      id: `wiki/${p.pageid}`,
      name: p.title,
      category: 'attractions',
      kind: p.description || '',
      wikipedia: `en:${p.title}`,
      image: p.thumbnail?.source || '',
      lat: p.coordinates[0].lat,
      lon: p.coordinates[0].lon,
    }))
    .sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0))
}

// Reverse geocode (coords -> city/state/country) for the "near you" feature,
// via Photon (open-source, OSM-based).
export async function reverseGeocode(lat, lon) {
  const d = await getJSON(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`, { timeout: 12000 })
  const p = d?.features?.[0]?.properties || {}
  return {
    city: p.city || p.town || p.village || p.county || p.name || '',
    state: p.state || '',
    country: p.country || '',
    countryCode: (p.countrycode || '').toUpperCase(),
  }
}

export async function geocode(query) {
  const q = (query || '').trim()
  if (!q) return null
  const url = `${GEOCODER}?limit=1&q=${encodeURIComponent(q)}`
  const data = await getJSON(url, { timeout: 12000 })
  const f = data?.features?.[0]
  if (!f) return null
  const [lon, lat] = f.geometry.coordinates
  const p = f.properties || {}
  return { lat, lon, label: [p.name, p.state, p.country].filter(Boolean).join(', ') }
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
  if (!center) throw new Error(`Couldn't find "${query}" — try a city name.`)
  // Attractions come from Wikipedia (reliable + photos). Food/stays/nature come
  // from OpenStreetMap via Overpass, widening the radius if the first pass is empty.
  if (category === 'attractions') {
    return { center, results: await wikiNearby(center.lat, center.lon) }
  }
  let results = await nearby(center.lat, center.lon, category, 12000)
  if (!results.length) results = await nearby(center.lat, center.lon, category, 40000)
  return { center, results }
}
