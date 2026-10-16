import { useMemo, useRef, useState } from 'react'
import { useStore, createTrip, deleteTrip, addItem } from '../lib/store.js'
import { fmtDate, daysBetween, uid } from '../lib/format.js'
import { flagImg, allCountries } from '../lib/countries.js'
import { wikiNearby, reverseGeocode } from '../lib/places.js'
import { TEMPLATES, buildTemplate } from '../lib/templates.js'
import { Modal, Field, CountryPicker, CurrencyPicker, Empty, PlaceImage, Loading, useAsync } from './ui.jsx'

const TRENDING = [
  { city: 'Paris', country: 'France' }, { city: 'Tokyo', country: 'Japan' }, { city: 'Bali', country: 'Indonesia' },
  { city: 'Dubai', country: 'United Arab Emirates' }, { city: 'Rome', country: 'Italy' }, { city: 'Singapore', country: 'Singapore' },
  { city: 'Istanbul', country: 'Turkey' }, { city: 'Bangkok', country: 'Thailand' }, { city: 'Goa', country: 'India' }, { city: 'Jaipur', country: 'India' },
]
const CATEGORIES = [
  { key: 'beach', emoji: '🏖️', label: 'Beaches', picks: [['Goa', 'India'], ['Bali', 'Indonesia'], ['Phuket', 'Thailand'], ['Andaman Islands', 'India'], ['Maldives', 'Maldives'], ['Gokarna', 'India']] },
  { key: 'mountain', emoji: '⛰️', label: 'Mountains', picks: [['Manali', 'India'], ['Leh', 'India'], ['Pokhara', 'Nepal'], ['Shimla', 'India'], ['Interlaken', 'Switzerland'], ['Queenstown', 'New Zealand']] },
  { key: 'temple', emoji: '🛕', label: 'Temples & heritage', picks: [['Varanasi', 'India'], ['Hampi', 'India'], ['Madurai', 'India'], ['Siem Reap', 'Cambodia'], ['Kyoto', 'Japan'], ['Bagan', 'Myanmar']] },
  { key: 'wildlife', emoji: '🦁', label: 'Wildlife', picks: [['Jim Corbett National Park', 'India'], ['Kaziranga', 'India'], ['Ranthambore', 'India'], ['Serengeti', 'Tanzania'], ['Yala', 'Sri Lanka'], ['Kruger National Park', 'South Africa']] },
  { key: 'city', emoji: '🏙️', label: 'Cities', picks: [['Mumbai', 'India'], ['Delhi', 'India'], ['Dubai', 'United Arab Emirates'], ['Singapore', 'Singapore'], ['London', 'United Kingdom'], ['New York', 'United States']] },
  { key: 'weekend', emoji: '🗓️', label: 'Weekend getaways', picks: [['Lonavala', 'India'], ['Jaipur', 'India'], ['Pondicherry', 'India'], ['Udaipur', 'India'], ['Rishikesh', 'India'], ['Coorg', 'India']] },
]

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

function DestCard({ title, sub, q, onOpenDest }) {
  return (
    <div className="dcard" onClick={() => onOpenDest(q)}>
      <PlaceImage query={q} className="dimg" />
      <div className="dmeta"><div className="t">{title}</div><div className="s">{sub}</div></div>
    </div>
  )
}

