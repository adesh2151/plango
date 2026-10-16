// Live flights & hotels via the Amadeus Self-Service API.
// Requires the user's own API key + secret (entered in Settings). The free
// "test" environment works out of the box; flip `production` once you have a
// production key. Keys live only in the user's browser (localStorage).
import { getJSON, postForm } from './http.js'

export function createAmadeus({ id, secret, production = false }) {
  const host = production ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com'
  let token = null
  let expiresAt = 0

  async function getToken() {
    if (token && Date.now() < expiresAt - 30000) return token
    const data = await postForm(`${host}/v1/security/oauth2/token`, {
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    })
    token = data.access_token
    expiresAt = Date.now() + (data.expires_in || 1799) * 1000
    return token
  }

  async function authGet(path) {
    const t = await getToken()
    return getJSON(`${host}${path}`, { headers: { Authorization: `Bearer ${t}` }, timeout: 20000 })
  }

  return {
    // Resolve a city/airport name to IATA codes.
    async locations(keyword) {
      const data = await authGet(
        `/v1/reference-data/locations?subType=CITY,AIRPORT&page%5Blimit%5D=8&keyword=${encodeURIComponent(
          keyword,
        )}`,
      )
      return (data.data || []).map((l) => ({
        iata: l.iataCode,
        name: l.name,
        city: l.address?.cityName || '',
        country: l.address?.countryName || '',
        type: l.subType,
      }))
    },

    async flightOffers({ origin, destination, date, returnDate, adults = 1, currency = 'USD', max = 8 }) {
      let path =
        `/v2/shopping/flight-offers?originLocationCode=${origin}` +
        `&destinationLocationCode=${destination}&departureDate=${date}` +
        `&adults=${adults}&currencyCode=${currency}&max=${max}`
      if (returnDate) path += `&returnDate=${returnDate}`
      const data = await authGet(path)
      const dict = data.dictionaries || {}
      return (data.data || []).map((o) => normaliseOffer(o, dict))
    },

    // "Where can I go within budget?" — live flight inspiration search.
    async flightDestinations({ origin, maxPrice, departureDate, duration, oneWay, currency = 'USD' }) {
      let path = `/v1/shopping/flight-destinations?origin=${origin}&currencyCode=${currency}`
      if (maxPrice) path += `&maxPrice=${Math.round(maxPrice)}`
      if (departureDate) path += `&departureDate=${departureDate}`
      if (duration) path += `&duration=${duration}`
      if (oneWay) path += `&oneWay=true`
      const data = await authGet(path)
      return (data.data || []).map((d) => ({
        origin: d.origin,
        destination: d.destination,
        departureDate: d.departureDate,
        returnDate: d.returnDate,
        price: d.price?.total,
        currency: data.meta?.currency || currency,
      }))
    },

    async hotelsByCity(cityCode) {
      const data = await authGet(
        `/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`,
      )
      return (data.data || []).slice(0, 40).map((h) => ({
        id: h.hotelId,
        name: h.name,
        lat: h.geoCode?.latitude,
        lon: h.geoCode?.longitude,
        distance: h.distance ? `${h.distance.value} ${h.distance.unit}` : '',
      }))
    },
  }
}

function normaliseOffer(o, dict) {
  const carriers = dict.carriers || {}
  const itineraries = (o.itineraries || []).map((it) => ({
    duration: prettyDuration(it.duration),
    stops: Math.max(0, (it.segments || []).length - 1),
    segments: (it.segments || []).map((s) => ({
      from: s.departure?.iataCode,
      to: s.arrival?.iataCode,
      depart: s.departure?.at,
      arrive: s.arrival?.at,
      carrier: carriers[s.carrierCode] || s.carrierCode,
      flight: `${s.carrierCode}${s.number}`,
    })),
  }))
  return {
    id: o.id,
    price: o.price?.grandTotal || o.price?.total,
    currency: o.price?.currency,
    seats: o.numberOfBookableSeats,
    itineraries,
  }
}

function prettyDuration(iso) {
  if (!iso) return ''
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso)
  if (!m) return iso
  return `${m[1] ? m[1] + 'h ' : ''}${m[2] ? m[2] + 'm' : ''}`.trim()
}
