// The ball rack. Each ball changes the physics feel: mass (pin scatter),
// power (launch speed), hook (how hard side-spin bends it down-lane).
export const balls = [
  {
    id: 'house',
    name: 'The House Ball',
    emoji: '🎳',
    blurb: 'Reliable rental royalty. Faint smell of nacho cheese.',
    color: '#2a5db0',
    glow: null,
    mods: { mass: 6, power: 1, hook: 1 },
  },
  {
    id: 'boulder',
    name: 'The Boulder',
    emoji: '🪨',
    blurb: 'Absurdly heavy. Pins fear it. Backs fear it more.',
    color: '#5a5651',
    glow: null,
    mods: { mass: 9, power: 0.9, hook: 0.6 },
  },
  {
    id: 'comet',
    name: 'The Comet',
    emoji: '☄️',
    blurb: 'Light, fast, and bendy. Draws a filthy arc.',
    color: '#d64a1f',
    glow: '#ff9a5a',
    mods: { mass: 5, power: 1.15, hook: 1.5 },
  },
  {
    id: 'glitter',
    name: 'The Glitterball',
    emoji: '🪩',
    blurb: 'Maximum hook, maximum sparkle. Zero chill.',
    color: '#b13df0',
    glow: '#ff3df0',
    mods: { mass: 5.5, power: 0.95, hook: 2.0 },
  },
]

export function ballById(id) {
  return balls.find((b) => b.id === id) || balls[0]
}
