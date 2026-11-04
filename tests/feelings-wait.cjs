#!/usr/bin/env node
// A pause before a WhatsApp message when angry (claude/feelings-art-swap), jungle only. The app never sends a WhatsApp message itself:
// it drafts one (the action screen, "הודעת WhatsApp") and its button copies it, to be pasted in WhatsApp; that button is the one point.
// If "angry" was logged in the last two hours (state.moods), it asks first: "אחכה" closes (nothing copied, no timer, no notice) and
// "שלח עכשיו" goes on exactly as before. Only in the jungle, only for a WhatsApp draft, only after "angry"; no new key, no new timer.
// Run: node tests/feelings-wait.cjs   (ROOT=<dir> for another checkout)
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
const H = 3600e3
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ theme = 'jungle', mood = null, ago = 0.5, kind = 'whatsapp' } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    const s = seededState(); s.moods = mood ? [{ ts: Date.now() - ago * H, date: new Date().toISOString().slice(0, 10), hour: 10, weekday: new Date().getDay(), mood, source: 'manual', actions: [] }] : []
    await pg.addInitScript(([s, t]) => {
      window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve() } }, configurable: true })
      window.__timers = 0; window.__by = []; const o = window.setTimeout; window.setTimeout = function () { window.__timers++; window.__by.push((new Error().stack || '').split('\n').slice(2, 5).join(' < ')); return o.apply(this, arguments) }
      const oi = window.setInterval; window.setInterval = function () { window.__ivs = (window.__ivs || 0) + 1; return oi.apply(this, arguments) }
      if (sessionStorage.getItem('fe_seeded')) return; sessionStorage.setItem('fe_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_loki_roam', '0')
      localStorage.setItem('fieldy_gnome_wave', new Date().toISOString().slice(0, 10)); localStorage.setItem('fieldy_loki_v1', JSON.stringify({ v: 1, bag: {}, last: {}, hardAt: 0, hardDays: {}, hugs: 0, firstDay: '2026-01-01', lastSeen: Date.now() - 60000 })) }, [s, theme])
    await pg.goto(B + '?gnomeHour=9'); await pg.waitForTimeout(600)
    pg.lsKeys = await pg.evaluate(() => Object.keys(localStorage).sort())
    await pg.evaluate(kind => { actionCtx = { text: 'לעדכן על הבאר', assignee: 'Gio' }; navigateTo('action'); actionKind = kind; document.getElementById('action-result').textContent = 'Hi Gio, please update me on the well.'; document.getElementById('action-result-container').style.display = 'block' }, kind)
    return pg
  }
  const done = async pg => { ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : '')); await pg.context().close() }
  const head = s => console.log('\n' + s)
  const state = pg => pg.evaluate(() => ({ dlg: !!document.getElementById('wait-wait'), copied: window.__copied.length, text: window.__copied[0], timers: window.__timers, ivs: window.__ivs || 0 }))
  let pg, r

  head('angry in the last two hours, a WhatsApp draft, the jungle: the question')
  pg = await boot({ mood: 'angry', ago: 0.5 })
  const t0 = await state(pg)
  await pg.evaluate(() => { window.__timers = 0 })
  await pg.click('#action-copy-btn'); await pg.waitForTimeout(250)
  r = await state(pg)
  const tAsk = r.timers
  ok(r.dlg && r.copied === 0, 'the dialog comes up, nothing is copied yet')
  const txt = await pg.evaluate(() => document.querySelector('#modal-container [role="dialog"]').textContent)
  ok(/נראה שאתה כועס\. רוצה להמתין 10 דקות לפני שליחה\?/.test(txt) && /אחכה/.test(txt) && /שלח עכשיו/.test(txt), 'the words: "נראה שאתה כועס. רוצה להמתין 10 דקות לפני שליחה?", two buttons: אחכה / שלח עכשיו')
  ok(await pg.evaluate(() => document.querySelectorAll('#modal-container button').length === 2), 'exactly two buttons')
  await pg.click('#wait-wait'); await pg.waitForTimeout(250)
  r = await state(pg)
  ok(!r.dlg && r.copied === 0 && !(await pg.evaluate(() => window.__by.some(s => /copyResult|angryRecently|closeModal/.test(s)))) && r.ivs === t0.ivs, '"אחכה": closes, nothing copied, no timer set by it (the page click ripple aside), no notice')
  ok(JSON.stringify(await pg.evaluate(() => Object.keys(localStorage).sort())) === JSON.stringify(pg.lsKeys), 'no new localStorage key')
  // the words of the dialog, 4.5:1 or more on the real pixels
  {
    const lum = c => { const v = c.map(x => x / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2] }
    await pg.click('#action-copy-btn'); await pg.waitForTimeout(500)
    const els = await pg.evaluate(() => [...document.querySelectorAll('#modal-container [data-content="he"], #modal-container button')].map(e => { const q = e.getBoundingClientRect(); return { x: q.left + 4, y: q.top + 4, w: Math.max(2, q.width - 8), h: Math.max(2, q.height - 8), col: getComputedStyle(e).color, t: e.textContent.slice(0, 12) } }))
    let worst = [99, '']
    for (const e of els) {
      const buf = await pg.screenshot({ clip: { x: e.x, y: e.y, width: e.w, height: e.h } })
      const bg = await pg.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, n = {}; for (let i = 0; i < d.length; i += 4) { const key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; n[key] = (n[key] || 0) + 1 } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number) }, buf.toString('base64'))
      const fg = e.col.match(/[\d.]+/g).slice(0, 3).map(Number), a = lum(fg), b = lum(bg), c = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      if (c < worst[0]) worst = [c, e.t]
    }
    ok(els.length === 3 && worst[0] >= 4.5, 'the question and both buttons: lowest ' + worst[0].toFixed(2) + ' (' + worst[1] + ')')
    await pg.click('#wait-wait')
  }
  await pg.click('#action-copy-btn'); await pg.waitForTimeout(150); await pg.click('#wait-now'); await pg.waitForTimeout(250)
  r = await state(pg)
  ok(!r.dlg && r.copied === 1 && r.text === 'Hi Gio, please update me on the well.', '"שלח עכשיו": closes and goes on as today (the draft is copied, as is)')
  ok(await pg.evaluate(() => /הועתק/.test(document.getElementById('action-copy-btn').textContent)), 'and the button says "הועתק" as it always did')
  await done(pg)

  head('when it does not come up')
  const cases = [
    ['angry 3 hours ago', { mood: 'angry', ago: 3 }],
    ['angry just under two hours ago', { mood: 'angry', ago: 1.9 }, true],
    ['another feeling (sad) now', { mood: 'sad', ago: 0.2 }],
    ['no feeling at all', {}],
    ['angry now, but an email draft', { mood: 'angry', ago: 0.2, kind: 'email' }],
    ['angry now, but a Monday draft', { mood: 'angry', ago: 0.2, kind: 'monday' }],
  ]
  for (const [name, o, shouldAsk] of cases) {
    pg = await boot(o); await pg.click('#action-copy-btn'); await pg.waitForTimeout(250); r = await state(pg)
    ok(shouldAsk ? (r.dlg && r.copied === 0) : (!r.dlg && r.copied === 1), name + ': ' + (shouldAsk ? 'it asks' : 'no dialog, copied as before'))
    await done(pg)
  }
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: th, mood: 'angry', ago: 0.2 }); await pg.click('#action-copy-btn'); await pg.waitForTimeout(250); r = await state(pg)
    ok(!r.dlg && r.copied === 1, th + ': an angry record in the state, no dialog, copied as before')
    await done(pg)
  }

  head('the rest of the app is not touched')
  pg = await boot({ mood: 'angry', ago: 0.2 })
  r = await pg.evaluate(() => ({ send: [...document.documentElement.outerHTML.matchAll(/wa\.me|api\.whatsapp|whatsapp:\/\//g)].length, f: typeof angryRecently, modalOnly: document.querySelectorAll('#modal-container *').length }))
  ok(r.send === 0 && r.f === 'function' && r.modalOnly === 0, 'no direct send link anywhere in the page; the dialog is not on the screen until asked')
  await done(pg)

  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
