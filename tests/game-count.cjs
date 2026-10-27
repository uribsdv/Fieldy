#!/usr/bin/env node
// The journey's counts in Hebrew, through the one helper gameCount(n, kind): one is its own word ("משימה אחת", "טיפה אחת",
// "יום טוב אחד"), two may have its own ("שתי טיפות"), the rest are plural with the number. Checked in the helper and where
// it shows: the day line on the sheet, the scrolls still closed, the week line, the good days, the wallet and difficulty
// labels, Loki's "רשמתי" for a side quest, and the review's "נשמר. משימה אחת עברה ל'אחר כך'."
// Run: node tests/game-count.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// ROOT=<dir> runs it against another checkout (default: this repository).
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const EMPTY = { tasks: { now: [], today: [], later: [] }, sites: [], people: [], events: [], moods: [], personal: { gymLog: {}, meditationLog: {} } }
let pass = 0, fail = 0
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); if (s) pass++; else fail++; console.log('  ' + (s ? '✓ ' : '✕ ') + m + (s ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')')) }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }), pg = await ctx.newPage(), errs = []
  pg.on('pageerror', e => errs.push(e.message))
  await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
  await pg.clock.setFixedTime(new Date('2026-11-03T12:00:00'))
  await pg.addInitScript(s => { if (sessionStorage.getItem('gc_seeded')) return; sessionStorage.setItem('gc_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', 'jungle'); localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, onboard: { done: true } })) }, EMPTY)
  await pg.goto(B + '?gnomeHour=12'); await pg.waitForTimeout(500)
  await pg.evaluate(() => { window.__n = 0; window.T = () => { const id = 'gc' + (++__n); state.tasks.today.push({ id, text: 'משימה ' + __n, assignee: 'uri', color: 'orange', done: false, createdAt: new Date(Date.now() - 3600e3).toISOString() }); return id } })

  console.log('the helper')
  const counts = await pg.evaluate(() => Object.keys(GAME_COUNT).map(k => [k, [0, 1, 2, 3, 10].map(n => gameCount(n, k))]))
  eq(counts, [
    ['task', ['0 משימות', 'משימה אחת', '2 משימות', '3 משימות', '10 משימות']],
    ['drop', ['0 טיפות', 'טיפה אחת', 'שתי טיפות', '3 טיפות', '10 טיפות']],
    ['goodDay', ['0 ימים טובים', 'יום טוב אחד', '2 ימים טובים', '3 ימים טובים', '10 ימים טובים']],
    ['fullDay', ['0 ימים מלאים', 'יום מלא אחד', '2 ימים מלאים', '3 ימים מלאים', '10 ימים מלאים']],
    ['movedLater', ['0 משימות עברו', 'משימה אחת עברה', '2 משימות עברו', '3 משימות עברו', '10 משימות עברו']]], 'one, two and many, for tasks, drops, good days, full days and tasks moved (its verb agreeing)')
  eq(await pg.evaluate(() => Object.values(GAME_TXT).concat(Object.values(GAME_TXT.say)).filter(v => typeof v === 'string' && /\{n\}\s*(משימות|טיפות|ימים|שבועות)/.test(v))), [], 'no text left with a number glued to a plural noun')

  console.log('where it shows')
  const sheet = () => pg.evaluate(() => { gameShowJourney(); const o = { day: (document.querySelector('.gm-day b') || {}).textContent || '', week: (document.querySelector('.gm-day span') || {}).textContent || '', lock: [...document.querySelectorAll('.gm-lock small')].map(x => x.textContent) }; closeModal(); return o })
  await pg.evaluate(() => { toggleTask(T()) })
  let s = await sheet()
  eq(s.day, 'יום טוב · משימה אחת', 'one task: "יום טוב · משימה אחת"')
  eq(s.week, 'שבוע: 0 מתוך 5 ימים מלאים', 'the week line')
  eq(s.lock[0], 'עוד 4 משימות', 'a scroll 4 tasks away')
  await pg.evaluate(() => { toggleTask(T()) })
  eq((await sheet()).day, 'יום טוב · 2 משימות', 'two tasks: "יום טוב · 2 משימות"')
  await pg.evaluate(() => { const g = gameGet(); g.total = 4; gameSave() })
  eq((await sheet()).lock[0], 'עוד משימה אחת', 'a scroll one task away: "עוד משימה אחת"')
  eq(await pg.evaluate(() => { const g = gameGet(); for (let i = 3; i <= 9; i++) gameDay('2026-11-0' + i).off = 1; return gameSheetHtml().match(/שבוע: [^<]*/)[0] }), 'שבוע: 0 מתוך 2 ימים מלאים', 'a week mostly off: "מתוך 2 ימים מלאים"')
  eq(await pg.evaluate(() => { const g = gameGet(); g.streak = { n: 2, last: gardenDayKey() }; navigateTo('home'); return (document.querySelector('.gm-days') || {}).textContent.trim() }), '2 ימים טובים', 'the good days on Home')
  eq(await pg.evaluate(() => [1, 2, 3].map(w => { const g = gameGet(); g.wallet = w; navigateTo('home'); return document.querySelector('.gm-chip').getAttribute('aria-label') })), ['המסע · טיפה אחת', 'המסע · שתי טיפות', 'המסע · 3 טיפות'], "the chip's label: one drop, two drops, three")
  eq(await pg.evaluate(() => [1, 2, 4, 8].map(d => { const id = T(); gameSetDiff(id, d); return gameDiffTag(state.tasks.today.find(t => t.id === id)).match(/aria-label="([^"]*)"/)[1] })), ['קושי: קל · טיפה אחת', 'קושי: בינוני · שתי טיפות', 'קושי: קשה · 4 טיפות', 'קושי: אגדי · 8 טיפות'], 'the difficulty tag labels')
  // a side quest with room for two drops, then with room for one (a rest-day drop already paid: 1 + 2 + 2, one left of six)
  eq(await pg.evaluate(() => { const g = gameGet(); g.side = []; ['walk', 'read', 'journal'].forEach(k => gameSideAdd(k)); const k = gardenDayKey(); g.days[k] = { n: 0, p: 0, sd: 0 }
    const said = []; const take = () => { const q = lokiQueue.filter(Boolean).filter(x => x.kind === 'game').map(x => x.text); lokiQueue = []; return q.filter(t => t.startsWith('רשמתי')) }
    lokiQueue = []; gameGymRest(); gameSideToggle(g.side[0].id); said.push(take()); gameSideToggle(g.side[1].id); said.push(take()); gameSideToggle(g.side[2].id); said.push(take()); return said.concat([g.days[k].sd]) }),
    [['רשמתי. שתי טיפות.'], ['רשמתי. שתי טיפות.'], ['רשמתי. טיפה אחת.'], 6], 'Loki says the drops a side quest gave: two, two, then one')
  // the review's undo message ("סיימתי לסקור"), in the jungle and in an old theme
  const review = n => pg.evaluate(n => { closeModal(); const ids = []; for (let i = 0; i < n; i++) ids.push(T()); taskReviewOpen = true; taskReviewUnchecked = new Set(ids); finishTaskReview(); const t = (document.querySelector('#undo-toast span') || {}).textContent; commitUndo(); taskReviewOpen = false; return t }, n)
  eq([await review(1), await review(2), await review(3)], ["נשמר. משימה אחת עברה ל'אחר כך'.", "נשמר. 2 משימות עברו ל'אחר כך'.", "נשמר. 3 משימות עברו ל'אחר כך'."], 'the review: "משימה אחת עברה", "2 משימות עברו", "3 משימות עברו"')
  await pg.evaluate(() => { applyTheme('original'); navigateTo('home') }); await pg.waitForTimeout(200)
  eq(await review(1), "נשמר. משימה אחת עברה ל'אחר כך'.", 'the same in an old theme')
  eq(errs, [], 'no page errors')
  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
