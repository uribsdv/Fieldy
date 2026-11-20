#!/usr/bin/env node
// The Ease tab (בקלות), inspired by Alan Watts: the fifth tab of the Tao screen.
// Checks: the tab is there and opens; all 16 cards have a title, a line, an idea, a question and a practice in both
// languages; the Hebrew and the English differ and the English holds no Hebrew; the idea and the "what if" of the week
// follow the week number alone; nothing on the tab counts, marks as read or keeps a streak (and nothing is stored
// when cards are opened); cards open and close in place; no page errors; nothing wider than a 360px screen.
// Run: node tests/watts-tab.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), {execSync} = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch(e) {} try { return require(path.join(execSync('npm root -g', {encoding: 'utf8'}).trim(), 'playwright')) } catch(e) {} console.error('✕ playwright not found'); process.exit(2) }
const {chromium} = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const snap = fs.readFileSync(path.join(__dirname, 'snapshots.cjs'), 'utf8')
const seededState = new Function(snap.slice(snap.indexOf('function todayPlus'), snap.indexOf('// Each scene')) + '\nreturn seededState')()
let pass = 0, fail = 0; const ok = (c, m) => { if(c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✕', m) } }
const HEB = /[֐-׿]/
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if(!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if(!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, {'Content-Type': {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp'}[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r) }); s.listen(0, () => res(s)) }) }

;(async () => {
  const srv = await serve(), B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot(lang, width) {
    const ctx = await br.newContext({viewport: {width: width || 390, height: 844}}), pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.goto(B); await pg.evaluate(([st, lang]) => { localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(st)); localStorage.setItem('fieldy_theme', 'jungle'); localStorage.setItem('fieldy_ui_lang', lang); localStorage.setItem('fieldy_tao_mode', 'tao') }, [seededState(), lang])
    await pg.goto(B); await pg.waitForTimeout(600); await pg.evaluate(() => navigateTo('tao')); await pg.waitForTimeout(300); return pg
  }

  console.log('content')
  const pg = await boot('he')
  const content = await pg.evaluate(() => ({W: WATTS_CONTENT, cards: WATTS_CARD_KEYS, whatifs: WATTS_WHATIF_KEYS}))
  ok(content.cards.length === 16 && new Set(content.cards).size === 16, '16 cards, each key once')
  const FIELDS = ['title', 'line', 'idea', 'q', 'try'], empty = [], same = [], hebInEn = [], noHebInHe = []
  for(const k of content.cards) { const e = content.W[k] || {}; for(const f of FIELDS) for(const l of ['he', 'en']) { const v = e[l] && e[l][f]; if(typeof v !== 'string' || !v.trim()) empty.push(k + '.' + l + '.' + f) }
    for(const f of FIELDS) { const he = e.he && e.he[f], en = e.en && e.en[f]; if(he && en && he === en) same.push(k + '.' + f); if(en && HEB.test(en)) hebInEn.push(k + '.' + f); if(he && !HEB.test(he)) noHebInHe.push(k + '.' + f) } }
  ok(!empty.length, 'every card has title, line, idea, question and practice in Hebrew and English' + (empty.length ? ': missing ' + empty.join(', ') : ''))
  ok(!same.length, 'Hebrew and English differ in every field' + (same.length ? ': ' + same.join(', ') : ''))
  ok(!hebInEn.length, 'no Hebrew in the English' + (hebInEn.length ? ': ' + hebInEn.join(', ') : ''))
  ok(!noHebInHe.length, 'the Hebrew is Hebrew' + (noHebInHe.length ? ': ' + noHebInHe.join(', ') : ''))
  const wi = content.whatifs.map(k => content.W[k] || {})
  ok(content.whatifs.length >= 6 && wi.every(e => typeof e.he === 'string' && HEB.test(e.he) && typeof e.en === 'string' && e.en.trim() && !HEB.test(e.en) && e.en !== e.he), content.whatifs.length + ' "what if" questions, each in both languages')
  const nothing = content.W.watts_nothing || {}
  ok(nothing.he && nothing.en && nothing.he.title && nothing.en.title && nothing.he.title !== nothing.en.title && !HEB.test(nothing.en.idea || 'א'), 'the "allowed to do nothing" card in both languages')
  const ideaLines = content.cards.filter(k => { const n = content.W[k].he.idea.split(/(?<=[.?!])\s+/).length; return n < 3 })
  ok(!ideaLines.length, 'each idea runs at least three sentences' + (ideaLines.length ? ': ' + ideaLines.join(', ') : ''))
  // about life, not work: no work words, no pointer to another screen of the app (the same lists as i18n-coverage)
  const WORK_EN = /\b(sites?|contractors?|tasks?|projects?|meetings?|SPIS|screens?|tabs?|apps?|Loki|leadership|calendar)\b/i
  const WORK_HE = /(^|[^\u05D0-\u05EA])[והבלמשכ]{0,2}(אתר|אתרים|קבלן|קבלנים|משימה|משימות|פרויקט|פרויקטים|פגישה|פגישות|מסך|מסכים|לשונית|אפליקציה|לוקי|מנהיגות|לוח)(?![\u05D0-\u05EA])/
  const allKeys = content.cards.concat(content.whatifs, ['watts_nothing']), workHits = []
  for(const k of allKeys) { const e = content.W[k], vals = l => typeof e[l] === 'string' ? [e[l]] : Object.values(e[l] || {})
    for(const v of vals('en')) { const m = String(v).match(WORK_EN); if(m) workHits.push(k + ' (en): ' + m[0]) }
    for(const v of vals('he')) { const m = String(v).match(WORK_HE); if(m) workHits.push(k + ' (he): ' + m[0].trim()) } }
  ok(!workHits.length, 'no work words (site, contractor, task, project, meeting, SPIS…) and no pointer to another screen' + (workHits.length ? ': ' + workHits.join(', ') : ''))
  ok(content.cards.every(k => ['title', 'line', 'idea', 'q', 'try'].every(f => Object.keys(content.W[k].he).includes(f)) && !('tryJungle' in content.W[k].he) && !('tryJungle' in content.W[k].en)), 'no theme-dependent practice (every card reads the same everywhere)')
  const named = content.cards.concat(content.whatifs, ['watts_nothing']).filter(k => /watts|ווטס/i.test(JSON.stringify(content.W[k])))
  ok(!named.length, 'no card puts words in Watts\'s mouth (his name is only in the subtitle and footnote)' + (named.length ? ': ' + named.join(', ') : ''))

  console.log('\nthe week')
  const det = await pg.evaluate(() => { const out = []; for(let w = 2800; w < 2900; w++) out.push([easeWeekCard(w), easeWeekCard(w), WATTS_CARD_KEYS[w % WATTS_CARD_KEYS.length], easeWeekWhatif(w), easeWeekWhatif(w), WATTS_WHATIF_KEYS[w % WATTS_WHATIF_KEYS.length]]); return out })
  ok(det.every(r => r[0] === r[1] && r[1] === r[2] && r[3] === r[4] && r[4] === r[5]), 'the idea and the "what if" of the week are the week number modulo the list, the same every time')
  ok(new Set(det.slice(0, 16).map(r => r[0])).size === 16, 'sixteen weeks in a row show sixteen different ideas')
  const sameWeek = await pg.evaluate(() => { const d = new Date(getToday()), day = Math.floor(d.getTime() / 86400000); return Math.floor(day / 7) === easeWeek() })
  ok(sameWeek, 'the week is counted from today\'s date alone')

  console.log('\nthe tab (Hebrew)')
  const tabBtn = await pg.$('#screen-tao .tao-subnav-btn[data-mode="ease"]')
  ok(!!tabBtn, 'a fifth tab "בקלות" on the Tao screen')
  ok(await pg.evaluate(() => [...document.querySelectorAll('#screen-tao div > .tao-subnav-btn[data-mode]')].slice(0, 5).map(b => b.dataset.mode).join() === 'tao,lead,adhd,talk,ease'), 'it comes after Talk')
  const before = await pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, k === 'fieldy_tao_mode' ? '' : localStorage.getItem(k)])))
  if(tabBtn) await tabBtn.click(); await pg.waitForTimeout(200)
  ok(await pg.evaluate(() => !!document.getElementById('ease-tab')), 'the tab opens')
  const order = await pg.evaluate(() => ['ease-week', 'ease-whatif', 'ease-cards', 'ease-nothing', 'ease-footnote'].map(id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top + document.getElementById('screen-tao').scrollTop : -1 }))
  ok(order.every((y, i) => y >= 0 && (i === 0 || y > order[i - 1])), 'top to bottom: idea of the week, what if, all ideas, allowed to do nothing, footnote')
  ok(await pg.evaluate(() => document.getElementById('ease-week').dataset.key === easeWeekCard() && document.getElementById('ease-whatif').dataset.key === easeWeekWhatif()), 'it shows this week\'s idea and "what if"')
  ok(await pg.evaluate(() => { const w = document.getElementById('ease-week'); return !!w.querySelector('.ease-q') && !!w.querySelector('.ease-try') }), 'the idea of the week is open in full')
  ok(await pg.evaluate(() => document.querySelectorAll('#ease-cards .ease-card').length === 16 && document.querySelectorAll('#ease-cards .ease-body').length === 0), 'sixteen cards, all closed')
  ok(await pg.evaluate(() => [...document.querySelectorAll('#ease-cards .ease-card')].every(c => c.querySelector('.ease-title').textContent.trim() && c.querySelector('.ease-line').textContent.trim())), 'a closed card shows a title and one line')
  ok(await pg.evaluate(() => document.getElementById('ease-tab').textContent.includes('בהשראת אלן ווטס') && document.getElementById('ease-footnote').textContent.trim() === 'נכתב במילים של Fieldy, בהשראת אלן ווטס. אין כאן ציטוטים.'), 'subtitle and footnote in Hebrew')
  await pg.click('.ease-toggle[data-key="watts_breath"]'); await pg.waitForTimeout(100)
  ok(await pg.evaluate(() => { const c = document.querySelector('.ease-card[data-key="watts_breath"]'); return c.querySelector('.ease-toggle').getAttribute('aria-expanded') === 'true' && !!c.querySelector('.ease-body .ease-q') && !!c.querySelector('.ease-body .ease-try') && document.querySelectorAll('#ease-cards .ease-body').length === 1 }), 'a tap opens the full card (idea, question, practice)')
  await pg.click('.ease-toggle[data-key="watts_breath"]'); await pg.waitForTimeout(100)
  ok(await pg.evaluate(() => document.querySelectorAll('#ease-cards .ease-body').length === 0 && document.querySelector('.ease-toggle[data-key="watts_breath"]').getAttribute('aria-expanded') === 'false'), 'a second tap closes it')
  ok(await pg.evaluate(() => [...document.querySelectorAll('#ease-tab button')].every(b => b.classList.contains('ease-toggle'))), 'no buttons on the tab but open and close')
  ok(await pg.evaluate(() => document.querySelectorAll('#ease-tab a, #ease-tab [onclick], #ease-tab [data-mode], #ease-tab [data-go]').length === 0), 'nothing on the tab links to another screen')
  ok(await pg.evaluate(() => document.querySelectorAll('#ease-nothing button, #ease-nothing input, #ease-nothing a').length === 0), 'the "nothing" card has no control at all')
  for(const k of ['watts_hide_seek', 'watts_falling', 'watts_breath']) await pg.click('.ease-toggle[data-key="' + k + '"]')
  const after = await pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, k === 'fieldy_tao_mode' ? '' : localStorage.getItem(k)])))
  ok(before === after, 'opening the tab and its cards stores nothing (no read marks, no counters)')
  const COUNT = /\d+\s*(\/|מתוך|of)\s*\d+|נקרא|קראת|רצף|streak|\bread\b|completed|הושלמ/i
  const heText = await pg.evaluate(() => document.getElementById('ease-tab').innerText)
  ok(!COUNT.test(heText) && !/\d/.test(heText), 'no counters, read marks or streaks in the Hebrew tab' + (COUNT.test(heText) ? ': ' + heText.match(COUNT)[0] : ''))
  ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join('|') : ''))

  console.log('\nthe tab (English, 360px)')
  const en = await boot('en', 360)
  await en.click('#screen-tao .tao-subnav-btn[data-mode="ease"]'); await en.waitForTimeout(200)
  await en.click('.ease-toggle[data-key="watts_spotlight"]'); await en.waitForTimeout(100)
  const enText = await en.evaluate(() => document.getElementById('ease-tab').innerText)
  ok(enText.includes('Ease') && enText.includes('Inspired by Alan Watts') && enText.includes("Written in Fieldy's own words, inspired by Alan Watts. No quotations."), 'title, subtitle and footnote in English')
  ok(!HEB.test(enText), 'no Hebrew on the English tab')
  ok(!COUNT.test(enText) && !/\d/.test(enText), 'no counters, read marks or streaks in the English tab' + (COUNT.test(enText) ? ': ' + enText.match(COUNT)[0] : ''))
  const fit = await en.evaluate(() => { const r = [...document.querySelectorAll('#screen-tao div > .tao-subnav-btn[data-mode]')].slice(0, 5).map(b => { const s = b.querySelector('span'); return s.scrollWidth <= b.clientWidth }); return {tabs: r.every(Boolean), wide: document.documentElement.scrollWidth <= 360 && [...document.querySelectorAll('#ease-tab *')].every(e => e.getBoundingClientRect().right <= 361 && e.getBoundingClientRect().left >= -1)} })
  ok(fit.tabs, 'every tab label fits its tab at 360px')
  ok(fit.wide, 'nothing on the tab is wider than the screen at 360px')
  ok(en.errs.length === 0, 'no page errors' + (en.errs.length ? ': ' + en.errs.join('|') : ''))

  await br.close(); srv.close(); console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); process.exit(fail ? 1 : 0)
})()
