// The rivals. Each has a skill (0..1) that drives aim/spin/speed noise, and a
// personality that drives everything else. Tournament runs them in order.
export const rivals = [
  {
    id: 'rollo',
    name: 'Cousin Rollo',
    emoji: '🦥',
    blurb: 'Slow. Unbothered. Occasionally brilliant.',
    skill: 0.45,
    taunt: 'Rollo yawns, then bowls.',
  },
  {
    id: 'rex',
    name: 'Rexxie',
    emoji: '🦖',
    blurb: 'All power. Tiny arms, huge hook.',
    skill: 0.62,
    taunt: 'Rexxie ROARS at the pins.',
  },
  {
    id: 'sparo',
    name: 'SPARE-O 3000',
    emoji: '🤖',
    blurb: 'Cold. Calculating. Converts.',
    skill: 0.78,
    taunt: 'SPARE-O computes the pocket.',
  },
  {
    id: 'lois',
    name: 'Granny Lois',
    emoji: '👵',
    blurb: 'League champion, 1974–present.',
    skill: 0.9,
    taunt: 'Granny Lois cracks her knuckles.',
  },
]

export function rivalById(id) {
  return rivals.find((r) => r.id === id) || null
}

// tournament ladder: three rounds, rising difficulty
export const TOURNAMENT = ['rex', 'sparo', 'lois']

// Where should the rival aim? First ball: the pocket. Otherwise: at the
// centroid of what's standing. Noise scales with (1 - skill).
export function planThrow(rival, standingXs) {
  const noise = (k) => (Math.random() * 2 - 1) * (1 - rival.skill) * k
  if (!standingXs || standingXs.length === 0 || standingXs.length === 10) {
    const side = Math.random() < 0.5 ? -1 : 1
    return {
      x: -0.4 * side + noise(0.5),
      spin: (0.7 + noise(0.35)) * side * (0.6 + rival.skill * 0.5),
      speed: 11.5 + rival.skill * 2.5 + noise(1.6),
    }
  }
  const target = standingXs.reduce((a, b) => a + b, 0) / standingXs.length
  return {
    x: Math.max(-1.1, Math.min(1.1, target + noise(0.55))),
    spin: noise(0.4),
    speed: 11 + rival.skill * 2 + noise(1.4),
  }
}
