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
//
// Auth: this is a personal single-user app, not a multi-tenant product, so
// auth is a single shared passcode (set via `wrangler secret put APP_PASSCODE`)
// checked against an `Authorization: Bearer <passcode>` header. This is NOT
// meant to scale past one person; if this app ever gets other users, this
// needs real per-user auth instead.
//
// Secrets (set with `wrangler secret put`): APP_PASSCODE, ANTHROPIC_API_KEY.
// Bindings: DB (D1) with tables app_state(id, data, updated_at),
// history(ts, type, payload), insights(id, data, generated_at).

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

  // Cron Trigger (add one in the dashboard: Worker → Settings → Trigger
  // events → Add → Cron Trigger, e.g. "0 3 * * *" for 3am daily). This is
  // what makes insights "proactive" — computed on a schedule, not on demand.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(storeInsights(env))
  },
}
