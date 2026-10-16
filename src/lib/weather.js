// Live weather from Open-Meteo (free, open, no key, CORS).
import { getJSON } from './http.js'

// WMO weather codes -> emoji + short label.
const WMO = {
  0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Drizzle'],
  61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'],
  80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Heavy showers'],
  95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Thunderstorm'],
}
export const wmo = (code) => WMO[code] || ['🌡️', '—']

export async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto&forecast_days=4`
  const d = await getJSON(url, { timeout: 12000 })
  const [emoji, label] = wmo(d.current?.weather_code)
  const days = (d.daily?.time || []).map((t, i) => ({
    date: t,
    max: Math.round(d.daily.temperature_2m_max[i]),
    min: Math.round(d.daily.temperature_2m_min[i]),
    ...(() => { const [e, l] = wmo(d.daily.weather_code[i]); return { emoji: e, label: l } })(),
  }))
  return { tempNow: Math.round(d.current?.temperature_2m), emoji, label, days }
}
