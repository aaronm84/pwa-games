// Alley Nights SFX — the bowling sound set, built on the engine-kit synth
// (sample-free WebAudio). The synth handles context/unlock/master volume;
// this file is just the house's vocabulary: rolls, crashes, stingers.
import { createSynth } from 'src/engine'

const synth = createSynth()
let roll = null // the ball's speed-tracking rumble loop

export const sfx = {
  configure(opts) { synth.configure(opts) },
  unlock() { synth.unlock() },
  get events() { return synth.events },

  // ---- the ball on the boards ----
  rollStart() {
    if (roll) return
    roll = synth.loop({ type: 'lowpass', freq: 120 })
  },
  rollUpdate(speed) {
    if (!roll) return
    const k = Math.min(1, speed / 14)
    roll.set(0.04 + k * 0.16, 90 + k * 320)
  },
  rollStop() {
    roll?.stop()
    roll = null
  },

  // ---- moments ----
  crash(intensity = 1) {
    const k = Math.max(0.2, Math.min(1, intensity))
    synth.noise(0.35, { freq: 1400, gain: 0.5 * k, type: 'bandpass', q: 0.7 })
    const n = 2 + Math.round(k * 4)
    for (let i = 0; i < n; i++) {
      synth.tone(300 + Math.random() * 500, 0.09 + Math.random() * 0.07, { type: 'square', gain: 0.05 + k * 0.06, at: Math.random() * 0.16 })
    }
  },
  gutter() {
    synth.tone(130, 0.28, { type: 'sine', gain: 0.3, slide: 55 })
  },
  splash() {
    synth.noise(0.5, { freq: 900, gain: 0.32, type: 'bandpass', q: 0.4 })
    synth.tone(220, 0.3, { type: 'sine', gain: 0.12, slide: 90 })
  },
  stinger(kind) {
    const notes = kind === 'strike' ? [523, 659, 784, 1047] : [523, 659, 784]
    notes.forEach((f, i) => synth.tone(f, 0.16, { type: 'triangle', gain: 0.16, at: i * 0.07 }))
    if (kind === 'strike') synth.noise(0.5, { freq: 2600, gain: 0.1, type: 'highpass' })
  },
  sweepDown() {
    synth.noise(0.4, { freq: 500, gain: 0.08, type: 'bandpass', q: 2 })
    synth.tone(180, 0.35, { type: 'sawtooth', gain: 0.03, slide: 110 })
  },
  replayWoosh() {
    synth.noise(0.5, { freq: 300, gain: 0.14, type: 'bandpass', q: 1.5 })
    synth.tone(340, 0.4, { type: 'sine', gain: 0.06, slide: 680 })
  },
  uiTick() {
    synth.tone(660, 0.05, { type: 'square', gain: 0.05 })
  },
  boing() {
    // Bouncy Castle: the ball hits the boards and the boards hit back
    synth.tone(150, 0.24, { type: 'sine', gain: 0.28, slide: 340 })
    synth.noise(0.08, { freq: 900, gain: 0.06, type: 'bandpass', q: 2 })
  },
}
