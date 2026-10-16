import { geocode } from '../lib/places.js'
import { Loading, Empty, useAsync } from './ui.jsx'
import MapView from './MapView.jsx'

const FAV_EMOJI = { hotel: '🏨', restaurant: '🍽️', dish: '🍽️', spot: '📸' }

export default function TripMap({ trip }) {
  // Geocode each destination once for the base pins/centre.
  const { data: destPts, loading } = useAsync(async () => {
    const pts = []
    for (const d of trip.destinations) {
      const q = d.city ? `${d.city}, ${d.country?.name}` : d.country?.name
      try {
        const g = await geocode(q)
        if (g) pts.push({ lat: g.lat, lon: g.lon, label: d.city || d.country?.name, sub: d.country?.name, emoji: '📍' })
      } catch {
        /* skip */
      }
    }
    return pts
  }, [trip.id])

  if (loading) return <Loading label="Loading map…" />

  const favPts = (trip.favorites || [])
    .filter((f) => f.lat && f.lon)
    .map((f) => ({ lat: +f.lat, lon: +f.lon, label: f.name, sub: f.place, emoji: FAV_EMOJI[f.type] || '⭐' }))
  const itemPts = (trip.items || [])
    .filter((i) => i.lat && i.lon)
    .map((i) => ({ lat: +i.lat, lon: +i.lon, label: i.title, sub: i.place, emoji: '🗓️' }))

  const points = [...(destPts || []), ...favPts, ...itemPts]

  return (
    <div>
      {!points.length ? (
        <Empty icon="🗺️" title="Nothing to map yet" hint="Add destinations, or save places from Explore, to see them on the map." />
      ) : (
        <>
          <MapView points={points} />
          <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
            <span className="chip">📍 Destinations</span>
            <span className="chip">⭐ Saved places</span>
            <span className="chip">🗓️ Planned stops</span>
          </div>
          <div className="credit">Map © OpenStreetMap contributors</div>
        </>
      )}
    </div>
  )
}
