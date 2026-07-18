// The skipping stone — a pure flight model, no Babylon, no DOM.
//
// A thrown stone arcs under gravity toward the far bank; when it meets the
// water shallow and fast it skips (losing a little pace and height each
// time), and when it arrives steep or slow it sinks. Every contact is
// reported as an event; the game decides what each one means (a ripple, a
// pad thud, a calm-circle hush). Pure data in, events out — unit-testable
// headless, and the renderer just draws the state.

const GRAVITY = -9.8
const AIR_DRAG = 0.08 // per second, gentle
const SKIP_RESTITUTION = 0.52 // vertical bounce kept per skip
const SKIP_PACE_KEPT = 0.82 // horizontal speed kept per skip
const SKIM_VY_MAX = 4.2 // steeper vertical impact than this = plunge
const MIN_SKIP_SPEED = 4.4 // slower than this over the water = sink
const MIN_POP = 1.1 // a skip always pops at least this much (little hops die out)

// power 0..1 → a throw. angle is radians off straight-ahead (0 = toward -z),
// curve is sidespin: a lateral acceleration that bends the flight.
export function throwStone(x, z, { angle = 0, power = 0.6, curve = 0 } = {}) {
  const h = 6 + power * 15 // horizontal pace — full power spans the pond
  return {
    x,
    y: 0.35,
    z,
    vx: Math.sin(angle) * h + curve * 0.4,
    vy: 0.8 + power * 0.7, // a flat launch: skimming, not lobbing
    vz: -Math.cos(angle) * h,
    curve, // lateral accel from sidespin, decays with each skip
    spin: 10 + power * 18, // visual roll rate
    skips: 0,
    done: false,
  }
}

// Advance the stone by dt. Returns an array of contact events (usually empty,
// sometimes one): {type:'skip'|'sink', x, z, speed, skips}.
export function stepStone(stone, dt) {
  if (stone.done) return []
  const events = []

  const drag = Math.max(0, 1 - AIR_DRAG * dt)
  stone.vx = (stone.vx + stone.curve * dt) * drag
  stone.vz = stone.vz * drag
  stone.vy += GRAVITY * dt

  stone.x += stone.vx * dt
  stone.y += stone.vy * dt
  stone.z += stone.vz * dt

  if (stone.y <= 0 && stone.vy < 0) {
    const hSpeed = Math.hypot(stone.vx, stone.vz)
    const speed = Math.hypot(hSpeed, stone.vy)
    const canSkip = -stone.vy < SKIM_VY_MAX && hSpeed > MIN_SKIP_SPEED
    if (canSkip) {
      stone.skips++
      stone.y = 0
      stone.vy = Math.max(-stone.vy * SKIP_RESTITUTION, MIN_POP)
      stone.vx *= SKIP_PACE_KEPT
      stone.vz *= SKIP_PACE_KEPT
      stone.curve *= 0.75
      events.push({ type: 'skip', x: stone.x, z: stone.z, speed, skips: stone.skips })
    } else {
      stone.done = true
      stone.y = 0
      events.push({ type: 'sink', x: stone.x, z: stone.z, speed, skips: stone.skips })
    }
  }
  return events
}

// Stop the stone where it is (it hit a pad, a rock, or the bank).
export function groundStone(stone) {
  stone.done = true
  return { type: 'sink', x: stone.x, z: stone.z, speed: Math.hypot(stone.vx, stone.vy, stone.vz), skips: stone.skips }
}

// A rock poking above the water is solid at flight height too — a stone
// can't sail through one between skips. Returns the rock hit, or null.
// Rocks are squashed spheres centered a little above the waterline.
export function stoneHitsRock(stone, rocks) {
  if (stone.done) return null
  for (const s of rocks) {
    const cy = s.radius * s.squash * 0.35
    const dx = stone.x - s.x
    const dy = (stone.y - cy) / Math.max(0.35, s.squash) // squashed vertically
    const dz = stone.z - s.z
    const hit = s.radius * 0.95 + 0.1
    if (dx * dx + dy * dy + dz * dz < hit * hit) return s
  }
  return null
}
