#!/usr/bin/env node
// Two timers (claude/timers), jungle only, on the Tasks header between the title and "+ הוסף":
// - "5 דקות, מתחילים": five minutes; at the end one line, "עוד 5" or "סיום".
// - a pomodoro: 25 work / 5 break, a 15 break after every fourth round; pause, resume, skip, stop; a phase over waits for a tap.
// - Kept as an end time in game.world.timer (no key of its own): nothing ticks while hidden, worked out on return; no push.
// - In the other themes: nothing. Reduced motion: nothing moves. No setInterval of its own.
// Run: node tests/timers.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
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
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ theme = 'jungle', reduced = false } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t]) => {
      window.__timers = []; const wrap = k => { const o = window[k]; window[k] = function (f, ms) { window.__timers.push({ k, ms, by: (new Error().stack || '').split('\n').slice(2, 4).join(' ') }); return o.apply(this, arguments) } }
      wrap('setTimeout'); wrap('setInterval')
      // the page can be told it is hidden (document.visibilityState is read through this)
      window.__hidden = false; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__hidden ? 'hidden' : 'visible' })
      if (sessionStorage.getItem('tm_seeded')) return; sessionStorage.setItem('tm_seeded', '1'); localStorage.clear()
      localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_loki_roam', '0')
      localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10))
    }, [seededState(), theme])
    await pg.goto(B); await pg.waitForTimeout(600)
    pg.lsKeys = await pg.evaluate(() => Object.keys(localStorage).sort())
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  // the timer's end brought to now, and its timeout run
  const toEnd = pg => pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() - 1; tmTick() })
  const st = pg => pg.evaluate(() => ({ t: gameGet().world.timer || null, saved: (JSON.parse(localStorage.getItem('fieldy_game_v1')).world || {}).timer || null, strip: (document.querySelector('#screen-tasks .tm-strip') || {}).textContent || '', head: (document.querySelector('#screen-tasks .tm-head') || {}).textContent || '' }))
  let pg, r

  head('the clock on the Tasks header, between the title and "+ הוסף"')
  pg = await boot()
  await pg.evaluate(() => navigateTo('tasks'))
  r = await pg.evaluate(() => { const h = document.querySelector('#screen-tasks .screen-header > div'), kids = [...h.children]; return { at: kids.findIndex(k => k.classList.contains('tm-head')), n: kids.length, txt: h.querySelector('.tm-head').textContent, strip: !!document.querySelector('.tm-strip'), home: !!document.querySelector('#screen-home .tm-head, #screen-home .tm-strip') } })
  ok(r.at === 1 && r.n === 3, 'it stands between the title and the add button')
  ok(r.txt.trim() === 'טיימרים' && !r.strip && !r.home, 'with no timer: "טיימרים", no strip (and nothing on Home)')
  await pg.click('.tm-head'); await pg.waitForTimeout(150)
  r = await pg.evaluate(() => [...document.querySelectorAll('.tm-sheet .tm-pick b')].map(b => b.textContent))
  ok(r.join('|') === '5 דקות, מתחילים|עגבנייה', 'the sheet offers both: ' + r.join(' · '))
  await done(pg)

  head('five minutes, I\'m starting')
  pg = await boot()
  await pg.evaluate(() => navigateTo('tasks')); await pg.click('.tm-head'); await pg.click('.tm-pick >> nth=0'); await pg.waitForTimeout(200)
  r = await st(pg)
  ok(r.t && r.t.kind === 'five' && Math.abs(r.t.end - Date.now() - 300000) < 5000 && r.saved && r.saved.end === r.t.end, 'it runs five minutes, kept as an end time in game.world.timer (saved)')
  ok(/^\s*(5:00|4:5\d)/.test(r.head) && /4:5\d|5:00/.test(r.strip), 'the header and the strip show the time: ' + r.head.trim())
  await pg.waitForTimeout(1300)
  ok((await st(pg)).head.trim() !== r.head.trim(), 'it ticks while the screen is in front: ' + (await st(pg)).head.trim())
  await toEnd(pg)
  r = await st(pg)
  ok(r.t.done && /חמש דקות עברו/.test(r.strip) && /עוד 5/.test(r.strip) && /סיום/.test(r.strip) && r.head.trim() === 'הסתיים', 'at the end: one line, "עוד 5" and "סיום"; the header says it ended')
  await pg.evaluate(() => [...document.querySelectorAll('.tm-strip .tm-b')].find(b => b.textContent === 'עוד 5').click())
  r = await st(pg)
  ok(r.t.kind === 'five' && !r.t.done && r.t.end > Date.now() + 290000, '"עוד 5" starts five more')
  await pg.evaluate(() => [...document.querySelectorAll('.tm-strip .tm-b')].find(b => b.textContent === 'עצור').click())
  r = await st(pg)
  ok(!r.t && !r.saved && !r.strip && r.head.trim() === 'טיימרים', '"עצור": gone, nothing kept')
  await done(pg)

  head('the pomodoro: 25 / 5, a 15 after the fourth round')
  pg = await boot()
  await pg.evaluate(() => { navigateTo('tasks'); tmStart('pomo') })
  r = await st(pg)
  ok(r.t.phase === 'work' && Math.abs(r.t.end - Date.now() - 1500000) < 5000 && /עבודה/.test(r.strip), 'work, 25 minutes')
  await pg.evaluate(() => tmPause()); await pg.waitForTimeout(1200)
  r = await st(pg)
  ok(!r.t.end && r.t.left > 1490000 && /בהשהיה/.test(r.strip) && /המשך/.test(r.strip), 'pause: the time left is kept and does not run')
  const left = r.t.left
  await pg.evaluate(() => tmResume()); r = await st(pg)
  ok(Math.abs(r.t.end - Date.now() - left) < 1500, 'resume: it goes on from there')
  const phases = []
  for (let i = 0; i < 4; i++) {
    await toEnd(pg); r = await st(pg); phases.push('work→' + r.t.round + ':' + (/15 דקות/.test(r.strip) ? 'long' : /5 דקות/.test(r.strip) ? 'short' : '?'))
    if (i < 3) { await pg.evaluate(() => [...document.querySelectorAll('.tm-strip .tm-b')].find(b => b.textContent === 'התחל הפסקה').click()); r = await st(pg); phases.push(r.t.phase); await toEnd(pg); r = await st(pg); if (!/עוד סבב עבודה/.test(r.strip)) phases.push('?'); await pg.evaluate(() => [...document.querySelectorAll('.tm-strip .tm-b')].find(b => b.textContent === 'התחל עבודה').click()) }
  }
  ok(phases.join(' ') === 'work→1:short short work→2:short short work→3:short short work→4:long', 'the rounds: ' + phases.join(' '))
  await pg.evaluate(() => tmStart('pomo', 'long')); r = await st(pg)
  ok(r.t.phase === 'long' && Math.abs(r.t.end - Date.now() - 900000) < 5000, 'the long break is 15 minutes')
  await pg.evaluate(() => { tmStop(); tmStart('pomo'); tmSkip() }); r = await st(pg)
  ok(r.t.done && r.t.round === 1 && /הפסקה של 5/.test(r.strip), '"דלג" closes the phase and offers the next')
  ok(!(await pg.evaluate(() => { const t = gameGet().world.timer; return !!t.end })), 'a phase over waits for a tap: nothing starts on its own')
  await done(pg)

  head('the app closed or hidden: nothing ticks, it is worked out on return')
  pg = await boot()
  await pg.evaluate(() => { navigateTo('tasks'); tmStart('five') })
  await pg.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')) })
  r = await pg.evaluate(() => { const n = __timers.length; return new Promise(res => setTimeout(() => res({ t: tmT, more: __timers.slice(n).filter(x => /tmSchedule|tmTick/.test(x.by)).length }), 2500)) })
  ok(r.t === null && r.more === 0, 'hidden: no timeout of it is pending, none is set')
  await pg.evaluate(() => { gameGet().world.timer.end = Date.now() - 60000; gameSave(); window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')) })
  r = await st(pg)
  ok(r.t.done && /חמש דקות עברו/.test(r.strip), 'back after it ended: shown as ended')
  await pg.evaluate(() => tmStart('pomo')); await pg.reload(); await pg.waitForTimeout(600); await pg.evaluate(() => navigateTo('tasks'))
  r = await st(pg)
  ok(r.t && r.t.kind === 'pomo' && !r.t.done && /עבודה/.test(r.strip), 'the app opened again: the running timer is still there')
  ok(JSON.stringify(await pg.evaluate(() => Object.keys(localStorage).sort())) === JSON.stringify(pg.lsKeys), 'no new localStorage key')
  await pg.evaluate(() => { const g = JSON.parse(localStorage.getItem('fieldy_game_v1')); g.world.timer = { kind: 'five', phase: 'work', end: 'x' }; localStorage.setItem('fieldy_game_v1', JSON.stringify(g)) })
  await pg.reload(); await pg.waitForTimeout(600)
  ok(await pg.evaluate(() => !gameGet().world.timer), 'a broken saved timer is dropped')
  await done(pg)

  head('the end, with the app in front: the chime (sound on) and a buzz, no push')
  pg = await boot()
  r = await pg.evaluate(() => { const fx = [], hp = []; const f0 = playFx, h0 = haptic; window.playFx = k => fx.push(k); window.haptic = k => hp.push(k); navigateTo('tasks'); tmStart('five'); hp.length = 0; const t = gameGet().world.timer; t.end = Date.now() - 1; tmTick(); window.playFx = f0; window.haptic = h0; return { fx, hp, notif: typeof Notification !== 'undefined' ? Notification.permission : 'none' } })
  ok(r.fx.join() === 'save' && r.hp.join() === 'light' && r.notif !== 'granted', 'one chime, one light buzz; no notification asked')
  await done(pg)

  head('reduced motion')
  pg = await boot({ reduced: true })
  await pg.evaluate(() => { navigateTo('tasks'); tmStart('pomo') })
  r = await pg.evaluate(() => ({ an: document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.tm-strip, .tm-head')).length, tr: getComputedStyle(document.querySelector('.tm-bar i')).transitionDuration }))
  ok(r.an === 0 && /^0s/.test(r.tr), 'nothing moves in the strip or the header (only the numbers change)')
  await done(pg)

  head('the other themes: no timer')
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: th })
    r = await pg.evaluate(() => { navigateTo('tasks'); const a = !!document.querySelector('.tm-head, .tm-strip'); showTimers(); const b = !!document.querySelector('.tm-sheet'); tmStart('five'); return { a, b, t: !!gameGet().world.timer } })
    ok(!r.a && !r.b && !r.t, th + ': no clock, no sheet, nothing starts')
    await done(pg)
  }

  head('timers')
  const count = async act => { const pg = await boot(); await pg.evaluate(act); await pg.waitForTimeout(800); const t = await pg.evaluate(() => window.__timers); await pg.context().close(); return t }
  const a = await count(() => navigateTo('tasks')), b = await count(() => { navigateTo('tasks'); tmStart('pomo'); navigateTo('home') })
  ok(a.filter(x => x.k === 'setInterval').map(x => x.ms).join() === b.filter(x => x.k === 'setInterval').map(x => x.ms).join(), 'no setInterval of its own: the same ones with and without a timer')
  pg = await boot()
  r = await pg.evaluate(() => { navigateTo('tasks'); tmStart('pomo'); navigateTo('home'); const n = __timers.length; return new Promise(res => setTimeout(() => res(__timers.slice(n).filter(x => /tmSchedule|tmTick/.test(x.by)).map(x => x.ms)), 2500)) })
  ok(r.filter(ms => ms <= 1100).length === 0 && r.length <= 1, 'off its screen it waits for the end with one timeout, not a tick a second')
  await done(pg)

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
