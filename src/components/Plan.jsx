import { useMemo, useState } from 'react'
import { addItem, updateItem, removeItem } from '../lib/store.js'
import { dateRange, fmtDate, money } from '../lib/format.js'
import { legDurations, optimizeOrder } from '../lib/routing.js'
import { Modal, Field, Empty } from './ui.jsx'

function DayRoute({ trip, items }) {
  const withCoords = items.filter((i) => i.lat && i.lon)
  const [legs, setLegs] = useState(null)
  const [busy, setBusy] = useState(false)
  if (withCoords.length < 2) return null
  const times = async () => {
    setBusy(true)
    try { setLegs(await legDurations(withCoords)) } catch { alert('Routing is busy — try again shortly.') } finally { setBusy(false) }
  }
  const optimize = async () => {
    setBusy(true)
    try {
      const order = await optimizeOrder(withCoords)
      order.forEach((origIdx, newPos) => updateItem(trip.id, withCoords[origIdx].id, { order: newPos }))
      setLegs(null)
    } catch { alert('Optimise is busy — try again shortly.') } finally { setBusy(false) }
  }
  return (
    <div style={{ margin: '2px 2px 12px' }}>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm" onClick={times} disabled={busy}>🕒 Travel times</button>
        {withCoords.length >= 3 && <button className="btn sm" onClick={optimize} disabled={busy}>🧭 Optimise order</button>}
        {busy && <span className="spinner" style={{ width: 16, height: 16 }} />}
      </div>
      {legs && (
        <div className="small muted" style={{ marginTop: 6 }}>
          🚗 Driving between stops: {legs.map((l) => `${l.min}m`).join(' → ')} · total {legs.reduce((a, l) => a + l.min, 0)} min
        </div>
      )}
    </div>
  )
}

const TYPES = [
  { key: 'sight', label: 'Sightseeing', emoji: '📸' },
  { key: 'food', label: 'Food', emoji: '🍽️' },
  { key: 'transport', label: 'Transport', emoji: '🚆' },
  { key: 'stay', label: 'Stay', emoji: '🏨' },
  { key: 'activity', label: 'Activity', emoji: '🎟️' },
  { key: 'other', label: 'Other', emoji: '📌' },
]
const MODES = ['Flight', 'Train', 'Bus', 'Car', 'Ferry', 'Taxi', 'Walk', 'Metro']
const emojiFor = (t) => TYPES.find((x) => x.key === t)?.emoji || '📌'

