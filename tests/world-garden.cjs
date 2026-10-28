#!/usr/bin/env node
// The forest keeper's world, stage 2: the garden of the roots. A plant for each root (field banana, people sampaguita, learn bamboo,
// body orchid), grown by game.roots (no count of its own): a seedling at 1, young at 3, grown at 8; a flower at the edge of its bed at
// 15 and a crystal at 30. Seven days without watering and it rests (a grown one in its resting drawing, frame 4; a younger one in its
// own), never wilting, dying or going back a stage; a tap waters it (free, no drop) and wakes it. In the garden's sheet in the jungle,
// and the flowers that opened on Home's garden card (the glowing ones in the evening). Its data in fieldy_game_v1 (world.garden), filled
// in safely when missing or broken; the drawings load only when shown; nothing in the old themes.
// Run: node tests/world-garden.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// ROOT=<dir> runs it against another checkout (default: this repository).
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const snap = fs.readFileSync(path.join(__dirname, 'snapshots.cjs'), 'utf8')
const seededState = new Function(snap.slice(snap.indexOf('function todayPlus'), snap.indexOf('// Each scene')) + '\nreturn seededState')()
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else fail++; console.log('  ' + (c ? '✓ ' : '✕ ') + m) }
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')')) }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ theme = 'jungle', game = { v: 1, onboard: { done: true } }, hour = 12, reduced = false } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.reqs = []; pg.on('request', q => pg.reqs.push(q.url()))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t, g]) => { if (sessionStorage.getItem('wd_seeded')) return; sessionStorage.setItem('wd_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t)
      if (g) localStorage.setItem('fieldy_game_v1', JSON.stringify(g)); localStorage.setItem('fieldy_loki_roam', '0') }, [seededState(), theme, game])
    await pg.goto(B + '?gnomeHour=' + hour); await pg.waitForTimeout(500)
    await pg.evaluate(() => {
      window.G = () => gameGet()
      // the roots at n each (or as given), watered `ago` days ago, the sheet opened
      window.SET = (roots, ago) => { closeModal(); const g = gameGet(); g.roots = typeof roots === 'number' ? { field: roots, people: roots, learn: roots, body: roots } : Object.assign({ field: 0, people: 0, learn: 0, body: 0 }, roots); if (ago != null) { const d = new Date(); d.setDate(d.getDate() - ago); GAME_ROOTS.forEach(r => { g.world.garden.water[r] = gardenDayKey(d); delete g.world.garden.tap[r] }) } gameSave(); showGarden() }
      window.BED = r => { const b = document.querySelector('.wd-bed[data-root="' + r + '"]'); if (!b) return null; const im = b.querySelector('.wd-plant'); return { stage: +b.dataset.stage, rest: !!b.dataset.rest, frame: +(im.src.match(/-(\d)\.webp$/) || [])[1], restCss: im.classList.contains('wd-rest'), button: !!b.querySelector('button.wd-btn'), flower: (b.querySelector('.wd-flower') || {}).src || '', crystal: (b.querySelector('.wd-crystal') || {}).src || '', line: (b.querySelector('.wd-line') || {}).textContent, wet: !!b.querySelector('.wd-wet') } }
    })
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  let pg, r

  head('the data: world.garden inside fieldy_game_v1, filled in safely')
  pg = await boot({ game: { v: 1, total: 9, roots: { field: 4 }, world: { met: { kupa: { n: 2 } } }, onboard: { done: true } } })
  r = await pg.evaluate(() => ({ g: G().world.garden, total: G().total, field: G().roots.field, kupa: G().world.met.kupa.n }))
  eq(r, { g: { water: {}, tap: {} }, total: 9, field: 4, kupa: 2 }, 'a world saved before the garden: an empty garden, the rest as it was')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, world: { garden: 'x' } })); game = null; const a = G().world.garden
    localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, world: { garden: { water: { field: '2026-10-01', people: 'soon', owl: '2026-10-01' }, tap: [] } } })); game = null; const b = G().world.garden; return [a, b] })
  eq(r[0], { water: {}, tap: {} }, 'a garden that is not an object: built afresh')
  eq(r[1], { water: { field: '2026-10-01' }, tap: {} }, 'a good date kept; a bad one, an unknown root and a broken map left out')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, onboard: { done: true } })); game = null; G(); const keys = Object.keys(localStorage).sort(); SET(5); worldWater('field'); return [keys, Object.keys(localStorage).sort(), JSON.parse(localStorage.getItem('fieldy_game_v1')).world.garden.tap.field === gardenDayKey()] })
  eq(r[1], r[0], 'no new localStorage key')
  ok(r[2], 'a watering is saved in fieldy_game_v1.world.garden')
  ok(await pg.evaluate(() => !JSON.stringify(JSON.parse(localStorage.getItem('fieldy_v2'))).includes('"garden"')), 'nothing of it in state (never synced)')
  await done(pg)

  head('growing by game.roots: 1, 3, 8; the flower at 15, the crystal at 30')
  pg = await boot()
  r = await pg.evaluate(() => [0, 1, 2, 3, 7, 8, 14, 15, 29, 30].map(n => { SET(n, 0); const b = BED('learn'); return [n, b.stage, b.frame, !!b.flower, !!b.crystal] }))
  eq(r, [[0, 0, 1, false, false], [1, 1, 1, false, false], [2, 1, 1, false, false], [3, 2, 2, false, false], [7, 2, 2, false, false], [8, 3, 3, false, false], [14, 3, 3, false, false], [15, 3, 3, true, false], [29, 3, 3, true, false], [30, 3, 3, true, true]], 'stage, frame, flower and crystal by the tasks of the root')
  r = await pg.evaluate(() => { SET(0, 0); return Object.assign(BED('field'), { txt: document.querySelector('.wd-bed[data-root="field"]').textContent }) })
  ok(r.stage === 0 && !r.button && /הערוגה מחכה לזרע/.test(r.txt), 'no task of the root yet: a faint seedling, "the bed waits for its seed", nothing to tap')
  r = await pg.evaluate(() => ['field', 'people', 'learn', 'body'].map(k => { SET(30, 0); return BED(k) }).map(b => [b.frame, b.flower.split('/').pop(), b.crystal.split('/').pop()]))
  eq(r, [[3, 'flower-field.webp', 'crystal-field.webp'], [3, 'flower-people.webp', 'crystal-people.webp'], [3, 'flower-learn.webp', 'crystal-learn.webp'], [3, 'flower-body.webp', 'crystal-body.webp']], 'each root its own flower and crystal')
  r = await pg.evaluate(() => [...document.querySelectorAll('.wd-plant')].map(i => i.src.split('/').pop()))
  eq(r, ['plant-field-banana-3.webp', 'plant-people-sampaguita-3.webp', 'plant-learn-bamboo-3.webp', 'plant-body-orchid-3.webp'], 'field banana, people sampaguita, learn bamboo, body orchid')
  r = await pg.evaluate(() => { SET({ learn: 7 }, 0); const a = BED('learn').stage; closeModal(); state.tasks.today.push({ id: 'wd1', text: 'ללמוד קורס חשמל', assignee: 'uri', color: 'orange', done: false, createdAt: new Date(Date.now() - 3600e3).toISOString() }); toggleTask('wd1'); showGarden(); return [a, G().roots.learn, BED('learn').stage] })
  eq(r, [2, 8, 3], 'a learning task closed (the journey counts it) and the bamboo is grown: the count is the journey\'s own')
  r = await pg.evaluate(() => { SET({ field: 1 }, 0); return BED('field').line })
  eq(r, 'עוד שתי משימות של שטח לשלב הבא'.replace('שתי משימות', '2 משימות'), 'what is left, counted through gameCount: ' + r)
  r = await pg.evaluate(() => { SET({ field: 2 }, 0); return BED('field').line })
  eq(r, 'עוד משימה אחת של שטח לשלב הבא', 'and one: "' + r + '"')
  await done(pg)

  head('resting after seven days, never going back; a tap wakes it, for free')
  pg = await boot()
  r = await pg.evaluate(() => [6, 7, 30].map(ago => { SET(8, ago); const b = BED('field'); return [ago, b.stage, b.rest, b.frame] }))
  eq(r, [[6, 3, false, 3], [7, 3, true, 4], [30, 3, true, 4]], 'six days: awake; seven and on: resting (a grown plant in its resting drawing, frame 4), still grown')
  r = await pg.evaluate(() => { SET(3, 9); return BED('people') })
  eq([r.stage, r.rest, r.frame, r.restCss], [2, true, 2, true], 'a young one rests in its own drawing (frame 4 is drawn grown), softly coloured, still young')
  r = await pg.evaluate(() => { SET(15, 9); return BED('body') })
  ok(r.rest && r.flower && r.stage === 3, 'resting, its flower stays at the edge of the bed (nothing taken away)')
  r = await pg.evaluate(() => { SET(8, 9); const w0 = G().wallet, e0 = G().earned; document.querySelector('.wd-bed[data-root="field"] .wd-btn').click(); const b = BED('field'); return { rest: b.rest, frame: b.frame, line: b.line, status: !!document.querySelector('.wd-bed[data-root="field"] [role="status"]'), wallet: G().wallet - w0, earned: G().earned - e0, water: G().world.garden.water.field === gardenDayKey(), others: ['people', 'learn', 'body'].every(k => BED(k).rest) } })
  eq([r.rest, r.frame, r.line, r.status, r.wallet, r.earned, r.water, r.others], [false, 3, 'הבננה התעוררה ומתמתחת.', true, 0, 0, true, true], 'a tap on the resting banana: awake (frame 3), a warm word read out, no drop spent, the others still resting')
  r = await pg.evaluate(() => { showGarden(); return Object.assign(BED('field'), { txt: document.querySelector('.wd-bed[data-root="field"]').textContent }) })
  ok(r.wet && /השקית היום/.test(r.txt), 'drawn again: "השקית היום"')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, roots: { field: 8 }, onboard: { done: true } })); game = null; closeModal(); showGarden(); return [BED('field').rest, BED('field').wet, G().world.garden.water.field === gardenDayKey()] })
  eq(r, [false, false, true], 'a plant seen for the first time counts as watered that day (not resting), with no "you watered" said')
  r = await pg.evaluate(() => JSON.stringify([WORLD_PLANTS, WORLD_G_TXT]))
  ok(!/לא השקית|שכחת|נבל|מת[ .]|מתה|יבש|אשמ|למה לא|הזנחת|נעלם/.test(r), 'no blaming word; nothing wilts, dries or dies in the words')
  ok(!/[A-Za-z]{3,}/.test(r.replace(/"[A-Za-z]+":/g, '').replace(/plant-[a-z-]+/g, '').replace(/\{[a-z]+\}/g, '')), 'every line in Hebrew')
  await done(pg)

  head('reduced motion: the waking stretch does not move')
  pg = await boot({ reduced: true })
  r = await pg.evaluate(() => { SET(8, 9); document.querySelector('.wd-bed[data-root="learn"] .wd-btn').click(); const im = document.querySelector('.wd-bed[data-root="learn"] .wd-plant'); return [im.classList.contains('wd-woke'), getComputedStyle(im).animationName, BED('learn').rest] })
  eq(r, [true, 'none', false], 'awake, with no animation')
  await done(pg)
  pg = await boot()
  r = await pg.evaluate(() => { SET(8, 9); document.querySelector('.wd-bed[data-root="learn"] .wd-btn').click(); return getComputedStyle(document.querySelector('.wd-bed[data-root="learn"] .wd-plant')).animationName })
  eq(r, 'wd-wake', 'with motion: a short stretch (CSS, once)')
  await done(pg)

  head('the flowers on Home\'s garden card; the glow in the evening')
  pg = await boot()
  r = await pg.evaluate(() => { const g = G(); g.roots = { field: 14, people: 0, learn: 0, body: 0 }; gameSave(); renderHome(); return document.querySelectorAll('#screen-home .nh-garden .wd-hf').length })
  eq(r, 0, 'no root at 15: no flower on Home')
  r = await pg.evaluate(() => { const g = G(); g.roots = { field: 30, people: 15, learn: 3, body: 16 }; gameSave(); renderHome(); return [...document.querySelectorAll('#screen-home .nh-garden .wd-hf')].map(i => i.src.split('/').pop() + ':' + i.loading) })
  eq(r, ['flower-field.webp:lazy', 'flower-people.webp:lazy', 'flower-body.webp:lazy'], 'the three that opened, loaded lazily, by day without the glow')
  r = await pg.evaluate(() => { const h = document.querySelector('#screen-home .nh-garden').getBoundingClientRect(); return [...document.querySelectorAll('#screen-home .wd-hf')].every(i => { const q = i.getBoundingClientRect(); return q.height <= 44.5 && q.left >= h.left && q.right <= h.right && q.top >= h.top && q.bottom <= h.bottom }) })
  ok(r, 'small (44 px at most: the drawings are never shown larger than they are) and inside the card')
  r = await pg.evaluate(() => [...document.querySelectorAll('#screen-home .wd-hf')].every(i => { const q = i.getBoundingClientRect(), x = (q.left + q.right) / 2, y = (q.top + q.bottom) / 2; const els = document.elementsFromPoint(x, y); return !els.some(e => e.closest('.nh-garden-acts button, .nh-garden-b, .nh-garden-t')) }))
  ok(r, 'not over the card\'s words or buttons')
  await done(pg)
  pg = await boot({ hour: 19 })
  r = await pg.evaluate(() => { const g = G(); g.roots = { field: 30, people: 0, learn: 0, body: 0 }; gameSave(); renderHome(); const home = [...document.querySelectorAll('#screen-home .wd-hf')].map(i => i.src.split('/').pop()); showGarden(); return [home, BED('field').flower.split('/').pop()] })
  eq(r, [['flower-field-glow.webp'], 'flower-field-glow.webp'], 'at 19:00 the glowing flower, on Home and at its bed')
  await done(pg)

  head('the drawings load only when shown')
  pg = await boot({ game: { v: 1, roots: { field: 2, people: 0, learn: 0, body: 0 }, onboard: { done: true } } })
  r = pg.reqs.filter(u => u.includes('/assets/world/garden/')).length
  eq(r, 0, 'Home with no flower open: nothing of the garden is fetched')
  await pg.evaluate(() => showGarden()); await pg.waitForTimeout(500)
  r = pg.reqs.filter(u => u.includes('/assets/world/garden/')).map(u => u.split('/').pop()).sort()
  eq(r, ['plant-body-orchid-1.webp', 'plant-field-banana-1.webp', 'plant-learn-bamboo-1.webp', 'plant-people-sampaguita-1.webp'], 'the sheet opened: only the four frames it shows')
  r = await pg.evaluate(() => { const gs = [...document.querySelectorAll('.wd-beds .wd-cap b, .wd-beds .gm-sub, .wd-beds .gm-h2')]; const lum = c => { const m = c.match(/[\d.]+/g).map(Number), f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]) }
    const bgOf = el => { const L = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e), c = s.backgroundColor.match(/[\d.]+/g).map(Number), img = s.backgroundImage; if (img && img !== 'none') { const m = img.match(/rgba?\([^)]+\)/g); if (m) { const cs = m.map(x => x.match(/[\d.]+/g).map(Number)); L.push(cs.reduce((a, b) => (b[3] ?? 1) > (a[3] ?? 1) ? b : a)) } } if ((c[3] ?? 1) > 0) L.push(c); if ((c[3] ?? 1) >= 1) break } let rgb = [255, 255, 255]; L.reverse().forEach(m => { const a = m[3] ?? 1; rgb = rgb.map((v, i) => v * (1 - a) + m[i] * a) }); return rgb }
    return Math.min(...gs.map(el => { const a = lum(getComputedStyle(el).color), b = lum('rgb(' + bgOf(el).join(',') + ')'); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) })) })
  ok(r >= 4.5, 'its words at 4.5:1 at least (' + r.toFixed(2) + ':1)')
  await done(pg)

  head('only in the jungle')
  for (const theme of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme, game: { v: 1, roots: { field: 30, people: 30, learn: 30, body: 30 }, onboard: { done: true } } })
    r = await pg.evaluate(() => { const home = document.querySelectorAll('.wd-hflowers').length; showGarden(); return [home, document.querySelectorAll('.wd-beds').length] })
    eq(r, [0, 0], theme + ': no beds in the garden, no flowers on Home')
    ok(pg.reqs.filter(u => u.includes('/assets/world/garden/')).length === 0, theme + ': nothing of the garden fetched')
    await done(pg)
  }

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
