#!/usr/bin/env node
// The lines of the mood panel (claude/feelings-art-swap): every one of the 24 feelings has 1-3 short "if you like" lines and one if-then
// plan (MOOD_LIB.ifthen, shown in the jungle as its own row, labelled); wording limits; no panel left empty; text 4.5:1 on the real
// pixels; the old themes are unchanged (no if-then row). Run: node tests/feelings-recs.cjs   (ROOT=<dir> for another checkout)
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
const FIVE = ['overwhelmed', 'scattered', 'tired', 'focused', 'motivated']
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot(theme = 'jungle') {
    const ctx = await br.newContext({ viewport: { width: 390, height: 1400 } }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    const s = seededState()
    await pg.addInitScript(([s, t]) => { if (sessionStorage.getItem('fe_seeded')) return; sessionStorage.setItem('fe_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_loki_roam', '0')
      localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10)); localStorage.setItem('fieldy_loki_v1', JSON.stringify({ v: 1, bag: {}, last: {}, hardAt: 0, hardDays: {}, hugs: 0, firstDay: '2026-01-01', lastSeen: Date.now() - 60000 })) }, [s, theme])
    await pg.goto(B + '?gnomeHour=9'); await pg.waitForTimeout(600); return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  const words = t => t.trim().split(/\s+/).length
  let pg = await boot(), r
  const lib = await pg.evaluate(() => Object.keys(MOOD_LIB).map(k => ({ k, more: !!MOOD_LIB[k].more, actions: MOOD_LIB[k].actions, ifthen: MOOD_LIB[k].ifthen })))
  head('the content: 24 feelings')
  ok(lib.length === 24, 'there are 24 feelings')
  ok(lib.every(d => d.actions.length >= 1 && typeof d.ifthen === 'string' && d.ifthen.length > 0), 'each has at least one line and an if-then plan')
  ok(lib.filter(d => d.more).every(d => d.actions.length <= 3), 'the nineteen new ones have at most three lines (the original five show three of their own, below)')
  ok(lib.filter(d => d.more).every(d => d.actions.every(a => /^אם בא לך, /.test(a))), 'each new line is "if you like"')
  const long = lib.flatMap(d => (d.more ? d.actions : []).filter(a => words(a) > 12).map(a => d.k + ': ' + a)).concat(lib.filter(d => words(d.ifthen) > 16).map(d => d.k + ' ifthen'))
  ok(long.length === 0, 'the lines are 12 words or fewer, the if-then 16 or fewer' + (long.length ? ' — too long: ' + long.join(' | ') : ''))
  const bad = lib.flatMap(d => (d.more ? d.actions : []).concat(d.ifthen).filter(t => /חייב|מחקרים|הוכיח|אבחנ|תרופ|מחלה|כדאי לך|צריך/.test(t)).map(t => d.k + ': ' + t))
  ok(bad.length === 0, 'no "must", no "studies proved", no medical claim, no diagnosis in the new text' + (bad.length ? ': ' + bad.join(' | ') : ''))
  const ifthenRe = /^(אם|כש)/
  ok(lib.every(d => ifthenRe.test(d.ifthen)), 'each plan is an if–then ("אם…" / "כש…")')
  
  await done(pg)

  head('the panel in the jungle: the lines, the plan as its own row, nothing empty')
  pg = await boot()
  const rows = await pg.evaluate(() => {
    const out = {}
    Object.keys(MOOD_LIB).forEach(k => {
      state.moods.push({ ts: Date.now(), date: getToday(), hour: 10, weekday: 1, mood: k, source: 'manual', actions: MOOD_LIB[k].actions.slice(0, 3) }); moodPanelOpen = true; renderHome()
      const ta = document.getElementById('brain-dump-input'), box = ta && ta.parentNode, lines = box ? [...box.querySelectorAll('div[data-content="he"]')].map(d => d.textContent.trim()) : []
      out[k] = { has: !!box, n: lines.length, last: lines[lines.length - 1] || '', label: /תוכנית אם–אז/.test(box ? box.textContent : ''), h: box ? Math.round(box.getBoundingClientRect().height) : 0, reroll: !!(box && box.querySelector('[onclick="rerollMoodTip()"]')), empty: [...(box ? box.querySelectorAll('div[data-content="he"]') : [])].some(d => !d.textContent.trim()) }
      state.moods.pop()
    })
    return out
  })
  const ks = Object.keys(rows)
  ok(ks.every(k => rows[k].has && !rows[k].empty), 'every feeling has a panel and no empty row')
  ok(ks.every(k => rows[k].label && rows[k].last.endsWith(lib.find(d => d.k === k).ifthen)), 'the if-then plan is the last row, with the label "תוכנית אם–אז", the text exactly')
  ok(ks.every(k => rows[k].n - 1 <= 3 && rows[k].n - 1 >= 1), 'at most three lines are shown, at least one (plus the plan)')
  ok(ks.every(k => rows[k].reroll === (lib.find(d => d.k === k).actions.length > 3)), '"another" only where there are more lines than shown (the original five)')
  const tall = Object.entries(rows).sort((a, b) => b[1].h - a[1].h)[0]
  ok(tall[1].h < 480, 'the panel stays compact (textarea and save button included; tallest ' + tall[0] + ' ' + tall[1].h + ' px at 390)')
  await done(pg)

  head('the text, 4.5:1 or more, on the real pixels (390, jungle)')
  pg = await boot()
  const lum = c => { const v = c.map(x => x / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2] }
  let worst = [99, '']
  for (const k of lib.map(d => d.k)) {
    await pg.evaluate(k => { state.moods.push({ ts: Date.now(), date: getToday(), hour: 10, weekday: 1, mood: k, source: 'manual', actions: MOOD_LIB[k].actions.slice(0, 3) }); moodPanelOpen = true; renderHome(); const ta = document.getElementById('brain-dump-input'); ta.scrollIntoView({ block: 'center' }) }, k)
    const els = await pg.evaluate(() => { const box = document.getElementById('brain-dump-input').parentNode; return [...box.querySelectorAll('div[data-content="he"], span')].filter(e => e.textContent.trim() && e.children.length < 2 && e.getBoundingClientRect().height > 0).map(e => { const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height, col: getComputedStyle(e).color, t: e.textContent.slice(0, 20) } }).filter(e => e.y > 0 && e.y + e.h < innerHeight) })
    for (const e of els) {
      const buf = await pg.screenshot({ clip: { x: e.x, y: e.y, width: Math.max(2, e.w), height: Math.max(2, e.h) } })
      const bg = await pg.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, n = {}; for (let i = 0; i < d.length; i += 4) { const key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; n[key] = (n[key] || 0) + 1 } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number) }, buf.toString('base64'))
      const fg = e.col.match(/[\d.]+/g).slice(0, 3).map(Number), x = lum(fg), y = lum(bg), c = (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
      if (c < worst[0]) worst = [c, k + ' "' + e.t + '"']
    }
    await pg.evaluate(() => state.moods.pop())
  }
  ok(worst[0] >= 4.5, 'the lines, the label and the plan of all 24: lowest ' + worst[0].toFixed(2) + ' (' + worst[1] + ')')
  await done(pg)

  head('the original five: their own lines kept, only the plan added')
  pg = await boot()
  r = await pg.evaluate(() => MOOD_ORDER.map(k => [k, MOOD_LIB[k].actions.length]).join())
  ok(r === 'overwhelmed,6,scattered,6,tired,6,focused,4,motivated,5', 'the same 6, 6, 6, 4, 5 lines as before: ' + r)
  await done(pg)

  head('the old themes: no plan row, nothing new')
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot(th)
    r = await pg.evaluate(() => { const o = []; MOOD_ORDER.forEach(k => { state.moods.push({ ts: Date.now(), date: getToday(), hour: 10, weekday: 1, mood: k, source: 'manual', actions: MOOD_LIB[k].actions.slice(0, 3) }); moodPanelOpen = true; renderHome(); o.push(/תוכנית אם–אז/.test(document.getElementById('screen-home').textContent)); state.moods.pop() }); return o })
    ok(r.every(x => x === false), th + ': no "תוכנית אם–אז" for any of the five')
    await done(pg)
  }
  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
