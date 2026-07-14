import { useState, useEffect } from 'react'
import { loadState, saveState, defaultState } from './storage'
import HomeScreen from './components/HomeScreen'
import InputScreen from './components/InputScreen'
import TasksScreen from './components/TasksScreen'
import SitesScreen from './components/SitesScreen'
import PeopleScreen from './components/PeopleScreen'
import ActionScreen from './components/ActionScreen'
import SettingsScreen from './components/SettingsScreen'
import NavBar from './components/NavBar'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [prev, setPrev] = useState(null)
  const [state, setState] = useState(() => loadState() || defaultState())
  const [actionCtx, setActionCtx] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('uri_api_key') || '')

  useEffect(() => { saveState(state) }, [state])

  const navigate = (to, context = null) => {
    setPrev(screen)
    if (context) setActionCtx(context)
    setScreen(to)
  }

  const goBack = () => setScreen(prev || 'home')

  const updateState = (patch) => setState(s => ({ ...s, ...patch, lastUpdated: new Date().toISOString() }))

  const saveApiKey = (key) => {
    setApiKey(key)
    localStorage.setItem('uri_api_key', key)
  }

  const noApiKey = !apiKey

  const mainScreens = ['home', 'tasks', 'sites', 'people']
  const showNav = mainScreens.includes(screen)

  return (
    <div className="screen">
      {screen === 'home' && <HomeScreen state={state} navigate={navigate} updateState={updateState} noApiKey={noApiKey} />}
      {screen === 'input' && <InputScreen state={state} updateState={updateState} goBack={goBack} apiKey={apiKey} />}
      {screen === 'tasks' && <TasksScreen state={state} updateState={updateState} navigate={navigate} />}
      {screen === 'sites' && <SitesScreen state={state} updateState={updateState} navigate={navigate} />}
      {screen === 'people' && <PeopleScreen state={state} updateState={updateState} navigate={navigate} />}
      {screen === 'action' && <ActionScreen ctx={actionCtx} goBack={goBack} apiKey={apiKey} />}
      {screen === 'settings' && <SettingsScreen apiKey={apiKey} saveApiKey={saveApiKey} goBack={goBack} updateState={updateState} />}
      {showNav && <NavBar screen={screen} navigate={navigate} state={state} />}
    </div>
  )
}
