#!/usr/bin/env node
/*
 * Fieldy — feedback after "סיימתי לסקור" (PR #5)
 *
 * After the finish button of the daily task review: the checklist (#review-quick-add and
 * #finish-review-btn) is gone, the "suggested start" block stays, and exactly one message
 * is shown:
 *   - tasks moved to "later": the undo toast (#undo-toast), "נשמר. X משימות עברו ל'אחר כך'."
 *     (in every theme, the jungle included)
 *   - nothing moved: "נשמר. הכול מסודר." as a plain toast (#review-toast), or in the jungle
 *     as Loki's bubble (no toast).
 *
 * Run:   node tests/review-feedback.cjs        (or: npm run smoke for the main suite)
 * Needs: Node 18+, the playwright package (local or global) and a Chromium it can launch.
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
'use strict'
const http = require('http'), fs = require('fs'), path = require('path')
const { execSync } = require('child_process')
function loadPlaywright() {
  try { return require('playwright') } catch (e) {}
  try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {}
  console.error('✕ playwright not found (npm i -D playwright)'); process.exit(2)
}
const { chromium } = loadPlaywright()
const ROOT = path.resolve(__dirname, '..')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' }

function todayPlus(days) {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function seededState() {
  const today = todayPlus(0)
  const now = Date.now()
  return {
    tasks: {
      now: [
        { id: 'n1', text: 'להתקשר לדייב על באר קלוריה', site: 'Claveria Well', assignee: 'uri', color: 'red', time: '08:00', date: today, context: 'phone', note: 'לשאול על ה-waiver', done: false },
        { id: 'n2', text: 'לאשר הזמנת משאבה', site: null, assignee: 'gio', color: 'red', time: '', date: '', context: 'office', note: null, done: true, completedAt: now - 3600e3 }
      ],
      today: [
        { id: 'd1', text: 'לעדכן את Monday על Nambaran', site: 'Nambaran Deep Well', assignee: 'uri', color: 'orange', time: '', date: '', context: 'office', note: null, done: false },
        { id: 'd2', text: 'לבדוק גנרטור בסטה קרוז', site: 'Santa Cruz', assignee: 'kenneth', color: 'orange', time: '23:59', date: today, context: 'site', note: null, done: false }
      ],
      later: [
        { id: 'l1', text: 'לתכנן סיור באפאיאו', site: null, assignee: 'uri', color: 'green', time: '', date: '', context: null, note: null, done: false }
      ]
    },
    sites: [
      { id: 1, name: 'Claveria Well', province: 'Cagayan', issue: 'Lock Rotor A08', contractor: 'asc', status: 'open', location: '18.6083, 121.0833', mondayLink: 'https://example.monday.com/boards/1/pulses/2', remo: '1234', year: '2025', createdAt: new Date(now - 10 * 86400e3).toISOString(), stuckSince: now - 7 * 86400e3 },
      { id: 2, name: 'Nambaran Deep Well', province: 'Nueva Vizcaya', issue: 'Dry run protection', contractor: '11-16', status: 'pending', location: 'Nambaran, Bagabag', createdAt: new Date(now - 3 * 86400e3).toISOString() },
      { id: 3, name: 'Santa Cruz', province: 'Isabela', issue: '', contractor: '', status: 'resolved', createdAt: new Date(now - 30 * 86400e3).toISOString() }
    ],
    people: [
      { id: 11, name: 'Dave', role: 'contractor', company: 'ASC Construction', pending: 'חתימה על waiver' },
      { id: 12, name: 'Engr. Junell', role: 'engineer', company: 'NIA', pending: '' },
      { id: 13, name: 'Novie', role: 'other', company: '', pending: '' }
    ],
    events: [
      { id: 'ev1', title: 'NIA meeting - 2026 project', date: today, time: '14:00', note: 'bring well report', recurring: '', notify: '60', color: 'var(--bamboo)', site: 'Claveria Well' },
      { id: 'ev2', title: 'Weekly sync', date: todayPlus(-7), time: '09:00', note: '', recurring: 'weekly', notify: '10', color: 'var(--bamboo)', site: null },
      { id: 'ev3', title: 'Liquidation deadline', date: todayPlus(5), time: '', note: '', recurring: '', notify: '1440', color: 'var(--bamboo)', site: null }
    ],
    focus: 'פגישה עם NIA ב-14:00 — לקחת את דוח הבאר',
    focusDate: today,
    lastSeenDate: today,
    streak: 3,
    lastStreakDate: today,
    personal: { gymLog: { [today]: true }, meditationLog: {}, vacationGoal: 'בורקאי, דצמבר' },
    moods: Array.from({ length: 6 }, (_, i) => ({ ts: now - i * 86400e3, date: todayPlus(-i), hour: 15, weekday: new Date(now - i * 86400e3).getDay(), mood: i % 2 ? 'scattered' : 'overwhelmed', source: 'manual', actions: ['נשימה אחת: 4 שניות פנימה · 7 עצירה · 8 החוצה.'] })),
    brainDumps: [
      { ts: now - 86400e3, date: todayPlus(-1), text: 'יותר מדי דברים פתוחים, הקבלן לא עונה' },
      { ts: now - 2 * 86400e3, date: todayPlus(-2), text: 'צריך לסגור את הליקוידציה' },
      { ts: now - 3 * 86400e3, date: todayPlus(-3), text: 'לישון יותר' }
    ],
    personalInsights: { text: 'אתה נוטה להיות מוצף אחרי הצהריים.', updatedAt: now - 86400e3, basedOnCount: 9 },
    quotes: [{ text: "Who's living your life?", addedAt: now }],
    leadershipLog: [{ date: today, why: 'להגן על הצוות', safetyWin: 'ג\'יו הרגיש בנוח לדווח על טעות', habitWin: 'שאלתי לפני שהוריתי', improve: 'פחות להתפרץ בפגישה', updatedAt: now }],
    pettyCash: [
      { id: 'pc_1', date: today, vendor: 'Shell Gas Station', amount: '1500', note: 'נסיעה ל-Nambaran' },
      { id: 'pc_2', date: today, vendor: 'Jollibee', amount: '350', note: '' }
    ],
    updated: new Date(now).toISOString()
  }
}


function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      if (!p.startsWith('/Fieldy/')) { res.writeHead(404); return res.end() }
      p = p.slice('/Fieldy/'.length) || 'index.html'
      const file = path.join(ROOT, p)
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      fs.createReadStream(file).pipe(res)
    })
    srv.listen(0, '127.0.0.1', () => resolve(srv))
  })
}

let failed = 0
async function check(name, fn) {
  try { await fn(); console.log('  ✓ ' + name) } catch (e) { failed++; console.log('  ✕ ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')) }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

// opens the review on a fresh page in `theme`, unchecks the first task when `uncheck`, presses the finish button
async function finish(browser, base, theme, uncheck) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort())
  await page.addInitScript(([t, s]) => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_v2', JSON.stringify(s)) } }, [theme, seededState()])
  await page.goto(base, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.evaluate(() => { GN_DEBUG.hour = 10 })   // not night, so the jungle card speaks
  await page.tap('#task-review-toggle-btn')
  await page.waitForSelector('#finish-review-btn')
  if (uncheck) await page.tap('#finish-review-btn >> xpath=../.. >> input[type=checkbox] >> nth=0')
  await page.evaluate(() => document.getElementById('finish-review-btn').scrollIntoView({ block: 'center' }))
  await page.tap('#finish-review-btn')
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const undo = document.getElementById('undo-toast'), plain = document.getElementById('review-toast')
    const bubble = typeof lokiQueue !== 'undefined' && lokiQueue.some(Boolean) ? (document.querySelector('#jg-gnome .gn-t') || {}).textContent : null
    return {
      quickAdd: !!document.getElementById('review-quick-add'), finishBtn: !!document.getElementById('finish-review-btn'),
      suggestion: [...document.querySelectorAll('[id="daily-briefing"] div[style*="accent-soft"], #jg-gnome div[style*="accent-soft"]')].some(e => /נקודת התחלה מוצעת/.test(e.textContent)),
      undo: undo ? undo.textContent : null, plain: plain ? plain.textContent : null, bubble,
      reviewedToday: state.taskReviewedDate === getToday()
    }
  })
  await ctx.close()
  r.errs = errs
  r.messages = [r.undo, r.plain, r.bubble].filter(Boolean).length
  return r
}

;(async () => {
  const server = await startServer()
  const base = 'http://127.0.0.1:' + server.address().port + '/Fieldy/index.html'
  const browser = await chromium.launch()
  for (const theme of ['original', 'jungle']) {
    console.log('\n── theme: ' + theme)
    await check('tasks moved: checklist gone, suggestion stays, one message (the undo toast "נשמר. X משימות עברו ל\'אחר כך\'.")', async () => {
      const r = await finish(browser, base, theme, true)
      assert(!r.quickAdd && !r.finishBtn, 'checklist still shown: ' + JSON.stringify(r))
      assert(r.suggestion, 'suggestion block is gone: ' + JSON.stringify(r))
      assert(r.reviewedToday, 'review not saved')
      assert(r.messages === 1 && r.undo && /^נשמר\. 1 משימות עברו ל'אחר כך'\./.test(r.undo), 'expected exactly the undo toast: ' + JSON.stringify(r))
      assert(!r.errs.length, r.errs.join('\n'))
    })
    await check('nothing moved: checklist gone, suggestion stays, one message ("נשמר. הכול מסודר.")', async () => {
      const r = await finish(browser, base, theme, false)
      assert(!r.quickAdd && !r.finishBtn, 'checklist still shown: ' + JSON.stringify(r))
      assert(r.suggestion, 'suggestion block is gone: ' + JSON.stringify(r))
      assert(r.messages === 1 && !r.undo, 'expected exactly one message: ' + JSON.stringify(r))
      const text = theme === 'jungle' ? r.bubble : r.plain
      assert(text === 'נשמר. הכול מסודר.', 'wrong message: ' + JSON.stringify(r))
      assert(!r.errs.length, r.errs.join('\n'))
    })
  }
  await browser.close(); server.close()
  console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall checks passed')
  process.exit(failed ? 1 : 0)
})()
