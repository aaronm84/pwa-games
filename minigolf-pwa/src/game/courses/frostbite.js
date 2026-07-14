// Course 4 — Frostbite Falls. A glacier-carved alpine course: snow-drift bunkers,
// icy melt pools, luge-run boost lanes, snow-blower windmills — and a certain
// large white someone in the tree line. Bundle up.
import { softRect, smooth, blob, bush, pond, bunker } from '../courseKit.js'

// ice slicks: boost pads that fling the ball up-course, like a luge run
const slick = (cx, cy, r, seed) => ({ type: 'boost', poly: blob(cx, cy, r, { seed }), dir: { x: 0, y: -1 } })

export default {
  id: 'frostbite',
  name: 'Frostbite Falls',
  tagline: 'Snow drifts, melt pools and something big and white in the pines.',
  theme: {
    grass: '#9fd4c6',
    grassDark: '#8ac3b4',
    rough: '#e8f1f4',
    border: '#c2d9e0',
    lip: '#ffffff',
    water: 'rgba(96,158,214,0.85)',
    water3d: '#5a9ed6',
    sand: '#eef4f7',
    prop: 'pine',
    cryptid: '#e8ebf0', // the Yeti
    sky: 'linear-gradient(160deg,#a8c8dc 0%,#5c7f9e 100%)',
  },
  events: ['bigfoot', 'bird'],
  splash: ['Cold plunge! +1.', 'Into the melt pool. Brrr. +1.', 'That one’s under the ice now. +1.'],
  holes: [
    { name: 'First Frost', par: 2, tee: { x: 260, y: 650 }, cup: { x: 260, y: 150 }, fairway: softRect(150, 90, 370, 700) },
    { name: 'Snow Drift', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [bunker(260, 380, 80, { seed: 71 })] },
    { name: 'The Icicle', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), walls: [bush(200, 380, 44, { seed: 72 }), bush(330, 260, 40, { seed: 73 })] },
    { name: 'Melt Pool', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [pond(260, 360, 70, { seed: 74 })] },
    { name: 'The Luge', par: 3, tee: { x: 260, y: 690 }, cup: { x: 260, y: 130 }, fairway: softRect(90, 90, 430, 720), zones: [slick(260, 520, 48, 75), slick(260, 300, 48, 76)] },
    {
      name: 'Left at the Lodge',
      par: 3,
      tee: { x: 330, y: 640 },
      cup: { x: 155, y: 175 },
      fairway: smooth(
        [
          { x: 90, y: 90 },
          { x: 260, y: 90 },
          { x: 430, y: 90 },
          { x: 430, y: 400 },
          { x: 430, y: 700 },
          { x: 300, y: 700 },
          { x: 300, y: 480 },
          { x: 260, y: 300 },
          { x: 200, y: 260 },
          { x: 90, y: 260 },
        ],
        6,
      ),
      zones: [bunker(370, 430, 40, { seed: 77 })],
    },
    { name: 'Twin Melt', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [pond(175, 420, 50, { seed: 78 }), pond(350, 300, 50, { seed: 79 })] },
    { name: 'Black Ice', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [slick(260, 400, 58, 80), bunker(180, 230, 36, { seed: 81 })] },
    { name: 'Snowblower', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), windmills: [{ x: 260, y: 350, len: 96, speed: 0.028, hub: 15 }] },
    {
      name: 'Polar Portals',
      par: 3,
      tee: { x: 250, y: 660 },
      cup: { x: 320, y: 150 },
      fairway: softRect(90, 90, 430, 710),
      walls: [smooth([{ x: 90, y: 400 }, { x: 355, y: 405 }, { x: 355, y: 435 }, { x: 90, y: 430 }], 4)],
      portals: [{ a: { x: 160, y: 560 }, b: { x: 360, y: 250 }, r: 22 }],
    },
    { name: 'Crevasse', par: 4, tee: { x: 260, y: 660 }, cup: { x: 260, y: 140 }, fairway: softRect(100, 90, 420, 710), zones: [bunker(180, 320, 58, { seed: 82, stretch: 1.6 }), bunker(340, 500, 58, { seed: 83, stretch: 1.6 })] },
    {
      name: 'Yeti’s Yard',
      par: 3,
      tee: { x: 260, y: 690 },
      cup: { x: 260, y: 130 },
      fairway: smooth([{ x: 170, y: 720 }, { x: 350, y: 720 }, { x: 330, y: 430 }, { x: 350, y: 250 }, { x: 300, y: 110 }, { x: 220, y: 110 }, { x: 170, y: 250 }, { x: 190, y: 430 }], 8),
    },
    { name: 'Windchill', par: 4, tee: { x: 260, y: 690 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 720), windmills: [{ x: 260, y: 300, len: 76, speed: 0.03, hub: 13 }], zones: [pond(200, 560, 52, { seed: 84 })] },
    {
      name: 'Frozen Fork',
      par: 4,
      tee: { x: 330, y: 650 },
      cup: { x: 160, y: 175 },
      fairway: smooth([{ x: 90, y: 90 }, { x: 430, y: 90 }, { x: 430, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 300 }, { x: 200, y: 260 }, { x: 90, y: 260 }], 6),
      zones: [pond(370, 440, 46, { seed: 85 })],
    },
    { name: 'The Igloo', par: 4, tee: { x: 260, y: 680 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 720), walls: [blob(260, 380, 86, { n: 10, wobble: 0.1, seed: 86 })] },
    { name: 'Thin Ice', par: 4, tee: { x: 350, y: 670 }, cup: { x: 330, y: 150 }, fairway: softRect(90, 90, 430, 720), zones: [pond(200, 400, 92, { seed: 87 })] },
    { name: 'Avalanche Alley', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 710), bumpers: [{ x: 190, y: 330, r: 22 }, { x: 330, y: 330, r: 22 }, { x: 260, y: 470, r: 26 }] },
    {
      name: 'Frostbite Finale',
      par: 5,
      tee: { x: 260, y: 700 },
      cup: { x: 260, y: 140, move: { axis: 'x', min: 150, max: 370, speed: 1.2 } },
      fairway: softRect(90, 90, 430, 730),
      zones: [pond(200, 560, 58, { seed: 88 }), slick(360, 470, 44, 89)],
      bumpers: [{ x: 190, y: 360, r: 22 }],
      windmills: [{ x: 300, y: 250, len: 70, speed: 0.032, hub: 13 }],
    },
  ],
}
