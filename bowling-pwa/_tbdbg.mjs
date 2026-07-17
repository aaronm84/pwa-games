import { chromium } from 'playwright'
const SHOT = '/tmp/claude-0/-home-user-pwa-games/0b79e1a5-4814-555f-94aa-311a87dd7766/scratchpad/'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 780 } })
await page.goto('http://localhost:9200/#/play?alley=pool&hazards=light&hazard=shoe&hazat=3.4')
await page.waitForFunction(() => window.__bwl && window.__bwl().state === 'aiming', null, { timeout: 90000 })
await page.waitForTimeout(2500)
for (const inv of [true, false]) {
  await page.evaluate(async (inv) => {
    const scene = window.__scene
    const m = scene.materials.find((x) => x.name === 'hzShoeMat')
    m.diffuseTexture?.dispose()
    const { Texture } = await import('/src/engine/index.js')
    m.diffuseTexture = new Texture('/src/assets/shoe-diffuse.jpg', scene, false, inv)
  }, inv)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: SHOT + `uvtest-${inv}.png`, clip: { x: 60, y: 380, width: 280, height: 300 } })
  console.log('shot invertY=' + inv)
}
await browser.close()
