// Pure ten-pin scoring. A game is a list of rolls (pins knocked per throw);
// this computes per-frame scores with real strike/spare bonuses and the
// three-throw tenth frame. Pure functions — unit-tested by scoring.test.mjs.

// Returns { frames: [{ rolls, score, cumulative, mark }], total, complete,
//           frameIndex, throwIndex } for the current roll list.
export function scoreGame(rolls) {
  const frames = []
  let i = 0
  for (let f = 0; f < 10; f++) {
    const frame = { rolls: [], score: null, cumulative: null, mark: '' }
    if (f < 9) {
      const a = rolls[i]
      if (a == null) { frames.push(frame); continue }
      frame.rolls.push(a)
      if (a === 10) {
        frame.mark = 'X'
        const b1 = rolls[i + 1]
        const b2 = rolls[i + 2]
        if (b1 != null && b2 != null) frame.score = 10 + b1 + b2
        i += 1
      } else {
        const b = rolls[i + 1]
        if (b != null) {
          frame.rolls.push(b)
          if (a + b === 10) {
            frame.mark = '/'
            const c = rolls[i + 2]
            if (c != null) frame.score = 10 + c
          } else {
            frame.score = a + b
          }
        }
        i += 2
      }
    } else {
      // tenth frame: up to three rolls
      const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2]
      for (const r of [a, b, c]) if (r != null) frame.rolls.push(r)
      if (a === 10 || (a != null && b != null && a + b === 10)) {
        frame.mark = a === 10 ? 'X' : '/'
        if (a != null && b != null && c != null) frame.score = a + b + c
      } else if (a != null && b != null) {
        frame.score = a + b
      }
    }
    frames.push(frame)
  }
  let cum = 0
  let total = null
  let complete = true
  for (const fr of frames) {
    if (fr.score == null) { complete = false; break }
    cum += fr.score
    fr.cumulative = cum
    total = cum
  }
  // where the NEXT roll goes
  const pos = rollPosition(rolls)
  return { frames, total, complete: complete && pos == null, frameIndex: pos?.frame ?? 9, throwIndex: pos?.throw ?? 0 }
}

// Which frame/throw does the next roll belong to? null when the game is over.
// Also reports how many pins stand for that throw (10 fresh, or the remainder).
export function rollPosition(rolls) {
  let i = 0
  for (let f = 0; f < 9; f++) {
    const a = rolls[i]
    if (a == null) return { frame: f, throw: 0, standing: 10 }
    if (a === 10) { i += 1; continue }
    const b = rolls[i + 1]
    if (b == null) return { frame: f, throw: 1, standing: 10 - a }
    i += 2
  }
  // tenth frame
  const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2]
  if (a == null) return { frame: 9, throw: 0, standing: 10 }
  if (b == null) return { frame: 9, throw: 1, standing: a === 10 ? 10 : 10 - a }
  if (a === 10 || a + b === 10) {
    if (c == null) {
      // fresh rack unless the second ball left pins standing (X then non-strike)
      const standing = a === 10 && b !== 10 ? 10 - b : 10
      return { frame: 9, throw: 2, standing }
    }
    return null
  }
  return null
}
