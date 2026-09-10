#!/usr/bin/env node
/*
 * Fieldy — visual snapshot tool
 * -----------------------------
 * Renders every screen / tab / modal with a fixed seeded state and saves a
 * PNG per scene, so a refactor can be proven pixel-identical before/after.
 *
 *   node tests/snapshots.cjs capture <outDir>          save PNGs
 *   node tests/snapshots.cjs compare <dirA> <dirB>     pixel-diff two captures
 *
 * Compare exits 1 if any scene differs, and writes <dirB>/__diff_<scene>.png
 * highlighting the changed pixels in red.
 *
 * External hosts are blocked (system fonts only), so results are stable across
 * runs on the same machine. Scenes that depend on the clock (task overdue
 * flags, today's date) are stable within one day.
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

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      if (!p.startsWith('/Fieldy/')) { res.writeHead(404); return res.end() }
      p = p.slice('/Fieldy/'.length) || 'index.html'
      const file = path.join(ROOT, p)
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
      const ct = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-store' })
      fs.createReadStream(file).pipe(res)
    })
    srv.listen(0, '127.0.0.1', () => resolve(srv))
  })
}

// Same fixture shape as smoke.cjs, with fixed timestamps where the UI shows them.
function todayPlus(days) { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
function seededState() {
  const today = todayPlus(0), now = Date.now()
  return {
    tasks: {
      now: [
        { id: 'n1', text: 'להתקשר לדייב על באר קלוריה', site: 'Claveria Well', assignee: 'uri', color: 'red', time: '', date: '', context: 'phone', note: 'לשאול על ה-waiver', done: false },
        { id: 'n2', text: 'לאשר הזמנת משאבה', site: null, assignee: 'gio', color: 'red', time: '', date: '', context: 'office', note: null, done: true, completedAt: now - 3600e3 }
      ],
      today: [
        { id: 'd1', text: 'לעדכן את Monday על Nambaran', site: 'Nambaran Deep Well', assignee: 'uri', color: 'orange', time: '', date: '', context: 'office', note: null, done: false },
        { id: 'd2', text: 'לבדוק גנרטור בסטה קרוז', site: 'Santa Cruz', assignee: 'kenneth', color: 'orange', time: '', date: '', context: 'site', note: 'הערה רגילה', done: false }
      ],
      later: [{ id: 'l1', text: 'לתכנן סיור באפאיאו', site: null, assignee: 'uri', color: 'green', time: '', date: '', context: null, note: null, done: false }]
    },
    sites: [
      { id: 1, name: 'Claveria Well', province: 'Cagayan', issue: 'Lock Rotor A08', contractor: 'asc', status: 'open', location: '18.6083, 121.0833', mondayLink: 'https://example.monday.com/boards/1/pulses/2', remo: '1234', year: '2025', createdAt: new Date(now - 10 * 86400e3).toISOString(), stuckSince: now - 7 * 86400e3 },
      { id: 2, name: "Nambaran Deep Well", province: 'Nueva Vizcaya', issue: 'Dry run protection', contractor: '11-16', status: 'pending', location: 'Nambaran, Bagabag', createdAt: new Date(now - 3 * 86400e3).toISOString() },
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
    focus: 'פגישה עם NIA ב-14:00 — לקחת את דוח הבאר', focusDate: today, lastSeenDate: today, streak: 3, lastStreakDate: today,
    personal: { gymLog: { [today]: true }, meditationLog: {}, vacationGoal: 'בורקאי, דצמבר' },
    moods: [{ ts: now, date: today, hour: 15, weekday: new Date().getDay(), mood: 'scattered', source: 'manual', actions: ['בחר משימה אחת קטנה ותשים טיימר ל-10 דקות — רק עליה.', 'סגור טאבים/אפליקציות מיותרות לרגע. פחות גירויים, יותר פוקוס.'] }],
    brainDumps: [{ ts: now - 86400e3, date: todayPlus(-1), text: 'יותר מדי דברים פתוחים' }, { ts: now - 2 * 86400e3, date: todayPlus(-2), text: 'לסגור ליקוידציה' }, { ts: now - 3 * 86400e3, date: todayPlus(-3), text: 'לישון יותר' }],
    personalInsights: { text: 'אתה נוטה להיות מוצף אחרי הצהריים.\nשורה שנייה.', updatedAt: 1757000000000, basedOnCount: 9 },
    quotes: [{ text: "Who's living your life?", addedAt: 1 }],
    leadershipLog: [{ date: today, why: 'להגן על הצוות', safetyWin: 'ג\'יו הרגיש בנוח לדווח על טעות', habitWin: 'שאלתי לפני שהוריתי', improve: 'פחות להתפרץ בפגישה', updatedAt: 1 }],
    pettyCash: [{ id: 'pc_1', date: today, vendor: 'Shell Gas Station', amount: '1500', note: 'נסיעה ל-Nambaran' }, { id: 'pc_2', date: today, vendor: 'Jollibee', amount: '350', note: '' }],
    updated: null
  }
}

// Each scene: [name, fn run in page]. Keep them deterministic.
const SCENES = [
  ['home', () => navigateTo('home')],
  ['tasks-now', () => { taskContextFilter = 'all'; setTaskBucket('now'); navigateTo('tasks') }],
  ['tasks-today', () => { setTaskBucket('today'); navigateTo('tasks') }],
  ['tasks-later-phone', () => { setTaskBucket('later'); setTaskContextFilter('phone'); navigateTo('tasks') }],
  ['tasks-empty-filter', () => { setTaskBucket('later'); setTaskContextFilter('site'); navigateTo('tasks') }],
  ['sites-open', () => { setSiteFilter('open'); navigateTo('sites') }],
  ['sites-all', () => { setSiteFilter('all'); navigateTo('sites') }],
  ['sites-resolved', () => { setSiteFilter('resolved'); navigateTo('sites') }],
  ['people', () => navigateTo('people')],
  ['calendar-month', () => { setCalView('month'); navigateTo('calendar') }],
  ['calendar-week', () => { setCalView('week'); navigateTo('calendar') }],
  ['calendar-year', () => { setCalView('year'); navigateTo('calendar') }],
  ['tao-tao', () => { localStorage.setItem('fieldy_tao_mode', 'tao'); navigateTo('tao') }],
  ['tao-lead', () => { localStorage.setItem('fieldy_tao_mode', 'lead'); navigateTo('tao') }],
  ['tao-adhd', () => { localStorage.setItem('fieldy_tao_mode', 'adhd'); navigateTo('tao') }],
  ['tao-talk', () => { talkScenario = null; talkMessages = []; talkBusy = false; localStorage.setItem('fieldy_tao_mode', 'talk'); navigateTo('tao') }],
  ['tao-talk-chat', () => { talkScenario = TALK_SCENARIOS[0]; talkMessages = [{ role: 'assistant', content: 'היי! אני דנה, נעים מאוד.\nמה הביא אותך לכנס?' }, { role: 'user', content: 'באתי בשביל ההרצאה על משאבות סולאריות' }]; talkBusy = true; navigateTo('tao') }],
  ['input', () => navigateTo('input')],
  ['action', () => openAction({ text: 'Claveria Well: Lock Rotor A08', assignee: 'asc' })],
  ['settings', () => navigateTo('settings')],
  ['modal-add-task', () => { navigateTo('tasks'); showAddTask() }],
  ['modal-edit-task', () => { navigateTo('tasks'); showAddTask('d2') }],
  ['modal-add-site', () => { navigateTo('sites'); showAddSite() }],
  ['modal-edit-site', () => { navigateTo('sites'); showAddSite('Claveria Well') }],
  ['modal-status-change', () => { navigateTo('sites'); requestStatusChange('Claveria Well', 'pending') }],
  ['modal-status-change-flags', () => { navigateTo('sites'); requestStatusChange('Claveria Well', 'resolved'); toggleStatusFlag('monday'); toggleStatusFlag('email') }],
  ['modal-add-person', () => { navigateTo('people'); showAddPerson() }],
  ['modal-add-event', () => { navigateTo('calendar'); showAddEvent() }],
  ['modal-day-events', () => { navigateTo('calendar'); showDayEvents(getToday()) }],
  ['modal-petty-cash', () => { navigateTo('home'); showPettyCashModal() }],
  ['modal-spis', () => { navigateTo('sites'); showSpisModal() }],
  ['modal-photo', () => { navigateTo('tasks'); viewPhoto('data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==') }],
]

async function capture(outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const server = await startServer()
  const BASE = 'http://127.0.0.1:' + server.address().port + '/Fieldy/'
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 400, height: 3200 }, locale: 'he-IL', deviceScaleFactor: 1 })
  await context.route('**/*', r => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(BASE, { waitUntil: 'load' })
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, seededState())
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  // Freeze transitions/animations so captures are stable.
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;caret-color:transparent!important}' })
  for (const [name, fn] of SCENES) {
    await page.evaluate(src => { closeModal(); eval('(' + src + ')()') }, fn.toString())
    await page.waitForTimeout(120)
    await page.screenshot({ path: path.join(outDir, name + '.png'), caret: 'hide' })
    process.stdout.write('.')
  }
  await page.evaluate(() => closeModal())
  await browser.close(); server.close()
  console.log('\n' + SCENES.length + ' scenes → ' + outDir + (errors.length ? '\n⚠ page errors: ' + errors.join(' | ') : ''))
  if (errors.length) process.exit(1)
}

