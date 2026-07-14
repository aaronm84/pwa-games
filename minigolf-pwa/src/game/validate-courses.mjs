// Course data validator — run with `node src/game/validate-courses.mjs`.
// Catches unplayable holes before they ship: tees/cups off the green or jammed
// against an edge, hazards swallowing the tee or cup, out-of-bounds geometry.
import { courses } from './courses.js'

const W = 520
const H = 760
const problems = []

function pin(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function distToPoly(p, poly) {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)))
  }
  return best
}

for (const course of courses) {
  course.holes.forEach((h, i) => {
    const tag = `${course.id} #${i + 1} "${h.name}"`
    const bad = (msg) => problems.push(`${tag}: ${msg}`)

    if (!(h.par >= 2 && h.par <= 5)) bad(`par ${h.par} out of range`)
    for (const p of h.fairway) {
      if (p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5) { bad(`fairway point out of bounds (${p.x | 0},${p.y | 0})`); break }
    }
    for (const [label, pt, min] of [['tee', h.tee, 22], ['cup', h.cup, 26]]) {
      if (!pin(pt, h.fairway)) bad(`${label} outside fairway`)
      else if (distToPoly(pt, h.fairway) < min) bad(`${label} only ${distToPoly(pt, h.fairway) | 0}px from fairway edge (< ${min})`)
      for (const w of h.walls || []) if (pin(pt, w)) bad(`${label} inside a wall`)
      for (const z of h.zones || []) if (pin(pt, z.poly)) bad(`${label} inside a ${z.type} zone`)
      for (const b of h.bumpers || []) if (Math.hypot(pt.x - b.x, pt.y - b.y) < b.r + 12) bad(`${label} on a bumper`)
      for (const wm of h.windmills || []) if (Math.hypot(pt.x - wm.x, pt.y - wm.y) < wm.hub + 14) bad(`${label} in a windmill hub`)
    }
    // proximity only matters when the straight tee->cup line is actually open:
    // on the fairway the whole way and not blocked by a wall
    if (Math.hypot(h.tee.x - h.cup.x, h.tee.y - h.cup.y) < 180) {
      let open = true
      for (let t = 0.1; t < 1 && open; t += 0.1) {
        const pt = { x: h.tee.x + (h.cup.x - h.tee.x) * t, y: h.tee.y + (h.cup.y - h.tee.y) * t }
        if (!pin(pt, h.fairway)) open = false
        for (const w of h.walls || []) if (pin(pt, w)) open = false
      }
      if (open) bad('tee and cup too close (straight open line)')
    }
    // moving cups must stay on the fairway across their sweep
    const m = h.cup.move
    if (m) {
      for (const v of [m.min, m.max]) {
        const pt = m.axis === 'x' ? { x: v, y: h.cup.y } : { x: h.cup.x, y: v }
        if (!pin(pt, h.fairway) || distToPoly(pt, h.fairway) < 24) bad(`moving cup leaves fairway at ${m.axis}=${v}`)
      }
    }
    for (const p of h.portals || []) {
      for (const [end, pt] of [['a', p.a], ['b', p.b]]) {
        if (!pin(pt, h.fairway)) bad(`portal ${end} outside fairway`)
        for (const w of h.walls || []) if (pin(pt, w)) bad(`portal ${end} inside a wall`)
      }
    }
    for (const b of h.bumpers || []) if (!pin(b, h.fairway)) bad('bumper outside fairway')
    for (const wm of h.windmills || []) if (!pin(wm, h.fairway)) bad('windmill hub outside fairway')
  })
  const par = course.holes.reduce((s, h) => s + h.par, 0)
  console.log(`${course.id}: ${course.holes.length} holes, par ${par}`)
  if (course.holes.length !== 18) problems.push(`${course.id}: expected 18 holes, has ${course.holes.length}`)
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(' -', p)
  process.exit(1)
}
console.log('\nAll courses valid.')
