#!/usr/bin/env node
// The journey (stage A, jungle): drops by difficulty and giving to Loki, good and full days, the full week, the forgiving
// streak, difficulty 1/2/4/8, the four roots, the 12 achievements, the six scrolls, side quests (gym, meditation, "my why"),
// the opening walk, and fieldy_game_v1 saved, loaded, migrated from what is already there and carried by the backup.
// Each part is a fresh page; the clock is fixed (page.clock.setFixedTime) wherever a day or a week matters.
// Run: node tests/game-a.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// ROOT=<dir> runs it against another checkout (default: this repository).
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const snap = fs.readFileSync(path.join(__dirname, 'snapshots.cjs'), 'utf8')
const seededState = new Function(snap.slice(snap.indexOf('function todayPlus'), snap.indexOf('// Each scene')) + '\nreturn seededState')()
const SCROLLS = [
  ['מצאתי מגילה תקועה בין שורשים.', 'כתוב בה: "הנהר לא נעלם. הוא עבר דירה."', 'נהרות לא עוברים דירה. (נכון?)'],
  ['בכפר מספרים שבלילה אחד הנהר פשוט קם והלך.', 'השאיר אחריו אבנים חלקות ושקט.', 'הזקנים כתבו מגילות, כדי שמישהו ימצא אותו.'],
  ['במגילה הזו יש מפה.', 'קווים כחולים שהולכים לשדות יבשים.', 'מישהו מביא מים למקומות שהנהר שכח.'],
  ['גיליתי משהו: נהר לא מחפש ים.', 'הוא מחפש את מי שצריך אותו.', 'ככה כתוב, באותיות העקומות של סבתא-רבתא.'],
  ['המגילה הזו רטובה. אולי הנהר עבר פה.', 'אולי בכיתי קצת. (לא בכיתי.)', 'כתוב: "כשתמצא את הנהר, הוא לא יהיה מים."'],
  ['המגילה האחרונה. אין בה מילים, רק ציור:', 'מישהו הולך בשדה, ואחריו הכול ירוק.', 'עכשיו אני מבין. הנהר עבר אליך, אורי. אתה הנהר החדש. אני רק שומר על הגדה.']]
