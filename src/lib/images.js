// Live place photos from Wikipedia (free). Each image links back to its
// Wikipedia page for attribution. Thumbnails are CC/again per-file licensed;
// we always show the source link so credit is preserved.
import { getJSON } from './http.js'

const cache = new Map()

// title may be a plain name ("Eiffel Tower") or an OSM "en:Eiffel Tower" tag.
export async function wikiImage(title, lang = 'en') {
  if (!title) return null
  let t = title
  let l = lang
  const m = /^([a-z]{2,3}):(.*)$/.exec(title)
  if (m) {
    l = m[1]
    t = m[2]
  }
  const key = `${l}:${t}`
  if (cache.has(key)) return cache.get(key)

  const url = `https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    t.replace(/ /g, '_'),
  )}`
  let result = null
  try {
    const data = await getJSON(url, { timeout: 10000 })
    if (data && (data.thumbnail || data.originalimage)) {
      result = {
        thumb: data.thumbnail?.source || data.originalimage?.source,
        full: data.originalimage?.source || data.thumbnail?.source,
        page: data.content_urls?.desktop?.page || `https://${l}.wikipedia.org/wiki/${t}`,
        extract: data.extract || '',
        title: data.title || t,
      }
    }
  } catch {
    result = null
  }
  cache.set(key, result)
  return result
}
