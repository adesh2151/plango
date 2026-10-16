import { useState } from 'react'
import './App.css'
import Home from './components/Home.jsx'
import TripScreen from './components/TripScreen.jsx'
import World from './components/World.jsx'
import Settings from './components/Settings.jsx'

const NAV = [
  { key: 'trips', ico: '🧳', label: 'Trips' },
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