export default function Home({ onOpen, onOpenDest, onBuild, onStartTrip }) {
  const { trips, profile, wishlist } = useStore()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState(null)
  const [tripSort, setTripSort] = useState('recent')
  const [buildingTpl, setBuildingTpl] = useState(null)
  useAsync(() => allCountries(), []) // warm the country cache

  const runTemplate = async (tpl) => {
    setBuildingTpl(tpl.name)
    try {
      const { trip, items } = await buildTemplate(tpl, { interests: profile.interests || [], homeCurrency: profile.homeCurrency })
      const id = createTrip(trip)
      items.forEach((it) => addItem(id, it))
      setBuildingTpl(null)
      onOpen(id)
    } catch {
      setBuildingTpl(null)
      alert('Could not build that trip right now — please try again.')
    }
  }

  const sortedTrips = useMemo(() => {
    const arr = [...trips]
    if (tripSort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name))
    else if (tripSort === 'upcoming') arr.sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'))
    else arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return arr
  }, [trips, tripSort])

  const activeCat = CATEGORIES.find((c) => c.key === theme)

  // Placed after all hooks so hook order stays stable (Rules of Hooks).
  if (buildingTpl) {
    return (
      <div style={{ paddingTop: 60 }}>
        <Loading label={`Building your ${buildingTpl} trip…`} />
        <div className="muted small center" style={{ marginTop: 8 }}>Fetching live places for each city — a few seconds.</div>
      </div>
    )
  }

  return (
    <div>
      {/* HERO with search */}
      <div className="hero">
        <PlaceImage query="Santorini" className="heroimg" />
        <div className="heroveil" />
        <div className="hcontent">
          <div className="eyebrow">Plan it, then go ✈</div>
          <h2>Where to next{profile.name ? `, ${profile.name}` : ''}?</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input grow" placeholder="Search a city, state or country…" value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search.trim() && onOpenDest(search.trim())} />
            <button className="btn primary" onClick={() => search.trim() && onOpenDest(search.trim())}>Go</button>
          </div>
          <button className="btn ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.6)' }} onClick={() => onBuild()}>✨ Build my trip for me</button>
        </div>
      </div>

      {/* CATEGORY TILES */}
      <div className="hscroll" style={{ margin: '4px 0 6px' }}>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`cattile ${theme === c.key ? 'on' : ''}`} onClick={() => setTheme(theme === c.key ? null : c.key)}>
            <span className="catemoji">{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {activeCat ? (
        <>
          <div className="sec-head"><h3>{activeCat.emoji} {activeCat.label}</h3><button className="link" onClick={() => setTheme(null)}>Clear</button></div>
          <div className="places">
            {activeCat.picks.map(([city, country]) => (
              <div className="place" key={city} onClick={() => onOpenDest(`${city}, ${country}`)} style={{ cursor: 'pointer' }}>
                <PlaceImage query={`${city} ${country}`} />
                <div className="pb"><div className="nm">{city}</div><div className="small muted">{country}</div></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* READY-MADE TRIPS */}
          <div className="sec-head"><h3>⚡ Ready-made trips</h3><span className="muted small">one tap, then tweak</span></div>
          <Hrow>
            {TEMPLATES.map((t) => (
              <div className="dcard" key={t.key} onClick={() => runTemplate(t)}>
                <PlaceImage query={`${t.cities[0].city} ${t.country}`} className="dimg" />
                <div className="dmeta"><div className="t">{t.emoji} {t.name}</div><div className="s">{t.summary}</div></div>
              </div>
            ))}
          </Hrow>

          {/* NEAR YOU */}
          <NearYou onOpenDest={onOpenDest} />

          {/* TRENDING */}
          <div className="sec-head"><h3>🔥 Trending now</h3></div>
          <Hrow>
            {TRENDING.map((t) => <DestCard key={t.city} title={t.city} sub={t.country} q={`${t.city}, ${t.country}`} onOpenDest={onOpenDest} />)}
          </Hrow>

          {/* A couple of themed previews */}
          {CATEGORIES.slice(0, 3).map((c) => (
            <div key={c.key}>
              <div className="sec-head"><h3>{c.emoji} {c.label}</h3><button className="link" onClick={() => setTheme(c.key)}>See all →</button></div>
              <Hrow>
                {c.picks.slice(0, 6).map(([city, country]) => <DestCard key={city} title={city} sub={country} q={`${city}, ${country}`} onOpenDest={onOpenDest} />)}
              </Hrow>
            </div>
          ))}
        </>
      )}

      {/* WISHLIST */}
      {wishlist.length > 0 && (
        <>
          <div className="sec-head"><h3>♥ Your wishlist</h3></div>
          <Hrow>
            {wishlist.map((w) => <DestCard key={w.key} title={w.name} sub="Saved" q={w.name} onOpenDest={onOpenDest} />)}
          </Hrow>
        </>
      )}

      {/* YOUR TRIPS */}
      <div className="sec-head">
        <h3>🧳 Your trips</h3>
        <div className="row" style={{ gap: 8 }}>
          {trips.length > 1 && (
            <select className="input" style={{ padding: '6px 8px', fontSize: 12.5, width: 'auto' }} value={tripSort} onChange={(e) => setTripSort(e.target.value)}>
              <option value="recent">Recent</option><option value="upcoming">Upcoming</option><option value="name">A–Z</option>
            </select>
          )}
          <button className="link" onClick={() => setCreating(true)}>＋ New</button>
        </div>
      </div>
      {!trips.length && <Empty icon="🗺️" title="No trips yet" hint="Search a place, tap a destination, or ‘Build my trip’ to start." />}
      {sortedTrips.map((t) => <TripCard key={t.id} t={t} onOpen={onOpen} />)}

      <div className="credit" style={{ marginTop: 18 }}>
        Made with ❤️ by <b>Adesh</b> · <a href="https://adesh2151.github.io/" target="_blank" rel="noreferrer">more free apps</a>
      </div>

      {creating && (
        <CreateTripModal defaultCurrency={profile.homeCurrency} onClose={() => setCreating(false)} onCreate={(data) => { const id = createTrip(data); setCreating(false); onOpen(id) }} />
      )}
    </div>
  )
}

function NearYou({ onOpenDest }) {
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
        } catch { setS({ status: 'error' }) }
      },
      (err) => setS({ status: err.code === 1 ? 'denied' : 'error' }),
      { timeout: 12000, maximumAge: 600000 },
    )
  }
  if (s.status === 'idle') return <button className="locbtn" onClick={discover}>📍 Discover attractions near you</button>
  if (s.status === 'loading') return <div className="loadbox"><div className="spinner" /><span>Finding places around you…</span></div>
  if (s.status === 'denied') return <div className="locbtn" style={{ cursor: 'pointer' }} onClick={discover}>📍 Location blocked — tap to allow</div>
  if (s.status === 'error') return <button className="locbtn" onClick={discover}>📍 Couldn’t get location — tap to retry</button>
  const city = s.place?.city || 'you'
  return (
    <>
      <div className="sec-head"><h3>📍 Near {[s.place?.city, s.place?.country].filter(Boolean).join(', ') || 'you'}</h3>
        {s.place?.city && <button className="link" onClick={() => onOpenDest([s.place.city, s.place.country].filter(Boolean).join(', '))}>Explore →</button>}</div>
      {!s.attractions.length ? <div className="muted small" style={{ padding: '0 2px 10px' }}>No notable spots found right here.</div> : (
        <Hrow>
          {s.attractions.map((p) => <DestCard key={p.id} title={p.name} sub={p.kind || 'Attraction'} q={[s.place?.city, s.place?.country].filter(Boolean).join(', ') || p.name} onOpenDest={onOpenDest} />)}
        </Hrow>
      )}
    </>
  )
}

