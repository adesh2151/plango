import { Suspense, lazy, useEffect, useState } from 'react'
import { useStore, toggleWishlist, isWished } from '../lib/store.js'
import { geocode, wikiNearby, reverseGeocode, nearby } from '../lib/places.js'
import { getRegionCities } from '../lib/regions.js'
import { getWeather } from '../lib/weather.js'
import { getPopularity } from '../lib/popularity.js'
import { getGuide } from '../lib/tips.js'
import { getGallery } from '../lib/images.js'
import { countryByCode, flagImg } from '../lib/countries.js'
import { visaRequirement, STATUS_META } from '../lib/visa.js'
import { PlaceImage, Loading, ErrorBox, Empty, useAsync } from './ui.jsx'
import PlaceDetail from './PlaceDetail.jsx'

const MapView = lazy(() => import('./MapView.jsx'))
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function DestinationPage({ query, onBack, onOpenDest, onBuild, onStartTrip }) {
  const { profile, wishlist } = useStore()
  const passport = profile.passportCca3
  const [detail, setDetail] = useState(null)

  const { data, loading, error } = useAsync(async () => {
    const region = await getRegionCities(query)
    const center = await geocode(query)
    if (!center) throw new Error(`Couldn't find "${query}".`)
    const [weather, things, rg, pop] = await Promise.all([
      getWeather(center.lat, center.lon).catch(() => null),
      wikiNearby(center.lat, center.lon, 18).catch(() => []),
      reverseGeocode(center.lat, center.lon).catch(() => null),
      getPopularity(query).catch(() => null),
    ])
    let country = null
    let visa = null
    if (rg?.countryCode) country = await countryByCode(rg.countryCode).catch(() => null)
    if (passport && country?.cca3) visa = await visaRequirement(passport, country.cca3).catch(() => null)
    return { center, region, weather, things, rg, country, pop }
  }, [query, passport])

  if (loading) return <DestSkeleton onBack={onBack} query={query} />
  if (error) return (<div><TopBar onBack={onBack} /><ErrorBox error={error} /></div>)

  const { center, region, weather, things, rg, country, pop } = data
  const cca2 = country?.cca2 || rg?.countryCode
  const wkey = `dest:${query}`
  const wished = wishlist.some((w) => w.key === wkey)
  const curr = country?.currencies?.[0]
  const visaMeta = data.visa ? STATUS_META[data.visa.status] || STATUS_META.unknown : null

  return (
    <div>
      <TopBar onBack={onBack} />

      <div className="dhero">
        <PlaceImage query={query} className="dhero-img" fallback={cca2 ? flagImg(cca2) : ''} />
        <div className="dhero-veil" />
        <button className={`dheart ${wished ? 'on' : ''}`} onClick={() => toggleWishlist({ key: wkey, name: query, cca2, lat: center.lat, lon: center.lon })} aria-label="Save">
          {wished ? '♥' : '♡'}
        </button>
        <div className="dhero-text">
          <div className="dhero-title">{country?.flag || '📍'} {query}</div>
          <div className="dhero-sub">{[rg?.state, country?.name].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      {/* quick facts */}
      <div className="facts">
        {weather && <div className="fact"><div className="fv">{weather.emoji} {weather.tempNow}°</div><div className="fl">{weather.label}</div></div>}
        {data.visa && <div className="fact"><div className="fv">{visaMeta.emoji}</div><div className="fl">{data.visa.label}</div></div>}
        {curr && <div className="fact"><div className="fv">{curr.symbol || curr.code}</div><div className="fl">{curr.code}</div></div>}
        {pop && <div className="fact"><div className="fv" style={{ fontSize: 14 }}>{stars(pop.stars)}</div><div className="fl">{pop.label}</div></div>}
      </div>

      {weather?.days?.length > 0 && (
        <div className="hscroll" style={{ marginBottom: 6 }}>
          {weather.days.map((d) => (
            <div key={d.date} className="wcard">
              <div className="small muted">{new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div style={{ fontSize: 22 }}>{d.emoji}</div>
              <div className="small"><b>{d.max}°</b> / {d.min}°</div>
            </div>
          ))}
        </div>
      )}

      <button className="btn primary block" style={{ margin: '6px 0 4px' }} onClick={() => onBuild(query)}>✨ Build a trip here</button>
      {country && <button className="btn block" onClick={() => onStartTrip(country, rg?.city || (region.length ? '' : query))}>＋ Start a blank trip here</button>}

      {/* region: top cities */}
      {region.length >= 3 && (
        <>
          <div className="section-title">Top cities in {query}</div>
          <div className="hscroll">
            {region.map((c) => (
              <div className="dcard" key={c.name} onClick={() => onOpenDest(`${c.name}, ${c.region}`)}>
                <PlaceImage query={`${c.name} ${c.region}`} className="dimg" />
                <div className="dmeta"><div className="t">{c.name}</div><div className="s">{c.region}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      <Gallery query={query} />

      {/* things to do */}
      <div className="section-title">Top things to do</div>
      {!things.length ? (
        <Empty icon="🔍" title="Nothing listed here" hint="Try a nearby city." />
      ) : (
        <div className="places">
          {things.map((t) => <ThingCard key={t.id} t={t} onOpen={() => setDetail(t)} />)}
        </div>
      )}
      {detail && <PlaceDetail place={detail} onClose={() => setDetail(null)} />}

      <EatNearby lat={center.lat} lon={center.lon} />
      <GoodToKnow query={query} />

      {/* map */}
      {things.length > 0 && (
        <>
          <div className="section-title">On the map</div>
          <Suspense fallback={<Loading label="Loading map…" />}>
            <MapView points={[{ lat: center.lat, lon: center.lon, label: query, emoji: '📍' }, ...things.filter((t) => t.lat).map((t) => ({ lat: t.lat, lon: t.lon, label: t.name, emoji: '📸' }))]} height="46vh" />
          </Suspense>
        </>
      )}
      <div className="credit">Data © OpenStreetMap, Wikipedia, Wikivoyage · weather Open-Meteo · popularity Wikipedia pageviews</div>
    </div>
  )
}

function ThingCard({ t }) {
  const [pop, setPop] = useState(null)
  useEffect(() => {
    let alive = true
    getPopularity(t.name).then((p) => alive && setPop(p)).catch(() => {})
    return () => { alive = false }
  }, [t.name])
  return (
    <div className="place">
      <PlaceImage query={t.name} wikipedia={t.wikipedia} fallback={t.image}>
        {pop && <span className="badge">{stars(pop.stars)}</span>}
      </PlaceImage>
      <div className="pb">
        <div className="nm">{t.name}</div>
        {t.kind && <div className="small muted">{t.kind}</div>}
      </div>
    </div>
  )
}

function Gallery({ query }) {
  const { data } = useAsync(() => getGallery(query), [query])
  if (!data || !data.length) return null
  return (
    <>
      <div className="section-title">Photos</div>
      <div className="hscroll">
        {data.map((src, i) => <div key={i} className="gimg" style={{ backgroundImage: `url("${src}")` }} />)}
      </div>
    </>
  )
}

function EatNearby({ lat, lon }) {
  const { data } = useAsync(() => nearby(lat, lon, 'food', 4000).catch(() => []), [lat, lon])
  if (!data || !data.length) return null
  return (
    <>
      <div className="section-title">Where to eat nearby</div>
      <div className="hscroll">
        {data.slice(0, 15).map((p) => (
          <div key={p.id} className="dcard" style={{ cursor: 'default' }}>
            <PlaceImage query={p.name} wikipedia={p.wikipedia} fallback={p.image} className="dimg" />
            <div className="dmeta"><div className="t">{p.name}</div><div className="s">{p.cuisine ? p.cuisine.replace(/;/g, ', ') : p.kind || 'Restaurant'}</div></div>
          </div>
        ))}
      </div>
      <div className="credit" style={{ textAlign: 'left' }}>Restaurants © OpenStreetMap contributors</div>
    </>
  )
}

function GoodToKnow({ query }) {
  const { data } = useAsync(() => getGuide(query), [query])
  const [open, setOpen] = useState(-1)
  if (!data?.sections?.length) return null
  return (
    <>
      <div className="section-title">Good to know</div>
      <div className="card">
        {data.sections.map((s, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none', padding: '10px 0' }}>
            <button className="row between" style={{ width: '100%', border: 'none', background: 'none', color: 'var(--text)', padding: 0, fontWeight: 700 }} onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{s.emoji} {s.label}</span><span className="muted">{open === i ? '▾' : '▸'}</span>
            </button>
            {open === i && <div className="small soft" style={{ whiteSpace: 'pre-line', marginTop: 8, lineHeight: 1.6 }}>{s.text}</div>}
          </div>
        ))}
        {data.url && <a className="small" href={data.url} target="_blank" rel="noreferrer">Full guide on Wikivoyage ↗</a>}
      </div>
    </>
  )
}

function TopBar({ onBack }) {
  return (
    <div className="row between" style={{ margin: '2px 0 10px' }}>
      <button className="iconbtn" onClick={onBack} aria-label="Back">←</button>
      <span className="muted small">Destination</span>
      <span style={{ width: 40 }} />
    </div>
  )
}

function DestSkeleton({ onBack, query }) {
  return (
    <div>
      <TopBar onBack={onBack} />
      <div className="dhero skeleton" />
      <Loading label={`Loading ${query}…`} />
    </div>
  )
}
