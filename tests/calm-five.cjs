#!/usr/bin/env node
// The quiet answer to a close, and five minutes (claude/calm-reward-five), the jungle only.
// - One answer that can be seen for each close, by what matters most (the day closed or a rare find, a word from the journey,
//   Loki's line), and the whisper only when nobody else answered: one short line by the task, no Loki, no sound, a fade (none in
//   reduced motion), not after a close less than ten seconds after the one before; every line of its round once.
// - In the jungle sound starts off until it is turned on, and the completion ring is not drawn.
// - "Just 5 minutes": the end is at + 5 minutes by the clock; one timer while the app is in front, none while it is away, the end
//   seen when it is back; three equal buttons at the end; Loki on his stump with one line, going nowhere; no push, no sound.
// - His breathing in his corner does not tick while the app is away, and comes back when it is in front.
// - The other themes: nothing of it. No new localStorage key.
// Run: node tests/calm-five.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// ROOT=<dir> runs it against another checkout (default: this repository).
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const snap = fs.readFileSync(path.join(__dirname, 'snapshots.cjs'), 'utf8')
const seededState = new Function(snap.slice(snap.indexOf('function todayPlus'), snap.indexOf('// Each scene')) + '\nreturn seededState')()
// the localStorage keys the app already knew before this branch (every 'fieldy_…' written in main's page)
let KNOWN = null
try { KNOWN = new Set(execSync('git show origin/main:index.html', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }).match(/fieldy_[a-z0-9_]+/g)) } catch (e) {}
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else fail++; console.log('  ' + (c ? '✓ ' : '✕ ') + m) }
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')')) }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ theme = 'jungle', hour = 12, roam = true, reduced = false, gnome = true, screen = 'home' } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) && !/sw\.js$/.test(r.request().url()) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t, roam, gnome]) => {
      // nothing may ask for a notification, a push or a sound in the five minutes (counted here)
      window.__asked = { notify: 0, audio: 0 }
      try { if (window.Notification) { Notification.requestPermission = () => { __asked.notify++; return Promise.resolve('denied') } } } catch (e) {}
      try { const A = window.AudioContext; if (A) window.AudioContext = function () { __asked.audio++; return new A() } } catch (e) {}
      if (sessionStorage.getItem('cf_seeded')) return; sessionStorage.setItem('cf_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t)
      localStorage.setItem('fieldy_loki_roam', roam ? '1' : '0'); if (!gnome) localStorage.setItem('fieldy_jungle_gnome', '0'); localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10)) }, [seededState(), theme, roam, gnome])
    await pg.goto(B + '?gnomeHour=' + hour); await pg.waitForTimeout(700)
    await pg.evaluate(scr => {
      lkr.eq = []; clearTimeout(lkr.eqT); if (lkr.ep) lokiSnapHome(); lokiQueue = []; gnGreet = false; loki.peekQuietAt = Date.now()
      // helpers: the open tasks; a task written an hour ago (so it counts); what can be seen after a close
      window.OPEN = () => [...state.tasks.now, ...state.tasks.today, ...state.tasks.later].filter(t => !t.done)
      window.__n = 0
      window.T = (o = {}) => { const id = 'cf' + (++__n); state.tasks.today.unshift(Object.assign({ id, text: 'משימה ' + __n, site: null, assignee: 'uri', color: 'orange', time: '', date: '', context: null, note: null, done: false, createdAt: new Date(Date.now() - 3600e3).toISOString() }, o)); return id }
      // the garden brings nothing more today (its daily finds spent, the day already closed)
      window.QUIET = () => { const d = gardenDay(); d.rewards = GARDEN_RULES.dailyCap; d.closed = true; saveGarden() }
      window.SEEN = () => ({ whisper: [...document.querySelectorAll('.calm-w')].map(e => e.textContent), fly: !!document.querySelector('#nh-fx .nh-rw'), peek: !!document.querySelector('.lk-peek'), card: lokiQueue.filter(Boolean).map(x => x.kind) })
      if (scr !== 'home') { navigateTo(scr); if (scr === 'tasks') setTaskBucket('today') } else if (currentScreen === 'home') lokiRender()
    }, screen)
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  // a page's visibility, as the app sees it
  const away = (pg, hidden) => pg.evaluate(h => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')) }, hidden)
  // timers armed in the page from now on, by where they were armed
  const watchTimers = pg => pg.evaluate(() => { window.__tm = {}; if (window.__tmOn) return; window.__tmOn = 1; const oT = window.setTimeout, oI = window.setInterval
    const rec = k => function (f, ms, ...a) { const w = k + ((new Error().stack.split('\n')[2] || '').match(/at (\S+)/) || [0, '?'])[1]; __tm[w] = (__tm[w] || 0) + 1; return (k === 'T' ? oT : oI).call(window, f, ms, ...a) }
    window.setTimeout = rec('T'); window.setInterval = rec('I'); window.__wait = ms => new Promise(r => oT(r, ms)) })
  let pg, r

  head('the whisper: only when nobody else answered')
  pg = await boot({ gnome: false, screen: 'tasks' })
  r = await pg.evaluate(async () => { QUIET(); const id = OPEN()[0].id; toggleTask(id); await new Promise(r => setTimeout(r, 900)); const s = SEEN(), el = document.querySelector('.calm-w'), cs = el && getComputedStyle(el)
    const nav = document.getElementById('nav').getBoundingClientRect(), box = el && el.getBoundingClientRect()
    return { s, inBank: CALM_WHISPER.includes(s.whisper[0]), role: el && el.getAttribute('role'), above: !!box && box.bottom <= nav.top && box.left >= 0 && box.right <= innerWidth, anim: cs && cs.animationName, pe: cs && cs.pointerEvents, bg: cs && cs.backgroundColor, color: cs && cs.color, keyAbsent: localStorage.getItem('fieldy_sound') === null, sound: soundOn() } })
  ok(r.s.whisper.length === 1 && r.inBank, 'Loki off, nothing found, no guest: one line is whispered, from the bank: ' + r.s.whisper[0])
  ok(r.above, 'just above the nav, inside the screen')
  ok(!r.s.fly && !r.s.peek, 'and nothing else: no flight, no Loki')
  ok(r.role === 'status' && r.pe === 'none', 'read out politely, takes no press')
  ok(r.anim === 'calm-in', 'a fade (motion allowed)')
  // contrast: the pill over the brightest page there can be (white)
  r.ratio = await pg.evaluate(([bg, fg]) => { const p = s => s.match(/[\d.]+/g).map(Number); const [r1, g1, b1, a = 1] = p(bg), f = p(fg), mix = [r1, g1, b1].map(c => c * a + 255 * (1 - a))
    const L = c => { c = c.map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }; const a1 = L(f), a2 = L(mix); return (Math.max(a1, a2) + .05) / (Math.min(a1, a2) + .05) }, [r.bg, r.color])
  ok(r.ratio >= 4.5, 'its text reads at ' + r.ratio.toFixed(1) + ':1 even over white')
  ok(r.keyAbsent && r.sound === false, 'the jungle: no sound until it is turned on (and nothing was written to fieldy_sound)')
  r = await pg.evaluate(async () => { const before = (loki.calm.bag || []).length, t0 = document.querySelector('.calm-w').textContent; toggleTask(OPEN()[0].id); await new Promise(r => setTimeout(r, 300)); return { same: [...document.querySelectorAll('.calm-w')].map(e => e.textContent).join() === t0, picked: (loki.calm.bag || []).length !== before } })
  ok(r.same && !r.picked, 'a second close less than ten seconds later: no new whisper')
  await pg.waitForTimeout(4200)
  ok(await pg.evaluate(() => !document.querySelector('.calm-w')), 'gone after four seconds')
  r = await pg.evaluate(async () => { const seen = []; loki.calm = {}; for (let i = 0; i < 20; i++) { calmLast = 0; const id = T(); renderTasks(); toggleTask(id); seen.push((document.querySelector('.calm-w') || {}).textContent) } return seen })
  ok(new Set(r).size === 20 && r.every(t => t), 'a new round, twenty closes ten seconds apart: twenty different lines (every line once before any comes again)')
  r = await pg.evaluate(async () => { calmLast = 0; const ripple = []; const mo = new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => n.classList && n.classList.contains('success-ring') && ripple.push(1)))); mo.observe(document.body, { childList: true })
    window.__fx = 0; FX.complete = () => { __fx++ }; toggleTask(T()); await new Promise(r => setTimeout(r, 100)); mo.disconnect(); const a = { ripple: ripple.length, fx: __fx }
    localStorage.setItem('fieldy_sound', '1'); toggleTask(T()); const b = __fx; localStorage.removeItem('fieldy_sound'); return { a, b } })
  eq(r.a, { ripple: 0, fx: 0 }, 'a close in the jungle: no completion ring, no sound')
  ok(r.b === 1, 'turned on once, the sound is heard (it stays as it was set)')
  await done(pg)

  head('the garden answers when Loki does not')
  pg = await boot({ gnome: false, screen: 'tasks' })
  r = await pg.evaluate(async () => { const d = gardenDay(); d.rewards = 0; d.closed = true; toggleTask(OPEN()[0].id); let fly = false; for (let i = 0; i < 20 && !fly; i++) { await new Promise(r => setTimeout(r, 100)); fly = !!document.querySelector('#nh-fx .nh-rw') } return { fly, s: SEEN() } })
  ok(r.fly && r.s.whisper.length === 0, 'the first find of the day flies home, and no whisper with it')
  await done(pg)

  head('Loki answers: one answer, his')
  pg = await boot({ screen: 'tasks' })
  r = await pg.evaluate(async () => { const d = gardenDay(); d.rewards = 0; d.closed = false; d.valid = 0; toggleTask(OPEN()[0].id); await new Promise(r => setTimeout(r, 1500)); return { s: SEEN(), why: pk.last && pk.last.why, eq: lkr.eq.map(x => x.kind) } })
  ok(r.s.peek && r.why === 'taskDone', 'the tasks screen: his peek, as before')
  ok(!r.s.fly && r.s.whisper.length === 0, 'no flight and no whisper beside it (the find waits in the garden: ' + JSON.stringify(r.s) + ')')
  await pg.waitForTimeout(4500)
  r = await pg.evaluate(async () => { QUIET(); calmLast = 0; toggleTask(OPEN()[0].id); await new Promise(r => setTimeout(r, 900)); return { s: SEEN(), eq: lkr.eq.map(x => x.kind) } })
  ok(r.s.whisper.length === 1 && !r.s.peek, 'a second close on this visit (his peek already seen): the whisper')
  ok(!r.eq.includes('taskDone'), 'answered there: no errand waits on Home for it')
  await pg.evaluate(() => navigateTo('home')); await pg.waitForTimeout(300)
  r = await pg.evaluate(async () => { lkr.eq = []; clearTimeout(lkr.eqT); localStorage.setItem('fieldy_loki_roam', '0'); if (lkr.state !== 'in') lokiSnapHome(); lokiQueue = []; lokiRender(); document.querySelectorAll('.calm-w').forEach(e => e.remove()); const d = gardenDay(); d.rewards = 0; d.closed = true; calmLast = 0
    const id = T(); renderHome(); toggleTask(id); await new Promise(r => setTimeout(r, 2200)); const q = lokiQueue.filter(Boolean); return { s: SEEN(), first: q[0] && q[0].kind, label: q[0] && q[0].label, shown: (document.querySelector('#jg-gnome .gn-k') || {}).textContent } })
  ok(r.first === 'taskdone' && r.s.whisper.length === 0 && !r.s.fly, 'Home: his line in his card, no flight, no whisper' + (r.first === 'taskdone' ? '' : ' ' + JSON.stringify(r)))
  ok(/נמצא/.test(r.label || '') && r.shown === r.label, 'what the garden found is the label of his bubble: ' + r.label)
  r = await pg.evaluate(async () => { QUIET(); calmLast = 0; document.querySelectorAll('.calm-w').forEach(e => e.remove()); const g = gameGet(), k = gardenDayKey(); gameDay(k).p = GAME_RULES.dayFull - 1; gameDay(k).full = 0; lokiQueue = []; const id = T(); renderHome(); toggleTask(id); await new Promise(r => setTimeout(r, 300)); const q = lokiQueue.filter(Boolean); return { kinds: q.map(x => x.kind), s: SEEN() } })
  ok(r.kinds[0] === 'game' && !r.kinds.includes('taskdone') && r.s.whisper.length === 0, 'a word from the journey comes before his own line: ' + r.kinds.join())
  await done(pg)

  head('the night: Loki asleep, the whisper above the nav')
  pg = await boot({ hour: 23 })
  r = await pg.evaluate(async () => { QUIET(); const id = OPEN()[0].id; completeFromFocus(id); await new Promise(r => setTimeout(r, 700)); return SEEN() })
  ok(r.whisper.length === 1 && !r.card.includes('taskdone'), 'Home at 23:00: Loki asleep, one whispered line')
  await done(pg)

  head('reduced motion: the whisper does not fade, five minutes has no ring')
  pg = await boot({ gnome: false, screen: 'tasks', reduced: true })
  r = await pg.evaluate(async () => { QUIET(); toggleTask(OPEN()[0].id); return getComputedStyle(document.querySelector('.calm-w')).animationName })
  ok(r === 'none', 'the whisper appears as it is')
  r = await pg.evaluate(() => { const id = T(); renderTasks(); fiveStart(id); const box = document.querySelector('#screen-tasks .five-box'); return { ring: !!document.querySelector('.five-ring'), text: box && box.querySelector('.five-t').textContent, want: tr('five_until').replace('{t}', fiveClock(loki.five.at + FIVE.ms)) } })
  ok(!r.ring && r.text === r.want && /\d\d:\d\d/.test(r.text), 'five minutes in words: ' + r.text)
  await done(pg)

  head('five minutes: the chip, the ring, Loki beside it')
  pg = await boot()
  r = await pg.evaluate(async () => { for (let i = 0; i < 30 && !lokiSeqReady('standup'); i++) await new Promise(r => setTimeout(r, 100)); lkr.eq = []; if (lkr.ep) lokiSnapHome()
    const chip = document.querySelector('#screen-home .nh-row.first .five-chip'); const chips = document.querySelectorAll('#screen-home .five-chip').length; chip.click(); await new Promise(r => setTimeout(r, 300))
    const c = document.querySelector('#screen-home .five-ring i'), f = loki.five
    return { chips, five: !!f && typeof f.at === 'number' && Object.keys(f).sort().join(), ring: !!c, delay: c && parseFloat(c.style.animationDelay), dur: c && getComputedStyle(c).animationDuration, timing: c && getComputedStyle(c).animationName, chipsAfter: document.querySelectorAll('.five-chip').length,
      line: (document.querySelector('#jg-gnome .gn-t') || {}).textContent, stump: !!document.querySelector('#jg-gnome .on-stump'), guard: lokiLeaveGuard(), peek: lokiPeekOk(), free: lokiReactFree(), timer: !!fiveT,
      enough: !!document.querySelector('#screen-home .five-box .five-x') } })
  ok(r.chips === 1, 'one chip on Home, on the first task')
  eq(r.five, 'at,id', 'tapped: loki.five = {id, at}, kept with Loki')
  ok(r.ring && r.delay <= 0 && r.dur === '300s' && r.timing === 'five-turn', 'a ring of five minutes round the tick, set back by the time gone, a turn of transform alone (' + r.timing + ')')
  ok(r.chipsAfter === 0, 'one five minutes at a time: no other chip')
  ok(r.line === 'אני פה. רק חמש.' && r.stump, 'Loki on his stump, one line: ' + r.line)
  ok(r.guard === 'five' && r.peek === false && r.free === false, 'and he goes nowhere: no errand, no peek, no guest or topic')
  ok(r.timer && r.enough, 'one timer to the end; "enough for now" at hand')
  r = await pg.evaluate(() => { navigateTo('tasks'); const card = document.querySelector('#screen-tasks .five-host'); return { host: !!card, ring: !!document.querySelector('#screen-tasks .five-ring'), box: !!document.querySelector('#screen-tasks .five-box') } })
  eq(r, { host: true, ring: true, box: true }, 'the same five minutes on the task\'s card on the tasks screen')
  await pg.evaluate(() => navigateTo('home'))

  head('five minutes: away, and back after the end')
  await watchTimers(pg)
  await away(pg, true)
  r = await pg.evaluate(async () => { const t = fiveT; await __wait(2000); for (const k in __tm) delete __tm[k]; await __wait(6000); return { t, tm: Object.assign({}, __tm) } })
  ok(r.t === 0, 'hidden: its timer is cleared')
  eq(r.tm, {}, 'and nothing at all is armed while the app is away (six seconds watched: Loki on his stump, breathing, blinking, the five minutes)')
  await pg.evaluate(() => { loki.five.at -= 6 * 60000; lokiSave() })      // six minutes go by, by the clock
  await away(pg, false)
  r = await pg.evaluate(async () => { await __wait(300); const box = document.querySelector('#screen-home .five-end'), bs = box ? [...box.querySelectorAll('.five-acts button')] : []
    return { end: !!box, labels: bs.map(b => b.textContent), widths: bs.map(b => Math.round(b.getBoundingClientRect().width)), timer: fiveT, sit: Date.now() < lkr.sitUntil, line: lokiQueue.some(x => x && x.kind === 'five'), text: box && box.querySelector('.five-t').textContent } })
  ok(r.end && r.timer === 0, 'back: the end is seen at once, by the clock, and no timer is left')
  eq(r.labels, ['סיימתי', 'עוד 5', 'מספיק לעכשיו'], 'three buttons')
  ok(r.widths.length === 3 && Math.max(...r.widths) - Math.min(...r.widths) <= 1, 'of the same width (' + r.widths.join(', ') + ')')
  ok(!r.sit && !r.line, 'Loki up from his stump, his line let go')
  ok(!/נכשל|לא הספקת|רק |ניסיון/.test(r.text), 'no blame and nothing counted: ' + r.text)
  r = await pg.evaluate(async () => { document.querySelector('#screen-home .five-acts button:nth-child(2)').click(); const a = { at: Date.now() - loki.five.at, ring: !!document.querySelector('#screen-home .five-ring'), timer: !!fiveT }
    document.querySelector('#screen-home .five-x').click(); const b = { five: !!loki.five, chip: !!document.querySelector('#screen-home .five-chip'), timer: fiveT }
    const id = OPEN()[0].id; fiveStart(id); loki.five.at -= FIVE.ms - 400; fiveArm(); await __wait(900); const end = !!document.querySelector('#screen-home .five-end')
    document.querySelector('#screen-home .five-acts button').click(); const t = [...state.tasks.now, ...state.tasks.today, ...state.tasks.later].find(x => x.id === id)
    return { a, b, end, done: !!t && t.done, five: !!loki.five } })
  ok(r.a.at < 1000 && r.a.ring && r.a.timer, '"5 more": five minutes again from now')
  eq(r.b, { five: false, chip: true, timer: 0 }, '"enough for now": let go, the chip back, no timer')
  ok(r.end, 'in front of Uri, the end comes by its own one timer')
  ok(r.done && !r.five, '"done": the task is closed (as any close), the five minutes let go')
  r = await pg.evaluate(() => { const id = OPEN()[0].id; loki.five = { id, at: Date.now() - FIVE.ms - 3 * 3600e3 }; lokiSave(); const n = fiveNow(); navigateTo('tasks'); setTaskBucket('today'); return { n, five: !!loki.five, chip: !!document.querySelector('#screen-tasks .five-chip') } })
  eq(r, { n: null, five: false, chip: true }, 'ended over two hours ago: let go quietly')
  r = await pg.evaluate(() => __asked)
  eq(r, { notify: 0, audio: 0 }, 'no notification asked for, no sound made')
  r = await pg.evaluate(k => Object.keys(localStorage).filter(x => !k.includes(x)), KNOWN ? [...KNOWN] : [])
  if (KNOWN) eq(r, [], 'no localStorage key that main did not already have')
  await done(pg)

  head('his breathing in his corner: never while the app is away')
  pg = await boot()
  await pg.evaluate(async () => { lkr.eq = []; clearTimeout(lkr.eqT); if (lkr.ep) lokiSnapHome(); localStorage.setItem('fieldy_loki_roam', '0'); for (let i = 0; i < 30 && !lokiSeqReady('idle'); i++) await new Promise(r => setTimeout(r, 100)); lokiQueue = [lokiItem('x', 'שלום', 'stand')]; gnIdx = 0; lkr.sitUntil = 0; lokiRender() })
  await watchTimers(pg)
  r = await pg.evaluate(async () => { await __wait(400); return (document.querySelector('#jg-gnome .gn-img') || {}).dataset.pose })
  ok(/^idle:/.test(r || ''), 'standing in his corner, breathing (' + r + ')')
  await away(pg, true)
  r = await pg.evaluate(async () => { await __wait(2000); for (const k in __tm) delete __tm[k]; const p0 = document.querySelector('#jg-gnome .gn-img').dataset.pose; await __wait(7000); return { tm: Object.assign({}, __tm), same: document.querySelector('#jg-gnome .gn-img').dataset.pose === p0 } })
  eq(r.tm, {}, 'hidden: nothing is armed again (seven seconds watched)')
  ok(r.same, 'and his frame does not change')
  await away(pg, false)
  r = await pg.evaluate(async () => { const p0 = document.querySelector('#jg-gnome .gn-img').dataset.pose; await __wait(2200); const p1 = document.querySelector('#jg-gnome .gn-img').dataset.pose; return { p0, p1, timers: Object.keys(__tm).filter(k => /br|lokiIdleNext/.test(k)).length } })
  ok(r.p0 !== r.p1 && r.timers > 0, 'back: breathing again, at its pace (' + r.p0 + ' → ' + r.p1 + ')')
  await done(pg)

  head('the other themes: nothing of it')
  for (const theme of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme })
    r = await pg.evaluate(async () => { navigateTo('home'); const h = document.querySelectorAll('.five-chip,.five-box,.five-ring,.calm-w').length; navigateTo('tasks'); const t = document.querySelectorAll('.five-chip,.five-box,.five-ring,.calm-w').length
      const ripple = []; const mo = new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => n.classList && n.classList.contains('success-ring') && ripple.push(1)))); mo.observe(document.body, { childList: true })
      window.__fx = 0; FX.complete = () => { __fx++ }; toggleTask(OPEN()[0].id); await new Promise(r => setTimeout(r, 1200)); mo.disconnect()
      return { h, t, whisper: document.querySelectorAll('.calm-w').length, ripple: ripple.length, fx: __fx, sound: soundOn(), key: localStorage.getItem('fieldy_sound') } })
    eq([r.h, r.t, r.whisper], [0, 0, 0], theme + ': no chip, no ring, no whisper')
    ok(r.ripple === 1 && r.fx === 1 && r.sound && r.key === null, theme + ': its completion ring and its sound, on by default, as before')
    await done(pg)
  }

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
