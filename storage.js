const KEY = 'uri_field_app_v1'

export const loadState = () => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const saveState = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Save failed', e)
  }
}

export const clearState = () => {
  try { localStorage.removeItem(KEY) } catch {}
}

export const defaultState = () => ({
  tasks: { now: [], today: [], later: [] },
  sites: [],
  people: [],
  focus: '',
  summary: '',
  lastUpdated: null,
})
