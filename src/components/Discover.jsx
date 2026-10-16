import { useState } from 'react'
import { useStore, createTrip } from '../lib/store.js'
import { allCountries } from '../lib/countries.js'
import { loadMatrix, classify, STATUS_META } from '../lib/visa.js'
import { createAmadeus } from '../lib/amadeus.js'
import { money, uid } from '../lib/format.js'
import { PlaceImage, Loading, ErrorBox, Empty, Field, useAsync, Toolbar } from './ui.jsx'
import World from './World.jsx'

const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']
const VISA_FILTERS = [
  { key: 'any', label: 'Any' },
  { key: 'free', label: 'Visa-free' },
  { key: 'freevoa', label: 'Free / on arrival' },
  { key: 'easy', label: 'Easy (free / VOA / e-Visa)' },
]
const matchVisa = (status, filter) => {
  if (filter === 'any') return true
  if (filter === 'free') return status === 'visa-free'
  if (filter === 'freevoa') return ['visa-free', 'voa'].includes(status)
  if (filter === 'easy') return ['visa-free', 'voa', 'evisa'].includes(status)
  return true
}

export default function Discover({ onStartTrip }) {
  const { settings } = useStore()
  const hasAmadeus = settings.amadeusId && settings.amadeusSecret
  const [mode, setMode] = useState('visa')
  return (
    <div>
      <h2 style={{ margin: '4px 2px 2px' }}>Discover</h2>
      <div className="muted small" style={{ margin: '0 2px 14px' }}>Can’t decide where to go? Let PlanGo suggest — live.</div>
      <div className="tabbar">
        <button className={mode === 'visa' ? 'on' : ''} onClick={() => setMode('visa')}>🛂 Where to go</button>
        {hasAmadeus && <button className={mode === 'budget' ? 'on' : ''} onClick={() => setMode('budget')}>💸 By budget</button>}
        <button className={mode === 'ref' ? 'on' : ''} onClick={() => setMode('ref')}>🌍 Visa &amp; money</button>
      </div>
      {mode === 'visa' && <ByVisa onStartTrip={onStartTrip} />}
      {mode === 'budget' && hasAmadeus && <ByBudget onStartTrip={onStartTrip} />}
      {mode === 'ref' && <World embedded />}
    </div>
  )
}

