// engine-kit / Stage
//
// The reusable heart of the shared engine: owns the Babylon engine + scene, the
// render loop, and all the PWA/mobile housekeeping every game needs — WebGPU with
// a WebGL2 fallback, resize, device-pixel-ratio cap, adaptive resolution to hold a
// target frame rate, and pause-when-hidden to save battery.
//
// Games never touch Babylon bootstrap directly; they do:
//   const stage = new Stage(canvas)
//   await stage.init()
//   ...build scene using stage.scene...
//   stage.run(dt => { /* per-frame */ })
import { Engine, WebGPUEngine, Scene, Color4 } from '@babylonjs/core'

export class Stage {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.opts = {
      webgpu: true, // try WebGPU, fall back to WebGL2
      targetFps: 60, // adaptive resolution aims to hold this
      maxDpr: 2, // never render above this device-pixel-ratio (battery/perf)
      clear: [0.05, 0.07, 0.12, 1],
      ...opts,
    }
    this.engine = null
    this.scene = null
    this.backend = 'webgl' // 'webgpu' | 'webgl'
    this._onFrame = null
    this._hardness = 1 // current hardware scaling level
    this._fpsWindow = []
    this._paused = false
    this._disposed = false
    this._boundResize = () => this.resize()
    this._boundVis = () => this._visibilityChanged()
  }

  async init() {
    if (this.opts.webgpu && typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        const e = new WebGPUEngine(this.canvas, { antialias: true, adaptToDeviceRatio: true })
        await e.initAsync()
        this.engine = e
        this.backend = 'webgpu'
      } catch (err) {
        console.warn('[Stage] WebGPU unavailable, using WebGL2:', err?.message || err)
      }
    }
    if (!this.engine) {
      this.engine = new Engine(
        this.canvas,
        true,
        { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true, powerPreference: 'high-performance' },
        true,
      )
      this.backend = 'webgl'
    }

    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(...this.opts.clear)
    this._applyHardness()

    window.addEventListener('resize', this._boundResize)
    document.addEventListener('visibilitychange', this._boundVis)
    return this
  }

  // start the render loop; onFrame(dtSeconds) runs before each render
  run(onFrame) {
    this._onFrame = onFrame
    this.engine.runRenderLoop(() => {
      if (this._paused) return
      const dt = this.engine.getDeltaTime() / 1000
      this._adapt(dt)
      if (this._onFrame) this._onFrame(dt)
      this.scene.render()
    })
  }

  // adaptive resolution: if we're consistently missing the target fps, drop
  // render resolution a notch; if we have comfortable headroom, restore it.
  _adapt(dt) {
    if (dt <= 0) return
    const fps = 1 / dt
    const w = this._fpsWindow
    w.push(fps)
    if (w.length < 90) return
    const avg = w.reduce((a, b) => a + b, 0) / w.length
    w.length = 0
    const target = this.opts.targetFps
    if (avg < target * 0.82 && this._hardness < 2) {
      this._hardness = Math.min(2, this._hardness + 0.25)
      this._applyHardness()
    } else if (avg > target * 0.95 && this._hardness > 1) {
      this._hardness = Math.max(1, this._hardness - 0.25)
      this._applyHardness()
    }
  }

  _applyHardness() {
    // hardwareScalingLevel > 1 renders below native res (cheaper). We also cap the
    // effective DPR so retina phones don't render 3× pixels for no visible gain.
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr)
    const base = (window.devicePixelRatio || 1) / dpr
    this.engine.setHardwareScalingLevel(base * this._hardness)
  }

  resize() {
    this._applyHardness()
    this.engine?.resize()
  }

  _visibilityChanged() {
    this._paused = document.hidden
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    window.removeEventListener('resize', this._boundResize)
    document.removeEventListener('visibilitychange', this._boundVis)
    this.scene?.dispose()
    this.engine?.stopRenderLoop()
    this.engine?.dispose()
  }
}
