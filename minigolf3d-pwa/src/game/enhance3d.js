// 3D-only flourishes layered onto specific holes — terrain and hazards the flat
// game can't have. Keyed by `${courseId}:${holeIndex}`. Coordinates are in the
// same 2D 520x760 space as the course data; `r` is a 2D radius, `h` a world-unit
// height.
//
// hills: rounded mounds the ball rolls up and over (a MESH-collider dome).
// ramps: a straight incline (a tilted slab).
// geysers: a vent that erupts on a cycle and tosses a ball caught over it.
// anomalies: a shimmer ring that curves a rolling ball (Area 51 physics).
export const enhancements = {
  // Pinewood — a gentle mound on the opener, a proper hill on "Hillcrest", and a
  // malfunctioning sprinkler on "Sidestep".
  'pinewood:0': { hills: [{ x: 260, y: 400, r: 62, h: 1.35 }] },
  'pinewood:1': { geysers: [{ x: 165, y: 260, r: 24, color: '#9fd8ff' }] },
  'pinewood:9': { hills: [{ x: 250, y: 430, r: 72, h: 1.7 }] },
  'pinewood:11': { hills: [{ x: 200, y: 470, r: 50, h: 1.1 }, { x: 320, y: 300, r: 46, h: 1.0 }] },
  // Cryptid Cove — a mound near the bayou, and swamp-gas vents that belch.
  'cove:0': { hills: [{ x: 175, y: 470, r: 55, h: 1.3 }], geysers: [{ x: 200, y: 260, r: 26, color: '#a8d6a0' }] },
  'cove:7': { geysers: [{ x: 360, y: 300, r: 26, color: '#a8d6a0' }, { x: 300, y: 560, r: 22, color: '#a8d6a0', phase: 0.5 }] },
  // Area 51 — a big desert dune, and gravitational anomalies that bend putts.
  'area51:1': { anomalies: [{ x: 260, y: 250, r: 42, dir: 1 }] },
  'area51:6': { hills: [{ x: 260, y: 400, r: 85, h: 2.0 }] },
  'area51:8': { anomalies: [{ x: 275, y: 245, r: 40, dir: -1 }] },
}

export function enhanceFor(courseId, holeIndex) {
  return enhancements[`${courseId}:${holeIndex}`] || {}
}
