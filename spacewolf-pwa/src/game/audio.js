/**
 * Synthesised arcade audio via the Web Audio API.
 *
 * All sounds are built from oscillators + filtered noise + envelopes —
 * no audio files, no network fetch, no bundle weight. Suits the SNES /
 * Star Fox aesthetic and dodges the asset-licensing question entirely.
 *
 * Lifecycle:
 *   - The AudioContext is created lazily on first use.
 *   - iOS requires a user gesture before audio can play; `unlock()` is
 *     called from the Launch button tap, which both resumes the context
 *     and flips a flag so subsequent play() calls aren't muted.
 *   - Settings page wires soundEffectsEnabled / soundEffectsVolume to
 *     setEnabled() / setVolume() so the master gain reflects user
 *     preferences immediately.
 *
 * Public API:
 *   unlock()                     — call from a user-gesture handler.
 *   play(name)                   — fire a one-shot sound. Ignored when
 *                                  disabled or context never unlocked.
 *   setEnabled(boolean)          — gate everything; setting false stops
 *                                  new sounds but doesn't dispose context.
 *   setVolume(0..1)              — adjusts master gain.
 */

let ctx = null
let masterGain = null
let unlocked = false
let enabled = true
let volume = 0.7
let noiseBuffer = null
const lastPlayed = Object.create(null)

// Per-sound min interval between triggers (ms) to avoid muddying the mix
// when many collisions land in the same frame.
const MIN_INTERVAL = {
  spark: 35,
  explosion: 70,
  laserEnemy: 70,
  damage: 250,
  roll: 250,
  turbo: 400,
}

function makeNoiseBuffer(audioCtx, durationSec) {
  const sampleRate = audioCtx.sampleRate
  const buffer = audioCtx.createBuffer(1, sampleRate * durationSec, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function ensureContext() {
  if (ctx) return ctx
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  masterGain = ctx.createGain()
  masterGain.gain.value = volume
  masterGain.connect(ctx.destination)
  // Pre-build a 1-second noise buffer; we reuse it for every noise-based
  // sound (shorter durations slice from the start, longer ones loop —
  // for our short FX 1s is plenty).
  noiseBuffer = makeNoiseBuffer(ctx, 1)
  return ctx
}

export function unlock() {
  const c = ensureContext()
  if (!c) return Promise.resolve()
  unlocked = true
  if (c.state === 'suspended') {
    return c.resume()
  }
  return Promise.resolve()
}

export function setEnabled(v) {
  enabled = !!v
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  if (masterGain) masterGain.gain.value = volume
}

// === Sound builders ===
// Each takes the AudioContext, the destination gain node, and `now` (the
// scheduling start time in seconds), and schedules its own envelope.

function fireLaserPlayer(c, dest, now) {
  // Quick descending pew — saw down from ~1300 to ~400 Hz over 80ms.
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(1300, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
  g.gain.setValueAtTime(0.0, now)
  g.gain.linearRampToValueAtTime(0.22, now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
  osc.connect(g).connect(dest)
  osc.start(now)
  osc.stop(now + 0.1)
}

function fireLaserEnemy(c, dest, now) {
  // Lower, slightly meaner — square wave from ~700 to ~250 Hz.
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(700, now)
  osc.frequency.exponentialRampToValueAtTime(250, now + 0.1)
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.18, now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
  osc.connect(g).connect(dest)
  osc.start(now)
  osc.stop(now + 0.12)
}

function spark(c, dest, now) {
  // Tiny high tick — square chirp from 2400 down to 800 Hz over 40ms.
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(2400, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.04)
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.1, now + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  osc.connect(g).connect(dest)
  osc.start(now)
  osc.stop(now + 0.06)
}

function explosion(c, dest, now) {
  // White noise burst + low-pass filter sweep + sub-bass thump.
  const noise = c.createBufferSource()
  noise.buffer = noiseBuffer
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2400, now)
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.45)
  filter.Q.value = 1.6
  const ng = c.createGain()
  ng.gain.setValueAtTime(0, now)
  ng.gain.linearRampToValueAtTime(0.45, now + 0.01)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  noise.connect(filter).connect(ng).connect(dest)
  noise.start(now)
  noise.stop(now + 0.55)

  // Sub-bass sine drop for body.
  const sub = c.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(140, now)
  sub.frequency.exponentialRampToValueAtTime(45, now + 0.3)
  const subG = c.createGain()
  subG.gain.setValueAtTime(0, now)
  subG.gain.linearRampToValueAtTime(0.4, now + 0.01)
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  sub.connect(subG).connect(dest)
  sub.start(now)
  sub.stop(now + 0.4)
}

function damage(c, dest, now) {
  // Heavy thump — a louder, lower variant of explosion with a faster
  // attack so the player feels the hit even before they see the flicker.
  const sub = c.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(180, now)
  sub.frequency.exponentialRampToValueAtTime(50, now + 0.2)
  const subG = c.createGain()
  subG.gain.setValueAtTime(0, now)
  subG.gain.linearRampToValueAtTime(0.55, now + 0.005)
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  sub.connect(subG).connect(dest)
  sub.start(now)
  sub.stop(now + 0.3)

  const noise = c.createBufferSource()
  noise.buffer = noiseBuffer
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 700
  filter.Q.value = 1.2
  const ng = c.createGain()
  ng.gain.setValueAtTime(0, now)
  ng.gain.linearRampToValueAtTime(0.35, now + 0.005)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  noise.connect(filter).connect(ng).connect(dest)
  noise.start(now)
  noise.stop(now + 0.25)
}

function roll(c, dest, now) {
  // Whoosh — band-passed noise sweep, ~350ms.
  const noise = c.createBufferSource()
  noise.buffer = noiseBuffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(700, now)
  filter.frequency.exponentialRampToValueAtTime(2200, now + 0.3)
  filter.Q.value = 3
  const g = c.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.22, now + 0.05)
  g.gain.linearRampToValueAtTime(0.18, now + 0.2)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  noise.connect(filter).connect(g).connect(dest)
  noise.start(now)
  noise.stop(now + 0.45)
}

function turbo(c, dest, now) {
  // Rising saw — classic boost noise.
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.45)
  const g = c.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.22, now + 0.04)
  g.gain.linearRampToValueAtTime(0.18, now + 0.32)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
  osc.connect(g).connect(dest)
  osc.start(now)
  osc.stop(now + 0.6)
}

