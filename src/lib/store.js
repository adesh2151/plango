// App state: the user's own trips, travellers, expenses and favourites,
// plus profile and API settings. Persisted to localStorage; nothing about the
// user is ever sent anywhere (only their chosen Amadeus key goes to Amadeus).
import { useSyncExternalStore } from 'react'
import { uid } from './format.js'

const KEY = 'safar-mitra-v1'

const EMPTY = {
  profile: { name: '', passportCca3: '', homeCurrency: 'USD', interests: [], onboarded: false },
  settings: { amadeusId: '', amadeusSecret: '', amadeusProduction: false },
  trips: [],
  wishlist: [],
}

let state = load()
const listeners = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    const parsed = JSON.parse(raw)
    return { ...structuredClone(EMPTY), ...parsed }
  } catch {
    return structuredClone(EMPTY)
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage may be unavailable (private mode) — app still works in-memory */
  }
}

function set(next) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state)
}

// ---- profile / settings ----
export function setProfile(patch) {
  set({ ...state, profile: { ...state.profile, ...patch } })
}
export function setSettings(patch) {
  set({ ...state, settings: { ...state.settings, ...patch } })
}

// ---- backup / restore / import ----
export function exportData() {
  return JSON.stringify(state, null, 2)
}

// Replace everything from a backup file (profile, settings, trips).
export function importAll(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  if (!data || typeof data !== 'object') throw new Error('Not a valid PlanGo backup')
  set({ ...structuredClone(EMPTY), ...data })
}

// Add a single trip (e.g. from a shared link) as a fresh copy.
export function importTripObject(trip) {
  if (!trip || !trip.name) throw new Error('Not a valid trip')
  const reId = (arr) => (arr || []).map((x) => ({ ...x, id: uid() }))
  const copy = {
    baseCurrency: 'USD',
    travelers: [{ id: uid(), name: 'Me' }],
    destinations: [],
    items: [],
    expenses: [],
    favorites: [],
    packing: [],
    ...structuredClone(trip),
    id: uid(),
    createdAt: Date.now(),
    items: reId(trip.items),
    favorites: reId(trip.favorites),
    packing: reId(trip.packing),
    destinations: reId(trip.destinations),
  }
  set({ ...state, trips: [copy, ...state.trips] })
  return copy.id
}

// ---- wishlist (saved destinations) ----
export function toggleWishlist(dest) {
  const exists = state.wishlist.find((w) => w.key === dest.key)
  if (exists) set({ ...state, wishlist: state.wishlist.filter((w) => w.key !== dest.key) })
  else set({ ...state, wishlist: [{ ...dest }, ...state.wishlist] })
}
export function isWished(key) {
  return state.wishlist.some((w) => w.key === key)
}

// ---- trips ----
export function createTrip(partial = {}) {
  const id = uid()
  const me = state.profile.name || 'Me'
  const trip = {
    id,
    name: partial.name || 'New trip',
    coverCca2: partial.coverCca2 || '',
    destinations: partial.destinations || [],
    startDate: partial.startDate || '',
    endDate: partial.endDate || '',
    baseCurrency: partial.baseCurrency || state.profile.homeCurrency || 'USD',
    budget: partial.budget || 0,
    travelers: partial.travelers || [{ id: uid(), name: me }],
    items: [],
    expenses: [],
    favorites: [],
    packing: [],
    createdAt: Date.now(),
  }
  set({ ...state, trips: [trip, ...state.trips] })
  return id
}

export function updateTrip(id, patch) {
  set({
    ...state,
    trips: state.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  })
}

export function deleteTrip(id) {
  set({ ...state, trips: state.trips.filter((t) => t.id !== id) })
}

// Duplicate a whole trip (plan, expenses, favourites, packing) as a fresh,
// independently editable copy — fresh ids throughout so nothing is shared.
export function duplicateTrip(id) {
  const t = getTrip(id)
  if (!t) return null
  const newId = uid()
  const reId = (arr) => (arr || []).map((x) => ({ ...x, id: uid() }))
  const copy = {
    ...structuredClone(t),
    id: newId,
    name: `${t.name} (copy)`,
    createdAt: Date.now(),
    // Travellers keep their ids so expenses' paidBy/splitAmong stay valid.
    travelers: structuredClone(t.travelers),
    items: reId(t.items),
    expenses: reId(t.expenses),
    favorites: reId(t.favorites),
    packing: reId(t.packing),
    destinations: reId(t.destinations),
  }
  set({ ...state, trips: [copy, ...state.trips] })
  return newId
}

export function getTrip(id) {
  return state.trips.find((t) => t.id === id) || null
}

// Generic list mutators on a trip's sub-collections (items/expenses/favorites/travelers).
function listAdd(tripId, key, obj) {
  const withId = { id: uid(), ...obj }
  updateTrip(tripId, { [key]: [...(getTrip(tripId)[key] || []), withId] })
  return withId.id
}
function listUpdate(tripId, key, itemId, patch) {
  const trip = getTrip(tripId)
  updateTrip(tripId, {
    [key]: trip[key].map((x) => (x.id === itemId ? { ...x, ...patch } : x)),
  })
}
function listRemove(tripId, key, itemId) {
  const trip = getTrip(tripId)
  updateTrip(tripId, { [key]: trip[key].filter((x) => x.id !== itemId) })
}

export const addItem = (t, o) => listAdd(t, 'items', o)
export const updateItem = (t, id, p) => listUpdate(t, 'items', id, p)
export const removeItem = (t, id) => listRemove(t, 'items', id)

export const addExpense = (t, o) => listAdd(t, 'expenses', o)
export const updateExpense = (t, id, p) => listUpdate(t, 'expenses', id, p)
export const removeExpense = (t, id) => listRemove(t, 'expenses', id)

export const addFavorite = (t, o) => listAdd(t, 'favorites', o)
export const removeFavorite = (t, id) => listRemove(t, 'favorites', id)

export const addTraveler = (t, name) => listAdd(t, 'travelers', { name })
export const removeTraveler = (t, id) => listRemove(t, 'travelers', id)

export const addPacking = (t, o) => listAdd(t, 'packing', { done: false, carry: true, ...o })
export const updatePacking = (t, id, p) => listUpdate(t, 'packing', id, p)
export const removePacking = (t, id) => listRemove(t, 'packing', id)
