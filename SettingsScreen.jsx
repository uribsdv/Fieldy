import { useState } from 'react'
import { defaultState } from '../storage'

export default function SettingsScreen({ apiKey, saveApiKey, goBack, updateState }) {
  const [key, setKey] = useState(apiKey)
  const [saved, setSaved] = useState(false)
  const [showClear, setShowClear] = useState(false)

  const save = () => {
    saveApiKey(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const clearDay = () => {
    updateState(defaultState())
    setShowClear(false)
    goBack()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={goBack} style={{
          background: '#1e293b', border: 'none', borderRadius: 10,
          padding: '10px 14px', color: '#94a3b8', fontSize: 18
        }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>הגדרות</div>
      </div>

      {/* API Key */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🔑 Anthropic API Key</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>
          נדרש לעיבוד הודעות ויצירת מיילים.{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
            קבל מפתח כאן ←
          </a>
        </div>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{
            width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
            padding: '12px', color: '#f1f5f9', fontSize: 13, outline: 'none', direction: 'ltr',
            marginBottom: 10, boxSizing: 'border-box'
          }}
        />
        <button onClick={save} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
          background: saved ? '#16a34a' : 'linear-gradient(135deg,#3b82f6,#06b6d4)',
          color: '#fff', fontSize: 14, fontWeight: 700
        }}>
          {saved ? '✓ נשמר!' : 'שמור'}
        </button>
      </div>

      {/* About */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>ℹ️ אודות</div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
          Uri Field Assistant v1.0<br />
          Region II · Cagayan Valley<br />
          Innovative Agro Industry
        </div>
      </div>

      {/* Clear data */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🗑 נקה נתוני יום</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>מחיקת כל המשימות, אתרים ואנשים. לא ניתן לשחזור.</div>
        {!showClear
          ? <button onClick={() => setShowClear(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ef444444', background: 'transparent', color: '#ef4444', fontSize: 13 }}>נקה הכל</button>
          : (
            <div>
              <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 10 }}>בטוח? הפעולה לא ניתנת לביטול.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={clearDay} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700 }}>כן, נקה</button>
                <button onClick={() => setShowClear(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 13 }}>ביטול</button>
              </div>
            </div>
          )
        }
      </div>
    </div>
  )
}
