// Headless checks for the pure wave model + level generator: node src/game/waves.test.mjs
import {
  TAP_CONFIGS,
  createRipple,
  ripplePower,
  stepRipples,
  collideRipples,
  powerAt,
  updateLotus,
  surfaceHeight,
  strengthFor,
} from './waves.js'
import { skipRipple } from './waves.js'
import { generateLevel } from './levels.js'
import { throwStone, stepStone, stoneHitsRock } from './skip.js'

let failed = 0
function check(name, cond) {
  if (!cond) {
    failed++
    console.error('✗', name)
  } else {
    console.log('✓', name)
  }
}

// hold-duration → strength buckets
check('short hold is light', strengthFor(80) === 'light')
check('normal hold is medium', strengthFor(250) === 'medium')
check('long hold is strong', strengthFor(600) === 'strong')

// the power curve: born weak, peaks at peakRadius, dead past 2.33×
{
  const { peakRadius, peakPower } = TAP_CONFIGS.medium
  check('power at birth is tiny', ripplePower(0.01, peakRadius, peakPower) < 0.01)
  check('power peaks at peakRadius', Math.abs(ripplePower(peakRadius, peakRadius, peakPower) - peakPower) < 1e-9)
  check('power dies past 2.33×peak', ripplePower(peakRadius * 2.4, peakRadius, peakPower) === 0)
  const mid = ripplePower(peakRadius * 0.5, peakRadius, peakPower)
  check('rise zone is between birth and peak', mid > 0.2 * peakPower && mid < peakPower)
}

// wavefronts advance with dt and expire at maxRadius
{
  let ripples = [createRipple(0, 0, 'light', () => 0.5)]
  const r = ripples[0]
  const speed = r.speed
  ripples = stepRipples(ripples, 0.5)
  check('radius advances by speed*dt', Math.abs(r.radius - speed * 0.5) < 1e-9)
  for (let i = 0; i < 100; i++) ripples = stepRipples(ripples, 0.5)
  check('expired wavefronts drop out', ripples.length === 0)
}

// stones reflect once; lily pads absorb once
{
  const ripple = createRipple(0, 0, 'medium', () => 0.5)
  ripple.radius = 3
  const stones = [{ id: 's1', x: 3, z: 0, radius: 0.7 }]
  const pads = [{ id: 'p1', x: 0, z: 3, radius: 1.1 }]
  const before = ripple.peakPower
  const born = collideRipples([ripple], stones, pads)
  check('stone reflection spawns a child wavefront', born.length === 1)
  check('child is weaker', born[0].peakPower < before)
  check('child originates at the stone face', Math.abs(born[0].x - (3 - 0.7)) < 1e-9)
  check('pad absorption halves power', Math.abs(ripple.peakPower - before * 0.5) < 1e-9)
  const born2 = collideRipples([ripple], stones, pads)
  check('reflection and absorption fire once per obstacle', born2.length === 0 && ripple.peakPower === before * 0.5)
}

// interference: two coincident wavefronts beat one
{
  const a = createRipple(-3.75, 0, 'medium', () => 0.5)
  const b = createRipple(3.75, 0, 'medium', () => 0.5)
  a.radius = 3.75
  b.radius = 3.75
  const single = powerAt(0, 0, [a])
  const both = powerAt(0, 0, [a, b])
  check('two wavefronts exceed 2× one (constructive bonus)', both > single * 2)
}

// a passing peak wave activates a lotus instantly; accumulation also works
{
  const lotus = { x: 0, z: 0, threshold: 0.7, isActivated: false, accumulatedPower: 0 }
  const r = createRipple(-TAP_CONFIGS.medium.peakRadius, 0, 'medium', () => 0.5)
  r.radius = TAP_CONFIGS.medium.peakRadius
  check('peak wavefront activates instantly', updateLotus(lotus, [r], 1 / 60) && lotus.isActivated)

  const slow = { x: 0, z: 0, threshold: 0.7, isActivated: false, accumulatedPower: 0 }
  const weak = createRipple(-TAP_CONFIGS.medium.peakRadius, 0, 'medium', () => 0.5)
  weak.radius = TAP_CONFIGS.medium.peakRadius
  weak.peakPower = 0.5 // below threshold — must accumulate
  let frames = 0
  while (!slow.isActivated && frames < 2000) {
    updateLotus(slow, [weak], 1 / 60)
    frames++
  }
  check('weak waves accumulate to activation', slow.isActivated && frames > 5)
}

// the water surface: displaced at the wavefront, calm far away
{
  const r = createRipple(0, 0, 'strong', () => 0.5)
  r.radius = 4
  const atFront = Math.abs(surfaceHeight(4, 0, [r], 0))
  const farAway = Math.abs(surfaceHeight(20, 20, [r], 0)) // beyond packet + swell ~0.024
  check('surface moves at the wavefront', atFront > 0.02)
  check('surface is calm far from the wavefront', farAway < 0.03)
}

