import { useRef } from 'react'
import { useStore, setProfile, setSettings, exportData, importAll } from '../lib/store.js'
import { downloadJSON } from '../lib/share.js'
import { CountryPicker, CurrencyPicker, Field } from './ui.jsx'

export const INTERESTS = [
  '🏖️ Beaches', '⛰️ Mountains', '🏛️ History', '🍜 Food', '🦁 Wildlife & nature',
  '🌃 Nightlife', '🛍️ Shopping', '🎨 Art & culture', '🧗 Adventure', '🧘 Relaxation',
]

export default function Settings() {
  const { profile, settings } = useStore()
  const interests = profile.interests || []
  const fileRef = useRef(null)

  const toggleInterest = (i) =>
    setProfile({ interests: interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i] })

  const onImport = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        if (confirm('Replace all current data with this backup?')) {
          importAll(String(reader.result))
          alert('Backup restored ✅')
        }
      } catch (err) {
        alert('Could not read that backup: ' + err.message)
      }
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  return (
    <div>
      <h2 style={{ margin: '4px 2px 14px' }}>Settings</h2>

      <div className="section-title">Your profile</div>
      <div className="card">
        <Field label="Your name">
          <input className="input" value={profile.name} placeholder="Traveller" onChange={(e) => setProfile({ name: e.target.value })} />
        </Field>
        <Field label="Passport country (for visa rules)">
          <CountryPicker value={profile.passportCca3} onChange={(c) => setProfile({ passportCca3: c?.cca3 || '' })} placeholder="Select your passport country" />
        </Field>
        <Field label="Home currency">
          <CurrencyPicker value={profile.homeCurrency} onChange={(v) => setProfile({ homeCurrency: v })} />
        </Field>
      </div>

      <div className="section-title">Travel interests</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>Pick what you love — Discover and Explore use these to tailor suggestions.</p>
        <div className="row wrap">
          {INTERESTS.map((i) => (
            <span key={i} className={`chip ${interests.includes(i) ? 'on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggleInterest(i)}>{i}</span>
          ))}
        </div>
      </div>

      <div className="section-title">Backup &amp; restore</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>Your trips live on this device. Export a backup to keep them safe or move to another device.</p>
        <div className="row">
          <button className="btn grow" onClick={() => downloadJSON(`plango-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData())}>⬇️ Export backup</button>
          <button className="btn grow" onClick={() => fileRef.current?.click()}>⬆️ Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        </div>
      </div>

      <div className="section-title">Flights &amp; hotels (optional)</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          PlanGo is fully usable without this. To switch on live flight &amp; hotel search (and budget-based Discover),
          add a free <a href="https://developers.amadeus.com" target="_blank" rel="noreferrer">Amadeus</a> key. It’s the only
          non-open-source data source, so it stays optional. Keys never leave this device.
        </p>
        <Field label="API Key (Client ID)">
          <input className="input" value={settings.amadeusId} onChange={(e) => setSettings({ amadeusId: e.target.value.trim() })} />
        </Field>
        <Field label="API Secret">
          <input className="input" type="password" value={settings.amadeusSecret} onChange={(e) => setSettings({ amadeusSecret: e.target.value.trim() })} />
        </Field>
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.amadeusProduction} onChange={(e) => setSettings({ amadeusProduction: e.target.checked })} />
          <span className="small">Use production endpoint (leave off for the free test key)</span>
        </label>
      </div>

      <div className="section-title">About &amp; data sources (all open)</div>
      <div className="card small soft">
        <p style={{ marginTop: 0 }}>Everything is live, open data. Your trips and keys never leave your device.</p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Exchange rates — @fawazahmed0/currency-api (open source)</li>
          <li>Geocoding — Open-Meteo · Photon (open source)</li>
          <li>Country facts — mledoze/countries (ODbL)</li>
          <li>Visa rules — Passport Index dataset, ilyankou (ODbL)</li>
          <li>Places &amp; map — © OpenStreetMap contributors (ODbL)</li>
          <li>Guides — Wikivoyage (CC BY-SA) · Photos — Wikipedia</li>
          <li>Flights &amp; hotels — Amadeus (optional, your key)</li>
        </ul>
        <p style={{ marginBottom: 0 }}>Made with ❤️ by <b>Adesh</b> · <a href="https://adesh2151.github.io/" target="_blank" rel="noreferrer">more free apps by Adesh</a></p>
      </div>
    </div>
  )
}
