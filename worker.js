// Fieldy backend — Cloudflare Worker
//
// Jobs:
// 1. /api/claude    — proxies to the real Anthropic API using a server-side
//    secret, so the API key never has to live in the browser/localStorage.
// 2. /api/state     — reads/writes the single JSON state blob in D1, replacing
//    localStorage as the source of truth so data can sync across devices.
// 3. /api/log       — appends an event to the append-only history table (this
//    is what survives even though /api/state is a snapshot that gets
//    overwritten every sync).
// 4. /api/ask       — answers a natural-language question about the data by
//    combining the current state + relevant history + some server-computed
//    stats (exact arithmetic, not left to the model to eyeball), then asking
//    Claude to answer in plain language grounded in those numbers.
// 5. /api/insights  — returns the latest daily proactive summary (see the
//    scheduled handler below, which computes it once a day via Cron Trigger).
// 6. /api/push/*    — Web Push: stores each phone's push subscription in D1,
//    sends encrypted notifications (VAPID + RFC 8291 aes128gcm, done with
//    WebCrypto — no npm dependency), and a scheduled check every few minutes
//    turns calendar reminders, stuck sites and the evening leadership
//    reflection into real phone notifications even when the app is closed.
//
// Auth: this is a personal single-user app, not a multi-tenant product, so
// auth is a single shared passcode (set via `wrangler secret put APP_PASSCODE`)
// checked against an `Authorization: Bearer <passcode>` header. This is NOT
// meant to scale past one person; if this app ever gets other users, this
// needs real per-user auth instead.
//
// Secrets (set with `wrangler secret put`): APP_PASSCODE, ANTHROPIC_API_KEY,
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (from `npx web-push generate-vapid-keys`),
// VAPID_SUBJECT (a "mailto:you@example.com" contact address).
// Bindings: DB (D1) — see schema.sql for all tables.
// Cron triggers: one daily run for insights (e.g. "0 3 * * *") and one
// frequent run for reminders ("*/5 * * * *"); scheduled() tells them apart.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token && token === env.APP_PASSCODE
}

async function callClaude(env, messages, system) {
  const body = { model: 'claude-sonnet-4-6', max_tokens: 1500, messages }
  if (system) body.system = system
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  return r.json()
}

// Exact-arithmetic stats computed here (not left to the LLM to eyeball from
// raw rows). Deliberately simple/conservative — expand as real questions
// reveal what's actually useful, rather than guessing everything up front.
function computeStats(historyRows) {
  const siteOpen = {}      // site name -> ISO date it was first seen open
  const siteResolved = []  // {name, contractor, daysOpen}
  const completionsByWeekday = [0, 0, 0, 0, 0, 0, 0] // Sun..Sat

  for (const row of historyRows) {
    let payload
    try { payload = JSON.parse(row.payload) } catch (e) { continue }
    if (row.type === 'site_created' && payload.name) {
      siteOpen[payload.name] = row.ts
    }
    if (row.type === 'site_status_changed' && payload.status === 'resolved' && payload.name) {
      const openedAt = siteOpen[payload.name]
      if (openedAt) {
        const days = Math.max(0, (new Date(row.ts) - new Date(openedAt)) / 86400000)
        siteResolved.push({ name: payload.name, contractor: payload.contractor || null, daysOpen: Math.round(days * 10) / 10 })
      }
    }
    if (row.type === 'task_completed') {
      const d = new Date(row.ts).getUTCDay()
      completionsByWeekday[d]++
    }
  }

  const byContractor = {}
  for (const s of siteResolved) {
    const key = s.contractor || 'unknown'
    if (!byContractor[key]) byContractor[key] = []
    byContractor[key].push(s.daysOpen)
  }
  const avgDaysByContractor = {}
  for (const key in byContractor) {
    const arr = byContractor[key]
    avgDaysByContractor[key] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
  }

  return {
    sites_resolved_count: siteResolved.length,
    avg_days_open_by_contractor: avgDaysByContractor,
    slowest_resolved_sites: siteResolved.sort((a, b) => b.daysOpen - a.daysOpen).slice(0, 5),
    task_completions_by_weekday: {
      Sunday: completionsByWeekday[0], Monday: completionsByWeekday[1], Tuesday: completionsByWeekday[2],
      Wednesday: completionsByWeekday[3], Thursday: completionsByWeekday[4], Friday: completionsByWeekday[5], Saturday: completionsByWeekday[6],
    },
  }
}

