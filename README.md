# PlanGo ✈️

**Plan it, then go.** A smart, all-in-one trip planner that turns "I can't decide" into a ready-to-go journey — with **live data**, worldwide, and **zero sign-up**.

🔗 **Live app:** https://adesh2151.github.io/plango
📱 Installable PWA (Add to Home Screen) · Android APK via releases

---

## What it does

| Area | What you get |
|------|--------------|
| 🧳 **Trips** | Create trips with multiple destinations (live country list), dates, budget & currency. Cover photos pulled live from Wikipedia. |
| 🗓️ **Plan** | Day-by-day itinerary with sights, food, stays, activities and **transport legs** (flight/train/bus/…), each with a cost. |
| 💰 **Money** | Log **who paid what** across any currencies. PlanGo converts everything at **live exchange rates** and computes a minimal **who-owes-whom settlement** — like Splitwise, built into your trip. Budget tracking included. |
| 🧭 **Explore** | Live attractions, restaurants, stays & parks from **OpenStreetMap**, each with a **live photo**. Plus live **flights & hotels** via Amadeus (add a free key). Save or drop any place straight into your plan. |
| ❤️ **Saved** | Favourite places, dishes and spots — with photos. |
| 🛂 **Visa & $** | For **your passport**: live visa requirement for every destination, country facts (capital, currency, languages, calling code), live exchange rates, and a currency converter. |

Everything works offline after first load (PWA), and **your trips, expenses and keys never leave your device**.

---

## Data sources (all open / free)

- **Exchange rates** — [frankfurter.app](https://frankfurter.app) (European Central Bank)
- **Country facts** — [mledoze/countries](https://github.com/mledoze/countries) (ODbL)
- **Visa requirements** — [Passport Index dataset](https://github.com/ilyankou/passport-index-dataset) by ilyankou (ODbL)
- **Places** — © OpenStreetMap contributors (ODbL) via Nominatim & Overpass
- **Photos** — Wikipedia / Wikimedia
- **Flights & hotels** — [Amadeus Self-Service API](https://developers.amadeus.com) (your own free key)

---

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run preview    # preview the build
```

### Android (Capacitor)

```bash
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

---

## Tech

React 18 · Vite 5 · vite-plugin-pwa · Capacitor 6 · plain CSS (light/dark). No backend — just open APIs and local storage.

Deployed to GitHub Pages automatically on push to `main` (`.github/workflows/deploy.yml`).
