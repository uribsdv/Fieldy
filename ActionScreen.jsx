import { useState } from 'react'
import { generateAction } from '../claude'

export default function ActionScreen({ ctx, goBack, apiKey }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeType, setActiveType] = useState(null)

  const gen = async (type) => {
    setActiveType(type)
    setLoading(true)
    setResult(null)
    try {
      const text = await generateAction(apiKey, type, ctx?.text, ctx?.assignee)
      setResult(text)
    } catch (e) {
      setResult('שגיאה: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={goBack} style={{
          background: '#1e293b', border: 'none', borderRadius: 10,
          padding: '10px 14px', color: '#94a3b8', fontSize: 18
        }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>צור תוכן</div>
      </div>

      {ctx?.text && (
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '14px', marginBottom: 20, borderRight: '3px solid #3b82f6' }}>
          <div style={{ fontSize: 14, color: '#f1f5f9', lineHeight: 1.5 }}>{ctx.text}</div>
          {ctx.assignee && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>👤 {ctx.assignee}</div>}
        </div>
      )}

      {!result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { type: 'whatsapp', icon: '💬', label: 'הודעת WhatsApp', sub: "לג'יו / קנת' / קבלן" },
            { type: 'email', icon: '📧', label: 'מייל', sub: 'ASC / 11-16 / NIA' },
            { type: 'monday', icon: '📋', label: 'עדכון Monday', sub: 'סטטוס + פעולה הבאה' },
          ].map(a => (
            <button key={a.type} onClick={() => gen(a.type)} disabled={loading} style={{
              padding: '16px', borderRadius: 14, border: '1px solid #334155',
              background: activeType === a.type && loading ? '#1e40af22' : '#1e293b',
              color: '#f1f5f9', textAlign: 'right', cursor: loading ? 'default' : 'pointer',
              opacity: loading && activeType !== a.type ? 0.5 : 1
            }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{a.icon} {a.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{a.sub}</div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✍️</div>
          <div style={{ fontSize: 14 }}>כותב...</div>
        </div>
      )}

      {result && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1, background: '#1e293b', borderRadius: 14, padding: '16px',
            fontSize: 14, color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap',
            overflowY: 'auto', marginBottom: 12, direction: 'ltr', textAlign: 'left'
          }}>
            {result}
          </div>
          <button onClick={copy} style={{
            padding: '15px', borderRadius: 14, border: 'none',
            background: copied ? '#16a34a' : 'linear-gradient(135deg,#3b82f6,#06b6d4)',
            color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 10
          }}>
            {copied ? '✓ הועתק!' : '📋 העתק'}
          </button>
          <button onClick={() => { setResult(null); setActiveType(null) }} style={{
            padding: '14px', borderRadius: 14, border: '1px solid #334155',
            background: 'transparent', color: '#64748b', fontSize: 14
          }}>
            ← צור משהו אחר
          </button>
        </div>
      )}
    </div>
  )
}
