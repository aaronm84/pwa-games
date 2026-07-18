// engine-kit / 2D entry — the Babylon-free surface of the kit.
//
// Canvas-2D games import from '@aaronm84/engine-kit/2d' and get the stage,
// gestures, synth and haptics without touching stage.js/babylon.js, so they
// never need the @babylonjs/* peer dependencies installed at all.
export { Stage2D } from './stage2d.js'
export { Gestures } from './input.js'
export { createSynth } from './sfx.js'
export { createHaptics } from './haptics.js'
