import { useEffect, useState } from 'react'
import './App.css'
import Home from './components/Home.jsx'
import TripScreen from './components/TripScreen.jsx'
import Discover from './components/Discover.jsx'
import Settings from './components/Settings.jsx'
import { createTrip, importTripObject } from './lib/store.js'
import { uid } from './lib/format.js'
import { readSharedTrip } from './lib/share.js'

const NAV = [
  { key: 'trips', ico: '🧳', label: 'Trips' },
  { key: 'discover', ico: '🧭', label: 'Discover' },
  { key: 'settings', ico: '⚙️', label: 'Settings' },
]

export default function App() {
  const [nav, setNav] = useState('trips')
  const [tripId, setTripId] = useState(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const openTrip = (id) => {
    setTripId(id)
    setNav('trips')
  }

  // A shared trip link (#t=...) opens a copy of that plan.
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
      destinations: [
        { id: uid(), country: { name: country.name, cca2: country.cca2, cca3: country.cca3, flag: country.flag }, city },
      ],
    })
    openTrip(id)
  }

  const showTrip = nav === 'trips' && tripId

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

      {nav === 'trips' && !tripId && <Home onOpen={openTrip} onStartTrip={startTripFromSuggestion} />}
      {showTrip && <TripScreen tripId={tripId} onBack={() => setTripId(null)} />}
      {nav === 'discover' && <Discover onStartTrip={startTripFromSuggestion} />}
      {nav === 'settings' && <Settings />}

      <nav className="bottomnav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={nav === n.key ? 'on' : ''}
            onClick={() => {
              setNav(n.key)
              if (n.key === 'trips') setTripId(null)
            }}
          >
            <span className="ico">{n.ico}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
