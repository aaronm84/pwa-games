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
    pit: 'open', // no backer — the mirror ball hangs over the pit
    sweepStyle: 'neon', // the arm is twin neon tubes with sparkle beads
    pin: { body: '#f4f0ff', bands: [{ y: 0.66, c: '#ff3df0' }, { y: 0.735, c: '#28d7fe' }] },
    hazards: ['mirrorball', 'discoshoe'],
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
      sweep: '#2a2340',
      sweepGlow: '#ff3df0',
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
    pit: 'volcano', // the lane dead-ends into a glowing volcano
    sweepStyle: 'drip', // basalt bar shedding glowing lava drips
    wood: true, // grained boards on the lane floor
    pin: { body: '#fff3e6', bands: [{ y: 0.66, c: '#e8481c' }, { y: 0.735, c: '#ffb52f' }] },
    hazards: ['lavapatch', 'boulder'],
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
      sweep: '#33241c',
      sweepGlow: '#ff6a1f',
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
    pit: 'open', // no backer — deep space behind the pins
    sweepStyle: 'laser', // stacked laser beams between emitter pods
    pin: { body: '#eef4ff', bands: [{ y: 0.66, c: '#4dff9d' }, { y: 0.735, c: '#4d9dff' }] },
    hazards: ['saucer', 'alien'],
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
      sweep: '#1b2634',
      sweepGlow: '#4dff9d',
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
  {
    id: 'tiki',
    name: 'Tiki Grove',
    tagline: 'Dusk in the jungle. Torches, totems, and the occasional coconut.',
    icon: '🗿',
    gravity: -9.81,
    fx: 'tiki', // torchlight flickers; strikes flare the flames
    pit: 'masks', // a row of glowing-eyed tiki masks above the pit
    sweepStyle: 'bamboo', // a thick cane with nodes and rope lashings
    wood: true, // grained boards on the lane floor
    pin: { body: '#c98d4e', bands: [{ y: 0.24, c: '#7a4a22' }, { y: 0.49, c: '#2e8b57' }, { y: 0.7, c: '#e8481c' }] },
    hazards: ['coconut', 'pineapple', 'tikidrink', 'fallentorch'],
    colors: {
      clear: '#1a1410',
      lane: '#4a3520',
      laneEdgeA: '#ff8a3a',
      laneEdgeB: '#59c26a',
      gutter: '#241a10',
      backstop: '#0e0a06',
      pin: '#c98d4e',
      pinStripe: '#7a4a22',
      arrow: '#ffb52f',
      sweep: '#8a6a3a',
      sweepGlow: '#ffab3a',
    },
    sky: 'linear-gradient(160deg,#43301c 0%,#150e08 100%)',
    lines: {
      strike: ['STRIKE! The totems approve.', 'All ten! The torches just flared.', 'The jungle goes quiet. Respect.'],
      spare: ['Spare! Smooth as coconut milk.', 'Cleaned up, island style.'],
      gutter: ['Gutter. The tiki gods frown.', 'That one rolled to the sea.'],
      split: ['A split. Somewhere, a drum stops.', 'The totems saw that split. Sorry.'],
      open: ['Pins left standing. The jungle waits.', 'The totems are unimpressed.'],
    },
  },
  {
    id: 'casino',
    name: 'High Roller',
    tagline: 'Velvet, gold, and terrible odds. The house always wins. Usually.',
    icon: '🎰',
    gravity: -9.81,
    fx: 'casino', // gold sparkle; strikes hit the jackpot
    pit: 'slot', // the backer is a slot machine; the pit is the payout tray
    sweepStyle: 'plush', // button-tufted leather bumper, gold hardware
    pin: { body: '#e8c86a', bands: [{ y: 0.66, c: '#a01a2e' }, { y: 0.735, c: '#7a1522' }] },
    hazards: ['die', 'chipstack', 'cocktail'],
    colors: {
      clear: '#160a0e',
      lane: '#3a1220',
      laneEdgeA: '#ffd23f',
      laneEdgeB: '#ff4a6a',
      gutter: '#1c0a10',
      backstop: '#0c0508',
      pin: '#e8c86a',
      pinStripe: '#a01a2e',
      arrow: '#ffd23f',
      sweep: '#4a1626',
      sweepGlow: '#ffd23f',
    },
    sky: 'linear-gradient(160deg,#4a1626 0%,#12060c 100%)',
    lines: {
      strike: ['JACKPOT! All ten pay out.', 'STRIKE! The pit boss is watching.', 'Ten for ten. House edge, erased.'],
      spare: ['Spare! Double or nothing next.', 'The comeback pays 2 to 1.'],
      gutter: ['Gutter. The house thanks you.', 'That roll was… a donation.'],
      split: ['A split. Snake eyes.', 'Ouch. The odds just moved.'],
      open: ['Pins stand. The house smiles.', 'Left some chips on the table.'],
    },
  },
  {
    id: 'pool',
    name: 'Poolside',
    tagline: 'Daylight bowling on the boardwalk. Mind the beach balls.',
    icon: '🏖️',
    gravity: -9.81,
    fx: 'poolside', // sunny; strikes splash
    bright: true, // full daylight rig
    pit: 'water', // no dark backstop — the deck ends over open pool water
    sweepStyle: 'noodle', // a candy-striped foam pool noodle
    wood: 'soft', // sun-bleached boards, blended close in tone
    pin: { body: '#ffffff', bands: [{ y: 0.66, c: '#29b5d8' }, { y: 0.735, c: '#ff8a5a' }] },
    hazards: ['beachball', 'floaty', 'sunglasses', 'towel', 'sandal'],
    colors: {
      clear: '#bfe4f5',
      lane: '#d8b078',
      laneEdgeA: '#29b5d8',
      laneEdgeB: '#ff8a5a',
      gutter: '#3aa0c8',
      backstop: '#7fb8d0',
      pin: '#ffffff',
      pinStripe: '#29b5d8',
      arrow: '#0a7ea4',
      sweep: '#f2ede4',
      sweepGlow: '#29b5d8',
    },
    sky: 'linear-gradient(160deg,#8fd0ea 0%,#4a9cc2 100%)',
    lines: {
      strike: ['STRIKE! Cannonball!', 'All ten! Somebody call the lifeguard.', 'Sunburn AND a strike. Big day.'],
      spare: ['Spare! Cool as a popsicle.', 'Cleaned it up before the tide.'],
      gutter: ['Gutter. Right into the pool.', 'That one needed floaties.'],
      split: ['A split. Sand in the gears.', 'The seagulls saw that. They talk.'],
      open: ['Pins survive. The pool party continues.', 'Left a few sunbathing.'],
    },
  },
]

export function alleyById(id) {
  return alleys.find((a) => a.id === id) || alleys[0]
}
