import { useState } from 'react'

const COLOR = {
  red: { bg: '#ef444418', border: '#ef444460', text: '#ef4444', label: 'דחוף' },
  orange: { bg: '#f59e0b18', border: '#f59e0b60', text: '#f59e0b', label: 'חשוב' },
  green: { bg: '#4ade8018', border: '#4ade8060', text: '#4ade80', label: 'שוטף' },
}

const ASSIGNEE = { uri: 'אני', gio: "ג'יו", kenneth: "קנת'", asc: 'ASC', '11-16': '11-16' }

const BUCKETS = [
  { key: 'now', icon: '⚡', label: 'עכשיו', color: '#ef4444' },
  { key: 'today', icon: '📅', label: 'היום', color: '#f59e0b' },
  { key: 'later', icon: '🕐', label: 'אחר כך', color: '#64748b' },
]

export default function TasksScreen({ state, updateState, navigate }) {
  const [bucket, setBucket] = useState('now')
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [addAssignee, setAddAssignee] = useState('uri')
  const [addColor, setAddColor] = useState('orange')
  const [addBucket, setAddBucket] = useState('now')

  const tasks = state.tasks[bucket] || []
  const counts = {
    now: state.tasks.now.filter(t => !t.done).length,
    today: state.tasks.today.filter(t => !t.done).length,
    later: state.tasks.later.filter(t => !t.done).length,
  }

  const toggle = (id) => {
    const update = (arr) => arr.map(t => t.id === id ? { ...t, done: !t.done } : t)
    updateState({ tasks: { now: update(state.tasks.now), today: update(state.tasks.today), later: update(state.tasks.later) } })
  }

  const addTask = () => {
    if (!addText.trim()) return
    const task = { id: `m${Date.now()}`, text: addText.trim(), assignee: addAssignee, color: addColor, done: false, site: null }
    updateState({ tasks: { ...state.tasks, [addBucket]: [...state.tasks[addBucket], task] } })
    setAddText(''); setShowAdd(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: '48px 16px 12px', background: 'linear-gradient(180deg,#1e293b,#0f172a)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>משימות</div>
          <button onClick={() => setShowAdd(true)} style={{
            background: '#1e40af', border: 'none', borderRadius: 10,
            padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600
          }}>+ הוסף</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {BUCKETS.map(b => (
            <button key={b.key} onClick={() => setBucket(b.key)} style={{
              padding: '10px 4px', borderRadius: 10, border: `1.5px solid ${bucket === b.key ? b.color : 'transparent'}`,
              background: bucket === b.key ? b.color + '18' : '#1e293b',
              color: bucket === b.key ? b.color : '#64748b', cursor: 'pointer'
            }}>
              <div style={{ fontSize: 16 }}>{b.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{b.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{counts[b.key] || ''}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 14 }}>ריק — כל הכבוד!</div>
          </div>
        )}
        {tasks.map(task => {
          const c = COLOR[task.color] || COLOR.orange
          return (
            <div key={task.id} style={{
              background: task.done ? '#0f172a' : c.bg,
              border: `1.5px solid ${task.done ? '#1e293b' : c.border}`,
              borderRadius: 14, padding: '14px',
              opacity: task.done ? 0.45 : 1, transition: 'opacity 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div onClick={() => toggle(task.id)} style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                  background: task.done ? c.text : 'transparent',
                  border: `2px solid ${c.text}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#fff', transition: 'all 0.15s'
                }}>
                  {task.done ? '✓' : ''}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', textDecoration: task.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                    {task.text}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                    {task.site && <span style={{ fontSize: 11, color: '#64748b' }}>📍 {task.site}</span>}
                    {task.assignee && <span style={{ fontSize: 11, color: '#64748b' }}>👤 {ASSIGNEE[task.assignee] || task.assignee}</span>}
                    <span style={{ fontSize: 11, color: c.text }}>{c.label}</span>
                  </div>
                </div>
                {!task.done && (
                  <button onClick={() => navigate('action', { text: task.text, assignee: task.assignee })} style={{
                    background: '#0f172a', border: 'none', borderRadius: 8,
                    padding: '7px 9px', color: '#64748b', fontSize: 16, flexShrink: 0
                  }}>✍️</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: '#000d', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '18px 18px 0 0', padding: '22px 16px 40px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 14 }}>+ משימה חדשה</div>
            <textarea value={addText} onChange={e => setAddText(e.target.value)} placeholder="מה צריך לעשות?" autoFocus
              style={{ width: '100%', minHeight: 80, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '12px', color: '#f1f5f9', fontSize: 15, resize: 'none', outline: 'none', direction: 'rtl' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
              {[
                { label: 'אחראי', value: addAssignee, set: setAddAssignee, opts: [['uri','אני'],['gio',"ג'יו"],['kenneth',"קנת'"],['asc','ASC'],['11-16','11-16']] },
                { label: 'מתי', value: addBucket, set: setAddBucket, opts: [['now','עכשיו'],['today','היום'],['later','אחר כך']] },
                { label: 'עדיפות', value: addColor, set: setAddColor, opts: [['red','דחוף'],['orange','חשוב'],['green','שוטף']] },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{f.label}</div>
                  <select value={f.value} onChange={e => f.set(e.target.value)} style={{
                    width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                    padding: '9px 8px', color: '#f1f5f9', fontSize: 13, outline: 'none'
                  }}>
                    {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={addTask} disabled={!addText.trim()} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: addText.trim() ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : '#334155',
                color: addText.trim() ? '#fff' : '#64748b', fontSize: 15, fontWeight: 700
              }}>הוסף</button>
              <button onClick={() => setShowAdd(false)} style={{
                padding: '14px 18px', borderRadius: 12, border: '1px solid #334155',
                background: 'transparent', color: '#64748b', fontSize: 14
              }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
