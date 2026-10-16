import { useEffect, useState } from 'react'
import './App.css'
import Home from './components/Home.jsx'
import TripScreen from './components/TripScreen.jsx'
import Discover from './components/Discover.jsx'
import Settings from './components/Settings.jsx'
import Onboarding from './components/Onboarding.jsx'
import DestinationPage from './components/DestinationPage.jsx'
import TripBuilder from './components/TripBuilder.jsx'
import { useStore, createTrip, importTripObject } from './lib/store.js'
import { uid } from './lib/format.js'
import { readSharedTrip } from './lib/share.js'

const NAV = [
  { key: 'trips', ico: '🧳', label: 'Trips' },
  { key: 'discover', ico: '🧭', label: 'Discover' },
  { key: 'settings', ico: '⚙️', label: 'Settings' },
]

export default function App() {
  const { profile } = useStore()
  const [nav, setNav] = useState('trips')
  const [tripId, setTripId] = useState(null)
  const [dest, setDest] = useState(null) // destination query string
  const [builder, setBuilder] = useState(null) // null | { query }
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [installEvt, setInstallEvt] = useState(null)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    const install = (e) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    window.addEventListener('beforeinstallprompt', install)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      window.removeEventListener('beforeinstallprompt', install)
    }
  }, [])

  const doInstall = async () => {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const openTrip = (id) => { setDest(null); setBuilder(null); setTripId(id); setNav('trips') }
  const openDest = (q) => { setBuilder(null); setDest(q); window.scrollTo(0, 0) }
  const openBuilder = (q = '') => { setDest(null); setBuilder({ query: q }) }

  useEffect(() => {
    const shared = readSharedTrip()
    if (shared && confirm(`Open shared trip “${shared.name}”? A copy will be saved to your trips.`)) {
      openTrip(importTripObject(shared))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startTripFromSuggestion = (country, city = '') => {
    if (!country) return
    const id = createTrip({
      name: `Trip to ${city || country.name}`,
      coverCca2: country.cca2,
      destinations: [{ id: uid(), country: { name: country.name, cca2: country.cca2, cca3: country.cca3, flag: country.flag }, city }],
    })
    openTrip(id)
  }

  if (!profile.onboarded) return <div className="app"><Onboarding /></div>

  let content
  if (builder) content = <TripBuilder initialQuery={builder.query} profile={profile} onClose={() => setBuilder(null)} onCreated={openTrip} />
  else if (dest) content = <DestinationPage query={dest} onBack={() => setDest(null)} onOpenDest={openDest} onBuild={openBuilder} onStartTrip={startTripFromSuggestion} />
  else if (nav === 'trips' && tripId) content = <TripScreen tripId={tripId} onBack={() => setTripId(null)} />
  else if (nav === 'trips') content = <Home onOpen={openTrip} onOpenDest={openDest} onBuild={openBuilder} onStartTrip={startTripFromSuggestion} />
  else if (nav === 'discover') content = <Discover onStartTrip={startTripFromSuggestion} onOpenDest={openDest} />
  else content = <Settings />

  return (
    <div className="app">
      <header className="topbar">
        <img className="logo" src="./favicon.svg" alt="" />
        <div>
          <h1>PlanGo</h1>
          <div className="sub">Plan it, then go — itinerary, costs, places & visas.</div>
        </div>
      </header>

      {!online && <div className="offline-banner">📴 Offline — showing your saved trips &amp; last-seen data</div>}
      {installEvt && (
        <div className="update-banner">📲 Install PlanGo for offline, one-tap access
          <button onClick={doInstall}>Install</button>
          <button onClick={() => setInstallEvt(null)} style={{ marginLeft: 6 }}>✕</button>
        </div>
      )}

      {content}

      <nav className="bottomnav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={nav === n.key && !dest && !builder ? 'on' : ''}
            onClick={() => { setNav(n.key); setDest(null); setBuilder(null); if (n.key === 'trips') setTripId(null) }}
          >
            <span className="ico">{n.ico}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
