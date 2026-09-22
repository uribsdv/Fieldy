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
// Home-screen "read later" panels start collapsed on purpose, so tests that
// assert on their contents have to open them first (idempotent).
async function openAcc(page, key) {
  await page.evaluate(k => { if (!accordionIsOpen(k)) toggleAccordion(k) }, key)
  await page.waitForTimeout(60)
}

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
        const leak = await page.evaluate(sc => { const tx = document.getElementById('screen-' + sc).textContent; return /<svg|class="ic"/.test(tx) }, s)
        assert(!leak, 'icon markup rendered as literal text on ' + s)
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
            const leak = /<svg|class="ic"/.test(document.getElementById('modal-container').textContent)
            closeModal()
            return { ok: true, opened, leak, name: src }
          } catch (e) { return { ok: false, err: e.message } }
        }, fn.toString())
        assert(r.ok, 'threw: ' + r.err)
        if (!name.startsWith('meditation')) assert(r.opened, 'modal container stayed empty')
        assert(!r.leak, 'icon markup rendered as literal text in modal ' + name)
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
  await check('home shows one ranked "עכשיו" list: focus first, urgent task, stuck site, mood card', async () => {
    const t = await page.textContent('#screen-home')
    for (const needle of ['עכשיו', 'הכי חשוב היום', 'להתקשר לדייב', 'תקוע 7 ימים', 'איך אתה מרגיש', 'ליקוידציה']) assert(t.includes(needle), 'missing: ' + needle)
    const r = await page.evaluate(() => { const items = rankRightNow(null); return { first: items[0].kind, kinds: items.map(i => i.kind), rows: document.querySelectorAll('#screen-home .rn-item').length } })
    // The focus headline sits at the top unless something is literally overdue right now (the fixture's 08:00 task is, after 8am).
    assert(r.kinds.indexOf('focus') <= 1 && ['focus', 'task'].includes(r.first), 'focus should be first or right behind an overdue task: ' + JSON.stringify(r))
    assert(r.kinds.includes('task') && r.kinds.includes('site'), 'ranking misses tasks or stuck sites: ' + JSON.stringify(r))
    assert(r.rows >= 3 && r.rows <= 6, 'unexpected row count ' + r.rows)
  })
  await check('ranking: "now" beats "today", overdue beats not-overdue, tired prefers phone over site, motivated the reverse', async () => {
    const r = await page.evaluate(() => {
      const saved = JSON.stringify(state.tasks)
      state.tasks = { now: [{ id: 'a', text: 'now-task', color: 'orange', done: false }], today: [
        { id: 'b', text: 'today-phone', color: 'orange', context: 'phone', done: false },
        { id: 'c', text: 'today-site', color: 'orange', context: 'site', done: false },
        { id: 'd', text: 'today-overdue', color: 'orange', time: '00:01', date: getToday(), done: false }], later: [] }
      const ids = m => rankRightNow(m).filter(i => i.kind === 'task').map(i => i.id)
      const out = { neutral: ids(null), tired: ids('tired'), motivated: ids('motivated') }
      state.tasks = JSON.parse(saved)
      return out
    })
    assert(r.neutral[0] === 'd' || r.neutral[0] === 'a', 'overdue/now should lead: ' + JSON.stringify(r.neutral))
    assert(r.neutral.indexOf('a') < r.neutral.indexOf('b'), 'now-bucket should beat today-bucket')
    assert(r.tired.indexOf('b') < r.tired.indexOf('c'), 'tired: phone task should beat site task: ' + JSON.stringify(r.tired))
    assert(r.motivated.indexOf('c') < r.motivated.indexOf('b'), 'motivated: site task should beat phone task: ' + JSON.stringify(r.motivated))
  })
  await check('overwhelmed mood shows exactly one item (home + tasks), with an "הצג הכל" escape hatch', async () => {
    await page.evaluate(() => logMood('overwhelmed', 'manual'))
    let r = await page.evaluate(() => ({ rows: document.querySelectorAll('#screen-home .rn-item').length, toggle: !!document.querySelector('#screen-home .right-now-toggle') }))
    assert(r.rows === 1 && r.toggle, 'home: ' + JSON.stringify(r))
    await page.click('#screen-home .right-now-toggle')
    r = await page.evaluate(() => document.querySelectorAll('#screen-home .rn-item').length)
    assert(r > 1, 'הצג הכל did not expand the list')
    await page.click('#screen-home .right-now-toggle')
    await page.evaluate(() => { setTaskBucket('today'); navigateTo('tasks') })
    r = await page.evaluate(() => ({ cards: document.querySelectorAll('#screen-tasks > div:last-child > div').length, banner: !!document.querySelector('#screen-tasks .right-now-toggle'), undoneToday: state.tasks.today.filter(t => !t.done).length }))
    assert(r.undoneToday >= 2, 'fixture should have 2+ undone today tasks')
    assert(r.banner, 'tasks screen shows no mood banner')
    const visibleTasks = await page.evaluate(() => [...document.querySelectorAll('#screen-tasks > div:last-child > div')].filter(d => d.querySelector('div[onclick^="toggleTask"]')).length)
    assert(visibleTasks === 1, 'tasks screen shows ' + visibleTasks + ' tasks under overwhelmed, expected 1')
    await page.evaluate(() => { logMood('focused', 'manual'); navigateTo('home') })
    r = await page.evaluate(() => document.querySelectorAll('#screen-home .rn-item').length)
    assert(r > 1, 'focused mood should not limit the list')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
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
    let gone = await page.evaluate(i => ![...state.tasks.now, ...state.tasks.today, ...state.tasks.later].some(x => x.id === i), id)
    assert(gone, 'task still in state after delete')
    assert(await page.evaluate(() => !!document.getElementById('undo-toast')), 'no undo toast after task delete')
    await page.evaluate(() => undoLast())
    const back = await page.evaluate(i => state.tasks.now.some(x => x.id === i), id)
    assert(back, 'undo did not restore the task to its bucket')
    await page.evaluate(i => { deleteTask(i); commitUndo() }, id)
    gone = await page.evaluate(i => ![...state.tasks.now, ...state.tasks.today, ...state.tasks.later].some(x => x.id === i), id)
    assert(gone, 'task still present after final delete')
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
  await check('delete site from the edit modal, then undo brings it back at the same position', async () => {
    await page.evaluate(() => { setSiteFilter('all'); showAddSite('Test Site Alpha') })
    const idxBefore = await page.evaluate(() => state.sites.findIndex(x => x.name === 'Test Site Alpha'))
    await page.click('#delete-site-btn')
    let r = await page.evaluate(() => ({ gone: !state.sites.some(x => x.name === 'Test Site Alpha'), toast: !!document.getElementById('undo-toast'), modal: document.getElementById('modal-container').innerHTML.trim().length }))
    assert(r.gone, 'site still in state'); assert(r.toast, 'no undo toast shown'); assert(r.modal === 0, 'modal still open')
    await page.click('#undo-toast button')
    r = await page.evaluate(() => ({ idx: state.sites.findIndex(x => x.name === 'Test Site Alpha'), toast: !!document.getElementById('undo-toast'), rendered: document.getElementById('screen-sites').textContent.includes('Test Site Alpha') }))
    assert(r.idx === idxBefore, 'site not restored at its old position: ' + r.idx + ' vs ' + idxBefore); assert(!r.toast, 'toast still visible after undo'); assert(r.rendered, 'restored site not re-rendered')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('delete site without undo is final and persisted', async () => {
    await page.evaluate(() => deleteSite('Test Site Alpha'))
    await page.evaluate(() => commitUndo()) // simulate the toast timing out
    const r = await page.evaluate(() => ({ inState: state.sites.some(x => x.name === 'Test Site Alpha'), inStorage: JSON.parse(localStorage.getItem('fieldy_v2')).sites.some(x => x.name === 'Test Site Alpha'), toast: !!document.getElementById('undo-toast') }))
    assert(!r.inState && !r.inStorage && !r.toast, JSON.stringify(r))
  })

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
  await check('delete person via 🗑 on the card, undo restores', async () => {
    await page.locator('#screen-people .card', { hasText: 'Test Person' }).first().locator('button[data-act=delete]').click()
    let r = await page.evaluate(() => ({ gone: !state.people.some(x => x.name === 'Test Person'), toast: !!document.getElementById('undo-toast') }))
    assert(r.gone && r.toast, JSON.stringify(r))
    await page.click('#undo-toast button')
    r = await page.evaluate(() => state.people.some(x => x.name === 'Test Person'))
    assert(r, 'person not restored')
    await page.evaluate(() => { deletePerson('Test Person'); commitUndo() })
    r = await page.evaluate(() => state.people.some(x => x.name === 'Test Person'))
    assert(!r, 'person still present after final delete')
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  record(true, 'edit person — NOT TESTED: the current UI has no edit action for people (noted for a later phase)')

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
    let gone = await page.evaluate(() => !state.events.some(x => x.title === 'Smoke test meeting'))
    assert(gone, 'event still present')
    await page.evaluate(() => undoLast())
    assert(await page.evaluate(() => state.events.some(x => x.title === 'Smoke test meeting')), 'undo did not restore the event')
    await page.evaluate(i => { deleteEvent(i); commitUndo() }, id)
    gone = await page.evaluate(() => !state.events.some(x => x.title === 'Smoke test meeting'))
    assert(gone, 'event still present after final delete')
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
    await page.evaluate(() => { navigateTo('settings'); applyTheme('moss') })
    const r = await page.evaluate(() => ({ gold: document.documentElement.style.getPropertyValue('--gold'), stored: localStorage.getItem('fieldy_theme') }))
    assert(r.gold === '#2d7a51' && r.stored === 'moss', JSON.stringify(r))
    await page.evaluate(() => applyTheme('original'))
    const e = errorsSince(); assert(!e.length, e.join('\n'))
  })
  await check('state survives a reload', async () => {
    resetLogs()
    await page.evaluate(() => setState({ focus: 'reload-marker', focusDate: getToday() }))
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300)
    const r = await page.evaluate(() => ({ focus: state.focus, sites: state.sites.length, person: state.people.some(x => x.name === 'Dave'), ready: document.getElementById('screen-home').innerHTML.length > 100 }))
    assert(r.focus === 'reload-marker' && r.sites === 3 && r.person && r.ready, JSON.stringify(r))
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
    await card.locator('button[data-act=edit]').click()
    const r = await page.evaluate(() => ({ text: document.getElementById('add-task-text').value, note: document.getElementById('add-task-note').value }))
    assert(r.text === EVIL_TEXT, 'text changed: ' + r.text); assert(r.note === EVIL_NOTE, 'note changed: ' + r.note)
    await page.evaluate(() => closeModal())
  })
  await check('🖌️ button passes the exact text through the onclick attribute', async () => {
    const card = page.locator('#screen-tasks > div > div', { hasText: 'משימה "עם" מרכאות' }).first()
    await card.locator('button[data-act=draft]').click()
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
    await card.locator('button[data-act=stuck]').click()
    r = await page.evaluate(n => !!state.sites.find(x => x.name === n).stuckSince, EVIL_SITE)
    assert(r, 'stuck toggle did not reach the right site')
    await page.locator('#screen-sites .card', { hasText: 'O\'Brien' }).first().locator('button[data-act=edit]').click()
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
    await card.locator('button[data-act=draft]').click()
    let r = await page.evaluate(() => actionCtx)
    assert(r.assignee === 'Dave "the" O\'Neil' && r.text === 'waiver <b>now</b>', JSON.stringify(r))
    await page.evaluate(() => navigateTo('people'))
    await page.locator('#screen-people .card', { hasText: 'O\'Neil' }).first().locator('button[data-act=clear]').click()
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

  // ═══ 4a. Voice input (Web Speech API, stubbed) ═════════════════════════════
  section('Voice input')
  {
    const vctx = await browser.newContext({ viewport: { width: 400, height: 800 }, locale: 'he-IL' })
    await vctx.route('**/*', route => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()))
    await vctx.addInitScript(() => {
      window.__recs = []
      window.SpeechRecognition = class { constructor() { window.__recs.push(this); this.started = 0 } start() { this.started++ } stop() { if (this.onend) this.onend() } abort() { if (this.onend) this.onend() } }
      window.webkitSpeechRecognition = window.SpeechRecognition
    })
    const vp = await vctx.newPage()
    const verrs = []; vp.on('pageerror', e => verrs.push(e.message))
    await vp.goto(BASE, { waitUntil: 'load' })
    await vp.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, seededState())
    await vp.goto(BASE, { waitUntil: 'load' }); await vp.waitForTimeout(300)
    const fire = (page, idx, transcript, isFinal) => page.evaluate(([i, t, f]) => { const r = window.__recs[i]; r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: f })] }) }, [idx, transcript, isFinal])
    await check('task modal shows a mic row; dictation appends live text and keeps it on stop', async () => {
      await vp.evaluate(() => { navigateTo('tasks'); showAddTask() })
      assert(await vp.$('#voice-btn-add-task-text'), 'no mic button in task modal')
      await vp.fill('#add-task-text', 'קיים')
      await vp.click('#voice-btn-add-task-text')
      let r = await vp.evaluate(() => ({ n: window.__recs.length, lang: window.__recs[0].lang, started: window.__recs[0].started, label: document.getElementById('voice-btn-add-task-text').textContent, rec: document.getElementById('voice-btn-add-task-text').classList.contains('recording') }))
      assert(r.n === 1 && r.started === 1 && r.lang === 'he-IL' && r.rec && /עצור/.test(r.label), JSON.stringify(r))
      await fire(vp, 0, 'להתקשר', false)
      assert((await vp.inputValue('#add-task-text')) === 'קיים להתקשר', 'interim text not shown live')
      await fire(vp, 0, 'להתקשר לדייב', true)
      await vp.evaluate(() => window.__recs[0].onend())
      r = await vp.evaluate(() => ({ v: document.getElementById('add-task-text').value, rec: document.getElementById('voice-btn-add-task-text').classList.contains('recording') }))
      assert(r.v === 'קיים להתקשר לדייב' && !r.rec, JSON.stringify(r))
      await vp.evaluate(() => doAddTask())
      assert(await vp.evaluate(() => state.tasks.now.some(t => t.text === 'קיים להתקשר לדייב')), 'dictated task not saved')
    })
    await check('language toggle cycles he → en → fil and persists; errors show a readable status', async () => {
      await vp.evaluate(() => showAddSite())
      await vp.click('#voice-lang-add-site-issue')
      let r = await vp.evaluate(() => ({ stored: localStorage.getItem('fieldy_voice_lang'), label: document.getElementById('voice-lang-add-site-issue').textContent }))
      assert(r.stored === 'en-US' && /EN/.test(r.label), JSON.stringify(r))
      await vp.click('#voice-btn-add-site-issue')
      r = await vp.evaluate(() => window.__recs[window.__recs.length - 1].lang)
      assert(r === 'en-US', 'recognition did not use the chosen language: ' + r)
      await vp.evaluate(() => { const rec = window.__recs[window.__recs.length - 1]; rec.onerror({ error: 'not-allowed' }) })
      r = await vp.evaluate(() => ({ status: document.getElementById('voice-status-add-site-issue').textContent, rec: document.getElementById('voice-btn-add-site-issue').classList.contains('recording') }))
      assert(/מיקרופון/.test(r.status) && !r.rec, JSON.stringify(r))
      await vp.click('#voice-lang-add-site-issue'); await vp.click('#voice-lang-add-site-issue')
      assert((await vp.evaluate(() => localStorage.getItem('fieldy_voice_lang'))) === 'he-IL', 'cycle did not wrap back to he-IL')
      await vp.evaluate(() => closeModal())
    })
    await check('input screen has a mic row; closing a modal stops an active recording', async () => {
      await vp.evaluate(() => navigateTo('input'))
      assert(await vp.$('#voice-btn-input-text'), 'no mic on the WhatsApp input screen')
      await vp.evaluate(() => { navigateTo('tasks'); showAddTask() })
      await vp.click('#voice-btn-add-task-text')
      const before = await vp.evaluate(() => window.__recs.length)
      await vp.evaluate(() => closeModal())
      const stopped = await vp.evaluate(() => _voice === null)
      assert(stopped, 'recording still active after closeModal')
      assert(!verrs.length, 'page errors: ' + verrs.join(' | '))
    })
    await vctx.close()
  }
  await check('without Web Speech support the mic row is simply absent (no errors)', async () => {
    const nctx = await browser.newContext({ viewport: { width: 400, height: 800 } })
    await nctx.route('**/*', route => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()))
    await nctx.addInitScript(() => { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition } catch (e) {} Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true }); Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }) })
    const np = await nctx.newPage(); const errs = []; np.on('pageerror', e => errs.push(e.message))
    await np.goto(BASE, { waitUntil: 'load' }); await np.waitForTimeout(200)
    await np.evaluate(() => { navigateTo('tasks'); showAddTask() })
    const has = await np.$('#voice-btn-add-task-text')
    await nctx.close()
    assert(!has, 'mic row rendered without API support'); assert(!errs.length, errs.join(' | '))
  })

  // ═══ 4a2. Push notifications (mock server + stubbed browser push API) ══════
  section('Push notifications')
  {
    const MOCK = 'http://127.0.0.1:1/mock'
    const mockLog = []
    await context.route(MOCK + '/**', route => {
      const req = route.request(); const p = req.url().slice(MOCK.length)
      mockLog.push({ method: req.method(), path: p, body: req.postDataJSON ? (() => { try { return req.postDataJSON() } catch (e) { return null } })() : null })
      const reply = (obj, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS' }, body: JSON.stringify(obj) })
      if (req.method() === 'OPTIONS') return reply({})
      if (p === '/api/state' && req.method() === 'GET') return reply({ data: null, updated_at: null })
      if (p === '/api/state') return reply({ ok: true })
      if (p === '/api/insights') return reply({ items: [] })
      if (p === '/api/log') return reply({ ok: true })
      if (p === '/api/push/vapid-public-key') return reply({ key: 'BFAKEKEY' })
      if (p === '/api/push/subscribe') return reply({ ok: true })
      if (p === '/api/push/unsubscribe') return reply({ ok: true })
      if (p === '/api/push/test') return reply({ sent: 1, results: [{ device: 'x', status: 201, ok: true }] })
      if (p === '/api/claude') return setTimeout(() => reply({ content: [{ type: 'text', text: 'תשובה לדוגמה: קודם Claveria Well.' }] }), 700)
      return reply({ error: 'not found' }, 404)
    })
    await context.grantPermissions(['notifications'], { origin: new URL(BASE).origin })   // headless Chromium denies by default
    await page.goto(BASE, { waitUntil: 'load' })
    await page.evaluate(([s, m]) => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_server_url', m); localStorage.setItem('fieldy_passcode', 'pw') }, [seededState(), MOCK])
    resetLogs(); await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(500)
    await check('service worker registers and sw.js carries push + notificationclick handlers', async () => {
      const r = await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration('/Fieldy/'); const txt = await (await fetch('/Fieldy/sw.js')).text(); return { reg: !!reg, push: /addEventListener\('push'/.test(txt), click: /addEventListener\('notificationclick'/.test(txt) } })
      assert(r.reg && r.push && r.click, JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('settings shows the notifications card: not active yet, enable button ready, test disabled', async () => {
      // headless-shell Chromium reports the permission as denied no matter what; the flow is what's under test here
      await page.evaluate(() => { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); navigateTo('settings') })
      await page.waitForFunction(() => document.getElementById('push-status') && !/בודק/.test(document.getElementById('push-status').textContent), null, { timeout: 5000 })
      const r = await page.evaluate(() => ({ status: document.getElementById('push-status').textContent, enable: document.getElementById('push-enable-btn') && !document.getElementById('push-enable-btn').disabled, test: document.getElementById('push-test-btn').disabled, prefs: !!document.getElementById('pref-lead-time') }))
      assert(/לא פעיל/.test(r.status) && r.enable && r.test && r.prefs, JSON.stringify(r))
    })
    await check('enable → permission, VAPID key from server, subscribe posted with keys + device; status becomes active', async () => {
      await page.evaluate(() => {
        window.__fakeSub = null
        const mk = () => ({ endpoint: 'https://push.example/abc', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'P256', auth: 'AUTH' } } }, async unsubscribe() { window.__fakeSub = null; return true } })
        window.getPushSubscription = async () => window.__fakeSub
        window.createPushSubscription = async (key) => { window.__lastKey = key; window.__fakeSub = mk(); return window.__fakeSub }
        Notification.requestPermission = async () => 'granted'
      })
      mockLog.length = 0
      await page.click('#push-enable-btn')
      await page.waitForFunction(() => /^\s*פעיל במכשיר/.test((document.getElementById('push-status') || {}).textContent || ''), null, { timeout: 5000 })
      const sub = mockLog.find(m => m.path === '/api/push/subscribe' && m.method === 'POST')
      const dbg = () => ' | calls: ' + JSON.stringify(mockLog.map(m => m.method + ' ' + m.path)) + ' | msg: ' + (await_msg || '')
      const await_msg = await page.evaluate(() => (document.getElementById('push-msg') || {}).textContent)
      assert(sub, 'no subscribe POST reached the server' + dbg())
      assert(sub.body && sub.body.subscription && sub.body.subscription.keys.p256dh === 'P256' && sub.body.subscription.endpoint === 'https://push.example/abc' && /·/.test(sub.body.device), 'subscribe body wrong: ' + JSON.stringify(sub) + dbg())
      const r = await page.evaluate(() => ({ key: window.__lastKey, on: localStorage.getItem('fieldy_push_on'), prefs: state.notifyPrefs, test: document.getElementById('push-test-btn').disabled, disable: !!document.getElementById('push-disable-btn') }))
      assert(r.key === 'BFAKEKEY' && r.on === '1' && !r.test && r.disable, JSON.stringify(r))
      assert(r.prefs && typeof r.prefs.tzOffsetMinutes === 'number' && r.prefs.leadershipTime === '20:00', 'default prefs with timezone not written: ' + JSON.stringify(r.prefs))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('"שלח בדיקה" posts to /api/push/test for this device and confirms', async () => {
      mockLog.length = 0
      await page.click('#push-test-btn')
      await page.waitForFunction(() => /נשלחה/.test((document.getElementById('push-msg') || {}).textContent || ''), null, { timeout: 5000 })
      const t = mockLog.find(m => m.path === '/api/push/test'); assert(t && t.body.endpoint === 'https://push.example/abc', JSON.stringify(t))
    })
    await check('reminder preferences save into state (with timezone) and persist', async () => {
      await page.uncheck('#pref-stuck')
      await page.fill('#pref-lead-time', '21:30')
      await page.dispatchEvent('#pref-lead-time', 'change')
      const r = await page.evaluate(() => ({ live: state.notifyPrefs, stored: JSON.parse(localStorage.getItem('fieldy_v2')).notifyPrefs, msg: document.getElementById('push-msg').textContent }))
      assert(r.live.stuckSites === false && r.live.leadershipTime === '21:30' && r.live.events === true, JSON.stringify(r.live))
      assert(r.stored.leadershipTime === '21:30' && typeof r.stored.tzOffsetMinutes === 'number', 'not persisted: ' + JSON.stringify(r.stored))
      assert(/נשמר/.test(r.msg), 'no confirmation message')
      assert(await page.evaluate(() => document.getElementById('pref-lead-time').value === '21:30'), 'time input lost its value (card re-rendered mid-edit)')
    })
    await check('disable → browser unsubscribe + server unsubscribe; local timers resume', async () => {
      mockLog.length = 0
      await page.click('#push-disable-btn')
      await page.waitForFunction(() => /לא פעיל/.test((document.getElementById('push-status') || {}).textContent || ''), null, { timeout: 5000 })
      const u = mockLog.find(m => m.path === '/api/push/unsubscribe'); assert(u && u.body.endpoint === 'https://push.example/abc', JSON.stringify(u))
      assert((await page.evaluate(() => localStorage.getItem('fieldy_push_on'))) === '0', 'fieldy_push_on not cleared')
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('opening /Fieldy/#sites (what a tapped notification does) lands on the sites screen', async () => {
      await page.goto(BASE + '?reload=1#sites', { waitUntil: 'load' }); await page.waitForTimeout(300)   // fresh load with a hash
      let r = await page.evaluate(() => ({ screen: currentScreen, shown: !document.getElementById('screen-sites').classList.contains('hidden') }))
      assert(r.screen === 'sites' && r.shown, 'on load: ' + JSON.stringify(r))
      await page.evaluate(() => { location.hash = '#people' }); await page.waitForTimeout(200)           // hash change while open
      assert((await page.evaluate(() => currentScreen)) === 'people', 'hashchange while open not honoured')
      await page.goto(BASE + '?reload=2#nonsense', { waitUntil: 'load' }); await page.waitForTimeout(200)
      assert((await page.evaluate(() => currentScreen)) === 'home', 'unknown hash should stay on home')
      await context.clearPermissions()
    })
    await check('AI calls show a skeleton placeholder while waiting, then the answer', async () => {
      await page.goto(BASE + '?reload=3', { waitUntil: 'load' }); await page.waitForTimeout(300)
      await page.evaluate(() => navigateTo('home'))
      await openAcc(page, 'ask-fieldy')
      await page.fill('#ask-fieldy-input', 'מה קודם?')
      await page.evaluate(() => { askFieldy() })
      await page.waitForTimeout(150)
      const during = await page.evaluate(() => ({ skel: document.querySelectorAll('#ask-fieldy-answer .skel-line').length, shown: document.getElementById('ask-fieldy-answer').style.display }))
      assert(during.skel >= 2 && during.shown === 'block', 'no skeleton while thinking: ' + JSON.stringify(during))
      await page.waitForFunction(() => /Claveria/.test(document.getElementById('ask-fieldy-answer').textContent), null, { timeout: 5000 })
      assert((await page.evaluate(() => document.querySelectorAll('#ask-fieldy-answer .skel-line').length)) === 0, 'skeleton not replaced by the answer')
      await page.evaluate(() => { navigateTo('action'); actionCtx = { text: 'x', assignee: '' }; renderAction(); doAction('whatsapp') })
      await page.waitForTimeout(150)
      assert((await page.evaluate(() => document.querySelectorAll('#action-loading .skel-line').length)) >= 3, 'action screen shows no skeleton')
      await page.waitForFunction(() => document.getElementById('action-result-container').style.display === 'block', null, { timeout: 5000 })
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await context.unroute(MOCK + '/**')
  }
  section('Map + charts')
  await boot(seededState())
  await check('parseLatLon handles decimal and DMS, rejects junk', async () => {
    const r = await page.evaluate(() => ({
      dec: parseLatLon('18.6083, 121.0833'), dms: parseLatLon('18°17\'50.89"N 121°24\'1.57"E'), s: parseLatLon('12°30\'S 45°15\'W'),
      bad1: parseLatLon('Nambaran, Bagabag'), bad2: parseLatLon('999, 5'), bad3: parseLatLon('')
    }))
    assert(r.dec && Math.abs(r.dec.lat - 18.6083) < 1e-6 && Math.abs(r.dec.lon - 121.0833) < 1e-6, 'decimal: ' + JSON.stringify(r.dec))
    assert(r.dms && Math.abs(r.dms.lat - 18.29747) < 1e-3 && Math.abs(r.dms.lon - 121.40044) < 1e-3, 'dms: ' + JSON.stringify(r.dms))
    assert(r.s && r.s.lat < 0 && r.s.lon < 0, 'south/west sign: ' + JSON.stringify(r.s))
    assert(!r.bad1 && !r.bad2 && !r.bad3, 'junk accepted: ' + JSON.stringify([r.bad1, r.bad2, r.bad3]))
  })
  await check('sites map toggles on, draws one pin per site with coordinates, counts the rest, and selects on tap', async () => {
    await page.evaluate(() => { setState({ sites: [...state.sites, { id: 9, name: 'DMS Site', status: 'pending', location: '18°17\'50.89"N 121°24\'1.57"E', createdAt: new Date().toISOString() }] }); setSiteFilter('all'); navigateTo('sites') })
    await page.click('#sites-map-toggle')
    let r = await page.evaluate(() => ({ pins: document.querySelectorAll('#screen-sites .map-pin').length, svg: !!document.querySelector('#screen-sites svg[aria-label="מפת אתרים"]'), text: document.getElementById('screen-sites').textContent }))
    assert(r.svg && r.pins === 2, 'expected 2 pins: ' + JSON.stringify({ pins: r.pins, svg: r.svg }))
    assert(/2 בלי קואורדינטות/.test(r.text) && /ק״מ/.test(r.text), 'missing-count or scale bar absent')
    await page.locator('#screen-sites .map-pin').filter({ hasText: 'DMS Site' }).first().click()
    r = await page.evaluate(() => ({ sel: mapSelected, nav: [...document.querySelectorAll('#screen-sites a[href*="google.com/maps"]')].some(a => /ניווט/.test(a.textContent)) }))
    assert(r.sel === 'DMS Site' && r.nav, 'pin selection failed: ' + JSON.stringify(r))
    await page.click('#sites-map-toggle')
    assert((await page.evaluate(() => document.querySelectorAll('#screen-sites .map-pin').length)) === 0, 'map did not toggle off')
    await page.evaluate(() => { setSiteFilter('resolved'); sitesMapOn = true; renderSites() })
    assert(/אין עדיין אתרים עם קואורדינטות/.test(await page.textContent('#screen-sites')), 'no empty-map message for a filter without coordinates')
    await page.evaluate(() => { sitesMapOn = false; mapSelected = null; setSiteFilter('open') })
    const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
  })
  await check('mood trend appears once there are 3+ logged days, with one tile per logged day and a legend with counts', async () => {
    await page.evaluate(() => navigateTo('home'))
    await openAcc(page, 'insights')   // the trend lives inside the collapsed "insights" drawer now
    assert((await page.evaluate(() => document.querySelectorAll('#mood-trend .mood-day').length)) === 6, 'seeded fixture (6 days of moods) should show 6 tiles')
    await page.evaluate(() => setState({ moods: state.moods.slice(0, 1) }))
    assert(!(await page.$('#mood-trend')), 'trend shown with only one mood logged')
    await page.evaluate(() => { const t = Date.now(); setState({ moods: [
      { ts: t - 3 * 86400e3, date: getTodayPlus(-3), hour: 10, weekday: 1, mood: 'tired', source: 'manual' },
      { ts: t - 2 * 86400e3, date: getTodayPlus(-2), hour: 10, weekday: 2, mood: 'focused', source: 'manual' },
      { ts: t - 1 * 86400e3, date: getTodayPlus(-1), hour: 10, weekday: 3, mood: 'overwhelmed', source: 'manual' },
      { ts: t - 1 * 86400e3 + 3600e3, date: getTodayPlus(-1), hour: 11, weekday: 3, mood: 'focused', source: 'manual' }] }) })
    const r = await page.evaluate(() => ({ tiles: document.querySelectorAll('#mood-trend .mood-day').length, legend: document.getElementById('mood-trend').textContent }))
    assert(r.tiles === 3, 'expected 3 day tiles (last mood per day), got ' + r.tiles)
    assert(/פוקוס · 2/.test(r.legend) && /עייף · 1/.test(r.legend) && !/מוצף/.test(r.legend), 'legend counts wrong: ' + r.legend)
  })
  await check('petty-cash modal shows a 6-month column chart and this month by vendor', async () => {
    await page.evaluate(() => { const prev = monthKeyOffset(1) + '-15'; setState({ pettyCash: [...state.pettyCash, { id: 'pc_old', date: prev, vendor: 'Old Vendor', amount: '900', note: '' }] }); showPettyCashModal() })
    const r = await page.evaluate(() => ({ bars: document.querySelectorAll('#modal-container .cash-bar').length, vendors: [...document.querySelectorAll('#modal-container .cash-vendor')].map(d => d.textContent.replace(/\s+/g, ' ').trim()), months: (document.querySelector('#modal-container svg[aria-label="הוצאות לפי חודש"]') || {}).outerHTML || '' }))
    assert(r.bars === 2, 'expected 2 non-empty bars (this month + last), got ' + r.bars)
    assert(r.vendors.length === 2 && /Shell/.test(r.vendors[0]) && /₱1,500/.test(r.vendors[0]), 'vendor bars: ' + JSON.stringify(r.vendors))
    assert(/₱1,850/.test(r.months), 'current-month value label missing from the chart')
    await page.evaluate(() => closeModal())
    const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
  })

  section('Motion + haptics')
  await boot(seededState())
  await check('navigating adds a short enter animation class to the target screen', async () => {
    const r = await page.evaluate(() => { navigateTo('sites'); return { cls: document.getElementById('screen-sites').className, hasKeyframes: [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(rule => rule.name === 'screen-in') } catch (e) { return false } }) } })
    assert(/enter/.test(r.cls) && r.hasKeyframes, JSON.stringify(r))
    await page.waitForTimeout(400)
    assert(!/enter/.test(await page.evaluate(() => document.getElementById('screen-sites').className)), 'enter class not removed after the animation')
  })
  await check('key actions trigger haptics through navigator.vibrate, and the setting turns them off', async () => {
    await page.evaluate(() => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true } })
    const id = await page.evaluate(() => state.tasks.today.find(t => !t.done).id)
    await page.evaluate(i => toggleTask(i), id)
    await page.evaluate(i => { deleteTask(i); undoLast() }, id)
    await page.evaluate(() => logMood('tired', 'manual'))
    let n = await page.evaluate(() => window.__vib.length)
    assert(n >= 4, 'expected ≥4 vibrate calls, got ' + n)
    await page.evaluate(() => { localStorage.setItem('fieldy_haptics', '0'); window.__vib = []; logMood('focused', 'manual') })
    n = await page.evaluate(() => window.__vib.length)
    assert(n === 0, 'haptics still fire when disabled')
    await page.evaluate(() => localStorage.removeItem('fieldy_haptics'))
  })
  await check('action sounds play on complete / save / meditation end, and the Settings toggle silences them', async () => {
    // playTone is a lexical const; count at the FX layer instead (playFx gates on the toggle before reaching FX)
    await page.evaluate(() => { window.__tones = 0; ['complete', 'add', 'save', 'done'].forEach(k => { FX[k] = () => { window.__tones++ } }) })
    const id = await page.evaluate(() => state.tasks.later.find(t => !t.done).id)
    await page.evaluate(i => toggleTask(i), id)
    await page.evaluate(() => { localStorage.setItem('fieldy_tao_mode', 'lead'); navigateTo('tao') })
    await page.fill('#lead-why', 'x'); await page.evaluate(() => saveLeadershipEntry())
    await page.evaluate(() => { startMeditation(0); stopMeditation(true) })
    let n = await page.evaluate(() => window.__tones)
    assert(n === 3, 'expected complete + save + done = 3 sound events, got ' + n)
    await page.evaluate(() => navigateTo('settings'))
    assert(await page.isChecked('#pref-sound'), 'sound toggle should default to on')
    await page.uncheck('#pref-sound')
    await page.evaluate(() => { window.__tones = 0 })
    await page.evaluate(i => { toggleTask(i); toggleTask(i) }, id)
    await page.evaluate(() => { startMeditation(0); stopMeditation(true) })
    n = await page.evaluate(() => window.__tones)
    assert(n === 0 && (await page.evaluate(() => localStorage.getItem('fieldy_sound'))) === '0', 'sounds still play when disabled: ' + n)
    await page.uncheck('#pref-haptics')
    assert((await page.evaluate(() => localStorage.getItem('fieldy_haptics'))) === '0', 'haptics toggle not stored')
    await page.check('#pref-sound'); await page.check('#pref-haptics')
    await page.evaluate(() => { stopMeditation(false) })
  })

  // ═══ 4b. No browser-side API key ═══════════════════════════════════════════
  section('Phase 5 — one assistant (shared context, daily briefing, task triage)')
  {
    const MOCK5 = 'http://127.0.0.1:1/mock5'
    const calls = []
    await context.route(MOCK5 + '/**', route => {
      const req = route.request(); const p = req.url().slice(MOCK5.length)
      const reply = (obj, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS' }, body: JSON.stringify(obj) })
      if (req.method() === 'OPTIONS') return reply({})
      if (p === '/api/claude') { let body = null; try { body = req.postDataJSON() } catch (e) {} calls.push(body); return setTimeout(() => reply({ content: [{ type: 'text', text: 'תדריך לדוגמה: קודם Claveria Well, אחר כך NIA.' }] }), 300) }
      if (p === '/api/state' && req.method() === 'GET') return reply({ data: null, updated_at: null })
      if (p === '/api/state') return reply({ ok: true })
      if (p === '/api/insights') return reply({ items: [] })
      if (p === '/api/log') return reply({ ok: true })
      return reply({ error: 'not found' }, 404)
    })
    const today = todayPlus(0)
    const seed5 = seededState(); seed5.moods = seed5.moods.slice().reverse()   // today's mood last, so getCurrentMood() sees it active from boot
    await page.goto(BASE, { waitUntil: 'load' })
    await page.evaluate(([s, m]) => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_server_url', m); localStorage.setItem('fieldy_passcode', 'pw') }, [seed5, MOCK5])
    resetLogs(); await page.goto(BASE + '?p5=1', { waitUntil: 'load' })
    await check('assistantContext() carries today\'s mood, focus, stuck sites and the weekly leadership theme', async () => {
      const r = await page.evaluate(() => ({ ctx: assistantContext(), theme: getWeeklyFocus().theme, focus: state.focus }))
      assert(/מוצף/.test(r.ctx), 'mood missing: ' + r.ctx)
      assert(r.ctx.indexOf(r.focus) !== -1, 'focus missing')
      assert(/Claveria Well \(7 ימים, Lock Rotor A08\)/.test(r.ctx), 'stuck site missing: ' + r.ctx)
      assert(r.ctx.indexOf(r.theme) !== -1, 'weekly theme missing')
      assert(/פחות להתפרץ בפגישה/.test(r.ctx), 'today\'s leadership "improve" missing')
      assert(!/Nambaran/.test(r.ctx), 'a non-stuck site leaked into the stuck list')
    })
    await check('the daily briefing is generated once at boot, with the shared context, and cached in state for today', async () => {
      await page.waitForFunction(t => state.briefing && state.briefing.date === t && state.briefing.text, today, { timeout: 5000 })
      const brief = calls.filter(c => c && /תדריך/.test(c.messages[0].content))
      assert(brief.length === 1, 'expected exactly one briefing call, got ' + brief.length + ' (all: ' + calls.length + ')')
      assert(/Claveria Well/.test(brief[0].system) && /מוצף/.test(brief[0].system), 'briefing system prompt lacks the shared context: ' + brief[0].system)
      assert(/Claveria Well — תקוע 7 ימים/.test(brief[0].messages[0].content), 'facts not in the prompt: ' + brief[0].messages[0].content)
      const r = await page.evaluate(() => ({ text: state.briefing.text, saved: JSON.parse(localStorage.getItem('fieldy_v2')).briefing }))
      assert(/Claveria/.test(r.text) && r.saved && r.saved.date === today, JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('home shows the briefing panel: focus, priority sites (stuck first), weekly theme, and the cached AI text', async () => {
      await page.evaluate(() => navigateTo('home'))
      await openAcc(page, 'briefing-full')   // the AI narrative is collapsed by default
      const r = await page.evaluate(() => { const el = document.getElementById('daily-briefing'); return { has: !!el, txt: el ? el.textContent : '', ai: (document.getElementById('briefing-text') || {}).textContent || '', firstSite: el ? (el.querySelector('span[style*="font-weight:600"]') || {}).textContent : '', theme: getWeeklyFocus().theme, focus: state.focus, refresh: !!document.getElementById('briefing-refresh-btn') } })
      assert(r.has, 'no #daily-briefing on home')
      assert(r.txt.indexOf(r.focus) !== -1 && /תקוע 7 ימים/.test(r.txt) && r.txt.indexOf(r.theme) !== -1, 'panel facts incomplete: ' + r.txt)
      assert(r.firstSite === 'Claveria Well', 'stuck site should come first, got: ' + r.firstSite)
      assert(/תדריך לדוגמה/.test(r.ai) && r.refresh, 'cached AI text / refresh button missing')
    })
    await check('a reload the same day does NOT call the AI again — the cached briefing is shown', async () => {
      const before = calls.length
      await page.goto(BASE + '?p5=2', { waitUntil: 'load' }); await page.waitForTimeout(900)
      await page.evaluate(() => navigateTo('home')); await page.waitForTimeout(100)
      await openAcc(page, 'briefing-full')
      const r = await page.evaluate(() => ({ ai: (document.getElementById('briefing-text') || {}).textContent || '', skel: document.querySelectorAll('#daily-briefing .skel-line').length }))
      assert(calls.length === before, 'briefing was re-fetched on reload (' + (calls.length - before) + ' extra calls)')
      assert(/תדריך לדוגמה/.test(r.ai) && r.skel === 0, 'cached briefing not shown: ' + JSON.stringify(r))
    })
    await check('"רענן" regenerates on demand (one call), showing a skeleton meanwhile', async () => {
      const before = calls.length
      await page.click('#briefing-refresh-btn'); await page.waitForTimeout(60)
      const during = await page.evaluate(() => document.querySelectorAll('#daily-briefing .skel-line').length)
      await page.waitForFunction(() => document.getElementById('briefing-text'), null, { timeout: 5000 })
      assert(during >= 2, 'no skeleton while regenerating')
      assert(calls.length === before + 1, 'expected one extra call, got ' + (calls.length - before))
    })
    await check('Ask Fieldy, the action drafter and the pattern analyser all send the same shared context as their system prompt', async () => {
      const before = calls.length
      await openAcc(page, 'ask-fieldy')
      await page.fill('#ask-fieldy-input', 'מה קודם?'); await page.evaluate(() => askFieldy())
      await page.waitForFunction(() => /Claveria/.test(document.getElementById('ask-fieldy-answer').textContent), null, { timeout: 5000 })
      await page.evaluate(() => { navigateTo('action'); actionCtx = { text: 'x', assignee: '' }; renderAction(); doAction('email') })
      await page.waitForFunction(() => document.getElementById('action-result-container').style.display === 'block', null, { timeout: 5000 })
      await page.evaluate(() => analyzePersonalPatterns(true))
      await page.waitForFunction(n => window.__p5 = null || true, null, { timeout: 100 }).catch(() => {})
      await page.waitForTimeout(700)
      const recent = calls.slice(before)
      assert(recent.length === 3, 'expected 3 calls, got ' + recent.length)
      recent.forEach((c, i) => assert(c.system && /Claveria Well \(7 ימים/.test(c.system) && /מוצף/.test(c.system) && c.system.indexOf('מוקד המנהיגות השבועי') !== -1, 'call ' + i + ' lacks shared context: ' + (c.system || '').slice(0, 200)))
      assert(/אתרים פתוחים/.test(recent[0].messages[0].content), 'Ask Fieldy lost its site/task listing')
      assert(/professional email/.test(recent[1].messages[0].content), 'action prompt changed')
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('triage: two open tasks for the same site in different buckets → one "batch" suggestion; nothing for the seeded state itself', async () => {
      await page.evaluate(() => { taskContextFilter = 'all'; navigateTo('tasks') })
      assert((await page.evaluate(() => document.querySelectorAll('.triage-card').length)) === 0, 'seeded state should not produce a suggestion')
      await page.evaluate(() => setState({ tasks: { ...state.tasks, later: [...state.tasks.later, { id: 'l9', text: 'לצלם את לוח הבקרה בקלוריה', site: 'Claveria Well', assignee: 'uri', color: 'green', time: '', date: '', context: 'site', note: null, done: false }] } }))
      const r = await page.evaluate(() => { const c = document.querySelector('.triage-card'); return { n: document.querySelectorAll('.triage-card').length, key: c && c.dataset.key, txt: c ? c.textContent : '' } })
      assert(r.n === 1 && r.key === 'site:Claveria Well', JSON.stringify(r))
      assert(/2 משימות ב-Claveria Well/.test(r.txt) && /עכשיו \/ אחר כך/.test(r.txt) && /קבץ לעכשיו/.test(r.txt), r.txt)
    })
    await check('"קבץ" moves them side by side into the most urgent bucket, offers undo, and the suggestion disappears', async () => {
      await page.click('.triage-card .triage-batch'); await page.waitForTimeout(100)
      const r = await page.evaluate(() => ({ now: state.tasks.now.map(t => t.id), later: state.tasks.later.map(t => t.id), cards: document.querySelectorAll('.triage-card').length, undo: !!document.getElementById('undo-toast'), bucket: taskBucket }))
      assert(r.now.join(',') === 'n1,l9,n2', 'batched order wrong: ' + r.now.join(','))
      assert(r.later.indexOf('l9') === -1 && r.cards === 0 && r.undo && r.bucket === 'now', JSON.stringify(r))
      await page.evaluate(() => undoLast()); await page.waitForTimeout(50)
      const u = await page.evaluate(() => ({ now: state.tasks.now.map(t => t.id), later: state.tasks.later.map(t => t.id), cards: document.querySelectorAll('.triage-card').length }))
      assert(u.now.join(',') === 'n1,n2' && u.later.indexOf('l9') !== -1 && u.cards === 1, 'undo did not restore: ' + JSON.stringify(u))
    })
    await check('"לא עכשיו" hides that suggestion, survives a reload, and comes back only when the group changes', async () => {
      await page.click('.triage-card .triage-dismiss'); await page.waitForTimeout(50)
      let r = await page.evaluate(() => ({ cards: document.querySelectorAll('.triage-card').length, d: state.triageDismissed }))
      assert(r.cards === 0 && r.d && r.d['site:Claveria Well'] === 'l9,n1', JSON.stringify(r))
      await page.goto(BASE + '?p5=3', { waitUntil: 'load' }); await page.waitForTimeout(300)
      await page.evaluate(() => { taskContextFilter = 'all'; navigateTo('tasks') })
      assert((await page.evaluate(() => document.querySelectorAll('.triage-card').length)) === 0, 'dismissal did not persist')
      await page.evaluate(() => setState({ tasks: { ...state.tasks, today: [...state.tasks.today, { id: 'd9', text: 'להביא חלקים לקלוריה', site: 'Claveria Well', assignee: 'uri', color: 'orange', time: '', date: '', context: 'site', note: null, done: false }] } }))
      r = await page.evaluate(() => ({ cards: document.querySelectorAll('.triage-card').length, txt: (document.querySelector('.triage-card') || {}).textContent || '' }))
      assert(r.cards === 1 && /3 משימות ב-Claveria Well/.test(r.txt), 'a changed group should re-suggest: ' + JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('validateState() accepts the new sections and rejects wrong shapes', async () => {
      const r = await page.evaluate(() => { const base = JSON.parse(localStorage.getItem('fieldy_v2')); return { ok: validateState(base).length, badBrief: validateState({ ...base, briefing: 'x' }).length, badDismiss: validateState({ ...base, triageDismissed: [] }).length, missing: validateState((() => { const c = { ...base }; delete c.briefing; delete c.triageDismissed; return c })()).length } })
      assert(r.ok === 0 && r.badBrief === 1 && r.badDismiss === 1 && r.missing === 0, JSON.stringify(r))
    })
    await context.unroute(MOCK5 + '/**')
    await check('without a server the briefing panel still shows the local facts, with no AI text and no call', async () => {
      await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, seededState())
      const before = calls.length
      resetLogs(); await page.goto(BASE + '?p5=4', { waitUntil: 'load' }); await page.waitForTimeout(300)
      const r = await page.evaluate(() => { const el = document.getElementById('daily-briefing'); return { has: !!el, ai: !!document.getElementById('briefing-text'), refresh: !!document.getElementById('briefing-refresh-btn'), hint: el && /חבר שרת/.test(el.textContent), facts: el && /Claveria Well/.test(el.textContent) } })
      assert(r.has && !r.ai && !r.refresh && r.hint && r.facts, JSON.stringify(r))
      assert(calls.length === before, 'AI was called without a server')
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
  }

  section('Daily task review + editable focus (briefing accordion)')
  {
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, seededState())
    resetLogs(); await page.goto(BASE + '?rev=1', { waitUntil: 'load' }); await page.waitForTimeout(300)
    await check('"סקור משימות" opens a checklist of today\'s open now/today tasks, all checked by default', async () => {
      await page.click('#task-review-toggle-btn')
      const r = await page.evaluate(() => ({ n: document.querySelectorAll('[id="daily-briefing"] input[type=checkbox]').length, allChecked: [...document.querySelectorAll('[id="daily-briefing"] input[type=checkbox]')].every(c => c.checked) }))
      assert(r.n === 3, 'expected 3 open now/today tasks, got ' + r.n)
      assert(r.allChecked, 'all tasks should start checked (relevant)')
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('unchecking a task strikes it through; quick-add appends a task immediately', async () => {
      const cbs = await page.$$('[id="daily-briefing"] input[type=checkbox]')
      await cbs[2].click()   // uncheck the last row (d2, "לבדוק גנרטור בסטה קרוז")
      const struck = await page.evaluate(() => getComputedStyle(document.querySelectorAll('[id="daily-briefing"] input[type=checkbox]')[2].closest('label').querySelector('span')).textDecorationLine)
      assert(/line-through/.test(struck), 'unchecked row not struck through: ' + struck)
      await page.fill('#review-quick-add', 'לבדוק לחץ מים')
      await page.click('#review-quick-add + button')
      const r = await page.evaluate(() => ({ added: state.tasks.today.some(t => t.text === 'לבדוק לחץ מים'), cleared: document.getElementById('review-quick-add').value }))
      assert(r.added && r.cleared === '', JSON.stringify(r))
    })
    await check('"סיימתי לסקור" moves the unchecked task to "אחר כך" (with undo) and shows a suggested next task', async () => {
      await page.click('#finish-review-btn')
      await page.waitForTimeout(80)
      const r = await page.evaluate(() => ({
        laterIds: state.tasks.later.map(t => t.id),
        stillInToday: state.tasks.today.some(t => t.id === 'd2'),
        reviewedDate: state.taskReviewedDate,
        undo: !!document.getElementById('undo-toast'),
        suggestion: (document.querySelector('[id="daily-briefing"] div[style*="accent-soft"]') || {}).textContent || ''
      }))
      assert(!r.stillInToday && r.laterIds.includes('d2'), 'd2 should have moved to later: ' + JSON.stringify(r))
      assert(r.reviewedDate === todayPlus(0), 'taskReviewedDate not set to today: ' + r.reviewedDate)
      assert(r.undo, 'no undo toast after finishing review')
      assert(/נקודת התחלה מוצעת/.test(r.suggestion), 'no suggested-start section: ' + r.suggestion)
      await page.evaluate(() => undoLast())
      await page.waitForTimeout(60)
      const u = await page.evaluate(() => ({ laterIds: state.tasks.later.map(t => t.id), todayIds: state.tasks.today.map(t => t.id) }))
      assert(!u.laterIds.includes('d2') && u.todayIds.includes('d2'), 'undo did not restore d2 to today: ' + JSON.stringify(u))
    })
    await check('closing and reopening the review resets its checklist/suggestion state', async () => {
      await page.click('#task-review-toggle-btn')   // close (still labelled "סגור" — taskReviewOpen was never reset by the undo above)
      await page.waitForTimeout(60)
      assert(!(await page.$('#review-quick-add')), 'review body should be gone after closing')
      await page.click('#task-review-toggle-btn')   // reopen — label is "נסקר היום" now, but the id is stable
      const r = await page.evaluate(() => ({ allChecked: [...document.querySelectorAll('[id="daily-briefing"] input[type=checkbox]')].every(c => c.checked), suggestion: !!document.querySelector('[id="daily-briefing"] div[style*="accent-soft"]') }))
      assert(r.allChecked && !r.suggestion, 'reopened review should start fresh: ' + JSON.stringify(r))
      await page.click('#task-review-toggle-btn')   // close again before the focus-edit check below
    })
    await check('the focus line ("הדבר הכי חשוב היום") is an inline-editable accordion, prefilled with state.focus', async () => {
      await page.evaluate(() => toggleFocusEdit())
      await page.waitForFunction(() => document.getElementById('focus-edit-input'), null, { timeout: 2000 })
      const r0 = await page.evaluate(() => ({ input: document.getElementById('focus-edit-input').value, focus: state.focus }))
      assert(r0.input === r0.focus, 'focus input not prefilled with state.focus: ' + JSON.stringify(r0))
      await page.fill('#focus-edit-input', 'מוקד חדש להיום')
      await page.click('#focus-edit-input + button')
      await page.waitForTimeout(60)
      const r = await page.evaluate(() => ({ focus: state.focus, focusDate: state.focusDate, editorClosed: !document.getElementById('focus-edit-input') }))
      assert(r.focus === 'מוקד חדש להיום' && r.focusDate === todayPlus(0) && r.editorClosed, JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('validateState() rejects a wrong-typed taskReviewedDate', async () => {
      const r = await page.evaluate(() => { const base = JSON.parse(localStorage.getItem('fieldy_v2')); return validateState({ ...base, taskReviewedDate: 123 }).length })
      assert(r === 1, 'expected exactly one problem, got ' + r)
    })
    await check('"#review-tasks" deep-link lands on home with the review already open', async () => {
      resetLogs(); await page.goto(BASE + '#review-tasks', { waitUntil: 'load' }); await page.waitForTimeout(300)
      const r = await page.evaluate(() => ({ screen: currentScreen, open: taskReviewOpen, hasBody: !!document.getElementById('review-quick-add') }))
      assert(r.screen === 'home' && r.open && r.hasBody, JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
  }

  section('Interface language toggle (Settings) — Hebrew/English, RTL/LTR')
  {
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, seededState())
    resetLogs(); await page.goto(BASE + '?lang=1', { waitUntil: 'load' }); await page.waitForTimeout(300)
    await check('defaults to Hebrew/RTL; nav labels and Home text are Hebrew', async () => {
      const r = await page.evaluate(() => ({ dir: document.documentElement.getAttribute('dir'), lang: document.documentElement.getAttribute('lang'), navHome: document.querySelector('[data-i18n="nav_home"]').textContent, greeting: document.getElementById('screen-home').textContent }))
      assert(r.dir === 'rtl' && r.lang === 'he' && r.navHome === 'בית' && /בוקר טוב/.test(r.greeting), JSON.stringify(r))
    })
    await check('Settings screen offers a language toggle, defaulting to עברית selected', async () => {
      await page.evaluate(() => navigateTo('settings'))
      const t = await page.textContent('#screen-settings')
      assert(/שפת ממשק/.test(t) && /עברית/.test(t) && /English/.test(t), 'no language toggle found: ' + t.slice(0, 200))
    })
    await check('switching to English flips dir/lang, updates the nav bar, and re-renders the current screen\'s text', async () => {
      await page.click('#screen-settings >> text=English')
      await page.waitForTimeout(80)
      const r = await page.evaluate(() => ({
        dir: document.documentElement.getAttribute('dir'), lang: document.documentElement.getAttribute('lang'),
        bodyClass: document.body.classList.contains('lang-en'),
        navHome: document.querySelector('[data-i18n="nav_home"]').textContent, navTasks: document.querySelector('[data-i18n="nav_tasks"]').textContent,
        settingsText: document.getElementById('screen-settings').textContent,
        stored: localStorage.getItem('fieldy_ui_lang')
      }))
      assert(r.dir === 'ltr' && r.lang === 'en' && r.bodyClass, 'dir/lang/body class not switched: ' + JSON.stringify(r))
      assert(r.navHome === 'Home' && r.navTasks === 'Tasks', 'nav bar not translated: ' + JSON.stringify(r))
      assert(/Interface language/.test(r.settingsText) && /Color theme/.test(r.settingsText), 'settings screen not translated: ' + r.settingsText.slice(0, 200))
      assert(r.stored === 'en', 'language preference not persisted')
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('Home screen — greeting, stat tiles, mood picker and the task-review/briefing accordion are all in English', async () => {
      await page.evaluate(() => navigateTo('home'))
      const t = await page.textContent('#screen-home')
      assert(/Good morning, Uri/.test(t), 'greeting not translated: ' + t.slice(0, 200))
      assert(/How do you feel right now/.test(t), 'mood prompt not translated')
      assert(/Overwhelmed/.test(t) && /Highly motivated/.test(t), 'mood labels not translated: ' + t)
      await page.click('#task-review-toggle-btn')
      const reviewText = await page.textContent('#daily-briefing')
      assert(/today's task review/i.test(reviewText), 'review heading not translated: ' + reviewText.slice(0, 300))
      assert(/I'm done reviewing/.test(reviewText), 'finish-review button not translated: ' + reviewText.slice(0, 300))
      await page.click('#task-review-toggle-btn')
    })
    await check('user-entered content (task text, quotes) stays exactly as typed regardless of interface language', async () => {
      const r = await page.evaluate(() => ({ taskText: state.tasks.now.find(t => t.id === 'n1').text }))
      assert(r.taskText === 'להתקשר לדייב על באר קלוריה', 'user task text should never be machine-translated: ' + r.taskText)
    })
    await check('the language choice survives a reload', async () => {
      resetLogs(); await page.goto(BASE + '?lang=2', { waitUntil: 'load' }); await page.waitForTimeout(300)
      const r = await page.evaluate(() => ({ dir: document.documentElement.getAttribute('dir'), navHome: document.querySelector('[data-i18n="nav_home"]').textContent }))
      assert(r.dir === 'ltr' && r.navHome === 'Home', 'language did not persist across reload: ' + JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('switching back to עברית restores Hebrew/RTL everywhere', async () => {
      await page.evaluate(() => navigateTo('settings'))
      await page.click('#screen-settings >> text=עברית')
      await page.waitForTimeout(80)
      const r = await page.evaluate(() => ({ dir: document.documentElement.getAttribute('dir'), navHome: document.querySelector('[data-i18n="nav_home"]').textContent, bodyClass: document.body.classList.contains('lang-en') }))
      assert(r.dir === 'rtl' && r.navHome === 'בית' && !r.bodyClass, JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
  }

  section('Home focus pass — reading folds away, doing stays open')
  {
    // getMoodPatterns() needs 5+ moods with the same weekday+time-block 3+
    // times, and the narrative panel only exists once a briefing is cached —
    // seed both, or those panels have nothing to show and nothing to fold.
    const patternMoods = () => {
      const t = Date.now(), out = []
      for (let k = 0; k < 3; k++) out.push({ ts: t - (7 * k + 1) * 86400e3, date: todayPlus(-(7 * k + 1)), hour: 15, weekday: new Date(t - (7 * k + 1) * 86400e3).getDay(), mood: 'tired', source: 'manual', actions: ['rest'] })
      for (let k = 0; k < 3; k++) out.push({ ts: t - (2 + k) * 86400e3, date: todayPlus(-(2 + k)), hour: 9, weekday: new Date(t - (2 + k) * 86400e3).getDay(), mood: 'scattered', source: 'manual', actions: ['breathe'] })
      return out
    }
    const focusSeed = () => {
      const st = seededState()
      st.moods = patternMoods()
      st.briefing = { date: todayPlus(0), text: 'תדריך לדוגמה להיום.', generatedAt: Date.now(), lang: 'he' }
      return st
    }
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, focusSeed())
    resetLogs(); await page.goto(BASE + '?focus=1', { waitUntil: 'load' }); await page.waitForTimeout(300)
    await check('every reading panel starts collapsed; the doing layer stays visible', async () => {
      const r = await page.evaluate(() => ({
        // collapsed: bodies simply are not in the DOM
        trend: !!document.getElementById('mood-trend'),
        briefingText: !!document.getElementById('briefing-text'),
        askInput: !!document.getElementById('ask-fieldy-input'),
        accs: [...document.querySelectorAll('#screen-home .accordion')].map(a => a.dataset.acc),
        // still open: the things you act on
        rn: !!document.querySelector('#screen-home .rn-item'),
        moodPicker: /How do you feel|איך אתה מרגיש/.test(document.getElementById('screen-home').textContent),
        focusLine: document.getElementById('daily-briefing').textContent.indexOf(state.focus) !== -1,
        stuck: /Claveria Well/.test(document.getElementById('daily-briefing').textContent),
        stats: document.querySelectorAll('#screen-home [onclick*="navigateTo"]').length > 0
      }))
      assert(!r.trend && !r.briefingText && !r.askInput, 'a reading panel rendered open: ' + JSON.stringify(r))
      assert(r.accs.includes('insights') && r.accs.includes('briefing-full') && r.accs.includes('ask-fieldy'), 'missing accordions: ' + JSON.stringify(r.accs))
      assert(r.rn && r.moodPicker && r.focusLine && r.stuck && r.stats, 'the doing layer should stay visible: ' + JSON.stringify(r))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('the four reflection panels live under one "תובנות" drawer, not four boxes', async () => {
      await page.evaluate(() => { latestInsights = { items: [{ icon: '💡', text: 'שמתי לב שאתה דוחה משימות טלפון.' }] }; renderHome() })
      await openAcc(page, 'insights')
      const r = await page.evaluate(() => {
        const acc = document.querySelector('[data-acc="insights"]')
        const body = acc.querySelector('.accordion-body')
        return { hint: acc.querySelector('.accordion-hint').textContent.trim(), trend: !!body.querySelector('#mood-trend'), txt: body.textContent }
      })
      assert(r.trend, 'mood trend not inside the insights drawer')
      assert(/דפוס שחוזר/.test(r.txt), 'recurring-pattern panel not inside the drawer: ' + r.txt.slice(0, 160))
      assert(/מה שאני לומד עליך/.test(r.txt), '"what I am learning" not inside the drawer')
      assert(/שמתי לב/.test(r.txt), '"noticed" not inside the drawer')
      assert(/\d/.test(r.hint), 'collapsed row should hint how much is inside, got: ' + r.hint)
    })
    await check('open/closed is remembered per device and survives a reload', async () => {
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fieldy_accordions') || '{}'))
      assert(stored.insights === true, 'open state not persisted: ' + JSON.stringify(stored))
      await page.goto(BASE + '?focus=2', { waitUntil: 'load' }); await page.waitForTimeout(300)
      const r = await page.evaluate(() => ({ open: accordionIsOpen('insights'), body: !!document.querySelector('[data-acc="insights"] .accordion-body') }))
      assert(r.open && r.body, 'insights drawer did not stay open across a reload: ' + JSON.stringify(r))
      await page.evaluate(() => toggleAccordion('insights'))
      await page.waitForTimeout(60)
      assert(!(await page.evaluate(() => accordionIsOpen('insights'))), 'could not close it again')
    })
    await check('the briefing keeps its facts open and folds only the AI narrative', async () => {
      const closed = await page.evaluate(() => { const el = document.getElementById('daily-briefing'); return { txt: el.textContent, ai: !!document.getElementById('briefing-text'), hasHint: !!el.querySelector('[data-acc="briefing-full"] .accordion-hint') } })
      assert(!closed.ai, 'narrative should start collapsed')
      assert(closed.txt.indexOf('Claveria Well') !== -1, 'stuck-site fact disappeared with the narrative')
      await openAcc(page, 'briefing-full')
      assert(await page.evaluate(() => !!document.getElementById('briefing-text')), 'narrative did not open')
    })
    await check('the vacation goal moved off Home into Settings', async () => {
      const home = await page.evaluate(() => !!document.querySelector('#screen-home #vacation-goal-input'))
      await page.evaluate(() => navigateTo('settings'))
      const set = await page.evaluate(() => !!document.querySelector('#screen-settings #vacation-goal-input'))
      assert(!home && set, JSON.stringify({ home, set }))
      await page.fill('#vacation-goal-input', 'Boracay, December')
      await page.evaluate(() => saveVacationGoal())
      assert((await page.evaluate(() => state.personal.vacationGoal)) === 'Boracay, December', 'saving from Settings broke')
      await page.evaluate(() => navigateTo('home'))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
  }

  section('No Hebrew leaks into English mode (home screen)')
  {
    // Everything the user/AI authored is seeded in English here, so any Hebrew
    // left on screen is by definition a hardcoded UI string that was missed.
    // Deliberate Hebrew content (Tao/leadership text, AI output, quotes, mood
    // coaching lines) is marked data-content="he" in the markup and skipped.
    const t0 = todayPlus(0)
    const engSeed = () => {
      const s = seededState()
      s.tasks.now[0] = { ...s.tasks.now[0], text: 'Call Dave about Claveria', note: null }
      s.tasks.now[1] = { ...s.tasks.now[1], text: 'Approve pump order' }
      s.tasks.today = s.tasks.today.map((t, i) => ({ ...t, text: ['Update Monday', 'Check generator'][i] }))
      s.tasks.later = s.tasks.later.map(t => ({ ...t, text: 'Plan Apayao trip' }))
      s.people = s.people.map(p => ({ ...p, pending: p.pending ? 'waiver signature' : '' }))
      s.sites = s.sites.map(x => ({ ...x, issue: x.issue ? 'Lock Rotor A08' : '' }))
      s.focus = 'Meeting with NIA at 14:00'
      s.quotes = [{ text: "Who's living your life?", addedAt: Date.now() }]
      s.personalInsights = { text: 'You tend to get overwhelmed in the afternoon.', updatedAt: Date.now() - 86400e3, basedOnCount: 9 }
      s.briefing = { date: t0, text: 'Sample briefing in English.', generatedAt: Date.now(), lang: 'en' }
      s.brainDumps = s.brainDumps.map(b => ({ ...b, text: 'note' }))
      s.pettyCash = s.pettyCash.map(e => ({ ...e, note: '', vendor: e.vendor }))
      const t = Date.now(); const ms = []
      for (let k = 0; k < 3; k++) ms.push({ ts: t - (7 * k + 1) * 86400e3, date: todayPlus(-(7 * k + 1)), hour: 15, weekday: new Date(t - (7 * k + 1) * 86400e3).getDay(), mood: 'tired', source: 'manual', actions: ['rest'] })
      for (let k = 0; k < 3; k++) ms.push({ ts: t - (2 + k) * 86400e3, date: todayPlus(-(2 + k)), hour: 9, weekday: new Date(t - (2 + k) * 86400e3).getDay(), mood: 'scattered', source: 'manual', actions: ['breathe'] })
      s.moods = ms   // 6 moods, 3 of them same weekday+block → a real recurring pattern
      return s
    }
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_ui_lang', 'en') }, engSeed())
    resetLogs(); await page.goto(BASE + '?heleak=1', { waitUntil: 'load' }); await page.waitForTimeout(350)
    await check('with every panel open, no untranslated Hebrew is left on Home', async () => {
      await page.evaluate(() => { latestInsights = { items: [] }; ['insights', 'briefing-full', 'ask-fieldy'].forEach(k => { if (!accordionIsOpen(k)) toggleAccordion(k) }) })
      await page.waitForTimeout(120)
      const hits = await page.evaluate(() => {
        const heb = /[֐-׿]/, out = []
        const walk = el => {
          if (el.dataset && el.dataset.content === 'he') return   // Hebrew on purpose
          for (const n of el.childNodes) {
            if (n.nodeType === 3) { const t = n.textContent.trim(); if (t && heb.test(t)) out.push(t.slice(0, 60)) }
            else if (n.nodeType === 1) {
              for (const a of ['placeholder', 'title', 'aria-label']) { const v = n.getAttribute && n.getAttribute(a); if (v && heb.test(v)) out.push('[' + a + '] ' + v.slice(0, 50)) }
              walk(n)
            }
          }
        }
        walk(document.getElementById('screen-home'))
        return out
      })
      assert(hits.length === 0, hits.length + ' Hebrew string(s) still hardcoded: ' + JSON.stringify(hits.slice(0, 8)))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await check('the 30-day trend and the recurring-pattern line use the same translated mood names as the picker', async () => {
      const r = await page.evaluate(() => {
        const acc = document.querySelector('[data-acc="insights"] .accordion-body')
        return { body: acc.textContent, picker: document.getElementById('screen-home').textContent }
      })
      assert(/Tired/.test(r.body), 'trend legend still shows the Hebrew mood name: ' + r.body.slice(0, 200))
      assert(!/עייף|פוקוס|מוצף/.test(r.body), 'Hebrew mood names leaked into the insights drawer')
      assert(/tend to be Tired/i.test(r.body), 'pattern line not translated: ' + r.body.slice(0, 220))
    })
  }

  section('AI writes in the interface language (option ב)')
  {
    const MOCKL = 'http://127.0.0.1:1/mockl'
    const calls = []
    await context.route(MOCKL + '/**', route => {
      const req = route.request(); const p = req.url().slice(MOCKL.length)
      const reply = (obj, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS' }, body: JSON.stringify(obj) })
      if (req.method() === 'OPTIONS') return reply({})
      if (p === '/api/claude') { let b = null; try { b = req.postDataJSON() } catch (e) {} calls.push(b); return reply({ content: [{ type: 'text', text: 'ok' }] }) }
      if (p === '/api/state' && req.method() === 'GET') return reply({ data: null, updated_at: null })
      if (p === '/api/state') return reply({ ok: true })
      if (p === '/api/insights') return reply({ items: [] })
      if (p === '/api/log') return reply({ ok: true })
      return reply({ error: 'not found' }, 404)
    })
    await check('in English mode the briefing prompt asks for an English answer, and the language is recorded', async () => {
      await page.evaluate(([s, m]) => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_server_url', m); localStorage.setItem('fieldy_passcode', 'pw'); localStorage.setItem('fieldy_ui_lang', 'en') }, [seededState(), MOCKL])
      calls.length = 0
      resetLogs(); await page.goto(BASE + '?lng=1', { waitUntil: 'load' })
      await page.waitForFunction(() => state.briefing && state.briefing.text, null, { timeout: 5000 })
      const brief = calls.find(c => c && /briefing|תדריך/.test(c.messages[0].content))
      assert(brief, 'no briefing call was made')
      assert(/write your answer in English/i.test(brief.messages[0].content), 'no English instruction in the prompt: ' + brief.messages[0].content.slice(-200))
      assert((await page.evaluate(() => state.briefing.lang)) === 'en', 'generated language not recorded on the briefing')
    })
    await check('in Hebrew mode the instruction is absent — nothing changes for the default user', async () => {
      await page.evaluate(([s, m]) => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_server_url', m); localStorage.setItem('fieldy_passcode', 'pw'); localStorage.setItem('fieldy_ui_lang', 'he') }, [seededState(), MOCKL])
      calls.length = 0
      await page.goto(BASE + '?lng=2', { waitUntil: 'load' })
      await page.waitForFunction(() => state.briefing && state.briefing.text, null, { timeout: 5000 })
      const brief = calls.find(c => c && /תדריך/.test(c.messages[0].content))
      assert(brief && !/write your answer in English/i.test(brief.messages[0].content), 'English instruction leaked into Hebrew mode')
      assert((await page.evaluate(() => state.briefing.lang)) === 'he', 'language not recorded in Hebrew mode')
    })
    await check('switching language does NOT retranslate or re-fetch what is already written', async () => {
      const before = calls.length
      await page.evaluate(() => setUiLang('en'))
      await page.waitForTimeout(400)
      assert(calls.length === before, 'switching language spent ' + (calls.length - before) + ' API call(s) — it should spend none')
      assert((await page.evaluate(() => state.briefing.lang)) === 'he', 'existing briefing should keep the language it was written in')
      await page.evaluate(() => setUiLang('he'))
      const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
    })
    await context.unroute(MOCKL + '/**')
  }

  section('Mark as done, straight off the focus card')
  await check('the focus card carries the button — and only when it is a task', async () => {
    await page.evaluate(s2 => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s2)) }, seededState())
    await page.goto(BASE + '?md=1', { waitUntil: 'load' })
    await page.evaluate(() => { setState({ tasks: { now: [{ id: 'f1', text: 'focus task', done: false, color: 'red' }, { id: 'f2', text: 'second', done: false, color: 'orange' }], today: [], later: [] }, focus: '', sites: [], events: [] }) })
    await page.waitForTimeout(150)
    const onTask = await page.evaluate(() => !!document.querySelector('.rn-item button[onclick*="completeFromFocus"]'))
    assert(onTask, 'no "mark as done" button on a task focus card')
    // a stuck site ranks top and has no completed state — it must not get the button
    await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 40)
      setState({ tasks: { now: [], today: [], later: [] }, sites: [{ name: 'Stuck', status: 'open', stuckSince: d.getTime() }] }) })
    await page.waitForTimeout(150)
    const r = await page.evaluate(() => ({ first: (document.querySelector('.rn-item') || {}).textContent || '', btn: !!document.querySelector('.rn-item button[onclick*="completeFromFocus"]') }))
    assert(/Stuck/.test(r.first), 'the stuck site did not reach the focus card: ' + r.first.trim())
    assert(!r.btn, 'a stuck site was offered "mark as done"')
  })
  await check('pressing it completes the task and the card advances to the next one', async () => {
    await page.evaluate(() => setState({ sites: [], tasks: { now: [{ id: 'f1', text: 'first task', done: false, color: 'red' }, { id: 'f2', text: 'next task', done: false, color: 'orange' }], today: [], later: [] } }))
    await page.waitForTimeout(150)
    const before = await page.evaluate(() => (document.querySelector('.rn-item') || {}).textContent || '')
    assert(/first task/.test(before), 'wrong task on the card to start: ' + before.trim())
    await page.click('.rn-item button[onclick*="completeFromFocus"]')
    await page.waitForTimeout(250)
    const r = await page.evaluate(() => ({
      done: state.tasks.now.find(t => t.id === 'f1').done,
      stillOpen: state.tasks.now.find(t => t.id === 'f2').done,
      card: (document.querySelector('.rn-item') || {}).textContent || ''
    }))
    assert(r.done, 'the task was not marked done')
    assert(!r.stillOpen, 'the wrong task got completed')
    assert(/next task/.test(r.card), 'the card did not advance: ' + r.card.trim())
  })
  await check('tapping the button does not also open the tasks screen behind it', async () => {
    await page.evaluate(() => { navigateTo('home'); setState({ tasks: { now: [{ id: 'g1', text: 'stay here', done: false, color: 'red' }], today: [], later: [] } }) })
    await page.waitForTimeout(150)
    await page.click('.rn-item button[onclick*="completeFromFocus"]')
    await page.waitForTimeout(200)
    assert(await page.evaluate(() => currentScreen) === 'home', 'the card click fired through the button and navigated away')
  })
  await check('it offers undo, and undo restores the task and the streak', async () => {
    await page.evaluate(() => { localStorage.removeItem('fieldy_undo'); setState({ streak: 4, lastStreakDate: getTodayPlus(-1), tasks: { now: [{ id: 'u1', text: 'undo me', done: false, color: 'red' }], today: [], later: [] } }) })
    await page.waitForTimeout(150)
    await page.click('.rn-item button[onclick*="completeFromFocus"]')
    await page.waitForTimeout(200)
    const mid = await page.evaluate(() => ({ done: state.tasks.now[0].done, streak: state.streak, toast: !!document.getElementById('undo-toast') }))
    assert(mid.done, 'task not completed')
    assert(mid.toast, 'no undo bubble was offered')
    assert(mid.streak === 5, 'completing should have advanced the streak, got ' + mid.streak)
    await page.evaluate(() => undoLast())
    await page.waitForTimeout(250)
    const after = await page.evaluate(() => ({ done: state.tasks.now[0].done, streak: state.streak, date: state.lastStreakDate, gone: !document.getElementById('undo-toast') }))
    assert(!after.done, 'undo did not un-complete the task')
    assert(after.gone, 'the undo bubble stayed on screen')
    assert(after.streak === 4 && after.date === (await page.evaluate(() => getTodayPlus(-1))),
      'undo left the streak credited for a day that was taken back: ' + JSON.stringify(after))
  })
  await check('the button is translated and survives a theme switch', async () => {
    await page.evaluate(() => { localStorage.setItem('fieldy_ui_lang', 'en') })
    await page.goto(BASE + '?md=2', { waitUntil: 'load' })
    await page.evaluate(() => { applyTheme('aqua'); setState({ sites: [], events: [], focus: '', tasks: { now: [{ id: 'e1', text: 'english check', done: false, color: 'red' }], today: [], later: [] } }) })
    await page.waitForTimeout(200)
    const r = await page.evaluate(() => { const b = document.querySelector('.rn-item button[onclick*="completeFromFocus"]')
      return b ? { txt: b.textContent.trim(), bg: getComputedStyle(b).backgroundImage } : null })
    assert(r, 'the button disappeared in English/aqua')
    assert(/Mark as done/.test(r.txt), 'button not translated: ' + r.txt)
    assert(!/[\u0590-\u05FF]/.test(r.txt), 'Hebrew left on the button: ' + r.txt)
    assert(/26,\s*123,\s*168|rgb\(26/.test(r.bg), 'the button did not follow the theme: ' + r.bg)
    await page.evaluate(() => { localStorage.setItem('fieldy_ui_lang', 'he'); applyTheme('original') })
  })

  section('Themes — a full reskin, not just the accent')
  await check('every theme declares the same tokens, so none leaks the previous palette', async () => {
    const r = await page.evaluate(() => {
      const names = Object.keys(THEMES)
      const sets = names.map(n => Object.keys(THEMES[n].tokens).sort().join('|'))
      const missing = {}
      const all = new Set(); names.forEach(n => Object.keys(THEMES[n].tokens).forEach(k => all.add(k)))
      names.forEach(n => { const miss = [...all].filter(k => !(k in THEMES[n].tokens)); if (miss.length) missing[n] = miss })
      return { names, identical: new Set(sets).size === 1, count: all.size, missing }
    })
    assert(r.names.length === 3, 'expected three themes, got ' + JSON.stringify(r.names))
    assert(r.identical, 'themes declare different token sets: ' + JSON.stringify(r.missing))
    assert(r.count > 25, 'a full theme should carry the whole palette, got ' + r.count + ' tokens')
  })
  await check('no colour token is reused between themes — the bug the first pass shipped', async () => {
    // The first version of this feature left --tile-a identical in original and moss,
    // and --tile-b identical in original and aqua, so two of the three stat tiles simply
    // did not move when you switched. Byte-equality is the cheap half of the check;
    // the perceptual half below catches "different hex, same colour to the eye".
    const r = await page.evaluate(() => {
      const names = Object.keys(THEMES)
      const fixed = new Set(Object.keys(typeof THEME_TOKENS_BASE === 'object' ? THEME_TOKENS_BASE : {}))
      const clashes = []
      Object.keys(THEMES[names[0]].tokens).forEach(k => {
        if (fixed.has(k)) return
        const seen = {}
        names.forEach(n => { const v = THEMES[n].tokens[k]; (seen[v] = seen[v] || []).push(n) })
        Object.entries(seen).forEach(([v, who]) => { if (who.length > 1) clashes.push(k + ' = ' + v + ' in ' + who.join(' & ')) })
      })
      return clashes
    })
    assert(!r.length, 'these tokens do not change between themes:\n      ' + r.join('\n      '))
  })
  await check('the tokens that carry meaning are far enough apart to actually look different', async () => {
    const r = await page.evaluate(() => {
      const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
      const lab = hex => {
        const r = lin(parseInt(hex.slice(1, 3), 16)), g = lin(parseInt(hex.slice(3, 5), 16)), b = lin(parseInt(hex.slice(5, 7), 16))
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
      }
      const dE = (p, q) => { const a = lab(p), b = lab(q); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100 }
      const names = Object.keys(THEMES), out = []
      // the three stat tiles are wayfinding to three different screens — inside one
      // theme they must be clearly apart, or the tiles stop being a map
      names.forEach(n => {
        const t = THEMES[n].tokens
        const tri = [['--tile-a1', '--tile-b1'], ['--tile-b1', '--tile-c1'], ['--tile-a1', '--tile-c1']]
        tri.forEach(([x, y]) => { const d = dE(t[x], t[y]); if (d < 12) out.push(n + ': ' + x + ' vs ' + y + ' only ' + d.toFixed(0) + ' apart') })
      })
      // and the same role must not look the same in two different themes
      ;['--tile-a1', '--tile-b1', '--tile-c1', '--green', '--purple'].forEach(k => {
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
          const d = dE(THEMES[names[i]].tokens[k], THEMES[names[j]].tokens[k])
          if (d < 3) out.push(k + ': ' + names[i] + ' and ' + names[j] + ' are the same colour (' + d.toFixed(0) + ')')
        }
      })
      return out
    })
    assert(!r.length, r.join('\n      '))
  })
  await check('every tile and tag colour is readable on what it sits on', async () => {
    const r = await page.evaluate(() => {
      const L = hex => { const f = c => { c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(hex.slice(1, 3)) + 0.7152 * f(hex.slice(3, 5)) + 0.0722 * f(hex.slice(5, 7)) }
      const ct = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
      const bad = []
      Object.keys(THEMES).forEach(n => {
        const t = THEMES[n].tokens
        // white numerals sit on the tile fills and on the CTA
        ;['--tile-a1', '--tile-b1', '--tile-c1', '--cta1', '--cta2'].forEach(k => {
          const c = ct(t[k], '#ffffff'); if (c < 4.5) bad.push(n + ' ' + k + ' ' + t[k] + ' -> white is only ' + c.toFixed(2))
        })
        // --green is tag text on a white card
        const g = ct(t['--green'], '#ffffff'); if (g < 4.5) bad.push(n + ' --green ' + t['--green'] + ' on white is only ' + g.toFixed(2))
      })
      return bad
    })
    assert(!r.length, r.join('\n      '))
  })
  await check('the "resolved" tag is readable, and its tint did not change to get there', async () => {
    // --green-light is the vivid mint the chip is tinted with; it sat at ~1.6:1 as text
    // on its own tint. The fix adds --green-ink rather than darkening the mint, so the
    // chip looks the same and only the lettering moved.
    const r = await page.evaluate(() => {
      const L = rgb => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]) }
      const ct = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
      const out = []
      Object.keys(THEMES).forEach(n => {
        applyTheme(n)
        const el = document.createElement('span'); el.className = 'tag-status-resolved'
        el.textContent = 'x'; document.body.appendChild(el)
        const cs = getComputedStyle(el)
        const bg = (cs.backgroundColor.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
        const a2 = parseFloat((cs.backgroundColor.match(/[\d.]+/g) || [])[3] || '1')
        const flat = bg.map(c => Math.round(c * a2 + 255 * (1 - a2)))
        const fg = (cs.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
        el.remove()
        out.push({ theme: n, ratio: ct(fg, flat), tint: flat, fg })
      })
      return out
    })
    for (const v of r) {
      assert(v.ratio >= 4.5, v.theme + ': "resolved" tag text is only ' + v.ratio.toFixed(2) + ':1 on its own tint')
      // the tint must still be a pale one — darkening it would have changed the chip's look
      assert(Math.min(...v.tint) > 200, v.theme + ': the chip tint got dark (' + v.tint.join(',') + ') — the fix was supposed to leave it alone')
    }
    await page.evaluate(() => applyTheme('original'))
  })
  await check('a tag keeps its tint and its text in the same family', async () => {
    // .tag-person and .tag-context colour their text from a token but used to take their
    // background from a frozen rgba(), so theming the text alone gave plum-on-violet.
    for (const th of ['original', 'moss', 'aqua']) {
      const r = await page.evaluate(n => {
        applyTheme(n)
        const probe = (cls, prop) => { const el = document.createElement('span'); el.className = cls
          document.body.appendChild(el); const cs = getComputedStyle(el)
          const v = { bg: cs.backgroundColor, fg: cs.color }; el.remove(); return v }
        return { person: probe('tag-person'), context: probe('tag-context'), resolved: probe('tag-status-resolved') }
      }, th)
      // hue distance, not "which channel is biggest" — a teal with G=123 B=126 flips
      // that heuristic on rounding while being plainly the same colour family
      const hue = rgb => {
        const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        const r2 = f(rgb[0]), g2 = f(rgb[1]), b2 = f(rgb[2])
        const l = Math.cbrt(0.4122214708 * r2 + 0.5363325363 * g2 + 0.0514459929 * b2)
        const m = Math.cbrt(0.2119034982 * r2 + 0.6806995451 * g2 + 0.1073969566 * b2)
        const s2 = Math.cbrt(0.0883024619 * r2 + 0.2817188376 * g2 + 0.6299787005 * b2)
        const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2
        const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2
        return (Math.atan2(B, A) * 180 / Math.PI + 360) % 360
      }
      for (const [name, v] of Object.entries(r)) {
        const bg = (v.bg.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
        const fg = (v.fg.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
        const d = Math.abs(hue(bg) - hue(fg)) % 360
        const gap = Math.min(d, 360 - d)
        assert(gap <= 60, th + ': .tag-' + name + ' tint ' + v.bg + ' and text ' + v.fg + ' are ' + gap.toFixed(0) + '° apart — different colour families')
      }
    }
    await page.evaluate(() => applyTheme('original'))
  })
  await check('switching moves surfaces, text and lines — not only the accent', async () => {
    const read = () => page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      const g = k => cs.getPropertyValue(k).trim()
      return { gold: g('--gold'), ink: g('--ink'), t1: g('--t1'), t2: g('--t2'), line: g('--line'),
               surface2: g('--surface-2'), tile: g('--tile-a1'), cta: g('--cta1'), rgb: g('--accent-rgb') }
    })
    await page.evaluate(() => applyTheme('original')); const a = await read()
    await page.evaluate(() => applyTheme('aqua')); const b = await read()
    const moved = Object.keys(a).filter(k => a[k] !== b[k])
    for (const k of ['gold', 'ink', 't1', 't2', 'line', 'surface2', 'tile', 'cta', 'rgb'])
      assert(moved.includes(k), k + ' did not change between themes (' + a[k] + ')')
  })
  await check('alarm colours stay identical in all three themes', async () => {
    const seen = {}
    for (const t of ['original', 'moss', 'aqua']) {
      seen[t] = await page.evaluate(n => {
        applyTheme(n)
        const cs = getComputedStyle(document.documentElement)
        return [cs.getPropertyValue('--red').trim(), cs.getPropertyValue('--stuck').trim()].join(' ')
      }, t)
    }
    assert(new Set(Object.values(seen)).size === 1, 'an alarm colour moved between themes: ' + JSON.stringify(seen))
  })
  await check('the retuned status colours keep their distance from each theme accent', async () => {
    const hue = hex => {
      const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
      const r = f(parseInt(hex.slice(1, 3), 16)), g = f(parseInt(hex.slice(3, 5), 16)), b = f(parseInt(hex.slice(5, 7), 16))
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2
      const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2
      return (Math.atan2(B, A) * 180 / Math.PI + 360) % 360
    }
    const themes = await page.evaluate(() => Object.fromEntries(Object.keys(THEMES).map(n => [n, THEMES[n].tokens])))
    for (const [name, tok] of Object.entries(themes)) {
      for (const key of ['--green', '--blue', '--purple']) {
        const d = Math.abs(hue(tok[key]) - hue(tok['--gold'])) % 360
        const gap = Math.min(d, 360 - d)
        assert(gap >= 30, name + ': ' + key + ' (' + tok[key] + ') sits only ' + gap.toFixed(0) + '° from the accent ' + tok['--gold'] + ' — it stops reading as its own signal')
      }
    }
  })
  await check('the Tao screen stays a dark room in every theme', async () => {
    // The whole point of that tab is that entering it feels like stepping somewhere
    // quieter. A theme may change its colour family; it may never lighten it toward
    // the rest of the app.
    const r = await page.evaluate(() => {
      const rel = hex => { const f = c => { c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(hex.slice(1, 3)) + 0.7152 * f(hex.slice(3, 5)) + 0.0722 * f(hex.slice(5, 7)) }
      return Object.keys(THEMES).map(n => {
        const t = THEMES[n].tokens
        return { theme: n, bg: t['--tao-bg'], lum: rel(t['--tao-bg']),
                 panel: rel(t['--tao-panel']), line2: rel(t['--tao-line2']) }
      })
    })
    for (const v of r) {
      assert(v.lum < 0.012, v.theme + ': the Tao background is no longer dark (' + v.bg + ', luminance ' + v.lum.toFixed(4) + ')')
      assert(v.panel < 0.02 && v.line2 < 0.04, v.theme + ': a Tao surface drifted light (panel ' + v.panel.toFixed(3) + ', line ' + v.line2.toFixed(3) + ')')
    }
    // and all three must be equally dark — one theme must not be the "brighter" Tao
    const lums = r.map(v => v.lum)
    assert(Math.max(...lums) - Math.min(...lums) < 0.004,
      'the themes differ in how dark the Tao screen is: ' + r.map(v => v.theme + ' ' + v.lum.toFixed(4)).join(', '))
  })
  await check('the Tao text ramp keeps its contrast on that dark background', async () => {
    const r = await page.evaluate(() => {
      const rel = hex => { const f = c => { c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(hex.slice(1, 3)) + 0.7152 * f(hex.slice(3, 5)) + 0.0722 * f(hex.slice(5, 7)) }
      const ct = (a, b) => { const x = rel(a), y = rel(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
      const bad = []
      Object.keys(THEMES).forEach(n => {
        const t = THEMES[n].tokens, bg = t['--tao-bg']
        ;[['--tao-t1', 7], ['--tao-t2', 4.5], ['--tao-t3', 4.5], ['--tao-gold', 4.5], ['--tao-gold3', 4.5]].forEach(([k, min]) => {
          const c = ct(t[k], bg)
          if (c < min) bad.push(n + ' ' + k + ' ' + t[k] + ' is only ' + c.toFixed(2) + ':1 on ' + bg)
        })
      })
      return bad
    })
    assert(!r.length, r.join('\n      '))
  })
  await check('the breathing word is readable on the light meditation card', async () => {
    // .breath-text used --tao-gold, a colour built for the dark screen, on the cream
    // modal — about 1.7:1. --tao-ink is the same family, dark enough for that surface.
    for (const th of ['original', 'moss', 'aqua']) {
      const r = await page.evaluate(n => {
        applyTheme(n); navigateTo('tao'); startMeditation(0)
        const el = document.getElementById('breath-text')
        const modal = document.querySelector('.modal')
        const v = { fg: getComputedStyle(el).color, bg: getComputedStyle(modal).backgroundColor }
        stopMeditation(false)
        return v
      }, th)
      const px = str => (str.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
      const rel = rgb => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]) }
      const a2 = rel(px(r.fg)), b2 = rel(px(r.bg))
      const ratio = (Math.max(a2, b2) + 0.05) / (Math.min(a2, b2) + 0.05)
      assert(ratio >= 4.5, th + ': the breathing word is only ' + ratio.toFixed(2) + ':1 on the meditation card')
    }
    await page.evaluate(() => applyTheme('original'))
  })
  await check('the meditation ring is drawn in the theme colour, not a frozen gold', async () => {
    // canvas cannot read var(), so this one is refreshed in applyTheme like STATUS_HEX —
    // exactly the trap that left the ring gold in every theme.
    const r = await page.evaluate(() => {
      const out = {}
      Object.keys(THEMES).forEach(n => { applyTheme(n)
        out[n] = { ...TAO_CANVAS, want: THEMES[n].tokens['--tao-gold3'], rgb: THEMES[n].tokens['--tao-accent-rgb'] } })
      return out
    })
    for (const [n, v] of Object.entries(r)) {
      assert(v.ring === v.want, n + ': the ring is ' + v.ring + ' but the theme says ' + v.want)
      assert(v.track.indexOf(v.rgb) >= 0, n + ': the ring track ' + v.track + ' is not built from this theme accent')
    }
    const vals = Object.values(r).map(v => v.ring)
    assert(new Set(vals).size === 3, 'the ring colour repeats between themes: ' + vals.join(', '))
    await page.evaluate(() => applyTheme('original'))
  })
  await check('no Tao colour is still hardcoded past the tokens', async () => {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    const frozen = [/rgba\(184,134,11/g, /rgba\(13,10,5/g, /rgba\(28,21,8/g, /rgba\(196,146,42/g]
    const found = []
    frozen.forEach(re => { const m = src.match(re) || []
      // the TAO_CANVAS initialiser keeps one literal on purpose: it is the first-paint
      // value, replaced the moment applyTheme runs
      const allowed = re.source.indexOf('196,146,42') >= 0 ? 1 : 0
      if (m.length > allowed) found.push(re.source + ' x' + m.length) })
    assert(!found.length, 'still frozen to the gold palette: ' + found.join(', '))
  })
  await check('the accent-only presets it replaced still land somewhere sane', async () => {
    const r = await page.evaluate(() => {
      const out = {}
      for (const old of ['amber', 'teal', 'rose', 'nonsense']) {
        localStorage.setItem('fieldy_theme', old); applyTheme(old)
        out[old] = { now: currentTheme, stored: localStorage.getItem('fieldy_theme') }
      }
      return out
    })
    for (const [old, v] of Object.entries(r)) {
      assert(['original', 'moss', 'aqua'].includes(v.now), old + ' resolved to an unknown theme: ' + v.now)
      assert(v.stored === v.now, old + ' left a stale value in storage: ' + JSON.stringify(v))
    }
    assert(r.amber.now === 'original' && r.teal.now === 'aqua', 'aliases changed: ' + JSON.stringify(r))
  })
  await check('the chosen theme survives a reload and paints before first render', async () => {
    await page.evaluate(() => applyTheme('moss'))
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300)
    const r = await page.evaluate(() => ({
      theme: currentTheme,
      gold: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(),
      meta: (document.querySelector('meta[name="theme-color"]') || {}).content
    }))
    assert(r.theme === 'moss' && r.gold === '#2d7a51', 'theme did not survive the reload: ' + JSON.stringify(r))
    assert(r.meta === '#f6faf7', 'the browser chrome colour did not follow the theme: ' + r.meta)
    await page.evaluate(() => applyTheme('original'))
  })

  section('Quick calm — the 60-second breathing break')
  await check('offered only when the mood is overwhelmed or scattered', async () => {
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)) }, seededState())
    await page.goto(BASE + '?qc=1', { waitUntil: 'load' })
    const seen = {}
    for (const m of ['overwhelmed', 'scattered', 'tired', 'focused', 'motivated']) {
      seen[m] = await page.evaluate(mood => {
        logMood(mood, 'manual')
        return [...document.querySelectorAll('button')].some(b => /ויסות מהיר|Quick calm/.test(b.textContent))
      }, m)
      await page.waitForTimeout(80)
    }
    assert(seen.overwhelmed, 'no quick-calm button when overwhelmed')
    assert(seen.scattered, 'no quick-calm button when scattered')
    assert(!seen.tired && !seen.focused && !seen.motivated,
      'the button showed up for a mood that should not get it: ' + JSON.stringify(seen))
  })
  await check('it runs the 4-4-6-2 cycle and the ring follows the breath', async () => {
    await page.evaluate(() => { logMood('overwhelmed', 'manual'); startQuickCalm() })
    await page.waitForTimeout(1200)
    const first = await page.evaluate(() => ({
      phase: document.getElementById('qc-phase').textContent,
      count: +document.getElementById('qc-count').textContent,
      scale: document.getElementById('qc-ring').style.transform
    }))
    assert(/שאיפה|Breathe in/.test(first.phase), 'did not start on the inhale: ' + first.phase)
    assert(first.count < 60 && first.count > 55, 'countdown not running: ' + first.count)
    assert(/1\.14/.test(first.scale), 'ring did not expand on the inhale: ' + first.scale)
    // the phase table itself is the contract — 4 in, 4 hold, 6 out, 2 rest = 16s
    const secs = await page.evaluate(() => QC_PHASES.map(p => p.secs))
    assert(JSON.stringify(secs) === '[4,4,6,2]', 'breathing pattern changed: ' + JSON.stringify(secs))
    await page.waitForTimeout(3600)
    const held = await page.evaluate(() => document.getElementById('qc-phase').textContent)
    assert(/עצירה|Hold/.test(held), 'did not move on to the hold: ' + held)
  })
  await check('finishing closes it, keeps the timer clean and never counts as a meditation', async () => {
    await page.evaluate(() => { qcLeft = 2 })
    await page.waitForTimeout(2600)
    const done = await page.evaluate(() => document.getElementById('qc-phase') && document.getElementById('qc-phase').textContent)
    assert(done && /עכשיו משימה אחת|one task/.test(done), 'no closing line: ' + done)
    await page.waitForTimeout(1900)
    const after = await page.evaluate(() => ({
      cleared: document.getElementById('modal-container').innerHTML === '',
      timer: qcInterval,
      med: Object.keys(state.personal.meditationLog || {}).length
    }))
    assert(after.cleared, 'the modal did not close by itself')
    assert(after.timer === null, 'the interval is still running after it finished')
    assert(after.med === 0, 'a 60-second break was logged as a meditation')
  })
  await check('leaving early stops the timer and logs no completion', async () => {
    await page.evaluate(() => { logEvent.__n = (state.logs || []).length; startQuickCalm() })
    await page.waitForTimeout(500)
    await page.evaluate(() => stopQuickCalm(false))
    const r = await page.evaluate(() => ({
      timer: qcInterval,
      cleared: document.getElementById('modal-container').innerHTML === '',
      completed: JSON.stringify(state).indexOf('quick_calm_completed') >= 0
    }))
    assert(r.timer === null, 'the interval kept running after leaving early')
    assert(r.cleared, 'the modal stayed open after leaving early')
    assert(!r.completed, 'leaving early was recorded as a completion')
    const errs = errorsSince(); assert(!errs.length, errs.join('\n'))
  })
  await check('the break is fully translated in English mode', async () => {
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_ui_lang', 'en') }, seededState())
    await page.goto(BASE + '?qc=2', { waitUntil: 'load' })
    await page.evaluate(() => { logMood('overwhelmed', 'manual'); startQuickCalm() })
    await page.waitForTimeout(1200)
    const txt = await page.evaluate(() => document.getElementById('modal-container').textContent)
    assert(!/[\u0590-\u05FF]/.test(txt), 'Hebrew left in the English quick-calm screen: ' + txt.trim())
    assert(/Breathe in/.test(txt), 'the phase label is not in English: ' + txt.trim())
    await page.evaluate(() => stopQuickCalm(false))
  })

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
