// Ripples SFX — the pond's sound set, built on the engine-kit synth
// (sample-free WebAudio). The synth handles context/unlock/master volume;
// this file is just the pond's vocabulary: plops, chimes, hushes.
import { createSynth } from 'src/engine'

const synth = createSynth()

export const sfx = {
  configure(opts) { synth.configure(opts) },
  unlock() { synth.unlock() },
  get events() { return synth.events },

  // a water plop: filtered noise splash under a sinking tone — deeper and
  // longer the harder the tap
  splash(strength = 'medium') {
    const cfg = {
      light: { dur: 0.22, freq: 1300, gain: 0.18, tone: 620 },
      medium: { dur: 0.32, freq: 900, gain: 0.24, tone: 460 },
      strong: { dur: 0.45, freq: 650, gain: 0.3, tone: 330 },
    }[strength]
    synth.noise(cfg.dur, { freq: cfg.freq, q: 0.7, gain: cfg.gain })
    synth.tone(cfg.tone, cfg.dur * 0.8, { type: 'sine', gain: 0.12, slide: cfg.tone * 0.35 })
  },

  // a wavefront kissing a stone
  stoneTick() {
    synth.tone(880, 0.07, { type: 'triangle', gain: 0.05, slide: 660 })
  },

  // a soft two-note chime when a lotus wakes
  lotusChime() {
    synth.tone(523.25, 0.35, { type: 'sine', gain: 0.1 }) // C5
    synth.tone(783.99, 0.5, { type: 'sine', gain: 0.08, at: 0.09 }) // G5
  },

  // the lotus slipping under
  sink() {
    synth.noise(0.6, { freq: 500, gain: 0.1, q: 0.5 })
    synth.tone(300, 0.5, { type: 'sine', gain: 0.07, slide: 120 })
  },

  // pentatonic rise for a cleared pond
  win(stars = 3) {
    const notes = [523, 587, 659, 784, 880].slice(0, 2 + stars)
    notes.forEach((f, i) => synth.tone(f, 0.22, { type: 'sine', gain: 0.11, at: i * 0.1 }))
  },

  // a gentle 'not this time' — no harsh buzzer in a zen pond
  lose() {
    synth.tone(392, 0.3, { type: 'sine', gain: 0.09 })
    synth.tone(311, 0.45, { type: 'sine', gain: 0.08, at: 0.16 })
  },

  // tapping inside a flower's protected circle
  deny() {
    synth.tone(220, 0.12, { type: 'triangle', gain: 0.07, slide: 180 })
  },
}
