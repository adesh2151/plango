// Export a trip plan as a print-ready document. Uses the browser's native
// print-to-PDF (works in the PWA and in the Android app's system print), so
// there is no heavy PDF library to ship. The user picks "Save as PDF".
import { fmtDate, dateRange, money } from './format.js'

const TYPE_EMOJI = { sight: '📸', food: '🍽️', transport: '🚆', stay: '🏨', activity: '🎟️', other: '📌' }

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function exportTripPdf(trip) {
  const nameOf = (id) => trip.travelers.find((t) => t.id === id)?.name || '—'
  const days = trip.startDate ? dateRange(trip.startDate, trip.endDate) : []
  const allDays = [...new Set([...days, ...trip.items.map((i) => i.date || 'unscheduled')])]

  // itinerary grouped by day
  const itinHtml = allDays
    .map((d, i) => {
      const items = trip.items
        .filter((it) => (it.date || 'unscheduled') === d)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      if (!items.length && d === 'unscheduled') return ''
      const rows = items
        .map(
          (it) => `<tr>
            <td class="t">${esc(it.time || '')}</td>
            <td>${TYPE_EMOJI[it.type] || '📌'} <b>${esc(it.title)}</b>${it.mode ? ` <span class="muted">(${esc(it.mode)})</span>` : ''}${
            it.place ? `<br><span class="muted">${esc(it.place)}</span>` : ''
          }</td>
            <td class="r">${Number(it.cost) > 0 ? esc(money(it.cost, it.currency || trip.baseCurrency)) : ''}</td>
          </tr>`,
        )
        .join('')
      return `<h3>${d === 'unscheduled' ? 'Unscheduled' : `Day ${i + 1}`} <span class="muted">${d !== 'unscheduled' ? esc(fmtDate(d)) : ''}</span></h3>
        <table>${rows || '<tr><td class="muted" colspan="3">Nothing planned</td></tr>'}</table>`
    })
    .join('')

  // expense totals per currency
  const totals = {}
  for (const e of trip.expenses) totals[e.currency] = (totals[e.currency] || 0) + Number(e.amount || 0)
  const expHtml = trip.expenses.length
    ? `<table>
        <tr><th>Item</th><th>Paid by</th><th class="r">Amount</th></tr>
        ${trip.expenses
          .map((e) => `<tr><td>${esc(e.title)}</td><td>${esc(nameOf(e.paidBy))}</td><td class="r">${esc(money(e.amount, e.currency))}</td></tr>`)
          .join('')}
      </table>
      <p class="muted">Totals: ${Object.entries(totals).map(([c, v]) => esc(money(v, c))).join(' · ')}</p>`
    : '<p class="muted">No expenses logged.</p>'

  const favHtml = trip.favorites.length
    ? `<ul>${trip.favorites.map((f) => `<li><b>${esc(f.name)}</b>${f.place ? ` — ${esc(f.place)}` : ''}${f.note ? `<br><span class="muted">${esc(f.note)}</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">No favourites saved.</p>'

  const pack = trip.packing || []
  const carry = pack.filter((p) => p.carry)
  const avoid = pack.filter((p) => !p.carry)
  const packHtml =
    (carry.length ? `<p><b>🎒 Carry</b></p><ul>${carry.map((p) => `<li>☐ ${esc(p.text)}</li>`).join('')}</ul>` : '') +
    (avoid.length ? `<p><b>🚫 Avoid</b></p><ul>${avoid.map((p) => `<li>☐ ${esc(p.text)}</li>`).join('')}</ul>` : '') ||
    '<p class="muted">No packing list.</p>'

  const destLine = trip.destinations
    .map((d) => `${d.country?.flag || ''} ${esc([d.city, d.country?.name].filter(Boolean).join(', '))}`)
    .join(' · ')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trip.name)} — PlanGo</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #10242c; margin: 32px; line-height: 1.5; }
      .brand { color: #0891b2; font-weight: 800; letter-spacing: -0.3px; }
      h1 { margin: 2px 0 2px; font-size: 26px; }
      h2 { margin: 26px 0 6px; font-size: 16px; border-bottom: 2px solid #0891b2; padding-bottom: 4px; color: #0e7490; }
      h3 { margin: 14px 0 4px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
      td, th { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e3eef2; font-size: 13px; vertical-align: top; }
      th { font-size: 11px; text-transform: uppercase; color: #6b8089; }
      td.t { width: 54px; color: #0891b2; font-weight: 600; }
      td.r, th.r { text-align: right; white-space: nowrap; }
      .muted { color: #7d949c; font-size: 12px; }
      ul { margin: 4px 0 8px; padding-left: 18px; font-size: 13px; }
      .meta { color: #43626e; font-size: 13px; margin-bottom: 6px; }
      .foot { margin-top: 28px; border-top: 1px solid #e3eef2; padding-top: 8px; color: #7d949c; font-size: 11px; }
      @media print { body { margin: 14mm; } h2 { break-after: avoid; } table { break-inside: auto; } tr { break-inside: avoid; } }
    </style></head><body>
    <div class="brand">✈ PlanGo</div>
    <h1>${esc(trip.name)}</h1>
    <div class="meta">${destLine || 'No destinations'}</div>
    <div class="meta">${trip.startDate ? `${esc(fmtDate(trip.startDate))} → ${esc(fmtDate(trip.endDate))}` : 'Dates TBD'} · ${trip.travelers.length} traveller(s): ${esc(trip.travelers.map((t) => t.name).join(', '))}${trip.budget > 0 ? ` · Budget ${esc(money(trip.budget, trip.baseCurrency))}` : ''}</div>

    <h2>Itinerary</h2>${itinHtml || '<p class="muted">No itinerary yet.</p>'}
    <h2>Expenses</h2>${expHtml}
    <h2>Favourites</h2>${favHtml}
    <h2>Packing</h2>${packHtml}

    <div class="foot">Generated by PlanGo on ${esc(fmtDate(new Date().toISOString().slice(0, 10)))}. Live data: frankfurter.app, mledoze/countries, Passport Index, OpenStreetMap, Wikivoyage, Wikipedia, Amadeus.</div>
    </body></html>`

  // Render in a hidden iframe and invoke the print dialog (avoids popup blockers).
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()
  const go = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }
  if (iframe.contentWindow.document.readyState === 'complete') setTimeout(go, 300)
  else iframe.onload = () => setTimeout(go, 300)
}
