// Ripples level generator — pure and seeded: the same level number always
// builds the same pond. Carried over from the 2D game's tuned difficulty
// curves, remapped from screen pixels into pond-local world units (x/z on the
// water plane, +z toward the camera). The pond is a disc of radius R.

const PROTECTED_RADIUS = 1.25
const MIN_LOTUS_SPACING = 3.75

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// a seeded point inside the playable disc (margin in from the bank)
function spot(rng, R, margin) {
  const a = rng() * Math.PI * 2
  const r = Math.sqrt(rng()) * (R - margin)
  return { x: Math.cos(a) * r, z: Math.sin(a) * r }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function pointToSegment(p, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
  return dist(p, { x: a.x + t * dx, z: a.z + t * dz })
}

export function generateLevel(levelNum, R = 9) {
  const rng = seededRandom(levelNum * 12345)

  // difficulty curve (unchanged from the 2D game)
  const lotusCount = Math.min(2 + Math.floor(levelNum / 4), 5)
  const stoneCount = Math.min(Math.floor((levelNum - 1) / 3), 3)
  const padGroupCount = Math.min(Math.floor((levelNum - 2) / 4), 2)

  const tapsAllowed = Math.max(2, Math.ceil(lotusCount * 0.6) + Math.floor(levelNum / 8))
  const optimalTaps = Math.max(1, Math.ceil(lotusCount * 0.5))

  const lotus = []
  const stones = []
  const pads = []

  // lotus flowers (each floats on its own pad, built by the scene)
  for (let i = 0; i < lotusCount; i++) {
    let p
    for (let tries = 0; tries < 100; tries++) {
      p = spot(rng, R, 2.2)
      const crowded =
        lotus.some((l) => dist(p, l) < MIN_LOTUS_SPACING) || stones.some((s) => dist(p, s) < 2.5)
      if (!crowded) break
    }
    lotus.push({
      id: `lotus_${i}`,
      x: p.x,
      z: p.z,
      threshold: 0.65 + rng() * 0.15,
      protectedRadius: PROTECTED_RADIUS,
      isActivated: false,
      accumulatedPower: 0,
      currentPower: 0,
      padRadius: 1.15 + rng() * 0.25,
      scale: 0.8 + rng() * 0.3,
      rotation: rng() * Math.PI * 2,
      hue: rng(), // petal tint pick
    })
  }

  // stones: reflect waves; keep them off flower-to-flower wave paths
  for (let i = 0; i < stoneCount; i++) {
    let p
    for (let tries = 0; tries < 100; tries++) {
      p = spot(rng, R, 1.6)
      const nearLotus = lotus.some((l) => dist(p, l) < 4.5)
      const nearStone = stones.some((s) => dist(p, s) < 2.0)
      const blocksPath = lotus.some((a, i1) =>
        lotus.some((b, i2) => i1 < i2 && pointToSegment(p, a, b) < 3.0),
      )
      if (!nearLotus && !nearStone && !blocksPath) break
    }
    stones.push({
      id: `stone_${i}`,
      x: p.x,
      z: p.z,
      radius: 0.62 + rng() * 0.26,
      rotation: rng() * Math.PI * 2,
      squash: 0.55 + rng() * 0.2,
    })
  }

  // drifting lily pad clusters: absorb waves, pushed around by them (Havok)
  for (let g = 0; g < padGroupCount; g++) {
    let c
    for (let tries = 0; tries < 100; tries++) {
      c = spot(rng, R, 2.4)
      const nearLotus = lotus.some((l) => dist(c, l) < 5.0)
      const nearStone = stones.some((s) => dist(c, s) < 2.5)
      const blocksPath = lotus.some((a, i1) =>
        lotus.some((b, i2) => i1 < i2 && pointToSegment(c, a, b) < 3.75),
      )
      if (!nearLotus && !nearStone && !blocksPath) break
    }
    const groupSize = 2 + Math.floor(rng() * 2)
    for (let i = 0; i < groupSize; i++) {
      const a = (i / groupSize) * Math.PI * 2 + rng() * 0.5
      const d = 1.5 + rng() * 1.5
      pads.push({
        id: `pad_${g}_${i}`,
        x: c.x + Math.cos(a) * d,
        z: c.z + Math.sin(a) * d,
        radius: 1.0 + rng() * 0.4,
        rotation: rng() * Math.PI * 2,
        driftAngle: a + (rng() - 0.5), // initial slow drift direction
      })
    }
  }

  // ambient pond life
  const reeds = []
  const reedCount = 7 + Math.floor(rng() * 4)
  for (let i = 0; i < reedCount; i++) {
    const a = rng() * Math.PI * 2
    const r = R - 0.4 - rng() * 1.2
    reeds.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      height: 0.9 + rng() * 0.9,
      lean: (rng() - 0.5) * 0.25,
      blades: 2 + Math.floor(rng() * 3),
      seed: rng() * Math.PI * 2,
    })
  }

  const fish = []
  const fishCount = 1 + Math.floor(rng() * 2)
  for (let i = 0; i < fishCount; i++) {
    const p = spot(rng, R, 2.0)
    fish.push({
      x: p.x,
      z: p.z,
      heading: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 0.4,
      size: 0.7 + rng() * 0.5,
      warm: rng() > 0.5, // koi orange vs silver-blue
    })
  }

  return { R, lotus, stones, pads, reeds, fish, tapsAllowed, optimalTaps }
}
