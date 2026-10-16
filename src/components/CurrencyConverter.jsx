import { useEffect, useState } from 'react'
import { convertOne } from '../lib/currency.js'
import { CurrencyPicker } from './ui.jsx'
import { plain } from '../lib/format.js'

export default function CurrencyConverter({ defaultFrom = 'USD', defaultTo = 'EUR' }) {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState(defaultFrom || 'USD')
  const [to, setTo] = useState(defaultTo || 'EUR')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const n = Number(amount)
    if (!(n >= 0)) return
    setBusy(true)
    setErr(null)
    convertOne(n, from, to)
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setErr(e))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [amount, from, to])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <div className="card">
      <div className="field">
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 8 }}>
        <div className="grow"><CurrencyPicker value={from} onChange={setFrom} /></div>
        <button className="iconbtn" onClick={swap} title="Swap">⇄</button>
        <div className="grow"><CurrencyPicker value={to} onChange={setTo} /></div>
      </div>
      <div className="center" style={{ marginTop: 14 }}>
        {busy && <span className="muted">Converting…</span>}
        {err && <span className="neg small">Rate unavailable for this pair</span>}
        {!busy && !err && result != null && (
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)' }}>
              {plain(result)} {to}
            </div>
            <div className="small muted">
              1 {from} = {plain(result / (Number(amount) || 1))} {to} · live ECB rate
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
