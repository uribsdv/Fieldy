#!/usr/bin/env node
// The forest keeper's world, stage 1: the guests' engine. One engine, in Loki's own queue (lkr.rq, lokiReactFree, LK_REACT_GAP)
// and poked from lokiTick while he is out; a guest comes only when he is free, 1.5 s at least after Home is still, one a creature
// a day and three a day in all, never at night, never while a sheet is open or the app is away; reduced motion: the line only.
// Its data in fieldy_game_v1 (game.world, no new key), filled in safely when missing or broken. Three creatures from the art
// already in assets/rewards/ (Kupa the frog: every root; the dragonfly: learning, after a scroll; the fireflies: people, in the
// evening and at the day's end). Friendship at 1, 3, 8 and 15 visits, never going back; the field journal in the journey's sheet;
// counts through gameCount; nothing in an old theme.
// Run: node tests/world-guests.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// ROOT=<dir> runs it against another checkout (default: this repository).
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const EMPTY = { tasks: { now: [], today: [], later: [] }, sites: [], people: [], events: [], moods: [], personal: { gymLog: {}, meditationLog: {} } }
// enough on Home to scroll it (the dragonfly waits for a scroll)
const FULL = JSON.parse(JSON.stringify(EMPTY))
for (let i = 0; i < 14; i++) FULL.tasks.later.push({ id: 'f' + i, text: 'בדיקה ' + i, site: null, assignee: 'uri', color: 'orange', done: false, createdAt: new Date(Date.now() - 864e5).toISOString() })
// Home as the snapshots seed it (the cards Loki walks between), for him out on Home
const snap = fs.readFileSync(path.join(__dirname, 'snapshots.cjs'), 'utf8')
const seededState = new Function(snap.slice(snap.indexOf('function todayPlus'), snap.indexOf('// Each scene')) + '\nreturn seededState')()
let pass = 0, fail = 0, part = ''
const ok = (c, m) => { if (c) pass++; else fail++; console.log('  ' + (c ? '✓ ' : '✕ ') + m) }
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')')) }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ theme = 'jungle', state = EMPTY, game = { v: 1, onboard: { done: true } }, hour = 12, roam = false, reduced = false, gnome = true, lab = false, W = 390 } = {}) {
    const ctx = await br.newContext({ viewport: { width: W, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t, g, roam, gnome]) => { if (sessionStorage.getItem('wg_seeded')) return; sessionStorage.setItem('wg_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t)
      if (g) localStorage.setItem('fieldy_game_v1', JSON.stringify(g)); localStorage.setItem('fieldy_loki_roam', roam ? '1' : '0'); if (!gnome) localStorage.setItem('fieldy_jungle_gnome', '0') }, [state, theme, game, roam, gnome])
    await pg.goto(B + '?gnomeHour=' + hour + (lab ? '&loki-lab=1' : '')); await pg.waitForTimeout(500)
    await pg.evaluate(() => {
      window.__n = 0
      window.T = (o = {}) => { const id = 'wg' + (++__n); state.tasks.today.push(Object.assign({ id, text: 'משימה ' + __n, site: null, assignee: 'uri', color: 'orange', context: null, done: false, createdAt: new Date(Date.now() - 3600e3).toISOString() }, o)); return id }
      window.C = id => toggleTask(id)
      window.W = () => gameGet().world
      window.Q = () => lkr.rq.filter(x => x.evt === 'guest').map(x => x.data.g + (x.data.ctx ? ':' + x.data.ctx : ''))
      // the queue looked at now, as if the 45 s since his last reaction and the 1.5 s of stillness had passed
      window.F = () => { lkr.lastReact = 0; wg.settledAt = 0; lokiReactTick(); return wg.last && wg.last.g }
      window.CL = () => { lokiQueue = []; gnIdx = 0; if (currentScreen === 'home') lokiRender(); wg.last = null }
    })
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  let pg, r

  head('the data: inside fieldy_game_v1, filled in safely')
  pg = await boot({ game: { v: 1, total: 4, onboard: { done: true } } })
  r = await pg.evaluate(() => ({ w: W(), saved: JSON.parse(localStorage.getItem('fieldy_game_v1')).total }))
  eq(r.w, { v: 1, met: {}, day: { k: '', n: 0, seen: {} }, log: [] }, 'a journey saved before the world: an empty world, nothing else touched')
  eq(r.saved, 4, 'the journey itself as it was')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, world: 'x' })); game = null; const a = W()
    localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, world: { met: [], day: 5, log: 'y' } })); game = null; const b = W()
    localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, world: { met: { kupa: { n: '4', first: '2026-01-01' }, owl: { n: 3 } }, day: { k: 'k', n: 2, seen: { kupa: 1 } }, log: [{ ts: 5, g: 'kupa', root: 'field' }, { ts: 6, g: 'owl' }, null] } })); game = null; const c = W()
    return [a, b, c] })
  eq(r[0], { v: 1, met: {}, day: { k: '', n: 0, seen: {} }, log: [] }, 'a world that is not an object: built afresh')
  eq(r[1], { v: 1, met: {}, day: { k: '', n: 0, seen: {} }, log: [] }, 'broken parts: filled in')
  eq([r[2].met, r[2].day.n, r[2].log.length], [{ kupa: { n: 4, first: '2026-01-01', last: '' } }, 2, 1], 'what is good is kept; an unknown creature or entry is left out')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, onboard: { done: true } })); game = null; gameGet(); const keys = Object.keys(localStorage).sort()
    navigateTo('tasks'); const id = T(); C(id); lokiQueue = []; navigateTo('home'); F(); const after = Object.keys(localStorage).sort(); return [keys, after, !!JSON.parse(localStorage.getItem('fieldy_game_v1')).world.met.kupa] })
  eq(r[1], r[0], 'a visit adds no localStorage key')
  ok(r[2], 'the visit is saved in fieldy_game_v1.world')
  ok(await pg.evaluate(() => !('world' in JSON.parse(localStorage.getItem('fieldy_v2')))), 'nothing of it in state (never synced)')
  await done(pg)

  head('who comes, by the root of the task closed')
  pg = await boot()
  r = await pg.evaluate(() => [{ text: 'בדיקת משאבה', context: 'site', site: 'X' }, { text: 'להתקשר לדייב' }, { text: 'ללמוד קורס חשמל' }, { text: 'אימון כושר' }].map(o => { lkr.rq = []; worldOnDone(gameRoot(o)); return Q()[0] || null }))
  eq(r, ['kupa', 'kupa', 'dragonfly:scroll', 'kupa'], 'at noon: Kupa for the field, people and body; the dragonfly for learning')
  await done(pg)
  pg = await boot({ hour: 19 })
  r = await pg.evaluate(() => { lkr.rq = []; worldOnDone('people'); return Q() })
  eq(r, ['fireflies:evening'], 'in the evening, people: the fireflies')
  await done(pg)
  pg = await boot({ hour: 23 })
  r = await pg.evaluate(() => { ['field', 'people', 'learn', 'body'].forEach(worldOnDone); return Q() })
  eq(r, [], 'at night (23:00) no guest is asked for')
  await done(pg)
  pg = await boot({ hour: 4 })
  ok(await pg.evaluate(() => { worldOnDone('field'); return Q().length === 0 }), 'nor at 04:00')
  await done(pg)

  head('when it comes: Home in front, still 1.5 s, Loki free')
  pg = await boot()
  r = await pg.evaluate(async () => { navigateTo('tasks'); setTaskBucket('today'); const id = T(); C(id); lokiQueue = []   // (the first task's achievement is his to tell first; a guest waits while he talks)
    const q = Q(); await new Promise(r => setTimeout(r, 2200)); return { q, onTasks: wg.last, layer: !!document.querySelector('.wg-layer') } })
  eq(r.q, ['kupa'], 'a field task closed on the tasks screen asks for Kupa')
  ok(r.onTasks === null && !r.layer, 'nothing comes while another screen is in front')
  r = await pg.evaluate(async () => { const t0 = Date.now(); navigateTo('home'); let at = 0; for (let i = 0; i < 60 && !at; i++) { await new Promise(r => setTimeout(r, 100)); if (wg.last) at = Date.now() - t0 } return { at, g: wg.last && wg.last.g, label: (document.querySelector('#jg-gnome .gn-k') || {}).textContent, text: (document.querySelector('#jg-gnome .gn-t') || {}).textContent, drawn: !!document.querySelector('.wg-layer .wg-kupa img[src$="frog.png"]') } })
  ok(r.g === 'kupa' && r.at >= 1500, 'on Home it comes, not before 1.5 s of stillness (' + r.at + ' ms)')
  ok(r.label === 'קופה הצפרדע' && /קופה/.test(r.text || ''), 'Loki tells it in his card: ' + r.text)
  ok(r.drawn, "Kupa's drawing (frog.png) hops in, in a layer of Home")
  r = await pg.evaluate(() => { const l = document.querySelector('.wg-layer'), g = l.querySelector('.wg-guest'), cs = getComputedStyle(g); return { aria: l.getAttribute('aria-hidden'), pe: getComputedStyle(l).pointerEvents, anim: cs.animationName, dur: cs.animationDuration } })
  eq([r.aria, r.pe, r.anim], ['true', 'none', 'wg-kupa'], 'the layer is hidden from readers and takes no press; the motion is CSS')
  await pg.waitForTimeout(8400)
  ok(await pg.evaluate(() => !document.querySelector('.wg-layer') && !wg.t || !document.querySelector('.wg-layer')), 'after its few seconds the layer is gone (nothing left running)')
  r = await pg.evaluate(() => { CL(); navigateTo('home'); worldMoved(); lkr.lastReact = 0; worldQueue('dragonfly', 'learn', 'scroll'); lokiReactTick(); return wg.last })
  ok(r === null, 'no guest within 1.5 s of the screen changing')
  r = await pg.evaluate(() => { lkr.rq = []; lkr.lastReact = Date.now() - 10000; wg.settledAt = 0; worldQueue('fireflies', 'people', 'summary'); lokiReactTick(); return wg.last })
  ok(r === null, 'nor within 45 s of anything else he reacted to (LK_REACT_GAP)')
  r = await pg.evaluate(() => { lkr.lastReact = 0; lokiQueue = [lokiItem('say', 'x', 'stand')]; lokiReactTick(); const busy = wg.last; lokiQueue = []; return busy })
  ok(r === null, 'nor while Loki is telling something (lokiReactFree)')
  r = await pg.evaluate(() => { openModal('<div>x</div>'); lkr.lastReact = 0; wg.settledAt = 0; lokiReactTick(); const a = wg.last; closeModal(); return a })
  ok(r === null, 'nor while a sheet is open')
  r = await pg.evaluate(() => { const d = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState'); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); lkr.lastReact = 0; wg.settledAt = 0; lokiReactTick(); const a = wg.last; delete document.visibilityState; return a })
  ok(r === null, 'nor while the app is away (screen locked, in the background)')
  await done(pg)

  head('one a creature a day, three a day in all; friendship never goes back')
  pg = await boot({ hour: 19 })
  r = await pg.evaluate(() => { const got = []; ['field', 'field', 'learn', 'people', 'people', 'body'].forEach(root => { lkr.rq = []; worldOnDone(root); if (Q().length) { wg.scrollAt = Date.now() + 1; got.push(F()); CL() } else got.push(null) }); return { got, day: W().day.n, met: Object.keys(W().met).map(g => [g, W().met[g].n]) } })
  eq(r.got, ['kupa', null, 'dragonfly', 'fireflies', null, null], 'Kupa, then not again; the dragonfly; the fireflies; then nobody (three today)')
  eq([r.day, r.met], [3, [['kupa', 1], ['dragonfly', 1], ['fireflies', 1]]], 'three visits kept')
  r = await pg.evaluate(() => { const w = W(); w.day.k = '2000-01-01'; lkr.rq = []; worldOnDone('field'); const g = F(); return { g, n: w.met.kupa.n, day: w.day.n } })
  eq(r, { g: 'kupa', n: 2, day: 1 }, 'a new day: Kupa may come again, her visits go on from where they were')
  r = await pg.evaluate(() => [0, 1, 2, 3, 7, 8, 14, 15, 99].map(worldStep))
  eq(r, [0, 1, 1, 2, 2, 3, 3, 4, 4], 'the steps of a friendship: 1, 3, 8, 15 visits')
  r = await pg.evaluate(() => { CL(); const w = W(); w.day = { k: gardenDayKey(), n: 0, seen: {} }; w.met.kupa.n = 2; worldOnDone('field'); F(); return Object.assign({ want: WORLD_TXT.friend.kupa[2] }, wg.last) })
  ok(r.step === 2 && r.line.includes(r.want), 'the third visit: "' + r.want + '"')
  r = await pg.evaluate(() => { CL(); const w = W(); w.day = { k: gardenDayKey(), n: 0, seen: {} }; worldOnDone('field'); F(); return [wg.last.step, wg.last.line.includes(WORLD_TXT.friend.kupa[2])] })
  eq(r, [2, false], 'the next one says no step again')
  await done(pg)

  head('the dragonfly: learning, after a scroll of Home')
  pg = await boot({ state: FULL })
  r = await pg.evaluate(async () => { navigateTo('home'); const s = document.getElementById('screen-home'); s.scrollTop = 0; await new Promise(r => setTimeout(r, 100)); worldOnDone('learn'); const q = Q(); lkr.lastReact = 0; wg.settledAt = 0; lokiReactTick(); const before = wg.last
    s.scrollTop = 220; await new Promise(r => setTimeout(r, 100)); lkr.lastReact = 0; lokiReactTick(); const still = wg.last
    await new Promise(r => setTimeout(r, 1700)); lokiReactTick(); return { q, before, still, after: wg.last && wg.last.g, img: !!document.querySelector('.wg-dragonfly img[src$="dragonfly-teal.png"]'), scrollable: s.scrollHeight > s.clientHeight + 40 } })
  ok(r.scrollable, 'Home is long enough to scroll')
  eq(r.q, ['dragonfly:scroll'], 'a learning task asks for the dragonfly')
  ok(r.before === null, 'it waits for a scroll')
  ok(r.still === null, 'and for the screen to be still 1.5 s after it')
  eq([r.after, r.img], ['dragonfly', true], 'then it flies in (dragonfly-teal.png)')
  await done(pg)

  head('the fireflies: people, at the day\'s end')
  pg = await boot()
  r = await pg.evaluate(() => { const id = T({ text: 'להתקשר לדייב' }); C(id); return Q() })
  eq(r, ['fireflies:summary'], 'the last open task closed, someone was part of today: the fireflies (the summary of the day)')
  r = await pg.evaluate(() => { lokiQueue = []; F(); return [wg.last.g, wg.last.ctx, !!document.querySelector('.wg-fireflies img[src$="fireflies.png"]')] })
  eq(r, ['fireflies', 'summary', true], 'they come, glowing')
  await done(pg)
  pg = await boot({ hour: 19 })
  r = await pg.evaluate(() => { const a = T({ text: 'להתקשר לדייב' }), b = T({ text: 'עוד משהו' }); C(a); lkr.rq = []; CL(); lokiSit(); return Q() })
  eq(r, ['fireflies:summary'], 'the evening by the river (lokiSit) is the summary too')
  await done(pg)

  head('reduced motion: the line only, nothing moves')
  pg = await boot({ reduced: true })
  r = await pg.evaluate(() => { worldOnDone('field'); F(); return { g: wg.last && wg.last.g, drawn: wg.last && wg.last.drawn, layer: !!document.querySelector('.wg-layer'), text: (document.querySelector('#jg-gnome .gn-t') || {}).textContent } })
  ok(r.g === 'kupa' && /קופה/.test(r.text || ''), 'the guest still comes, in words: ' + r.text)
  ok(r.drawn === false && !r.layer, 'no drawing and no motion')
  await done(pg)

  head('Loki out on Home: the engine in lokiTick, his line beside him')
  pg = null
  for (let i = 0; i < 8 && !pg; i++) { const p = await boot({ roam: true, state: seededState() }); if (await p.evaluate(() => { lokiLifeSync(); return lkr.geo.vines.some(v => v.key === 'nook>flow') })) pg = p; else await p.context().close() }
  if (!pg) ok(false, 'no way out for him in eight tries')
  else {
    await pg.evaluate(async () => { CL(); await lokiWalkNow('flow') }); await pg.waitForFunction(() => lkr.state === 'perched', null, { timeout: 60000 })
    r = await pg.evaluate(async () => { lkr.lastReact = 0; wg.settledAt = 0; worldQueue('kupa', 'field', ''); clearTimeout(lkr.rqT)   // only lokiTick may bring it now
      for (let i = 0; i < 40 && !wg.last; i++) await new Promise(r => setTimeout(r, 100))
      return { state: lkr.state, g: wg.last && wg.last.g, say: (document.querySelector('#lk-roam .lk-say') || {}).textContent, card: lokiQueue.length } })
    ok(r.g === 'kupa', 'out on a perch, the waiting guest is brought by lokiTick (worldTick), not by a timer')
    ok(/קופה/.test(r.say || '') && r.card === 0, 'he says it beside him: ' + r.say)
    await done(pg)
  }

  head('nothing left running')
  pg = await boot()
  r = await pg.evaluate(() => { navigateTo('tasks'); worldOnDone('field'); const x = lkr.rq.find(q => q.evt === 'guest'); const wait = x.exp - Date.now(); x.exp = Date.now() - 1; lokiReactTick(); return { wait, left: lkr.rq.length } })
  ok(r.wait > 299000 && r.wait <= 300000, 'a guest waits five minutes at most (' + Math.round(r.wait / 1000) + ' s)')
  eq(r.left, 0, 'after that it is gone from the queue, and the queue stops (no timer is set)')
  r = await pg.evaluate(() => { navigateTo('home'); worldOnDone('field'); F(); navigateTo('tasks'); return !!document.querySelector('.wg-layer') })
  ok(!r, 'leaving Home takes the drawing away at once')
  await done(pg)

  head('the field journal')
  pg = await boot()
  r = await pg.evaluate(() => { gameShowJourney(); const j = document.querySelector('.gm-sheet .wg-journal'); return { empty: WORLD_TXT.empty, h: j && j.querySelector('.gm-h2').textContent, txt: j && j.textContent, rows: j ? j.querySelectorAll('.wg-row').length : 0, dim: j ? j.querySelectorAll('.wg-dim').length : 0 } })
  ok(r.h === 'יומן שטח' && r.rows === 3 && r.dim === 3, 'in the journey\'s sheet: three creatures, none met yet')
  ok(r.txt.includes(r.empty) && r.txt.includes('עוד ביקור אחד עד הצעד הבא'), 'an empty journal says so kindly; the next step is one visit away')
  r = await pg.evaluate(() => { closeModal(); const w = W(); w.met = { kupa: { n: 1, first: 'a', last: 'a' }, dragonfly: { n: 2, first: 'a', last: 'a' }, fireflies: { n: 15, first: 'a', last: 'a' } }; w.log = [{ ts: Date.now(), g: 'fireflies', root: 'people', ctx: 'evening' }]; gameShowJourney(); const j = document.querySelector('.wg-journal'); return { txt: j.textContent, bars: j.querySelectorAll('.gm-bar').length, li: [...j.querySelectorAll('.wg-log li')].map(l => l.textContent) } })
  ok(['ביקור אחד', 'שני ביקורים', '15 ביקורים', '18 פגישות', 'פגישה ראשונה', 'חברים ותיקים', 'עוד ביקור אחד עד הצעד הבא'].every(s => r.txt.includes(s)), 'counts in Hebrew through gameCount (ביקור אחד, שני ביקורים, 15 ביקורים, 18 פגישות)')
  eq(r.bars, 2, 'a bar to the next step; none after the last (15)')
  ok(r.li.length === 1 && /הגחליליות · אנשים · בערב/.test(r.li[0]), 'the meeting is written down: ' + r.li[0])
  r = await pg.evaluate(() => JSON.stringify(WORLD_TXT))
  ok(!/לא עשית|פספס|נכשל|אשמ|למה לא|(^|[ '"])מת[ .]|מתה|נעלם|עזב|איבד/.test(r), 'no blaming word, nothing dies, leaves or is lost in the words')
  ok(!/[A-Za-z]{3,}/.test(r.replace(/"[A-Za-z]+":/g, '')), 'every line in Hebrew')
  r = await pg.evaluate(() => gameCount(3, 'task'))
  eq(r, '3 משימות', 'gameCount itself unchanged for its own kinds')
  await done(pg)

  head('world-1-fixes: Loki out, a task closed on the tasks screen (what Uri did)')
  pg = null
  for (let i = 0; i < 8 && !pg; i++) { const p = await boot({ roam: true, state: seededState() }); if (await p.evaluate(() => { lokiLifeSync(); return lkr.geo.vines.some(v => v.key === 'nook>flow') })) pg = p; else await p.context().close() }
  if (!pg) ok(false, 'no way out for him in eight tries')
  else {
    await pg.evaluate(async () => { CL(); await lokiWalkNow('flow') }); await pg.waitForFunction(() => lkr.state === 'perched', null, { timeout: 60000 })
    r = await pg.evaluate(async () => { navigateTo('tasks'); const id = T({ text: 'לבדוק משאבה' }); C(id); lokiQueue = []; const heard = lkr.lastReact, unheard = (lkr.rq.find(x => x.evt === 'guest') || { data: {} }).data.unheard
      await new Promise(r => setTimeout(r, 1500)); navigateTo('home'); const t0 = Date.now(); for (let i = 0; i < 100 && !wg.last; i++) await new Promise(r => setTimeout(r, 100))
      return { reacted: heard > 0, unheard: unheard === heard, at: wg.last ? Date.now() - t0 : null, g: wg.last && wg.last.g, where: wg.last && wg.last.where, drawn: wg.last && wg.last.drawn } })
    ok(r.reacted && r.unheard, 'his own line for the close was said while the tasks screen was in front: marked unheard')
    ok(r.g === 'kupa' && r.at !== null && r.at < 5000, 'back on Home, Kupa comes in seconds, not 45 s after the close (' + r.at + ' ms)')
    ok(r.drawn === true, 'and is drawn: a clear place is found even with Loki out beside the card')
    ok(r.where === 'beside' || r.where === 'card', 'his line is where it can be read (' + r.where + ')')
    await pg.waitForTimeout(9000)
    r = await pg.evaluate(async () => { CL(); const w = W(); w.day = { k: gardenDayKey(), n: 0, seen: {} }; lkr.rq = []; LOKI.react('taskDone'); worldQueue('kupa', 'field', ''); const x = lkr.rq.find(q => q.evt === 'guest'); wg.settledAt = 0; lokiReactTick(); return { unheard: x.data.unheard, came: !!wg.last } })
    eq(r, { unheard: 0, came: false }, 'what he said on Home in front of Uri is heard: the 45 s still hold')
    r = await pg.evaluate(() => { CL(); const a = lkr.ep.actor, keep = a.style.transform; a.style.transform = 'translateY(2000px)'; const where = worldTell(WORLD_GUESTS.kupa, 'שורה'); a.style.transform = keep; const card = (document.querySelector('#jg-gnome .gn-t') || {}).textContent; CL(); return { where, card } })
    eq(r, { where: 'card', card: 'שורה' }, 'Loki out but out of sight (or behind the nav): the line goes to his card')
    await done(pg)
  }

  head('world-1-fixes: the lab invites a guest')
  pg = await boot({ lab: true, roam: true, state: seededState() })
  r = await pg.evaluate(() => [...document.querySelectorAll('#lk-lab-panel button[data-a="guest"]')].map(b => b.dataset.v + ':' + b.textContent))
  eq(r, ['kupa:הזמן: קופה', 'dragonfly:הזמן: השפירית', 'fireflies:הזמן: הגחליליות'], 'three buttons in the lab panel, one a creature')
  r = await pg.evaluate(async () => { const out = []; const before = JSON.stringify(W()); for (const g of ['kupa', 'dragonfly', 'fireflies', 'kupa']) { CL(); document.querySelector('#lk-lab-panel button[data-v="' + g + '"]').click(); await new Promise(r => setTimeout(r, 200)); out.push(wg.last && wg.last.g) } return { out, kept: JSON.stringify(W()) === before } })
  eq(r.out, ['kupa', 'dragonfly', 'fireflies', 'kupa'], 'each comes at once, Kupa twice in a row: no day limit, no waiting for Loki or a scroll')
  ok(r.kept, 'a lab visit is not kept (no visit, no step, nothing in the journal or the day)')
  await done(pg)
  pg = await boot()
  ok(await pg.evaluate(() => { worldInvite('kupa'); return wg.last === null && !document.getElementById('lk-lab-panel') }), 'without ?loki-lab=1: no panel, and an invite does nothing')
  await done(pg)

  head('world-1-fixes: the greeting keeps its sun beside it')
  for (const W of [360, 390, 412]) for (const hour of [8, 13, 19]) {
    pg = await boot({ W, hour, state: seededState() })
    r = await pg.evaluate(() => { const el = document.querySelector('#screen-home .nh-greet'), ic = el.querySelector('svg'), rg = document.createRange(); rg.selectNodeContents(el); const tops = [...rg.getClientRects()].filter(q => q.width > 1).map(q => q.bottom); const e = el.getBoundingClientRect(), i = ic.getBoundingClientRect(); return { span: !!el.querySelector('.nh-gw'), oneLine: Math.max(...tops) - Math.min(...tops) < 4 && i.bottom <= e.top + parseFloat(getComputedStyle(el).lineHeight) + 1, fs: getComputedStyle(el).fontSize } })
    if (hour === 13) ok(r.span && r.oneLine, W + ' px, 13:00: "צהריים טובים, אורי" and its sun on one line (' + r.fs + ')')
    else ok(!r.span && r.fs === '28px', W + ' px, ' + hour + ':00: the greeting as it was (no new markup, 28px)')
    await done(pg)
  }

  head('only in the jungle, only with Loki')
  for (const theme of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme })
    r = await pg.evaluate(() => { const id = T(); C(id); navigateTo('home'); return { q: Q(), layer: !!document.querySelector('.wg-layer') } })
    eq(r, { q: [], layer: false }, theme + ': no guest')
    await done(pg)
  }
  pg = await boot({ gnome: false })
  ok(await pg.evaluate(() => { const id = T(); C(id); return Q().length === 0 }), 'Loki switched off: no guest')
  await done(pg)

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
