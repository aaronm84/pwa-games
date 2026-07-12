// Course 2 — Cryptid Cove. A murky swamp where alligators lurk in every pond and
// something big and hairy keeps wandering across the tree line. Water-heavy.
import { softRect, smooth, blob, bush, pond, bunker } from '../courseKit.js'

export default {
  id: 'cove',
  name: 'Cryptid Cove',
  tagline: 'Swampy, weird, and definitely watched. Stay out of the water.',
  theme: {
    grass: '#5c8f3e',
    grassDark: '#4d7d34',
    rough: '#243219',
    border: '#3c5326',
    lip: '#8fb56a',
    water: 'rgba(34,92,86,0.82)',
    sand: '#b09a63',
    prop: 'reed',
    sky: 'linear-gradient(160deg,#33422a 0%,#141d12 100%)',
  },
  events: ['gator', 'bigfoot', 'bird'],
  holes: [
    { name: 'Bayou Bogey', par: 3, tee: { x: 180, y: 660 }, cup: { x: 180, y: 160 }, fairway: softRect(90, 90, 430, 710), zones: [pond(320, 360, 66, { seed: 11 })] },
    { name: 'Gator Gap', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [pond(260, 400, 72, { seed: 12 })] },
    { name: 'The Sinkhole', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [bunker(260, 380, 82, { seed: 13 })] },
    {
      name: 'Reedy Bend',
      par: 4,
      tee: { x: 330, y: 650 },
      cup: { x: 160, y: 175 },
      fairway: smooth([{ x: 90, y: 90 }, { x: 430, y: 90 }, { x: 430, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 300 }, { x: 200, y: 260 }, { x: 90, y: 260 }], 6),
      zones: [pond(370, 440, 46, { seed: 14 })],
    },
    { name: 'Twin Ponds', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), zones: [pond(175, 420, 52, { seed: 15 }), pond(350, 300, 52, { seed: 16 })] },
    { name: 'Croc Rock', par: 4, tee: { x: 260, y: 670 }, cup: { x: 350, y: 150 }, fairway: softRect(90, 90, 430, 720), walls: [blob(210, 360, 58, { seed: 17 })], zones: [pond(340, 470, 50, { seed: 18 })] },
    { name: 'Mud Trap', par: 3, tee: { x: 200, y: 660 }, cup: { x: 320, y: 160 }, fairway: softRect(90, 90, 430, 710), zones: [bunker(210, 340, 60, { seed: 19 }), pond(360, 450, 40, { seed: 20 })] },
    { name: 'The Lagoon', par: 4, tee: { x: 350, y: 670 }, cup: { x: 330, y: 150 }, fairway: softRect(90, 90, 430, 720), zones: [pond(200, 400, 92, { seed: 21 })] },
    { name: 'Swamp Nine', par: 4, tee: { x: 260, y: 680 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 720), walls: [bush(340, 520, 34, { seed: 22 })], zones: [bunker(180, 470, 48, { seed: 23 }), pond(300, 300, 52, { seed: 24 })] },
    { name: 'Boardwalk', par: 3, tee: { x: 260, y: 690 }, cup: { x: 260, y: 130 }, fairway: smooth([{ x: 170, y: 720 }, { x: 350, y: 720 }, { x: 330, y: 430 }, { x: 350, y: 250 }, { x: 300, y: 110 }, { x: 220, y: 110 }, { x: 170, y: 250 }, { x: 190, y: 430 }], 8) },
    { name: 'Gator Alley', par: 4, tee: { x: 260, y: 690 }, cup: { x: 260, y: 130 }, fairway: softRect(90, 90, 430, 720), zones: [pond(140, 400, 44, { seed: 25, squash: 1.8 }), pond(390, 300, 44, { seed: 26, squash: 1.8 })] },
    { name: 'Cryptid Crossing', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 150 }, fairway: softRect(90, 90, 430, 710), windmills: [{ x: 260, y: 350, len: 96, speed: 0.024, hub: 15 }] },
    { name: 'The Bog', par: 4, tee: { x: 260, y: 680 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 720), zones: [bunker(180, 320, 46, { seed: 27 }), bunker(340, 470, 46, { seed: 28 }), pond(260, 560, 40, { seed: 29 })] },
    { name: "Will-o'-Portals", par: 3, tee: { x: 250, y: 660 }, cup: { x: 320, y: 150 }, fairway: softRect(90, 90, 430, 710), walls: [smooth([{ x: 90, y: 400 }, { x: 355, y: 405 }, { x: 355, y: 435 }, { x: 90, y: 430 }], 4)], portals: [{ a: { x: 160, y: 560 }, b: { x: 360, y: 250 }, r: 22 }] },
    { name: 'Moving Marsh', par: 3, tee: { x: 260, y: 660 }, cup: { x: 260, y: 150, move: { axis: 'x', min: 150, max: 370, speed: 1.2 } }, fairway: softRect(90, 90, 430, 710), zones: [pond(260, 470, 44, { seed: 30 })] },
    { name: 'Bumper Bayou', par: 3, tee: { x: 260, y: 670 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 710), bumpers: [{ x: 190, y: 320, r: 22 }, { x: 330, y: 320, r: 22 }, { x: 260, y: 450, r: 26 }] },
    { name: 'The Gauntlet II', par: 4, tee: { x: 260, y: 690 }, cup: { x: 260, y: 140, move: { axis: 'x', min: 180, max: 360, speed: 1.1 } }, fairway: softRect(90, 90, 430, 720), bumpers: [{ x: 320, y: 440, r: 22 }], zones: [bunker(180, 520, 44, { seed: 31 }), pond(320, 300, 42, { seed: 32 })] },
    { name: 'Bigfoot Bridge', par: 5, tee: { x: 260, y: 700 }, cup: { x: 260, y: 140 }, fairway: softRect(90, 90, 430, 730), zones: [pond(200, 560, 66, { seed: 33 }), { type: 'boost', poly: blob(360, 470, 46, { seed: 34 }), dir: { x: 0, y: -1 } }], bumpers: [{ x: 190, y: 360, r: 22 }], windmills: [{ x: 300, y: 250, len: 70, speed: 0.03, hub: 13 }] },
  ],
}
