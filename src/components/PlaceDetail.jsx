import { Suspense, lazy } from 'react'
import { wikiImage } from '../lib/images.js'
import { getPopularity } from '../lib/popularity.js'
import { Modal, Loading, useAsync } from './ui.jsx'

const MapView = lazy(() => import('./MapView.jsx'))
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

// place: { name, lat?, lon?, wikipedia?, kind?, openingHours?, fee?, image? }
export default function PlaceDetail({ place, onClose, actions }) {
  const { data, loading } = useAsync(async () => {
    const [img, pop] = await Promise.all([
      wikiImage(place.wikipedia || place.name).catch(() => null),
      getPopularity(place.name).catch(() => null),
    ])
    return { img, pop }
  }, [place.name, place.wikipedia])

  const img = data?.img
  const hero = img?.full || img?.thumb || place.image

  return (
    <Modal title={place.name} onClose={onClose} footer={actions}>
      {hero ? (
        <div className="detail-hero" style={{ backgroundImage: `url("${hero}")` }} />
      ) : (
        <div className="detail-hero skeleton" style={{ display: 'grid', placeItems: 'center', fontSize: 40 }}>🏙️</div>
      )}

      <div className="row wrap" style={{ gap: 8, margin: '12px 0' }}>
        {place.kind && <span className="chip">{String(place.kind).replace(/_/g, ' ')}</span>}
        {data?.pop && <span className="chip">{stars(data.pop.stars)} {data.pop.label}</span>}
        {place.openingHours && <span className="chip">🕒 {place.openingHours}</span>}
        {place.fee && <span className="chip">🎫 {place.fee === 'yes' ? 'Entry fee' : place.fee === 'no' ? 'Free' : place.fee}</span>}
      </div>

      {loading && <Loading label="Loading details…" />}
      {img?.extract && <p className="soft" style={{ lineHeight: 1.6 }}>{img.extract}</p>}
      {!loading && !img?.extract && <p className="muted small">No description found for this spot.</p>}

      {place.lat && place.lon && (
        <Suspense fallback={<Loading label="Loading map…" />}>
          <MapView points={[{ lat: place.lat, lon: place.lon, label: place.name, emoji: '📍' }]} height="38vh" />
        </Suspense>
      )}

      <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
        {img?.page && <a className="btn sm" href={img.page} target="_blank" rel="noreferrer">Wikipedia ↗</a>}
        {place.lat && place.lon && (
          <a className="btn sm" href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=15/${place.lat}/${place.lon}`} target="_blank" rel="noreferrer">Open map ↗</a>
        )}
        {place.lat && place.lon && (
          <a className="btn sm" href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`} target="_blank" rel="noreferrer">Directions ↗</a>
        )}
      </div>
      <div className="credit" style={{ textAlign: 'left' }}>Info & photo via Wikipedia · popularity from pageviews</div>
    </Modal>
  )
}
