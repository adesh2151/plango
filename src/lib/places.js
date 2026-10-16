// Live places from OpenStreetMap: Nominatim (geocoding) + Overpass (POIs).
// Data © OpenStreetMap contributors (ODbL). We keep request volume low
// (one geocode + one Overpass query per search) to respect usage policy.
import { getJSON } from './http.js'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OVERPASS = 'https://overpass-api.de/api/interpreter'

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
  const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  const data = await getJSON(url, { timeout: 15000 })
  if (!Array.isArray(data) || !data.length) return null
  const r = data[0]
  return { lat: Number(r.lat), lon: Number(r.lon), label: r.display_name }
}

export async function nearby(lat, lon, category = 'attractions', radius = 5000) {
  const cat = CATEGORIES[category] || CATEGORIES.attractions
  const q = `[out:json][timeout:25];(nwr[${cat.filter}](around:${radius},${lat},${lon}););out center 60;`
  const url = `${OVERPASS}?data=${encodeURIComponent(q)}`
  const data = await getJSON(url, { timeout: 30000 })
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
