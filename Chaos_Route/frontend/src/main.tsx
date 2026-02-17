import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App'
import { useAppStore } from './stores/useAppStore'
import i18n from './i18n'

/* Appliquer les préférences persistées au démarrage / Apply persisted preferences on startup */
const { theme, language } = useAppStore.getState()
document.documentElement.classList.toggle('light', theme === 'light')
if (language && language !== i18n.language) {
  i18n.changeLanguage(language)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