export default function Plan({ trip }) {
  const [editing, setEditing] = useState(null) // item or {date} for new
  const days = useMemo(() => {
    const range = trip.startDate ? dateRange(trip.startDate, trip.endDate) : []
    return range.length ? range : ['unscheduled']
  }, [trip.startDate, trip.endDate])

  const byDate = useMemo(() => {
    const map = {}
    for (const it of trip.items) {
      const k = it.date || 'unscheduled'
      ;(map[k] ||= []).push(it)
    }
    // Manual order wins; otherwise fall back to time.
    for (const k in map)
      map[k].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.time || '').localeCompare(b.time || ''))
    return map
  }, [trip.items])

  const move = (dayItems, index, dir) => {
    const j = index + dir
    if (j < 0 || j >= dayItems.length) return
    const reordered = [...dayItems]
    ;[reordered[index], reordered[j]] = [reordered[j], reordered[index]]
    reordered.forEach((it, i) => updateItem(trip.id, it.id, { order: i }))
  }

  const allDays = [...new Set([...days, ...Object.keys(byDate)])]

  return (
    <div>
      {!trip.items.length && (
        <Empty icon="🗓️" title="No plans yet" hint="Add sights, meals, stays and transport legs to build each day." />
      )}

      {allDays.map((d, i) => (
        <div key={d}>
          <div className="day-head">
            <span className="n">{d === 'unscheduled' ? 'Unscheduled' : `Day ${i + 1}`}</span>
            <span className="muted small">{d !== 'unscheduled' && fmtDate(d)}</span>
            <span className="grow" />
            <button className="btn sm" onClick={() => setEditing({ date: d === 'unscheduled' ? '' : d })}>
              ＋ Add
            </button>
          </div>
          {(byDate[d] || []).map((it, idx, arr) => (
            <div className="item" key={it.id}>
              <div className="reorder">
                <button onClick={() => move(arr, idx, -1)} disabled={idx === 0} aria-label="Move up">▲</button>
                <button onClick={() => move(arr, idx, 1)} disabled={idx === arr.length - 1} aria-label="Move down">▼</button>
              </div>
              <div className="grow row" style={{ gap: 10 }} onClick={() => setEditing(it)}>
                <div className="tcol">{it.time || '—'}</div>
                <div className="emoji">{emojiFor(it.type)}</div>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{it.title}</div>
                  <div className="small muted">
                    {it.type === 'transport' && it.mode ? `${it.mode} · ` : ''}
                    {it.place || TYPES.find((t) => t.key === it.type)?.label}
                  </div>
                </div>
                {Number(it.cost) > 0 && <div className="small soft">{money(it.cost, it.currency || trip.baseCurrency)}</div>}
              </div>
            </div>
          ))}
          {!(byDate[d] || []).length && <div className="muted small" style={{ padding: '2px 4px 8px' }}>Nothing planned.</div>}
          <DayRoute trip={trip} items={byDate[d] || []} />
        </div>
      ))}

      {editing && (
        <ItemModal
          trip={trip}
          item={editing.id ? editing : null}
          initialDate={editing.date ?? ''}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ItemModal({ trip, item, initialDate, onClose }) {
  const [f, setF] = useState(
    item || { type: 'sight', title: '', date: initialDate, time: '', place: '', cost: '', currency: trip.baseCurrency, mode: 'Flight', notes: '' },
  )
  const upd = (k, v) => setF({ ...f, [k]: v })
  const days = trip.startDate ? dateRange(trip.startDate, trip.endDate) : []

  const save = () => {
    if (!f.title.trim()) return
    const payload = { ...f, cost: Number(f.cost) || 0 }
    if (item) updateItem(trip.id, item.id, payload)
    else addItem(trip.id, payload)
    onClose()
  }

  return (
    <Modal
      title={item ? 'Edit plan item' : 'Add to itinerary'}
      onClose={onClose}
      footer={
        <div className="row">
          {item && (
            <button className="btn danger" onClick={() => { removeItem(trip.id, item.id); onClose() }}>
              Delete
            </button>
          )}
          <button className="btn primary grow" onClick={save}>Save</button>
        </div>
      }
    >
      <Field label="Type">
        <div className="row wrap">
          {TYPES.map((t) => (
            <span key={t.key} className={`chip ${f.type === t.key ? 'on' : ''}`} onClick={() => upd('type', t.key)} style={{ cursor: 'pointer' }}>
              {t.emoji} {t.label}
            </span>
          ))}
        </div>
      </Field>

      <Field label="Title">
        <input className="input" placeholder={f.type === 'transport' ? 'e.g. Paris → Rome' : 'e.g. Louvre Museum'} value={f.title} onChange={(e) => upd('title', e.target.value)} />
      </Field>

      {f.type === 'transport' && (
        <Field label="Mode">
          <select className="input" value={f.mode} onChange={(e) => upd('mode', e.target.value)}>
            {MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
      )}

      <div className="two">
        <Field label="Day">
          <select className="input" value={f.date} onChange={(e) => upd('date', e.target.value)}>
            <option value="">Unscheduled</option>
            {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {fmtDate(d)}</option>)}
          </select>
        </Field>
        <Field label="Time">
          <input type="time" className="input" value={f.time} onChange={(e) => upd('time', e.target.value)} />
        </Field>
      </div>

      <Field label={f.type === 'transport' ? 'Route / station' : 'Place / address'}>
        <input className="input" value={f.place} onChange={(e) => upd('place', e.target.value)} />
      </Field>

      <div className="two">
        <Field label="Cost">
          <input type="number" className="input" placeholder="0" value={f.cost} onChange={(e) => upd('cost', e.target.value)} />
        </Field>
        <Field label="Currency">
          <input className="input" value={f.currency} onChange={(e) => upd('currency', e.target.value.toUpperCase())} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea className="input" value={f.notes} onChange={(e) => upd('notes', e.target.value)} />
      </Field>
    </Modal>
  )
}
