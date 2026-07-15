// The alleys. Each is a vibe: colors for the 3D scene, its own gravity (!),
// a signature strike celebration, and an announcer with opinions.
export const alleys = [
  {
    id: 'disco',
    name: 'Disco Nova',
    tagline: 'Cosmic bowling. The lane is a dance floor and the pins know it.',
    icon: '🪩',
    gravity: -9.81,
    fx: 'discoball', // mirror ball drops the confetti on strikes
    colors: {
      clear: '#0b0817',
      lane: '#241b3a',
      laneEdgeA: '#ff3df0',
      laneEdgeB: '#28d7fe',
      gutter: '#141021',
      backstop: '#07050e',
      pin: '#f4f0ff',
      pinStripe: '#ff3df0',
      arrow: '#28d7fe',
    },
    sky: 'linear-gradient(160deg,#2a1b4a 0%,#0b0817 100%)',
    lines: {
      strike: ['STRIIIIKE! The mirror ball approves.', 'All ten! Somebody call the DJ.', 'Cleared the floor. Literally.'],
      spare: ['Cleaned it up — smooth operator.', 'Spare! The bass drops for you.'],
      gutter: ['Gutter. The disco ball looked away.', 'That one danced right off the floor.'],
      split: ['Ooof, a split. The lights just dimmed.', 'A split. Even the fog machine gasped.'],
      open: ['Left some standing. They’re vogueing.', 'The pins survived the night.'],
    },
  },
  {
    id: 'lava',
    name: 'Lava Lanes',
    tagline: 'Bowl over a live magma flow. The gutters are… discouraged.',
    icon: '🌋',
    gravity: -9.81,
    fx: 'lava', // molten gutters pulse; gutter balls sizzle
    colors: {
      clear: '#160d0a',
      lane: '#3a2c22',
      laneEdgeA: '#ff7b2f',
      laneEdgeB: '#ffb52f',
      gutter: '#e8481c',
      gutterGlow: '#ff6a1f',
      backstop: '#0c0705',
      pin: '#fff3e6',
      pinStripe: '#e8481c',
      arrow: '#ffb52f',
    },
    sky: 'linear-gradient(160deg,#4a2430 0%,#160f12 100%)',
    lines: {
      strike: ['STRIKE! The volcano felt that.', 'Ten pins, straight into the magma chamber.', 'Eruption-grade. Magnificent.'],
      spare: ['Spare! Forged in fire.', 'Cleanup on lane one. With lava.'],
      gutter: ['Ssssizzle. That ball is lava now.', 'Gutter. The magma says thank you.'],
      split: ['A split?! Even the volcano winced.', 'That split is geologically unfair.'],
      open: ['Some pins survived the eruption.', 'The pins are fireproof, apparently.'],
    },
  },
  {
    id: 'zerog',
    name: 'Zero-G Lanes',
    tagline: 'Bowling on the space station. Pins fall slower. Egos fall the same.',
    icon: '🛸',
    gravity: -5.2, // floatier pin scatter — the signature gimmick
    fx: 'ufo', // a saucer buzzes the deck on strikes
    colors: {
      clear: '#050912',
      lane: '#152238',
      laneEdgeA: '#4dff9d',
      laneEdgeB: '#4d9dff',
      gutter: '#0b1322',
      backstop: '#030710',
      pin: '#eef4ff',
      pinStripe: '#4dff9d',
      arrow: '#4dff9d',
    },
    sky: 'linear-gradient(160deg,#12203c 0%,#050912 100%)',
    lines: {
      strike: ['STRIKE! Mission control is on their feet.', 'All ten, in glorious slow motion.', 'Houston, the pins are down.'],
      spare: ['Spare! Docking complete.', 'Orbital cleanup achieved.'],
      gutter: ['Gutter. Lost to the void.', 'That ball has achieved escape velocity. Sadly.'],
      split: ['A split, drifting apart. Poetic.', 'Split detected. Thrusters won’t help.'],
      open: ['Pins still standing. Gravity’s alibi.', 'The station keeps a few survivors.'],
    },
  },
]

export function alleyById(id) {
  return alleys.find((a) => a.id === id) || alleys[0]
}
