// Live country reference data from the open mledoze/countries dataset (ODbL).
// restcountries.com was deprecated to a paid v5, so we read the upstream
// open dataset directly. Flag images come from flagcdn.com (free).
import { getJSON } from './http.js'

const DATA_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'

let allCache = null

export async function allCountries() {
  if (allCache) return allCache
  const data = await getJSON(DATA_URL, { timeout: 20000 })
  allCache = data
    .map(normalise)
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name))
  return allCache
}

export async function countryByCode(code) {
  const list = await allCountries()
  const c = (code || '').toUpperCase()
  return list.find((x) => x.cca2 === c || x.cca3 === c) || null
}

export async function searchCountries(q) {
  const list = await allCountries()
  const s = (q || '').trim().toLowerCase()
  if (!s) return list
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(s) ||
      c.official.toLowerCase().includes(s) ||
      (c.capital || '').toLowerCase().includes(s) ||
      c.cca2.toLowerCase() === s ||
      c.cca3.toLowerCase() === s,
  )
}

export function flagImg(cca2) {
  return cca2 ? `https://flagcdn.com/w320/${cca2.toLowerCase()}.png` : ''
}

function normalise(c) {
  const currencies = c.currencies
    ? Object.entries(c.currencies).map(([code, v]) => ({
        code,
        name: v.name,
        symbol: v.symbol || code,
      }))
    : []
  return {
    name: c.name?.common || '',
    official: c.name?.official || '',
    cca2: c.cca2 || '',
    cca3: c.cca3 || '',
    flag: c.flag || '',
    flagImg: flagImg(c.cca2),
    capital: Array.isArray(c.capital) ? c.capital[0] : c.capital || '',
    region: c.region || '',
    subregion: c.subregion || '',
    languages: c.languages ? Object.values(c.languages) : [],
    latlng: Array.isArray(c.latlng) ? c.latlng : [],
    currencies,
    callingCode:
      c.idd && c.idd.root ? `${c.idd.root}${(c.idd.suffixes && c.idd.suffixes[0]) || ''}` : '',
  }
}
