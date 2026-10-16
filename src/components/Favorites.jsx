import { useState } from 'react'
import { addFavorite, removeFavorite, addItem } from '../lib/store.js'
import { PlaceImage, Empty, Modal, Field } from './ui.jsx'

export default function Favorites({ trip }) {
  const [adding, setAdding] = useState(false)
  return (
    <div>
      <div className="row between" style={{ margin: '4px 2px 10px' }}>
        <div className="section-title" style={{ margin: 0 }}>Saved places & dishes</div>
        <button className="btn sm primary" onClick={() => setAdding(true)}>＋ Add</button>
      </div>

      {!trip.favorites.length && (
        <Empty icon="❤️" title="No favourites yet" hint="Save places from Explore, or add a must-try dish or spot here." />
      )}

      <div className="places">
        {trip.favorites.map((f) => (
          <div className="place" key={f.id}>
            <PlaceImage query={`${f.name} ${f.place || ''}`} wikipedia={f.wikipedia} fallback={f.image}>
              {f.type && <span className="badge">{String(f.type).replace(/_/g, ' ')}</span>}
            </PlaceImage>
            <div className="pb">
              <div className="nm">{f.name}</div>
              {f.place && <div className="small muted">{f.place}</div>}
              {f.note && <div className="small soft">{f.note}</div>}
              <div className="act">
                <button className="btn sm" onClick={() => addItem(trip.id, { type: f.type === 'hotel' ? 'stay' : f.type === 'dish' ? 'food' : 'sight', title: f.name, place: f.place || '', date: '', time: '', cost: '', currency: trip.baseCurrency })}>＋ Plan</button>
                {f.website && <a className="btn sm ghost" href={f.website} target="_blank" rel="noreferrer">↗</a>}
                <button className="btn sm danger" onClick={() => removeFavorite(trip.id, f.id)}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {adding && <AddFavModal trip={trip} onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddFavModal({ trip, onClose }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('spot')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const save = () => {
    if (!name.trim()) return
    addFavorite(trip.id, { name: name.trim(), type, place: place.trim(), note: note.trim() })
    onClose()
  }
  return (
    <Modal title="Add a favourite" onClose={onClose} footer={<button className="btn primary block" onClick={save}>Save</button>}>
      <Field label="Name"><input className="input" placeholder="e.g. Ramen Ichiran / Tokyo Tower" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Type">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="spot">Place / spot</option>
          <option value="dish">Dish / food</option>
          <option value="hotel">Stay</option>
          <option value="restaurant">Restaurant</option>
        </select>
      </Field>
      <Field label="Where"><input className="input" placeholder="City / area" value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
      <Field label="Note"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  )
}