function launchChord(c, dest, now) {
  // Bright two-note ascending chord — confirms audio is alive.
  const freqs = [440, 660] // A4, E5
  for (let i = 0; i < freqs.length; i++) {
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freqs[i], now + i * 0.05)
    const g = c.createGain()
    g.gain.setValueAtTime(0, now + i * 0.05)
    g.gain.linearRampToValueAtTime(0.18, now + i * 0.05 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.4)
    osc.connect(g).connect(dest)
    osc.start(now + i * 0.05)
    osc.stop(now + i * 0.05 + 0.45)
  }
}

function gameOverChord(c, dest, now) {
  // Three-note descending minor chord — A4, F4, D4.
  const freqs = [440, 349.23, 293.66]
  for (let i = 0; i < freqs.length; i++) {
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freqs[i], now + i * 0.15)
    osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.92, now + i * 0.15 + 0.55)
    const g = c.createGain()
    g.gain.setValueAtTime(0, now + i * 0.15)
    g.gain.linearRampToValueAtTime(0.22, now + i * 0.15 + 0.04)
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6)
    osc.connect(g).connect(dest)
    osc.start(now + i * 0.15)
    osc.stop(now + i * 0.15 + 0.65)
  }
}

const builders = {
  laserPlayer: fireLaserPlayer,
  laserEnemy: fireLaserEnemy,
  spark,
  explosion,
  damage,
  roll,
  turbo,
  launch: launchChord,
  gameOver: gameOverChord,
}

export function play(name) {
  if (!enabled || !unlocked) return
  const c = ensureContext()
  if (!c || c.state !== 'running') return
  const build = builders[name]
  if (!build) return

  const interval = MIN_INTERVAL[name]
  if (interval) {
    const now = performance.now()
    const last = lastPlayed[name]
    if (last && now - last < interval) return
    lastPlayed[name] = now
  }

  try {
    build(c, masterGain, c.currentTime)
  } catch (err) {
    // Audio failures should never break gameplay — silently swallow.
    console.warn('[audio] play failed for', name, err)
  }
}
