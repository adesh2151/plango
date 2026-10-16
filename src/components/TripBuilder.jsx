import { useState } from 'react'
import { useStore, createTrip, addItem } from '../lib/store.js'
import { allCountries } from '../lib/countries.js'
import { convertOne } from '../lib/currency.js'
import { generatePlan, BUDGET_TIERS } from '../lib/itinerary.js'
import { refineDays } from '../lib/ai.js'
import { uid, fmtDate, money } from '../lib/format.js'
import { INTERESTS } from './Settings.jsx'
import { PlaceImage, Loading, ErrorBox, Field, useAsync } from './ui.jsx'

// Editorial quick-picks (names only; all data fetched live). India-first.
const QUICK = ['Goa', 'Jaipur', 'Munnar, Kerala', 'Manali', 'Udaipur', 'Rishikesh', 'Mumbai', 'Bali', 'Paris', 'Dubai']
const emojiFor = (kind = '') => {
  const k = kind.toLowerCase()
  if (/temple|church|mosque|shrine|monastery/.test(k)) return '🛕'
  if (/beach|coast|island/.test(k)) return '🏖️'
  if (/mountain|hill|peak/.test(k)) return '⛰️'
  if (/park|wildlife|forest|lake|waterfall|garden/.test(k)) return '🌿'
  if (/museum|gallery|art/.test(k)) return '🖼️'
  if (/fort|palace|castle|monument/.test(k)) return '🏰'
  return '📸'
}
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function TripBuilder({ onClose, onCreated, profile }) {
  const [query, setQuery] = useState('')
  const [days, setDays] = useState(3)
  const [interests, setInterests] = useState(profile.interests || [])
  const [tier, setTier] = useState('mid')
  const [start, setStart] = useState('')
  const [state, setState] = useState({ loading: false, error: null, plan: null })
  const [estimate, setEstimate] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const { data: countries } = useAsync(() => allCountries(), [])

  const aiOptimise = async () => {
    if (!state.plan) return
    setAiBusy(true)
    try {
      const flat = state.plan.days.flat()
      const newDays = await refineDays({ place: state.plan.place, days, interests, places: flat })
      setState((s) => ({ ...s, plan: { ...s.plan, days: newDays, ai: true } }))
    } catch {
      alert('AI is busy right now — keeping your current plan. Try again in a moment.')
    } finally {
      setAiBusy(false)
    }
  }

  const toggle = (i) => setInterests(interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i])

  const generate = async () => {
    if (!query.trim()) return
    setState({ loading: true, error: null, plan: null })
    try {
      const plan = await generatePlan({ query: query.trim(), days, interests })
      setState({ loading: false, error: null, plan })
      const usd = BUDGET_TIERS[tier].perDay * days
      convertOne(usd, 'USD', profile.homeCurrency || 'USD').then((v) => setEstimate(v)).catch(() => setEstimate(usd))
    } catch (error) {
      setState({ loading: false, error, plan: null })
    }
  }

  const save = () => {
    const plan = state.plan
    if (!plan) return
    const rg = plan.country
    const country =
      (countries || []).find((c) => c.cca2 === rg?.countryCode || c.name === rg?.country) ||
      (rg?.country ? { name: rg.country, cca2: rg.countryCode || '', cca3: '', flag: '' } : { name: plan.place, cca2: '', cca3: '', flag: '' })
    const end = start ? addDays(start, days - 1) : ''
    const id = createTrip({
      name: `${days}-day ${plan.place} trip`,
      destinations: [{ id: uid(), country, city: rg?.city || plan.place }],
      coverCca2: country.cca2,
      startDate: start,
      endDate: end,
      baseCurrency: profile.homeCurrency || 'USD',
      budget: Math.round(estimate || 0),
    })
    plan.days.forEach((dayPlaces, i) => {
      dayPlaces.forEach((p) => {
        addItem(id, {
          type: 'sight',
          title: p.name,
          place: plan.place,
          date: start ? addDays(start, i) : '',
          time: '',
          cost: '',
          currency: profile.homeCurrency || 'USD',
          lat: p.lat,
          lon: p.lon,
          notes: [p.kind, p.tip].filter(Boolean).join(' — '),
        })
      })
    })
    onCreated(id)
  }

  return (
    <div>
      <div className="row between" style={{ margin: '2px 0 12px' }}>
        <button className="iconbtn" onClick={onClose} aria-label="Back">←</button>
        <h2 style={{ margin: 0, fontSize: 18 }}>✨ Build my trip</h2>
        <span style={{ width: 40 }} />
      </div>

      <div className="card">
        <Field label="Where to? (city works best)">
          <input className="input" placeholder="e.g. Jaipur, or Goa" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generate()} />
        </Field>
        <div className="row wrap" style={{ marginBottom: 12 }}>
          {QUICK.map((q) => (
            <span key={q} className="chip" style={{ cursor: 'pointer' }} onClick={() => setQuery(q)}>{q}</span>
          ))}
        </div>

        <Field label={`How many days? (${days})`}>
          <div className="row">
            <button className="btn" onClick={() => setDays(Math.max(1, days - 1))}>－</button>
            <input type="range" min="1" max="14" value={days} onChange={(e) => setDays(Number(e.target.value))} className="grow" />
            <button className="btn" onClick={() => setDays(Math.min(14, days + 1))}>＋</button>
          </div>
        </Field>

        <Field label="Interests (what do you like?)">
          <div className="row wrap">
            {INTERESTS.map((i) => (
              <span key={i} className={`chip ${interests.includes(i) ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggle(i)}>{i}</span>
            ))}
          </div>
        </Field>

        <Field label="Budget style">
          <div className="row wrap">
            {Object.entries(BUDGET_TIERS).map(([k, v]) => (
              <span key={k} className={`chip ${tier === k ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTier(k)}>{v.label}</span>
            ))}
          </div>
        </Field>

        <Field label="Start date (optional)">
          <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>

        <button className="btn primary block" onClick={generate} disabled={!query.trim()}>✨ Generate my plan</button>
      </div>

      {state.loading && <Loading label="Building your day-by-day plan…" />}
      <ErrorBox error={state.error} />

      {state.plan && (
        <>
          <div className="card">
            <div className="row between">
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{days}-day plan · {state.plan.place}</div>
                <div className="small muted">{state.plan.country?.country || ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: 'var(--brand)' }}>{estimate != null ? money(estimate, profile.homeCurrency || 'USD') : '…'}</div>
                <div className="small muted">indicative*</div>
              </div>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>*Rough on-ground estimate ({BUDGET_TIERS[tier].label}); real costs vary — no open cost database exists.</div>
          </div>

          {state.plan.days.map((dayPlaces, i) => (
            <div key={i}>
              <div className="day-head"><span className="n">Day {i + 1}</span>{start && <span className="muted small">{fmtDate(addDays(start, i))}</span>}</div>
              {!dayPlaces.length && <div className="muted small" style={{ padding: '2px 4px 8px' }}>Free / flexible day.</div>}
              {dayPlaces.map((p) => (
                <div className="item" key={p.id}>
                  <PlaceImage query={p.name} wikipedia={p.wikipedia} fallback={p.image} className="emoji-img" />
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{emojiFor(p.kind)} {p.name}</div>
                    {p.kind && <div className="small muted">{p.kind}</div>}
                    {p.tip && <div className="small soft" style={{ marginTop: 2 }}>💡 {p.tip}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <button className="btn block" style={{ marginTop: 8 }} onClick={aiOptimise} disabled={aiBusy}>
            {aiBusy ? '✨ AI is optimising your plan…' : state.plan.ai ? '✨ Re-optimise with AI' : '✨ Optimise with AI (free · adds tips)'}
          </button>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn grow" onClick={generate}>🔀 Regenerate</button>
            <button className="btn primary grow" onClick={save}>💾 Save as trip</button>
          </div>
          {state.plan.ai && <div className="credit">AI ordering & tips via Pollinations (open models) · places are real, from Wikipedia</div>}
        </>
      )}
    </div>
  )
}
