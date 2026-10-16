// Auto-itinerary generator — builds a day-wise plan from live open data.
// It pulls attractions near the destination from Wikipedia, filters them by the
// traveller's interests (matching keywords in each place's description), orders
// them by proximity, and splits them across the requested number of days.
import { geocode, wikiNearby, reverseGeocode } from './places.js'
import { getRegionCities } from './regions.js'

// Interest label (from Settings.INTERESTS) -> keywords to match in a place's
// name/description. Kept broad so real attractions aren't missed.
export const INTEREST_KEYWORDS = {
  '🏖️ Beaches': ['beach', 'coast', 'bay', 'seaside', 'island', 'shore', 'lagoon'],
  '⛰️ Mountains': ['mountain', 'hill', 'peak', 'valley', 'summit', 'hill station', 'plateau', 'cliff'],
  '🏛️ History': ['fort', 'palace', 'monument', 'ruins', 'heritage', 'historic', 'castle', 'archaeolog', 'tomb', 'gate', 'wall'],
  '🍜 Food': ['market', 'bazaar', 'street food', 'brewery', 'winery'],
  '🦁 Wildlife & nature': ['national park', 'wildlife', 'sanctuary', 'zoo', 'reserve', 'forest', 'lake', 'waterfall', 'garden', 'river', 'biosphere'],
  '🌃 Nightlife': ['nightlife', 'bar', 'club', 'casino', 'entertainment'],
  '🛍️ Shopping': ['market', 'bazaar', 'mall', 'shopping'],
  '🎨 Art & culture': ['museum', 'gallery', 'art', 'temple', 'church', 'mosque', 'monastery', 'cathedral', 'shrine', 'cultural', 'theatre'],
  '🧗 Adventure': ['trek', 'adventure', 'rafting', 'diving', 'climbing', 'ski', 'caves', 'cave'],
  '🧘 Relaxation': ['beach', 'spa', 'lake', 'garden', 'park', 'resort'],
}

// Rough, clearly-indicative daily on-ground spend (USD) by tier. There is no
// open cost-of-living API, so this is only a ballpark the user can edit.
export const BUDGET_TIERS = {
  budget: { label: 'Budget', perDay: 45 },
  mid: { label: 'Mid-range', perDay: 110 },
  luxury: { label: 'Luxury', perDay: 260 },
}

// Indicative share of daily spend by category (very rough, editable by user).
export const BUDGET_SPLIT = [
  { key: 'stay', label: 'Stay', emoji: '🏨', pct: 0.42 },
  { key: 'food', label: 'Food', emoji: '🍽️', pct: 0.26 },
  { key: 'transport', label: 'Local transport', emoji: '🚕', pct: 0.16 },
  { key: 'activities', label: 'Activities', emoji: '🎟️', pct: 0.16 },
]

function matchesInterest(place, interests) {
  const hay = `${place.name} ${place.kind}`.toLowerCase()
  return interests.some((i) => (INTEREST_KEYWORDS[i] || []).some((k) => hay.includes(k)))
}

export async function generatePlan({ query, days = 3, interests = [], perDay = 3, allowRegion = true }) {
  // If this is a state/country, suggest cities to plan rather than guessing a
  // centroid (which is usually empty countryside).
  if (allowRegion) {
    const cities = await getRegionCities(query)
    if (cities.length >= 3) return { region: true, place: query, cities }
  }

  const center = await geocode(query)
  if (!center) throw new Error(`Couldn't find "${query}" — try a city name.`)

  const pool = await wikiNearby(center.lat, center.lon, 50)
  if (!pool.length) throw new Error('No attractions found there — try a bigger nearby city.')

  // Filter by interests, but fall back to everything if that leaves too few.
  let picks = interests.length ? pool.filter((p) => matchesInterest(p, interests)) : pool
  if (picks.length < days * 2) picks = pool

  // Prefer places that have a photo (nicer plan), keep the rest as backfill.
  picks = [...picks.filter((p) => p.image), ...picks.filter((p) => !p.image)]
  picks = picks.slice(0, Math.min(picks.length, days * perDay))

  // Order by proximity so each day's stops are near each other, then chunk.
  picks.sort((a, b) => a.lat - b.lat || a.lon - b.lon)
  const chunked = Array.from({ length: days }, () => [])
  const size = Math.max(1, Math.ceil(picks.length / days))
  picks.forEach((p, i) => chunked[Math.min(days - 1, Math.floor(i / size))].push(p))

  let country = null
  try {
    country = await reverseGeocode(center.lat, center.lon)
  } catch {
    /* non-critical */
  }

  return { center, place: query, country, days: chunked }
}
