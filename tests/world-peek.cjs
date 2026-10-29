#!/usr/bin/env node
// The world, stage 3 (claude/world-3-peek): Loki on the other screens, his errands down his vine on Home, and no big branch over the
// briefing card's corner.
// - The tasks, the sites, the people, the calendar: a short appearance (2-6 s), a puff in a corner of the page or a peek over a card's top
//   edge, with no walk; only for a reason (a task closed there, a site stuck a week or more, the tasks tab's number going up) or, very
//   rarely, a quiet one; one a screen a visit, one short line; not at night, the line only in reduced motion, nothing with "Loki roams"
//   off; never the Tao or Home; over nothing readable or touchable, not behind the nav, taking no press; nothing left running.
// - Home: an errand is up from the stump, the jump to his vine, a short climb down, sitting on it (facing out) for the one thing, back up,
//   onto the stump; no walk along the cards.
// - The nook's trunk has no moss lip (branch.webp is not drawn nor fetched); its top fades into the leaves.
// Run: node tests/world-peek.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
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
  async function boot({ theme = 'jungle', hour = 12, roam = true, reduced = false, gnome = true } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.reqs = []; pg.on('request', q => pg.reqs.push(q.url()))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t, roam, gnome]) => { if (sessionStorage.getItem('pk_seeded')) return; sessionStorage.setItem('pk_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t)
      localStorage.setItem('fieldy_loki_roam', roam ? '1' : '0'); if (!gnome) localStorage.setItem('fieldy_jungle_gnome', '0'); localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10)) }, [seededState(), theme, roam, gnome])
    await pg.goto(B + '?gnomeHour=' + hour); await pg.waitForTimeout(600)
    // nothing of his own going on at the start: no errand waiting, no bubble
    await pg.evaluate(() => { lkr.eq = []; clearTimeout(lkr.eqT); if (lkr.ep) lokiSnapHome(); lokiQueue = []; gnGreet = false; if (currentScreen === 'home') lokiRender() })
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  const go = (pg, s) => pg.evaluate(s => navigateTo(s), s).then(() => pg.waitForTimeout(250))
  let pg, r

  head('a task closed on the tasks screen: he answers there')
  pg = await boot()
  await go(pg, 'tasks')
  r = await pg.evaluate(async () => { const t = [...state.tasks.now, ...state.tasks.today].find(x => !x.done); toggleTask(t.id); await new Promise(r => setTimeout(r, 1600))
    const box = document.querySelector('.lk-peek .lk-pk'), say = document.querySelector('.lk-peek .lk-say'), L = document.querySelector('.lk-peek')
    return { last: pk.last, box: !!box, say: say && say.textContent, pe: L && getComputedStyle(L).pointerEvents, z: L && +getComputedStyle(L).zIndex, eq: lkr.eq.map(x => x.kind) } })
  ok(r.box && r.last && r.last.why === 'taskDone' && r.last.screen === 'tasks', 'he comes on the tasks screen (' + (r.last && r.last.kind) + ')')
  ok(!!r.say && r.say === r.last.line, 'with one short line: ' + r.say)
  ok(r.pe === 'none' && r.z < 100, 'the layer takes no press and is under the nav (z ' + r.z + ')')
  ok(!r.eq.includes('taskDone'), 'the close was answered where it happened: no errand waits on Home for it')
  ok(r.last.stay >= 2000 && r.last.stay <= 6000, 'a short appearance (' + Math.round(r.last.stay) + ' ms)')
  r = await pg.evaluate(() => { const L = pk.last, nav = document.getElementById('nav').getBoundingClientRect(); const pts = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) pts.push([L.x + L.w * (i + .5) / 4, L.y + L.h * (j + .5) / 3])
    document.querySelector('.lk-peek').style.display = 'none'; const hits = pts.map(p => document.elementFromPoint(p[0], p[1])); document.querySelector('.lk-peek').style.display = ''
    return { overNav: L.y + L.h > nav.top, bad: hits.filter(e => !e || e.closest('button,a,input,img,svg,[role="button"]') || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).length } })
  ok(!r.overNav && r.bad === 0, 'over nothing readable or touchable, and not behind the nav')
  await pg.waitForTimeout(5000)
  r = await pg.evaluate(() => ({ layer: !!document.querySelector('.lk-peek'), timers: pk.t.length }))
  eq(r, { layer: false, timers: 0 }, 'gone after it, nothing left running')
  r = await pg.evaluate(async () => { const t = [...state.tasks.now, ...state.tasks.today, ...state.tasks.later].find(x => !x.done); if (!t) return 'none'; toggleTask(t.id); await new Promise(r => setTimeout(r, 1200)); return !!document.querySelector('.lk-peek') })
  ok(r === false || r === 'none', 'one a screen a visit: a second close here, no second appearance')
  await go(pg, 'home'); await go(pg, 'tasks')
  ok(await pg.evaluate(() => lokiPeekOk()), 'a new visit to the screen may have one again')
  await done(pg)

  head('the sites: a site stuck a week or more, pointed to there')
  pg = await boot()
  r = await pg.evaluate(async () => { loki.react = {}; navigateTo('sites'); await new Promise(r => setTimeout(r, 1700)); return pk.last })
  ok(r && r.why === 'point' && r.screen === 'sites' && /Claveria Well/.test(r.line), 'he points, with the site\'s name: ' + (r && r.line))
  r = await pg.evaluate(async () => { navigateTo('home'); navigateTo('sites'); await new Promise(r => setTimeout(r, 1700)); return pk.last.screen === 'sites' && Date.now() - pk.last.at < 1500 })
  ok(r === false, 'once a day')
  await done(pg)

  head('the tasks tab\'s number goes up while another screen is in front')
  pg = await boot()
  await go(pg, 'people')
  r = await pg.evaluate(async () => { lkr.badgeLast = 0; lkr.badgeAt = 0; lokiOnBadge(3); await new Promise(r => setTimeout(r, 1500)); return { last: pk.last, eq: lkr.eq.map(x => x.kind) } })
  ok(r.last && r.last.why === 'point' && r.last.screen === 'people' && /3 משימות/.test(r.last.line), 'he points there: ' + (r.last && r.last.line))
  ok(!r.eq.includes('point'), 'and no errand for it waits on Home')
  await done(pg)

  head('a quiet peek: rare, over a card\'s top edge, no line')
  pg = await boot()
  r = await pg.evaluate(async () => { const real = Math.random; Math.random = () => 0; loki.peekQuietAt = 0; navigateTo('calendar'); await new Promise(r => setTimeout(r, 2400)); Math.random = real; return { last: pk.last, at: loki.peekQuietAt > 0 } })
  ok(r.last && r.last.why === 'quiet' && r.last.line === null && r.at, 'with nothing to say, now and then: a quiet peek (' + (r.last && r.last.kind) + ')')
  r = await pg.evaluate(async () => { const real = Math.random; Math.random = () => 0; navigateTo('people'); await new Promise(r => setTimeout(r, 2400)); Math.random = real; return pk.last.screen })
  eq(r, 'calendar', 'and not again within four hours')
  r = await pg.evaluate(async () => { const real = Math.random; Math.random = () => .9; loki.peekQuietAt = 0; navigateTo('sites'); loki.react = { field: getToday(), pkSite: getToday() }; await new Promise(r => setTimeout(r, 2400)); Math.random = real; return pk.last.screen })
  eq(r, 'calendar', 'not every visit either (one in four)')
  await done(pg)

  head('where he never comes, and when not')
  pg = await boot()
  r = await pg.evaluate(async () => { const out = {}; for (const s of ['tao', 'home', 'settings', 'input']) { navigateTo(s); out[s] = await lokiPeek('taskDone', 'x') } return out })
  eq(r, { tao: false, home: false, settings: false, input: false }, 'never the Tao, Home (his stump and vine are there) or the other screens')
  r = await pg.evaluate(async () => { navigateTo('tasks'); GN_DEBUG.hour = 23; const a = await lokiPeek('taskDone', 'x'); GN_DEBUG.hour = 4; const b = await lokiPeek('taskDone', 'x'); GN_DEBUG.hour = 12; return [a, b] })
  eq(r, [false, false], 'not at night (23:00, 04:00)')
  r = await pg.evaluate(async () => { navigateTo('home'); navigateTo('tasks'); openModal('<div>x</div>'); const a = await lokiPeek('taskDone', 'x'); closeModal(); return a })
  eq(r, false, 'not with a sheet open')
  await done(pg)
  pg = await boot({ roam: false })
  ok(await pg.evaluate(async () => { navigateTo('tasks'); return !(await lokiPeek('taskDone', 'x')) && !document.querySelector('.lk-peek') }), '"Loki roams" off: nothing')
  await done(pg)
  pg = await boot({ gnome: false })
  ok(await pg.evaluate(async () => { navigateTo('tasks'); return !(await lokiPeek('taskDone', 'x')) }), 'Loki off: nothing')
  await done(pg)
  for (const theme of ['original', 'nachal']) {
    pg = await boot({ theme })
    ok(await pg.evaluate(async () => { navigateTo('tasks'); return !(await lokiPeek('taskDone', 'x')) && !document.querySelector('.lk-peek') }), theme + ': nothing')
    await done(pg)
  }

  head('reduced motion: the line only')
  pg = await boot({ reduced: true })
  r = await pg.evaluate(async () => { navigateTo('tasks'); const a = await lokiPeek('taskDone', 'שורה'); return { a, img: !!document.querySelector('.lk-peek img'), say: (document.querySelector('.lk-peek .lk-say') || {}).textContent, drawn: pk.last.drawn } })
  eq(r, { a: true, img: false, say: 'שורה', drawn: false }, 'the line, no drawing, nothing moves')
  r = await pg.evaluate(async () => { navigateTo('home'); navigateTo('calendar'); return await lokiPeek('quiet', null) })
  eq(r, false, 'a quiet peek (no line): nothing at all')
  await done(pg)

  head('the app away or a scroll: gone at once')
  pg = await boot()
  r = await pg.evaluate(async () => { navigateTo('tasks'); await lokiPeek('taskDone', 'x'); const a = !!document.querySelector('.lk-peek'); document.getElementById('screen-tasks').dispatchEvent(new Event('scroll')); return [a, !!document.querySelector('.lk-peek'), pk.t.length] })
  eq(r, [true, false, 0], 'a scroll takes him away, no timer left')
  r = await pg.evaluate(async () => { navigateTo('home'); navigateTo('people'); await lokiPeek('taskDone', 'x'); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; return [!!document.querySelector('.lk-peek'), pk.t.length] })
  eq(r, [false, 0], 'the app away: gone, no timer left')
  await done(pg)

  head('Home: an errand down his vine')
  pg = await boot()
  r = await pg.evaluate(async () => { await lokiLoadAll(); lokiLifeSync(); const v = lokiNookVine(); if (!v) return { v: false }
    const seen = [], said = []; const show = lokiShow; lokiShow = function (ep, name, i, x, y, o) { seen.push(name + ':' + ((ep.steps[ep.si] || {}).t || '')); return show.apply(this, arguments) }
    const rs = lokiRoamSay; lokiRoamSay = function (t) { said.push(t); return rs.apply(this, arguments) }
    lkr.eq = []; lokiErrand('taskDone', {}); const t0 = Date.now(); while (Date.now() - t0 < 70000) { await new Promise(r => setTimeout(r, 250)); if (lkr.state === 'in' && seen.length > 20) break }
    lokiShow = show; lokiRoamSay = rs
    const steps = [...new Set(seen.map(s => s.split(':')[1]))], names = [...new Set(seen.map(s => s.split(':')[0]))]
    return { v: true, state: lkr.state, steps, names, said } })
  ok(r.v, 'the vine from his corner is there')
  ok(r.state === 'in', 'out and home again')
  ok(r.steps.includes('grab') && r.steps.includes('climb') && r.steps.includes('errand') && !r.steps.includes('ledge'), 'the jump to the vine, the climb, the errand on it; never over a card\'s edge (' + r.steps.join(' ') + ')')
  ok(r.names.includes('seatwave'), 'sitting on the vine he waves (sit-wave): ' + r.names.join(' '))
  ok(!r.names.includes('sitedge'), 'no sitting down on a card\'s corner')
  ok(r.said.length === 1, 'one line: ' + r.said.join(' | '))
  r = await pg.evaluate(async () => { await lokiLoadAll(); lokiLifeSync(); const v = lokiNookVine(), sp = lokiVineSpot(v, lkr.ep ? lkr.ep.seqs : await lokiLoadAll()); const O = lkr.layer.getBoundingClientRect(), nav = document.getElementById('nav').getBoundingClientRect(), e = lokiSeatExt(v.side < 0 ? -1 : 1)
    return sp && { inView: O.top + sp.y - e.t >= 56 && O.top + sp.y + e.b <= nav.top, clear: lkr.geo.clear(sp.x - e.l + LK_AIR, sp.y - e.t, sp.x + e.r - LK_AIR, sp.y + e.b), depth: sp.depth } })
  ok(r && r.inView && r.clear, 'where he sits: all of him in sight above the nav, over nothing readable or touchable (' + JSON.stringify(r) + ')')
  r = await pg.evaluate(async () => { lkr.eq = []; const sc = document.getElementById('screen-home'); sc.scrollTop = sc.scrollHeight; await new Promise(r => setTimeout(r, 400)); lokiErrand('taskDone', {}, () => { window.__card = 1 }); await new Promise(r => setTimeout(r, 1500)); const st = lkr.state; sc.scrollTop = 0; return { st, card: window.__card || 0, why: lkr.why } })
  ok(r.st === 'in' && r.card === 1, 'his vine out of sight: his card says it, as before (' + r.why + ')')
  await done(pg)

  head('no big branch over the briefing card\'s corner')
  pg = await boot()
  r = await pg.evaluate(async () => { await lokiLoadAll(); lokiLifeSync(); await new Promise(r => setTimeout(r, 600)); const v = lokiNookVine(), box = document.querySelector('#lk-roam .lk-vinebox[data-vine="' + (v && v.key) + '"]'), card = document.getElementById('jg-gnome').getBoundingClientRect()
    return { v: !!v, lips: document.querySelectorAll('#lk-roam .lk-lipbox, #lk-roam .lk-branch').length, fade: box && box.classList.contains('lk-fadetop'), mask: box && getComputedStyle(box).maskImage, top: box && Math.round(card.top - box.getBoundingClientRect().top) } })
  ok(r.v && r.lips === 0, 'the nook\'s trunk is drawn, with no moss lip')
  ok(r.fade && /gradient/.test(r.mask || ''), 'its top fades into the leaves')
  ok(r.top >= 0 && r.top <= 16, 'it ends a little over the card\'s top edge (' + r.top + ' px)')
  ok(!pg.reqs.some(u => u.includes('branch.webp')), 'branch.webp is not fetched')
  r = await pg.evaluate(() => !!document.querySelector('#jg-gnome .jgc-hoya, .jgc-hoya'))
  ok(r, 'the corner vine with its small flowers (jg-corner) is still there')
  await done(pg)

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
