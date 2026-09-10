#!/usr/bin/env node
/*
 * Fieldy — Worker push test (runs the Worker locally, no Cloudflare account)
 * -------------------------------------------------------------------------
 * Starts `wrangler dev --local` on a scratch copy of worker.js with a fresh
 * local D1, a throwaway VAPID key pair and a mock push service running in
 * this process. Then checks, end to end:
 *   - subscribe / status / unsubscribe round-trip
 *   - /api/push/test reaches the mock push service with a valid VAPID JWT
 *     (signature verified with the public key, audience = push origin) and a
 *     payload that decrypts correctly with the subscriber's private key
 *     (RFC 8291 aes128gcm)
 *   - /api/push/run sends a calendar reminder that is due now, once (the
 *     second run is deduped), plus stuck-site and leadership reminders at
 *     their configured local times
 *   - a 410 from the push service removes that subscription
 *   - the "*\/5 * * * *" scheduled trigger runs the check
 *
 * Run:   npm run test:worker      (needs network once for npx wrangler)
 */
'use strict'
const { spawn, execSync } = require('child_process')
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os')
const { webcrypto } = require('crypto')
const subtle = webcrypto.subtle

const ROOT = path.resolve(__dirname, '..')
const WRANGLER = 'wrangler@4.130.0'
const PASS = 'testpass'
const b64u = {
  enc: (buf) => Buffer.from(buf).toString('base64url'),
  dec: (s) => new Uint8Array(Buffer.from(s, 'base64url')),
}
const te = (s) => new TextEncoder().encode(s)
const concat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length } return o }
async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8))
}

