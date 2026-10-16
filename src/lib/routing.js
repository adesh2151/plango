// Open routing via OSRM demo server (OpenStreetMap data, free, CORS).
import { getJSON } from './http.js'

const OSRM = 'https://router.project-osrm.org'

// Travel durations (minutes) + distance (km) for consecutive points in order.
export async function legDurations(points) {
  if (points.length < 2) return []
  const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
  const d = await getJSON(`${OSRM}/route/v1/driving/${coords}?overview=false`, { timeout: 15000 })
  const legs = d.routes?.[0]?.legs || []
  return legs.map((l) => ({ min: Math.round(l.duration / 60), km: Math.round(l.distance / 100) / 10 }))
}

// Optimal visiting order (keeps the first point as the start). Returns an array
// of original indices in the best order.
export async function optimizeOrder(points) {
  if (points.length < 3) return points.map((_, i) => i)
  const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
  const d = await getJSON(`${OSRM}/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=false`, { timeout: 15000 })
  if (d.code !== 'Ok') throw new Error('Could not optimise the route')
  return d.waypoints
    .map((w, i) => ({ i, pos: w.waypoint_index }))
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.i)
}
