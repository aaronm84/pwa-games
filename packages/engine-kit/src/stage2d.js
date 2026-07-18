// engine-kit / Stage2D
//
// The Canvas-2D sibling of Stage, for games whose look is flat by design
// (ponds, boards, card tables) and shouldn't pay for Babylon + Havok. Same
// contract, same PWA/mobile housekeeping: device-pixel-ratio cap, resize
// tracking, pause-when-hidden, and a requestAnimationFrame loop that hands
// the game a clamped dt so per-frame forces don't explode after a tab nap.
//
// Games never touch canvas bootstrap directly; they do:
//   const stage = new Stage2D(canvas)
//   await stage.init()
//   ...draw using stage.ctx, lay out using stage.width/height (CSS px)...
//   stage.run(dt => { /* per-frame update + draw */ })
export class Stage2D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.opts = {
      maxDpr: 2, // never render above this device-pixel-ratio (battery/perf)
      maxDt: 1 / 20, // clamp dt so physics stays stable across frame hitches
      alpha: false, // opaque canvas unless the game composites over the page
      ...opts,
    }
    this.ctx = null
    this.width = 0 // CSS pixels — game coordinates live in this space
    this.height = 0
    this.dpr = 1
    this._onFrame = null
    this._raf = null
    this._last = 0
    this._paused = false
    this._disposed = false
    this._boundResize = () => this.resize()
    this._boundVis = () => this._visibilityChanged()
  }

  // async for parity with Stage, so a game can swap stages without reshaping
  // its bootstrap
  async init() {
    this.ctx = this.canvas.getContext('2d', { alpha: this.opts.alpha })
    this.resize()
    window.addEventListener('resize', this._boundResize)
    document.addEventListener('visibilitychange', this._boundVis)
    return this
  }

  // start the loop; onFrame(dtSeconds) draws each frame
  run(onFrame) {
    this._onFrame = onFrame
    const tick = (now) => {
      if (this._disposed) return
      this._raf = requestAnimationFrame(tick)
      if (this._paused) {
        this._last = now // don't accumulate hidden time into the next dt
        return
      }
      const dt = Math.min((now - (this._last || now)) / 1000, this.opts.maxDt)
      this._last = now
      if (this._onFrame) this._onFrame(dt)
    }
    this._raf = requestAnimationFrame(tick)
  }

  // size the backing store to CSS size × capped DPR; the ctx transform maps
  // game coordinates (CSS px) onto it, so game code never sees the DPR
  resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.width = rect.width || this.canvas.clientWidth || window.innerWidth
    this.height = rect.height || this.canvas.clientHeight || window.innerHeight
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr)
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr))
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  _visibilityChanged() {
    this._paused = document.hidden
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    window.removeEventListener('resize', this._boundResize)
    document.removeEventListener('visibilitychange', this._boundVis)
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
  }
}
