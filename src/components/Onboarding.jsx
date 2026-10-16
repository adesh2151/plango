import { useState } from 'react'
import { setProfile } from '../lib/store.js'
import { CountryPicker, CurrencyPicker, Field } from './ui.jsx'
import { INTERESTS } from './Settings.jsx'

export default function Onboarding() {
  const [name, setName] = useState('')
  const [passport, setPassport] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [interests, setInterests] = useState([])

  const toggle = (i) => setInterests(interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i])
  const finish = () =>
    setProfile({ name: name.trim(), passportCca3: passport, homeCurrency: currency, interests, onboarded: true })

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="onboard-logo">✈️</div>
        <h1 style={{ margin: '4px 0 2px', fontSize: 26 }}>Welcome to PlanGo</h1>
        <p className="muted" style={{ marginTop: 0 }}>Plan it, then go. A few quick things so visas, currency and ideas are tailored to you.</p>

        <Field label="What should we call you?">
          <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Your passport country (for visa rules)">
          <CountryPicker value={passport} onChange={(c) => setPassport(c?.cca3 || '')} placeholder="Select passport country" />
        </Field>
        <Field label="Home currency">
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </Field>
        <Field label="What do you love? (tap any)">
          <div className="row wrap">
            {INTERESTS.map((i) => (
              <span key={i} className={`chip ${interests.includes(i) ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggle(i)}>{i}</span>
            ))}
          </div>
        </Field>

        <button className="btn primary block" style={{ marginTop: 8 }} onClick={finish}>Start exploring →</button>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setProfile({ homeCurrency: currency, onboarded: true })}>Skip for now</button>
      </div>
    </div>
  )
}