const SCROLL_NAMES = ['מגילה ראשונה', 'מגילה שנייה', 'מגילה שלישית', 'מגילה רביעית', 'מגילה חמישית', 'מגילה שישית']
const EMPTY = { tasks: { now: [], today: [], later: [] }, sites: [], people: [], events: [], moods: [], personal: { gymLog: {}, meditationLog: {} } }
const KNOWN = { v: 1, onboard: { done: true } }          // a journey already under way: no opening walk
let pass = 0, fail = 0, part = ''
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✕ [' + part + '] ' + m) } }
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'))
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
// local noon of a day, so a day key never slips across midnight
const at = (k, h = 12) => new Date(k + 'T' + String(h).padStart(2, '0') + ':00:00')
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ theme = 'jungle', state = EMPTY, game = KNOWN, garden = null, loki = null, day = '2026-10-27' } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    if (day) await pg.clock.setFixedTime(at(day))
    // seeded before the app's own scripts run, once a tab (a reload keeps what the app saved)
    await pg.addInitScript(([s, t, g, gd, lk]) => { if (sessionStorage.getItem('gt_seeded')) return; sessionStorage.setItem('gt_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t)
      if (g) localStorage.setItem('fieldy_game_v1', JSON.stringify(g)); if (gd) localStorage.setItem('fieldy_garden_v1', JSON.stringify(gd)); if (lk) localStorage.setItem('fieldy_loki_v1', JSON.stringify(lk)) }, [state, theme, game, garden, loki])
    await pg.goto(B + '?gnomeHour=12'); await pg.waitForTimeout(500)
    // helpers in the page: a task written an hour ago (so it counts), closed through the app's own toggleTask
    await pg.evaluate(() => {
      window.__n = 0
      window.T = (o = {}) => { const id = 'gt' + (++__n); state.tasks.today.push(Object.assign({ id, text: 'משימה ' + __n, site: null, assignee: 'uri', color: 'orange', time: '', date: '', context: null, note: null, done: false, createdAt: new Date(Date.now() - 3600e3).toISOString() }, o)); return id }
      window.C = id => toggleTask(id)
      window.G = () => gameGet()
    })
    return pg
  }
  const day = (pg, k, h) => pg.clock.setFixedTime(at(k, h))
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  let pg, r

  part = 'difficulty 1/2/4/8'
  pg = await boot()
  r = await pg.evaluate(() => ({ diff: GAME_DIFF, names: GAME_TXT.diff,
    site: gameSuggest({ context: 'site' }), red: gameSuggest({ color: 'red' }), phone: gameSuggest({ context: 'phone', color: 'orange' }), redPhone: gameSuggest({ context: 'phone', color: 'red' }), plain: gameSuggest({ color: 'orange' }),
    stuck: gameSuggest({ site: 'S', color: 'green' }, state.sites.push({ name: 'S', stuckSince: Date.now() - 9e8, status: 'open' })) }))
  eq(r.diff, [1, 2, 4, 8], 'four difficulties worth 1/2/4/8 drops')
  eq(r.names, { 1: 'קל', 2: 'בינוני', 4: 'קשה', 8: 'אגדי' }, 'their names')
  eq([r.site, r.red, r.stuck, r.phone, r.redPhone, r.plain], [4, 4, 4, 1, 4, 2], 'Loki suggests: hard for the field, red or a stuck site; easy for a call; medium otherwise')
  ok(await pg.evaluate(() => [{ context: 'site' }, { context: 'phone' }, {}, { color: 'red' }].every(t => gameSuggest(t) !== 8)), 'legendary is never suggested, only chosen by hand')
  r = await pg.evaluate(() => { const id = T({ context: 'phone' }); const a = gameDiffOf(gameTasks().find(t => t.id === id)); gameSetDiff(id, 8); const b = gameDiffOf(gameTasks().find(t => t.id === id)); gameSetDiff(id, 3); return [a, b, G().diff[id]] })
  eq(r, [1, 8, 8], 'chosen by hand it holds; a value outside 1/2/4/8 is refused')
  await pg.evaluate(() => { navigateTo('tasks'); setTaskBucket('today') }); await pg.waitForTimeout(150)
  ok(await pg.locator('.gm-diff').count() > 0, 'the tag is on the task card in the jungle')
  await pg.locator('.gm-diff').first().click(); await pg.waitForTimeout(150)
  ok(await pg.locator('.gm-pick .gm-opt').count() === 4, 'tapping it offers the four')
  await done(pg)
  pg = await boot({ theme: 'original' })
  await pg.evaluate(() => { T(); navigateTo('tasks'); setTaskBucket('today') }); await pg.waitForTimeout(150)
  ok(await pg.locator('.gm-diff').count() === 0, 'no tag in an old theme')
  await done(pg)

  part = 'drops and giving to Loki'
  pg = await boot()
  r = await pg.evaluate(() => { const w = []; [1, 2].forEach(d => { const id = T(); gameSetDiff(id, d); C(id); w.push(G().wallet) }); return w })
  eq(r, [1, 3], 'a closed task pays its difficulty (1, then 2)')
  r = await pg.evaluate(() => { const id = 'gt' + 1; C(id); const a = G().wallet; C(id); return [a, G().wallet, G().total] })
  eq(r, [3, 3, 2], 'unticked: nothing taken back; ticked again: not paid twice, not counted twice')
  r = await pg.evaluate(() => { const id = T({ createdAt: new Date().toISOString() }); C(id); return [G().wallet, G().total, G().days[gardenDayKey()].n, G().days[gardenDayKey()].p] })
  eq(r, [3, 3, 3, 2], 'closed within 20s of being written: counted as a task, no drops')
  r = await pg.evaluate(() => { const g = G(); g.byDiff = { 1: 0, 2: 0, 4: 0, 8: 0 }; [4, 8].forEach(d => { const id = T(); gameSetDiff(id, d); C(id) }); return g.byDiff })
  eq(r, { 1: 0, 2: 0, 4: 1, 8: 1 }, 'each difficulty counted on its own')
  r = await pg.evaluate(() => { const g = G(); g.wallet = 10; loki.drops = 2; loki.water = 0; lokiGive(); const a = [g.wallet, loki.drops, loki.water]; g.wallet = 10; loki.drops = 7; lokiGive(); return a.concat([g.wallet, loki.drops, loki.water]) })
  eq(r, [8, 0, 2, 7, 4, 5], '"give to Loki": 3 a tap at most, never more than his own count of tasks closed')
  r = await pg.evaluate(() => { const g = G(); g.wallet = 0; loki.drops = 5; return gameCanGive() })
  ok(r === false, 'nothing to give with an empty wallet')
  r = await pg.evaluate(() => { const g = G(); g.wallet = 12; navigateTo('home'); return (document.querySelector('.gm-chip b') || {}).textContent })
  eq(r, '12', 'the wallet is on the Home chip')
  await done(pg)

  part = 'good day and full day'
  pg = await boot()
  r = await pg.evaluate(() => { const k = gardenDayKey(); C(T()); const d = G().days[k]; return [d.n, !!d.full, G().wallet] })
  eq(r, [1, false, 2], 'one task: a good day, not full')
  r = await pg.evaluate(() => { gameShowJourney(); return document.querySelector('.gm-day b').textContent })
  eq(r, 'יום טוב · 1 משימות', 'the sheet calls it a good day')
  r = await pg.evaluate(() => { closeModal(); C(T()); C(T()); const d = G().days[gardenDayKey()]; return [d.p, !!d.full, G().wallet, lokiQueue.some(x => x && x.text === GAME_TXT.say.dayFull)] })
  eq(r, [3, true, 2 * 3 + 3, true], 'three tasks: a full day, +3 bonus, and he says so')
  r = await pg.evaluate(() => { C(T()); return G().wallet })
  eq(r, 2 * 4 + 3, 'a fourth task: its drops only, the bonus once a day')
  r = await pg.evaluate(() => { gameShowJourney(); return document.querySelector('.gm-day b').textContent })
  eq(r, 'יום מלא', 'the sheet calls it a full day')
  await done(pg)

  part = 'full week'
  pg = await boot({ day: '2026-11-01' })        // a Sunday: the week runs Sunday to Saturday
  const fullDay = p => p.evaluate(() => { lokiQueue = []; C(T()); C(T()); C(T()); return { w: G().wallet, weeks: Object.keys(G().weeks).length, info: gameWeekInfo(), said: lokiQueue.filter(x => x && x.text === GAME_TXT.say.weekFull).length } })
  const ws = []
  for (const k of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']) { await day(pg, k); ws.push(await fullDay(pg)) }
  eq(ws.map(x => x.info.full), [1, 2, 3, 4, 5], 'five full days counted in the week')
  eq(ws.map(x => x.weeks), [0, 0, 0, 0, 1], 'the week is full on the fifth')
  eq(ws.map(x => x.w), [9, 18, 27, 36, 55], 'each full day 6+3; the fifth also +10 for the week')
  await day(pg, '2026-11-06'); r = await fullDay(pg)
  eq(r.w, 64, 'a sixth full day: no second week bonus')
  eq(ws.map(x => x.said).concat(r.said), [0, 0, 0, 0, 1, 0], 'he says "a full week" once, on the fifth')
  await day(pg, '2026-11-08'); r = await pg.evaluate(() => { ['2026-11-08', '2026-11-09', '2026-11-10'].forEach(k => { gameDay(k).off = 1 }); return gameWeekInfo().need })
  eq(r, 4, 'days marked off are not counted against the week (3 off: 4 needed)')
  r = await pg.evaluate(() => { for (let i = 8; i <= 13; i++) gameDay('2026-11-' + String(i).padStart(2, '0')).off = 1; return gameWeekInfo().need })
  eq(r, 2, 'never fewer than two')
  await done(pg)

  part = 'forgiving streak'
  pg = await boot({ day: '2026-11-02' })
  const closeOn = async k => { await day(pg, k); return pg.evaluate(() => { C(T()); return [G().streak.n, gameStreakNow()] }) }
  eq(await closeOn('2026-11-02'), [1, 0], 'one good day: not yet a streak')
  eq(await closeOn('2026-11-03'), [2, 2], 'two days in a row: 2 good days')
  eq(await closeOn('2026-11-06'), [3, 3], 'two empty days between are forgiven')
  await day(pg, '2026-11-09'); eq(await pg.evaluate(() => gameStreakNow()), 3, 'still shown after two empty days')
  await day(pg, '2026-11-10'); eq(await pg.evaluate(() => gameStreakNow()), 0, 'gone quietly after three empty days unmarked')
  eq(await closeOn('2026-11-10'), [1, 0], 'and starts again from one')
  await pg.evaluate(() => { ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].forEach((k, i) => { gameDay(k)[i % 2 ? 'rest' : 'off'] = 1 }) })
  eq(await closeOn('2026-11-15'), [2, 2], 'days marked off or rest are no gap at all')
  r = await pg.evaluate(() => { navigateTo('home'); return (document.querySelector('.gm-days') || {}).textContent || '' })
  ok(r.includes('2 ימים טובים'), 'the good days in place of the flame on the jungle Home')
  r = await pg.evaluate(() => G().returns)
  ok(r >= 1, 'coming back after two days or more is counted (for "a friend of Loki")')
  await done(pg)

  part = 'four roots'
  pg = await boot({ state: Object.assign({}, EMPTY, { people: [{ id: 1, name: 'Dave', role: 'contractor' }] }) })
  r = await pg.evaluate(() => [{ text: 'ללמוד את המשאבה', site: 'X', context: 'site' }, { text: 'a', site: 'Claveria' }, { text: 'b', context: 'site' }, { text: 'c', context: 'phone' }, { text: 'd', assignee: 'gio' }, { text: 'לדבר עם Dave' }, { text: 'e', assignee: 'uri' }, { text: 'x', note: 'course on wells' }].map(gameRoot))
  eq(r, ['learn', 'field', 'field', 'people', 'people', 'people', 'field', 'learn'], 'learning by its words, the field by a site, people by a call, someone else or a name; the field otherwise')
  r = await pg.evaluate(() => { C(T({ context: 'phone' })); C(T({ text: 'קריאה של דוח' })); C(T({ context: 'site' })); return G().roots })
  eq(r, { field: 1, people: 1, learn: 1, body: 0 }, 'a closed task grows its root')
  eq(await pg.evaluate(() => GAME_ROOTS.map(k => GAME_TXT.root[k])), ['שטח', 'אנשים', 'למידה', 'גוף ושקט'], 'the four, by name')
  r = await pg.evaluate(() => { gameShowJourney(); return document.querySelectorAll('.gm-sheet .gm-sec')[1].querySelectorAll('.gm-row').length })
  eq(r, 4, 'all four on the sheet')
  await done(pg)

  part = '12 achievements'
  pg = await boot()
  eq(await pg.evaluate(() => GAME_ACH.map(a => a.id)), ['first', 'perfect', 'week', 'friend', 'hard', 'legend', 'unstuck', 'field', 'people', 'learn', 'body', 'four'], 'twelve, in order')
  r = await pg.evaluate(() => { gameShowJourney(); return [document.querySelectorAll('.gm-ach').length, document.querySelectorAll('.gm-ach.got').length, [...document.querySelectorAll('.gm-ach .gm-n')].map(x => x.textContent)] })
  eq(r[0], 12, 'all twelve always shown'); eq(r[1], 0, 'none earned at the start')
  eq(r[2], ['0/1', '0/3', '0/5', '0/1', '0/10', '0/3', '0/1', '0/15', '0/15', '0/15', '0/15', '0/8'], 'each with how far along it is')
  // each one: just short of its mark earns nothing; at the mark it is earned once, with his line
  const ACH = [['first', { total: 0 }, { total: 1 }], ['perfect', { best: 2 }, { best: 3 }], ['friend', { returns: 0 }, { returns: 1 }], ['hard', { byDiff: { 1: 0, 2: 0, 4: 9, 8: 0 } }, { byDiff: { 1: 0, 2: 0, 4: 10, 8: 0 } }],
    ['legend', { byDiff: { 1: 0, 2: 0, 4: 0, 8: 2 } }, { byDiff: { 1: 0, 2: 0, 4: 0, 8: 3 } }], ['unstuck', { unstuck: '' }, { unstuck: 'Claveria Well' }],
    ['field', { roots: { field: 14, people: 0, learn: 0, body: 0 } }, { roots: { field: 15, people: 0, learn: 0, body: 0 } }], ['people', { roots: { field: 0, people: 14, learn: 0, body: 0 } }, { roots: { field: 0, people: 15, learn: 0, body: 0 } }],
    ['learn', { roots: { field: 0, people: 0, learn: 14, body: 0 } }, { roots: { field: 0, people: 0, learn: 15, body: 0 } }], ['body', { roots: { field: 0, people: 0, learn: 0, body: 14 } }, { roots: { field: 0, people: 0, learn: 0, body: 15 } }],
    ['four', { roots: { field: 8, people: 8, learn: 8, body: 7 } }, { roots: { field: 8, people: 8, learn: 8, body: 8 } }], ['week', { weeks: {} }, { weeks: { '2026-10-25': 1 } }]]
  for (const [id, below, atMark] of ACH) {
    r = await pg.evaluate(([id, below, atMark]) => {
      const reset = () => { game = gameFill({ v: 1, onboard: { done: true } }); return game }
      let g = reset(); Object.assign(g, below); let say = []; gameAchTick(say); const a = !!g.ach[id]
      g = reset(); Object.assign(g, atMark); say = []; gameAchTick(say); const b = !!g.ach[id], line = say.find(x => x.label === GAME_ACH.find(x => x.id === id).name)
      const say2 = []; gameAchTick(say2)
      return [a, b, !!line, say2.length, line ? line.t : '']
    }, [id, below, atMark])
    ok(!r[0] && r[1] && r[2] && r[3] === 0, id + ': not before its mark, earned at it with his line, once' + (r[4].includes('{') ? ' (unfilled: ' + r[4] + ')' : ''))
  }
  r = await pg.evaluate(() => { game = gameFill({ v: 1, onboard: { done: true }, unstuck: 'Claveria Well' }); const s = []; gameAchTick(s); return s.find(x => x.label === 'אתר שזז').t })
  ok(r.startsWith('Claveria Well היה תקוע'), '"a site that moved" names the site')
  // the real paths: the first task, a stuck site freed
  await done(pg)
  pg = await boot({ state: Object.assign({}, EMPTY, { sites: [{ id: 1, name: 'Claveria Well', status: 'open', stuckSince: Date.now() - 10 * 86400e3, createdAt: new Date(Date.now() - 20 * 86400e3).toISOString() }] }) })
  r = await pg.evaluate(() => { C(T()); return !!G().ach.first })
  ok(r, 'the first task closed earns "the first step"')
  r = await pg.evaluate(() => { gameScan(); const a = !!G().stuck['Claveria Well']; state.sites[0].status = 'resolved'; state.sites[0].stuckSince = null; gameScan(); return [a, G().unstuck, !!G().ach.unstuck] })
  eq(r, [true, 'Claveria Well', true], 'a stuck site that is freed earns "a site that moved"')
  await done(pg)

  part = 'six scrolls'
  pg = await boot()
  eq(await pg.evaluate(() => GAME_SCROLLS), [5, 20, 45, 90, 150, 250], 'opened at 5/20/45/90/150/250 tasks closed')
  r = await pg.evaluate(() => GAME_SCROLL_LINES)
  SCROLLS.forEach((w, i) => eq(r[i], w, 'scroll ' + (i + 1) + ': its three lines, word for word'))
  r = await pg.evaluate(() => { const g = G(), out = []; [4, 5, 19, 20, 44, 45, 89, 90, 149, 150, 249, 250].forEach(n => { g.total = n; const s = []; gameScrollTick(s); out.push(g.scrolls.open.length + (s.length ? '+' : '')) }); return out })
  eq(r, ['0', '1+', '1', '2+', '2', '3+', '3', '4+', '4', '5+', '5', '6+'], 'each opens at its mark, with one bubble, and only once')
  r = await pg.evaluate(() => { gameShowJourney(); return [...document.querySelectorAll('.gm-sheet .nh-chap')].map(x => x.textContent) })
  eq(r.length, 6, 'six on the sheet')
  await done(pg)
  pg = await boot({ game: { v: 1, total: 20, scrolls: { open: [0, 1], read: {} }, onboard: { done: true } } })
  r = await pg.evaluate(() => { gameShowJourney(); return [...document.querySelectorAll('.gm-sheet .gm-lock small')].map(x => x.textContent) })
  eq(r, ['עוד 25 משימות', 'עוד 70 משימות', 'עוד 130 משימות', 'עוד 230 משימות'], 'the closed ones say how many tasks are left')
  ok(await pg.evaluate(() => { navigateTo('home'); return !!document.querySelector('.gm-chip .gn-story-dot') }), 'an unread scroll puts a dot on the chip')
  await done(pg)
  // a day with open tasks (on an empty day his card shows only the empty-day line, whatever is queued: the same for Loki's story)
  pg = await boot({ state: seededState(), game: { v: 1, total: 250, scrolls: { open: [0, 1, 2, 3, 4, 5], read: {} }, onboard: { done: true } } })
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => gameShowJourney()); await pg.waitForTimeout(100)
    await pg.locator('.gm-sheet .nh-chap').nth(i).click(); await pg.waitForTimeout(200)
    r = await pg.evaluate(() => ({ q: lokiQueue.map(x => [x.kind, x.label, x.text]), home: currentScreen === 'home', sheet: !!document.querySelector('.gm-sheet'), card: (document.getElementById('jg-gnome') || {}).textContent || '' }))
    eq(r.q, SCROLLS[i].map(t => ['scroll', SCROLL_NAMES[i], t]), 'scroll ' + (i + 1) + ': told in three bubbles, in order, under its name')
    ok(r.home && !r.sheet && r.card.includes(SCROLLS[i][0]), 'scroll ' + (i + 1) + ': the sheet closes and Home shows its first line')
    ok(await pg.evaluate(j => !!G().scrolls.read[j], i), 'scroll ' + (i + 1) + ': marked read')
  }
  ok(await pg.evaluate(() => !gameUnread() && !document.querySelector('.gm-chip .gn-story-dot')), 'all read: no dot')
  await done(pg)
  pg = await boot({ game: { v: 1, total: 4, onboard: { done: true } } })
  ok(await pg.evaluate(() => { lokiQueue = []; gameReadScroll(0); return lokiQueue.length === 0 && !G().scrolls.read[0] }), 'a scroll not yet open tells nothing')
  ok(await pg.evaluate(() => { C(T()); return G().scrolls.open.join() === '0' && lokiQueue.some(x => x && x.text === GAME_TXT.say.scroll) }), 'the fifth task closed opens the first, and he says so')
  await done(pg)

  part = 'side quests'
  pg = await boot()
  r = await pg.evaluate(() => { gameSideAdd('gym'); gameSideAdd('gym'); gameSideAdd('med'); return G().side.map(q => [q.k, q.root, q.target]) })
  eq(r, [['gym', 'body', 3], ['med', 'body', 5]], 'the gym and meditation, once each, in body and calm')
  r = await pg.evaluate(() => { toggleGymToday(); const a = [G().wallet, G().roots.body]; toggleGymToday(); toggleGymToday(); return a.concat([G().wallet, G().roots.body, !!state.personal.gymLog[getToday()]]) })
  eq(r, [2, 1, 2, 1, true], "the gym through the app's own log: 2 drops and a root, once a day")
  r = await pg.evaluate(() => { toggleMeditationToday(); return [G().wallet, G().roots.body] })
  eq(r, [4, 2], "meditation through the app's own log: 2 drops")
  await done(pg)
  pg = await boot()
  r = await pg.evaluate(() => { gameSideAdd('med'); gameOnTao(119); const a = G().wallet; gameOnTao(120); return [a, G().wallet, !!G().days[gardenDayKey()].tao] })
  eq(r, [0, 2, true], 'a Tao sit of two minutes counts as meditation, a shorter one does not')
  r = await pg.evaluate(() => { gameSideAdd('walk'); gameSideAdd('read'); gameSideAdd('journal'); return G().side.length })
  eq(r, 3, 'three quests at most')
  r = await pg.evaluate(() => { const ids = G().side.map(q => q.id); ids.slice(1).forEach(id => gameSideToggle(id)); const a = G().wallet; gameGymRest(); return [a, G().wallet, G().days[gardenDayKey()].sd] })
  eq(r, [6, 6, 6], 'six drops a day at most (the rest-day drop included)')
  r = await pg.evaluate(() => { const q = G().side[1]; gameSideToggle(q.id); const a = !!(G().days[gardenDayKey()].s || {})[q.id]; gameSideToggle(q.id); return [a, G().wallet] })
  eq(r, [false, 6], 'unmarked and marked again: not paid twice')
  await done(pg)
  pg = await boot()
  r = await pg.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<input id="gm-own" value="לבשל לבד"><select id="gm-own-root"><option value="people" selected>p</option></select>'); gameSideAdd('own'); document.getElementById('gm-own').remove(); document.getElementById('gm-own-root').remove(); return G().side.map(q => [q.k, q.name, q.root]) })
  eq(r, [['own', 'לבשל לבד', 'people']], 'a quest of his own, named, in the root he picks')
  await done(pg)
  pg = await boot({ day: '2026-11-01' })
  r = await pg.evaluate(() => { gameSideAdd('walk'); const q = G().side[0]; q.target = 2; gameSideToggle(q.id); const a = G().wallet; return [a, q.id] })
  await day(pg, '2026-11-02')
  r = await pg.evaluate(id => { gameSideToggle(id); return [G().wallet, Object.keys(G().sideWeeks).length] }, r[1])
  eq(r, [2 + 2 + 5, 1], 'every quest at its weekly target: +5 for the week')
  await done(pg)

  part = '"my why"'
  pg = await boot({ day: '2026-11-01' })
  r = await pg.evaluate(() => { gameSideAdd('walk'); const q = G().side[0]; gameSideWhy(q.id, '  כדי לישון טוב  '); return [q.why, gameWhyItem()] })
  eq(r, ['כדי לישון טוב', null], 'kept (trimmed); not said before three days have gone by')
  await day(pg, '2026-11-04')
  r = await pg.evaluate(() => { const a = gameWhyItem(); return [a && a.text, gameWhyItem()] })
  eq(r, ["פעם אמרת לי: 'כדי לישון טוב'. אני רק מזכיר.", null], 'three days without the quest: quoted back once, in his words')
  await day(pg, '2026-11-11')
  ok(await pg.evaluate(() => !!gameWhyItem()), 'again after a week')
  await day(pg, '2026-11-20')
  ok(await pg.evaluate(() => { const q = G().side[0]; gameSideToggle(q.id); return gameWhyItem() === null }), 'not while the quest is being done')
  r = await pg.evaluate(() => { gameShowJourney(); return (document.querySelector('.gm-why') || {}).value })
  eq(r, 'כדי לישון טוב', 'shown in its field on the sheet')
  await done(pg)

  part = 'opening walk'
  pg = await boot({ game: null, day: null })        // the real clock: the steps count what comes after the walk began
  r = await pg.evaluate(() => [G().onboard.done, gameOnboardItem() && gameOnboardItem().text])
  eq(r, [false, 'בוא נתחיל קטן. משימה אחת, ואני כבר שמח.'], 'a new user starts the walk, with its first step')
  r = await pg.evaluate(() => { C(T({ createdAt: new Date(Date.now() + 1000).toISOString() })); return [G().onboard.steps.close, G().onboard.steps.add, gameOnboardItem().text === GAME_TXT.ob[2].say] })
  eq(r, [1, 1, true], 'a task written and closed: two steps done, the mood is next')
  r = await pg.evaluate(() => { state.moods.push({ ts: Date.now() + 1000, mood: 'good', source: 'manual' }); gameNote('garden'); return [G().onboard.steps.mood, G().onboard.steps.garden, gameOnboardItem().text === GAME_TXT.ob[4].say] })
  eq(r, [1, 1, true], 'the mood and the garden: the stump is last')
  r = await pg.evaluate(() => { lokiQueue = []; gameNote('call'); return [G().onboard.done, gameOnboardItem(), lokiQueue.some(x => x && x.text === GAME_TXT.say.obDone)] })
  eq(r, [true, null, true], 'all five: the walk is over, and he says so')
  await done(pg)
  pg = await boot({ game: null, state: seededState() })
  ok(await pg.evaluate(() => G().onboard.done === true && gameOnboardItem() === null), 'someone who already uses the app never sees the walk')
  await done(pg)

  part = 'fieldy_game_v1'
  pg = await boot()
  r = await pg.evaluate(() => { C(T()); gameSideAdd('gym'); const g = G(); g.scrolls.open = [0]; g.scrolls.read = { 0: 1 }; g.ach.first = '2026-10-27'; gameSave(); return JSON.parse(localStorage.getItem('fieldy_game_v1')) })
  ok(r && r.v === 1 && r.total === 1 && r.wallet === 2 && r.side.length === 1, 'saved in its own key, version 1')
  ok(await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('fieldy_v2')); return !('game' in s) && !JSON.stringify(s.tasks).includes('"diff"') }), 'nothing of it in state (never synced)')
  const saved = r
  await pg.reload(); await pg.waitForTimeout(400)
  r = await pg.evaluate(() => JSON.parse(JSON.stringify(gameGet())))
  eq([r.total, r.wallet, r.side.length, r.scrolls, r.ach.first, r.days], [saved.total, saved.wallet, 1, saved.scrolls, '2026-10-27', saved.days], 'loaded back as it was after a reload')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, total: '7', roots: 5, scrolls: { open: 'x' }, side: {}, days: [] })); game = null; const g = gameGet(); return [g.total, g.roots, g.scrolls, g.side, g.days, g.byDiff] })
  eq(r, [7, { field: 0, people: 0, learn: 0, body: 0 }, { open: [], read: {} }, [], {}, { 1: 0, 2: 0, 4: 0, 8: 0 }], 'a partial or broken save is filled in, never breaks a screen')
  r = await pg.evaluate(() => { localStorage.setItem('fieldy_game_v1', '{nope'); game = null; return gameGet().v })
  eq(r, 1, 'unreadable JSON: built afresh')
  await done(pg)
  // the first load built from what is already there: the garden's days, the done tasks, Loki's waiting drops; nothing lost
  const today = '2026-10-27', st = seededState()
  st.tasks.today.push({ id: 'old1', text: 'ללמוד קורס', site: null, assignee: 'uri', color: 'orange', context: null, done: true, completedAt: +at('2026-10-20') }, { id: 'old2', text: 'בשטח', site: 'Santa Cruz', assignee: 'uri', color: 'orange', context: 'site', done: true })
  const gd = { v: 1, items: {}, cairn: [], leaves: 0, days: { '2026-10-25': { valid: 3 }, '2026-10-26': { valid: 1 } }, weeks: {} }
  const lk = { v: 1, bag: {}, last: {}, hardAt: 0, hardDays: {}, hugs: 0, drops: 5, water: 4 }
  pg = await boot({ game: null, state: st, garden: gd, loki: lk, day: today })
  const before = await pg.evaluate(() => ['fieldy_v2', 'fieldy_garden_v1'].map(k => localStorage.getItem(k)))
  r = await pg.evaluate(() => JSON.parse(localStorage.getItem('fieldy_game_v1')))
  ok(!!r, 'the first load saves the journey it built')
  r = await pg.evaluate(() => { const g = G(); return { total: g.total, wallet: g.wallet, earned: g.earned, paid: Object.keys(g.paid).sort(), days: g.days, roots: g.roots, best: g.best, open: g.scrolls.open, first: !!g.ach.first, perfect: !!g.ach.perfect, ob: g.onboard.done } })
  // done tasks: n2 (today, from the seeded state), old1 (Oct 20), old2 (no date); the garden: 3 on Oct 25, 1 on Oct 26
  eq(r.paid, ['n2', 'old1', 'old2'], 'every task already done is marked paid (never paid again)')
  eq(r.total, 3 + 1 + 1 + 1 + 1, 'tasks closed in all: the garden days, the dated done tasks and the undated one')
  eq(r.days['2026-10-25'], { n: 3, p: 3, full: 1 }, "the garden's full day is a full day")
  eq([r.days['2026-10-26'].n, r.days['2026-10-20'].n, r.best], [1, 1, 3], 'the other days and the best day')
  eq([r.wallet, r.earned], [5, 5], "Loki's waiting drops start the wallet")
  eq([r.roots.learn, r.roots.field, r.roots.people], [1, 1, 1], 'roots from the done tasks (a course, a site, a task given to gio)')
  eq([r.open, r.first, r.perfect, r.ob], [[0], true, true, true], 'what is already earned opens quietly; no opening walk')
  ok(await pg.evaluate(() => lokiQueue.every(x => !x || x.kind !== 'game')), 'with no bubbles')
  const after = await pg.evaluate(() => [JSON.parse(localStorage.getItem('fieldy_garden_v1')), JSON.parse(localStorage.getItem('fieldy_loki_v1'))])
  eq([after[0].days, after[1].drops, after[1].water], [gd.days, 5, 4], 'the garden and Loki are left as they were')
  ok(JSON.parse(before[0]).tasks.today.length === st.tasks.today.length && JSON.parse(before[0]).focus === st.focus, 'state is left as it was')
  ok(await pg.evaluate(() => { C('old1'); C('old1'); return G().wallet === 5 && G().total === 7 }), 'a task done before, unticked and ticked again: not paid twice')
  await done(pg)
  // the backup carries it; an older backup without it leaves the current journey as it is
  pg = await boot()
  r = await pg.evaluate(async () => {
    C(T()); C(T()); window.alert = () => {}; window.confirm = () => true
    let blob = null; const ou = URL.createObjectURL; URL.createObjectURL = b => { blob = b; return ou.call(URL, b) }; exportBackup(); URL.createObjectURL = ou
    const txt = await blob.text(), bk = JSON.parse(txt)
    const imp = obj => new Promise(res => { importBackup(new File([JSON.stringify(obj)], 'b.json')); setTimeout(res, 300) })
    const had = bk.gameBackup && bk.gameBackup.total
    const older = JSON.parse(txt); delete older.gameBackup; G().wallet = 99; gameSave(); await imp(older); const keep = G().wallet
    await imp(bk); return [had, keep, G().wallet, JSON.parse(localStorage.getItem('fieldy_game_v1')).wallet]
  })
  eq(r, [2, 99, 4, 4], 'exported in the backup, restored from it; an older backup leaves the journey alone')
  await done(pg)

  part = 'jungle only'
  for (const t of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: t, game: { v: 1, total: 250, wallet: 30, scrolls: { open: [0, 1, 2, 3, 4, 5], read: {} }, onboard: { done: true } } })
    r = await pg.evaluate(() => { C(T()); navigateTo('home'); return [!!document.querySelector('.gm-chip,.gm-sheet,.gm-row,.gm-days,.gm-diff'), G().total, lokiQueue.filter(x => x && x.kind === 'game').length] })
    eq(r, [false, 251, 0], t + ': nothing of the journey on screen, yet the task is still counted, and no bubbles')
    await done(pg)
  }

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
