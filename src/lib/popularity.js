// "Popularity" signal from Wikipedia pageviews (free, open, CORS). Not user
// reviews — an honest proxy for how visited/searched a place is.
import { getJSON } from './http.js'

const cache = new Map()

function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export async function getPopularity(title) {
  if (!title) return null
  const key = title
  if (cache.has(key)) return cache.get(key)
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 3)
  const t = encodeURIComponent(title.replace(/ /g, '_'))
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${t}/monthly/${ymd(start)}/${ymd(end)}`
  let result = null
  try {
    const d = await getJSON(url, { timeout: 10000 })
    const items = d.items || []
    const avg = items.length ? items.reduce((a, b) => a + (b.views || 0), 0) / items.length : 0
    result = { avgMonthlyViews: Math.round(avg), ...tier(avg) }
  } catch {
    result = null
  }
  cache.set(key, result)
  return result
}

function tier(v) {
  if (v >= 50000) return { label: 'Must-see', stars: 5 }
  if (v >= 15000) return { label: 'Very popular', stars: 4 }
  if (v >= 4000) return { label: 'Popular', stars: 3 }
  if (v >= 800) return { label: 'Worth a stop', stars: 2 }
  return { label: 'Hidden gem', stars: 1 }
}
