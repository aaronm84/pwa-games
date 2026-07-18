// engine-kit / sfx — a tiny WebAudio synth kit. No sample files: games build
// their sound sets from noise bursts, tones and speed-tracking loops. One
// master gain, autoplay-safe (call unlock() from a user gesture), and it
// stays silent (and cheap) whenever it's disabled or WebAudio is missing.
export function createSynth() {
  let ctx = null
  let master = null
  let noiseBuf = null
  let enabled = true
  let volume = 0.7
  let events = 0 // for headless verification

  function ac() {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const d = noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  }

  // a filtered noise burst (crashes, whooshes, splashes)
  function noise(dur, { freq = 800, q = 1, gain = 0.3, decay = true, type = 'lowpass' } = {}) {
    if (!enabled) return
    events++
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

  // a synth note (stingers, thunks, UI ticks); slide bends the pitch
  function tone(freq, dur, { type = 'triangle', gain = 0.2, at = 0, slide = null } = {}) {
    if (!enabled) return
    events++
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

  // a persistent filtered-noise loop whose level/brightness a game drives
  // every frame (rolling balls, engines, wind)
  function loop({ type = 'lowpass', freq = 120 } = {}) {
    if (!enabled) return null
    events++
    const c = ac()
    if (!c) return null
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const gain = c.createGain()
    gain.gain.value = 0.0001
    src.connect(filter).connect(gain).connect(master)
    src.start()
    let stopped = false
    return {
      set(level, frequency, tc = 0.08) {
        if (stopped) return
        gain.gain.setTargetAtTime(level, c.currentTime, tc)
        if (frequency != null) filter.frequency.setTargetAtTime(frequency, c.currentTime, tc)
      },
      stop(fade = 0.06) {
        if (stopped) return
        stopped = true
        gain.gain.setTargetAtTime(0.0001, c.currentTime, fade)
        setTimeout(() => { try { src.stop() } catch { /* already stopped */ } }, 400)
      },
    }
  }

  return {
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
    get enabled() { return enabled },
    get events() { return events },
    noise,
    tone,
    loop,
  }
}
