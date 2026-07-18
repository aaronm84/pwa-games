// Alley Nights SFX — a tiny WebAudio synth. No sample files: the ball's roll
// is filtered noise that tracks its speed, pin crashes are noise bursts with
// detuned wooden pings, stingers are little synth arpeggios. Everything runs
// through one master gain and dies silently when sound is off or the context
// can't start (audio unlocks on the first real touch).
let ctx = null
let master = null
let noiseBuf = null
let enabled = true
let volume = 0.7
let events = 0 // for headless verification

let roll = null // { src, gain, filter }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = volume
    master.connect(ctx.destination)
    // shared noise buffer (2s of white noise)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function noise(dur, { freq = 800, q = 1, gain = 0.3, decay = true, type = 'lowpass' } = {}) {
  const c = ac()
  if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, c.currentTime)
  if (decay) g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
  src.connect(f).connect(g).connect(master)
  src.start()
  src.stop(c.currentTime + dur + 0.05)
}

function tone(freq, dur, { type = 'triangle', gain = 0.2, at = 0, slide = null } = {}) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  o.type = type
  const t0 = c.currentTime + at
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

export const sfx = {
  // read the settings at boot (and again whenever a throw starts — cheap)
  configure({ on = true, vol = 0.7 } = {}) {
    enabled = on !== false
    volume = vol
    if (master) master.gain.value = volume
  },
  // must be called from a user gesture at least once (iOS/Chrome autoplay)
  unlock() {
    if (!enabled) return
    try { ac() } catch { /* no audio: stay silent */ }
  },
  get events() { return events },

  // ---- the ball on the boards: a loop whose pitch/level tracks speed ----
  rollStart() {
    if (!enabled) return
    events++
    const c = ac()
    if (!c || roll) return
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 120
    const gain = c.createGain()
    gain.gain.value = 0.0001
    src.connect(filter).connect(gain).connect(master)
    src.start()
    roll = { src, gain, filter }
  },
  rollUpdate(speed) {
    if (!roll || !ctx) return
    const k = Math.min(1, speed / 14)
    roll.gain.gain.setTargetAtTime(0.04 + k * 0.16, ctx.currentTime, 0.08)
    roll.filter.frequency.setTargetAtTime(90 + k * 320, ctx.currentTime, 0.1)
  },
  rollStop() {
    if (!roll || !ctx) { roll = null; return }
    events++
    roll.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06)
    const r = roll
    roll = null
    setTimeout(() => { try { r.src.stop() } catch { /* already stopped */ } }, 400)
  },

  // ---- moments ----
  crash(intensity = 1) {
    if (!enabled) return
    events++
    const k = Math.max(0.2, Math.min(1, intensity))
    noise(0.35, { freq: 1400, gain: 0.5 * k, type: 'bandpass', q: 0.7 })
    // wooden pin pings, detuned and staggered
    const n = 2 + Math.round(k * 4)
    for (let i = 0; i < n; i++) {
      tone(300 + Math.random() * 500, 0.09 + Math.random() * 0.07, { type: 'square', gain: 0.05 + k * 0.06, at: Math.random() * 0.16 })
    }
  },
  gutter() {
    if (!enabled) return
    events++
    tone(130, 0.28, { type: 'sine', gain: 0.3, slide: 55 })
  },
  splash() {
    if (!enabled) return
    events++
    noise(0.5, { freq: 900, gain: 0.32, type: 'bandpass', q: 0.4 })
    tone(220, 0.3, { type: 'sine', gain: 0.12, slide: 90 })
  },
  stinger(kind) {
    if (!enabled) return
    events++
    const notes = kind === 'strike' ? [523, 659, 784, 1047] : [523, 659, 784]
    notes.forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.16, at: i * 0.07 }))
    if (kind === 'strike') noise(0.5, { freq: 2600, gain: 0.1, type: 'highpass' })
  },
  sweepDown() {
    if (!enabled) return
    events++
    noise(0.4, { freq: 500, gain: 0.08, type: 'bandpass', q: 2 })
    tone(180, 0.35, { type: 'sawtooth', gain: 0.03, slide: 110 })
  },
  replayWoosh() {
    if (!enabled) return
    events++
    noise(0.5, { freq: 300, gain: 0.14, type: 'bandpass', q: 1.5 })
    tone(340, 0.4, { type: 'sine', gain: 0.06, slide: 680 })
  },
  uiTick() {
    if (!enabled) return
    events++
    tone(660, 0.05, { type: 'square', gain: 0.05 })
  },
}
