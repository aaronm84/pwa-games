// Geometry helpers for building holes.
//
// Everything ultimately becomes a flat array of {x,y} points (a closed polygon).
// The collision engine tessellates polygons into segments, so a "curve" is just
// a polygon with many closely-spaced points — that's how we get organic, blobby
// fairways and hazards without changing the physics.

// deterministic PRNG so hand-placed blobs look the same on every load
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// axis-aligned rectangle (kept for structured holes)
export function rect(x1, y1, x2, y2) {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

// Catmull-Rom through the control points, returning a dense closed polygon.
// `step` = samples per control segment (higher = smoother).
export function smooth(pts, step = 12) {
  const out = []
  const n = pts.length
  if (n < 3) return pts.slice()
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    for (let s = 0; s < step; s++) {
      const t = s / step
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  return out
}

// An organic blob around (cx, cy): `n` control points on a circle of radius r
// with seeded radial wobble, then smoothed. `squash` stretches it vertically.
export function blob(cx, cy, r, opts = {}) {
  const { n = 9, wobble = 0.24, seed = 7, squash = 1, stretch = 1 } = opts
  const rand = mulberry32(seed)
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 - wobble + rand() * wobble * 2)
    pts.push({ x: cx + Math.cos(a) * rr * stretch, y: cy + Math.sin(a) * rr * squash })
  }
  return smooth(pts, 10)
}

// A smooth "capsule" corridor down a list of waypoints with a given half-width.
// Good for winding organic fairways: give it a spine and it fluffs out to a
// rounded ribbon. Returns a closed polygon (one side down, other side back).
export function ribbon(spine, halfWidth) {
  const left = []
  const right = []
  const n = spine.length
  for (let i = 0; i < n; i++) {
    const prev = spine[Math.max(0, i - 1)]
    const next = spine[Math.min(n - 1, i + 1)]
    let dx = next.x - prev.x
    let dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const nx = -dy
    const ny = dx
    const w = typeof halfWidth === 'function' ? halfWidth(i / (n - 1)) : halfWidth
    left.push({ x: spine[i].x + nx * w, y: spine[i].y + ny * w })
    right.push({ x: spine[i].x - nx * w, y: spine[i].y - ny * w })
  }
  // walk down the left side and back up the right → closed loop, then smooth
  return smooth([...left, ...right.reverse()], 6)
}

export function polyBounds(poly) {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const p of poly) {
    if (p.x < x1) x1 = p.x
    if (p.y < y1) y1 = p.y
    if (p.x > x2) x2 = p.x
    if (p.y > y2) y2 = p.y
  }
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 }
}
