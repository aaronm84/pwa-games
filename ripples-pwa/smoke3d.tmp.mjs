import { chromium } from 'playwright'

const SCRATCH = '/tmp/claude-0/-home-user/07297aad-8665-5a5c-9d62-4db5d7bbeb17/scratchpad'
const URL = 'http://localhost:9317/#/ripples?lv=1'

for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch('http://localhost:9317/')
    if (res.ok) break
  } catch {
    await new Promise((r) => setTimeout(r, 2000))
  }
  if (i === 59) throw new Error('dev server never came up')
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)) })

await page.goto(URL)
await page.waitForFunction(() => typeof window.__ripples === 'function' && window.__ripples().backend, null, { timeout: 90000 })
await page.waitForTimeout(2500)

let st = await page.evaluate(() => window.__ripples())
console.log('BOOTED:', JSON.stringify({ backend: st.backend, level: st.level, taps: st.taps, lotus: st.lotus.length }))
await page.screenshot({ path: SCRATCH + '/3d-1-boot.png' })

// A REAL pointer tap through Gestures + picking ray (screen center = open
// water unless a flower guard sits there; try a couple of spots)
const tapsBefore = st.taps
for (const [x, y] of [[195, 480], [140, 560], [260, 420]]) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(400)
  st = await page.evaluate(() => window.__ripples())
  if (st.taps < tapsBefore) break
}
console.log('POINTER TAP:', st.taps < tapsBefore ? `registered (taps ${tapsBefore}→${st.taps})` : 'NOT REGISTERED')
await page.waitForTimeout(1000)
await page.screenshot({ path: SCRATCH + '/3d-2-wave.png' })

// finish the level: peak-radius hook taps at any sleeping flower
for (let i = 0; i < 5; i++) {
  st = await page.evaluate(() => window.__ripples())
  const pending = st.lotus.find((l) => !l.on)
  if (!pending) break
  await page.evaluate((l) => {
    const s = window.__ripples()
    const d = Math.hypot(l.x, l.z) || 1
    s.tap(l.x - (l.x / d) * 3.75, l.z - (l.z / d) * 3.75, 'medium')
  }, pending)
  await page.waitForTimeout(4000)
}

// wait for the win dialog (activation + full sink)
let won = false
for (let i = 0; i < 30; i++) {
  st = await page.evaluate(() => window.__ripples())
  if (st.won) {
    won = true
    break
  }
  await page.waitForTimeout(1000)
}
console.log('WIN:', won, JSON.stringify({ lotus: st.lotus.map((l) => ({ on: l.on, sink: +l.sink.toFixed(2) })) }))
await page.screenshot({ path: SCRATCH + '/3d-3-final.png' })

// sanity on a busier pond: level 10 has stones + drifting pads
await page.goto('http://localhost:9317/#/ripples?lv=10')
await page.reload()
await page.waitForFunction(() => typeof window.__ripples === 'function' && window.__ripples().backend, null, { timeout: 90000 })
await page.waitForTimeout(3000)
st = await page.evaluate(() => window.__ripples())
console.log('LEVEL 10:', JSON.stringify({ taps: st.taps, lotus: st.lotus.length, pads: st.pads.length }))
// pads should drift: sample positions over 3s
const p0 = st.pads
await page.evaluate(() => window.__ripples().tap(0, 0, 'strong'))
await page.waitForTimeout(3000)
st = await page.evaluate(() => window.__ripples())
const moved = st.pads.some((p, i) => Math.hypot(p.x - p0[i].x, p.z - p0[i].z) > 0.05)
console.log('PADS DRIFT (Havok):', moved)
await page.screenshot({ path: SCRATCH + '/3d-4-level10.png' })

console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
