// Authoring toolkit shared by every course file. Wraps the raw geometry helpers
// into hole "parts" (organic fairways, ponds, bunkers, bushes) so course files
// stay readable.
import { rect, smooth, blob, ribbon, polyBounds } from './geometry.js'

export const PLAY_W = 520
export const PLAY_H = 760
export { rect, smooth, blob, ribbon, polyBounds }

// A soft, rounded rectangle fairway (corners eased, edges straight-ish).
export function softRect(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return smooth(
    [
      { x: x1, y: y1 },
      { x: mx, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: my },
      { x: x2, y: y2 },
      { x: mx, y: y2 },
      { x: x1, y: y2 },
      { x: x1, y: my },
    ],
    5,
  )
}

// hazard/obstacle blobs — each returns the right hole part
export const pond = (cx, cy, r, opts = {}) => ({ type: 'water', poly: blob(cx, cy, r, opts) })
export const bunker = (cx, cy, r, opts = {}) => ({ type: 'sand', poly: blob(cx, cy, r, opts) })
export const bush = (cx, cy, r, opts = {}) => blob(cx, cy, r, opts) // an obstacle wall
export const boostZone = (poly, dir) => ({ type: 'boost', poly, dir })
