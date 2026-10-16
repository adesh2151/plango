import { useState } from 'react'
import { useStore } from '../lib/store.js'
import { countryByCode } from '../lib/countries.js'
import { visaRequirement, STATUS_META } from '../lib/visa.js'
import { convertOne } from '../lib/currency.js'
import { money } from '../lib/format.js'
import { CountryPicker, PlaceImage, Loading, ErrorBox, useAsync } from './ui.jsx'
import CurrencyConverter from './CurrencyConverter.jsx'

export default function World({ embedded = false }) {
  const { profile } = useStore()
  const [dest, setDest] = useState(null)

  return (
    <div>
      {!embedded && (
        <>
          <h2 style={{ margin: '4px 2px 2px' }}>World info</h2>
          <div className="muted small" style={{ margin: '0 2px 14px' }}>Live visa rules, country facts and exchange rates — anywhere.</div>
        </>
      )}

      <div className="section-title">Check visa & country</div>
      {!profile.passportCca3 && (
        <div className="errbox" style={{ background: 'var(--bg-soft)', color: 'var(--text-soft)', borderColor: 'var(--border)' }}>
          Set your passport in Settings to see visa requirements.
        </div>
      )}
      <div className="card">
        <CountryPicker value={dest?.cca3} onChange={setDest} placeholder="Choose a destination country" />
      </div>
      {dest && <CountryCard code={dest.cca3} passport={profile.passportCca3} homeCurrency={profile.homeCurrency} />}

      <div className="section-title">Currency converter</div>
      <CurrencyConverter defaultFrom={profile.homeCurrency} />
    </div>
  )
}

function CountryCard({ code, passport, homeCurrency }) {
  const { data, loading, error } = useAsync(async () => {
    const country = await countryByCode(code)
    const visa = passport ? await visaRequirement(passport, code) : null
    const destCurrency = country?.currencies?.[0]?.code
    let rate = null
    if (destCurrency && destCurrency !== homeCurrency) rate = await convertOne(1, homeCurrency, destCurrency).catch(() => null)
    return { country, visa, destCurrency, rate }
  }, [code, passport, homeCurrency])

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  if (!data?.country) return null
  const { country, visa, destCurrency, rate } = data
  const meta = visa ? STATUS_META[visa.status] || STATUS_META.unknown : null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <PlaceImage query={country.name} className="cover" fallback={country.flagImg}>
        <div className="veil" />
        <div className="flagrow"><div className="name">{country.flag} {country.name}</div></div>
      </PlaceImage>
      <div style={{ padding: 14 }}>
        {visa && (
          <div className="visa-row">
            <span className="visa-dot" style={{ background: meta.color }} />
            <div className="grow"><div style={{ fontWeight: 700 }}>{meta.emoji} {visa.label}</div><div className="small muted">For {passport} passport</div></div>
          </div>
        )}
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="chip">🏛️ {country.capital || '—'}</span>
          {destCurrency && <span className="chip">💱 {destCurrency}</span>}
          {country.callingCode && <span className="chip">📞 {country.callingCode}</span>}
          {country.languages[0] && <span className="chip">🗣️ {country.languages.slice(0, 3).join(', ')}</span>}
        </div>
        {rate && <div className="small soft" style={{ marginTop: 10 }}>💰 1 {homeCurrency} ≈ {money(rate, destCurrency)}</div>}
      </div>
    </div>
  )
}
