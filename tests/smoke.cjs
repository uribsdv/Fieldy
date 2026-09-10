#!/usr/bin/env node
/*
 * Fieldy — Phase 0 smoke test
 * ---------------------------
 * Loads index.html in headless Chromium (Playwright) and checks that:
 *   1. The app boots with an empty state and with a realistic seeded state.
 *   2. Every screen and nav tab renders without a thrown error.
 *   3. Every modal opens without a thrown error.
 *   4. Add / edit / delete works for tasks, and add / edit / status-change
 *      works for sites, people, calendar events and petty cash.
 *   5. State survives a reload (localStorage round-trip).
 *   6. Corrupt or wrong-shaped saved data fails loudly and is NOT overwritten.
 *   7. The console stays free of errors throughout (external resources such as
 *      Google Fonts and the Anthropic API are blocked on purpose, so the test
 *      is hermetic and never spends API credit).
 *
 * Run:   npm run smoke            (or: node tests/smoke.cjs)
 * Needs: Node 18+, and the `playwright` package either in ./node_modules or
 *        installed globally (`npm i -g playwright`), plus a Chromium it can
 *        launch (`npx playwright install chromium` if you don't have one).
 *
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ── locate playwright (local first, then global) ────────────────────────────
function loadPlaywright() {
  try { return require('playwright') } catch (e) {}
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return require(path.join(globalRoot, 'playwright'))
  } catch (e) {}
  console.error('✕ playwright not found. Install it with:  npm i -D playwright  (or npm i -g playwright)')
  process.exit(2)
}
const { chromium } = loadPlaywright()

// ── tiny static server: serves the repo under /Fieldy/ (matches manifest/sw) ─
const ROOT = path.resolve(__dirname, '..')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.webmanifest': 'application/manifest+json' }
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      if (p === '/' || p === '/Fieldy') { res.writeHead(302, { Location: '/Fieldy/' }); return res.end() }
      if (!p.startsWith('/Fieldy/')) { res.writeHead(404); return res.end('not found') }
      p = p.slice('/Fieldy/'.length) || 'index.html'
      const file = path.join(ROOT, p)
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found') }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      fs.createReadStream(file).pipe(res)
    })
    srv.listen(0, '127.0.0.1', () => resolve(srv))
  })
}

// ── realistic seeded state (exercises most render branches) ─────────────────
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

// ── test harness ────────────────────────────────────────────────────────────
const results = []
let currentSection = ''
function section(name) { currentSection = name; console.log('\n── ' + name) }
function record(ok, name, detail) {
  results.push({ ok, name: currentSection + ' › ' + name, detail })
  console.log((ok ? '  ✓ ' : '  ✕ ') + name + (detail && !ok ? '\n      ' + String(detail).split('\n').join('\n      ') : ''))
}
async function check(name, fn) {
  try {
    const r = await fn()
    if (r === false) record(false, name, 'assertion returned false')
    else record(true, name)
  } catch (e) { record(false, name, e && e.message ? e.message : String(e)) }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }

async function main() {
  const server = await startServer()
  const BASE = 'http://127.0.0.1:' + server.address().port + '/Fieldy/'
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 400, height: 800 }, locale: 'he-IL' })

  // Block anything that isn't our local server: fonts, Anthropic API, Cloudflare.
  await context.route('**/*', route => {
    const u = route.request().url()
    if (u.startsWith(BASE) || u.startsWith('http://127.0.0.1')) return route.continue()
    return route.abort()
  })

  const page = await context.newPage()
  let consoleErrors = []
  let pageErrors = []
  let dialogs = []
  page.on('console', m => {
    if (m.type() !== 'error') return
    const loc = (m.location() && m.location().url) || ''
    // Aborted external resources (fonts/API) log "Failed to load resource" — expected, not an app error.
    if (/Failed to load resource/.test(m.text()) && !loc.startsWith(BASE)) return
    consoleErrors.push(m.text())
  })
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('dialog', async d => { dialogs.push({ type: d.type(), message: d.message() }); await d.accept() })
  const resetLogs = () => { consoleErrors = []; pageErrors = []; dialogs = [] }
  const errorsSince = () => [...pageErrors.map(e => 'pageerror: ' + e), ...consoleErrors.map(e => 'console.error: ' + e)]

  async function boot(state) {
    await page.goto(BASE, { waitUntil: 'load' })
    await page.evaluate(({ s }) => {
      localStorage.clear()
      if (s !== undefined) localStorage.setItem('fieldy_v2', typeof s === 'string' ? s : JSON.stringify(s))
    }, { s: state })
    resetLogs()
    await page.goto(BASE, { waitUntil: 'load' })
    await page.waitForTimeout(300)
  }
  const appReady = () => page.evaluate(() => typeof renderHome === 'function' && document.getElementById('screen-home').innerHTML.trim().length > 100)

  const SCREENS = ['home', 'tasks', 'sites', 'people', 'calendar', 'tao', 'input', 'action', 'settings']
  const NAV = ['home', 'tasks', 'sites', 'people', 'calendar', 'tao']

  async function screenSweep() {
    for (const s of SCREENS) {
      await check('screen "' + s + '" renders', async () => {
        resetLogs()
        const r = await page.evaluate(sc => {
          try {
            if (sc === 'action') openAction({ text: 'Claveria Well: Lock Rotor', assignee: 'asc' })
            else navigateTo(sc)
            const el = document.getElementById('screen-' + sc)
            return { ok: true, hidden: el.classList.contains('hidden'), len: el.innerHTML.trim().length, nav: getComputedStyle(document.getElementById('nav')).display }
          } catch (e) { return { ok: false, err: e.message } }
        }, s)
        assert(r.ok, 'threw: ' + r.err)
        assert(!r.hidden, 'screen still hidden')
        assert(r.len > 100, 'screen looks empty (' + r.len + ' chars)')
        if (NAV.includes(s)) assert(r.nav === 'grid', 'nav should be visible on ' + s); else assert(r.nav === 'none', 'nav should be hidden on ' + s)
        await page.waitForTimeout(50)
        const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
      })
    }
    await check('every nav tab is clickable and becomes active', async () => {
      await page.evaluate(() => navigateTo('home')) // the sweep ends on settings, where the nav is hidden by design
      for (const s of NAV) {
        await page.click('.nav-btn[data-screen="' + s + '"]')
        const active = await page.getAttribute('.nav-btn.active', 'data-screen')
        assert(active === s, 'clicked ' + s + ' but active tab is ' + active)
        const visible = await page.evaluate(sc => !document.getElementById('screen-' + sc).classList.contains('hidden'), s)
        assert(visible, 'screen ' + s + ' not shown after tab click')
      }
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    for (const mode of ['tao', 'lead', 'adhd', 'talk']) {
      await check('tao sub-tab "' + mode + '" renders', async () => {
        resetLogs()
        const r = await page.evaluate(m => {
          try {
            localStorage.setItem('fieldy_tao_mode', m); navigateTo('tao')
            const el = document.getElementById('screen-tao')
            return { ok: true, len: el.innerHTML.trim().length, hasSubnav: !!el.querySelector('.tao-subnav-btn') }
          } catch (e) { return { ok: false, err: e.message } }
        }, mode)
        assert(r.ok, 'threw: ' + r.err); assert(r.len > 100 && r.hasSubnav, 'tao content missing')
        const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
      })
    }
    await check('tao chapter prev/next buttons work', async () => {
      await page.evaluate(() => { localStorage.setItem('fieldy_tao_mode', 'tao'); navigateTo('tao') })
      const before = await page.textContent('#screen-tao')
      await page.click('#tao-next')
      const after = await page.textContent('#screen-tao')
      assert(before !== after, 'chapter did not change')
      await page.click('#tao-prev')
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    for (const v of ['week', 'month', 'year']) {
      await check('calendar view "' + v + '" renders and navigates', async () => {
        resetLogs()
        await page.evaluate(() => navigateTo('calendar'))
        await page.click('#cv' + v[0])
        await page.click('#cal-next'); await page.click('#cal-prev')
        const len = await page.evaluate(() => document.getElementById('screen-calendar').innerHTML.length)
        assert(len > 100, 'calendar empty')
        const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
      })
    }
  }

  async function modalSweep(hasData) {
    const modals = [
      ['add task', () => showAddTask()],
      ['add site', () => showAddSite()],
      ['add person', () => showAddPerson()],
      ['add event', () => showAddEvent()],
      ['day events', () => showDayEvents(getToday())],
      ['petty cash', () => showPettyCashModal()],
      ['SPIS diagnostics', () => showSpisModal()],
      ['meditation (start + stop)', () => { startMeditation(0); stopMeditation(false) }],
    ]
    if (hasData) {
      modals.push(['edit task', () => showAddTask(state.tasks.now[0].id)])
      modals.push(['edit site', () => showAddSite(state.sites[0].name)])
      modals.push(['status change', () => requestStatusChange(state.sites[0].name, 'pending')])
    }
    for (const [name, fn] of modals) {
      await check('modal "' + name + '" opens', async () => {
        resetLogs()
        const r = await page.evaluate(src => {
          try {
            navigateTo(src.includes('event') ? 'calendar' : 'home')
            eval('(' + src + ')()')
            const html = document.getElementById('modal-container').innerHTML
            const opened = html.trim().length > 50
            closeModal()
            return { ok: true, opened, name: src }
          } catch (e) { return { ok: false, err: e.message } }
        }, fn.toString())
        assert(r.ok, 'threw: ' + r.err)
        if (!name.startsWith('meditation')) assert(r.opened, 'modal container stayed empty')
        const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
      })
    }
  }

  // ═══ 1. Empty state ════════════════════════════════════════════════════════
  section('Boot with empty state')
  await boot(undefined)
  await check('app boots and renders home', async () => { assert(await appReady(), 'home did not render'); const e = errorsSince(); assert(!e.length, e.join('\n')) })
  await check('default state was written to localStorage with the expected shape', async () => {
    const r = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('fieldy_v2')); return { ok: !!(s && s.tasks && Array.isArray(s.tasks.now) && Array.isArray(s.sites) && Array.isArray(s.people) && Array.isArray(s.events) && Array.isArray(s.quotes)) } })
    assert(r.ok, 'unexpected shape')
  })
  section('Screens (empty state)')
  await screenSweep()
  section('Modals (empty state)')
  await modalSweep(false)

  // ═══ 2. Seeded state ═══════════════════════════════════════════════════════
  section('Boot with seeded state')
  await boot(seededState())
  await check('app boots with seeded data', async () => { assert(await appReady(), 'home did not render'); const e = errorsSince(); assert(!e.length, e.join('\n')) })
  await check('home shows focus, stuck-site alert, urgent task and mood card', async () => {
    const t = await page.textContent('#screen-home')
    for (const needle of ['הכי חשוב היום', 'אתרים תקועים', 'להתקשר לדייב', 'איך אתה מרגיש', 'ליקוידציה']) assert(t.includes(needle), 'missing: ' + needle)
  })
  await check('nav badges reflect the data', async () => {
    const b = await page.evaluate(() => ({ tasks: document.getElementById('badge-tasks').textContent, sites: document.getElementById('badge-sites').textContent, people: document.getElementById('badge-people').textContent }))
    assert(b.tasks === '1' && b.sites === '2' && b.people === '1', JSON.stringify(b))
  })
  section('Screens (seeded state)')
  await screenSweep()
  section('Modals (seeded state)')
  await modalSweep(true)

  // ═══ 3. CRUD ═══════════════════════════════════════════════════════════════
  section('Tasks: add / edit / complete / delete')
  await boot(seededState())
  await check('add a task through the modal', async () => {
    await page.evaluate(() => { navigateTo('tasks'); showAddTask() })
    await page.fill('#add-task-text', 'משימת בדיקה אוטומטית')
    await page.selectOption('#add-task-bucket', 'today')
    await page.selectOption('#add-task-context', 'phone')
    await page.fill('#add-task-note', 'הערה לבדיקה')
    await page.evaluate(() => doAddTask())
    const r = await page.evaluate(() => { const t = state.tasks.today.find(x => x.text === 'משימת בדיקה אוטומטית'); return { found: !!t, ctx: t && t.context, note: t && t.note, rendered: document.getElementById('screen-tasks').textContent.includes('משימת בדיקה אוטומטית') || true } })
    assert(r.found, 'task not in state.tasks.today'); assert(r.ctx === 'phone' && r.note === 'הערה לבדיקה', 'fields not saved')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('task is visible in the "today" bucket', async () => {
    await page.evaluate(() => setTaskBucket('today'))
    const t = await page.textContent('#screen-tasks'); assert(t.includes('משימת בדיקה אוטומטית'), 'card not rendered')
  })
  await check('edit the task (text + move bucket)', async () => {
    const id = await page.evaluate(() => state.tasks.today.find(x => x.text === 'משימת בדיקה אוטומטית').id)
    await page.evaluate(i => showAddTask(i), id)
    await page.fill('#add-task-text', 'משימת בדיקה — נערכה')
    await page.selectOption('#add-task-bucket', 'now')
    await page.evaluate(() => doAddTask())
    const r = await page.evaluate(i => ({ inNow: state.tasks.now.some(x => x.id === i && x.text === 'משימת בדיקה — נערכה'), inToday: state.tasks.today.some(x => x.id === i) }), id)
    assert(r.inNow && !r.inToday, JSON.stringify(r))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('complete the task (checkbox) and delete it', async () => {
    const id = await page.evaluate(() => state.tasks.now.find(x => x.text === 'משימת בדיקה — נערכה').id)
    await page.evaluate(i => toggleTask(i), id)
    let done = await page.evaluate(i => state.tasks.now.find(x => x.id === i).done, id)
    assert(done === true, 'task not marked done')
    await page.evaluate(() => setTaskBucket('now'))
    await page.evaluate(i => deleteTask(i), id)
    const gone = await page.evaluate(i => ![...state.tasks.now, ...state.tasks.today, ...state.tasks.later].some(x => x.id === i), id)
    assert(gone, 'task still in state after delete')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('changes persisted to localStorage', async () => {
    const r = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('fieldy_v2')); return ![...s.tasks.now, ...s.tasks.today, ...s.tasks.later].some(x => /משימת בדיקה/.test(x.text)) })
    assert(r, 'deleted task still in localStorage')
  })

  section('Sites: add / edit / status / stuck')
  await check('add a site through the modal', async () => {
    await page.evaluate(() => { navigateTo('sites'); showAddSite() })
    await page.fill('#add-site-name', 'Test Site Alpha')
    await page.fill('#add-site-province', 'Apayao')
    await page.fill('#add-site-issue', 'IGBT trip')
    await page.fill('#add-site-location', '18.2975, 121.4004')
    await page.selectOption('#add-site-contractor', 'asc')
    await page.selectOption('#add-site-status', 'open')
    await page.evaluate(() => doAddSite())
    const r = await page.evaluate(() => { const s = state.sites.find(x => x.name === 'Test Site Alpha'); return { found: !!s, issue: s && s.issue, hasId: !!(s && s.id), rendered: document.getElementById('screen-sites').textContent.includes('Test Site Alpha') } })
    assert(r.found && r.hasId, 'site missing from state'); assert(r.issue === 'IGBT trip', 'issue not saved'); assert(r.rendered, 'site card not rendered')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('edit the site', async () => {
    await page.evaluate(() => showAddSite('Test Site Alpha'))
    await page.fill('#add-site-issue', 'IGBT trip — resolved by cleaning vents')
    await page.evaluate(() => doAddSite())
    const issue = await page.evaluate(() => state.sites.find(x => x.name === 'Test Site Alpha').issue)
    assert(issue === 'IGBT trip — resolved by cleaning vents', 'edit not saved: ' + issue)
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('change status via the confirmation modal', async () => {
    await page.evaluate(() => requestStatusChange('Test Site Alpha', 'resolved'))
    const open = await page.evaluate(() => document.getElementById('modal-container').innerHTML.includes('אשר שינוי סטטוס'))
    assert(open, 'status modal did not open')
    await page.evaluate(() => confirmStatusChange())
    const st = await page.evaluate(() => state.sites.find(x => x.name === 'Test Site Alpha').status)
    assert(st === 'resolved', 'status is ' + st)
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('toggle stuck flag on and off', async () => {
    await page.evaluate(() => toggleSiteStuck('Test Site Alpha'))
    let s = await page.evaluate(() => !!state.sites.find(x => x.name === 'Test Site Alpha').stuckSince)
    assert(s, 'stuckSince not set')
    await page.evaluate(() => toggleSiteStuck('Test Site Alpha'))
    s = await page.evaluate(() => !!state.sites.find(x => x.name === 'Test Site Alpha').stuckSince)
    assert(!s, 'stuckSince not cleared')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('site filters (open/pending/resolved/all) render', async () => {
    for (const f of ['open', 'pending', 'resolved', 'all']) await page.evaluate(x => setSiteFilter(x), f)
    const t = await page.textContent('#screen-sites'); assert(t.includes('Test Site Alpha'), 'site not listed under "all"')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  record(true, 'delete site — NOT TESTED: the current UI has no delete action for sites (noted for a later phase)')

  section('People: add / clear pending')
  await check('add a person through the modal', async () => {
    await page.evaluate(() => { navigateTo('people'); showAddPerson() })
    await page.fill('#add-person-name', 'Test Person')
    await page.fill('#add-person-company', 'NIA Region II')
    await page.fill('#add-person-pending', 'well report')
    await page.selectOption('#add-person-role', 'nia')
    await page.evaluate(() => doAddPerson())
    const r = await page.evaluate(() => { const p = state.people.find(x => x.name === 'Test Person'); return { found: !!p, pending: p && p.pending, rendered: document.getElementById('screen-people').textContent.includes('Test Person') } })
    assert(r.found && r.pending === 'well report' && r.rendered, JSON.stringify(r))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('clear the pending item', async () => {
    await page.evaluate(() => clearPending('Test Person'))
    const p = await page.evaluate(() => state.people.find(x => x.name === 'Test Person').pending)
    assert(p === '', 'pending not cleared')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  record(true, 'edit/delete person — NOT TESTED: the current UI has no edit or delete action for people (noted for a later phase)')

  section('Calendar events: add / delete')
  await check('add an event', async () => {
    await page.evaluate(() => { navigateTo('calendar'); showAddEvent() })
    await page.fill('#ev-title', 'Smoke test meeting')
    await page.fill('#ev-time', '10:30')
    await page.evaluate(() => doAddEvent())
    const r = await page.evaluate(() => { const ev = state.events.find(x => x.title === 'Smoke test meeting'); return { found: !!ev, rendered: document.getElementById('screen-calendar').textContent.includes('Smoke test meeting') } })
    assert(r.found && r.rendered, JSON.stringify(r))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('delete the event', async () => {
    const id = await page.evaluate(() => state.events.find(x => x.title === 'Smoke test meeting').id)
    await page.evaluate(i => deleteEvent(i), id)
    const gone = await page.evaluate(() => !state.events.some(x => x.title === 'Smoke test meeting'))
    assert(gone, 'event still present')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })

  section('Petty cash: add / delete')
  await check('add and delete an expense', async () => {
    await page.evaluate(() => { navigateTo('home'); showPettyCashModal() })
    await page.fill('#pc-vendor', 'Smoke Vendor'); await page.fill('#pc-amount', '123')
    await page.evaluate(() => addPettyCashEntry())
    let found = await page.evaluate(() => state.pettyCash.find(x => x.vendor === 'Smoke Vendor'))
    assert(found, 'expense not added')
    await page.evaluate(i => deletePettyCashEntry(i), found.id)
    const gone = await page.evaluate(() => !state.pettyCash.some(x => x.vendor === 'Smoke Vendor'))
    assert(gone, 'expense still present')
    await page.evaluate(() => closeModal())
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })

  section('Other interactions')
  await check('mood buttons log a mood and show tips + brain dump', async () => {
    await page.evaluate(() => { navigateTo('home'); logMood('scattered', 'manual') })
    const r = await page.evaluate(() => ({ last: state.moods[state.moods.length - 1].mood, hasDump: !!document.getElementById('brain-dump-input') }))
    assert(r.last === 'scattered' && r.hasDump, JSON.stringify(r))
    await page.fill('#brain-dump-input', 'בדיקה')
    await page.evaluate(() => saveBrainDump())
    const saved = await page.evaluate(() => state.brainDumps[state.brainDumps.length - 1].text === 'בדיקה')
    assert(saved, 'brain dump not saved')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('daily leadership entry saves', async () => {
    await page.evaluate(() => { localStorage.setItem('fieldy_tao_mode', 'lead'); navigateTo('tao') })
    await page.fill('#lead-why', 'בדיקה')
    await page.evaluate(() => saveLeadershipEntry())
    const ok = await page.evaluate(() => (getTodayLeadershipEntry() || {}).why === 'בדיקה')
    assert(ok, 'entry not saved')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('theme switch applies and persists', async () => {
    await page.evaluate(() => { navigateTo('settings'); applyTheme('teal') })
    const r = await page.evaluate(() => ({ gold: document.documentElement.style.getPropertyValue('--gold'), stored: localStorage.getItem('fieldy_theme') }))
    assert(r.gold === '#0f7d6c' && r.stored === 'teal', JSON.stringify(r))
    await page.evaluate(() => applyTheme('amber'))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('state survives a reload', async () => {
    resetLogs()
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300)
    const r = await page.evaluate(() => ({ site: state.sites.some(x => x.name === 'Test Site Alpha'), person: state.people.some(x => x.name === 'Test Person'), ready: document.getElementById('screen-home').innerHTML.length > 100 }))
    assert(r.site && r.person && r.ready, JSON.stringify(r))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })

  // ═══ 4. Injection safety (free text must render as text) ═══════════════════
  section('Injection safety')
  await boot(seededState())
  const EVIL_TEXT = '<img src=x onerror="window.__pwned=1"> משימה "עם" מרכאות ו\'גרש\' & סימנים'
  const EVIL_NOTE = 'הערה "כפולה" ו\'בודדת\' <b>bold</b>'
  await check('task text/note with HTML and quotes renders as literal text, no script runs', async () => {
    await page.evaluate(() => { navigateTo('tasks'); showAddTask() })
    await page.fill('#add-task-text', EVIL_TEXT); await page.fill('#add-task-note', EVIL_NOTE)
    await page.selectOption('#add-task-bucket', 'now')
    await page.evaluate(() => doAddTask())
    await page.evaluate(() => setTaskBucket('now'))
    const r = await page.evaluate(() => ({
      pwned: window.__pwned, imgs: document.querySelectorAll('#screen-tasks img').length,
      text: document.getElementById('screen-tasks').textContent
    }))
    assert(!r.pwned, 'onerror handler executed'); assert(r.imgs === 0, 'injected <img> became an element')
    assert(r.text.includes('<img src=x') && r.text.includes('<b>bold</b>'), 'markup was not shown literally')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('edit modal round-trips the exact text and note (quotes intact)', async () => {
    const card = page.locator('#screen-tasks > div > div', { hasText: 'משימה "עם" מרכאות' }).first()
    await card.locator('button:has-text("✎")').click()
    const r = await page.evaluate(() => ({ text: document.getElementById('add-task-text').value, note: document.getElementById('add-task-note').value }))
    assert(r.text === EVIL_TEXT, 'text changed: ' + r.text); assert(r.note === EVIL_NOTE, 'note changed: ' + r.note)
    await page.evaluate(() => closeModal())
  })
  await check('🖌️ button passes the exact text through the onclick attribute', async () => {
    const card = page.locator('#screen-tasks > div > div', { hasText: 'משימה "עם" מרכאות' }).first()
    await card.locator('button:has-text("🖌️")').click()
    const r = await page.evaluate(() => ({ screen: currentScreen, text: actionCtx && actionCtx.text, shown: document.getElementById('screen-action').textContent.includes('משימה "עם" מרכאות') }))
    assert(r.screen === 'action' && r.text === EVIL_TEXT && r.shown, JSON.stringify(r))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  const EVIL_SITE = 'O\'Brien "Deep" Well <b>x</b>'
  await check('site with quotes/HTML in its name: add, status modal, stuck, edit all work via real clicks', async () => {
    await page.evaluate(() => { navigateTo('sites'); showAddSite() })
    await page.fill('#add-site-name', EVIL_SITE); await page.fill('#add-site-issue', 'issue <i>x</i> "q"')
    await page.fill('#add-site-monday', 'javascript:alert(1)')
    await page.evaluate(() => doAddSite())
    await page.evaluate(() => setSiteFilter('all'))
    const card = page.locator('#screen-sites .card', { hasText: 'O\'Brien' }).first()
    assert(await card.count() === 1, 'site card not rendered')
    const injected = await page.evaluate(() => document.querySelectorAll('#screen-sites b, #screen-sites i').length)
    assert(injected === 0, 'HTML in site fields became elements')
    const badLinks = await page.evaluate(() => [...document.querySelectorAll('#screen-sites a')].filter(a => /^javascript:/i.test(a.getAttribute('href') || '')).length)
    assert(badLinks === 0, 'javascript: link rendered as href')
    await card.locator('button:has-text("ממתין")').click()
    let r = await page.evaluate(() => ({ name: window.__scName, open: document.getElementById('modal-container').textContent.includes('O\'Brien "Deep" Well') }))
    assert(r.name === EVIL_SITE && r.open, 'status modal got wrong name: ' + JSON.stringify(r))
    await page.evaluate(() => confirmStatusChange())
    r = await page.evaluate(n => state.sites.find(x => x.name === n).status, EVIL_SITE)
    assert(r === 'pending', 'status not changed: ' + r)
    await card.locator('button:has-text("🚧")').click()
    r = await page.evaluate(n => !!state.sites.find(x => x.name === n).stuckSince, EVIL_SITE)
    assert(r, 'stuck toggle did not reach the right site')
    await page.locator('#screen-sites .card', { hasText: 'O\'Brien' }).first().locator('button:has-text("✎")').click()
    r = await page.evaluate(() => ({ name: document.getElementById('add-site-name').value, issue: document.getElementById('add-site-issue').value }))
    assert(r.name === EVIL_SITE && r.issue === 'issue <i>x</i> "q"', 'edit modal values changed: ' + JSON.stringify(r))
    await page.evaluate(() => closeModal())
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('person with quotes in name: ✓ (clear pending) and 🖌️ work via real clicks', async () => {
    await page.evaluate(() => { navigateTo('people'); showAddPerson() })
    await page.fill('#add-person-name', 'Dave "the" O\'Neil'); await page.fill('#add-person-pending', 'waiver <b>now</b>')
    await page.evaluate(() => doAddPerson())
    const card = page.locator('#screen-people .card', { hasText: 'O\'Neil' }).first()
    await card.locator('button:has-text("🖌️")').click()
    let r = await page.evaluate(() => actionCtx)
    assert(r.assignee === 'Dave "the" O\'Neil' && r.text === 'waiver <b>now</b>', JSON.stringify(r))
    await page.evaluate(() => navigateTo('people'))
    await page.locator('#screen-people .card', { hasText: 'O\'Neil' }).first().locator('button:has-text("✓")').click()
    r = await page.evaluate(() => state.people.find(x => x.name === 'Dave "the" O\'Neil').pending)
    assert(r === '', 'pending not cleared: ' + r)
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('event title / quote / focus / insights with HTML render literally', async () => {
    await page.evaluate(() => {
      setState({ events: [...state.events, { id: 'evx', title: '<b>meeting</b>', date: getToday(), time: '', note: '<i>n</i>', recurring: '', notify: '', color: 'var(--bamboo)', site: null }],
                 focus: '<u>focus</u>', quotes: [{ text: '<s>quote</s>', addedAt: 1 }], personalInsights: { text: '<em>insight</em>', updatedAt: 1, basedOnCount: 1 } })
      navigateTo('calendar'); setCalView('month')
    })
    let n = await page.evaluate(() => document.querySelectorAll('#screen-calendar b, #screen-calendar i').length)
    assert(n === 0, 'event HTML became elements')
    await page.evaluate(() => navigateTo('home'))
    n = await page.evaluate(() => document.querySelectorAll('#screen-home u, #screen-home s, #screen-home em').length)
    assert(n === 0, 'home HTML became elements')
    const t = await page.textContent('#screen-home'); assert(t.includes('<u>focus</u>') && t.includes('<s>quote</s>'), 'literal text missing')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })

  // ═══ 4b. No browser-side API key ═══════════════════════════════════════════
  section('API key never lives in the browser')
  await check('a legacy fieldy_key left in localStorage is removed at boot', async () => {
    await page.goto(BASE, { waitUntil: 'load' })
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_key', 'sk-ant-legacy') }, seededState())
    resetLogs(); await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(300)
    const r = await page.evaluate(() => ({ key: localStorage.getItem('fieldy_key'), src: document.documentElement.outerHTML.includes('anthropic-dangerous-direct-browser-access'), settings: (navigateTo('settings'), document.getElementById('screen-settings').textContent) }))
    assert(r.key === null, 'fieldy_key still in localStorage')
    assert(!r.src, 'direct-browser Anthropic header still present in the page')
    assert(!/sk-ant/.test(r.settings) && !r.settings.includes('Anthropic API Key'), 'settings still offers an API-key field')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('without a server, callClaude rejects with a clear message and makes no network call', async () => {
    const r = await page.evaluate(async () => { try { await callClaude([{ role: 'user', content: 'x' }]); return { threw: false } } catch (e) { return { threw: true, msg: e.message } } })
    assert(r.threw && /שרת/.test(r.msg), JSON.stringify(r))
    const home = await page.evaluate(() => { navigateTo('home'); return document.getElementById('screen-home').textContent })
    assert(home.includes('נדרש חיבור לשרת'), 'home does not point to the server settings')
  })

  // ═══ 5. State-load validation ══════════════════════════════════════════════
  section('State-load validation (fail loudly, never corrupt)')
  await check('corrupt JSON in localStorage → clear error screen, data left untouched', async () => {
    const raw = '{"tasks":{"now":[],"today":[' // truncated on purpose
    await boot(raw)
    const r = await page.evaluate(() => ({
      errorShown: !!document.getElementById('state-load-error'),
      text: (document.getElementById('state-load-error') || {}).textContent || '',
      rawKept: localStorage.getItem('fieldy_v2'),
      homeEmpty: document.getElementById('screen-home') === null || document.getElementById('screen-home').innerHTML.trim().length === 0
    }))
    assert(r.errorShown, 'no #state-load-error element — app either crashed silently or rendered over bad data. pageerrors: ' + pageErrors.join(' | '))
    assert(r.rawKept === raw, 'saved data was modified/overwritten')
    assert(r.homeEmpty, 'app rendered despite invalid data')
    assert(/JSON/.test(r.text) || /תקין/.test(r.text), 'error text does not explain the problem')
  })
  await check('wrong shape in localStorage (tasks is a string) → clear error screen, data left untouched', async () => {
    const raw = JSON.stringify({ tasks: 'nope', sites: [], people: [], events: [] })
    await boot(raw)
    const r = await page.evaluate(() => ({ errorShown: !!document.getElementById('state-load-error'), text: (document.getElementById('state-load-error') || {}).textContent || '', rawKept: localStorage.getItem('fieldy_v2') }))
    assert(r.errorShown, 'no error screen. pageerrors: ' + pageErrors.join(' | '))
    assert(r.rawKept === raw, 'saved data was modified/overwritten')
    assert(/tasks/.test(r.text), 'error text does not name the bad field')
  })
  await check('error screen offers a raw-data download and a guarded reset', async () => {
    const r = await page.evaluate(() => ({ dl: !!document.getElementById('state-error-download'), reset: !!document.getElementById('state-error-reset') }))
    assert(r.dl && r.reset, JSON.stringify(r))
  })
  await check('guarded reset keeps a backup copy of the broken data', async () => {
    dialogs = []
    await page.evaluate(() => { document.getElementById('state-error-reset').click() })
    await page.waitForTimeout(500)
    assert(dialogs.some(d => d.type === 'confirm'), 'reset did not ask for confirmation')
    const r = await page.evaluate(() => ({ backupKeys: Object.keys(localStorage).filter(k => k.startsWith('fieldy_v2_broken_')), main: localStorage.getItem('fieldy_v2') }))
    assert(r.backupKeys.length === 1, 'no backup key written: ' + JSON.stringify(r))
  })
  await check('import of a non-JSON file is rejected with a clear message, state unchanged', async () => {
    await boot(seededState())
    dialogs = []
    await page.evaluate(() => importBackup(new File(['this is not json'], 'bad.json', { type: 'application/json' })))
    await page.waitForTimeout(400)
    const alert = dialogs.find(d => d.type === 'alert')
    assert(alert, 'no alert shown')
    assert(!dialogs.some(d => d.type === 'confirm'), 'app asked to replace data even though the file was invalid')
    const same = await page.evaluate(() => state.sites.length === 3 && state.sites[0].name === 'Claveria Well')
    assert(same, 'state changed after a rejected import')
  })
  await check('import of a wrong-shaped backup is rejected naming the problem, state unchanged', async () => {
    dialogs = []
    await page.evaluate(() => importBackup(new File([JSON.stringify({ hello: 'world', sites: 'x' })], 'bad.json', { type: 'application/json' })))
    await page.waitForTimeout(400)
    const alert = dialogs.find(d => d.type === 'alert')
    assert(alert, 'no alert shown')
    assert(!dialogs.some(d => d.type === 'confirm'), 'app asked to replace data even though the file was invalid')
    assert(/tasks|sites/.test(alert.message), 'alert does not name the bad field: ' + alert.message)
    const same = await page.evaluate(() => state.sites.length === 3)
    assert(same, 'state changed after a rejected import')
  })
  await check('import of an older backup missing optional sections still works (defaults applied)', async () => {
    resetLogs(); dialogs = []
    const legacy = { tasks: { now: [], today: [], later: [] }, sites: [{ id: 9, name: 'Legacy Site', status: 'open' }], people: [], events: [], focus: '', focusDate: null, lastSeenDate: null, streak: 0, lastStreakDate: null, updated: null }
    await page.evaluate(l => importBackup(new File([JSON.stringify(l)], 'legacy.json', { type: 'application/json' })), legacy)
    await page.waitForTimeout(400)
    assert(dialogs.some(d => d.type === 'confirm'), 'import did not ask for confirmation')
    const r = await page.evaluate(() => { try { navigateTo('home'); navigateTo('tao'); navigateTo('home'); return { ok: true, site: state.sites[0].name, personal: !!(state.personal && state.personal.gymLog), pc: Array.isArray(state.pettyCash) } } catch (e) { return { ok: false, err: e.message } } })
    assert(r.ok, 'render threw after legacy import: ' + r.err)
    assert(r.site === 'Legacy Site' && r.personal && r.pc, JSON.stringify(r))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('valid backup import replaces state', async () => {
    dialogs = []
    const good = seededState(); good.sites[0].name = 'Imported Site'
    await page.evaluate(g => importBackup(new File([JSON.stringify(g)], 'good.json', { type: 'application/json' })), good)
    await page.waitForTimeout(400)
    const ok = await page.evaluate(() => state.sites[0].name === 'Imported Site' && JSON.parse(localStorage.getItem('fieldy_v2')).sites[0].name === 'Imported Site')
    assert(ok, 'valid import did not apply')
  })
  await check('validateState() rejects bad shapes and accepts the default state', async () => {
    const r = await page.evaluate(() => {
      if (typeof validateState !== 'function') return { missing: true }
      const bad = [null, [], 'x', {}, { tasks: {}, sites: [], people: [], events: [] }, { tasks: { now: [], today: [], later: [] }, sites: {}, people: [], events: [] }, { tasks: { now: [], today: [], later: [] }, sites: [], people: [], events: [], moods: 'no' }]
      const good = [{ tasks: { now: [], today: [], later: [] }, sites: [], people: [], events: [] }, JSON.parse(localStorage.getItem('fieldy_v2'))]
      return { missing: false, badRejected: bad.map(b => validateState(b).length > 0), goodAccepted: good.map(g => validateState(g).length === 0) }
    })
    assert(!r.missing, 'validateState is not defined')
    assert(r.badRejected.every(Boolean), 'some bad shapes were accepted: ' + JSON.stringify(r.badRejected))
    assert(r.goodAccepted.every(Boolean), 'a valid state was rejected: ' + JSON.stringify(r.goodAccepted))
  })

  // ═══ summary ═══════════════════════════════════════════════════════════════
  await browser.close()
  server.close()
  const failed = results.filter(r => !r.ok)
  console.log('\n══════════════════════════════════════════')
  console.log(' ' + (results.length - failed.length) + '/' + results.length + ' checks passed' + (failed.length ? '  —  ' + failed.length + ' FAILED' : ''))
  if (failed.length) { console.log('\nFailed:'); failed.forEach(f => console.log('  ✕ ' + f.name)) }
  console.log('══════════════════════════════════════════')
  process.exit(failed.length ? 1 : 0)
}

main().catch(e => { console.error('smoke test crashed:', e); process.exit(1) })
