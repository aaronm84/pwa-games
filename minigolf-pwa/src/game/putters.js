// Special putters. Each tweaks the physics/aim, and some have a quirky ability.
// `unlock` describes how it's earned (checked against the progress store).
//
// Modifier fields (all optional, sensible defaults in the engine):
//   power    — multiplies max shot speed
//   friction — multiplies rolling friction toward 1 (higher = rolls further)
//   guide    — 'line' (straight aim) or 'predict' (bounce-path preview)
//   homing   — extra pull toward the cup when slow & near (0 = none)
//   mulligan — free do-over putts per hole (undo the last shot)

export const putters = [
  {
    id: 'standard',
    name: 'The Standard',
    emoji: '🏌️',
    blurb: 'Balanced and dependable. The all-rounder.',
    mods: { power: 1, friction: 1, guide: 'line', homing: 0 },
    unlock: null, // always available
  },
  {
    id: 'sniper',
    name: 'The Sniper',
    emoji: '🎯',
    blurb: 'Shows a predicted bounce path. Slightly softer touch.',
    mods: { power: 0.9, friction: 1, guide: 'predict', homing: 0 },
    unlock: { type: 'rounds', n: 1, label: 'Finish 1 round' },
  },
  {
    id: 'cannon',
    name: 'The Cannon',
    emoji: '💥',
    blurb: 'Big power for long carries — easy to overcook it.',
    mods: { power: 1.35, friction: 1.01, guide: 'line', homing: 0 },
    unlock: { type: 'rounds', n: 2, label: 'Finish 2 rounds' },
  },
  {
    id: 'magnet',
    name: 'The Magnet',
    emoji: '🧲',
    blurb: 'Gently curves slow balls toward the cup. Cheating? Maybe.',
    mods: { power: 0.95, friction: 1, guide: 'line', homing: 1.6 },
    unlock: { type: 'aces', n: 1, label: 'Sink a hole-in-one' },
  },
  {
    id: 'feather',
    name: 'The Feather',
    emoji: '🪶',
    blurb: 'Feather-light control and one free mulligan per hole.',
    mods: { power: 0.85, friction: 0.995, guide: 'predict', homing: 0.4, mulligan: 1 },
    unlock: { type: 'rounds', n: 3, label: 'Finish 3 rounds' },
  },
]

export function putterById(id) {
  return putters.find((p) => p.id === id) || putters[0]
}

// Given the progress store's minigolf stats, is this putter unlocked?
export function isUnlocked(putter, stats) {
  const u = putter.unlock
  if (!u) return true
  if (!stats) return false
  if (u.type === 'rounds') return (stats.coursesCompleted || 0) >= u.n
  if (u.type === 'aces') return (stats.holesInOne || 0) >= u.n
  return false
}
