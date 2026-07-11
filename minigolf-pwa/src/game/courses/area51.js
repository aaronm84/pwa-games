// Course 3 — Area 51 Links. A dusty desert course out past the fence line, where
// the sand is everywhere and the ball has a nasty habit of getting abducted.
import { softRect, smooth, blob, bush, pond, bunker } from '../courseKit.js'

export default {
  id: 'area51',
  name: 'Area 51 Links',
  tagline: 'Dusty, classified, and probably being watched from above.',
  theme: {
    grass: '#9aad57',
    grassDark: '#8a9d49',
    rough: '#3a3320',
    border: '#6b6135',
    lip: '#cdd98a',
    water: 'rgba(50,160,190,0.8)',
    sand: '#e2d09a',
    prop: 'cactus',
    sky: 'linear-gradient(160deg,#5a4b33 0%,#241a10 100%)',
  },
  events: ['alien', 'bird'],
  holes: [
    { name: 'Dry Run', par: 2, tee: { x: 260, y: 650 }, cup: { x: 260, y: 150 }, fairway: softRect(150, 90, 370, 700), zones: [bunker(260, 380, 44, { seed: 41 })] },
    { name: 'Crater', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [bunker(260, 380, 92, { seed: 42 })] },
    { name: 'The Dish', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), windmills: [{ x: 260, y: 350, len: 98, speed: 0.026, hub: 16 }] },
    { name: 'Oasis', par: 3, tee: { x: 200, y: 660 }, cup: { x: 320, y: 160 }, fairway: softRect(90, 90, 430, 710), zones: [pond(255, 380, 50, { seed: 43 }), bunker(360, 300, 40, { seed: 44 })] },
    { name: 'Warp Pads', par: 3, tee: { x: 250, y: 660 }, cup: { x: 320, y: 150 }, fairway: softRect(90, 90, 430, 710), walls: [smooth([{ x: 90, y: 400 }, { x: 355, y: 405 }, { x: 355, y: 435 }, { x: 90, y: 430 }], 4)], portals: [{ a: { x: 160, y: 560 }, b: { x: 360, y: 250 }, r: 22 }] },
    { name: 'Little Green', par: 4, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150, move: { axis: 'x', min: 150, max: 370, speed: 1.3 } }, fairway: softRect(90, 90, 430, 710), zones: [bunker(260, 470, 46, { seed: 45 })] },
    { name: 'Dune Sea', par: 4, tee: { x: 260, y: 690 }, cup: { x: 260, y: 130 }, fairway: softRect(90, 90, 430, 720), zones: [bunker(170, 520, 50, { seed: 46 }), bunker(350, 380, 54, { seed: 47 }), bunker(210, 250, 44, { seed: 48 })] },
    { name: 'Tractor Beam', par: 3, tee: { x: 260, y: 690 }, cup: { x: 260, y: 130 }, fairway: softRect(90, 90, 430, 720), zones: [{ type: 'boost', poly: blob(260, 520, 50, { seed: 49 }), dir: { x: 0, y: -1 } }, { type: 'boost', poly: blob(260, 300, 50, { seed: 50 }), dir: { x: 0, y: -1 } }] },
    { name: 'Sector 9', par: 4, tee: { x: 260, y: 680 }, cup: { x: 350, y: 140 }, fairway: softRect(90, 90, 430, 720), walls: [bush(200, 360, 40, { seed: 51 })], zones: [bunker(340, 480, 48, { seed: 52 })] },
    { name: 'The Mothership', par: 4, tee: { x: 260, y: 680 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 720), walls: [blob(260, 380, 86, { n: 10, wobble: 0.1, seed: 53 })] },
    { name: 'Sand Slalom', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 140 }, fairway: softRect(100, 90, 420, 710), zones: [bunker(180, 320, 58, { seed: 54, stretch: 1.6 }), bunker(340, 500, 58, { seed: 55, stretch: 1.6 })] },
    {
      name: 'Roswell Curve',
      par: 4,
      tee: { x: 330, y: 650 },
      cup: { x: 165, y: 175 },
      fairway: smooth([{ x: 90, y: 90 }, { x: 430, y: 90 }, { x: 430, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 300 }, { x: 200, y: 260 }, { x: 90, y: 260 }], 6),
      zones: [bunker(370, 430, 44, { seed: 56 })],
    },
    { name: 'Bumper Base', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 710), bumpers: [{ x: 190, y: 330, r: 22 }, { x: 330, y: 330, r: 22 }, { x: 260, y: 470, r: 26 }] },
    { name: 'The Vortex', par: 3, tee: { x: 260, y: 660 }, cup: { x: 200, y: 150, move: { axis: 'x', min: 150, max: 370, speed: 1.4 } }, fairway: softRect(90, 90, 430, 710), portals: [{ a: { x: 350, y: 520 }, b: { x: 170, y: 250 }, r: 22 }] },
    { name: 'Meteor Field', par: 4, tee: { x: 260, y: 690 }, cup: { x: 260, y: 130 }, fairway: softRect(90, 90, 430, 720), walls: [blob(180, 300, 30, { seed: 57 }), blob(340, 420, 30, { seed: 58 }), blob(250, 520, 26, { seed: 59 })] },
    { name: 'Neon Bend', par: 4, tee: { x: 340, y: 650 }, cup: { x: 175, y: 180 }, fairway: smooth([{ x: 100, y: 100 }, { x: 420, y: 100 }, { x: 430, y: 620 }, { x: 300, y: 700 }, { x: 250, y: 520 }, { x: 220, y: 320 }, { x: 110, y: 300 }], 8) },
    { name: 'Hangar 18', par: 4, tee: { x: 260, y: 690 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 720), bumpers: [{ x: 340, y: 470, r: 22 }], zones: [bunker(180, 520, 46, { seed: 60 })], windmills: [{ x: 260, y: 300, len: 76, speed: 0.03, hub: 13 }] },
    { name: 'The Saucer', par: 5, tee: { x: 260, y: 700 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 730), zones: [pond(200, 560, 58, { seed: 61 }), { type: 'boost', poly: blob(360, 470, 44, { seed: 62 }), dir: { x: 0, y: -1 } }], bumpers: [{ x: 190, y: 360, r: 22 }], windmills: [{ x: 300, y: 250, len: 70, speed: 0.032, hub: 13 }] },
  ],
}
