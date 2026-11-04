#!/usr/bin/env node
// The tomato on the pomodoro (claude/timers), jungle only: a fixed 170x320 box, one CSS animation of 31 steps over the 25-minute work phase,
// started from game.world.timer with a negative delay. Frame 00 at the start; frame 31 (ripe) only at the end of the work phase and through
// the break; paused with the timer; a still frame under reduced motion; the strip is fetched only when a pomodoro begins; no new localStorage key.
// Run: node tests/tomato.cjs     Exit code 0 = all checks passed, 1 = at least one failed.   ROOT=<dir> runs it against another checkout.
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
    pg.errs = []; pg.reqs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('request', q => pg.reqs.push(q.url()))
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
  const W = 25 * 60000
  // the frame shown: the strip is 170 px per frame, read from the computed background position
  const frame = pg => pg.evaluate(() => { const e = document.querySelector('#screen-tasks .tm-tom'); if (!e) return null; return Math.round(-parseFloat(getComputedStyle(e).backgroundPositionX) / 170) })
  const anim = pg => pg.evaluate(() => { const e = document.querySelector('#screen-tasks .tm-tom'); const a = e ? e.getAnimations() : []; return { n: a.length, state: a[0] && a[0].playState, t: a[0] && a[0].currentTime, dur: a[0] && a[0].effect.getTiming().duration, w: e && e.offsetWidth, h: e && e.offsetHeight } })
  const startPomo = async pg => { await pg.evaluate(() => navigateTo('tasks')); await pg.click('.tm-head'); await pg.click('.tm-pick >> nth=1'); await pg.waitForTimeout(250) }
  // the timer set to a point in its work phase, and the strip drawn again from it (as a refresh or a return does)
  const at = (pg, elapsed, extra) => pg.evaluate(([el, ex]) => { const t = gameGet().world.timer; t.end = Date.now() + (1500000 - el); Object.assign(t, ex || {}); gameSave(); renderTasks() }, [elapsed, extra])
  let pg, r

  head('frame 00 at the start of a pomodoro; a box of 170 x 320; nothing for the five minutes')
  pg = await boot()
  const lsBefore = pg.lsKeys
  r = pg.reqs.filter(u => /tomato/.test(u)); ok(r.length === 0, 'the app loads without fetching any tomato file')
  await pg.evaluate(() => navigateTo('tasks')); await pg.click('.tm-head'); await pg.click('.tm-pick >> nth=0'); await pg.waitForTimeout(250)
  ok(await frame(pg) === null && pg.reqs.filter(u => /tomato/.test(u)).length === 0, '"5 minutes": no tomato, nothing fetched')
  await pg.evaluate(() => tmStop())
  await pg.click('.tm-head'); await pg.click('.tm-pick >> nth=1'); await pg.waitForTimeout(250)
  ok(pg.reqs.filter(u => /tomato-strip\.webp/.test(u)).length >= 1, 'the strip is fetched when the pomodoro starts')
  ok(pg.reqs.filter(u => /tomato-\d\d\.webp/.test(u)).length === 0, 'the 32 single frames are never fetched')
  ok(await frame(pg) === 0, 'frame 00 at the start')
  r = await anim(pg)
  ok(r.n === 1 && r.state === 'running' && r.dur === W && r.w === 170 && r.h === 320, 'one animation, running, ' + W / 60000 + ' minutes long, on a 170x320 box (' + r.w + 'x' + r.h + ')')
  r = await pg.evaluate(() => { const e = document.querySelector('.tm-tom'), bg = getComputedStyle(e); return { img: /tomato-strip\.webp/.test(bg.backgroundImage), size: bg.backgroundSize, steps: /steps\(31/.test(bg.animationTimingFunction) } })
  ok(r.img && r.size === '5440px 320px' && r.steps, 'background is the strip (5440x320), timed in steps(31)')
  ok(JSON.stringify((await pg.evaluate(() => Object.keys(localStorage).sort()))) === JSON.stringify(lsBefore.concat(lsBefore.includes('fieldy_game_v1') ? [] : ['fieldy_game_v1']).sort()), 'no localStorage key was added by it')
  await done(pg)

  head('31 appears only at the end of the work phase')
  pg = await boot(); await startPomo(pg)
  const seen = []
  for (const el of [0, 1000, W * 0.1, W * 0.25, W * 0.5, W * 0.75, W * 0.95, W - 60000, W - 2000]) { await at(pg, el); seen.push([el, await frame(pg)]) }
  ok(seen.every(([, f]) => f >= 0 && f <= 30), 'at no moment before the end is it frame 31: ' + seen.map(x => x[1]).join(','))
  ok(seen.every(([el, f]) => f === Math.min(30, Math.floor(el / W * 31))), 'each point of the phase shows the frame it should (step ' + seen.map(x => x[1]).join(' ') + ')')
  ok(seen.map(x => x[1]).every((f, i, a) => i === 0 || f >= a[i - 1]), 'it only grows')
  await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() - 1; tmTick() }); await pg.waitForTimeout(200)
  r = await anim(pg)
  ok(await frame(pg) === 31 && r.n === 0, 'when the work phase ends: frame 31, still, no animation running')
  await pg.evaluate(() => tmStart('pomo', 'short')); await pg.waitForTimeout(200)
  ok(await frame(pg) === 31, 'through the break the ripe one stays (frame 31)')
  await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() - 1; tmTick() }); await pg.waitForTimeout(150)
  ok(await frame(pg) === 31, 'the break over, waiting for a tap: still ripe')
  await pg.evaluate(() => tmStart('pomo', 'work')); await pg.waitForTimeout(250)
  r = await anim(pg)
  ok(await frame(pg) === 0 && r.state === 'running', 'the next round starts again from frame 00')
  await done(pg)

  head('a refresh or a return in the middle shows the right frame; the animation really moves')
  pg = await boot(); await startPomo(pg)
  await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() + 750000; gameSave() })
  await pg.reload(); await pg.waitForTimeout(600); await pg.evaluate(() => navigateTo('tasks')); await pg.waitForTimeout(250)
  ok(await frame(pg) === 15, 'after a reload at 12:30 elapsed: frame 15 (' + await frame(pg) + ')')
  const t1 = (await anim(pg)).t; await pg.waitForTimeout(1200); const t2 = (await anim(pg)).t
  ok(t2 - t1 > 900, 'it runs on the real clock (' + Math.round(t2 - t1) + ' ms in 1.2 s)')
  await pg.evaluate(() => navigateTo('home')); await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() + 250000; gameSave() }); await pg.evaluate(() => navigateTo('tasks')); await pg.waitForTimeout(200)
  ok(await frame(pg) === Math.floor((W - 250000) / W * 31), 'back on Tasks after time went by elsewhere: frame ' + await frame(pg))
  await pg.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')) })
  r = await anim(pg); ok(r.state === 'paused', 'the app in the background: the animation is paused')
  await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() + 100000; gameSave(); window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')) }); await pg.waitForTimeout(250)
  r = await anim(pg)
  ok(r.state === 'running' && await frame(pg) === Math.floor((W - 100000) / W * 31), 'coming back: it runs again, from the real time (frame ' + await frame(pg) + ')')
  await done(pg)

  head('stopping the pomodoro freezes the tomato')
  pg = await boot(); await startPomo(pg); await at(pg, 600000)
  await pg.evaluate(() => tmPause()); await pg.waitForTimeout(200)
  const f0 = await frame(pg); r = await anim(pg); await pg.waitForTimeout(1500); const r2 = await anim(pg)
  ok(r.state === 'paused' && r2.state === 'paused' && r.t === r2.t && f0 === Math.floor(600000 / W * 31), 'paused: same frame (' + f0 + ') and the animation clock does not move')
  await pg.evaluate(() => navigateTo('home')); await pg.evaluate(() => navigateTo('tasks')); await pg.waitForTimeout(200)
  ok(await frame(pg) === f0 && (await anim(pg)).state === 'paused', 'leaving and coming back: still frozen, same frame')
  await pg.evaluate(() => tmResume()); await pg.waitForTimeout(1200)
  r = await anim(pg); ok(r.state === 'running' && r.t > r2.t, 'resumed: it moves on from where it stood')
  await pg.evaluate(() => tmStop()); await pg.waitForTimeout(150)
  ok(await frame(pg) === null, 'stopped for good: no tomato')
  await done(pg)

  head('reduced motion: a still frame, changed by the clock\'s own update')
  pg = await boot({ reduced: true }); await startPomo(pg)
  r = await anim(pg); ok(await frame(pg) === 0 && r.n === 0, 'frame 00, no animation at all')
  await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() + 900000 + 700; gameSave(); tmSchedule() }); await pg.waitForTimeout(2300)
  r = await anim(pg); ok(r.n === 0 && await frame(pg) === Math.floor(600000 / W * 31), 'the clock\'s tick moved the still frame to ' + await frame(pg) + ' (no animation)')
  const tk = await pg.evaluate(() => new Promise(res => { const f = document.querySelector('.tm-tom'); let n = 0; new MutationObserver(() => n++).observe(f, { attributes: true }); setTimeout(() => res(n), 3200) }))
  ok(tk <= 1, 'the frame is touched at most once in 3 seconds (' + tk + '), not every second')
  await pg.evaluate(() => { const t = gameGet().world.timer; t.end = Date.now() - 1; tmTick() }); await pg.waitForTimeout(200)
  ok(await frame(pg) === 31, 'at the end of the work phase: frame 31')
  await done(pg)

  head('the older themes: no tomato, no timer, nothing fetched')
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: th }); await pg.evaluate(() => { navigateTo('tasks'); tmStart('pomo') }); await pg.waitForTimeout(300)
    r = await pg.evaluate(() => ({ tom: document.querySelectorAll('.tm-tom').length, head: document.querySelectorAll('.tm-head').length, timer: !!(gameGet().world || {}).timer }))
    ok(r.tom === 0 && r.head === 0 && !r.timer && pg.reqs.filter(u => /tomato/.test(u)).length === 0, th + ': no tomato, no clock, no timer, no request')
    await done(pg)
  }

  head('the tomato is only a progress picture: nothing else is connected to it')
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const fn = n => { const a = html.indexOf('function ' + n + '('); return html.slice(a, html.indexOf('\n}\n', a)) }
  ok(!/tm[A-Z]|tom/.test(fn('taskDone')) && !/tm[A-Z]|tom/.test(fn('completeTask') || ''), 'taskDone / completing a task does not touch it')
  ok(fs.existsSync(path.join(ROOT, 'assets/tomato/tomato-strip.webp')) && fs.readdirSync(path.join(ROOT, 'assets/tomato')).filter(f => /^tomato-\d\d\.webp$/.test(f)).length === 32, 'the pack is in the repository: strip and 32 frames')
  ok(!/tomato/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js is untouched by it')

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); await br.close(); srv.close(); process.exit(fail ? 1 : 0)
})
