// engine-kit / input — a small pointer-gesture layer that feels right on touch
// and mouse alike. Emits normalized drag vectors and taps; the game decides what
// they mean. Pointer capture keeps a drag alive even if the finger leaves the
// canvas (critical on small phone screens).
export class Gestures {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas
    this.h = handlers // { onTap, onDragStart, onDrag, onDragEnd }
    this.active = false
    this.start = { x: 0, y: 0 }
    this.last = { x: 0, y: 0 }
    this.moved = 0
    this._down = (e) => this._onDown(e)
    this._move = (e) => this._onMove(e)
    this._up = (e) => this._onUp(e)
    canvas.addEventListener('pointerdown', this._down)
    canvas.addEventListener('pointermove', this._move)
    canvas.addEventListener('pointerup', this._up)
    canvas.addEventListener('pointercancel', this._up)
    canvas.style.touchAction = 'none'
  }

  _local(e) {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }
  }

  _onDown(e) {
    this.active = true
    this.moved = 0
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      // best-effort
    }
    const p = this._local(e)
    this.start = { x: p.x, y: p.y }
    this.last = { x: p.x, y: p.y }
    this.h.onDragStart?.(this._info(p))
  }

  _onMove(e) {
    if (!this.active) return
    e.preventDefault()
    const p = this._local(e)
    this.moved += Math.hypot(p.x - this.last.x, p.y - this.last.y)
    this.last = { x: p.x, y: p.y }
    this.h.onDrag?.(this._info(p))
  }

  _onUp(e) {
    if (!this.active) return
    this.active = false
    const p = this._local(e)
    const info = this._info(p)
    this.h.onDragEnd?.(info)
    if (this.moved < 8) this.h.onTap?.(info)
  }

  // drag vector: from press point to current, plus a normalized version (by the
  // smaller canvas dimension, so it behaves the same on any screen size)
  _info(p) {
    const dx = p.x - this.start.x
    const dy = p.y - this.start.y
    const norm = Math.min(this.canvas.clientWidth, this.canvas.clientHeight) || 1
    return {
      x: p.x,
      y: p.y,
      startX: this.start.x,
      startY: this.start.y,
      dx,
      dy,
      ndx: dx / norm,
      ndy: dy / norm,
      dist: Math.hypot(dx, dy),
    }
  }

  dispose() {
    const c = this.canvas
    c.removeEventListener('pointerdown', this._down)
    c.removeEventListener('pointermove', this._move)
    c.removeEventListener('pointerup', this._up)
    c.removeEventListener('pointercancel', this._up)
  }
}
