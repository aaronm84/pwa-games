// Ripples wave model — the pure physics-of-the-pond, no Babylon, no DOM.
//
// This is the 2D game's tuned wave math carried into world units (the original
// was tuned in screen pixels at ~40 px per world unit): expanding wavefronts
// with a five-zone power curve, one-shot reflection off stones, absorption by
// lily pads, constructive interference, and slow power accumulation in each
// lotus. The page turns taps into ripples; pond3d turns ripples into water.
// Everything here is plain data so it unit-tests headless (waves.test.mjs).

// Hold the tap longer for a slower, stronger ripple that carries further.
// Speeds are units/second; radii are world units.
export const TAP_CONFIGS = {
  light: { speed: 3.0, maxRadius: 6.25, peakRadius: 3.1, peakPower: 0.9, amp: 0.05 },
  medium: { speed: 2.25, maxRadius: 8.75, peakRadius: 3.75, peakPower: 1.0, amp: 0.08 },
  strong: { speed: 1.8, maxRadius: 11.25, peakRadius: 5.0, peakPower: 1.2, amp: 0.12 },
}

export function strengthFor(holdMs) {
  if (holdMs < 150) return 'light'
  if (holdMs > 400) return 'strong'
  return 'medium'
}

// A ripple born from a skipping stone: the harder the stone smacks the water,
// the stronger and further-reaching the wave. Speed is the stone's impact
// speed in units/second (a crisp first skip lands around 10-16; the last
// tired hops around 3-5).
export function skipRipple(x, z, speed) {
  // stretched so big waves are earned: a crisp early skip (speed ~17+) makes
  // a full-power ripple, a mid-flight hop (~11) makes a wave that needs
  // interference or accumulation to wake a flower, a dying hop barely stirs
  const p = Math.min(1.0, Math.max(0.28, (speed - 3) / 14))
  const r = createRipple(x, z, 'medium')
  r.peakPower = p
  r.peakRadius = 2.4 + p * 1.8
  r.maxRadius = r.peakRadius * 2.33
  r.speed = (1.9 + p * 0.9) * (0.95 + Math.random() * 0.1)
  r.amp = 0.04 + p * 0.055
  return r
}

let rippleSeq = 0

export function createRipple(x, z, strength = 'medium', rand = Math.random) {
  const c = TAP_CONFIGS[strength]
  return {
    id: `r${rippleSeq++}`,
    x,
    z,
    radius: 0,
    speed: c.speed * (0.9 + rand() * 0.2),
    maxRadius: c.maxRadius,
    peakRadius: c.peakRadius,
    peakPower: c.peakPower,
    amp: c.amp, // water-surface displacement amplitude
    strength,
    reflectedFrom: [],
    absorbedBy: [],
  }
}

// The five-zone power curve: a wavefront is born weak, peaks partway through
// its journey, then fades and dies — so distance to the flower matters.
export function ripplePower(radius, peakRadius, peakPower) {
  const r = radius
  const birth = peakRadius * 0.33
  const rise = peakRadius * 0.67
  const peak = peakRadius * 1.33
  const fade = peakRadius * 2.0
  const death = peakRadius * 2.33

  if (r < birth) return (r / birth) * (peakPower * 0.4)
  if (r < rise) return peakPower * 0.4 + ((r - birth) / (rise - birth)) * (peakPower * 0.4)
  if (r < peak) return peakPower - (Math.abs(r - peakRadius) / (peak - peakRadius)) * (peakPower * 0.2)
  if (r < fade) return peakPower * 0.8 - ((r - peak) / (fade - peak)) * (peakPower * 0.4)
  if (r < death) return peakPower * 0.4 - ((r - fade) / (death - fade)) * (peakPower * 0.3)
  return 0
}

// Advance wavefronts; returns the surviving ripples (expired ones drop out).
export function stepRipples(ripples, dt) {
  const out = []
  for (const r of ripples) {
    r.radius += r.speed * dt
    if (r.radius < r.maxRadius) out.push(r)
  }
  return out
}

