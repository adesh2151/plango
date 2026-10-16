import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Open-source interactive map: Leaflet + OpenStreetMap tiles. Pins use emoji
// divIcons so we don't depend on Leaflet's bundled marker images.
export default function MapView({ points = [], height = '58vh' }) {
  const el = useRef(null)

  useEffect(() => {
    if (!el.current) return
    const pts = points.filter((p) => p.lat != null && p.lon != null)
    const start = pts[0] ? [pts[0].lat, pts[0].lon] : [20, 0]
    const map = L.map(el.current, { scrollWheelZoom: false }).setView(start, pts.length ? 11 : 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    const coords = []
    for (const p of pts) {
      const icon = L.divIcon({
        className: 'plango-pin',
        html: `<span>${p.emoji || '📍'}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26],
      })
      const m = L.marker([p.lat, p.lon], { icon }).addTo(map)
      if (p.label) m.bindPopup(`<b>${escapeHtml(p.label)}</b>${p.sub ? `<br>${escapeHtml(p.sub)}` : ''}`)
      coords.push([p.lat, p.lon])
    }
    if (coords.length > 1) map.fitBounds(coords, { padding: [36, 36] })

    // Leaflet needs a size recalc once the container is laid out.
    setTimeout(() => map.invalidateSize(), 200)
    return () => map.remove()
  }, [points])

  return <div ref={el} className="mapbox" style={{ height }} />
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
