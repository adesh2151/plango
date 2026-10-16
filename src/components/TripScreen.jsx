import { useState } from 'react'
import { useStore, updateTrip, deleteTrip, duplicateTrip } from '../lib/store.js'
import { fmtDate, daysBetween, uid } from '../lib/format.js'
import { Modal, Field, CountryPicker, CurrencyPicker } from './ui.jsx'
import Plan from './Plan.jsx'
import Money from './Money.jsx'
import Explore from './Explore.jsx'
import Guide from './Guide.jsx'
import TripMap from './TripMap.jsx'
import { exportTripPdf } from '../lib/exportPdf.js'
import { tripShareUrl } from '../lib/share.js'

const TABS = [
  { key: 'plan', label: '🗓️ Plan' },
  { key: 'money', label: '💰 Money' },
  { key: 'explore', label: '🧭 Explore' },
  { key: 'guide', label: '📋 Guide' },
  { key: 'map', label: '🗺️ Map' },
]

async function shareTrip(trip) {
  const url = tripShareUrl(trip)
  try {
    if (navigator.share) await navigator.share({ title: `PlanGo — ${trip.name}`, text: 'Check out my trip plan', url })
    else {
      await navigator.clipboard.writeText(url)
      alert('Trip link copied to clipboard! Anyone who opens it gets a copy of this plan.')
    }
  } catch {
    /* share cancelled */
  }
}

export default function TripScreen({ tripId, onBack }) {
  const { trips } = useStore()
  const trip = trips.find((t) => t.id === tripId)
  const [tab, setTab] = useState('plan')
  const [editing, setEditing] = useState(false)

  if (!trip) {
    onBack()
    return null
  }

  return (
    <div>
      <div className="row between" style={{ margin: '2px 0 10px' }}>
        <button className="iconbtn" onClick={onBack} aria-label="Back">←</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => shareTrip(trip)}>🔗 Share</button>
          <button className="btn sm" onClick={() => exportTripPdf(trip)}>📄 PDF</button>
          <button className="iconbtn" onClick={() => setEditing(true)} aria-label="Edit trip">⋯</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>{trip.destinations.map((d) => d.country?.flag).join(' ')} {trip.name}</h2>
        <div className="small muted" style={{ marginTop: 4 }}>
          {trip.destinations.map((d) => [d.city, d.country?.name].filter(Boolean).join(', ')).join(' · ') || 'No destinations'}
        </div>
        <div className="row small muted" style={{ marginTop: 8, gap: 14 }}>
          <span>📅 {trip.startDate ? `${fmtDate(trip.startDate)} → ${fmtDate(trip.endDate)} · ${daysBetween(trip.startDate, trip.endDate)}d` : 'Dates TBD'}</span>
          <span>👥 {trip.travelers.length}</span>
        </div>
      </div>

      <div className="card tight" style={{ marginBottom: 14 }}>
        <div className="row">
          <div className="stat"><div className="v">{trip.startDate ? daysBetween(trip.startDate, trip.endDate) : '—'}</div><div className="l">days</div></div>
          <div className="stat"><div className="v">{trip.items.length}</div><div className="l">stops</div></div>
          <div className="stat"><div className="v">{trip.favorites.length}</div><div className="l">saved</div></div>
          <div className="stat"><div className="v">{trip.travelers.length}</div><div className="l">people</div></div>
          {trip.budget > 0 && <div className="stat"><div className="v" style={{ fontSize: 15 }}>{trip.baseCurrency} {trip.budget}</div><div className="l">budget</div></div>}
        </div>
        {(() => {
          const today = new Date().toISOString().slice(0, 10)
          const out = []
          if (trip.startDate) {
            const diff = Math.round((new Date(trip.startDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
            if (diff > 0) out.push(<div key="cd" className="countdown">🗓️ Starts in {diff} day{diff > 1 ? 's' : ''}</div>)
            else if (diff === 0) out.push(<div key="cd" className="countdown" style={{ background: 'var(--good)' }}>🎒 Trip starts today!</div>)
            else if (trip.endDate && trip.endDate >= today) out.push(<div key="cd" className="countdown" style={{ background: 'var(--good)' }}>✈️ On your trip now</div>)
          }
          const sorted = [...trip.items].filter((i) => i.date).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
          const next = sorted.find((i) => i.date >= today) || sorted[0] || trip.items[0]
          if (next) out.push(<div key="nx" className="small soft" style={{ marginTop: 8, textAlign: 'center' }}>⏭️ Next: <b>{next.title}</b>{next.date ? ` · ${fmtDate(next.date)}` : ''}</div>)
          return out.length ? <div style={{ marginTop: 10, textAlign: 'center' }}>{out}</div> : null
        })()}
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'plan' && <Plan trip={trip} />}
      {tab === 'money' && <Money trip={trip} />}
      {tab === 'explore' && <Explore trip={trip} />}
      {tab === 'guide' && <Guide trip={trip} />}
      {tab === 'map' && <TripMap trip={trip} />}

      {editing && <EditTripModal trip={trip} onClose={() => setEditing(false)} onDeleted={onBack} />}
    </div>
  )
}

function EditTripModal({ trip, onClose, onDeleted }) {
  const [f, setF] = useState({
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    baseCurrency: trip.baseCurrency,
    budget: trip.budget || '',
    destinations: trip.destinations,
  })
  const [country, setCountry] = useState(null)
  const [city, setCity] = useState('')
  const upd = (k, v) => setF({ ...f, [k]: v })

  const save = () => {
    updateTrip(trip.id, { ...f, budget: Number(f.budget) || 0 })
    onClose()
  }

  return (
    <Modal
      title="Edit trip"
      onClose={onClose}
      footer={
        <div className="row">
          <button className="btn danger" onClick={() => { if (confirm('Delete this trip?')) { deleteTrip(trip.id); onDeleted() } }}>Delete trip</button>
          <button className="btn primary grow" onClick={save}>Save</button>
        </div>
      }
    >
      <button className="btn block" style={{ marginBottom: 12 }} onClick={() => { duplicateTrip(trip.id); onClose(); onDeleted() }}>
        🧬 Duplicate this trip (save as a reusable copy)
      </button>
      <Field label="Trip name"><input className="input" value={f.name} onChange={(e) => upd('name', e.target.value)} /></Field>
      <div className="two">
        <Field label="Start"><input type="date" className="input" value={f.startDate} onChange={(e) => upd('startDate', e.target.value)} /></Field>
        <Field label="End"><input type="date" className="input" value={f.endDate} min={f.startDate} onChange={(e) => upd('endDate', e.target.value)} /></Field>
      </div>
      <div className="two">
        <Field label="Currency"><CurrencyPicker value={f.baseCurrency} onChange={(v) => upd('baseCurrency', v)} /></Field>
        <Field label="Budget"><input type="number" className="input" value={f.budget} onChange={(e) => upd('budget', e.target.value)} /></Field>
      </div>
      <Field label="Destinations">
        <div className="row wrap" style={{ marginBottom: 8 }}>
          {f.destinations.map((d) => (
            <span className="chip" key={d.id}>
              {d.country.flag} {[d.city, d.country.name].filter(Boolean).join(', ')}
              <button onClick={() => upd('destinations', f.destinations.filter((x) => x.id !== d.id))}>✕</button>
            </span>
          ))}
        </div>
        <CountryPicker value={country?.cca3} onChange={setCountry} />
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
          <button className="btn" disabled={!country} onClick={() => { upd('destinations', [...f.destinations, { id: uid(), country, city: city.trim() }]); setCity(''); setCountry(null) }}>Add</button>
        </div>
      </Field>
    </Modal>
  )
}
