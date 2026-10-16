import { useState } from 'react'
import './App.css'
import Home from './components/Home.jsx'
import TripScreen from './components/TripScreen.jsx'
import Discover from './components/Discover.jsx'
import World from './components/World.jsx'
import Settings from './components/Settings.jsx'
import { createTrip } from './lib/store.js'
import { uid } from './lib/format.js'

const NAV = [
  { key: 'trips', ico: '🧳', label: 'Trips' },
  { key: 'discover', ico: '🧭', label: 'Discover' },
  { key: 'world', ico: '🌍', label: 'World' },
  { key: 'settings', ico: '⚙️', label: 'Settings' },
]

export default function App() {
  const [nav, setNav] = useState('trips')
  const [tripId, setTripId] = useState(null)

  const openTrip = (id) => {
    setTripId(id)
    setNav('trips')
  }

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

      {nav === 'trips' && !tripId && <Home onOpen={openTrip} />}
      {showTrip && <TripScreen tripId={tripId} onBack={() => setTripId(null)} />}
      {nav === 'discover' && <Discover onStartTrip={startTripFromSuggestion} />}
      {nav === 'world' && <World />}
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
