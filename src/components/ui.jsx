import { useEffect, useRef, useState } from 'react'
import { allCountries } from '../lib/countries.js'
import { listCurrencies } from '../lib/currency.js'
import { wikiImage } from '../lib/images.js'

export function Spinner() {
  return <div className="spinner" />
}

export function Loading({ label = 'Loading live data…' }) {
  return (
    <div className="loadbox">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="errbox">⚠️ {String(error.message || error)}</div>
}

export function Empty({ icon = '🧭', title, hint }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--text-soft)' }}>{title}</div>
      {hint && <div className="small" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  )
}

// Reusable search + sort toolbar for list screens.
export function Toolbar({ search, onSearch, placeholder = 'Search…', sort, onSort, sorts, children }) {
  return (
    <div className="toolbar">
      {onSearch !== undefined && (
        <div className="searchwrap grow">
          <span className="searchico">🔍</span>
          <input className="input" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)} />
          {search && <button className="searchclear" onClick={() => onSearch('')} aria-label="Clear">✕</button>}
        </div>
      )}
      {sorts && (
        <select className="input sortsel" value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort">
          {sorts.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      )}
      {children}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  )
}

/* Generic async hook: runs fn when deps change, exposes {data, error, loading, reload}. */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const run = async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fnRef.current()
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState({ data: null, error, loading: false })
    }
  }
  useEffect(() => {
    if (immediate) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { ...state, reload: run }
}

/* Country picker backed by the live country list. */
export function CountryPicker({ value, onChange, placeholder = 'Select country' }) {
  const { data: list } = useAsync(() => allCountries(), [])
  return (
    <select
      className="input"
      value={value || ''}
      onChange={(e) => {
        const c = (list || []).find((x) => x.cca3 === e.target.value)
        onChange(c || null)
      }}
    >
      <option value="">{list ? placeholder : 'Loading countries…'}</option>
      {(list || []).map((c) => (
        <option key={c.cca3} value={c.cca3}>
          {c.flag} {c.name}
        </option>
      ))}
    </select>
  )
}

/* Currency picker backed by frankfurter's supported-currency list. */
export function CurrencyPicker({ value, onChange }) {
  const { data: curr } = useAsync(() => listCurrencies(), [])
  const entries = curr ? Object.entries(curr) : []
  return (
    <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {!curr && <option>Loading…</option>}
      {entries.map(([code, name]) => (
        <option key={code} value={code}>
          {code} — {name}
        </option>
      ))}
    </select>
  )
}

/* Lazy live photo from Wikipedia for a place/city name. */
export function PlaceImage({ query, wikipedia, fallback, className = 'ph', children }) {
  const [src, setSrc] = useState(fallback || '')
  useEffect(() => {
    let alive = true
    const key = wikipedia || query
    if (!key) return
    wikiImage(key).then((img) => {
      if (alive && img?.thumb) setSrc(img.thumb)
    })
    return () => {
      alive = false
    }
  }, [query, wikipedia])
  return (
    <div className={className} style={src ? { backgroundImage: `url("${src}")` } : undefined}>
      {!src && <div className="row center" style={{ height: '100%', justifyContent: 'center', fontSize: 30, opacity: 0.4 }}>🏙️</div>}
      {children}
    </div>
  )
}
