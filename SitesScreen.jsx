import { useState } from 'react'

const STATUS_COLOR = { open: '#ef4444', pending: '#f59e0b', resolved: '#4ade80' }
const STATUS_LABEL = { open: 'פתוח', pending: 'ממתין', resolved: 'נפתר' }

export default function SitesScreen({ state, updateState, navigate }) {
  const [filter, setFilter] = useState('open')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', province: '', issue: '', contractor: '', status: 'open' })

  const sites = filter === 'all' ? state.sites : state.sites.filter(s => s.status === filter)

  const updateSiteStatus = (name, status) => {
    updateState({ sites: state.sites.map(s => s.name === name ? { ...s, status } : s) })
  }

  const addSite = () => {
    if (!form.name.trim()) return
    updateState({ sites: [...state.sites, { ...form, id: Date.now() }] })
    setForm({ name: '', province: '', issue: '', contractor: '', status: 'open' })
    setShowAdd(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: '48px 16px 12px', background: 'linear-gradient(180deg,#1e293b,#0f172a)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>אתרים</div>
          <button onClick={() => setShowAdd(true)} style={{
            background: '#1e40af', border: 'none', borderRadius: 10,
            padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600
          }}>+ הוסף</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['open','פתוחים'],['pending','ממתינים'],['resolved','נפתרו'],['all','הכל']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none',
              background: filter === v ? '#1e40af' : '#1e293b',
              color: filter === v ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sites.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
            <div style={{ fontSize: 14 }}>אין אתרים בקטגוריה זו</div>
          </div>
        )}
        {sites.map(site => (
          <div key={site.name} style={{ background: '#1e293b', borderRadius: 14, padding: '14px', border: `1px solid ${STATUS_COLOR[site.status]}33` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>📍 {site.name}</div>
                {site.province && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{site.province}</div>}
                {site.issue && <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>{site.issue}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {site.contractor && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#0f172a', color: '#64748b' }}>{site.contractor.toUpperCase()}</span>}
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: STATUS_COLOR[site.status] + '22', color: STATUS_COLOR[site.status], fontWeight: 600 }}>
                    {STATUS_LABEL[site.status]}
                  </span>
                </div>
              </div>
              <button onClick={() => navigate('action', { text: `${site.name}: ${site.issue}`, assignee: site.contractor })} style={{
                background: '#0f172a', border: 'none', borderRadius: 8,
                padding: '7px 9px', color: '#64748b', fontSize: 16, flexShrink: 0, marginRight: 8
              }}>✍️</button>
            </div>
            {/* Status buttons */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {['open','pending','resolved'].map(s => (
                <button key={s} onClick={() => updateSiteStatus(site.name, s)} style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none',
                  background: site.status === s ? STATUS_COLOR[s] + '33' : '#0f172a',
                  color: site.status === s ? STATUS_COLOR[s] : '#475569',
                  fontSize: 11, fontWeight: 600
                }}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: '#000d', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '18px 18px 0 0', padding: '22px 16px 40px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>+ אתר חדש</div>
            {[
              { label: 'שם אתר', key: 'name', placeholder: 'Nambaran Deep Well' },
              { label: 'מחוז', key: 'province', placeholder: 'Nueva Vizcaya' },
              { label: 'בעיה', key: 'issue', placeholder: 'Lock Rotor A08' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{f.label}</div>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} style={{
                    width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
                    padding: '10px 12px', color: '#f1f5f9', fontSize: 14, outline: 'none', direction: 'rtl'
                  }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>קבלן</div>
                <select value={form.contractor} onChange={e => setForm(p => ({ ...p, contractor: e.target.value }))} style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                  padding: '10px 8px', color: '#f1f5f9', fontSize: 13, outline: 'none'
                }}>
                  <option value="">—</option>
                  <option value="asc">ASC</option>
                  <option value="11-16">11-16</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>סטטוס</div>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                  padding: '10px 8px', color: '#f1f5f9', fontSize: 13, outline: 'none'
                }}>
                  <option value="open">פתוח</option>
                  <option value="pending">ממתין</option>
                  <option value="resolved">נפתר</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addSite} disabled={!form.name.trim()} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: form.name.trim() ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : '#334155',
                color: form.name.trim() ? '#fff' : '#64748b', fontSize: 15, fontWeight: 700
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