// Daily proactive nudges. Kept deliberately factual/neutral — these note
// what happened, they don't scold. A missed day is stated once, plainly, not
// amplified; a person having a rough week doesn't need their tools piling on.
function computeInsights(state, historyRows) {
  const items = []
  const now = Date.now()
  const daysSince = (iso) => iso ? (now - new Date(iso).getTime()) / 86400000 : Infinity

  const lastMeditation = historyRows.find(r => r.type === 'meditation_completed')
  const medGap = daysSince(lastMeditation && lastMeditation.ts)
  if (medGap >= 2 && medGap !== Infinity) {
    items.push({ icon: '🧘', text: `${Math.floor(medGap)} ימים בלי מדיטציה בפועל.` })
  }

  const personal = (state && state.personal) || {}
  const gymDates = Object.keys(personal.gymLog || {}).sort()
  const lastGym = gymDates[gymDates.length - 1]
  const gymGap = daysSince(lastGym)
  if (gymGap >= 3 && gymGap !== Infinity) {
    items.push({ icon: '🏋️', text: `${Math.floor(gymGap)} ימים בלי אימון מסומן.` })
  }

  if (!personal.vacationGoal) {
    items.push({ icon: '🏖️', text: 'אין יעד חופשה מוגדר — אולי שווה לקבוע אחד.' })
  }

  const openSites = (state && state.sites || []).filter(s => (s.status === 'open' || s.status === 'pending') && s.createdAt)
  for (const s of openSites) {
    const days = daysSince(s.createdAt)
    if (days >= 14) items.push({ icon: '📍', text: `${s.name} פתוח כבר ${Math.floor(days)} יום.` })
  }

  return { generated_at: new Date().toISOString(), items: items.slice(0, 5) }
}

// Rule-based insights (see computeInsights) catch known, specific situations
// ("N days without X"). This looks for whatever else might be worth
// noticing that no one thought to write a rule for — grounded strictly in
// the actual numbers, since a wrong "pattern" is worse than no pattern.
async function discoverPatterns(env, state, historyRows, stats) {
  if (historyRows.length < 20) return [] // not enough history for real patterns yet

  const system =
    'You look at one person\'s own work/life history log and computed stats, and surface 1-3 genuinely ' +
    'useful patterns a fixed rule-checklist would miss — timing habits, a contractor or context that ' +
    'consistently under/over-performs, a recurring bottleneck, etc. ONLY report a pattern if the data ' +
    'actually supports it with reasonable confidence — if there is nothing solid yet, return an empty list. ' +
    'Never invent numbers, never moralize or scold, stay factual and brief. Respond with ONLY a JSON array, ' +
    'no other text, of objects shaped {"icon": "<single emoji>", "text": "<Hebrew, one short sentence>"}.\n\n' +
    'CURRENT STATE:\n' + JSON.stringify(state) + '\n\n' +
    'COMPUTED STATS:\n' + JSON.stringify(stats) + '\n\n' +
    'RECENT HISTORY (newest first):\n' + JSON.stringify(historyRows.slice(0, 300))

  try {
    const resp = await callClaude(env, [{ role: 'user', content: 'What patterns, if any, are actually worth surfacing?' }], system)
    const text = resp.content?.find(b => b.type === 'text')?.text || '[]'
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    if (!Array.isArray(parsed)) return []
    return parsed.filter(x => x && x.icon && x.text).slice(0, 3)
  } catch (e) {
    return [] // a failed pattern search should never break the rule-based insights
  }
}

async function storeInsights(env) {
  const stateRow = await env.DB.prepare('SELECT data FROM app_state WHERE id = ?').bind('default').first()
  const state = stateRow ? JSON.parse(stateRow.data) : null
  const { results: historyRows } = await env.DB.prepare(
    'SELECT ts, type, payload FROM history ORDER BY ts DESC LIMIT 500'
  ).all()
  const insights = computeInsights(state, historyRows)
  const stats = computeStats(historyRows)
  const discovered = await discoverPatterns(env, state, historyRows, stats)
  insights.items = [...insights.items, ...discovered].slice(0, 6)
  await env.DB.prepare(
    `INSERT INTO insights (id, data, generated_at) VALUES ('latest', ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, generated_at = excluded.generated_at`
  ).bind(JSON.stringify(insights), insights.generated_at).run()
  return insights
}

