// The full 18-hole course.
//
// Play area is a 520 x 760 canvas. A hole is:
//   name      — shown on the intro card and HUD
//   par       — target stroke count
//   tee       — {x, y} start
//   cup       — {x, y} centre, OR {x, y, move:{axis:'x'|'y', min, max, speed}}
//               for a moving cup
//   fairway   — closed polygon; the ball rolls inside and bounces off its edges
//   walls     — extra obstacle polygons (bounce off their edges)
//   zones     — flat terrain regions [{type, poly, dir?}]:
//                 'water' — splash: reset to pre-shot spot, +1 penalty stroke
//                 'sand'  — heavy friction, kills the ball's roll
//                 'boost' — impulse along dir (unit vector) while inside
//   bumpers   — bouncy pegs [{x, y, r}] (extra-elastic)
//   portals   — teleport pairs [{a:{x,y}, b:{x,y}, r}] (bidirectional)
//   windmills — rotating blades [{x, y, len, speed, hub}] guarding the lane
//
// The Front Nine (1–9) is a classic resort course. The Back Nine (10–18) is
// "The Funhouse" — one signature gimmick per hole, building to an everything-
// at-once finale.

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

export const holes = [
  // ─────────────────────────── FRONT NINE ───────────────────────────
  // 1 — Warm-up: a straight corridor.
  {
    name: 'The Opener',
    par: 2,
    tee: { x: 260, y: 650 },
    cup: { x: 260, y: 150 },
    fairway: rect(150, 90, 370, 700),
    walls: [],
  },

  // 2 — A block in the middle; go around either side.
  {
    name: 'Sidestep',
    par: 3,
    tee: { x: 260, y: 650 },
    cup: { x: 260, y: 150 },
    fairway: rect(90, 90, 430, 700),
    walls: [rect(205, 330, 315, 410)],
  },

  // 3 — Dogleg left: tee off in the right leg, bank left along the top to the cup.
  {
    name: 'Left Turn',
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
    name: 'The Slalom',
    par: 3,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 140 },
    fairway: rect(100, 90, 420, 710),
    walls: [rect(100, 300, 310, 340), rect(210, 470, 420, 510)],
  },

  // 5 — A diamond island dead centre.
  {
    name: 'Diamond Isle',
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
    name: 'Right Turn',
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
    name: 'Snake Bend',
    par: 4,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 130 },
    fairway: rect(90, 90, 430, 710),
    walls: [rect(250, 250, 430, 290), rect(90, 440, 270, 480)],
  },

  // 8 — Funnel: a wide apron narrowing through a neck to the top chamber.
  {
    name: 'The Funnel',
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

  // 9 — Central island plus a nub guarding the cup.
  {
    name: 'Islander',
    par: 4,
    tee: { x: 260, y: 670 },
    cup: { x: 360, y: 150 },
    fairway: rect(90, 90, 430, 720),
    walls: [rect(185, 300, 335, 430), rect(90, 200, 250, 235)],
  },

  // ─────────────────────────── BACK NINE: THE FUNHOUSE ───────────────────────────
  // 10 — Sand: a bunker guards the cup.
  {
    name: 'Sand Trap',
    par: 3,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 150 },
    fairway: rect(90, 90, 430, 710),
    walls: [],
    zones: [{ type: 'sand', poly: rect(150, 200, 370, 300) }],
  },

  // 11 — Water carry: a pond blocks the direct line; a dry lane runs up the right.
  {
    name: 'Otto Overboard',
    par: 3,
    tee: { x: 250, y: 660 },
    cup: { x: 200, y: 150 },
    fairway: rect(90, 90, 430, 710),
    walls: [],
    zones: [{ type: 'water', poly: rect(90, 360, 340, 440) }],
  },

  // 12 — Bumper pinball.
  {
    name: 'Bumper Alley',
    par: 3,
    tee: { x: 260, y: 670 },
    cup: { x: 260, y: 140 },
    fairway: rect(90, 90, 430, 710),
    walls: [],
    bumpers: [
      { x: 180, y: 300, r: 22 },
      { x: 340, y: 300, r: 22 },
      { x: 260, y: 430, r: 26 },
      { x: 180, y: 545, r: 22 },
      { x: 340, y: 545, r: 22 },
    ],
  },

  // 13 — The classic: a rotating blade guards the lane. Time your putt.
  {
    name: 'The Windmill',
    par: 3,
    tee: { x: 260, y: 670 },
    cup: { x: 260, y: 150 },
    fairway: rect(90, 90, 430, 710),
    walls: [],
    windmills: [{ x: 260, y: 340, len: 95, speed: 0.028, hub: 15 }],
  },

  // 14 — Boost pads fling the ball up a long fairway.
  {
    name: 'Boost Boulevard',
    par: 3,
    tee: { x: 260, y: 690 },
    cup: { x: 260, y: 130 },
    fairway: rect(90, 90, 430, 720),
    walls: [],
    zones: [
      { type: 'boost', poly: rect(200, 500, 320, 580), dir: { x: 0, y: -1 } },
      { type: 'boost', poly: rect(200, 290, 320, 370), dir: { x: 0, y: -1 } },
    ],
  },

  // 15 — Portals: a wall splits the green; a portal pair is the shortcut.
  {
    name: 'Portal Chaos',
    par: 3,
    tee: { x: 250, y: 660 },
    cup: { x: 320, y: 150 },
    fairway: rect(90, 90, 430, 710),
    walls: [rect(90, 400, 355, 435)],
    portals: [{ a: { x: 160, y: 560 }, b: { x: 360, y: 250 }, r: 22 }],
  },

  // 16 — The cup slides side to side. Time it.
  {
    name: 'Moving Target',
    par: 3,
    tee: { x: 260, y: 660 },
    cup: { x: 260, y: 150, move: { axis: 'x', min: 150, max: 370, speed: 1.3 } },
    fairway: rect(90, 90, 430, 710),
    walls: [],
  },

  // 17 — Gauntlet: sand + bumpers + a moving cup.
  {
    name: 'The Gauntlet',
    par: 4,
    tee: { x: 260, y: 680 },
    cup: { x: 260, y: 140, move: { axis: 'x', min: 180, max: 360, speed: 1.1 } },
    fairway: rect(90, 90, 430, 720),
    walls: [],
    zones: [{ type: 'sand', poly: rect(90, 520, 250, 600) }],
    bumpers: [
      { x: 300, y: 450, r: 22 },
      { x: 200, y: 330, r: 22 },
    ],
  },

  // 18 — The Big Finish: water carry, a boost, a bumper, and a windmill at the cup.
  {
    name: 'The Big Finish',
    par: 5,
    tee: { x: 260, y: 690 },
    cup: { x: 260, y: 140 },
    fairway: rect(90, 90, 430, 720),
    walls: [],
    zones: [
      { type: 'water', poly: rect(90, 560, 320, 620) },
      { type: 'boost', poly: rect(330, 470, 420, 560), dir: { x: 0, y: -1 } },
    ],
    bumpers: [{ x: 200, y: 380, r: 24 }],
    windmills: [{ x: 260, y: 250, len: 82, speed: 0.032, hub: 14 }],
  },
]

export const coursePar = holes.reduce((sum, h) => sum + h.par, 0)
