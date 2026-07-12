// 3D-only flourishes layered onto specific holes — terrain the flat game can't
// have. Keyed by `${courseId}:${holeIndex}`. Coordinates are in the same 2D
// 520x760 space as the course data; `r` is a 2D radius, `h` a world-unit height.
//
// hills: rounded mounds the ball rolls up and over (a MESH-collider dome).
// ramps: a straight incline (a tilted slab).
export const enhancements = {
  // Pinewood — a gentle mound on the opener, and a proper hill on "Hillcrest".
  'pinewood:0': { hills: [{ x: 260, y: 400, r: 62, h: 1.35 }] },
  'pinewood:9': { hills: [{ x: 250, y: 430, r: 72, h: 1.7 }] },
  'pinewood:11': { hills: [{ x: 200, y: 470, r: 50, h: 1.1 }, { x: 320, y: 300, r: 46, h: 1.0 }] },
  // Cryptid Cove — a mound to bank around near the bayou.
  'cove:0': { hills: [{ x: 175, y: 470, r: 55, h: 1.3 }] },
  // Area 51 — a big desert dune to crest.
  'area51:6': { hills: [{ x: 260, y: 400, r: 85, h: 2.0 }] },
}

export function enhanceFor(courseId, holeIndex) {
  return enhancements[`${courseId}:${holeIndex}`] || {}
}
