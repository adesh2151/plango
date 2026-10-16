import { useMemo, useState } from 'react'
import { addExpense, updateExpense, removeExpense, addTraveler, removeTraveler, addSettlement, removeSettlement } from '../lib/store.js'
import { buildConverter } from '../lib/currency.js'
import { computeBalances } from '../lib/settle.js'
import { money, fmtDate } from '../lib/format.js'
import { Modal, Field, Empty, Loading, ErrorBox, useAsync } from './ui.jsx'

const CATEGORIES = ['🍽️ Food', '🏨 Stay', '🚆 Transport', '🎟️ Activity', '🛍️ Shopping', '📌 Other']

export default function Money({ trip }) {
  const [editing, setEditing] = useState(null)
  const [managePeople, setManagePeople] = useState(false)
  const [fPayer, setFPayer] = useState('all')
  const [fCat, setFCat] = useState('all')
  const [eSort, setESort] = useState('new')
  const base = trip.baseCurrency

  const { data: conv, loading, error } = useAsync(() => buildConverter(base), [base])

  const { normalised, unsupported } = useMemo(() => {
    if (!conv) return { normalised: [], unsupported: [] }
    const out = []
    const bad = []
    for (const e of trip.expenses) {
      const b = conv.convert(e.amount, e.currency)
      if (b === null) bad.push(e)
      const amt = b ?? 0
      let shareBase = null
      if (e.splitMode === 'shares' && e.splits) {
        const sum = Object.values(e.splits).reduce((a, v) => a + (Number(v) || 0), 0)
        if (sum > 0) {
          shareBase = {}
          for (const [id, w] of Object.entries(e.splits)) if (Number(w) > 0) shareBase[id] = (amt * Number(w)) / sum
        }
      } else if (e.splitMode === 'exact' && e.splits) {
        shareBase = {}
        for (const [id, v] of Object.entries(e.splits)) if (Number(v) > 0) shareBase[id] = conv.convert(Number(v), e.currency) ?? 0
      }
      out.push({ ...e, baseAmount: amt, shareBase })
    }
    return { normalised: out, unsupported: bad }
  }, [conv, trip.expenses])

  const balances = useMemo(
    () => computeBalances(normalised, trip.travelers, trip.settlements || []),
    [normalised, trip.travelers, trip.settlements],
  )
  const nameOf = (id) => trip.travelers.find((t) => t.id === id)?.name || '?'

  if (loading) return <Loading label="Fetching live exchange rates…" />

  return (
    <div>
      <ErrorBox error={error} />

      <div className="card">
        <div className="row between">
          <div className="stat">
            <div className="v">{money(balances.total, base)}</div>
            <div className="l">Total spent</div>
          </div>
          {trip.budget > 0 && (
            <div className="stat">
              <div className="v" style={{ color: balances.total > trip.budget ? 'var(--bad)' : 'var(--good)' }}>
                {money(trip.budget - balances.total, base)}
              </div>
              <div className="l">Budget left</div>
            </div>
          )}
          <div className="stat">
            <div className="v">{trip.expenses.length}</div>
            <div className="l">Expenses</div>
          </div>
        </div>
        {conv?.date && <div className="credit" style={{ padding: '8px 0 0' }}>Rates as of {conv.date} · all amounts shown in {base}</div>}
      </div>

      {unsupported.length > 0 && (
        <div className="errbox">
          {unsupported.length} expense(s) use a currency not covered by the live rate feed and are counted as 0 in {base}. Enter those in {base} to include them.
        </div>
      )}

      {/* balances */}
      <div className="section-title">Who’s up / down</div>
      <div className="card tight">
        {trip.travelers.map((t) => {
          const net = balances.net[t.id] || 0
          return (
            <div className="bal" key={t.id}>
              <span>{t.name}</span>
              <span>
                <span className="muted small">paid {money(balances.paid[t.id] || 0, base)} · share {money(balances.share[t.id] || 0, base)}</span>{' '}
                <span className={net >= 0 ? 'pos' : 'neg'}>{net >= 0 ? '+' : ''}{money(net, base)}</span>
              </span>
            </div>
          )
        })}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => setManagePeople(true)}>👥 Manage travellers</button>
        </div>
      </div>

      {/* settlement */}
      {balances.settlements.length > 0 && (
        <>
          <div className="section-title">Settle up</div>
          {balances.settlements.map((s, i) => (
            <div className="settle" key={i}>
              <span>{nameOf(s.from)}</span>
              <span className="muted">→</span>
              <span>{nameOf(s.to)}</span>
              <span className="grow" />
              <span className="pos">{money(s.amount, base)}</span>
              <button className="btn sm" onClick={() => addSettlement(trip.id, { from: s.from, to: s.to, amount: s.amount, date: new Date().toISOString().slice(0, 10) })}>✓ Paid</button>
            </div>
          ))}
        </>
      )}
      {balances.settlements.length === 0 && trip.expenses.length > 0 && (
        <div className="settle" style={{ justifyContent: 'center', color: 'var(--good)' }}>🎉 All settled up!</div>
      )}
      {(trip.settlements || []).length > 0 && (
        <>
          <div className="section-title">Recorded payments</div>
          {trip.settlements.map((s) => (
            <div className="bal" key={s.id}>
              <span className="small">{nameOf(s.from)} paid {nameOf(s.to)} · {money(s.amount, base)}{s.date ? ` · ${s.date}` : ''}</span>
              <button className="btn sm ghost" onClick={() => removeSettlement(trip.id, s.id)}>Undo</button>
            </div>
          ))}
        </>
      )}

      {/* expenses */}
      <div className="row between" style={{ margin: '18px 2px 8px' }}>
        <div className="section-title" style={{ margin: 0 }}>Expenses</div>
        <button className="btn sm primary" onClick={() => setEditing({})}>＋ Add expense</button>
      </div>

      {!trip.expenses.length && <Empty icon="🧾" title="No expenses yet" hint="Log who paid for what and split it instantly." />}

      {trip.expenses.length > 2 && (
        <>
          <div className="row wrap" style={{ marginBottom: 8, gap: 6 }}>
            <span className={`chip ${fPayer === 'all' ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFPayer('all')}>Everyone</span>
            {trip.travelers.map((t) => (
              <span key={t.id} className={`chip ${fPayer === t.id ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFPayer(t.id)}>{t.name}</span>
            ))}
          </div>
          <div className="toolbar">
            <select className="input" value={fCat} onChange={(e) => setFCat(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input sortsel" value={eSort} onChange={(e) => setESort(e.target.value)}>
              <option value="new">Newest</option>
              <option value="amount">Highest</option>
              <option value="date">By date</option>
            </select>
          </div>
        </>
      )}

      {(() => {
        let shown = trip.expenses.map((e, i) => ({ ...e, _i: i, _base: conv ? conv.convert(e.amount, e.currency) ?? 0 : 0 }))
        if (fPayer !== 'all') shown = shown.filter((e) => e.paidBy === fPayer)
        if (fCat !== 'all') shown = shown.filter((e) => (e.category || '') === fCat)
        if (eSort === 'amount') shown.sort((a, b) => b._base - a._base)
        else if (eSort === 'date') shown.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        else shown.sort((a, b) => b._i - a._i)
        return shown
      })().map((e) => (
        <div className="item" key={e.id} onClick={() => setEditing(e)}>
          <div className="emoji">{(e.category || '📌').split(' ')[0]}</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{e.title}</div>
            <div className="small muted">
              Paid by {nameOf(e.paidBy)} · split {e.splitAmong?.length || trip.travelers.length} ways
              {e.date ? ` · ${fmtDate(e.date)}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700 }}>{money(e.amount, e.currency)}</div>
            {e.currency !== base && conv && (
              <div className="small muted">
                {conv.convert(e.amount, e.currency) === null ? '—' : money(conv.convert(e.amount, e.currency), base)}
              </div>
            )}
          </div>
        </div>
      ))}

      {editing && <ExpenseModal trip={trip} expense={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      {managePeople && <PeopleModal trip={trip} onClose={() => setManagePeople(false)} />}
    </div>
  )
}

function ExpenseModal({ trip, expense, onClose }) {
  const [f, setF] = useState(() => ({
    title: '',
    amount: '',
    currency: trip.baseCurrency,
    paidBy: trip.travelers[0]?.id,
    splitAmong: trip.travelers.map((t) => t.id),
    splitMode: 'equal',
    splits: {},
    category: CATEGORIES[0],
    date: trip.startDate || '',
    ...(expense || {}),
  }))
  const upd = (k, v) => setF({ ...f, [k]: v })
  const toggle = (id) =>
    upd('splitAmong', f.splitAmong.includes(id) ? f.splitAmong.filter((x) => x !== id) : [...f.splitAmong, id])
  const setSplit = (id, v) => setF({ ...f, splits: { ...f.splits, [id]: v } })

  const exactSum = Object.values(f.splits).reduce((a, v) => a + (Number(v) || 0), 0)

  const save = () => {
    if (!f.title.trim() || !(Number(f.amount) > 0)) return
    const payload = { ...f, amount: Number(f.amount), splitAmong: f.splitAmong.length ? f.splitAmong : trip.travelers.map((t) => t.id) }
    if (expense) updateExpense(trip.id, expense.id, payload)
    else addExpense(trip.id, payload)
    onClose()
  }

  return (
    <Modal
      title={expense ? 'Edit expense' : 'Add expense'}
      onClose={onClose}
      footer={
        <div className="row">
          {expense && <button className="btn danger" onClick={() => { removeExpense(trip.id, expense.id); onClose() }}>Delete</button>}
          <button className="btn primary grow" onClick={save}>Save</button>
        </div>
      }
    >
      <Field label="What was it?">
        <input className="input" placeholder="e.g. Dinner at trattoria" value={f.title} onChange={(e) => upd('title', e.target.value)} />
      </Field>
      <div className="two">
        <Field label="Amount">
          <input type="number" className="input" placeholder="0.00" value={f.amount} onChange={(e) => upd('amount', e.target.value)} />
        </Field>
        <Field label="Currency">
          <input className="input" value={f.currency} onChange={(e) => upd('currency', e.target.value.toUpperCase())} />
        </Field>
      </div>
      <Field label="Category">
        <select className="input" value={f.category} onChange={(e) => upd('category', e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Paid by">
        <select className="input" value={f.paidBy} onChange={(e) => upd('paidBy', e.target.value)}>
          {trip.travelers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="How to split">
        <div className="row wrap" style={{ marginBottom: 8 }}>
          {[['equal', 'Equally'], ['shares', 'By shares'], ['exact', 'Exact amounts']].map(([k, l]) => (
            <span key={k} className={`chip ${f.splitMode === k ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => upd('splitMode', k)}>{l}</span>
          ))}
        </div>
        {f.splitMode === 'equal' && (
          <div className="row wrap">
            {trip.travelers.map((t) => (
              <span key={t.id} className={`chip ${f.splitAmong.includes(t.id) ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggle(t.id)}>{t.name}</span>
            ))}
          </div>
        )}
        {f.splitMode === 'shares' && trip.travelers.map((t) => (
          <div className="row between" key={t.id} style={{ padding: '4px 0' }}>
            <span>{t.name}</span>
            <input type="number" className="input" style={{ width: 90 }} placeholder="1" value={f.splits[t.id] ?? ''} onChange={(e) => setSplit(t.id, e.target.value)} />
          </div>
        ))}
        {f.splitMode === 'exact' && (
          <>
            {trip.travelers.map((t) => (
              <div className="row between" key={t.id} style={{ padding: '4px 0' }}>
                <span>{t.name}</span>
                <input type="number" className="input" style={{ width: 110 }} placeholder="0" value={f.splits[t.id] ?? ''} onChange={(e) => setSplit(t.id, e.target.value)} />
              </div>
            ))}
            <div className={`small ${Math.abs(exactSum - (Number(f.amount) || 0)) < 0.01 ? 'muted' : 'neg'}`}>
              Assigned {exactSum.toFixed(2)} of {Number(f.amount) || 0} {f.currency}
            </div>
          </>
        )}
      </Field>
      <Field label="Date">
        <input type="date" className="input" value={f.date} onChange={(e) => upd('date', e.target.value)} />
      </Field>
    </Modal>
  )
}

function PeopleModal({ trip, onClose }) {
  const [name, setName] = useState('')
  return (
    <Modal title="Travellers" onClose={onClose}>
      {trip.travelers.map((t) => (
        <div className="row between" key={t.id} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
          <span>{t.name}</span>
          {trip.travelers.length > 1 && (
            <button className="btn sm danger" onClick={() => removeTraveler(trip.id, t.id)}>Remove</button>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <input className="input grow" placeholder="Add a traveller" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" onClick={() => { if (name.trim()) { addTraveler(trip.id, name.trim()); setName('') } }}>Add</button>
      </div>
    </Modal>
  )
}
