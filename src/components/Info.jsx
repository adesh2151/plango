import { useStore } from '../lib/store.js'
import { countryByCode } from '../lib/countries.js'
import { visaRequirement, STATUS_META } from '../lib/visa.js'
import { convertOne } from '../lib/currency.js'
import { money } from '../lib/format.js'
import { Loading, ErrorBox, Empty, useAsync, PlaceImage } from './ui.jsx'
import CurrencyConverter from './CurrencyConverter.jsx'

export default function Info({ trip }) {
  const { profile } = useStore()
  const passport = profile.passportCca3

  return (
    <div>
      {!passport && (
        <div className="errbox" style={{ background: 'var(--bg-soft)', color: 'var(--text-soft)', borderColor: 'var(--border)' }}>
          Set your passport country in Settings to see visa requirements for each destination.
        </div>
      )}

      {!trip.destinations.length && <Empty icon="🛂" title="No destinations" hint="Add destinations to this trip to see visa and currency info." />}

      {trip.destinations.map((d) => (
        <DestinationInfo key={d.id} dest={d} passport={passport} homeCurrency={profile.homeCurrency} />
      ))}

      <div className="section-title">Currency converter</div>
      <CurrencyConverter defaultFrom={profile.homeCurrency} defaultTo={trip.destinations[0]?.country && null} />
    </div>
  )
}

function DestinationInfo({ dest, passport, homeCurrency }) {
  const code = dest.country?.cca3
  const { data, loading, error } = useAsync(async () => {
    const country = await countryByCode(code)
    const visa = passport ? await visaRequirement(passport, code) : null
    const destCurrency = country?.currencies?.[0]?.code
    let rate = null
    if (destCurrency && destCurrency !== homeCurrency) {
      rate = await convertOne(1, homeCurrency, destCurrency).catch(() => null)
    }
    return { country, visa, destCurrency, rate }
  }, [code, passport, homeCurrency])

  if (loading) return <Loading label={`Loading ${dest.country?.name}…`} />
  if (error) return <ErrorBox error={error} />
  if (!data?.country) return null

  const { country, visa, destCurrency, rate } = data
  const meta = visa ? STATUS_META[visa.status] || STATUS_META.unknown : null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <PlaceImage query={country.name} className="cover" fallback={country.flagImg}>
        <div className="veil" />
        <div className="flagrow">
          <div className="name">{country.flag} {country.name}</div>
        </div>
      </PlaceImage>
      <div style={{ padding: 14 }}>
        {visa && (
          <div className="visa-row">
            <span className="visa-dot" style={{ background: meta.color }} />
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{meta.emoji} {visa.label}</div>
              <div className="small muted">For {passport} passport holders</div>
            </div>
          </div>
        )}
        <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
          <span className="chip">🏛️ {country.capital || '—'}</span>
          {destCurrency && <span className="chip">💱 {destCurrency}{country.currencies[0]?.symbol ? ` ${country.currencies[0].symbol}` : ''}</span>}
          {country.callingCode && <span className="chip">📞 {country.callingCode}</span>}
          {country.languages[0] && <span className="chip">🗣️ {country.languages.slice(0, 3).join(', ')}</span>}
          <span className="chip">🌍 {country.subregion || country.region}</span>
        </div>
        {rate && (
          <div className="small soft" style={{ marginTop: 10 }}>
            💰 1 {homeCurrency} ≈ {money(rate, destCurrency)} · {destCurrency && `100 ${destCurrency} ≈ ${money(100 / rate, homeCurrency)}`}
          </div>
        )}
      </div>
    </div>
  )
}
