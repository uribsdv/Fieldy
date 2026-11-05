#!/usr/bin/env node
// The garden scene (jungle only): the four beds painted into one garden you pan sideways, opened from the garden's sheet, above the page and
// below the nav. Checks: the jungle only; each bed's click area is at least 44 px at 360, 390 and 412; each root's plant sits in its own bed;
// day and night by the sun (a mocked clock: 06:15 day, 17:45 the turn, 18:30 night); no timer while the page is hidden; reduced motion and
// the garden's motion switch (world.garden.still, no new localStorage key) turn every animation off; the night painting loads only when needed.
// Run: node tests/garden-scene.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// SHOTS=<dir> also saves the screenshots (morning, the turn, night; each with and without plants).  ROOT=<dir> runs against another checkout.
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found (npm i -D playwright)'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..'), SHOTS = process.env.SHOTS || ''
const snap = fs.readFileSync(path.join(__dirname, 'snapshots.cjs'), 'utf8')
const seededState = new Function(snap.slice(snap.indexOf('function todayPlus'), snap.indexOf('// Each scene')) + '\nreturn seededState')()
const scene = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/garden-scene/scene.json'), 'utf8'))
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else fail++; console.log('  ' + (c ? '✓ ' : '✕ ') + m) }
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')')) }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
const FULL = { field: 30, people: 15, learn: 8, body: 3 }
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  // time: 'HH:MM' on 2026-11-05 in Manila (the sun's longitude comes from the device's time zone)
  async function boot({ theme = 'jungle', time = '12:00', w = 390, h = 844, reduced = false, roots = FULL, open = true } = {}) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1, timezoneId: 'Asia/Manila', reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.reqs = []; pg.on('request', q => pg.reqs.push(q.url()))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.clock.install({ time: new Date('2026-11-05T' + time + ':00+08:00') })
    await pg.addInitScript(([s, t]) => { if (sessionStorage.getItem('gs_seeded')) return; sessionStorage.setItem('gs_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t)
      localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, onboard: { done: true } })); localStorage.setItem('fieldy_loki_roam', '0') }, [seededState(), theme])
    await pg.goto(B + '?gnomeHour=12'); await pg.clock.runFor(600)
    await pg.evaluate(r => { const g = gameGet(); g.world.garden.base = { field: 0, people: 0, learn: 0, body: 0 }; g.roots = Object.assign({ field: 0, people: 0, learn: 0, body: 0 }, r); gameSave() }, roots)
    if (open) { await pg.evaluate(() => { showGarden(); sceneOpen() }); await pg.clock.runFor(500) }
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  const anims = pg => pg.evaluate(() => { const g = document.getElementById('gsc'); return document.getAnimations().filter(a => a.effect && a.effect.target && g && g.contains(a.effect.target) && a.playState === 'running').length })
  let pg, r

  head('the jungle only: the entry, the scene, nothing in the old themes')
  for (const t of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: t, open: false })
    r = await pg.evaluate(() => { showGarden(); const entry = !!document.querySelector('.gsc-open'); sceneOpen(); return { entry, scene: !!document.getElementById('gsc') } })
    eq(r, { entry: false, scene: false }, t + ': no entry in the garden sheet, and the scene does not open')
    ok(!pg.reqs.some(u => /garden-scene/.test(u)), t + ': nothing of the scene is requested')
    await done(pg)
  }
  pg = await boot({ open: false })
  r = await pg.evaluate(() => { showGarden(); const sheet = !!document.querySelector('.wd-beds'), entry = !!document.querySelector('.gsc-open'); document.querySelector('.gsc-open').click(); return { sheet, entry, scene: !!document.getElementById('gsc'), modal: !!document.querySelector('.modal') } })
  eq(r, { sheet: true, entry: true, scene: true, modal: false }, 'jungle: the sheet keeps its four beds, the entry opens the scene')
  await pg.waitForTimeout(300)
  ok(pg.reqs.some(u => /garden-scene\/day\.webp/.test(u)), 'the day painting is loaded when the scene opens')
  eq(await pg.evaluate(() => JSON.stringify(SC.beds.map(b => [b.slot, b.c, b.p, b.size]))), JSON.stringify(scene.beds.map(b => [b.slot, b.center, b.polygon, b.size])), 'the beds in the code are those of scene.json')
  eq(await pg.evaluate(() => [SC.lights, SC.sun]), [scene.lights, scene.sun], 'the lights and the sun constants are those of scene.json')
  await done(pg)

  head('four beds, a click area of at least 44 px at 360, 390 and 412')
  for (const [w, h] of [[360, 740], [390, 844], [412, 915]]) {
    pg = await boot({ w, h, roots: { field: 1, people: 1, learn: 1, body: 1 } })
    r = await pg.evaluate(() => [...document.querySelectorAll('#gsc .gsc-bed')].map(b => { const q = b.getBoundingClientRect(); return [b.dataset.slot, Math.round(q.width), Math.round(q.height)] }))
    eq(r.map(x => x[0]).sort(), ['body', 'field', 'learning', 'people'], w + ': four beds')
    ok(r.every(x => x[1] >= 44 && x[2] >= 44), w + ': every click area is 44 x 44 px or more (' + r.map(x => x[0] + ' ' + x[1] + 'x' + x[2]).join(', ') + ')')
    await done(pg)
  }

  head('the right plant in each bed; the nav stays in reach')
  pg = await boot()
  r = await pg.evaluate(() => { const wr = document.querySelector('#gsc .gsc-world').getBoundingClientRect(), inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c }
    return SC.beds.map(b => { const el = document.querySelector('#gsc .gsc-pl[data-root="' + SC_ROOT[b.slot] + '"]'), q = el.getBoundingClientRect(), img = el.querySelector('img:not(.gsc-fl):not(.gsc-cr)'), x = (q.left + q.width / 2 - wr.left) / wr.width * 100, y = (q.bottom - wr.top) / wr.height * 100 + 1
      return [b.slot, inPoly(x, y - 1.5, b.p) || inPoly(b.c[0], b.c[1], b.p), /plant-(field-banana|people-sampaguita|learn-bamboo|body-orchid)/.exec(img.src)[1]] }) })
  eq(r.map(x => x[2]), ['field-banana', 'body-orchid', 'people-sampaguita', 'learn-bamboo'], 'banana in the field bed, orchid in body, sampaguita in people, bamboo in learning')
  ok(r.every(x => x[1]), 'each plant stands on its own bed (the foot inside the polygon)')
  r = await pg.evaluate(() => { const n = document.getElementById('nav'), q = n.getBoundingClientRect(), g = document.getElementById('gsc').getBoundingClientRect(), t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { vis: q.height > 0, above: g.bottom <= q.top + 1, hit: !!(t && n.contains(t)) } })
  eq(r, { vis: true, above: true, hit: true }, 'the nav is not covered: the scene ends where it begins')
  const wateredBefore = await pg.evaluate(() => gameGet().world.garden.tap.field || '')
  await pg.click('#gsc .gsc-bed[data-root="field"]'); await pg.clock.runFor(300)
  ok(await pg.evaluate(() => gameGet().world.garden.tap.field === gardenDayKey()) && !wateredBefore, 'a press on a bed waters its plant (the sheet\'s own watering)')
  ok(await pg.evaluate(() => !!document.querySelector('#gsc .gsc-line').textContent), 'and says so')
  await pg.click('#nav .nav-btn[data-screen="tasks"]'); await pg.clock.runFor(300)
  eq(await pg.evaluate(() => [!!document.getElementById('gsc'), currentScreen]), [false, 'tasks'], 'a nav button works and closes the scene')
  await done(pg)

  head('the stage of each plant follows the roots (1 / 3 / 8 / 15 / 30), as in the sheet')
  pg = await boot({ roots: {} })
  r = await pg.evaluate(() => [0, 1, 3, 8, 15, 30].map(n => { const g = gameGet(); g.roots = { field: n, people: n, learn: n, body: n }; sceneDraw(); const e = document.querySelector('#gsc .gsc-pl[data-root="learn"]'); return [n, +e.dataset.stage, !!e.querySelector('.gsc-fl'), !!e.querySelector('.gsc-cr'), !!document.querySelector('#gsc .gsc-bed[data-root="learn"]')] }))
  eq(r, [[0, 0, false, false, false], [1, 1, false, false, true], [3, 2, false, false, true], [8, 3, false, false, true], [15, 3, true, false, true], [30, 3, true, true, true]], 'seed (no button), 1, 3, 8; the flower at 15, the crystal at 30')
  await done(pg)

  head('day and night by the sun (a mocked clock, Manila)')
  const dark = {}
  for (const t of ['06:15', '17:45', '18:30']) {
    pg = await boot({ time: t }); dark[t] = await pg.evaluate(() => +document.getElementById('gsc').dataset.dark)
    eq(await pg.evaluate(() => document.querySelector('#gsc .gsc-world').style.getPropertyValue('--n')), dark[t].toFixed(3), t + ': the painting\'s darkness is ' + dark[t].toFixed(3))
    await done(pg)
  }
  ok(dark['06:15'] === 0, '06:15: full day'); ok(dark['17:45'] > 0 && dark['17:45'] < 1, '17:45: in between (' + dark['17:45'] + ')'); ok(dark['18:30'] === 1, '18:30: full night')
  eq(await (async () => { pg = await boot({ time: '12:00', open: false }); const v = await pg.evaluate(() => [-9, -8, -3, 2, 3].map(a => +sceneDark(a).toFixed(2))); await done(pg); return v })(), [1, 1, .5, 0, 0], 'full night at -8 degrees and below, full day at +2 and above, gradual between')

  head('the night painting loads only when it is needed')
  pg = await boot({ time: '12:00' })
  ok(!pg.reqs.some(u => /night\.webp/.test(u)) && await pg.evaluate(() => !document.querySelector('#gsc .gsc-nt')), 'by day: no night painting requested, none in the page')
  await pg.clock.runFor(7 * 3600 * 1000 + 60000); await pg.waitForTimeout(300)
  ok(pg.reqs.some(u => /night\.webp/.test(u)) && await pg.evaluate(() => +document.getElementById('gsc').dataset.dark > 0), 'when the dark begins (the minute\'s tick, 7 hours on): it is requested')
  await done(pg)
  pg = await boot({ time: '19:00' })
  ok(pg.reqs.some(u => /night\.webp/.test(u)), 'opened at night: requested at once')
  await done(pg)

  head('no timer while the page is hidden')
  pg = await boot({ time: '12:00' })
  await pg.evaluate(() => { window.__n = 0; const f = sceneApply; window.sceneApply = function() { window.__n++; return f.apply(this, arguments) } })
  await pg.clock.runFor(125000); const live = await pg.evaluate(() => window.__n)
  ok(live >= 2, 'visible: it looks at the sun every minute (' + live + ' times in two)')
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.__n = 0 })
  await pg.clock.runFor(10 * 60000); eq(await pg.evaluate(() => window.__n), 0, 'hidden: nothing runs in ten minutes')
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await pg.clock.runFor(1000); ok(await pg.evaluate(() => window.__n) >= 1, 'back in view: it looks at once and goes on')
  await pg.evaluate(() => { window.__n = 0; sceneClose() }); await pg.clock.runFor(3 * 60000)
  eq(await pg.evaluate(() => window.__n), 0, 'closed: no timer is left')
  await done(pg)

  head('motion: CSS animations, off by reduced motion and by the garden\'s switch')
  pg = await boot()
  const n = await anims(pg); ok(n > 0 && n <= 60, 'in motion: ' + n + ' running animations (60 at most)')
  r = await pg.evaluate(() => { const bad = []; document.getAnimations().forEach(a => { const t = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [], g = document.getElementById('gsc'); if(!(a.effect.target && g.contains(a.effect.target))) return; t.forEach(k => Object.keys(k).forEach(p => { if(!['offset', 'easing', 'composite', 'computedOffset', 'opacity', 'transform', 'translate'].includes(p)) bad.push(p) })) }); return [...new Set(bad)] })
  eq(r, [], 'the animations touch opacity and transform (translate) only')
  r = await pg.evaluate(() => [...document.querySelectorAll('#gsc .gsc-ff')].length + ' ' + document.querySelectorAll('#gsc .gsc-fw:not(.nq) .gsc-ff').length)
  eq(r, '24 8', '24 fireflies, 8 of them in the day layer')
  const keys0 = await pg.evaluate(() => Object.keys(localStorage).sort())
  await pg.evaluate(() => setGardenStill(false)); await pg.clock.runFor(200)
  eq(await anims(pg), 0, 'the switch off: no animation runs')
  r = await pg.evaluate(() => [JSON.parse(localStorage.getItem('fieldy_game_v1')).world.garden.still, Object.keys(localStorage).sort()])
  eq(r, [true, keys0], 'the switch is kept in fieldy_game_v1.world.garden.still, and no new localStorage key')
  await pg.evaluate(() => setGardenStill(true)); await pg.clock.runFor(200)
  ok(await anims(pg) > 0 && await pg.evaluate(() => JSON.parse(localStorage.getItem('fieldy_game_v1')).world.garden.still === undefined), 'switched on again: it moves, and the saved record is as before')
  await pg.evaluate(() => { setGardenStill(false); sceneClose(); navigateTo('settings') }); await pg.clock.runFor(300)
  r = await pg.evaluate(() => { const c = document.getElementById('pref-garden-motion'); if(!c) return null; const was = c.checked; c.click(); return [was, gameGet().world.garden.still === undefined] })
  eq(r, [false, true], 'Settings (jungle): the garden motion switch shows the saved state and turns motion back on')
  ok(await pg.evaluate(() => { const l = document.querySelector('#pref-garden-motion').closest('label'); return l.textContent.trim().length > 0 }), 'with its own label')
  await pg.evaluate(() => { showGarden(); sceneOpen() }); await pg.clock.runFor(300)
  ok(await anims(pg) > 0, 'reopened with the switch on: it moves')
  await done(pg)
  pg = await boot({ reduced: true })
  eq(await anims(pg), 0, 'prefers-reduced-motion: no animation runs')
  r = await pg.evaluate(() => [...document.querySelectorAll('#gsc .gsc-ff, #gsc .gsc-gl')].every(e => getComputedStyle(e).display === 'none' || getComputedStyle(e.parentElement).display === 'none') && getComputedStyle(document.querySelector('#gsc .gsc-world')).getPropertyValue('--n') !== '')
  ok(r, 'no fireflies and no flicker; the painting and the day/night still there')
  await pg.waitForTimeout(400)
  ok(await pg.evaluate(() => { const i = document.querySelector('#gsc .gsc-day'); return i.complete && i.naturalWidth === 1080 && i.naturalHeight === 1440 }), 'the day painting is shown (1080 x 1440)')
  await done(pg)
  pg = await boot({ reduced: true, time: '18:30' })
  eq(await pg.evaluate(() => getComputedStyle(document.querySelector('#gsc .gsc-nt')).transitionDuration), '0s', 'reduced motion at night: the day/night change has no gradual fade')
  await done(pg)

  head('the position and the water: the start is between the beds and the stream, the water is the painting\'s own')
  pg = await boot()
  r = await pg.evaluate(() => { const s = document.querySelector('#gsc .gsc-sc'), range = s.scrollWidth - s.clientWidth; return [range > 0, Math.abs(s.scrollLeft / range - .42) < .03] })
  eq(r, [true, true], 'the world is wider than the screen and starts at .42 of the way')
  r = await pg.evaluate(() => { const w = document.querySelector('#gsc .gsc-world'), q = w.getBoundingClientRect(); return Math.abs(q.width / q.height - .75) < .005 })
  ok(r, 'the world keeps the painting\'s 3:4')
  await done(pg)

  if (SHOTS) {
    head('screenshots → ' + SHOTS); fs.mkdirSync(SHOTS, { recursive: true })
    for (const [name, time] of [['morning', '06:15'], ['transition', '17:45'], ['night', '18:30']]) for (const [k, roots] of [['empty', {}], ['plants', FULL]]) {
      pg = await boot({ time, roots }); await pg.clock.runFor(3500); await pg.screenshot({ path: path.join(SHOTS, name + '-' + k + '.png') }); await pg.context().close()
    }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); await br.close(); srv.close(); process.exit(fail ? 1 : 0)
})