// ── WEB PUSH (VAPID + RFC 8291 payload encryption) ────────────────────────
// Implemented directly on WebCrypto so the Worker has no npm dependency and
// can be pasted into the dashboard as a single file.
const te = (s) => new TextEncoder().encode(s)
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/')
    s += '='.repeat((4 - (s.length % 4)) % 4)
    const bin = atob(s), out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  },
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8))
}
function vapidConfigured(env) { return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) }
// Signed JWT (ES256) that proves to the push service which server is sending.
async function vapidJwt(env, audience) {
  const header = b64u.enc(te(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64u.enc(te(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:fieldy@example.com' })))
  const pub = b64u.dec(env.VAPID_PUBLIC_KEY)              // 65 bytes: 0x04 || x || y
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), d: env.VAPID_PRIVATE_KEY }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te(header + '.' + payload)) // raw r||s, as JWS wants
  return header + '.' + payload + '.' + b64u.enc(sig)
}
// Encrypts a payload for one subscription (RFC 8291 / RFC 8188 aes128gcm).
async function encryptPayload(p256dh, auth, plaintext) {
  const uaPub = b64u.dec(p256dh), authSecret = b64u.dec(auth)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256))
  const ikm = await hkdf(authSecret, shared, concat(te('WebPush: info\0'), uaPub, asPub), 32)
  const cek = await hkdf(salt, ikm, te('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, te('Content-Encoding: nonce\0'), 12)
  const record = concat(te(plaintext), new Uint8Array([2]))   // 0x02 = last-record delimiter
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record))
  const rs = 4096
  const header = concat(salt, new Uint8Array([rs >>> 24, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]), new Uint8Array([asPub.length]), asPub)
  return concat(header, ct)
}
// Sends one notification to one subscription. Returns the push service's
// HTTP status (201 = accepted; 404/410 = the subscription is dead).
async function sendPush(env, sub, payload) {
  const audience = new URL(sub.endpoint).origin
  const jwt = await vapidJwt(env, audience)
  const body = await encryptPayload(sub.p256dh, sub.auth, JSON.stringify(payload))
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Urgency': 'normal',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC_KEY,
    },
    body,
  })
  return r.status
}
// Sends to every stored subscription, drops the ones the push service says
// are gone, and returns a per-device summary.
async function notifyAll(env, payload, onlyEndpoint) {
  if (!vapidConfigured(env)) return { error: 'VAPID keys not configured on the Worker' }
  const { results: subs } = await env.DB.prepare('SELECT endpoint, p256dh, auth, device FROM push_subscriptions').all()
  const targets = onlyEndpoint ? subs.filter(s => s.endpoint === onlyEndpoint) : subs
  const out = []
  for (const sub of targets) {
    let status
    try { status = await sendPush(env, sub, payload) } catch (e) { status = 'error: ' + (e && e.message) }
    const ok = status === 201 || status === 200
    if (status === 404 || status === 410) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
    } else if (ok) {
      await env.DB.prepare('UPDATE push_subscriptions SET last_ok_at = ?, failures = 0 WHERE endpoint = ?').bind(new Date().toISOString(), sub.endpoint).run()
    } else {
      await env.DB.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE endpoint = ?').bind(sub.endpoint).run()
    }
    out.push({ device: sub.device, status, ok })
  }
  return { sent: out.filter(o => o.ok).length, results: out }
}

