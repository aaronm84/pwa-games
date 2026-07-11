// Front Nine — the starting 9-hole course.
//
// The play area is a 520 x 760 canvas. Each hole is defined by:
//   par     — target stroke count
//   tee     — {x, y} where the ball starts
//   cup      — {x, y} centre of the hole
//   fairway — a closed polygon of points; the ball rolls inside it and bounces
//             off its edges (the raised border wall)
//   walls   — extra obstacle polygons inside the fairway; the ball bounces off
//             their edges too
//
// Coordinates are hand-placed so every hole has a clear (if winding) route from
// tee to cup. Collision is generic circle-vs-segment, so the same code handles
// both the outer border and interior obstacles.

// helper: axis-aligned rectangle polygon (clockwise)
function rect(x1, y1, x2, y2) {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

export const PLAY_W = 520
export const PLAY_H = 760

export const frontNine = [
  // 1 — Warm-up: a straight corridor.
  {
    par: 2,
    tee: { x: 260, y: 650 },
    cup: { x: 260, y: 150 },
    fairway: rect(150, 90, 370, 700),
    walls: [],
  },

  // 2 — A block in the middle; go around either side.
  {
    par: 3,
    tee: { x: 260, y: 650 },
    cup: { x: 260, y: 150 },
    fairway: rect(90, 90, 430, 700),
    walls: [rect(205, 330, 315, 410)],
  },

  // 3 — Dogleg left: tee off in the right leg, bank left along the top to the cup.
  {
    par: 3,
    tee: { x: 330, y: 640 },
    cup: { x: 155, y: 175 },
    fairway: [
      { x: 90, y: 90 },
      { x: 430, y: 90 },
      { x: 430, y: 700 },
      { x: 220, y: 700 },
      { x: 220, y: 260 },
      { x: 90, y: 260 },
    ],
    walls: [],
  },

  // 4 — Slalom: two bars jutting from opposite walls.
  {
    par: 3,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 140 },
    fairway: rect(100, 90, 420, 710),
    walls: [rect(100, 300, 310, 340), rect(210, 470, 420, 510)],
  },

  // 5 — A diamond island dead centre.
  {
    par: 3,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 140 },
    fairway: rect(90, 90, 430, 710),
    walls: [
      [
        { x: 260, y: 335 },
        { x: 320, y: 400 },
        { x: 260, y: 465 },
        { x: 200, y: 400 },
      ],
    ],
  },

  // 6 — Dogleg right (mirror of 3): tee off in the left leg, bank right to the cup.
  {
    par: 3,
    tee: { x: 190, y: 640 },
    cup: { x: 375, y: 175 },
    fairway: [
      { x: 90, y: 90 },
      { x: 430, y: 90 },
      { x: 430, y: 260 },
      { x: 300, y: 260 },
      { x: 300, y: 700 },
      { x: 90, y: 700 },
    ],
    walls: [],
  },

  // 7 — S-curve: bars from the right, then the left.
  {
    par: 4,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 130 },
    fairway: rect(90, 90, 430, 710),
    walls: [rect(250, 250, 430, 290), rect(90, 440, 270, 480)],
  },

  // 8 — Funnel: a wide apron narrowing through a neck to the top chamber.
  {
    par: 3,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 160 },
    fairway: [
      { x: 90, y: 710 },
      { x: 90, y: 380 },
      { x: 220, y: 380 },
      { x: 220, y: 250 },
      { x: 200, y: 250 },
      { x: 200, y: 110 },
      { x: 320, y: 110 },
      { x: 320, y: 250 },
      { x: 300, y: 250 },
      { x: 300, y: 380 },
      { x: 430, y: 380 },
      { x: 430, y: 710 },
    ],
    walls: [],
  },

  // 9 — The finisher: a central island plus a nub guarding the cup.
  {
    par: 4,
    tee: { x: 260, y: 670 },
    cup: { x: 360, y: 150 },
    fairway: rect(90, 90, 430, 720),
    walls: [rect(185, 300, 335, 430), rect(90, 200, 250, 235)],
  },
]

export const coursePar = frontNine.reduce((sum, h) => sum + h.par, 0)
