const API = 'https://api.anthropic.com/v1/messages'

const PARSE_PROMPT = `You are a field operations assistant for Uri, a Regional Manager at Innovative Agro Industry in the Philippines (Region II – Cagayan Valley). Uri has ADHD. He oversees SPIS (solar-powered irrigation) installations across Isabela, Cagayan, Nueva Vizcaya, and CAR (Cordillera). Engineers: Gio and Kenneth. Contractors: ASC Construction (engineer: Dave) and 11-16 Construction.

Uri sends raw notes in Hebrew, English, or Tagalog. Organize into structured data.

Return ONLY valid JSON (no markdown, no backticks):
{
  "now": [{"id":"n1","text":"short action verb + task (max 8 words)","site":null,"assignee":"uri/gio/kenneth/asc/11-16 or null","color":"red/orange/green"}],
  "today": [{"id":"d1","text":"task","site":null,"assignee":null,"color":"orange"}],
  "later": [{"id":"l1","text":"task","site":null,"assignee":null,"color":"green"}],
  "sites": [{"name":"site name","province":"province","issue":"issue summary","contractor":"asc/11-16/null","status":"open/pending/resolved"}],
  "people": [{"name":"person name","role":"engineer/contractor/nia/other","pending":"what is waiting from them"}],
  "focus": "ONE sentence Hebrew — most important thing today",
  "summary": "2-sentence Hebrew summary"
}

Rules:
- now: MAX 3 tasks — most urgent only
- color: red=critical/urgent, orange=important, green=routine
- Extract site names and people from context
- Infer assignee from context`

const ACTION_PROMPTS = {
  whatsapp: (ctx, assignee) => `Write a short WhatsApp message in English from Uri (Regional Manager, Innovative Agro Industry Philippines) to ${assignee || 'a team member'} about: ${ctx}. Max 3 sentences, direct and field-ops style.`,
  email: (ctx) => `Write a professional email in English from Uri (Regional Manager, Innovative Agro Industry) about: ${ctx}. Include subject line. Concise and action-oriented.`,
  monday: (ctx) => `Write a Monday.com task update in English for: ${ctx}. Format: Status / Issue / Next Action / Owner.`,
}

export const parseNotes = async (apiKey, text) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: PARSE_PROMPT,
      messages: [{ role: 'user', content: text }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const raw = data.content?.find(b => b.type === 'text')?.text || ''
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

export const generateAction = async (apiKey, type, context, assignee) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: ACTION_PROMPTS[type](context, assignee) }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.find(b => b.type === 'text')?.text || ''
}
