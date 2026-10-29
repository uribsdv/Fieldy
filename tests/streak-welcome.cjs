#!/usr/bin/env node
// One streak, and a welcome back (claude/streak-welcome-back), jungle only:
// - In the jungle the forgiving streak (gameStreakNow) is what is shown and spoken of, everywhere state.streak used to be: the date line
//   on Home, Loki's long-streak moment, his "day N in a row" fact, the story chapter a streak opens. state.streak itself is untouched.
// - In the other themes the date line still shows state.streak, as in main.
// - After three days or more with the app closed: one warm line in his card, once for the return (not after two days), no count of
//   days; with reduced motion he stands still and it is text only; no new timer.
// Run: node tests/streak-welcome.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
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
const DAY = 86400000
// a time `days` calendar days before today, at noon
const daysAgo = days => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days); return +d }
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  // away: the last time the app was in front of him (ms), or 0 for a first visit
  async function boot({ theme = 'jungle', hour = 9, reduced = false, away = 0 } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t, away]) => {
      // every timer set, with the function that set it
      window.__timers = []; const wrap = k => { const o = window[k]; window[k] = function (f, ms) { window.__timers.push({ k, ms, by: (new Error().stack || '').split('\n').slice(2, 4).join(' ') }); return o.apply(this, arguments) } }
      wrap('setTimeout'); wrap('setInterval')
      if (sessionStorage.getItem('sw_seeded')) return; sessionStorage.setItem('sw_seeded', '1'); localStorage.clear()
      localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_loki_roam', '0')
      localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10))
      if (away) localStorage.setItem('fieldy_loki_v1', JSON.stringify({ v: 1, bag: {}, last: {}, hardAt: 0, hardDays: {}, hugs: 0, firstDay: '2026-01-01', lastSeen: away }))
    }, [seededState(), theme, away])
    await pg.goto(B + '?gnomeHour=' + hour); await pg.waitForTimeout(700)
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  // the two streaks made to disagree: strict (state.streak) and forgiving (game.streak, last good day yesterday)
  const split = (pg, strict, forgiving) => pg.evaluate(([a, b]) => { state.streak = a; state.lastStreakDate = getTodayPlus(-1); const g = gameGet(); g.streak = { n: b, last: gardenDayKey(new Date(Date.now() - 86400000)) }; renderCurrentScreen() }, [strict, forgiving])
  let pg, r

  head('the jungle: the forgiving streak, everywhere')
  pg = await boot()
  await split(pg, 3, 5)
  r = await pg.evaluate(() => ({ shown: streakShown(), now: gameStreakNow(), strict: state.streak, date: document.querySelector('.nh-date').textContent }))
  ok(r.shown === 5 && r.now === 5 && r.strict === 3, 'streakShown() is the forgiving one (5), state.streak stays as it is (3)')
  ok(/5/.test(r.date) && !/\b3\b/.test(r.date), 'the date line on Home: ' + r.date.trim())
  // the two main date lines (renderHome, renderHomeNachal) are not drawn in the jungle; drawn there by hand, they show the same number
  r = await pg.evaluate(() => { const el = document.getElementById('screen-home'), keep = el.innerHTML; renderHomeNachal(); const a = el.querySelector('.nh-date').textContent; el.innerHTML = keep; return a })
  ok(/5 ימים/.test(r) && !/3 ימים/.test(r), 'the river date line, drawn in the jungle, says 5 too: ' + r.trim())
  r = await pg.evaluate(() => { state.streak = 2; gameGet().streak.n = 7; loki.streakAt = 0; loki.moments = []; lokiScan(); return { at: loki.streakAt, m: (loki.moments || []).filter(x => x.k === 'streak').map(x => x.n) } })
  ok(r.at === 7 && r.m.join() === '7', "Loki's long-streak moment counts the forgiving streak (7, strict 2)")
  r = await pg.evaluate(() => { state.streak = 7; gameGet().streak.n = 2; loki.streakAt = 0; loki.moments = []; lokiScan(); return loki.streakAt })
  ok(r === 0, 'and a strict 7 alone is no moment in the jungle')
  r = await pg.evaluate(() => { state.streak = 1; gameGet().streak.n = 4; loki.factDay = ''; loki.momentAt = Date.now(); loki.firstRec = 1; const R = Math.random; Math.random = () => 0; const it = lokiRecallItem(); Math.random = R; return it && it.text })
  ok(r === 'יום ' + 'רביעי' + ' ברצף. אני מתחיל להתרגל אליך.', 'his fact names the forgiving streak: ' + r)
  r = await pg.evaluate(() => { const i = LOKI_STORY.findIndex(c => c.streak); const st = gardenStage; window.gardenStage = () => 0; state.streak = 20; gameGet().streak.n = 2; const a = lokiChapterOk(i); state.streak = 1; gameGet().streak.n = 14; const b = lokiChapterOk(i); window.gardenStage = st; return [a, b] })
  ok(r[0] === false && r[1] === true, 'the story chapter of fourteen days opens by the forgiving streak (not by a strict 20, yes by a forgiving 14)')
  r = await pg.evaluate(() => JSON.stringify(LOKI) + JSON.stringify(LOKI_WELCOME) + JSON.stringify(GAME_TXT))
  ok(!/איבדת|נשבר|(?<!לא )פספסת|שברת|איפה היית|למה לא/.test(r), 'no "you lost the streak", no blame, in his banks, the welcome or the game words')
  await done(pg)

  head('the other themes: state.streak, as in main')
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: th })
    await split(pg, 4, 9)
    r = await pg.evaluate(() => { const d = document.querySelector('#screen-home .nh-date') || [...document.querySelectorAll('#screen-home div')].find(e => /ימים|days/.test(e.textContent) && e.children.length < 4); return { shown: streakShown(), t: d ? d.textContent : '' } })
    ok(r.shown === 4 && /4 ימים/.test(r.t) && !/9 ימים/.test(r.t), th + ': the date line shows the strict streak (4): ' + (r.t.match(/[^·]*·[^\n]*/) || [r.t])[0].trim())
    await done(pg)
  }

  head('a welcome back after three days, not after two')
  pg = await boot({ away: daysAgo(2) })
  r = await pg.evaluate(() => { const t = document.querySelector('#jg-gnome .gn-t').textContent; return { kind: document.getElementById('jg-gnome').dataset.kind, w: LOKI_WELCOME.some(x => x.t === t), due: lokiWelcomeDue() } })
  ok(r.kind !== 'welcome' && !r.w && !r.due, 'two days away: no welcome (' + r.kind + ')')
  await done(pg)
  for (const [hour, part] of [[9, 'morning'], [19, 'evening']]) {
    pg = await boot({ away: daysAgo(3), hour })
    r = await pg.evaluate(() => ({ kind: document.getElementById('jg-gnome').dataset.kind, pose: document.getElementById('jg-gnome').dataset.pose, t: document.querySelector('#jg-gnome .gn-t').textContent, bank: LOKI_WELCOME }))
    const line = r.bank.find(x => x.t === r.t)
    ok(r.kind === 'welcome' && !!line, 'three days away, at ' + hour + ':00: the welcome, in his card: ' + r.t)
    ok(line && (!line.h || line.h === part), 'a line for any hour or for the ' + part + ' (' + (line && (line.h || 'any')) + ')')
    ok(!/\d/.test(r.t) && !/ימים|איפה|למה|קרה/.test(r.t), 'no count of days, no "where were you", no question about what happened')
    r = await pg.evaluate(() => ({ figs: document.querySelectorAll('#jg-gnome .gn-img').length, roam: document.querySelectorAll('.lk-roam .gn-img, .lk-peek .lk-pk').length, turtle: !!document.querySelector('#jg-gnome [data-pose="turtle"]') }))
    ok(r.figs === 1 && r.roam === 0 && !r.turtle, 'one Loki only, and not the turtle with a count of days')
    if (hour === 9) {
      r = await pg.evaluate(() => { gnNext(); const a = document.getElementById('jg-gnome').dataset.kind; navigateTo('tasks'); navigateTo('home'); const b = document.getElementById('jg-gnome').dataset.kind; lokiOpen = null; lokiRender(); const c = document.getElementById('jg-gnome').dataset.kind; return [a, b, c, lokiWelcomeDue()] })
      ok(r.slice(0, 3).every(k => k !== 'welcome') && r[3] === false, 'once: after a tap it is the regular telling, on coming back to Home and on a new opening too (' + r.slice(0, 3).join(', ') + ')')
      await pg.reload(); await pg.waitForTimeout(700)
      r = await pg.evaluate(() => ({ kind: document.getElementById('jg-gnome').dataset.kind, due: lokiWelcomeDue() }))
      ok(r.kind !== 'welcome' && !r.due, 'once: opened again, no second welcome (' + r.kind + ')')
      r = await pg.evaluate(() => { const before = lokiWelcomeDue(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); loki.lastSeen = Date.now() - 3600000; document.dispatchEvent(new Event('visibilitychange')); return [before, lokiWelcomeDue(), document.getElementById('jg-gnome').dataset.kind] })
      ok(!r[0] && !r[1] && r[2] !== 'welcome', 'back from an hour in the background: nothing again')
    }
    await done(pg)
  }
  // a return in the background after three days: the same welcome, once
  pg = await boot()
  r = await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 4); loki.lastSeen = +d; document.dispatchEvent(new Event('visibilitychange')); const a = document.getElementById('jg-gnome').dataset.kind; gnNext(); lokiOpen = null; lokiRender(); return [a, document.getElementById('jg-gnome').dataset.kind] })
  ok(r[0] === 'welcome' && r[1] !== 'welcome', 'back from four days in the background: welcomed once (' + r.join(' → ') + ')')
  await done(pg)
  // the other themes: nothing
  pg = await boot({ theme: 'nachal', away: daysAgo(5) })
  r = await pg.evaluate(() => ({ due: lokiWelcomeDue(), card: !!document.getElementById('jg-gnome'), w: LOKI_WELCOME.some(x => document.body.innerText.includes(x.t)) }))
  ok(!r.due && !r.card && !r.w, 'in the river theme: no welcome')
  await done(pg)

  head('reduced motion: text only; no new timer')
  pg = await boot({ away: daysAgo(3), reduced: true })
  r = await pg.evaluate(() => { const e = document.getElementById('jg-gnome'); return { kind: e.dataset.kind, pose: e.dataset.pose, wave: e.dataset.wave, anim: document.getAnimations().filter(a => e.contains(a.effect && a.effect.target)).length } })
  ok(r.kind === 'welcome' && r.pose === 'stand' && r.wave === '0' && r.anim === 0, 'he stands still and says it (pose ' + r.pose + ', wave ' + r.wave + ', ' + r.anim + ' animations in the card)')
  r = await pg.evaluate(() => ({ by: __timers.filter(t => /[Ww]elcome/.test(t.by)).length, src: [lokiWelcomeDue, lokiWelcomeItem].map(String).join(' ') }))
  ok(r.by === 0 && !/setTimeout|setInterval|requestAnimationFrame/.test(r.src), 'no timer is set by the welcome')
  await done(pg)
  // the same timers with a welcome as without one
  const timersOf = async away => { const p = await boot({ away }); await p.waitForTimeout(3000); const t = await p.evaluate(() => __timers.filter(x => x.k === 'setInterval').map(x => x.by.replace(/:\d+:\d+/g, '')).sort()); await done(p); return t }
  const a = await timersOf(daysAgo(3)), b = await timersOf(Date.now() - 3 * 3600000)
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same intervals are set with the welcome as without it (' + a.length + ')')

  await br.close(); srv.close(); console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); process.exit(fail ? 1 : 0)
})
