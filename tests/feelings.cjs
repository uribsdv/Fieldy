#!/usr/bin/env node
// More feelings (claude/feelings-more), jungle only:
// - "עוד אפשרויות" on the mood card opens a sheet of nineteen more feelings; one chosen is logged by logMood (source 'manual', the same
//   record as the five), the sheet closes and the card shows it as the active one. getMoodPatterns and the trend take the new keys.
// - Loki answers the heavy ones with one quiet line; once a day, with no feeling logged, one soft line points at the card (never at
//   night, never on the visit of a welcome back, kept in game.world.day.seen, no key of its own).
// - In the other themes none of it is seen; reduced motion: text only; no new timer.
// Run: node tests/feelings.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
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
const MORE = ['calm', 'stressed', 'drained', 'inspired', 'stuck', 'anxious', 'connected', 'content', 'loaded', 'sick', 'angry', 'proud', 'restless', 'curious', 'lonely', 'loving', 'surprised', 'patient', 'sad']
const daysAgo = days => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days); return +d }
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  // moods: false = the seeded ones (one today); [] = none
  async function boot({ theme = 'jungle', hour = 9, reduced = false, away = 0, moods = false } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    pg.reqs = []; pg.on('request', q => pg.reqs.push(q.url()))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    const s = seededState(); if (moods) s.moods = moods
    await pg.addInitScript(([s, t, away]) => {
      window.__timers = []; const wrap = k => { const o = window[k]; window[k] = function (f, ms) { window.__timers.push({ k, ms, by: (new Error().stack || '').split('\n').slice(2, 4).join(' ') }); return o.apply(this, arguments) } }
      wrap('setTimeout'); wrap('setInterval')
      if (sessionStorage.getItem('fe_seeded')) return; sessionStorage.setItem('fe_seeded', '1'); localStorage.clear()
      localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_loki_roam', '0')
      localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10))
      localStorage.setItem('fieldy_loki_v1', JSON.stringify({ v: 1, bag: {}, last: {}, hardAt: 0, hardDays: {}, hugs: 0, firstDay: '2026-01-01', lastSeen: away || Date.now() - 60000 }))
    }, [s, theme, away])
    await pg.goto(B + '?gnomeHour=' + hour); await pg.waitForTimeout(700)
    pg.lsKeys = await pg.evaluate(() => Object.keys(localStorage).sort())
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  // every bubble of his card this visit, tapped through (kinds and texts)
  const bubbles = pg => pg.evaluate(() => { const out = []; for (let i = 0; i < 8; i++) { const el = document.getElementById('jg-gnome'); if (!el) break; out.push({ k: el.dataset.kind, pose: el.dataset.pose, wave: el.dataset.wave, t: (el.querySelector('.gn-say') || el).textContent.trim() }); gnNext() } return out })
  const ASK = await (async () => { const pg = await boot(); const a = await pg.evaluate(() => LOKI_FEEL_ASK.map(x => x.t)); await pg.context().close(); return a })()
  let pg, r

  head('the sheet opens and closes')
  pg = await boot()
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() })
  r = await pg.evaluate(() => ({ more: !!document.querySelector('.nh-mood .feel-more'), eggs: document.querySelectorAll('.nh-mood .card [onclick^="logMood"]').length }))
  ok(r.more && r.eggs === 5, 'the card keeps its five eggs and has "עוד אפשרויות"')
  ok(!pg.reqs.some(u => /feelings\//.test(u)), 'nothing of the feelings is fetched on load (no manifest, no drawing)')
  await pg.click('.feel-more'); await pg.waitForTimeout(250)
  r = await pg.evaluate(() => ({ tiles: [...document.querySelectorAll('.feel-sheet .feel-tile')].map(b => b.dataset.feel), names: [...document.querySelectorAll('.feel-sheet .feel-tile b')].map(b => b.textContent), circles: [...document.querySelectorAll('.feel-sheet .feel-art')].filter(a => getComputedStyle(a).borderRadius === '50%' && a.getBoundingClientRect().width > 40).length }))
  ok(r.tiles.join() === MORE.join(), 'the sheet has the nineteen, in order: ' + r.names.join(', '))
  ok(r.circles === 19, 'each has its slot, a circle (no drawing yet)')
  ok(pg.reqs.some(u => /feelings\/manifest\.json/.test(u)) && !pg.reqs.some(u => /feel-[a-z]+\.webp/.test(u)), 'opening it reads the manifest, and asks for no drawing it does not list')
  await pg.click('.feel-sheet .btn-primary'); await pg.waitForTimeout(150)
  ok(await pg.evaluate(() => !document.querySelector('#modal-container .feel-sheet')), 'the close button closes it')
  await done(pg)

  head('a drawing listed in the manifest is shown in its slot')
  pg = await boot()
  await pg.route('**/assets/feelings/manifest.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: ['feel-calm.webp'] }) }))
  await pg.route('**/assets/feelings/feel-calm.webp', r => r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'icon-32.png')) }))
  await pg.evaluate(() => showMoreFeelings()); await pg.waitForTimeout(400)
  r = await pg.evaluate(() => ({ calm: !!document.querySelector('.feel-tile[data-feel="calm"].has-art img'), others: document.querySelectorAll('.feel-sheet .feel-art img').length }))
  ok(r.calm && r.others === 1, 'feel-calm.webp is shown, the other eighteen stay circles')
  await done(pg)

  head('a choice is logged with its key and shown on the card')
  pg = await boot()
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() })
  const before = await pg.evaluate(() => Object.keys(state.moods[state.moods.length - 1]).sort().join())
  await pg.click('.feel-more'); await pg.waitForTimeout(200)
  await pg.click('.feel-tile[data-feel="sad"]'); await pg.waitForTimeout(250)
  r = await pg.evaluate(() => { const m = state.moods[state.moods.length - 1]; return { m, keys: Object.keys(m).sort().join(), sheet: !!document.querySelector('.feel-sheet'), chip: (document.querySelector('.nh-mood .feel-chip') || {}).textContent, cur: (getCurrentMood() || {}).mood, limit: moodLimit('sad'), saved: JSON.parse(localStorage.getItem('fieldy_v2')).moods.slice(-1)[0].mood, loki: document.getElementById('jg-gnome').textContent, banks: ['presence', 'warmth', 'simple'].flatMap(b => LOKI.mood[b]) } })
  ok(r.m.mood === 'sad' && r.m.source === 'manual' && r.saved === 'sad', 'logged as "sad", source manual, saved in state.moods')
  ok(r.keys === before, 'the record has the same fields as before: ' + r.keys)
  ok(!r.sheet && r.chip === 'עצוב' && r.cur === 'sad', 'the sheet closed and the card shows "עצוב" as the active one')
  ok(r.limit === 2, 'sad: two tasks at most ("if you like")')
  ok(r.banks.some(t => r.loki.includes(t)) && !/\?/.test(r.banks.join('')), 'Loki answers with one quiet line of his banks (no question in any of them)')
  await pg.evaluate(() => logMood('focused', 'manual'))
  ok(await pg.evaluate(() => !document.querySelector('.nh-mood .feel-chip') && getCurrentMood().mood === 'focused'), 'one of the five chosen after: the chip is gone, the egg is active')
  await done(pg)

  head('the engine takes every new key')
  pg = await boot()
  r = await pg.evaluate(keys => {
    const out = {}
    keys.forEach(k => { const d = MOOD_LIB[k]; out[k] = [d.label, d.color, d.taskLimit, d.actions.length, !!ICONS[d.icon], tr('mood_' + k) !== 'mood_' + k, !!LOKI_MOOD[k]] })
    return out
  }, MORE)
  ok(Object.values(r).every(v => v[0] && /^#[0-9A-F]{6}$/i.test(v[1]) && v[3] >= 1 && v[3] <= 3 && v[4] && v[5] && v[6]), 'each has label, color, taskLimit, 1-3 actions, an icon, a name and an answer of Loki')
  r = await pg.evaluate(() => { const L = k => MOOD_LIB[k].taskLimit; return { one: ['loaded', 'stressed', 'anxious'].every(k => L(k) === L('overwhelmed')), tired: ['drained', 'sick'].every(k => L(k) === L('tired')), sc: L('restless') === L('scattered'), none: ['calm', 'inspired', 'connected', 'content', 'proud', 'curious', 'surprised', 'loving', 'patient'].every(k => L(k) === null), two: ['stuck', 'lonely', 'sad', 'angry'].every(k => L(k) === 2 && MOOD_LIB[k].actions.every(a => /אם בא לך/.test(a))) } })
  ok(r.one && r.tired && r.sc && r.none && r.two, 'the limits as asked: like overwhelmed, like tired, like scattered, none, two with "אם בא לך"')
  // six of the new keys on the same weekday afternoon, and the trend of the last days
  r = await pg.evaluate(() => {
    const wd = new Date().getDay(), base = Date.now()
    state.moods = Array.from({ length: 6 }, (_, i) => ({ ts: base - i * 7 * 86400000, date: getTodayPlus(-7 * i), hour: 14, weekday: wd, mood: i < 4 ? 'lonely' : 'curious', source: 'manual', actions: [] }))
    const p = getMoodPatterns(); let err = ''
    try { accordionOpen['insights'] = true; renderHome(); moodTrendHtml(60) } catch (e) { err = e.message }
    return { p, err, trend: /עצוב|בודד/.test(moodTrendHtml(60)) }
  })
  ok(r.p.length === 1 && r.p[0].mood === 'lonely' && r.p[0].count === 4 && !r.err, 'getMoodPatterns finds "lonely" (4) and Home and the trend draw with no error')
  ok(r.trend, 'the trend names it')
  await done(pg)

  head('the other themes: nothing of it is seen')
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: th })
    r = await pg.evaluate(() => {
      moodPanelOpen = true; renderHome()
      const btn = !!document.querySelector('.feel-more, .feel-row, .feel-chip'); showMoreFeelings(); const sheet = !!document.querySelector('.feel-sheet')
      const n = state.moods.length; logMood('sad', 'manual'); const refused = state.moods.length === n
      // a feeling logged in the jungle, seen from here
      state.moods.push({ ts: Date.now(), date: getToday(), hour: 14, weekday: new Date().getDay(), mood: 'sad', source: 'manual', actions: [] }); renderHome()
      const html = document.getElementById('screen-home').innerHTML
      const wd = new Date().getDay(); state.moods = state.moods.concat(Array.from({ length: 5 }, (_, i) => ({ ts: 1, date: '2026-01-0' + (i + 1), hour: 14, weekday: wd, mood: 'sad', source: 'manual', actions: [] })))
      return { btn, sheet, refused, cur: getCurrentMood(), seen: /עצוב/.test(html) || /עצוב/.test(moodTrendHtml(400)), pat: getMoodPatterns().length }
    })
    ok(!r.btn && !r.sheet && r.refused && r.cur === null && !r.seen && r.pat === 0, th + ': no "עוד אפשרויות", no sheet, no new key logged, and one from the jungle is not seen (card, pattern, trend)')
    await done(pg)
  }

  head("Loki's line about the card, once a day")
  pg = await boot({ moods: [] })
  r = await bubbles(pg)
  const asks = r.filter(b => b.k === 'ask')
  ok(asks.length === 1 && ASK.some(t => asks[0].t.includes(t)), 'no feeling today, morning: one line about the card: ' + (asks[0] || {}).t)
  r = await pg.evaluate(() => ({ seen: gameGet().world.day.seen.feelAsk, k: JSON.parse(localStorage.getItem('fieldy_game_v1')).world.day.seen.feelAsk }))
  ok(r.seen === 1 && r.k === 1, 'kept in game.world.day.seen (saved in fieldy_game_v1)')
  await pg.evaluate(() => { navigateTo('tasks'); navigateTo('home') })
  ok(!(await bubbles(pg)).some(b => b.k === 'ask'), 'back to Home in the same visit: not again')
  await pg.reload(); await pg.waitForTimeout(700)
  ok(!(await bubbles(pg)).some(b => b.k === 'ask'), 'the app opened again the same day: not again')
  ok(JSON.stringify(await pg.evaluate(() => Object.keys(localStorage).sort())) === JSON.stringify(pg.lsKeys), 'no new localStorage key')
  await done(pg)

  pg = await boot({ moods: [] })
  r = await pg.evaluate(() => { const el = document.getElementById('jg-gnome'); const o = []; for (let i = 0; i < 8; i++) { o.push(document.getElementById('jg-gnome').dataset.kind); if (o[i] === 'ask') break; gnNext() } return o })
  await pg.evaluate(() => logMood('calm', 'manual'))
  ok(r.includes('ask') && !(await bubbles(pg)).some(b => b.k === 'ask'), 'a feeling chosen while it is up: the line is gone, nothing said about it')
  await done(pg)

  for (const h of [23, 2]) {
    pg = await boot({ moods: [], hour: h })
    r = await pg.evaluate(() => ({ ask: lokiOpen && lokiOpen.ask, seen: gameGet().world.day.seen.feelAsk, kind: document.getElementById('jg-gnome').dataset.kind, text: document.getElementById('jg-gnome').textContent }))
    ok(!r.ask && !r.seen && !ASK.some(t => r.text.includes(t)), h + ':00, night: no line, and the day is not used up')
    await done(pg)
  }

  pg = await boot({ moods: [], away: daysAgo(4) })
  r = await bubbles(pg)
  const seen = await pg.evaluate(() => gameGet().world.day.seen.feelAsk)
  ok(r.some(b => b.k === 'welcome') && !r.some(b => b.k === 'ask') && seen === 1, 'a welcome back after 4 days: no line that visit, and the day is skipped')
  await pg.reload(); await pg.waitForTimeout(700)
  ok(!(await bubbles(pg)).some(b => b.k === 'ask'), '... nor later the same day')
  await done(pg)

  pg = await boot()   // the seeded state has a feeling logged today
  ok(!(await bubbles(pg)).some(b => b.k === 'ask'), 'a feeling already logged today: no line')
  await done(pg)

  pg = await boot({ moods: [], hour: 18 })
  r = (await bubbles(pg)).filter(b => b.k === 'ask')
  ok(r.length === 1 && ASK.slice(0, 2).concat(ASK.slice(6)).some(t => r[0].t.includes(t)), 'evening: a line from the general or the evening ones: ' + (r[0] || {}).t)
  await done(pg)

  head('reduced motion: text only')
  pg = await boot({ moods: [], reduced: true })
  r = (await bubbles(pg)).filter(b => b.k === 'ask')
  const anim = await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#jg-gnome')).length)
  ok(r.length === 1 && r[0].pose === 'stand' && r[0].wave === '0' && anim === 0, 'the line is there, he stands still (no wave, nothing running in his card)')
  await pg.evaluate(() => showMoreFeelings()); await pg.waitForTimeout(100)
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#modal-container .modal')).animationName === 'none'), 'the sheet comes up with no motion')
  await done(pg)

  head('no new timer')
  const timers = async (moods, act) => {
    const pg = await boot({ moods })
    await pg.evaluate(act)
    await pg.waitForTimeout(600)
    const t = await pg.evaluate(() => window.__timers)
    await pg.context().close()
    return { iv: t.filter(x => x.k === 'setInterval').map(x => x.ms).sort().join(), mine: t.filter(x => /feelArt|MoreFeel|FeelAsk|feelMore|pickMore/.test(x.by)).length }
  }
  const off = await timers(false, () => { moodPanelOpen = true; renderHome() })
  const on = await timers([], () => { moodPanelOpen = true; renderHome(); showMoreFeelings(); closeModal(); showMoreFeelings(); pickMoreFeeling('stuck') })
  ok(on.iv === off.iv, 'the same setInterval calls with and without it: [' + on.iv + ']')
  ok(on.mine === 0, 'no setTimeout set by any of it')
  await done(await boot())

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
