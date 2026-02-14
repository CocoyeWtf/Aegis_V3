/* En-tête de l'application / Application header */

import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/useAppStore'

const languages = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'nl', label: 'NL' },
]

export function Header() {
  const { t, i18n } = useTranslation()
  const { theme, toggleTheme, toggleSidebar } = useAppStore()

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          ☰
        </button>
        <h1 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t('app.title')}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Sélecteur de langue / Language selector */}
        <div className="flex gap-1">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: i18n.language === lang.code ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                color: i18n.language === lang.code ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Toggle dark/light / Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
