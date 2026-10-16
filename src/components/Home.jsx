import { useMemo, useRef, useState } from 'react'
import { useStore, createTrip, deleteTrip } from '../lib/store.js'
import { fmtDate, daysBetween, uid } from '../lib/format.js'
import { flagImg, allCountries } from '../lib/countries.js'
import { wikiNearby, reverseGeocode } from '../lib/places.js'
import { Modal, Field, CountryPicker, CurrencyPicker, Empty, PlaceImage, useAsync } from './ui.jsx'
import TripBuilder from './TripBuilder.jsx'

function Hrow({ children }) {
  const ref = useRef(null)
  const by = (d) => ref.current?.scrollBy({ left: d * 230, behavior: 'smooth' })
  return (
    <div className="hrow">
      <button className="harr left" onClick={() => by(-1)} aria-label="Scroll left">‹</button>
      <div className="hscroll" ref={ref}>{children}</div>
      <button className="harr right" onClick={() => by(1)} aria-label="Scroll right">›</button>
    </div>
  )
}

// Editorial inspiration list — just names; the photo & info are fetched live.
const TRENDING = [
  { city: 'Paris', country: 'France' },
  { city: 'Tokyo', country: 'Japan' },
  { city: 'Bali', country: 'Indonesia' },
  { city: 'Dubai', country: 'United Arab Emirates' },
  { city: 'Rome', country: 'Italy' },
  { city: 'Singapore', country: 'Singapore' },
  { city: 'London', country: 'United Kingdom' },
  { city: 'New York', country: 'United States' },
  { city: 'Bangkok', country: 'Thailand' },
  { city: 'Cape Town', country: 'South Africa' },
  { city: 'Istanbul', country: 'Turkey' },
  { city: 'Barcelona', country: 'Spain' },
  { city: 'Kyoto', country: 'Japan' },
  { city: 'Cairo', country: 'Egypt' },
  { city: 'Goa', country: 'India' },
  { city: 'Jaipur', country: 'India' },
  { city: 'Queenstown', country: 'New Zealand' },
  { city: 'Lisbon', country: 'Portugal' },
]

export default function Home({ onOpen, onStartTrip }) {
  const { trips, profile } = useStore()
  const [creating, setCreating] = useState(false)
  const [building, setBuilding] = useState(false)
  const [tripSort, setTripSort] = useState('recent')
  const { data: countries } = useAsync(() => allCountries(), [])

  const sortedTrips = useMemo(() => {
    const arr = [...trips]
    if (tripSort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name))
    else if (tripSort === 'upcoming') arr.sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'))
    else arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return arr
  }, [trips, tripSort])

  if (building) return <TripBuilder profile={profile} onClose={() => setBuilding(false)} onCreated={(id) => { setBuilding(false); onOpen(id) }} />

  const findCountry = (name, code) =>
    (countries || []).find((c) => c.cca2 === code || c.name === name) ||
    (countries || []).find((c) => c.name.toLowerCase().includes((name || '').toLowerCase()))

  const startByName = (city, countryName) => {
    const c = findCountry(countryName)
    if (c) onStartTrip(c, city)
    else setCreating(true)
  }

  return (
    <div>
      {/* HERO */}
      <div className="hero">
        <PlaceImage query="Paris" className="heroimg" />
        <div className="heroveil" />
        <div className="hcontent">
          <div className="eyebrow">Plan it, then go ✈</div>
          <h2>Where to next{profile.name ? `, ${profile.name}` : ''}?</h2>
          <p>Tell me where &amp; how many days — I’ll build a day-by-day plan. Or start from scratch.</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => setBuilding(true)}>✨ Build my trip</button>
            <button className="btn ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.6)' }} onClick={() => setCreating(true)}>Start blank</button>
          </div>
        </div>
      </div>

      {/* NEAR YOU */}
      <NearYou onStartTrip={onStartTrip} findCountry={findCountry} />

      {/* TRENDING */}
      <div className="sec-head"><h3>🔥 Trending destinations</h3><button className="link" onClick={() => setBuilding(true)}>Plan one →</button></div>
      <Hrow>
        {TRENDING.map((t) => (
          <div className="dcard" key={t.city} onClick={() => startByName(t.city, t.country)}>
            <PlaceImage query={`${t.city} ${t.country}`} className="dimg" />
            <div className="dmeta"><div className="t">{t.city}</div><div className="s">{t.country}</div></div>
          </div>
        ))}
      </Hrow>

      {/* YOUR TRIPS */}
      <div className="sec-head">
        <h3>🧳 Your trips</h3>
        <div className="row" style={{ gap: 8 }}>
          {trips.length > 1 && (
            <select className="input" style={{ padding: '6px 8px', fontSize: 12.5, width: 'auto' }} value={tripSort} onChange={(e) => setTripSort(e.target.value)}>
              <option value="recent">Recent</option>
              <option value="upcoming">Upcoming</option>
              <option value="name">A–Z</option>
            </select>
          )}
          {trips.length > 0 && <button className="link" onClick={() => setCreating(true)}>＋ New</button>}
        </div>
      </div>
      {!trips.length && <Empty icon="🗺️" title="No trips yet" hint="Tap ‘Plan a trip’, or pick a destination above to start instantly." />}
      {sortedTrips.map((t) => <TripCard key={t.id} t={t} onOpen={onOpen} />)}

      {creating && (
        <CreateTripModal
          defaultCurrency={profile.homeCurrency}
          onClose={() => setCreating(false)}
          onCreate={(data) => {
            const id = createTrip(data)
            setCreating(false)
            onOpen(id)
          }}
        />
      )}
    </div>
  )
}