// levels: deterministic, in-bounds, curve matches the 2D tuning
{
  const a = generateLevel(7)
  const b = generateLevel(7)
  check('same level number → same pond', JSON.stringify(a) === JSON.stringify(b))
  check('level 1 has 2 flowers', generateLevel(1).lotus.length === 2)
  check('level 20 caps at 5 flowers', generateLevel(20).lotus.length === 5)
  check('level 1 has no stones', generateLevel(1).stones.length === 0)
  check('level 10 has stones', generateLevel(10).stones.length > 0)
  check('level 10 has drifting pads', generateLevel(10).pads.length > 0)
  check('ponds come alive: trees, fringe pads, dragonflies', (() => { const l = generateLevel(3); return l.trees.length > 5 && l.fringePads.length > 3 && l.dragonflies.length >= 2 })())
  check('lettuce accents grow in every pond', [1, 4, 7, 10].every((n) => generateLevel(n).lettuces.length >= 1))
  // the pond system: every 3 levels share one place; ponds differ from
  // one another; the rock garden obeys its bounds wherever it appears
  {
    const firstLevels = []
    for (let n = 1; n <= 28; n += 3) firstLevels.push(generateLevel(n))
    const withFalls = firstLevels.filter((l) => l.waterfall)
    const stills = firstLevels.filter((l) => !l.waterfall)
    check('some ponds have waterfalls, some are still water', withFalls.length >= 3 && stills.length >= 1)
    check('every waterfall sits on the visible far arc, screen-right', withFalls.every((l) => {
      const wf = l.waterfall
      return Math.hypot(wf.x, wf.z) > l.R - 1 && wf.z < -9 && wf.x < 0 && wf.x > -7
    }))
    check("falls' ambient ripples die short of the throw fan", withFalls.every((l) => l.waterfall.z + 2.5 < -6.5))
    check('waterfalls land in different spots pond to pond', new Set(withFalls.map((l) => l.waterfall.x.toFixed(2))).size >= 3)
    check('tree lines differ pond to pond', new Set(firstLevels.map((l) => JSON.stringify(l.trees))).size === firstLevels.length)

    const a = generateLevel(4)
    const b = generateLevel(5)
    const c = generateLevel(6)
    check('a pond keeps its environment across its 3 levels', (() => {
      const env = (l) => JSON.stringify([{ ...l.pond, levelInPond: 0 }, l.waterfall, l.trees, l.cannas, l.flowerDrifts, l.reeds.slice(-6)])
      return env(a) === env(b) && env(b) === env(c)
    })())
    check('the 3 levels of a pond still differ in gameplay', JSON.stringify(a.lotus) !== JSON.stringify(b.lotus))
    check('pond numbering: levels 4-6 are pond 2', a.pond.number === 2 && c.pond.number === 2 && generateLevel(3).pond.number === 1)

    const l = generateLevel(3)
    check('pad colonies carpet the mid-water', l.padColonies.length >= 1 && l.padColonies.every((cc) => cc.leaves.length >= 8))
    check('the magenta bloom rides the first colony', l.padColonies.filter((cc) => cc.bloom).length === (l.padColonies.length ? 1 : 0))
    check('colonies keep clear of the flowers', l.padColonies.every((cc) => l.lotus.every((lo) => Math.hypot(cc.x - lo.x, cc.z - lo.z) > 2.5)))
    check('colonies keep clear of the lettuce rosettes', [3, 8, 15].every((n) => {
      const lv2 = generateLevel(n)
      return lv2.padColonies.every((cc) => lv2.lettuces.every((lt) => Math.hypot(cc.x - lt.x, cc.z - lt.z) > 1.99))
    }))
    check('canna stands flank the garden anchor on the bank', withFalls.every((wl) => wl.cannas.length >= 1 && wl.cannas.every((cn) => Math.hypot(cn.x, cn.z) > wl.R && Math.hypot(cn.x - wl.waterfall.x, cn.z - wl.waterfall.z) < 5.5)))
    check('flower drifts sweep the far bank between the rocks', firstLevels.every((fl) => fl.flowerDrifts.length >= 2 && fl.flowerDrifts.every((d) => d.z < -9)))
  }
  const lv = generateLevel(15)
  check('gameplay actors stay in the throw fan', lv.lotus.every((o) => o.z < lv.R - 7))
  const inBounds = [...lv.lotus, ...lv.stones].every((o) => Math.hypot(o.x, o.z) < lv.R)
  check('everything sits inside the pond', inBounds)
  check('stones allowed ≥ optimal', lv.stonesAllowed >= lv.optimalStones)
}

