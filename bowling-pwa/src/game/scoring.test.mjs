// Unit tests for the pure scoring module: node src/game/scoring.test.mjs
import { scoreGame, rollPosition } from './scoring.js'

let fails = 0
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fails++; console.error(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
  else console.log(`ok  ${name}`)
}

// classic reference games
eq('perfect game', scoreGame(Array(12).fill(10)).total, 300)
eq('all spares (5,5) + 5', scoreGame([...Array(21)].map(() => 5)).total, 150)
eq('all gutters', scoreGame(Array(20).fill(0)).total, 0)
eq('all nines', scoreGame([...Array(10)].flatMap(() => [9, 0])).total, 90)
// the canonical example: X 7/ 9- X -8 8/ -6 X X X81
eq('mixed textbook game', scoreGame([10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1]).total, 167)
// spare then 3
eq('spare bonus', scoreGame([5, 5, 3, 0]).frames[0].score, 13)
// strike bonus takes next two rolls
eq('strike bonus', scoreGame([10, 3, 4]).frames[0].score, 17)
// incomplete: strike frame has no score until two more rolls
eq('pending strike', scoreGame([10]).frames[0].score, null)
// tenth frame: spare earns a third roll
eq('tenth spare third roll', rollPosition([...Array(18).fill(0), 5, 5]), { frame: 9, throw: 2, standing: 10 })
// tenth frame: open tenth ends the game
eq('open tenth ends', rollPosition([...Array(18).fill(0), 3, 4]), null)
// tenth: strike then 7 leaves 3 standing for the last throw
eq('tenth X then 7', rollPosition([...Array(18).fill(0), 10, 7]), { frame: 9, throw: 2, standing: 3 })
// position mid-game: after a strike next roll is next frame
eq('post-strike position', rollPosition([10]), { frame: 1, throw: 0, standing: 10 })
eq('second throw standing', rollPosition([6]), { frame: 0, throw: 1, standing: 4 })
// completeness
eq('perfect complete', scoreGame(Array(12).fill(10)).complete, true)
eq('empty incomplete', scoreGame([]).complete, false)

if (fails) { console.error(`\n${fails} failing`); process.exit(1) }
console.log('\nAll scoring tests pass.')