function NearYou({ onStartTrip, findCountry }) {
  const [s, setS] = useState({ status: 'idle' })

  const discover = () => {
    if (!navigator.geolocation) return setS({ status: 'error' })
    setS({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const [place, attractions] = await Promise.all([
            reverseGeocode(latitude, longitude).catch(() => null),
            wikiNearby(latitude, longitude).catch(() => []),
          ])
          setS({ status: 'done', place, attractions })
        } catch {
          setS({ status: 'error' })
        }
      },
      (err) => setS({ status: err.code === 1 ? 'denied' : 'error' }),
      { timeout: 12000, maximumAge: 600000 },
    )
  }

  if (s.status === 'idle')
    return <button className="locbtn" onClick={discover}>📍 Discover attractions near you</button>
  if (s.status === 'loading')
    return <div className="loadbox"><div className="spinner" /><span>Finding places around you…</span></div>
  if (s.status === 'denied')
    return <div className="locbtn" style={{ cursor: 'pointer' }} onClick={discover}>📍 Location blocked — tap to allow &amp; see what’s nearby</div>
  if (s.status === 'error')
    return <button className="locbtn" onClick={discover}>📍 Couldn’t get location — tap to retry</button>

  const place = s.place
  const label = place ? [place.city, place.country].filter(Boolean).join(', ') : 'you'
  const plan = () => {
    const c = place && findCountry(place.country, place.countryCode)
    if (c) onStartTrip(c, place.city)
  }
  return (
    <>
      <div className="sec-head">
        <h3>📍 Near {label}</h3>
        {place?.country && <button className="link" onClick={plan}>Plan a trip here</button>}
      </div>
      {!s.attractions.length ? (
        <div className="muted small" style={{ padding: '0 2px 10px' }}>No notable spots found right here — try Trending below.</div>
      ) : (
        <Hrow>
          {s.attractions.map((p) => (
            <div className="dcard" key={p.id} onClick={plan}>
              <PlaceImage query={p.name} wikipedia={p.wikipedia} fallback={p.image} className="dimg" />
              <div className="dmeta"><div className="t">{p.name}</div><div className="s">{p.kind || 'Attraction'}</div></div>
            </div>
          ))}
        </Hrow>
      )}
    </>
  )
}

function TripCard({ t, onOpen }) {
  const dest = t.destinations[0]
  const cityQuery = dest ? dest.city || dest.country?.name : t.name
  const remove = (e) => {
    e.stopPropagation()
    if (confirm(`Delete “${t.name}”? This can’t be undone.`)) deleteTrip(t.id)
  }
  return (
    <div className="card trip-card" onClick={() => onOpen(t.id)}>
      <PlaceImage query={cityQuery} className="cover" fallback={dest ? flagImg(dest.country?.cca2) : ''}>
        <div className="veil" />
        <button className="del" onClick={remove} aria-label="Delete trip">🗑</button>
        <div className="flagrow">
          <div className="name">{t.destinations.map((d) => d.country?.flag).join(' ')} {t.name}</div>
        </div>
      </PlaceImage>
      <div className="meta">
        <span className="small soft">
          {t.destinations.map((d) => [d.city, d.country?.name].filter(Boolean).join(', ')).join(' · ') || 'No destinations yet'}
        </span>
        <div className="row small muted" style={{ marginTop: 4, gap: 14 }}>
          <span>📅 {t.startDate ? `${fmtDate(t.startDate)} · ${daysBetween(t.startDate, t.endDate)}d` : 'Dates TBD'}</span>
          <span>👥 {t.travelers.length}</span>
          <span>💰 {t.baseCurrency}</span>
        </div>
      </div>
    </div>
  )
}

function CreateTripModal({ onClose, onCreate, defaultCurrency }) {
  const [name, setName] = useState('')
  const [dests, setDests] = useState([])
  const [country, setCountry] = useState(null)
  const [city, setCity] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency || 'USD')
  const [budget, setBudget] = useState('')

  const addDest = () => {
    if (!country) return
    setDests([...dests, { id: uid(), country, city: city.trim() }])
    setCity('')
    setCountry(null)
  }

  const submit = () => {
    onCreate({
      name: name.trim() || (dests[0] ? `Trip to ${dests[0].country.name}` : 'New trip'),
      destinations: dests,
      coverCca2: dests[0]?.country.cca2 || '',
      startDate: start,
      endDate: end,
      baseCurrency: currency,
      budget: Number(budget) || 0,
    })
  }

  return (
    <Modal title="Plan a new trip" onClose={onClose} footer={<button className="btn primary block" onClick={submit}>Create trip</button>}>
      <Field label="Trip name">
        <input className="input" placeholder="e.g. Europe summer 2026" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Add destinations">
        <CountryPicker value={country?.cca3} onChange={setCountry} />
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" placeholder="City / region (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
          <button className="btn" onClick={addDest} disabled={!country}>Add</button>
        </div>
      </Field>
      {dests.length > 0 && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
          {dests.map((d) => (
            <span className="chip" key={d.id}>
              {d.country.flag} {[d.city, d.country.name].filter(Boolean).join(', ')}
              <button onClick={() => setDests(dests.filter((x) => x.id !== d.id))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="two">
        <Field label="Start date"><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End date"><input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="two">
        <Field label="Trip currency"><CurrencyPicker value={currency} onChange={setCurrency} /></Field>
        <Field label="Budget (optional)"><input type="number" className="input" placeholder="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