// ── REMINDERS (what the frequent cron turns into notifications) ──────────
// Copy rule: a nudge states a fact and offers the next step. It never scores,
// never scolds ("2 days since your last reflection", not "you're behind").
const PREF_DEFAULTS = { events: true, stuckSites: true, leadership: true, leadershipTime: '20:00', stuckTime: '08:00', tzOffsetMinutes: -480 }
const WINDOW_MIN = 5   // must match the cron interval ("*/5 * * * *")
function hm(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null }
function dateKeyOf(d) { return d.toISOString().slice(0, 10) }
// Same recurrence rules as the app's getEventsForDate().
function eventsOnDate(events, dk) {
  const [y, m, day] = dk.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
  return (events || []).filter(e => {
    if (e.date === dk) return true
    if (!e.recurring) return false
    const ed = new Date(e.date + 'T00:00:00Z')
    if (isNaN(ed)) return false
    if (e.recurring === 'daily') return true
    if (e.recurring === 'weekly') return ed.getUTCDay() === dow
    if (e.recurring === 'monthly') return ed.getUTCDate() === day
    if (e.recurring === 'yearly') return ed.getUTCMonth() === m - 1 && ed.getUTCDate() === day
    return false
  })
}
function humanMinutes(n) {
  if (n === 0) return 'עכשיו'
  if (n < 60) return 'בעוד ' + n + ' דקות'
  if (n === 60) return 'בעוד שעה'
  if (n < 1440) return 'בעוד ' + Math.round(n / 60) + ' שעות'
  return 'מחר'
}
// Decides what is due in the current 5-minute window. Pure: takes the state
// and "now", returns [{key, title, body, url, tag}]. `key` dedupes sends.
function dueReminders(state, nowMs) {
  const prefs = Object.assign({}, PREF_DEFAULTS, (state && state.notifyPrefs) || {})
  const local = new Date(nowMs - prefs.tzOffsetMinutes * 60000)      // wall clock where Uri is
  const todayKey = dateKeyOf(local)
  const minutesNow = local.getUTCHours() * 60 + local.getUTCMinutes()
  const inWindow = (mins) => mins <= minutesNow && minutesNow < mins + WINDOW_MIN
  const due = []

  if (prefs.events) {
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const d = new Date(local.getTime() + dayOffset * 86400000)
      const dk = dateKeyOf(d)
      for (const ev of eventsOnDate(state.events, dk)) {
        if (ev.notify === '' || ev.notify == null) continue
        const notify = parseInt(ev.notify, 10); if (isNaN(notify)) continue
        const evMin = hm(ev.time || '09:00'); if (evMin == null) continue
        const fireAt = dayOffset * 1440 + evMin - notify         // minutes from today's local midnight
        if (!inWindow(fireAt)) continue
        due.push({
          key: 'ev:' + ev.id + ':' + dk + ':' + notify,
          title: ev.title || 'אירוע',
          body: humanMinutes(notify) + (ev.time ? ' · ' + ev.time : '') + (ev.site ? ' · 📍 ' + ev.site : ''),
          url: '/Fieldy/#calendar', tag: 'ev-' + ev.id,
        })
      }
    }
  }

  if (prefs.stuckSites && hm(prefs.stuckTime) != null && inWindow(hm(prefs.stuckTime))) {
    const stuck = (state.sites || [])
      .filter(s => s.stuckSince && s.status !== 'resolved' && (nowMs - s.stuckSince) / 86400000 >= 5)
      .map(s => ({ name: s.name, days: Math.floor((nowMs - s.stuckSince) / 86400000) }))
      .sort((a, b) => b.days - a.days)
    if (stuck.length) {
      due.push({
        key: 'stuck:' + todayKey,
        title: stuck.length === 1 ? stuck[0].name + ' מחכה לצעד הבא' : stuck.length + ' אתרים מחכים לצעד הבא',
        body: stuck.slice(0, 4).map(s => s.name + ' · ' + s.days + ' ימים').join(', ') + (stuck.length > 4 ? ' ועוד' : ''),
        url: '/Fieldy/#sites', tag: 'stuck',
      })
    }
  }

  if (prefs.leadership && hm(prefs.leadershipTime) != null && inWindow(hm(prefs.leadershipTime))) {
    const log = state.leadershipLog || []
    if (!log.some(e => e.date === todayKey)) {
      const last = log.map(e => e.date).sort().pop()
      const gap = last ? Math.round((new Date(todayKey) - new Date(last)) / 86400000) : null
      due.push({
        key: 'lead:' + todayKey,
        title: '2 דקות לרפלקציה של היום?',
        body: gap && gap >= 2 ? gap + ' ימים מאז הרשומה האחרונה. בלי לחץ — משפט אחד מספיק.' : "מה ה'למה' שהוביל אותך היום? היומן פתוח.",
        url: '/Fieldy/#tao', tag: 'lead',
      })
    }
  }
  return due
}
// The frequent cron: compute what is due, skip anything already sent, send.
async function runPushChecks(env, nowMs) {
  nowMs = nowMs || Date.now()
  const { results: subs } = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').all()
  if (!subs.length || !subs[0].n) return { skipped: 'no subscriptions' }
  const stateRow = await env.DB.prepare('SELECT data FROM app_state WHERE id = ?').bind('default').first()
  if (!stateRow) return { skipped: 'no state' }
  let state
  try { state = JSON.parse(stateRow.data) } catch (e) { return { skipped: 'state not parseable' } }
  const due = dueReminders(state, nowMs)
  const sent = [], skipped = []
  for (const item of due) {
    const seen = await env.DB.prepare('SELECT key FROM push_sent WHERE key = ?').bind(item.key).first()
    if (seen) { skipped.push(item.key); continue }
    await env.DB.prepare('INSERT INTO push_sent (key, sent_at) VALUES (?, ?)').bind(item.key, new Date(nowMs).toISOString()).run()
    const r = await notifyAll(env, { title: item.title, body: item.body, url: item.url, tag: item.tag })
    sent.push({ key: item.key, result: r })
  }
  // keep the dedupe table small
  await env.DB.prepare('DELETE FROM push_sent WHERE sent_at < ?').bind(new Date(nowMs - 30 * 86400000).toISOString()).run()
  return { due: due.length, sent, skipped }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (!checkAuth(request, env)) {
      return json({ error: 'unauthorized' }, 401)
    }

    // ── Claude proxy ──────────────────────────────
    if (url.pathname === '/api/claude' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ error: 'invalid JSON body' }, 400)
      }
      const data = await callClaude(env, body.messages, body.system)
      return json(data)
    }

    // ── State: read ───────────────────────────────
    if (url.pathname === '/api/state' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, updated_at FROM app_state WHERE id = ?')
        .bind('default')
        .first()
      if (!row) return json({ data: null, updated_at: null })
      return json({ data: JSON.parse(row.data), updated_at: row.updated_at })
    }

    // ── State: write ──────────────────────────────
    if (url.pathname === '/api/state' && request.method === 'PUT') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ error: 'invalid JSON body' }, 400)
      }
      const now = new Date().toISOString()
      await env.DB.prepare(
        `INSERT INTO app_state (id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
        .bind('default', JSON.stringify(body), now)
        .run()
      return json({ ok: true, updated_at: now })
    }

    // ── History: append an event ──────────────────
    if (url.pathname === '/api/log' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ error: 'invalid JSON body' }, 400)
      }
      if (!body.type) return json({ error: 'missing type' }, 400)
      const ts = body.ts || new Date().toISOString()
      await env.DB.prepare('INSERT INTO history (ts, type, payload) VALUES (?, ?, ?)')
        .bind(ts, body.type, JSON.stringify(body.payload || {}))
        .run()
      return json({ ok: true })
    }

    // ── Ask: natural-language question over state + history ───
    if (url.pathname === '/api/ask' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ error: 'invalid JSON body' }, 400)
      }
      const question = (body.question || '').trim()
      if (!question) return json({ error: 'missing question' }, 400)

      const stateRow = await env.DB.prepare('SELECT data FROM app_state WHERE id = ?').bind('default').first()
      const currentState = stateRow ? JSON.parse(stateRow.data) : null

      const { results: historyRows } = await env.DB.prepare(
        'SELECT ts, type, payload FROM history ORDER BY ts DESC LIMIT 500'
      ).all()

      const stats = computeStats(historyRows)

      const system =
        'You are answering a question about one field-operations manager\'s own task/site data. ' +
        'Answer ONLY from the JSON provided below — never invent numbers. If the data does not contain ' +
        'enough history to answer confidently, say so plainly instead of guessing. Answer in Hebrew, ' +
        'concisely (2-4 sentences unless the question needs a short list).\n\n' +
        'CURRENT STATE:\n' + JSON.stringify(currentState) + '\n\n' +
        'COMPUTED STATS (exact, already calculated from the history log):\n' + JSON.stringify(stats) + '\n\n' +
        'RAW RECENT HISTORY (last 500 events, newest first):\n' + JSON.stringify(historyRows.slice(0, 100))

      const claudeResp = await callClaude(env, [{ role: 'user', content: question }], system)
      const answer = claudeResp.content?.find(b => b.type === 'text')?.text || ''
      if (claudeResp.error) return json({ error: claudeResp.error.message || 'claude error' }, 500)
      return json({ answer, stats })
    }

    // ── Push: subscriptions, test send, manual check ──
    if (url.pathname === '/api/push/vapid-public-key' && request.method === 'GET') {
      if (!vapidConfigured(env)) return json({ error: 'VAPID keys not configured on the Worker' }, 503)
      return json({ key: env.VAPID_PUBLIC_KEY })
    }
    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      let body
      try { body = await request.json() } catch (e) { return json({ error: 'invalid JSON body' }, 400) }
      const sub = body.subscription || {}
      const keys = sub.keys || {}
      if (!sub.endpoint || !keys.p256dh || !keys.auth) return json({ error: 'subscription must have endpoint, keys.p256dh, keys.auth' }, 400)
      await env.DB.prepare(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, device, created_at, failures) VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, failures = 0`
      ).bind(sub.endpoint, keys.p256dh, keys.auth, String(body.device || '').slice(0, 120), new Date().toISOString()).run()
      return json({ ok: true })
    }
    if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
      let body
      try { body = await request.json() } catch (e) { return json({ error: 'invalid JSON body' }, 400) }
      if (!body.endpoint) return json({ error: 'missing endpoint' }, 400)
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run()
      return json({ ok: true })
    }
    if (url.pathname === '/api/push/status' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT endpoint, device, created_at, last_ok_at, failures FROM push_subscriptions ORDER BY created_at').all()
      return json({ vapid: vapidConfigured(env), devices: results.map(r => ({ endpoint: r.endpoint, device: r.device, created_at: r.created_at, last_ok_at: r.last_ok_at, failures: r.failures })) })
    }
    if (url.pathname === '/api/push/test' && request.method === 'POST') {
      let body = {}
      try { body = await request.json() } catch (e) {}
      const r = await notifyAll(env, { title: 'Fieldy', body: 'ההתראות עובדות ✓', url: '/Fieldy/', tag: 'test' }, body.endpoint || null)
      return json(r, r.error ? 503 : 200)
    }
    // Runs the same check the cron runs — for testing without waiting.
    if (url.pathname === '/api/push/run' && request.method === 'POST') {
      let body = {}
      try { body = await request.json() } catch (e) {}
      const at = body.at ? Date.parse(body.at) : Date.now()
      return json(await runPushChecks(env, isNaN(at) ? Date.now() : at))
    }
    // What would be due right now, without sending — handy for checking the
    // schedule from the phone.
    if (url.pathname === '/api/push/preview' && request.method === 'GET') {
      const stateRow = await env.DB.prepare('SELECT data FROM app_state WHERE id = ?').bind('default').first()
      const state = stateRow ? JSON.parse(stateRow.data) : {}
      const at = url.searchParams.get('at') ? Date.parse(url.searchParams.get('at')) : Date.now()
      return json({ at: new Date(isNaN(at) ? Date.now() : at).toISOString(), due: dueReminders(state, isNaN(at) ? Date.now() : at) })
    }

    // ── Insights: latest daily proactive summary ───
    if (url.pathname === '/api/insights' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, generated_at FROM insights WHERE id = ?').bind('latest').first()
      if (!row) return json({ generated_at: null, items: [] })
      return json(JSON.parse(row.data))
    }

    // Manual trigger, useful for testing without waiting for the cron —
    // same passcode auth as everything else, not separately exposed.
    if (url.pathname === '/api/insights/refresh' && request.method === 'POST') {
      const insights = await storeInsights(env)
      return json(insights)
    }

    return json({ error: 'not found' }, 404)
  },

  // Cron Triggers (dashboard: Worker → Settings → Trigger events, or the
  // [triggers] block in wrangler.toml). Two schedules share this handler:
  // - a frequent one ("*/5 * * * *") that only runs the reminder check;
  // - any other (e.g. "0 3 * * *") that also recomputes the daily insights.
  async scheduled(event, env, ctx) {
    const frequent = /^\*\/\d+ /.test(event.cron || '')
    ctx.waitUntil(runPushChecks(env).catch(e => console.log('push check failed:', e && e.message)))
    if (!frequent) ctx.waitUntil(storeInsights(env))
  },
}