const results = []
function record(ok, name, detail) { results.push({ ok, name }); console.log((ok ? '  ✓ ' : '  ✕ ') + name + (ok || !detail ? '' : '\n      ' + detail)) }
async function check(name, fn) { try { await fn(); record(true, name) } catch (e) { record(false, name, e.message) } }
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed') }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  // ── throwaway VAPID keys + a subscriber key pair (what a phone would hold) ──
  const vapid = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const vapidPub = b64u.enc(await subtle.exportKey('raw', vapid.publicKey))
  const vapidPriv = (await subtle.exportKey('jwk', vapid.privateKey)).d
  const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const uaPubRaw = new Uint8Array(await subtle.exportKey('raw', ua.publicKey))
  const uaAuth = webcrypto.getRandomValues(new Uint8Array(16))

  // ── mock push service ──────────────────────────────────────────────────────
  const received = []
  const mock = http.createServer((req, res) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      received.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) })
      if (req.url.startsWith('/gone')) { res.writeHead(410); return res.end() }
      res.writeHead(201); res.end()
    })
  })
  await new Promise(r => mock.listen(0, '127.0.0.1', r))
  const MOCK = 'http://127.0.0.1:' + mock.address().port

  // ── scratch wrangler project ───────────────────────────────────────────────
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fieldy-worker-'))
  fs.copyFileSync(path.join(ROOT, 'worker.js'), path.join(dir, 'worker.js'))
  fs.copyFileSync(path.join(ROOT, 'schema.sql'), path.join(dir, 'schema.sql'))
  fs.writeFileSync(path.join(dir, 'wrangler.toml'), `name = "fieldy-test"\nmain = "worker.js"\ncompatibility_date = "2025-01-01"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "fieldy"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\n`)
  execSync(`npx -y ${WRANGLER} d1 execute DB --local --file schema.sql`, { cwd: dir, stdio: 'ignore' })
  const port = 8790 + Math.floor(Math.random() * 100)
  const dev = spawn('npx', ['-y', WRANGLER, 'dev', '--local', '--port', String(port), '--test-scheduled',
    '--var', 'APP_PASSCODE:' + PASS, '--var', 'VAPID_PUBLIC_KEY:' + vapidPub, '--var', 'VAPID_PRIVATE_KEY:' + vapidPriv, '--var', 'VAPID_SUBJECT:mailto:test@example.com'],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  dev.stdout.on('data', d => { log += d }); dev.stderr.on('data', d => { log += d })
  const BASE = 'http://127.0.0.1:' + port
  const api = async (method, p, body, auth = true) => {
    const r = await fetch(BASE + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + PASS } : {}), body: body ? JSON.stringify(body) : undefined })
    let j = null; try { j = await r.json() } catch (e) {}
    return { status: r.status, json: j }
  }
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/api/state'); break } catch (e) { await sleep(500) } }

  const cleanup = () => { try { dev.kill('SIGTERM') } catch (e) {} mock.close(); try { fs.rmSync(dir, { recursive: true, force: true }) } catch (e) {} }
  process.on('exit', cleanup)

  // helpers to verify what the mock received
  async function verifyVapid(headers) {
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(headers.authorization || '')
    assert(m, 'missing/malformed Authorization vapid header: ' + headers.authorization)
    assert(m[2] === vapidPub, 'k= is not the public key')
    const [h, p, s] = m[1].split('.')
    const key = await subtle.importKey('raw', b64u.dec(vapidPub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u.dec(s), te(h + '.' + p))
    assert(ok, 'JWT signature does not verify')
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    assert(payload.aud === MOCK, 'aud should be the push origin, got ' + payload.aud)
    assert(payload.exp > Date.now() / 1000 && payload.exp < Date.now() / 1000 + 24 * 3600, 'exp out of range')
    assert(headers['content-encoding'] === 'aes128gcm' && headers.ttl, 'missing Content-Encoding/TTL headers')
  }
  async function decrypt(body) {
    const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20]
    const asPub = new Uint8Array(body.subarray(21, 21 + idlen)), ct = new Uint8Array(body.subarray(21 + idlen))
    assert(idlen === 65 && rs >= 18, 'bad aes128gcm header')
    const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
    const ikm = await hkdf(uaAuth, shared, concat(te('WebPush: info\0'), uaPubRaw, asPub), 32)
    const cek = await hkdf(new Uint8Array(salt), ikm, te('Content-Encoding: aes128gcm\0'), 16)
    const nonce = await hkdf(new Uint8Array(salt), ikm, te('Content-Encoding: nonce\0'), 12)
    const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
    const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ct))
    let end = pt.length - 1; while (end >= 0 && pt[end] === 0) end--
    assert(pt[end] === 2, 'last record delimiter should be 0x02')
    return JSON.parse(Buffer.from(pt.subarray(0, end)).toString())
  }

  console.log('\n── Worker push (local wrangler dev on :' + port + ')')
  await check('unauthenticated push routes are refused', async () => {
    const r = await api('GET', '/api/push/status', null, false); assert(r.status === 401, 'got ' + r.status)
  })
  await check('vapid public key is served', async () => {
    const r = await api('GET', '/api/push/vapid-public-key'); assert(r.status === 200 && r.json.key === vapidPub, JSON.stringify(r))
  })
  const subscription = { endpoint: MOCK + '/push/phone-1', keys: { p256dh: b64u.enc(uaPubRaw), auth: b64u.enc(uaAuth) } }
  await check('subscribe stores the device; status lists it; bad body is rejected', async () => {
    let r = await api('POST', '/api/push/subscribe', { subscription: { endpoint: 'x' } }); assert(r.status === 400, 'bad body accepted')
    r = await api('POST', '/api/push/subscribe', { subscription, device: 'Pixel 8 · Chrome' }); assert(r.status === 200 && r.json.ok, JSON.stringify(r))
    r = await api('POST', '/api/push/subscribe', { subscription, device: 'Pixel 8 · Chrome' }); assert(r.status === 200, 're-subscribe (upsert) failed')
    r = await api('GET', '/api/push/status'); assert(r.json.vapid === true && r.json.devices.length === 1 && r.json.devices[0].device === 'Pixel 8 · Chrome', JSON.stringify(r.json))
  })
  await check('test push reaches the push service with a valid VAPID JWT and a decryptable payload', async () => {
    received.length = 0
    const r = await api('POST', '/api/push/test', {})
    assert(r.status === 200 && r.json.sent === 1, JSON.stringify(r.json))
    assert(received.length === 1 && received[0].url === '/push/phone-1', 'mock got ' + received.length + ' requests')
    await verifyVapid(received[0].headers)
    const payload = await decrypt(received[0].body)
    assert(payload.title === 'Fieldy' && /עובדות/.test(payload.body) && payload.url === '/Fieldy/', 'payload: ' + JSON.stringify(payload))
    const st = await api('GET', '/api/push/status'); assert(st.json.devices[0].last_ok_at, 'last_ok_at not recorded')
  })

  // ── reminders: state with an event due "now" (Manila clock), a stuck site, no reflection today ──
  const TZ = -480
  const local = new Date(Date.now() - TZ * 60000)
  const dk = local.toISOString().slice(0, 10)
  const pad = (n) => String(n).padStart(2, '0')
  const minutesNow = local.getUTCHours() * 60 + local.getUTCMinutes()
  const evMin = minutesNow + 60           // event in one hour, notify 60 min before → due now
  const evTime = pad(Math.floor(evMin / 60) % 24) + ':' + pad(evMin % 60)
  const evDate = evMin >= 1440 ? new Date(local.getTime() + 86400000).toISOString().slice(0, 10) : dk
  const tNow = pad(Math.floor(minutesNow / 60)) + ':' + pad(minutesNow % 60)
  const tFar = pad((Math.floor(minutesNow / 60) + 6) % 24) + ':' + pad(minutesNow % 60)
  const state = {
    tasks: { now: [], today: [], later: [] }, people: [],
    sites: [{ id: 1, name: 'Claveria Well', status: 'open', stuckSince: Date.now() - 7 * 86400000 }, { id: 2, name: 'Done Site', status: 'resolved', stuckSince: Date.now() - 9 * 86400000 }],
    events: [{ id: 'ev1', title: 'NIA meeting', date: evDate, time: evTime, notify: '60', site: 'Claveria Well' }, { id: 'ev2', title: 'Later thing', date: dk, time: tFar, notify: '10' }],
    leadershipLog: [{ date: new Date(local.getTime() - 3 * 86400000).toISOString().slice(0, 10), why: 'x' }],
    notifyPrefs: { events: true, stuckSites: true, leadership: true, stuckTime: tNow, leadershipTime: tNow, tzOffsetMinutes: TZ },
  }
  await check('state snapshot can be written (as the app does)', async () => {
    const r = await api('PUT', '/api/state', state); assert(r.status === 200 && r.json.ok, JSON.stringify(r))
  })
  await check('preview lists the event reminder, the stuck site and the reflection nudge as due now', async () => {
    const r = await api('GET', '/api/push/preview')
    const keys = r.json.due.map(d => d.key)
    assert(keys.includes('ev:ev1:' + evDate + ':60'), 'event reminder not due: ' + JSON.stringify(r.json))
    assert(!keys.some(k => k.startsWith('ev:ev2')), 'event 6h away should not be due')
    assert(keys.includes('stuck:' + dk), 'stuck-site nudge not due')
    assert(keys.includes('lead:' + dk), 'leadership nudge not due')
    const stuck = r.json.due.find(d => d.key.startsWith('stuck:'))
    assert(/Claveria Well/.test(stuck.title) && !/Done Site/.test(stuck.body), 'resolved site must not be counted as stuck')
    const lead = r.json.due.find(d => d.key.startsWith('lead:'))
    assert(/3 ימים/.test(lead.body) && !/מאחר|נכשל/.test(lead.body), 'leadership copy should be a plain fact, got: ' + lead.body)
  })
  await check('run sends each due reminder once; a second run is fully deduped', async () => {
    received.length = 0
    let r = await api('POST', '/api/push/run', {})
    assert(r.json.due === 3 && r.json.sent.length === 3, JSON.stringify(r.json))
    assert(received.length === 3, 'mock got ' + received.length + ' pushes')
    const payloads = []
    for (const m of received) { await verifyVapid(m.headers); payloads.push(await decrypt(m.body)) }
    const ev = payloads.find(p => p.tag === 'ev-ev1')
    assert(ev && /בעוד שעה/.test(ev.body) && /Claveria/.test(ev.body) && ev.url === '/Fieldy/#calendar', 'event payload: ' + JSON.stringify(ev))
    received.length = 0
    r = await api('POST', '/api/push/run', {})
    assert(r.json.sent.length === 0 && r.json.skipped.length === 3 && received.length === 0, 'dedupe failed: ' + JSON.stringify(r.json))
  })
  await check('the */5 scheduled trigger runs the check (nothing new due → no sends)', async () => {
    received.length = 0
    const r = await fetch(BASE + '/__scheduled?cron=' + encodeURIComponent('*/5 * * * *'))
    assert(r.status === 200, 'scheduled trigger status ' + r.status)
    await sleep(800)
    assert(received.length === 0, 'deduped reminders were re-sent by the cron')
  })
  await check('a 410 from the push service removes that subscription', async () => {
    const dead = { endpoint: MOCK + '/gone/phone-2', keys: subscription.keys }
    await api('POST', '/api/push/subscribe', { subscription: dead, device: 'old phone' })
    let st = await api('GET', '/api/push/status'); assert(st.json.devices.length === 2, 'expected 2 devices')
    const r = await api('POST', '/api/push/test', { endpoint: dead.endpoint })
    assert(r.json.results.length === 1 && r.json.results[0].status === 410, JSON.stringify(r.json))
    st = await api('GET', '/api/push/status'); assert(st.json.devices.length === 1 && st.json.devices[0].device === 'Pixel 8 · Chrome', 'dead subscription not removed')
  })
  await check('unsubscribe removes the device; run with no subscriptions is a no-op', async () => {
    let r = await api('POST', '/api/push/unsubscribe', { endpoint: subscription.endpoint }); assert(r.json.ok, 'unsubscribe failed')
    const st = await api('GET', '/api/push/status'); assert(st.json.devices.length === 0, 'device still listed')
    r = await api('POST', '/api/push/run', {}); assert(r.json.skipped === 'no subscriptions', JSON.stringify(r.json))
  })
  await check('existing endpoints still work (state read, insights, 404)', async () => {
    let r = await api('GET', '/api/state'); assert(r.status === 200 && r.json.data.sites.length === 2, 'state read broken')
    r = await api('GET', '/api/insights'); assert(r.status === 200, 'insights broken')
    r = await api('GET', '/api/nope'); assert(r.status === 404, '404 broken')
  })

  cleanup()
  const failed = results.filter(r => !r.ok)
  console.log('\n ' + (results.length - failed.length) + '/' + results.length + ' worker checks passed' + (failed.length ? '  —  ' + failed.length + ' FAILED' : ''))
  if (failed.length) console.log('\n--- wrangler log tail ---\n' + log.split('\n').slice(-25).join('\n'))
  process.exit(failed.length ? 1 : 0)
}
main().catch(e => { console.error('worker test crashed:', e); process.exit(1) })