async function compare(dirA, dirB) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const names = fs.readdirSync(dirA).filter(f => f.endsWith('.png') && !f.startsWith('__diff'))
  let bad = 0
  for (const f of names) {
    const pa = path.join(dirA, f), pb = path.join(dirB, f)
    if (!fs.existsSync(pb)) { console.log('  ✕ ' + f + ': missing in B'); bad++; continue }
    const a = fs.readFileSync(pa), b = fs.readFileSync(pb)
    if (a.equals(b)) { console.log('  ✓ ' + f + ': identical'); continue }
    // Not byte-identical: count differing pixels with a canvas (no image deps needed).
    const r = await page.evaluate(async ([da, db]) => {
      const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src })
      const [ia, ib] = await Promise.all([load(da), load(db)])
      const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height)
      const cv = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data }
      const A = cv(ia), B = cv(ib)
      const out = document.createElement('canvas'); out.width = w; out.height = h; const ox = out.getContext('2d'); ox.drawImage(ib, 0, 0)
      const od = ox.getImageData(0, 0, w, h)
      let diff = 0, minY = h, maxY = 0
      for (let i = 0; i < A.length; i += 4) {
        if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2] || A[i + 3] !== B[i + 3]) {
          diff++; od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 0; od.data[i + 3] = 255
          const y = (i / 4 / w) | 0; if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
      ox.putImageData(od, 0, 0)
      return { diff, total: w * h, sizeA: ia.width + 'x' + ia.height, sizeB: ib.width + 'x' + ib.height, minY, maxY, png: out.toDataURL('image/png') }
    }, ['data:image/png;base64,' + a.toString('base64'), 'data:image/png;base64,' + b.toString('base64')])
    if (r.diff === 0) { console.log('  ✓ ' + f + ': pixel-identical (different PNG encoding)'); continue }
    bad++
    fs.writeFileSync(path.join(dirB, '__diff_' + f), Buffer.from(r.png.split(',')[1], 'base64'))
    console.log('  ✕ ' + f + ': ' + r.diff + ' px differ (' + (100 * r.diff / r.total).toFixed(3) + '%), rows ' + r.minY + '-' + r.maxY + (r.sizeA !== r.sizeB ? ', size ' + r.sizeA + ' vs ' + r.sizeB : '') + ' → __diff_' + f)
  }
  await browser.close()
  console.log(bad ? '\n' + bad + ' scene(s) differ' : '\nall ' + names.length + ' scenes identical')
  process.exit(bad ? 1 : 0)
}

const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'capture' && a) capture(a).catch(e => { console.error(e); process.exit(1) })
else if (cmd === 'compare' && a && b) compare(a, b).catch(e => { console.error(e); process.exit(1) })
else { console.log('usage: node tests/snapshots.cjs capture <outDir> | compare <dirA> <dirB>'); process.exit(2) }
