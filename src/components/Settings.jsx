import { useStore, setProfile, setSettings } from '../lib/store.js'
import { CountryPicker, CurrencyPicker, Field } from './ui.jsx'

export default function Settings() {
  const { profile, settings } = useStore()

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

      <div className="section-title">Flights & hotels (Amadeus)</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          Live flight & hotel search uses the free Amadeus Self-Service API. Create a free account at
          {' '}<a href="https://developers.amadeus.com" target="_blank" rel="noreferrer">developers.amadeus.com</a>,
          make an app, and paste its API Key and Secret below. Keys stay only on this device.
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

      <div className="section-title">About & data sources</div>
      <div className="card small soft">
        <p style={{ marginTop: 0 }}>Everything is live, open data. Your trips and keys never leave your device.</p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Exchange rates — frankfurter.app (ECB)</li>
          <li>Country facts — mledoze/countries (ODbL)</li>
          <li>Visa rules — Passport Index dataset, ilyankou (ODbL)</li>
          <li>Places — © OpenStreetMap contributors (ODbL)</li>
          <li>Photos — Wikipedia / Wikimedia</li>
          <li>Flights & hotels — Amadeus</li>
        </ul>
      </div>
    </div>
  )
}
