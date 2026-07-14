import { useState } from 'react'
import { parseNotes } from '../claude'

export default function InputScreen({ state, updateState, goBack, apiKey }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handle = async () => {
    if (!text.trim() || !apiKey) return
    setLoading(true)
    setError(null)
    try {
      const parsed = await parseNotes(apiKey, text)
      const stamp = Date.now()
      const tag = (arr, prefix) => (arr || []).map((t, i) => ({ ...t, id: `${prefix}${stamp}${i}`, done: false }))

      updateState({
        tasks: {
          now: [...state.tasks.now, ...tag(parsed.now, 'n')],
          today: [...state.tasks.today, ...tag(parsed.today, 'd')],
          later: [...state.tasks.later, ...tag(parsed.later, 'l')],
        },
        sites: mergeSites(state.sites, parsed.sites || []),
        people: mergePeople(state.people, parsed.people || []),
        focus: parsed.focus || state.focus,
        summary: parsed.summary || state.summary,
      })
      goBack()
    } catch (e) {
      setError('שגיאה: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={goBack} style={{
          background: '#1e293b', border: 'none', borderRadius: 10,
          padding: '10px 14px', color: '#94a3b8', fontSize: 18
        }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>הוסף הודעות</div>
      </div>

      <div style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
        הדבק הודעות מוואטסאפ — בכל שפה. אני אסדר אותן לדלי הנכון.
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
        placeholder={"Claveria well — Gio to assess\nהחלפת משאבה בדולרס\nDave needs to sign waiver — Upi 3\nפגישה עם נובי ב-NIA יום שני"}
        style={{
          flex: 1, minHeight: 200, background: '#1e293b', border: '1px solid #334155',
          borderRadius: 12, padding: '14px', color: '#f1f5f9', fontSize: 15,
          resize: 'none', outline: 'none', lineHeight: 1.7, direction: 'rtl'
        }}
      />

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
      {!apiKey && <div style={{ color: '#f59e0b', fontSize: 13, marginTop: 8 }}>⚠️ חסר API Key — הגדר בהגדרות</div>}

      <button onClick={handle} disabled={loading || !text.trim() || !apiKey} style={{
        marginTop: 12, padding: '16px', borderRadius: 14, border: 'none',
        background: loading || !text.trim() || !apiKey ? '#1e293b' : 'linear-gradient(135deg,#3b82f6,#06b6d4)',
        color: loading || !text.trim() || !apiKey ? '#475569' : '#fff',
        fontSize: 16, fontWeight: 700
      }}>
        {loading ? '⚙️ מסדר...' : '⚡ ארגן את היום'}
      </button>
    </div>
  )
}

function mergeSites(existing, incoming) {
  const map = {}
  existing.forEach(s => { map[s.name] = s })
  incoming.forEach(s => {
    if (map[s.name]) {
      map[s.name] = { ...map[s.name], ...s }
    } else {
      map[s.name] = { ...s, id: s.name + Date.now() }
    }
  })
  return Object.values(map)
}

function mergePeople(existing, incoming) {
  const map = {}
  existing.forEach(p => { map[p.name] = p })
  incoming.forEach(p => {
    if (map[p.name]) {
      map[p.name] = { ...map[p.name], ...p }
    } else {
      map[p.name] = { ...p, id: p.name + Date.now() }
    }
  })
  return Object.values(map)
}
