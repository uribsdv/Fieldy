#!/usr/bin/env node
// The journey's four roots: gameRoot's rules (learning, body and calm, people for someone else's task or a talk with someone,
// the field by a site, contacts' names found in Hebrew too), the root picker in the difficulty's window (jungle only, the guess
// marked, a choice by hand kept by the task's id and winning over the guess), and a closed task keeping the root it was counted in.
// Run: node tests/game-roots.cjs     Exit code 0 = all checks passed, 1 = at least one failed.
// ROOT=<dir> runs it against another checkout (default: this repository).
'use strict'
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
function loadPlaywright() { try { return require('playwright') } catch (e) {} try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')) } catch (e) {} console.error('✕ playwright not found'); process.exit(2) }
const { chromium } = loadPlaywright()
const ROOT = process.env.ROOT || path.resolve(__dirname, '..')
const PEOPLE = [{ id: 11, name: 'Dave', role: 'contractor' }, { id: 12, name: 'Engr. Junell', role: 'engineer' }, { id: 13, name: 'Novie', role: 'other' }]
const STATE = { tasks: { now: [], today: [], later: [] }, sites: [], people: PEOPLE, events: [], moods: [], personal: { gymLog: {}, meditationLog: {} } }
// the examples of the report (the seeded tasks and tasks written by hand), each with the root it should grow now
const TABLE = [
  ['להתקשר לדייב על באר קלוריה', { site: 'Claveria Well', assignee: 'uri', context: 'phone', note: 'לשאול על ה-waiver' }, 'people'],
  ['לאשר הזמנת משאבה', { assignee: 'gio', context: 'office' }, 'people'],
  ['לעדכן את Monday על Nambaran', { site: 'Nambaran Deep Well', assignee: 'uri', context: 'office' }, 'field'],
  ['לבדוק גנרטור בסטה קרוז', { site: 'Santa Cruz', assignee: 'kenneth', context: 'site', note: 'הערה רגילה' }, 'people'],
  ['לתכנן סיור באפאיאו', { assignee: 'uri', context: null }, 'field'],
  ['להתקשר לנובי', { assignee: 'uri', context: null, site: null }, 'people'],
  ['לשלוח דוח שבועי', { assignee: 'uri', context: null, site: null }, 'field'],
  ['לסדר קבלות', { assignee: 'uri', context: 'office' }, 'field'],
  ['פגישה עם Dave', { assignee: 'uri' }, 'people'],
  ['לקרוא לטכנאי לבאר', { assignee: 'uri' }, 'people'],
  ['קריאת מונה בבאר 3', { assignee: 'uri', context: 'site' }, 'field'],
  ['ללכת לחדר כושר', { assignee: 'uri' }, 'body'],
  ['מדיטציה 10 דקות', { assignee: 'uri' }, 'body'],
  ['לישון מוקדם', { assignee: 'uri' }, 'body'],
  ['לבדוק לחץ מים', { assignee: null, context: null, site: null }, 'field']]
// the rules one by one
const RULES = [
  ['לקרוא את הדוח של NIA', {}, 'learn', '"לקרוא" alone is reading'],
  ['קריאה על משאבות', {}, 'learn', '"קריאה" is reading'],
  ['לקרוא לנובי', {}, 'people', '"לקרוא ל..." is calling someone (and Novie is named)'],
  ['קורס יוגה', {}, 'learn', 'learning comes before body and calm'],
  ['ריצה בבוקר', {}, 'body', 'ריצה'], ['אימון', {}, 'body', 'אימון'], ['הליכה', {}, 'body', 'הליכה'], ['נשימה עמוקה', {}, 'body', 'נשימה'], ['שינה', {}, 'body', 'שינה'],
  ['מתיחות', {}, 'body', 'מתיחות'], ['שחייה', {}, 'body', 'שחייה'], ['Gym', {}, 'body', 'gym'], ['workout', {}, 'body', 'workout'], ['morning run', {}, 'body', 'run'],
  ['evening walk', {}, 'body', 'walk'], ['meditation', {}, 'body', 'meditat'], ['sleep early', {}, 'body', 'sleep'], ['yoga', {}, 'body', 'yoga'], ['stretch', {}, 'body', 'stretch'], ['swim', {}, 'body', 'swim'],
  ['לבדוק משאבה', { site: 'Santa Cruz', context: 'phone' }, 'field', 'a phone task at a site with no one to talk to stays in the field'],
  ['לשאול את דייב על הברז', { site: 'Santa Cruz', context: 'phone' }, 'people', 'a phone task at a site naming a contact is a talk: people'],
  ['לבדוק משאבה', { site: 'Santa Cruz', assignee: 'asc' }, 'people', "someone else's task at a site: people"],
  ['לבדוק משאבה', { context: 'phone' }, 'people', 'the phone with no site: people, as before'],
  ['לשלוח לג\'ונל את הדוח', { assignee: 'uri' }, 'people', 'Engr. Junell, written in Hebrew'],
  ['לבקש מדייב חתימה', { assignee: 'uri' }, 'people', 'Dave, with a prefix (מ)'],
  ['Novie said yes', { assignee: 'uri' }, 'people', 'a name written as it is'],
  ['להזמין דבש', { assignee: 'uri' }, 'field', 'a word that only starts like a name is no name'],
  ['ללמוד את המשאבה', { site: 'X', context: 'site' }, 'learn', 'learning comes before a site, as before'],
  ['x', { note: 'course on wells' }, 'learn', 'the note counts, as before']]
let pass = 0, fail = 0
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); if (s) pass++; else fail++; console.log('  ' + (s ? '✓ ' : '✕ ') + m + (s ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')')) }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (!p.startsWith('/Fieldy/')) { r.writeHead(404); return r.end() } p = p.slice(8) || 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) })
srv.listen(0, async () => {
  const B = 'http://127.0.0.1:' + srv.address().port + '/Fieldy/', br = await chromium.launch()
  async function boot(theme) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }), pg = await ctx.newPage(); pg.errs = []
    pg.on('pageerror', e => pg.errs.push(e.message))
    await pg.route('**/*', r => r.request().url().startsWith(B) ? r.continue() : r.abort())
    await pg.addInitScript(([s, t]) => { if (sessionStorage.getItem('gr_seeded')) return; sessionStorage.setItem('gr_seeded', '1'); localStorage.clear(); localStorage.setItem('fieldy_v2', JSON.stringify(s)); localStorage.setItem('fieldy_theme', t); localStorage.setItem('fieldy_game_v1', JSON.stringify({ v: 1, onboard: { done: true } })) }, [STATE, theme])
    // a task written an hour ago (so it counts), saved like the app saves; the helper is there again after a reload
    await pg.addInitScript(() => { window.__n = 0; window.T = (o = {}) => { const id = 'gr' + Date.now().toString(36) + (++__n); state.tasks.today.push(Object.assign({ id, text: 'משימה ' + __n, assignee: 'uri', color: 'orange', done: false, createdAt: new Date(Date.now() - 3600e3).toISOString() }, o)); save(); return id } })
    await pg.goto(B + '?gnomeHour=12'); await pg.waitForTimeout(500)
    return pg
  }
  let pg = await boot('jungle'), r

  console.log("the report's examples")
  r = await pg.evaluate(rows => rows.map(([text, o]) => gameRoot(Object.assign({ id: 'x', text }, o))), TABLE)
  TABLE.forEach(([text, , want], i) => eq(r[i], want, text + ' → ' + want))
  console.log('the rules')
  r = await pg.evaluate(rows => rows.map(([text, o]) => gameRoot(Object.assign({ id: 'x', text }, o))), RULES)
  RULES.forEach(([text, , want, why], i) => eq(r[i], want, why + ': ' + text + ' → ' + want))
  eq(await pg.evaluate(() => [gameNameKey('Dave'), gameNameKey('דייב'), gameNameKey('Novie'), gameNameKey('נובי'), gameNameKey('Junell'), gameNameKey("ג'ונל")]), ['db', 'db', 'nb', 'nb', 'gnl', 'gnl'], "a name's sound, in English and in Hebrew")

  console.log('the picker (jungle)')
  const id = await pg.evaluate(() => T({ text: 'להתקשר לדייב', site: 'Claveria Well', context: 'phone' }))
  await pg.evaluate(() => { navigateTo('tasks'); setTaskBucket('today') }); await pg.waitForTimeout(150)
  await pg.locator('.gm-diff').first().click(); await pg.waitForTimeout(150)
  r = await pg.evaluate(() => ({ diff: document.querySelectorAll('.gm-pick .gm-opt').length, roots: [...document.querySelectorAll('.gm-pick .gm-ropt')].map(b => [b.textContent, b.classList.contains('on'), b.getAttribute('aria-pressed')]), head: (document.querySelector('.gm-pick .gm-pick-h') || {}).textContent }))
  eq(r.diff, 4, 'the four difficulties are still there')
  eq(r.head, 'תחום', 'a row titled "תחום"')
  eq(r.roots, [['שטח', false, 'false'], ['אנשים', true, 'true'], ['למידה', false, 'false'], ['גוף ושקט', false, 'false']], 'the four roots, the guess (people) marked')
  await pg.locator('.gm-pick .gm-ropt').nth(2).click(); await pg.waitForTimeout(150)
  r = await pg.evaluate(id => ({ open: !!document.querySelector('.gm-pick'), on: [...document.querySelectorAll('.gm-pick .gm-ropt.on')].map(b => b.textContent), kept: gameGet().rootOf[id], root: gameRoot(gameTasks().find(t => t.id === id)), saved: JSON.parse(localStorage.getItem('fieldy_game_v1')).rootOf[id] }), id)
  eq(r, { open: true, on: ['למידה'], kept: 'learn', root: 'learn', saved: 'learn' }, 'a root chosen by hand: marked, the window stays open, kept by the id, saved, and it wins over the guess')
  eq(await pg.evaluate(id => { const t = gameTasks().find(x => x.id === id); return JSON.stringify(t).includes('learn') || 'root' in t || 'rootOf' in t }, id), false, 'no new field on the task (state is unchanged)')
  await pg.locator('.gm-pick .gm-opt').nth(2).click(); await pg.waitForTimeout(150)
  eq(await pg.evaluate(id => [gameGet().diff[id], gameGet().rootOf[id]], id), [4, 'learn'], 'choosing a difficulty after it keeps the root')
  await pg.reload(); await pg.waitForTimeout(500)
  eq(await pg.evaluate(id => [gameGet().rootOf[id], gameRoot(gameTasks().find(t => t.id === id))], id), ['learn', 'learn'], 'kept after a reload')
  eq(await pg.evaluate(id => { gameSetRoot(id, 'nope'); return gameGet().rootOf[id] }, id), 'learn', 'a value that is not a root is refused')

  console.log('closing and closed tasks')
  r = await pg.evaluate(id => { const g = gameGet(), b = Object.assign({}, g.roots); toggleTask(id); return [b.learn, g.roots.learn, g.roots.people] }, id)
  eq(r, [0, 1, 0], 'closed, it grows the root chosen by hand (learning, not the guessed people)')
  r = await pg.evaluate(id => { const g = gameGet(), b = JSON.stringify(g.roots); gameSetRoot(id, 'body'); const a = g.rootOf[id]; toggleTask(id); toggleTask(id); return [a, JSON.stringify(g.roots) === b] }, id)
  eq(r, ['learn', true], 'a closed task: its root can no longer be changed, and unticking and ticking again counts nothing twice')
  r = await pg.evaluate(() => { const id2 = T({ text: 'לשלוח דוח' }); toggleTask(id2); const g = gameGet(), b = JSON.stringify(g.roots); state.tasks.today.find(t => t.id === id2).done = false; gameSetRoot(id2, 'body'); const chosen = g.rootOf[id2]; toggleTask(id2); return [chosen, JSON.stringify(g.roots) === b] })
  eq(r, ['body', true], 'a task already counted, even reopened and given another root, is not counted again (its first root stays)')
  r = await pg.evaluate(() => { const id3 = T({ text: 'ללכת לחדר כושר' }); gameSetRoot(id3, 'people'); state.tasks.today = state.tasks.today.filter(t => t.id !== id3); gameSave(); return id3 in gameGet().rootOf })
  eq(r, false, 'the choice is let go once its task is gone')
  eq(pg.errs, [], 'no page errors')
  await pg.context().close()

  console.log('old themes')
  for (const t of ['original', 'moss', 'aqua', 'nachal']) {
    pg = await boot(t)
    r = await pg.evaluate(() => { T({ text: 'להתקשר לנובי' }); navigateTo('tasks'); setTaskBucket('today'); return !!document.querySelector('.gm-diff,.gm-ropt,.gm-pick') })
    eq(r, false, t + ': no difficulty tag and no root picker')
    eq(pg.errs, [], t + ': no page errors')
    await pg.context().close()
  }
  await br.close(); srv.close()
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed')
  process.exit(fail ? 1 : 0)
})
