// Expense-splitting engine.
//
// Input expenses must already be normalised to the trip's base currency:
//   { baseAmount: Number, paidBy: travelerId, splitAmong: [travelerId, ...] }
// (Currency conversion happens upstream with live FX rates, then this stays
// pure and synchronous so the math is easy to reason about and test.)

const CENT = 100

export function computeBalances(expenses, travelers) {
  const ids = travelers.map((t) => t.id)
  const paid = Object.fromEntries(ids.map((id) => [id, 0]))
  const share = Object.fromEntries(ids.map((id) => [id, 0]))
  let total = 0

  for (const e of expenses) {
    const amt = Number(e.baseAmount) || 0
    if (amt <= 0) continue
    const members = (e.splitAmong && e.splitAmong.length ? e.splitAmong : ids).filter((id) =>
      ids.includes(id),
    )
    if (!members.length) continue
    total += amt
    if (paid[e.paidBy] !== undefined) paid[e.paidBy] += amt

    // Split in integer cents so rounding never loses or invents money.
    const cents = Math.round(amt * CENT)
    const base = Math.floor(cents / members.length)
    let remainder = cents - base * members.length
    for (const id of members) {
      let portion = base
      if (remainder > 0) {
        portion += 1
        remainder -= 1
      }
      share[id] += portion / CENT
    }
  }

  const net = Object.fromEntries(ids.map((id) => [id, round2(paid[id] - share[id])]))
  const settlements = minimiseTransfers(net)

  return { total: round2(total), paid: round2map(paid), share: round2map(share), net, settlements }
}

// Greedy min-cash-flow: match biggest debtor to biggest creditor repeatedly.
function minimiseTransfers(net) {
  const creditors = []
  const debtors = []
  for (const [id, bal] of Object.entries(net)) {
    const c = Math.round(bal * CENT)
    if (c > 0) creditors.push({ id, c })
    else if (c < 0) debtors.push({ id, c: -c })
  }
  creditors.sort((a, b) => b.c - a.c)
  debtors.sort((a, b) => b.c - a.c)

  const out = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].c, creditors[j].c)
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / CENT })
    debtors[i].c -= pay
    creditors[j].c -= pay
    if (debtors[i].c === 0) i++
    if (creditors[j].c === 0) j++
  }
  return out
}

function round2(n) {
  return Math.round((Number(n) || 0) * CENT) / CENT
}
function round2map(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round2(v)]))
}
