import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, addFavorite, addItem } from '../lib/store.js'
import { explore, CATEGORIES } from '../lib/places.js'
import { countryByCode } from '../lib/countries.js'
import { createAmadeus } from '../lib/amadeus.js'
import { PlaceImage, Loading, ErrorBox, Empty, Field } from './ui.jsx'
import { money } from '../lib/format.js'

export default function Explore({ trip, goSettings }) {
  const [tab, setTab] = useState('places')
  return (
    <div>
      <div className="tabbar">
        <button className={tab === 'places' ? 'on' : ''} onClick={() => setTab('places')}>📍 Places</button>
        <button className={tab === 'flights' ? 'on' : ''} onClick={() => setTab('flights')}>✈️ Flights</button>
        <button className={tab === 'hotels' ? 'on' : ''} onClick={() => setTab('hotels')}>🏨 Hotels</button>
      </div>
      {tab === 'places' && <Places trip={trip} />}
      {tab === 'flights' && <Flights trip={trip} goSettings={goSettings} />}
      {tab === 'hotels' && <Hotels trip={trip} goSettings={goSettings} />}
    </div>
  )
}

/* ---------------- Places (OpenStreetMap, free) ---------------- */
function Places({ trip }) {
  const dest = trip.destinations[0]
  const [q, setQ] = useState(dest?.city ? `${dest.city}, ${dest.country?.name}` : '')
  const [cat, setCat] = useState('attractions')
  const [state, setState] = useState({ loading: false, error: null, data: null })
  const touched = useRef(false)

  // If the destination has no city, default the search to its capital so there
  // are actually attractions nearby (a country centroid usually has none).
  useEffect(() => {
    if (dest && !dest.city && !touched.current) {
      countryByCode(dest.country?.cca3).then((c) => {
        if (touched.current || !c) return
        setQ(c.capital ? `${c.capital}, ${c.name}` : c.name)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onEdit = (v) => {
    touched.current = true
    setQ(v)
  }

  const run = async (category = cat) => {
    if (!q.trim()) return
    setState({ loading: true, error: null, data: null })
    try {
      const res = await explore(q, category)
      setState({ loading: false, error: null, data: res })
    } catch (error) {
      setState({ loading: false, error, data: null })
    }
  }

  return (
    <div>
      <div className="card">
        <Field label="Explore a city or area">
          <div className="row">
            <input className="input grow" value={q} placeholder="e.g. Kyoto, Japan" onChange={(e) => onEdit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
            <button className="btn primary" onClick={() => run()}>Search</button>
          </div>
        </Field>
        <div className="row wrap">
          {Object.entries(CATEGORIES).map(([key, c]) => (
            <span key={key} className={`chip ${cat === key ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => { setCat(key); run(key) }}>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {state.loading && <Loading label="Finding places nearby…" />}
      <ErrorBox error={state.error} />
      {state.data && !state.data.results.length && <Empty icon="🔍" title="Nothing found here" hint="Try a different category or a nearby city." />}

      {state.data && state.data.results.length > 0 && (
        <>
          <div className="places">
            {state.data.results.map((p) => (
              <PlaceCard key={p.id} place={p} trip={trip} cityName={q} category={cat} />
            ))}
          </div>
          <div className="credit">Places © OpenStreetMap contributors · photos via Wikipedia</div>
        </>
      )}
    </div>
  )
}

function PlaceCard({ place, trip, cityName, category }) {
  const [saved, setSaved] = useState(false)
  const [added, setAdded] = useState(false)
  const planType = category === 'food' ? 'food' : category === 'hotels' ? 'stay' : 'sight'
  return (
    <div className="place">
      <PlaceImage query={`${place.name} ${cityName.split(',')[0]}`} wikipedia={place.wikipedia} fallback={place.image}>
        {place.kind && <span className="badge">{place.kind.replace(/_/g, ' ')}</span>}
      </PlaceImage>
      <div className="pb">
        <div className="nm">{place.name}</div>
        {(place.cuisine || place.stars) && (
          <div className="small muted">{[place.cuisine?.replace(/;/g, ', '), place.stars && `${place.stars}★`].filter(Boolean).join(' · ')}</div>
        )}
        {place.openingHours && <div className="small muted">🕒 {place.openingHours}</div>}
        {place.fee && <div className="small muted">🎫 {place.fee === 'yes' ? 'Entry fee' : place.fee === 'no' ? 'Free entry' : place.fee}</div>}
        <div className="act">
          <button className="btn sm" disabled={saved} onClick={() => { addFavorite(trip.id, { name: place.name, type: place.kind || category, place: cityName, lat: place.lat, lon: place.lon, wikipedia: place.wikipedia, website: place.website, openingHours: place.openingHours, fee: place.fee }); setSaved(true) }}>
            {saved ? '♥ Saved' : '♡ Save'}
          </button>
          <button className="btn sm" disabled={added} onClick={() => { addItem(trip.id, { type: planType, title: place.name, place: cityName, date: '', time: '', cost: '', currency: trip.baseCurrency, notes: [place.openingHours && `Hours: ${place.openingHours}`, place.fee && `Fee: ${place.fee}`].filter(Boolean).join(' · ') }); setAdded(true) }}>
            {added ? '✓ Planned' : '＋ Plan'}
          </button>
          {place.website && <a className="btn sm ghost" href={place.website} target="_blank" rel="noreferrer">↗</a>}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Flights (Amadeus, keyed) ---------------- */
function useAmadeus() {
  const { settings } = useStore()
  const ready = settings.amadeusId && settings.amadeusSecret
  const api = useMemo(
    () => (ready ? createAmadeus({ id: settings.amadeusId, secret: settings.amadeusSecret, production: settings.amadeusProduction }) : null),
    [settings.amadeusId, settings.amadeusSecret, settings.amadeusProduction, ready],
  )
  return { api, ready }
}

function KeyPrompt({ goSettings }) {
  return (
    <Empty
      icon="🔑"
      title="Add an Amadeus API key to see live flights & hotels"
      hint="It’s free to get a test key. Open Settings → Flights & Hotels and paste your key + secret."
    />
  )
}

function Flights({ trip, goSettings }) {
  const { api, ready } = useAmadeus()
  const dest = trip.destinations[0]
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(dest ? dest.city || dest.country?.name : '')
  const [date, setDate] = useState(trip.startDate || '')
  const [ret, setRet] = useState(trip.endDate || '')
  const [state, setState] = useState({ loading: false, error: null, data: null })

  if (!ready) return <KeyPrompt goSettings={goSettings} />

  const search = async () => {
    setState({ loading: true, error: null, data: null })
    try {
      const [o, d] = await Promise.all([api.locations(from), api.locations(to)])
      const origin = o[0]?.iata
      const destination = d[0]?.iata
      if (!origin || !destination) throw new Error('Could not resolve those cities to airports')
      const offers = await api.flightOffers({ origin, destination, date, returnDate: ret || undefined, currency: trip.baseCurrency })
      setState({ loading: false, error: null, data: { offers, origin, destination } })
    } catch (error) {
      setState({ loading: false, error, data: null })
    }
  }

  return (
    <div>
      <div className="card">
        <div className="two">
          <Field label="From (city/airport)"><input className="input" value={from} placeholder="e.g. Mumbai" onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div className="two">
          <Field label="Depart"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Return (optional)"><input type="date" className="input" value={ret} onChange={(e) => setRet(e.target.value)} /></Field>
        </div>
        <button className="btn primary block" onClick={search} disabled={!from || !to || !date}>Search live flights</button>
      </div>

      {state.loading && <Loading label="Searching Amadeus…" />}
      <ErrorBox error={state.error} />
      {state.data && (
        <>
          <div className="muted small" style={{ margin: '0 2px 8px' }}>{state.data.origin} → {state.data.destination} · {state.data.offers.length} offers</div>
          {state.data.offers.map((o) => (
            <div className="card tight" key={o.id}>
              <div className="row between">
                <strong style={{ fontSize: 18 }}>{money(o.price, o.currency)}</strong>
                <span className="muted small">{o.seats ? `${o.seats} seats` : ''}</span>
              </div>
              {o.itineraries.map((it, i) => (
                <div key={i} className="small" style={{ marginTop: 6 }}>
                  <div className="muted">{i === 0 ? 'Outbound' : 'Return'} · {it.duration} · {it.stops === 0 ? 'nonstop' : `${it.stops} stop(s)`}</div>
                  {it.segments.map((s, j) => (
                    <div key={j}>✈️ {s.from}→{s.to} · {s.carrier} {s.flight} · {new Date(s.depart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div className="credit">Flight data © Amadeus</div>
        </>
      )}
    </div>
  )
}

/* ---------------- Hotels (Amadeus, keyed) ---------------- */
function Hotels({ trip, goSettings }) {
  const { api, ready } = useAmadeus()
  const dest = trip.destinations[0]
  const [city, setCity] = useState(dest ? dest.city || dest.country?.name : '')
  const [state, setState] = useState({ loading: false, error: null, data: null })

  if (!ready) return <KeyPrompt goSettings={goSettings} />

  const search = async () => {
    setState({ loading: true, error: null, data: null })
    try {
      const locs = await api.locations(city)
      const cityCode = locs.find((l) => l.type === 'CITY')?.iata || locs[0]?.iata
      if (!cityCode) throw new Error('Could not resolve that city')
      const hotels = await api.hotelsByCity(cityCode)
      setState({ loading: false, error: null, data: { hotels, cityCode } })
    } catch (error) {
      setState({ loading: false, error, data: null })
    }
  }

  return (
    <div>
      <div className="card">
        <Field label="Hotels in city">
          <div className="row">
            <input className="input grow" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <button className="btn primary" onClick={search}>Search</button>
          </div>
        </Field>
      </div>
      {state.loading && <Loading label="Finding hotels…" />}
      <ErrorBox error={state.error} />
      {state.data && (
        <>
          <div className="places">
            {state.data.hotels.map((h) => (
              <div className="place" key={h.id}>
                <PlaceImage query={`${h.name}`} className="ph" />
                <div className="pb">
                  <div className="nm">{h.name}</div>
                  {h.distance && <div className="small muted">{h.distance} from centre</div>}
                  <div className="act">
                    <button className="btn sm" onClick={() => addFavorite(trip.id, { name: h.name, type: 'hotel', place: city, lat: h.lat, lon: h.lon })}>♡ Save</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="credit">Hotel data © Amadeus</div>
        </>
      )}
    </div>
  )
}
