// Kooky physics — optional mutators where flawed physics is the FEATURE
// (Goat Simulator school of game design). Each mode bends the simulation in
// one ridiculous, legible way; scoring still works, dignity does not.
// Kooky games count toward games/strikes but never set best-game records.
export const KOOKY_MODES = [
  {
    id: 'off',
    icon: '🎳',
    name: 'Regulation',
    blurb: 'Physics as the league intended.',
  },
  {
    id: 'moon',
    icon: '🌕',
    name: 'Moon Rules',
    blurb: 'Gravity, but barely. Pins hang in the air deciding.',
    gravity: -1.4, // overrides the alley's gravity outright
    quip: 'Moon Rules tonight — gravity is more of a suggestion.',
  },
  {
    id: 'bouncy',
    icon: '🏰',
    name: 'Bouncy Castle',
    blurb: 'The lane is rubber. The pins are rubber. Your ball? Rubber.',
    surface: { restitution: 0.85 }, // lane, gutters, rails, even the pit
    ball: { restitution: 0.93 },
    pin: { restitution: 0.9 },
    quip: 'Bouncy Castle night! Shoes off. Ball ON.',
  },
  {
    id: 'big',
    icon: '🎱',
    name: 'Big Bowl Energy',
    blurb: 'The pro shop made a terrible, wonderful mistake.',
    ballScale: 2.4, // radius multiplier — it barely fits the lane
    ballMass: 6, // mass multiplier — the pins never stood a chance
    quip: 'That is NOT a regulation ball. Nobody is stopping you.',
  },
  {
    id: 'butter',
    icon: '🧈',
    name: 'Butter Zone',
    blurb: 'Friction is a myth. Pins skate away standing up.',
    surface: { friction: 0.004 },
    ball: { friction: 0.008 },
    pin: { friction: 0.02 },
    quip: 'Somebody buttered the ENTIRE lane. Good luck out there.',
  },
  {
    id: 'gremlin',
    icon: '👻',
    name: 'Poltergeist',
    blurb: 'The lane is haunted. The pins have opinions. The ball hears voices.',
    haunted: true, // the page runs the seance: pin shoves + ball nudges
    quip: 'The house is haunted tonight. The pins KNOW.',
  },
]

export function kookyById(id) {
  return KOOKY_MODES.find((m) => m.id === id) || KOOKY_MODES[0]
}