/* ---------- keyless: filter live countries by passport visa-ease + region ---------- */
function ByVisa({ onStartTrip }) {
  const { profile } = useStore()
  const passport = profile.passportCca3
  const [region, setRegion] = useState('')
  const [filter, setFilter] = useState(passport ? 'freevoa' : 'any')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')

  const { data, loading, error } = useAsync(async () => {
    const [list, matrix] = await Promise.all([allCountries(), passport ? loadMatrix() : null])
    return { list, row: matrix ? matrix[passport] || {} : null }
  }, [passport])

  if (loading) return <Loading label="Loading destinations…" />
  if (error) return <ErrorBox error={error} />

  const results = (data.list || [])
    .filter((c) => c.cca3 !== passport)
    .filter((c) => (region ? c.region === region : true))
    .map((c) => {
      const v = data.row ? classify(data.row[c.cca3]) : null
      return { ...c, visa: v }
    })
    .filter((c) => (data.row ? matchVisa(c.visa?.status, filter) : true))

  let shown = results
  if (q.trim()) {
    const s = q.toLowerCase()
    shown = shown.filter((c) => c.name.toLowerCase().includes(s) || (c.capital || '').toLowerCase().includes(s))
  }
  shown = [...shown].sort((a, b) => (sort === 'region' ? a.region.localeCompare(b.region) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)))

  return (
    <div>
      <div className="card">
        <div className="two">
          <Field label="Continent">
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Anywhere</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Visa ease">
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!passport}>
              {VISA_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
        </div>
        {!passport && <div className="small muted">Set your passport in Settings to filter by visa ease.</div>}
        <div className="small soft">{shown.length} destinations match</div>
      </div>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Search a country or capital…"
        sort={sort}
        onSort={setSort}
        sorts={[{ key: 'name', label: 'A–Z' }, { key: 'region', label: 'By continent' }]}
      />

      {!shown.length && <Empty icon="🗺️" title="No matches" hint="Try a different continent, loosen the visa filter, or clear the search." />}

      <div className="places">
        {shown.slice(0, 60).map((c) => {
          const meta = c.visa ? STATUS_META[c.visa.status] || STATUS_META.unknown : null
          return (
            <div className="place" key={c.cca3}>
              <PlaceImage query={c.name} fallback={c.flagImg}>
                {c.visa && <span className="badge" style={{ background: meta.color }}>{meta.emoji} {c.visa.label}</span>}
              </PlaceImage>
              <div className="pb">
                <div className="nm">{c.flag} {c.name}</div>
                <div className="small muted">{c.capital || c.subregion} · {c.currencies[0]?.code || ''}</div>
                <div className="act">
                  <button className="btn sm primary" onClick={() => onStartTrip(c)}>✈️ Plan this</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="credit">Visa data © Passport Index (ODbL) · facts © mledoze/countries · photos via Wikipedia</div>
    </div>
  )
}

/* ---------- keyed: Amadeus flight inspiration within budget ---------- */
function ByBudget({ onStartTrip }) {
  const { settings, profile } = useStore()
  const ready = settings.amadeusId && settings.amadeusSecret
  const [origin, setOrigin] = useState('')
  const [budget, setBudget] = useState('')
  const [days, setDays] = useState('')
  const [state, setState] = useState({ loading: false, error: null, data: null })

  if (!ready) {
    return (
      <Empty
        icon="🔑"
        title="Add an Amadeus key for live budget suggestions"
        hint="Free test key at developers.amadeus.com → Settings → Flights & Hotels. Then search real destinations within your budget."
      />
    )
  }

  const api = createAmadeus({ id: settings.amadeusId, secret: settings.amadeusSecret, production: settings.amadeusProduction })

  const search = async () => {
    setState({ loading: true, error: null, data: null })
    try {
      const locs = await api.locations(origin)
      const code = locs.find((l) => l.type === 'CITY')?.iata || locs[0]?.iata
      if (!code) throw new Error('Could not resolve your origin city')
      const dests = await api.flightDestinations({
        origin: code,
        maxPrice: Number(budget) || undefined,
        duration: days ? Number(days) : undefined,
        currency: profile.homeCurrency,
      })
      setState({ loading: false, error: null, data: { dests, code } })
    } catch (error) {
      setState({ loading: false, error, data: null })
    }
  }

  return (
    <div>
      <div className="card">
        <Field label="Flying from (city)"><input className="input" placeholder="e.g. Mumbai" value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
        <div className="two">
          <Field label={`Max budget (${profile.homeCurrency})`}><input type="number" className="input" placeholder="e.g. 30000" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label="Trip length (days)"><input type="number" className="input" placeholder="e.g. 6" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        </div>
        <button className="btn primary block" onClick={search} disabled={!origin}>Find destinations I can afford</button>
      </div>

      {state.loading && <Loading label="Searching live flight deals…" />}
      <ErrorBox error={state.error} />
      {state.data && !state.data.dests.length && <Empty icon="💸" title="No destinations in range" hint="Raise the budget or change origin/length." />}

      <div className="places">
        {(state.data?.dests || []).map((d) => (
          <BudgetCard key={d.destination} d={d} api={api} onStartTrip={onStartTrip} />
        ))}
      </div>
      {state.data?.dests?.length > 0 && <div className="credit">Flight prices © Amadeus · photos via Wikipedia</div>}
    </div>
  )
}

function BudgetCard({ d, api, onStartTrip }) {
  const { data: info } = useAsync(async () => {
    const locs = await api.locations(d.destination).catch(() => [])
    const l = locs[0]
    const country = l?.country ? (await allCountries()).find((c) => c.name === l.country || c.cca2 === l.country) : null
    return { city: l?.city || l?.name || d.destination, country }
  }, [d.destination])

  return (
    <div className="place">
      <PlaceImage query={info?.city || d.destination}>
        <span className="badge">{d.destination}</span>
      </PlaceImage>
      <div className="pb">
        <div className="nm">{info?.country?.flag || '📍'} {info?.city || d.destination}</div>
        <div className="small muted">{d.departureDate}{d.returnDate ? ` → ${d.returnDate}` : ''}</div>
        <div className="small" style={{ fontWeight: 800, color: 'var(--brand)' }}>{money(d.price, d.currency)}</div>
        <div className="act">
          <button className="btn sm primary" disabled={!info?.country} onClick={() => onStartTrip(info.country, info.city)}>✈️ Plan this</button>
        </div>
      </div>
    </div>
  )
}