// the skipping stone: a good throw skips several times, then sinks
{
  const run = (opts) => {
    const s = throwStone(0, 12, opts)
    const events = []
    for (let i = 0; i < 3000 && !s.done; i++) events.push(...stepStone(s, 1 / 120))
    return { stone: s, events }
  }

  const good = run({ power: 0.85 })
  const skips = good.events.filter((e) => e.type === 'skip')
  const sinks = good.events.filter((e) => e.type === 'sink')
  check('a strong throw skips at least 3 times', skips.length >= 3)
  check('every flight ends in exactly one sink', sinks.length === 1)
  check('the sink comes last', good.events[good.events.length - 1].type === 'sink')
  check('skips march toward the far bank (−z)', skips.every((e, i) => i === 0 || e.z < skips[i - 1].z))
  check('later skips are slower', skips.every((e, i) => i === 0 || e.speed < skips[i - 1].speed))
  check('the stone stays on line without curve', skips.every((e) => Math.abs(e.x) < 0.01))

  const weak = run({ power: 0 })
  const weakSkips = weak.events.filter((e) => e.type === 'skip').length
  check('a feeble toss dies quickly', weakSkips <= 2)
  check('more power carries further', good.stone.z < weak.stone.z)

  const bent = run({ power: 0.8, curve: 3 })
  const bentSkips = bent.events.filter((e) => e.type === 'skip')
  check('sidespin bends the path', bentSkips.length > 0 && Math.abs(bentSkips[bentSkips.length - 1].x) > 0.5)

  const aimed = run({ power: 0.8, angle: 0.3 })
  check('aim angle steers the throw', aimed.stone.x > 1)

  // loft: trading skips for a placeable plunge
  const flat = run({ power: 0.8 })
  const lob = run({ power: 0.8, loft: 1 })
  const half = run({ power: 0.8, loft: 0.5 })
  const lobSkips = lob.events.filter((e) => e.type === 'skip').length
  const halfSkips = half.events.filter((e) => e.type === 'skip').length
  const flatSkips = flat.events.filter((e) => e.type === 'skip').length
  check('a full lob plunges without skipping', lobSkips === 0)
  check('a half loft skips less than a flat skim', halfSkips < flatSkips)
  check('lofting shortens the carry', lob.stone.z > flat.stone.z + 2)
  check('a lob still clears the near water', lob.stone.z < 6)
  const lobSink = lob.events.find((e) => e.type === 'sink')
  check('a lob lands with real impact speed', lobSink.speed > 6)
}

// rocks are solid at flight height — no stone sails through one
{
  const rock = { x: 0, z: 0, radius: 0.75, squash: 0.65 }
  const skimming = { x: 0.2, y: 0.15, z: 0.1, done: false }
  const above = { x: 0, y: 2.5, z: 0, done: false }
  const wide = { x: 3, y: 0.15, z: 0, done: false }
  check('a skimming stone clacks into a rock', stoneHitsRock(skimming, [rock]) === rock)
  check('flying high over a rock is fine', stoneHitsRock(above, [rock]) === null)
  check('passing beside a rock is fine', stoneHitsRock(wide, [rock]) === null)
}

// pads never spawn interpenetrating (the solver would shove them violently)
{
  let clean = true
  for (const lvl of [6, 10, 12, 18, 25]) {
    const l = generateLevel(lvl)
    for (let i = 0; i < l.pads.length; i++) {
      for (let j = i + 1; j < l.pads.length; j++) {
        const a = l.pads[i]
        const b = l.pads[j]
        if (Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius + 0.29) clean = false
      }
    }
  }
  check('pads spawn with room to breathe', clean)
}

// one throw = one wave train: its own skips never stack, other throws do
{
  const a = skipRipple(-3, 0, 15, 'throw_1')
  const b = skipRipple(3, 0, 15, 'throw_1')
  a.radius = 3
  b.radius = 3
  const single = powerAt(0, 0, [a])
  const both = powerAt(0, 0, [a, b])
  check('same-throw skips take the max, not the sum', Math.abs(both - single) < 1e-9)

  const c = skipRipple(3, 0, 15, 'throw_2')
  c.radius = 3
  const cross = powerAt(0, 0, [a, c])
  check('different throws superpose with a bonus', cross > single * 2)

  const parent = skipRipple(0, 0, 15, 'throw_3')
  parent.radius = 3
  const born = collideRipples([parent], [{ id: 'rock', x: 3, z: 0, radius: 0.7 }], [])
  check('a rock reflection starts its own wave train', born.length === 1 && born[0].group !== parent.group)
}

// skip ripples scale with impact speed — and big waves are EARNED
{
  const fast = skipRipple(0, 0, 17)
  const mid = skipRipple(0, 0, 11)
  const slow = skipRipple(0, 0, 4)
  check('a hard smack out-ripples a tired hop', fast.peakPower > slow.peakPower && fast.peakRadius > slow.peakRadius)
  check('skip ripples die at their natural radius', Math.abs(fast.maxRadius - fast.peakRadius * 2.33) < 1e-9)
  check('only a crisp early skip makes a full-power wave', fast.peakPower >= 0.95)
  check('a mid-flight hop cannot wake a flower alone', mid.peakPower < 0.65)
  check('a dying hop barely stirs the water', slow.peakPower <= 0.3)
}

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nall wave checks passed')
