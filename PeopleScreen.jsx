import { useState } from 'react'

const ROLE_LABEL = { engineer: 'מהנדס', contractor: 'קבלן', nia: 'NIA', other: 'אחר' }
const ROLE_COLOR = { engineer: '#3b82f6', contractor: '#f59e0b', nia: '#06b6d4', other: '#64748b' }

export default function PeopleScreen({ state, updateState, navigate }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'contractor', pending: '', company: '' })

  const clearPending = (name) => {
    updateState({ people: state.people.map(p => p.name === name ? { ...p, pending: '' } : p) })
  }

  const addPerson = () => {
    if (!form.name.trim()) return
    updateState({ people: [...state.people, { ...form, id: Date.now() }] })
    setForm({ name: '', role: 'contractor', pending: '', company: '' })
    setShowAdd(false)
  }

  const withPending = state.people.filter(p => p.pending)
  const withoutPending = state.people.filter(p => !p.pending)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 90 }}>
      <div style={{ padding: '48px 16px 12px', background: 'linear-gradient(180deg,#1e293b,#0f172a)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>אנשים</div>
          <button onClick={() => setShowAdd(true)} style={{
            background: '#1e40af', border: 'none', borderRadius: 10,
            padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600
          }}>+ הוסף</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.people.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
            <div style={{ fontSize: 14 }}>אנשים יתווספו אוטומטית מהודעות</div>
          </div>
        )}

        {withPending.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 2 }}>⏳ ממתין תשובה</div>
            {withPending.map(person => <PersonCard key={person.name} person={person} clearPending={clearPending} navigate={navigate} />)}
          </>
        )}

        {withoutPending.length > 0 && (
          <>
            {withPending.length > 0 && <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 0.5, marginTop: 8, marginBottom: 2 }}>אנשי קשר</div>}
            {withoutPending.map(person => <PersonCard key={person.name} person={person} clearPending={clearPending} navigate={navigate} />)}
          </>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: '#000d', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '18px 18px 0 0', padding: '22px 16px 40px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>+ איש קשר</div>
            {[
              { label: 'שם', key: 'name', placeholder: 'Dave' },
              { label: 'חברה/תפקיד', key: 'company', placeholder: 'ASC Construction' },
              { label: 'ממתין ל...', key: 'pending', placeholder: 'חתימה על waiver — Upi 3' },
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
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>תפקיד</div>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{
                width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                padding: '10px 8px', color: '#f1f5f9', fontSize: 13, outline: 'none'
              }}>
                <option value="engineer">מהנדס</option>
                <option value="contractor">קבלן</option>
                <option value="nia">NIA</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addPerson} disabled={!form.name.trim()} style={{
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

function PersonCard({ person, clearPending, navigate }) {
  const roleColor = ROLE_COLOR[person.role] || '#64748b'
  return (
    <div style={{ background: '#1e293b', borderRadius: 14, padding: '14px', border: `1px solid ${person.pending ? '#f59e0b33' : 'transparent'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: roleColor + '22', border: `1.5px solid ${roleColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: roleColor, fontWeight: 700, flexShrink: 0 }}>
              {person.name[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{person.name}</div>
              {person.company && <div style={{ fontSize: 12, color: '#64748b' }}>{person.company}</div>}
            </div>
          </div>
          {person.pending && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: '#f59e0b11', borderRadius: 8, border: '1px solid #f59e0b22' }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>⏳ ממתין</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{person.pending}</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
          <button onClick={() => navigate('action', { text: person.pending || person.name, assignee: person.name })} style={{
            background: '#0f172a', border: 'none', borderRadius: 8, padding: '7px 9px', color: '#64748b', fontSize: 16
          }}>✍️</button>
          {person.pending && (
            <button onClick={() => clearPending(person.name)} style={{
              background: '#4ade8022', border: '1px solid #4ade8044', borderRadius: 8,
              padding: '7px 9px', color: '#4ade80', fontSize: 14, fontWeight: 700
            }}>✓</button>
          )}
        </div>
      </div>
    </div>
  )
}
