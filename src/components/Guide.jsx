import { useState } from 'react'
import { addPacking, updatePacking, removePacking } from '../lib/store.js'
import { getGuide } from '../lib/tips.js'
import { Loading, ErrorBox, Empty, useAsync } from './ui.jsx'
import Info from './Info.jsx'

export default function Guide({ trip }) {
  return (
    <div>
      <div className="section-title">Visa, currency &amp; country facts</div>
      <Info trip={trip} />

      <div className="section-title">Before you go — local tips</div>
      {!trip.destinations.length && <Empty icon="📋" title="No destinations" hint="Add a destination to load local do’s & don’ts, safety and entry tips." />}
      {trip.destinations.map((d) => (
        <DestGuide key={d.id} query={[d.city, d.country?.name].filter(Boolean).join(', ')} name={d.city || d.country?.name} flag={d.country?.flag} />
      ))}

      <div className="section-title">Packing checklist</div>
      <Packing trip={trip} />
    </div>
  )
}

function DestGuide({ query, name, flag }) {
  const { data, loading, error } = useAsync(() => getGuide(query), [query])
  const [open, setOpen] = useState(0)

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 8px' }}>{flag} {name}</h3>
      {loading && <Loading label="Loading local tips…" />}
      <ErrorBox error={error} />
      {data?.notFound && <div className="muted small">No travel guide found for this place yet. Try a nearby major city.</div>}
      {data?.sections?.map((s, i) => (
        <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none', padding: '10px 0' }}>
          <button className="row between" style={{ width: '100%', border: 'none', background: 'none', color: 'var(--text)', padding: 0, fontWeight: 700 }} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{s.emoji} {s.label}</span>
            <span className="muted">{open === i ? '▾' : '▸'}</span>
          </button>
          {open === i && <div className="small soft" style={{ whiteSpace: 'pre-line', marginTop: 8, lineHeight: 1.65 }}>{s.text}</div>}
        </div>
      ))}
      {data?.url && <a className="small" href={data.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8 }}>Full guide on Wikivoyage ↗</a>}
      <div className="credit" style={{ textAlign: 'left', padding: '8px 0 0' }}>Guide text © Wikivoyage contributors (CC BY-SA)</div>
    </div>
  )
}

const SUGGESTIONS = ['Passport & visa', 'Travel insurance', 'Chargers & adapter', 'Medicines', 'Copies of documents', 'Local currency / card']

function Packing({ trip }) {
  const [text, setText] = useState('')
  const [carry, setCarry] = useState(true)
  const list = trip.packing || []
  const toCarry = list.filter((p) => p.carry)
  const toAvoid = list.filter((p) => !p.carry)

  const add = (value, c = carry) => {
    const v = (value ?? text).trim()
    if (!v) return
    addPacking(trip.id, { text: v, carry: c })
    setText('')
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input grow" placeholder="Add an item…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className={`chip ${carry ? 'on' : ''}`} onClick={() => setCarry(true)} style={{ cursor: 'pointer' }}>Carry</button>
        <button className={`chip ${!carry ? 'on' : ''}`} onClick={() => setCarry(false)} style={{ cursor: 'pointer' }}>Avoid</button>
        <button className="btn primary" onClick={() => add()}>Add</button>
      </div>

      {!list.length && (
        <div className="row wrap" style={{ marginBottom: 8 }}>
          {SUGGESTIONS.map((s) => (
            <span key={s} className="chip" style={{ cursor: 'pointer' }} onClick={() => add(s, true)}>＋ {s}</span>
          ))}
        </div>
      )}

      <PackGroup title="🎒 Things to carry" items={toCarry} trip={trip} />
      {toAvoid.length > 0 && <PackGroup title="🚫 Don’t carry / avoid" items={toAvoid} trip={trip} />}
    </div>
  )
}

function PackGroup({ title, items, trip }) {
  if (!items.length) return null
  return (
    <div style={{ marginTop: 8 }}>
      <div className="small muted" style={{ fontWeight: 700, margin: '4px 0' }}>{title}</div>
      {items.map((p) => (
        <div className="row between" key={p.id} style={{ padding: '6px 0' }}>
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!p.done} onChange={(e) => updatePacking(trip.id, p.id, { done: e.target.checked })} />
            <span style={{ textDecoration: p.done ? 'line-through' : 'none', color: p.done ? 'var(--muted)' : 'var(--text)' }}>{p.text}</span>
          </label>
          <button className="btn sm ghost" onClick={() => removePacking(trip.id, p.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
