#!/usr/bin/env node
// Loki's errands (claude/loki-purposeful-roam): he goes out only for a reason, does the one thing it is for, and comes straight back.
// Up from his stump, straight to the corner of the flow of tasks, the act, home: no look about, no turn away and back, nothing done on his
// feet for its own sake, no standing still; a turn from one side to the other is one clean flip. Seated acts start and end in his still
// sitting pose; cross-legged is not used (no frames between it and sitting with his legs over the edge). The sets meet at one size and
// with the middle of his body where it was. Reduced motion, the switch off and the night: his card says it, as before. Nothing ticks
// while the app is away.
// Run: node tests/loki-errands.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
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
const head = s => console.log('\n' + s)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot({ hour = 12, W = 393, H = 852, roam = true, reduced = false, scroll = 150 } = {}) {
    const ctx = await br.newContext({ viewport: { width: W, height: H }, reducedMotion: reduced ? 'reduce' : 'no-preference' }), pg = await ctx.newPage()
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    const today = new Date().toISOString().slice(0, 10)
    await pg.addInitScript(([s, roam, today]) => { if (sessionStorage.getItem('le_seeded')) return; sessionStorage.setItem('le_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', 'jungle'); localStorage.setItem('fieldy_gnome_wave', today); localStorage.setItem('fieldy_loki_roam', roam ? '1' : '0') }, [seededState(), roam, today])
    await pg.goto(B + '?gnomeHour=' + hour); await pg.waitForTimeout(1500)
    await pg.evaluate(sc => { const all = state.tasks.now.concat(state.tasks.today, state.tasks.later); all.forEach(t => { t.done = false }); navigateTo('home'); document.getElementById('screen-home').scrollTop = sc; lokiQueue = []; gnFull = false; lokiRender()
      window.__scripts = []; const o = lokiScript; window.lokiScript = function (ep, steps) { window.__lastSteps = steps; __scripts.push(steps.map(s => ({ t: s.t, name: s.name || '', frames: s.frames || null, kind: s.E ? s.E.kind : '' }))); return o.apply(this, arguments) }
    }, scroll)
    await pg.waitForTimeout(600)
    // each check starts from his stump with nothing waiting: the seeding above made tasks urgent again (the tasks tab's number went up)
    // and the seeded data has a stuck site (the first opening of the day): both real reasons to go out, not the ones being checked
    await pg.evaluate(() => { const r = loki.react = loki.react || {}; r.point = getToday(); lokiSave(); lkr.badgeAt = Date.now(); lkr.eq = []; if (lkr.ep) lokiSnapHome() })
    await pg.waitForTimeout(300)
    return pg
  }
  // send one errand and follow it home; what was shown, frame by frame (lkr.trace), with the middle of his body on screen
  async function run(pg, kind, d, slow = 4) {
    await pg.evaluate(([k, d, slow]) => { lkr.slow = slow; lkr.trace = []; __scripts.length = 0; lkr.why = ''; lokiQueue = []; gnFull = false; window.__said = []; const o = window.__rs || (window.__rs = lokiRoamSay); window.lokiRoamSay = function (t) { __said.push(t); return o.apply(this, arguments) }; window.__went = lokiErrand(k, d) }, [kind, d || {}, slow])
    const t0 = Date.now(); let s
    do { await pg.waitForTimeout(300); s = await pg.evaluate(() => ({ state: lkr.state, eq: lkr.eq.length })) } while (Date.now() - t0 < 150000 && !(s.state === 'in' && !s.eq && Date.now() - t0 > 1500))
    return pg.evaluate(() => {
      const fr = (lkr.trace || []).map(t => { const m = lokiSeqReady(t.name), im = m && (m.imgs[t.i] || m.final), tor = im ? lokiTorso(im) : 0
        return { name: t.name, i: t.i, t: t.t, step: t.step, node: t.node, flip: t.flip, left: t.left, top: t.top, k: t.k, W: im ? im.naturalWidth : 0, H: im ? im.naturalHeight : 0, tx: im ? t.left + (t.flip ? im.naturalWidth - tor : tor) * t.k : 0 } })
      return { went: __went, why: lkr.why, state: lkr.state, said: __said, scripts: __scripts, fr }
    })
  }
  const seqs = fr => { const o = []; fr.forEach(f => { if (!o.length || o[o.length - 1] !== f.name) o.push(f.name) }); return o }
  const runs = fr => { const o = []; fr.forEach(f => { const l = o[o.length - 1]; if (l && l.name === f.name) { l.n++; l.t1 = f.t } else o.push({ name: f.name, n: 1, t0: f.t, t1: f.t }) }); return o }

  head('no outing without a reason')
  let pg = await boot()
  let r = await pg.evaluate(async () => { await new Promise(r => setTimeout(r, 25000)); return { state: lkr.state, scripts: __scripts.length, timer: !!lkr.timer && lkr.state !== 'in' } })
  ok(r.state === 'in' && r.scripts === 0, '25 s on Home with nothing happening: he stays on his stump (no outing by the clock)')
  ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : ''))

  head('a task closed: up, straight to the corner, a wave and a line, home')
  r = await run(pg, 'taskDone')
  const steps = (r.scripts[0] || []).map(s => s.t + (s.name ? ':' + s.name : ''))
  ok(r.went && r.state === 'in', 'he went and came back by himself (' + (r.why || 'ok') + ')')
  ok(!steps.some(s => s === 'seq:look') && !seqs(r.fr).includes('look'), 'no look about, before setting out or anywhere on the way')
  ok((r.scripts[0] || []).filter(s => s.name === 'turn').every(s => s.frames && s.frames.length <= 3), 'every turn is a quarter turn (to a side or to Uri, three frames): ' + (r.scripts[0] || []).filter(s => s.name === 'turn').map(s => '[' + s.frames.join('') + ']').join(' '))
  ok(!seqs(r.fr).some(n => ['thinking', 'standpoint', 'laughing'].includes(n)), 'nothing done on his feet for its own sake: ' + seqs(r.fr).join(' '))
  ok(steps.indexOf('errand') > 0 && steps.slice(steps.indexOf('errand') + 1).includes('home'), 'one script: the way there, the errand, the way home')
  ok(r.said.length === 1, 'one line, as he gets there: ' + r.said.join(' | '))
  const seated = r.fr.some(f => f.name === 'seatlook')
  ok(seated ? r.fr.some(f => f.name === 'seatwave') : r.fr.some(f => f.name === 'wave'), 'the wave (' + (seated ? 'sitting' : 'on his feet') + ')')
  // a turn from one side to the other is one clean flip: a side frame one way, the next side frame the other way, nothing between
  let flips = 0, bad = 0; for (let i = 1; i < r.fr.length; i++) { const a = r.fr[i - 1], b = r.fr[i]; if (a.flip !== b.flip && a.node === b.node && !['turn', 'standup'].includes(a.name) && !['turn', 'standup'].includes(b.name)) { flips++; if (a.name === 'turn' || b.name === 'turn') bad++ } }
  ok(bad === 0, 'every change of side is one clean flip, with no turn frames between (' + flips + ' on this errand)')
  // the middle of his body where one sequence gives way to the next on the ground (walk, turn, the wind-up)
  const GROUND = ['walk', 'turn', 'idle', 'prep', 'wave', 'standpoint', 'laughing']
  let worst = 0, where = ''
  for (let i = 1; i < r.fr.length; i++) { const a = r.fr[i - 1], b = r.fr[i]; if (a.name !== b.name && GROUND.includes(a.name) && GROUND.includes(b.name) && a.node === b.node) { const d = Math.abs(b.tx - a.tx); if (d > worst) { worst = d; where = a.name + '>' + b.name } } }
  ok(worst <= 2, 'where one sequence gives way to the next on the ground, the middle of his body stays where it was (worst ' + worst.toFixed(1) + ' px, ' + (where || 'none') + ')')
  // the sit: sit-trans 1,2,2,3,4 at 4 fps; up: the still pose first, then 4,3,2,2,1
  const sitSt = (r.scripts[0] || []).filter(s => s.name === 'sitedge').map(s => s.frames.join(''))
  if (seated) ok(sitSt[0] === '01123' && sitSt[1] === '32110', 'down onto the edge slowly (frames ' + sitSt.join(' / ') + '), and up again the same way')
  if (seated) { const i = (r.scripts[0] || []).findIndex(s => s.name === 'sitedge' && s.frames.join('') === '32110'); ok(i > 0 && r.scripts[0][i - 1].name === 'seatlook' && r.scripts[0][i - 1].frames.join('') === '1', 'up from the edge always from his still sitting pose (sit-look 2)') }
  // the wind-up before the jump to the vine, the jump's standing frame left out after it, a hold where it meets the climb, the landing
  const prepAt = steps.indexOf('pk:prep'), grabAt = steps.indexOf('grab')
  ok(prepAt >= 0 && grabAt === prepAt + 1, 'the wind-up (prep 1-3) right before the jump up to the vine')
  const plans = await pg.evaluate(() => (window.__lastSteps || []).filter(s => s.t === 'grab' && s.plan).map(s => ({ rev: !!s.rev, d: s.plan.map(p => Math.round(p.d)), f: s.plan.map(p => (s.short ? LK_SHORT_JUMP : [0, 1, 2, 3, 4, 5])[p.q]) })))
  const up = plans.filter(p => !p.rev), down = plans.filter(p => p.rev)
  ok(up.length && up.every(p => p.f[0] !== 0 && p.d[p.d.length - 1] >= 230), 'up to the vine: after the wind-up the jump starts from its crouch, and its last frame is held where it meets the climb (' + up.map(p => p.f.join('') + ':' + p.d.join('/')).join(' ') + ')')
  ok(down.length && down.every(p => p.d[0] >= 230 && p.f.indexOf(1) > 0 && p.d[p.f.indexOf(1)] >= 290), 'off the vine: held where the climb ends, and a landing on the jump\'s own crouch (' + down.map(p => p.f.join('') + ':' + p.d.join('/')).join(' ') + ')')
  ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : ''))

  head('the last task of the day: a laugh on his feet, and home (standing only while he does it)')
  r = await run(pg, 'dayDone')
  const rr = runs(r.fr), arrive = rr.findIndex(x => x.name === 'laughing')
  ok(r.went && arrive > 0, 'he laughs (laugh 1-4): ' + seqs(r.fr).join(' '))
  ok(!r.fr.some(f => f.name === 'idle' && f.step === 'errand'), 'no standing still out there: after the laugh he turns and goes')
  ok(r.state === 'in', 'home again')

  head('a stuck site or more tasks waiting: he points to them')
  r = await run(pg, 'point', { line: 'בדיקה' })
  ok(r.went && (r.fr.some(f => f.name === 'seatlook' && f.i === 3) || r.fr.some(f => f.name === 'standpoint')), 'he points (sit-look 4 sitting, stand-point 1-2 on his feet)')
  ok(r.said.includes('בדיקה'), 'with its line')
  r = await pg.evaluate(() => { lkr.eq = []; lkr.badgeAt = 0; lkr.badgeLast = 0; refreshBadges(); const a = lkr.eq.map(x => x.kind + ':' + (x.d.line || '')); lkr.eq = []; refreshBadges(); const b = lkr.eq.length; lkr.eq = []; return { a, b } })
  ok(r.a.length === 1 && /^point:.*משימ/.test(r.a[0]) && r.b === 0, 'the tasks tab\'s number goes up: a point to the tasks waiting, and not again within two hours (' + r.a.join() + ')')
  r = await pg.evaluate(() => { lkr.eq = []; const x = loki.react; x.open = ''; x.point = ''; const st = priorityStuckSites().find(s => daysStuck(s) >= 7); lokiTopicsDue(); const q = lkr.eq.filter(e => e.kind === 'point').map(e => e.d.line); lkr.eq = []; return { site: st && st.name, q } })
  ok(!r.site || (r.q.length === 1 && r.q[0].includes(r.site)) || (r.q.length === 1 && /אתר/.test(r.q[0])), 'the day\'s first opening with a site stuck a week or more: a point to it (' + JSON.stringify(r) + ')')

  head('the morning briefing ready: he sits and reads it')
  r = await run(pg, 'brief', {}, 8)
  ok(r.went && r.fr.some(f => f.name === 'seatread'), 'he reads, sitting (sit-read): ' + seqs(r.fr).join(' '))
  ok(!r.fr.some(f => f.name === 'standpoint'), 'never reading on his feet')
  ok(r.fr.filter(f => f.name === 'seatread' && f.i === 3).length >= 1, 'sit-read 4 is among the pages')
  await pg.context().close()

  head('a guest, while he is on his stump: he goes out to meet it, and it comes when he is there')
  pg = await boot()
  r = await run(pg, 'guest', { g: 'kupa', root: 'field', ctx: '', at: Date.now(), lab: true })
  ok(r.went && r.state === 'in', 'out and home again')
  ok(r.said.some(t => /קופה/.test(t)), 'Kupa\'s line beside him: ' + r.said.join(' | '))
  ok(r.fr.some(f => f.name === 'seatwave' || f.name === 'wave'), 'he waves to it')
  await pg.context().close()

  head('the evening (20:00): sitting with Uri, a doze now and then from his still pose and back to it; never cross-legged')
  pg = await boot({ hour: 20 })
  r = await run(pg, 'evening', {}, 12)
  ok(r.went && r.fr.some(f => f.name === 'seatlook'), 'he sits on the corner: ' + seqs(r.fr).join(' '))
  ok(!r.fr.some(f => f.name === 'sitflat'), 'never cross-legged (no frames between it and his legs over the edge)')
  const rs = runs(r.fr); let hub = true; rs.forEach((x, i) => { if (x.name === 'seatwave') { const a = rs[i - 1], b = rs[i + 1]; if (!a || a.name !== 'seatlook' || (b && b.name !== 'seatlook')) hub = false } })
  ok(hub && rs.some(x => x.name === 'seatwave'), 'every doze starts and ends in his still sitting pose (sit-look 2)')
  ok(r.said.length === 1 && /הלילה|היום/.test(r.said[0]), 'the evening\'s line, beside him: ' + r.said.join(' | '))
  // leaving Home ends it: back on Home he goes home
  await pg.evaluate(() => { lkr.slow = 4; lokiErrand('evening', {}) }); await pg.waitForTimeout(9000)
  const mid = await pg.evaluate(() => ({ state: lkr.state, errand: !!(lkr.ep && lkr.ep.errand) }))
  await pg.evaluate(() => navigateTo('tasks')); await pg.waitForTimeout(500); await pg.evaluate(() => navigateTo('home')); await pg.waitForTimeout(6000)
  const after = await pg.evaluate(() => ({ state: lkr.state, step: lkr.ep && lkr.ep.steps[lkr.ep.si] && lkr.ep.steps[lkr.ep.si].t }))
  ok(mid.errand && (after.state === 'coming' || after.state === 'in'), 'Uri leaves Home while he sits: when Home is back, he goes home (' + JSON.stringify([mid, after]) + ')')
  await pg.context().close()

  head('the quiet walk: in the day, after three hours of Home in front since the last, only sitting')
  pg = await boot()
  r = await pg.evaluate(() => { const o = {}; loki.homeMs = 2 * 3600000; lokiQuietDue(); o.two = lkr.eq.length; loki.homeMs = 3 * 3600000 + 1; lokiQuietDue(); o.three = lkr.eq.map(x => x.kind); lkr.eq = []; return o })
  ok(r.two === 0 && r.three.join() === 'quiet', 'not after two hours; after three, a quiet walk (' + JSON.stringify(r) + ')')
  r = await run(pg, 'quiet', {}, 8)
  ok(r.went && r.fr.some(f => f.name === 'seatread') && r.said.length === 0, 'he sits and reads, and says nothing')
  await pg.context().close()
  pg = await boot({ hour: 20 })
  r = await pg.evaluate(() => { lkr.eq = []; loki.homeMs = 4 * 3600000; lokiQuietDue(); const n = lkr.eq.filter(x => x.kind === 'quiet').length; lkr.eq = []; return n })
  ok(r === 0, 'not in the evening')
  await pg.context().close()
  pg = await boot({ W: 360 })
  r = await pg.evaluate(() => { lokiErrand('quiet', {}); return new Promise(res => setTimeout(() => res({ state: lkr.state, why: lkr.why, scripts: __scripts.length }), 4000)) })
  ok(r.scripts === 0 && /no room|not in sight|no way/.test(r.why), 'where there is no room to sit, no quiet walk (' + r.why + ')')
  await pg.context().close()

  head('reduced motion, the switch off, the night: his card says it, he does not go out')
  for (const [name, o] of [['reduced motion', { reduced: true }], ['switch off', { roam: false }], ['the night (23:00)', { hour: 23 }]]) {
    pg = await boot(o)
    r = await pg.evaluate(() => { const went = lokiErrand('taskDone', {}); return new Promise(res => setTimeout(() => res({ went, state: lkr.state, scripts: __scripts.length, layer: !!document.querySelector('#lk-roam .lk-actor') }), 2500)) })
    ok(r.went === false && r.state === 'in' && r.scripts === 0 && !r.layer, name + ': no errand, no outing')
    if (name !== 'the night (23:00)') { r = await pg.evaluate(() => { lokiQueue = []; lokiOnTaskDone(2); return lokiQueue.map(i => i.kind) }); ok(r.join() === 'taskdone', name + ': a task closed on Home, his card says it, as before') }
    await pg.context().close()
  }

  head('one size: the standing sets at one standing height, the seated at one sitting height; sit-read 4 at its set\'s size')
  pg = await boot()
  r = await pg.evaluate(async () => {
    await lokiLoadAll(); const h = async (name, i, seated) => { const m = await lokiSeq(name), im = m.imgs[i], b = lokiMeasure(im); if (!seated) return (b.y1 - b.y0) * m.k; const f = m.json.frames[i]; return (f.seat[1] - b.y0) * m.k }
    return { stand: { idle: await h('idle', 0), look: await h('look', 0), walk: await h('walk', 0), thinking: await h('thinking', 0), standpoint: await h('standpoint', 0), laughing: await h('laughing', 0), prep: await h('prep', 0) },
      sit: { sitedge: await h('sitedge', 3, 1), seatlook: await h('seatlook', 1, 1), seatread: await h('seatread', 0, 1), seatread4: await h('seatread', 3, 1), seatwave: await h('seatwave', 0, 1), sitflat: await h('sitflat', 0, 1) } }
  })
  const sv = Object.values(r.stand), ss = Object.values(r.sit)
  ok(Math.max(...sv) - Math.min(...sv) <= 4, 'standing heights within 4 px of each other (ink, staff included): ' + Object.entries(r.stand).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '))
  ok(Math.abs(r.sit.seatlook - r.sit.sitedge) <= 2 && Math.abs(r.sit.seatread - r.sit.sitedge) <= 3 && Math.abs(r.sit.seatwave - r.sit.sitedge) <= 3 && Math.abs(r.sit.sitflat - r.sit.sitedge) <= 3, 'sitting heights (seat line to the top of his head) at sit-trans 4\'s: ' + Object.entries(r.sit).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '))
  ok(r.sit.seatread4 > r.sit.sitedge * .85, 'sit-read 4 no longer a quarter smaller than its set (' + r.sit.seatread4.toFixed(1) + ')')
  await pg.context().close()

  head('nothing ticks while the app is away')
  pg = await boot()
  r = await pg.evaluate(async () => {
    lokiErrand('taskDone', {}); await new Promise(r => setTimeout(r, 200))
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))
    await new Promise(r => setTimeout(r, 300))
    return { topics: lkr.topicI, eqT: lkr.eqT, rq: lkr.rqT }
  })
  ok(!r.topics, 'the half-minute look at his topics stops while the app is away (it starts again when it is back)')
  await pg.context().close()

  console.log('\nloki-errands: ' + pass + '/' + (pass + fail) + ' checks passed')
  await br.close(); srv.close(); process.exit(fail ? 1 : 0)
})