// Stones reflect (a new, weaker wavefront born at the impact point, once per
// stone); lily pads absorb (halve the wavefront's power, once per pad).
// Mutates ripples in place and returns any newborn reflections.
export function collideRipples(ripples, stones, pads) {
  const born = []
  for (const ripple of ripples) {
    for (const s of stones) {
      const d = Math.hypot(s.x - ripple.x, s.z - ripple.z)
      if (Math.abs(d - ripple.radius) <= s.radius && !ripple.reflectedFrom.includes(s.id)) {
        ripple.reflectedFrom.push(s.id)
        // the reflection is born on the face the wave actually hit
        const ang = Math.atan2(s.z - ripple.z, s.x - ripple.x)
        const child = createRipple(
          s.x - Math.cos(ang) * s.radius,
          s.z - Math.sin(ang) * s.radius,
          ripple.strength,
        )
        child.speed = ripple.speed
        child.maxRadius = Math.max(0.5, ripple.maxRadius - ripple.radius)
        child.peakRadius = ripple.peakRadius
        child.peakPower = ripple.peakPower * 0.7
        child.amp = ripple.amp * 0.7
        child.reflectedFrom = [s.id]
        born.push(child)
      }
    }
    for (const p of pads) {
      const d = Math.hypot(p.x - ripple.x, p.z - ripple.z)
      if (Math.abs(d - ripple.radius) <= p.radius && !ripple.absorbedBy.includes(p.id)) {
        ripple.absorbedBy.push(p.id)
        ripple.peakPower *= 0.5
        ripple.amp *= 0.6
      }
    }
  }
  return born
}

// Power delivered to a point right now: every wavefront whose ring is passing
// over it, with a constructive-interference bonus when several arrive at once.
export function powerAt(x, z, ripples, tolerance = 0.4) {
  let power = 0
  let touching = 0
  for (const r of ripples) {
    const d = Math.hypot(x - r.x, z - r.z)
    if (Math.abs(d - r.radius) <= tolerance) {
      power += ripplePower(r.radius, r.peakRadius, r.peakPower)
      touching++
    }
  }
  if (touching > 1) power *= 1 + Math.min(0.3, (touching - 1) * 0.15)
  return power
}

// Per-frame lotus update: instant power can trip the threshold, and weak
// repeated waves accumulate (with slow decay) so persistence also wins.
// Returns true if this call activated the lotus.
export function updateLotus(lotus, ripples, dt) {
  if (lotus.isActivated) return false
  const k = dt * 60
  const power = powerAt(lotus.x, lotus.z, ripples)

  if (power > 0) {
    lotus.accumulatedPower = Math.min(1.5, (lotus.accumulatedPower || 0) + power * 0.02 * k)
  } else {
    lotus.accumulatedPower = (lotus.accumulatedPower || 0) * Math.pow(0.995, k)
  }

  // visual charge level (smooth decay), for the glow
  if (power > (lotus.currentPower || 0)) {
    lotus.currentPower = Math.min(power, 1.5)
  } else {
    lotus.currentPower = (lotus.currentPower || 0) * Math.pow(0.85, k)
    if (lotus.currentPower < 0.01) lotus.currentPower = 0
  }

  if (power >= lotus.threshold || lotus.accumulatedPower >= lotus.threshold * 0.8) {
    lotus.isActivated = true
    lotus.sinkProgress = 0
    return true
  }
  return false
}

// Water-surface height at a point: each wavefront is a damped ring packet (a
// couple of trailing crests behind the front), plus the pond's ambient swell.
export function surfaceHeight(x, z, ripples, t) {
  // the pond's ambient life: two crossing swells plus a slow breeze patch
  // that wanders, so the surface never sits still even between throws
  let y =
    Math.sin(x * 0.7 + t * 0.8) * 0.012 +
    Math.cos(z * 0.55 + t * 0.6) * 0.012 +
    Math.sin(x * 0.22 + z * 0.31 + t * 0.35) * 0.02 +
    Math.sin((x + Math.sin(t * 0.1) * 6) * 0.5 - t * 1.3) * Math.cos(z * 0.4 + t * 0.2) * 0.008
  for (const r of ripples) {
    const d = Math.hypot(x - r.x, z - r.z)
    const s = d - r.radius // behind the front is negative
    if (s > 1.2 || s < -3.4) continue
    const power = ripplePower(r.radius, r.peakRadius, r.peakPower)
    const envelope = Math.exp(-s * s * 0.9) + 0.45 * Math.exp(-(s + 1.6) * (s + 1.6) * 1.2)
    y += Math.cos(s * 4.2) * envelope * r.amp * (0.35 + power) // crest rides the front

  }
  return y
}
