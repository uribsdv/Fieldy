export default function NavBar({ screen, navigate, state }) {
  const urgent = state.tasks.now.filter(t => !t.done).length
  const sites = state.sites.filter(s => s.status === 'open' || s.status === 'pending').length
  const pending = state.people.filter(p => p.pending).length

  const tabs = [
    { key: 'home', icon: '☀️', label: 'בית' },
    { key: 'tasks', icon: '⚡', label: 'משימות', badge: urgent },
    { key: 'sites', icon: '📍', label: 'אתרים', badge: sites },
    { key: 'people', icon: '👥', label: 'אנשים', badge: pending },
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, right: 0, left: 0,
      background: '#0f172a', borderTop: '1px solid #1e293b',
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
      padding: '8px 0 20px', maxWidth: 430, margin: '0 auto',
      zIndex: 50
    }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => navigate(t.key)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '4px 0', position: 'relative'
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            {t.badge > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                background: '#ef4444', color: '#fff', borderRadius: 99,
                fontSize: 10, fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center'
              }}>{t.badge}</span>
            )}
          </div>
          <span style={{ fontSize: 10, color: screen === t.key ? '#3b82f6' : '#475569', fontWeight: screen === t.key ? 700 : 400 }}>
            {t.label}
          </span>
          {screen === t.key && (
            <div style={{ position: 'absolute', bottom: -8, width: 24, height: 2, background: '#3b82f6', borderRadius: 99 }} />
          )}
        </button>
      ))}
    </nav>
  )
}
