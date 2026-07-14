export default function HomeScreen({ state, navigate, noApiKey }) {
  const allTasks = [...state.tasks.now, ...state.tasks.today, ...state.tasks.later]
  const done = allTasks.filter(t => t.done).length
  const total = allTasks.length
  const openSites = state.sites.filter(s => s.status === 'open' || s.status === 'pending').length
  const pendingPeople = state.people.filter(p => p.pending).length
  const urgentTasks = state.tasks.now.filter(t => !t.done)

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg,#1e3a5f 0%,#0f172a 100%)',
        padding: '48px 20px 20px',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
              בוקר טוב, אורי ☀️
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Region II · Cagayan Valley</div>
          </div>
          <button onClick={() => navigate('settings')} style={{
            background: '#1e293b', border: 'none', borderRadius: 10,
            padding: '8px 10px', color: '#64748b', fontSize: 16
          }}>⚙️</button>
        </div>

        {/* API key warning */}
        {noApiKey && (
          <div onClick={() => navigate('settings')} style={{
            marginTop: 14, padding: '10px 14px', background: '#f59e0b18',
            border: '1px solid #f59e0b44', borderRadius: 10, cursor: 'pointer'
          }}>
            <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>⚠️ נדרש API Key</div>
            <div style={{ fontSize: 12, color: '#78716c', marginTop: 2 }}>לחץ להגדרות</div>
          </div>
        )}

        {/* Progress */}
        {total > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
              <span>התקדמות היום</span>
              <span style={{ color: done === total ? '#4ade80' : '#64748b' }}>{done}/{total} משימות</span>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 99, height: 6 }}>
              <div style={{
                height: '100%', borderRadius: 99, transition: 'width 0.4s',
                width: `${total ? (done / total) * 100 : 0}%`,
                background: done === total ? '#4ade80' : 'linear-gradient(90deg,#3b82f6,#06b6d4)'
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Focus card */}
        {state.focus && (
          <div style={{
            background: 'linear-gradient(135deg,#1e3a5f,#1e293b)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 14,
            border: '1px solid #1e40af33'
          }}>
            <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>🎯 הכי חשוב היום</div>
            <div style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.5, fontWeight: 600 }}>{state.focus}</div>
          </div>
        )}

        {/* Urgent tasks */}
        {urgentTasks.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>⚡ עכשיו</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {urgentTasks.slice(0, 3).map(task => (
                <div key={task.id} onClick={() => navigate('tasks')} style={{
                  background: '#ef444415', border: '1.5px solid #ef444440',
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{task.text}</div>
                  {(task.site || task.assignee) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                      {task.site && <span style={{ fontSize: 11, color: '#64748b' }}>📍 {task.site}</span>}
                      {task.assignee && <span style={{ fontSize: 11, color: '#64748b' }}>👤 {task.assignee}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { icon: '⚡', label: 'עכשיו', value: state.tasks.now.filter(t=>!t.done).length, color: '#ef4444', screen: 'tasks' },
            { icon: '📍', label: 'אתרים פתוחים', value: openSites, color: '#f59e0b', screen: 'sites' },
            { icon: '👥', label: 'ממתין', value: pendingPeople, color: '#06b6d4', screen: 'people' },
          ].map(s => (
            <div key={s.screen} onClick={() => navigate(s.screen)} style={{
              background: '#1e293b', borderRadius: 12, padding: '12px 10px',
              textAlign: 'center', cursor: 'pointer', border: `1px solid ${s.value > 0 ? s.color + '33' : 'transparent'}`
            }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.value > 0 ? s.color : '#475569', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Add button */}
        <button onClick={() => navigate('input')} style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <span>+</span> הוסף הודעות מוואטסאפ
        </button>

        {/* Empty state */}
        {total === 0 && !state.focus && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14 }}>הדבק הודעות מוואטסאפ כדי להתחיל</div>
          </div>
        )}

        {/* Last updated */}
        {state.lastUpdated && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#334155' }}>
            עודכן {new Date(state.lastUpdated).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}
