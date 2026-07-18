// Ripples level generator — pure and seeded: the same level number always
// builds the same pond. World layout for the skipping game: the pond is a
// disc of radius R, the thrower stands on the near bank at +z, and stones
// fly toward the far bank at -z. Gameplay actors (lotus, stones, drifting
// pads) live in the throw fan; ambient life (reeds, fringe pads, trees,
// koi, dragonflies) rings the water so the pond feels expansive and alive.

const PROTECTED_RADIUS = 1.25
const MIN_LOTUS_SPACING = 3.75

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
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

export function generateLevel(levelNum, R = 13) {
  const rng = seededRandom(levelNum * 12345)

  // a seeded point in the playable fan: in front of the thrower, off the
  // banks, inside the camera's wedge (the fan widens with distance, like a
  // lane), reachable by a skipping stone
  const playSpot = () => {
    for (let tries = 0; tries < 50; tries++) {
      const z = -(R - 3.2) + rng() * (R - 3.2 + (R - 8))
      const wedge = Math.min(
        Math.sqrt(Math.max(0, (R - 2.2) ** 2 - z * z)),
        1.8 + (R - 0.8 - z) * 0.16,
      )
      const x = (rng() * 2 - 1) * wedge
      if (Math.hypot(x, z) < R - 2.2) return { x, z }
    }
    return { x: 0, z: 0 }
  }

  // difficulty curve (unchanged from the 2D original)
  const lotusCount = Math.min(2 + Math.floor(levelNum / 4), 5)
  const stoneCount = Math.min(Math.floor((levelNum - 1) / 3), 3)
  const padGroupCount = Math.min(Math.floor((levelNum - 2) / 4), 2)

  const stonesAllowed = Math.max(2, Math.ceil(lotusCount * 0.6) + Math.floor(levelNum / 8))
  const optimalStones = Math.max(1, Math.ceil(lotusCount * 0.5))

  const lotus = []
  const stones = []
  const pads = []

  for (let i = 0; i < lotusCount; i++) {
    let p
    for (let tries = 0; tries < 100; tries++) {
      p = playSpot()
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
      hue: rng(),
    })
  }

  // stones: reflect waves (and clack a skipping stone); keep them off
  // flower-to-flower wave paths
  for (let i = 0; i < stoneCount; i++) {
    let p
    for (let tries = 0; tries < 100; tries++) {
      p = playSpot()
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

  // drifting lily pad clusters: absorb waves (and swallow a skipping stone)
  for (let g = 0; g < padGroupCount; g++) {
    let c
    for (let tries = 0; tries < 100; tries++) {
      c = playSpot()
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
        driftAngle: a + (rng() - 0.5),
      })
    }
  }

  // ---- ambient pond life (visual only) ----

  // reeds ring the banks, thicker on the sides and far shore
  const reeds = []
  const reedCount = 12 + Math.floor(rng() * 6)
  for (let i = 0; i < reedCount; i++) {
    const a = rng() * Math.PI * 2
    const r = R - 0.4 - rng() * 1.2
    const p = { x: Math.cos(a) * r, z: Math.sin(a) * r }
    if (p.z > R - 4.5 && Math.abs(p.x) < 4) continue // keep the throw corridor clear
    reeds.push({
      x: p.x,
      z: p.z,
      height: 0.9 + rng() * 1.1,
      lean: (rng() - 0.5) * 0.25,
      blades: 2 + Math.floor(rng() * 3),
      seed: rng() * Math.PI * 2,
    })
  }

  // decorative fringe pads hugging the banks (no gameplay effect)
  const fringePads = []
  const fringeCount = 9 + Math.floor(rng() * 4)
  for (let i = 0; i < fringeCount; i++) {
    const a = rng() * Math.PI * 2
    const r = R - 0.8 - rng() * 1.4
    const p = { x: Math.cos(a) * r, z: Math.sin(a) * r }
    if (p.z > R - 5 && Math.abs(p.x) < 5) continue
    if (lotus.some((l) => dist(p, l) < 3)) continue
    fringePads.push({
      x: p.x,
      z: p.z,
      radius: 0.5 + rng() * 0.55,
      rotation: rng() * Math.PI * 2,
      seed: rng() * Math.PI * 2,
    })
  }

  // a ragged tree line beyond the banks — the world past the water
  const trees = []
  const treeCount = 12 + Math.floor(rng() * 5)
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + (rng() - 0.5) * 0.3
    const r = R + 3.5 + rng() * 5
    const p = { x: Math.cos(a) * r, z: Math.sin(a) * r }
    if (p.z > R + 1) continue // not behind the camera
    trees.push({
      x: p.x,
      z: p.z,
      height: 2.6 + rng() * 2.8,
      width: 1.3 + rng() * 1.3,
      tone: rng(),
      kind: rng() > 0.6 ? 'conifer' : 'broadleaf',
    })
  }

  const fish = []
  const fishCount = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < fishCount; i++) {
    const p = playSpot()
    fish.push({
      x: p.x,
      z: p.z,
      heading: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 0.4,
      size: 0.7 + rng() * 0.5,
      warm: rng() > 0.5,
    })
  }

  // dragonflies hover over the shallows, darting now and then
  const dragonflies = []
  const flyCount = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < flyCount; i++) {
    const a = rng() * Math.PI * 2
    const r = 3 + rng() * (R - 5)
    dragonflies.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      wander: 1.5 + rng() * 2.5,
      phase: rng() * Math.PI * 2,
      height: 0.5 + rng() * 0.5,
    })
  }

  return {
    R,
    lotus,
    stones,
    pads,
    reeds,
    fringePads,
    trees,
    fish,
    dragonflies,
    stonesAllowed,
    optimalStones,
  }
}
