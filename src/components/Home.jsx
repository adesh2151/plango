import { useState } from 'react'
import { useStore, createTrip } from '../lib/store.js'
import { fmtDate, daysBetween } from '../lib/format.js'
import { uid } from '../lib/format.js'
import { Modal, Field, CountryPicker, CurrencyPicker, Empty, PlaceImage } from './ui.jsx'

export default function Home({ onOpen }) {
  const { trips, profile } = useStore()
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <div className="row between" style={{ margin: '4px 2px 12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Your trips</h2>
          <div className="muted small">
            {trips.length ? `${trips.length} planned` : 'Start planning your next journey'}
          </div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          ＋ New trip
        </button>
      </div>

      {!trips.length && (
        <Empty
          icon="✈️"
          title="No trips yet"
          hint="Create a trip, add destinations, and plan days, budget, places and visas — all with live data."
        />
      )}

      {trips.map((t) => {
        const dest = t.destinations[0]
        const cityQuery = dest ? `${dest.city || dest.country?.name}` : t.name
        return (
          <div className="card trip-card" key={t.id} onClick={() => onOpen(t.id)}>
            <PlaceImage query={cityQuery} className="cover">
              <div className="veil" />
              <div className="flagrow">
                <div className="name">
                  {t.destinations.map((d) => d.country?.flag).join(' ')} {t.name}
                </div>
              </div>
            </PlaceImage>
            <div className="meta">
              <div className="row between">
                <span className="small soft">
                  {t.destinations.map((d) => [d.city, d.country?.name].filter(Boolean).join(', ')).join(' · ') ||
                    'No destinations yet'}
                </span>
              </div>
              <div className="row small muted" style={{ marginTop: 4, gap: 14 }}>
                <span>📅 {t.startDate ? `${fmtDate(t.startDate)} · ${daysBetween(t.startDate, t.endDate)}d` : 'Dates TBD'}</span>
                <span>👥 {t.travelers.length}</span>
                <span>💰 {t.baseCurrency}</span>
              </div>
            </div>
          </div>
        )
      })}

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
    <Modal
      title="Plan a new trip"
      onClose={onClose}
      footer={
        <button className="btn primary block" onClick={submit}>
          Create trip
        </button>
      }
    >
      <Field label="Trip name">
        <input className="input" placeholder="e.g. Europe summer 2026" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="Add destinations">
        <CountryPicker value={country?.cca3} onChange={setCountry} />
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" placeholder="City / region (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
          <button className="btn" onClick={addDest} disabled={!country}>
            Add
          </button>
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
        <Field label="Start date">
          <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End date">
          <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      <div className="two">
        <Field label="Trip currency">
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </Field>
        <Field label="Budget (optional)">
          <input type="number" className="input" placeholder="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