function TripCard({ t, onOpen }) {
  const dest = t.destinations[0]
  const cityQuery = dest ? dest.city || dest.country?.name : t.name
  const remove = (e) => { e.stopPropagation(); if (confirm(`Delete “${t.name}”? This can’t be undone.`)) deleteTrip(t.id) }
  return (
    <div className="card trip-card" onClick={() => onOpen(t.id)}>
      <PlaceImage query={cityQuery} className="cover" fallback={dest ? flagImg(dest.country?.cca2) : ''}>
        <div className="veil" />
        <button className="del" onClick={remove} aria-label="Delete trip">🗑</button>
        <div className="flagrow"><div className="name">{t.destinations.map((d) => d.country?.flag).join(' ')} {t.name}</div></div>
      </PlaceImage>
      <div className="meta">
        <span className="small soft">{t.destinations.map((d) => [d.city, d.country?.name].filter(Boolean).join(', ')).join(' · ') || 'No destinations yet'}</span>
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
  const addDest = () => { if (!country) return; setDests([...dests, { id: uid(), country, city: city.trim() }]); setCity(''); setCountry(null) }
  const submit = () => onCreate({
    name: name.trim() || (dests[0] ? `Trip to ${dests[0].country.name}` : 'New trip'),
    destinations: dests, coverCca2: dests[0]?.country.cca2 || '', startDate: start, endDate: end, baseCurrency: currency, budget: Number(budget) || 0,
  })
  return (
    <Modal title="Plan a new trip" onClose={onClose} footer={<button className="btn primary block" onClick={submit}>Create trip</button>}>
      <Field label="Trip name"><input className="input" placeholder="e.g. Europe summer 2026" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Add destinations">
        <CountryPicker value={country?.cca3} onChange={setCountry} />
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" placeholder="City / region (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
          <button className="btn" onClick={addDest} disabled={!country}>Add</button>
        </div>
      </Field>
      {dests.length > 0 && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
          {dests.map((d) => <span className="chip" key={d.id}>{d.country.flag} {[d.city, d.country.name].filter(Boolean).join(', ')}<button onClick={() => setDests(dests.filter((x) => x.id !== d.id))}>✕</button></span>)}
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
