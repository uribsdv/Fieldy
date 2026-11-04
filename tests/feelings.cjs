#!/usr/bin/env node
// More feelings (claude/feelings-more), jungle only:
// - "עוד אפשרויות" on the mood card opens a sheet of nineteen more feelings; one chosen is logged by logMood (source 'manual', the same
//   record as the five), the sheet closes and the card shows it as the active one. getMoodPatterns and the trend take the new keys.
// - Loki answers the heavy ones with one quiet line; once a day, with no feeling logged, one soft line points at the card (never at
//   night, never on the visit of a welcome back, kept in game.world.day.seen, no key of its own).
// - The five of the card (claude/feelings-art-swap), jungle only: their drawings replace the badges (44 px circles, lazily, once, after the
//   first paint; the badge stays where a drawing is not available), an active one has a ring in its ink, and the tip panel is only for
//   the feelings that have a line (the good ones and "sick" have none: only Loki's short answer).
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
const FIVE = ['overwhelmed', 'scattered', 'tired', 'focused', 'motivated']
const NOTIPS = ['calm', 'inspired', 'connected', 'content', 'proud', 'curious', 'surprised', 'loving', 'patient', 'sick']
const MORE = ['calm', 'stressed', 'drained', 'inspired', 'stuck', 'anxious', 'connected', 'content', 'loaded', 'sick', 'angry', 'proud', 'restless', 'curious', 'lonely', 'loving', 'surprised', 'patient', 'sad']
const MOOD_LIB_EMPTY = (o, k) => !o[k].tip && o[k].lines === 0
const daysAgo = days => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days); return +d }
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  // moods: false = the seeded ones (one today); [] = none
  async function boot({ theme = 'jungle', hour = 9, reduced = false, away = 0, moods = false } = {}) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    pg.reqs = []; pg.on('request', q => pg.reqs.push(q.url()))
    pg.bad = []; pg.on('response', r => { if (r.status() >= 400) pg.bad.push(r.status() + ' ' + r.url()) }); pg.on('requestfailed', q => { if (q.url().startsWith(B)) pg.bad.push('failed ' + q.url()) })
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
  ok(!pg.reqs.some(u => /feelings\/feel-(?!(overwhelmed|scattered|tired|focused|motivated)\.)/.test(u)), 'of the nineteen, nothing is fetched on load (only the card\'s own five, below)')
  await pg.click('.feel-more'); await pg.waitForTimeout(250)
  r = await pg.evaluate(() => ({ tiles: [...document.querySelectorAll('.feel-sheet .feel-tile')].map(b => b.dataset.feel), names: [...document.querySelectorAll('.feel-sheet .feel-tile b')].map(b => b.textContent), circles: [...document.querySelectorAll('.feel-sheet .feel-art')].filter(a => getComputedStyle(a).borderRadius === '50%' && a.getBoundingClientRect().width > 40).length }))
  ok(r.tiles.join() === MORE.join(), 'the sheet has the nineteen, in order: ' + r.names.join(', '))
  ok(r.circles === 19, 'each has its slot, a circle')
  await pg.waitForTimeout(600)
  r = await pg.evaluate(() => ({ list: [...document.querySelectorAll('.feel-sheet .feel-tile.has-art')].map(b => b.dataset.feel), imgs: [...document.querySelectorAll('.feel-sheet .feel-art img')].map(i => i.naturalWidth) }))
  const drawn = pg.reqs.filter(u => /feelings\/feel-[a-z]+\.webp/.test(u)).map(u => u.match(/feel-([a-z]+)\.webp/)[1])
  ok(pg.reqs.filter(u => /feelings\/manifest\.json/.test(u)).length === 1 && drawn.sort().join() === MORE.concat(FIVE).sort().join() && !pg.reqs.some(u => /extra/.test(u)), 'the manifest is read once (the card read it, the sheet reuses it); the 19 drawings and the card\'s 5 each once, nothing else (no extras)')
  ok(pg.bad.length === 0, 'no request fails or is refused' + (pg.bad.length ? ': ' + pg.bad.join(' | ') : ''))
  ok(r.list.length === 19 && r.imgs.every(w => w === 256), 'every slot shows its drawing (256 px)')
  await pg.click('.feel-sheet .btn-primary'); await pg.waitForTimeout(150)
  ok(await pg.evaluate(() => !document.querySelector('#modal-container .feel-sheet')), 'the close button closes it')
  await done(pg)

  head('a drawing listed in the manifest is shown in its slot')
  pg = await boot()
  await pg.route('**/assets/feelings/manifest.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: ['feel-calm.webp'] }) }))
  await pg.route('**/assets/feelings/feel-calm.webp', r => r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'icon-32.png')) }))
  await pg.evaluate(() => showMoreFeelings()); await pg.waitForTimeout(400)
  r = await pg.evaluate(() => ({ calm: !!document.querySelector('.feel-tile[data-feel="calm"].has-art img'), others: document.querySelectorAll('.feel-sheet .feel-art img').length }))
  ok(r.calm && r.others === 1, 'a manifest that lists only feel-calm.webp: it is shown, the other eighteen stay circles (not fetched)')
  await done(pg)

  head('the five of the card: their drawings (jungle)')
  const widths = [390, 360, 412]
  pg = await boot()
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() })
  r = await pg.evaluate(() => ({ badges: document.querySelectorAll('.nh-mood .card button[onclick^="logMood"] .icon-badge').length, art: document.querySelectorAll('.nh-mood .feel-card-art img').length, reqs: performance.getEntriesByType('resource').filter(e => /feelings\//.test(e.name)).length }))
  ok(r.art === 0 && r.badges === 5 && r.reqs <= 1, 'the first paint of the card is the five badges (nothing asked for before it)')
  await pg.waitForTimeout(700)
  r = await pg.evaluate(() => [...document.querySelectorAll('.nh-mood .card button[onclick^="logMood"]')].map(b => { const a = b.querySelector('.feel-card-art'), i = a && a.querySelector('img'), q = a && a.getBoundingClientRect(); return { k: /logMood\('(\w+)'/.exec(b.getAttribute('onclick'))[1], img: !!i, nat: i && i.naturalWidth, w: q && Math.round(q.width), h: q && Math.round(q.height), radius: a && getComputedStyle(a).borderRadius, badge: !!b.querySelector('.icon-badge') } }))
  ok(r.map(x => x.k).join() === FIVE.join() && r.every(x => x.img && x.nat === 256 && x.w === 44 && x.h === 44 && x.radius === '50%' && !x.badge), 'a moment later the five show their drawings (256 px file, a 44 px circle) in place of the badges')
  const reqs5 = pg.reqs.filter(u => /feelings\//.test(u)).map(u => u.replace(/.*feelings\//, '')).sort().join()
  ok(reqs5 === ['manifest.json'].concat(FIVE.map(k => 'feel-' + k + '.webp')).sort().join(), 'asked for once: the manifest and the five (no other file): ' + reqs5)
  ok(pg.bad.length === 0, 'no request fails')
  const fl = await pg.evaluate(() => { const b = document.querySelector('.nh-mood .card button[onclick^="logMood"]'); const seen = []; const mo = new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => { if (n.nodeType === 1 && (n.matches('.icon-badge') || n.querySelector('.icon-badge'))) seen.push(1) }))); mo.observe(document.getElementById('screen-home'), { childList: true, subtree: true }); renderHome(); const first = document.querySelector('.nh-mood .feel-card-art img'); const sync = !!first && first.complete && !document.querySelector('.nh-mood .card .icon-badge'); return { sync } })
  ok(fl.sync, 'drawn again (a re-render): the drawing straight away, no badge in between')
  await pg.evaluate(() => logMood('focused', 'manual')); await pg.waitForTimeout(200)
  r = await pg.evaluate(() => { const on = document.querySelector('.nh-mood .card button[onclick="logMood(\'focused\',\'manual\')"]'), a = on.querySelector('.feel-card-art'); return { ring: getComputedStyle(a).boxShadow, ink: getComputedStyle(on.querySelector('div:last-child')).color, border: getComputedStyle(on).borderColor, others: [...document.querySelectorAll('.nh-mood .feel-card-art')].filter(x => getComputedStyle(x).boxShadow !== 'none').length } })
  ok(/4px/.test(r.ring) && r.others === 1, 'the active one has the ring (2 px gap, 2 px line), only that one: ' + r.ring)
  await done(pg)

  head('the five: fit in one row at 360, 390, 412, and the active label at 4.5:1 or more')
  for (const w of widths) {
    pg = await boot(); await pg.setViewportSize({ width: w, height: 844 }); await pg.evaluate(() => { moodPanelOpen = true; renderHome() }); await pg.waitForTimeout(700)
    r = await pg.evaluate(() => { const card = document.querySelector('.nh-mood .card').getBoundingClientRect(), bs = [...document.querySelectorAll('.nh-mood .card button[onclick^="logMood"]')].map(b => { const x = b.getBoundingClientRect(), a = b.querySelector('.feel-card-art').getBoundingClientRect(); return { x, a, fits: a.left >= x.left && a.right <= x.right && b.scrollWidth <= b.clientWidth + 1 } }); const tops = new Set(bs.map(b => Math.round(b.x.top))); return { n: bs.length, row: tops.size === 1, inside: bs.every(b => b.x.left >= card.left && b.x.right <= card.right), fits: bs.every(b => b.fits), art: bs.every(b => Math.round(b.a.width) === 44), w: Math.round(bs[0].x.width) } })
    ok(r.n === 5 && r.row && r.inside && r.fits && r.art, w + 'px: five in one row (each ' + r.w + ' px wide), the 44 px circle inside its button, nothing cut')
    if (w === 390) {
      // the real rendered pixels: the card is translucent over the page, so the label is measured against what is actually behind it
      const lum = c => { const v = c.map(x => x / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2] }
      const got = {}
      for (const k of FIVE) {
        await pg.evaluate(k => { state.moods.push({ ts: Date.now(), date: getToday(), hour: 10, weekday: 1, mood: k, source: 'manual', actions: [] }); renderHome() }, k)
        const info = await pg.evaluate(k => { const l = document.querySelector('.nh-mood .card button[onclick="logMood(\'' + k + '\',\'manual\')"] div:last-child'), q = l.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height, col: getComputedStyle(l).color } }, k)
        const buf = await pg.screenshot({ clip: { x: info.x, y: info.y, width: info.w, height: info.h } })
        const bg = await pg.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, n = {}; for (let i = 0; i < d.length; i += 4) { const key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; n[key] = (n[key] || 0) + 1 } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number) }, buf.toString('base64'))
        const fg = info.col.match(/[\d.]+/g).slice(0, 3).map(Number), x = lum(fg), y = lum(bg)
        got[k] = (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
        await pg.evaluate(() => state.moods.pop())
      }
      const low5 = Object.entries(got).sort((a, b) => a[1] - b[1])[0]
      ok(Object.values(got).every(v => v >= 4.5), 'the active label on what is really behind it (measured on the pixels), all five 4.5:1 or more (lowest ' + low5[0] + ' ' + low5[1].toFixed(2) + ')')
    }
    await done(pg)
  }

  head('the five: the fallback (the badge stays where a drawing is not available)')
  pg = await boot()
  await pg.route('**/assets/feelings/manifest.json', r => r.fulfill({ status: 404, body: '' }))
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() }); await pg.waitForTimeout(700)
  r = await pg.evaluate(() => ({ badges: document.querySelectorAll('.nh-mood .card button[onclick^="logMood"] .icon-badge').length, art: document.querySelectorAll('.nh-mood .feel-card-art img').length }))
  ok(r.badges === 5 && r.art === 0, 'no manifest: the five stay badges, nothing breaks')
  await done(pg)
  pg = await boot()
  await pg.route('**/assets/feelings/feel-tired.webp', r => r.fulfill({ status: 404, body: '' }))
  await pg.route('**/assets/feelings/feel-scattered.webp', r => r.abort())
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() }); await pg.waitForTimeout(700)
  r = await pg.evaluate(() => [...document.querySelectorAll('.nh-mood .card button[onclick^="logMood"]')].map(b => /logMood\('(\w+)'/.exec(b.getAttribute('onclick'))[1] + ':' + (b.querySelector('.feel-card-art img') ? 'art' : b.querySelector('.icon-badge') ? 'badge' : '?')).join())
  ok(r === 'overwhelmed:art,scattered:badge,tired:badge,focused:art,motivated:art', 'a drawing that does not come stays its badge, the others are drawn: ' + r)
  await pg.evaluate(() => { renderHome() }); r = await pg.evaluate(() => document.querySelectorAll('.nh-mood .card .icon-badge').length)
  ok(r === 2, 'and stays so after a re-render')
  await done(pg)
  pg = await boot()
  await pg.route('**/assets/feelings/manifest.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: ['feel-focused.webp', 'feel-calm.webp'] }) }))
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() }); await pg.waitForTimeout(700)
  r = pg.reqs.filter(u => /feelings\/feel-/.test(u)).map(u => u.replace(/.*feel-/, ''))
  ok(r.join() === 'focused.webp', 'a drawing the manifest does not list is not asked for (a listed one of the nineteen is not asked for by the card)')
  await done(pg)

  head('the other themes: the badges as they were, nothing fetched')
  for (const th of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot({ theme: th })
    await pg.evaluate(() => { moodPanelOpen = true; renderHome() }); await pg.waitForTimeout(700)
    r = await pg.evaluate(() => ({ badges: document.querySelectorAll('button[onclick^="logMood"] .icon-badge').length, art: document.querySelectorAll('.feel-card-art').length }))
    ok(r.badges === 5 && r.art === 0 && !pg.reqs.some(u => /feelings\//.test(u)), th + ': five badges, no drawing, nothing of the feelings fetched')
    await done(pg)
  }

  head('the tip panel: only for the feelings that have a line')
  pg = await boot()
  r = await pg.evaluate(keys => {
    const out = {}; let err = ''
    Object.keys(MOOD_LIB).forEach(k => {
      state.moods.push({ ts: Date.now(), date: getToday(), hour: 10, weekday: 1, mood: k, source: 'manual', actions: k.length ? MOOD_LIB[k].actions.slice(0, 3) : [] })
      try { moodPanelOpen = true; renderHome(); const h = document.getElementById('screen-home').innerHTML; const tip = document.getElementById('brain-dump-input'); out[k] = { tip: !!tip, lines: tip ? [...tip.parentNode.querySelectorAll('[data-content="he"]')].length : 0, reroll: !!(tip && tip.parentNode.querySelector('[onclick="rerollMoodTip()"]')) }; if (/undefined|NaN/.test(h)) err += k + ' ' } catch (e) { err += k + ':' + e.message + ' ' }
      try { rerollMoodTip() } catch (e) { err += 'reroll ' + k + ':' + e.message + ' ' }
      state.moods.pop()
    })
    return { out, err }
  }, NOTIPS)
  ok(r.err === '', 'every feeling renders and re-rolls with no error and no "undefined" on the card' + (r.err ? ': ' + r.err : ''))
  ok(NOTIPS.every(k => !r.out[k].tip) && NOTIPS.every(k => MOOD_LIB_EMPTY(r.out, k)), 'calm, inspired, connected, content, proud, curious, surprised, loving, patient and sick: no panel (nothing left, no empty space)')
  const withTip = Object.keys(r.out).filter(k => !NOTIPS.includes(k))
  ok(withTip.length === 24 - 10 && withTip.every(k => r.out[k].tip && r.out[k].lines >= 1), 'the other fourteen have the panel, each with its lines: ' + withTip.map(k => k + ':' + r.out[k].lines).join(' '))
  ok(['overwhelmed', 'scattered', 'tired', 'focused', 'motivated'].every(k => r.out[k].lines === 3 && r.out[k].reroll) && MORE.filter(k => r.out[k].tip).every(k => !r.out[k].reroll), 'the original five are as they were (three lines, "another" button); the new ones with one or two lines have no "another" button')
  r = await pg.evaluate(() => { const g = k => MOOD_LIB[k].actions; return { anx: g('anxious'), str: g('stressed'), ang: g('angry'), res: g('restless'), stu: g('stuck'), lon: g('lonely'), sad: g('sad'), lo: g('loaded'), dr: g('drained'), sick: g('sick').length, limits: ['stressed:1', 'anxious:1', 'loaded:1', 'angry:2', 'stuck:2', 'lonely:2', 'sad:2', 'restless:2', 'drained:2', 'sick:2'].every(x => MOOD_LIB[x.split(':')[0]].taskLimit === +x.split(':')[1]) && ['calm', 'patient'].every(k => MOOD_LIB[k].taskLimit === null), five: Object.keys(MOOD_LIB).slice(0, 5).map(k => MOOD_LIB[k].actions.length).join() } })
  ok(r.anx.length === 2 && /5-4-3-2-1/.test(r.anx[1]) && /נשיפה ארוכה/.test(r.anx[0]) && r.str.length === 2 && /נשיפה ארוכה/.test(r.str[0]) && /החלק הכי קטן/.test(r.str[1]), 'anxious: a long exhale, 5-4-3-2-1; stressed: the same exhale, the smallest part')
  ok(r.ang.length === 2 && r.res.length === 1 && r.stu.length === 2 && r.lon.length === 1 && r.sad.length === 1 && r.lo.length === 1 && r.dr.length === 1 && r.sick === 0, 'angry two, restless one, stuck two, lonely one, sad one, loaded one, drained one, sick none')
  ok([].concat(r.anx, r.str, r.ang, r.res, r.stu, r.lon, r.sad, r.lo, r.dr).every(t => /^אם בא לך/.test(t) && t.length < 100), 'each line is "if you like", short')
  ok(r.limits && r.five === '6,6,6,4,5', 'taskLimit untouched; the original five untouched (6,6,6,4,5 lines)')
  await done(pg)

  head('a feeling logged before the lines were trimmed')
  pg = await boot({ moods: [{ ts: Date.now() - 1000, date: new Date().toISOString().slice(0, 10), hour: 10, weekday: new Date().getDay(), mood: 'anxious', source: 'manual', actions: ['רק דבר אחד מוצג למטה. זה מספיק לעכשיו.', 'את השאר אפשר להשאיר בצד בינתיים.'] }, { ts: Date.now() - 500, date: new Date().toISOString().slice(0, 10), hour: 10, weekday: new Date().getDay(), mood: 'calm', source: 'manual', actions: ['זמן טוב למשימה שצריכה ראש שקט.'] }] })
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() })
  ok(await pg.evaluate(() => !document.getElementById('brain-dump-input')), 'calm with an old line on its record: no panel')
  await pg.evaluate(() => { state.moods.pop(); renderHome() })
  r = await pg.evaluate(() => [...document.getElementById('brain-dump-input').parentNode.querySelectorAll('[data-content="he"]')].map(x => x.textContent))
  ok(r.length === 2 && !/רק דבר אחד/.test(r.join('')) && /נשיפה ארוכה/.test(r[0]), 'anxious with the old lines on its record: the new ones are shown, not the old')
  await done(pg)

  head('a choice is logged with its key and shown on the card')
  pg = await boot()
  await pg.evaluate(() => { moodPanelOpen = true; renderHome() })
  const before = await pg.evaluate(() => Object.keys(state.moods[state.moods.length - 1]).sort().join())
  await pg.click('.feel-more'); await pg.waitForTimeout(200)
  await pg.click('.feel-tile[data-feel="sad"]'); await pg.waitForTimeout(250)
  r = await pg.evaluate(() => { const m = state.moods[state.moods.length - 1]; return { m, keys: Object.keys(m).sort().join(), sheet: !!document.querySelector('.feel-sheet'), chip: (document.querySelector('.nh-mood .feel-chip') || {}).textContent, cur: (getCurrentMood() || {}).mood, limit: moodLimit('sad'), saved: JSON.parse(localStorage.getItem('fieldy_v2')).moods.slice(-1)[0].mood, loki: document.getElementById('jg-gnome').textContent, banks: ['presence', 'warmth', 'simple'].flatMap(b => LOKI_FEEL[b]) } })
  ok(r.m.mood === 'sad' && r.m.source === 'manual' && r.saved === 'sad', 'logged as "sad", source manual, saved in state.moods')
  ok(r.keys === before, 'the record has the same fields as before: ' + r.keys)
  ok(!r.sheet && r.chip === 'עצוב' && r.cur === 'sad', 'the sheet closed and the card shows "עצוב" as the active one')
  ok(r.limit === 2, 'sad: two tasks at most ("if you like")')
  ok(r.banks.some(t => r.loki.includes(t)) && !/\?/.test(r.banks.join('')), 'Loki answers with one quiet line of his banks (no question in any of them)')
  // the chosen one in the sheet, for each of the nineteen: its name in its colour on its tint, over the drawing's tile, at 4.5:1 at least
  r = await pg.evaluate(keys => {
    const lum = c => { const v = c.map(x => x / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2] }
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number), out = {}
    keys.forEach(k => {
      state.moods.push({ ts: Date.now(), date: getToday(), hour: 10, weekday: 1, mood: k, source: 'manual', actions: [] }); showMoreFeelings()
      const b = document.querySelector('.feel-tile.on'), sheet = rgb(getComputedStyle(document.querySelector('#modal-container .modal')).backgroundColor), fg = rgb(getComputedStyle(b.querySelector('b')).color)
      const bgc = getComputedStyle(b).backgroundColor, m = bgc.match(/srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)/), tint = m ? [m[1] * 255, m[2] * 255, m[3] * 255] : fg, a = m ? +m[4] : 0
      const bg = sheet.map((v, i) => tint[i] * a + v * (1 - a)), x = lum(fg), y = lum(bg)
      out[k] = { c: (Math.max(x, y) + .05) / (Math.min(x, y) + .05), ring: /6px/.test(getComputedStyle(b.querySelector('.feel-art')).boxShadow), bold: +getComputedStyle(b.querySelector('b')).fontWeight >= 700 }
      closeModal(); state.moods.pop()
    })
    return out
  }, MORE)
  const low = Object.entries(r).sort((a, b) => a[1].c - b[1].c)[0]
  ok(Object.values(r).every(v => v.c >= 4.5 && v.ring && v.bold), 'chosen in the sheet: a ring round the drawing, its name bold in its colour, 4.5:1 or more for all 19 (lowest ' + low[0] + ' ' + low[1].c.toFixed(2) + ')')
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
  ok(Object.values(r).every(v => v[0] && /^#[0-9A-F]{6}$/i.test(v[1]) && v[3] <= 3 && v[4] && v[5] && v[6]), 'each has label, color, taskLimit, 0-3 actions, an icon, a name and an answer of Loki')
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
