// Editorial ready-made trips (names only; the day plans are generated live from
// open data when chosen). India-first, since most users are Indian.
import { generatePlan } from './itinerary.js'
import { allCountries } from './countries.js'
import { uid, addDays, todayISO } from './format.js'

export const TEMPLATES = [
  { key: 'golden', name: 'Golden Triangle', emoji: '🔺', country: 'India', summary: 'Delhi · Agra · Jaipur · 5 days', cities: [{ city: 'Delhi', days: 2 }, { city: 'Agra', days: 1 }, { city: 'Jaipur', days: 2 }] },
  { key: 'kerala', name: 'Kerala Explorer', emoji: '🌴', country: 'India', summary: 'Kochi · Munnar · Alappuzha · 4 days', cities: [{ city: 'Kochi', days: 1 }, { city: 'Munnar', days: 2 }, { city: 'Alappuzha', days: 1 }] },
  { key: 'rajasthan', name: 'Rajasthan Heritage', emoji: '🏰', country: 'India', summary: 'Jaipur · Jodhpur · Udaipur · 6 days', cities: [{ city: 'Jaipur', days: 2 }, { city: 'Jodhpur', days: 2 }, { city: 'Udaipur', days: 2 }] },
  { key: 'himachal', name: 'Himachal Hills', emoji: '⛰️', country: 'India', summary: 'Shimla · Manali · 5 days', cities: [{ city: 'Shimla', days: 2 }, { city: 'Manali', days: 3 }] },
  { key: 'goa', name: 'Goa Weekend', emoji: '🏖️', country: 'India', summary: 'North Goa · 3 days', cities: [{ city: 'Panaji', days: 1 }, { city: 'Calangute', days: 2 }] },
]

// Builds a multi-city trip from a template. Returns { trip, items } so the
// caller can createTrip + addItem (keeping store access in the component layer).
export async function buildTemplate(tpl, { interests = [], homeCurrency = 'USD' } = {}) {
  const countries = await allCountries()
  const country = countries.find((c) => c.name === tpl.country) || { name: tpl.country, cca2: '', cca3: '', flag: '' }
  const start = todayISO()

  const destinations = []
  const items = []
  let dayOffset = 0
  for (const seg of tpl.cities) {
    let plan
    try {
      plan = await generatePlan({ query: `${seg.city}, ${tpl.country}`, days: seg.days, interests, allowRegion: false })
    } catch {
      plan = { days: [] }
    }
    destinations.push({ id: uid(), country: { name: country.name, cca2: country.cca2, cca3: country.cca3, flag: country.flag }, city: seg.city })
    ;(plan.days || []).forEach((dayPlaces, i) => {
      dayPlaces.forEach((p, order) => {
        items.push({ type: 'sight', title: p.name, place: seg.city, date: addDays(start, dayOffset + i), time: '', cost: '', currency: homeCurrency, lat: p.lat, lon: p.lon, order, notes: p.kind || '' })
      })
    })
    dayOffset += seg.days
  }

  const trip = {
    name: tpl.name,
    destinations,
    coverCca2: country.cca2,
    startDate: start,
    endDate: addDays(start, dayOffset - 1),
    baseCurrency: homeCurrency,
  }
  return { trip, items }
}
