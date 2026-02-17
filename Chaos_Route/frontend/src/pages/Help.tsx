/* Page d'aide utilisateur / User help page */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

/* Mockup visuel réutilisable / Reusable visual mockup component */
function MockScreen({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      className="rounded-lg border overflow-hidden my-4 text-xs"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
    >
      {title && (
        <div
          className="px-3 py-1.5 border-b font-mono text-[10px]"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
        >
          {title}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  )
}

/* Barre mockup pour simuler un tableau / Mock bar for simulating a table row */
function MockRow({ cols, header }: { cols: string[]; header?: boolean }) {
  return (
    <div
      className={`flex gap-2 px-2 py-1.5 border-b ${header ? 'font-semibold' : ''}`}
      style={{
        borderColor: 'var(--border-color)',
        backgroundColor: header ? 'var(--bg-tertiary)' : 'transparent',
        color: header ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: '10px',
      }}
    >
      {cols.map((c, i) => (
        <span key={i} className="flex-1 truncate">{c}</span>
      ))}
    </div>
  )
}

/* Bouton mockup / Mock button */
function MockBtn({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <span
      className="inline-block px-2 py-1 rounded text-[10px] font-medium"
      style={{
        backgroundColor: primary ? 'var(--color-primary)' : 'var(--bg-tertiary)',
        color: primary ? '#fff' : 'var(--text-secondary)',
      }}
    >
      {label}
    </span>
  )
}

/* Badge mockup / Mock badge */
function MockBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium"
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
  )
}

/* Section de la table des matières / Table of contents section */
interface TocItem {
  id: string
  label: string
  icon: string
}

export default function Help() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const toc: TocItem[] = [
    { id: 'overview', label: t('help.sections.overview'), icon: '🏠' },
    { id: 'login', label: t('help.sections.login'), icon: '🔐' },
    { id: 'navigation', label: t('help.sections.navigation'), icon: '🧭' },
    { id: 'scope', label: t('help.sections.scope'), icon: '📍' },
    { id: 'datatable', label: t('help.sections.datatable'), icon: '📊' },
    { id: 'countries', label: t('help.sections.countries'), icon: '🌍' },
    { id: 'bases', label: t('help.sections.bases'), icon: '🏭' },
    { id: 'pdvs', label: t('help.sections.pdvs'), icon: '🏪' },
    { id: 'vehicles', label: t('help.sections.vehicles'), icon: '🚛' },
    { id: 'volumes', label: t('help.sections.volumes'), icon: '📋' },
    { id: 'contracts', label: t('help.sections.contracts'), icon: '📝' },
    { id: 'tour-planning', label: t('help.sections.tourPlanning'), icon: '🗺️' },
    { id: 'tour-history', label: t('help.sections.tourHistory'), icon: '📜' },
    { id: 'admin', label: t('help.sections.admin'), icon: '🛡️' },
    { id: 'shortcuts', label: t('help.sections.shortcuts'), icon: '⌨️' },
  ]

  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sectionStyle = {
    color: 'var(--text-primary)',
  }

  const subStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    lineHeight: '1.6',
  }

  const tipStyle = {
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderLeft: '3px solid var(--color-primary)',
    color: 'var(--text-secondary)',
  }

  const warningStyle = {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderLeft: '3px solid var(--color-danger)',
    color: 'var(--text-secondary)',
  }

  return (
    <div className="flex h-full">
      {/* Table des matières fixe / Fixed table of contents */}
      <aside
        className="w-56 shrink-0 border-r overflow-y-auto p-3 sticky top-0 h-[calc(100vh-3.5rem)]"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
          >
            ← {t('common.back')}
          </button>
        </div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('help.title')}
        </h2>
        <nav className="space-y-0.5">
          {toc.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                backgroundColor: activeSection === item.id ? 'var(--bg-tertiary)' : 'transparent',
                color: activeSection === item.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontWeight: activeSection === item.id ? 600 : 400,
              }}
            >
              <span>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenu principal / Main content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-primary)' }}>
          {t('help.mainTitle')}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          {t('help.version')}
        </p>

        {/* ======= VUE D'ENSEMBLE / OVERVIEW ======= */}
        <section id="help-overview" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🏠 {t('help.sections.overview')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.overview.intro')}</p>
            <p className="mb-3">{t('help.overview.purpose')}</p>
          </div>
          <MockScreen title="Chaos RouteManager — Dashboard">
            <div className="flex gap-3 mb-3">
              {['📊 12', '🏪 384', '🚛 28', '📏 1,240 km'].map((kpi, i) => (
                <div key={i} className="flex-1 rounded-lg border p-2 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{kpi.split(' ')[1]}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{kpi.split(' ')[0]}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              ▓▓▓▓▓▓▓░░░ {t('help.overview.mockChart')}
            </div>
          </MockScreen>
        </section>

        {/* ======= CONNEXION / LOGIN ======= */}
        <section id="help-login" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🔐 {t('help.sections.login')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.login.intro')}</p>
          </div>
          <MockScreen title="Login">
            <div className="max-w-[180px] mx-auto space-y-2">
              <div className="text-center text-lg">🔥</div>
              <div className="text-center text-[10px] font-bold" style={{ color: 'var(--color-primary)' }}>Chaos Route</div>
              <div className="rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                admin
              </div>
              <div className="rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                ••••••
              </div>
              <div className="text-center"><MockBtn label={t('auth.loginButton')} primary /></div>
            </div>
          </MockScreen>
          <div style={subStyle}>
            <p className="mb-2">{t('help.login.steps')}</p>
            <ol className="list-decimal ml-5 space-y-1">
              <li>{t('help.login.step1')}</li>
              <li>{t('help.login.step2')}</li>
              <li>{t('help.login.step3')}</li>
            </ol>
          </div>
          <div className="mt-3 p-3 rounded-lg text-xs" style={tipStyle}>
            💡 {t('help.login.tip')}
          </div>
        </section>

        {/* ======= NAVIGATION ======= */}
        <section id="help-navigation" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🧭 {t('help.sections.navigation')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.navigation.intro')}</p>
          </div>
          <MockScreen title={t('help.navigation.mockTitle')}>
            <div className="flex gap-3">
              <div className="w-28 border-r pr-3 space-y-1" style={{ borderColor: 'var(--border-color)' }}>
                {['📊 Dashboard', '🌍 Pays', '🏭 Bases', '🏪 PDVs', '📝 Contrats', '🗺️ Planning'].map((item, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded text-[10px] truncate"
                    style={{
                      backgroundColor: i === 0 ? 'var(--bg-tertiary)' : 'transparent',
                      color: i === 0 ? 'var(--color-primary)' : 'var(--text-secondary)',
                      fontWeight: i === 0 ? 600 : 400,
                    }}
                  >
                    {item}
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t text-[8px] font-semibold uppercase" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  Admin
                </div>
                {['👥 Users', '🛡️ Roles'].map((item, i) => (
                  <div key={i} className="px-2 py-1 rounded text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                ← {t('help.navigation.sidebarLabel')}
              </div>
            </div>
          </MockScreen>
          <div style={subStyle}>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.navigation.collapse')}</li>
              <li>{t('help.navigation.permissions')}</li>
              <li>{t('help.navigation.theme')}</li>
              <li>{t('help.navigation.language')}</li>
            </ul>
          </div>
        </section>

        {/* ======= PERIMETRE / SCOPE ======= */}
        <section id="help-scope" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            📍 {t('help.sections.scope')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.scope.intro')}</p>
          </div>
          <MockScreen title={t('help.scope.mockTitle')}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Chaos RouteManager</span>
              <span className="rounded border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', backgroundColor: 'rgba(249,115,22,0.1)' }}>
                📍 Wallonie
              </span>
              <span className="flex-1" />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>FR EN PT NL</span>
              <span className="text-[10px]">☀️</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>admin</span>
            </div>
          </MockScreen>
          <div style={subStyle}>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.scope.selectCountry')}</li>
              <li>{t('help.scope.selectRegion')}</li>
              <li>{t('help.scope.mapZoom')}</li>
              <li>{t('help.scope.reset')}</li>
            </ul>
          </div>
        </section>

        {/* ======= DATATABLES ======= */}
        <section id="help-datatable" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            📊 {t('help.sections.datatable')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.datatable.intro')}</p>
          </div>
          <MockScreen title={t('help.datatable.mockTitle')}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{t('help.datatable.mockTableTitle')}</span>
                <span className="rounded border px-2 py-0.5 text-[9px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  🔍 {t('common.search')}...
                </span>
              </div>
              <div className="flex gap-1">
                <MockBtn label={`📥 ${t('common.import')}`} />
                <MockBtn label={`📤 ${t('common.export')}`} />
                <MockBtn label={`+ ${t('common.createNew')}`} primary />
              </div>
            </div>
            <MockRow cols={['Code', t('common.name'), t('common.city'), t('common.region'), t('common.actions')]} header />
            <MockRow cols={['PDV001', 'Carrefour Mons', 'Mons', 'Wallonie', '✏️ 🗑️']} />
            <MockRow cols={['PDV002', 'Colruyt Namur', 'Namur', 'Wallonie', '✏️ 🗑️']} />
            <MockRow cols={['PDV003', 'Delhaize Liège', 'Liège', 'Wallonie', '✏️ 🗑️']} />
          </MockScreen>
          <div style={subStyle}>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.datatable.search')}</li>
              <li>{t('help.datatable.sort')}</li>
              <li>{t('help.datatable.columns')}</li>
              <li>{t('help.datatable.create')}</li>
              <li>{t('help.datatable.edit')}</li>
              <li>{t('help.datatable.delete')}</li>
              <li>{t('help.datatable.import')}</li>
              <li>{t('help.datatable.export')}</li>
            </ul>
          </div>
          <div className="mt-3 p-3 rounded-lg text-xs" style={warningStyle}>
            ⚠️ {t('help.datatable.deleteWarning')}
          </div>
        </section>

        {/* ======= PAYS & REGIONS / COUNTRIES ======= */}
        <section id="help-countries" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🌍 {t('help.sections.countries')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.countries.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.countries.tabs')}</li>
              <li>{t('help.countries.filterByCountry')}</li>
              <li>{t('help.countries.regionLink')}</li>
            </ul>
          </div>
        </section>

        {/* ======= BASES LOGISTIQUES ======= */}
        <section id="help-bases" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🏭 {t('help.sections.bases')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.bases.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.bases.fields')}</li>
              <li>{t('help.bases.activities')}</li>
              <li>{t('help.bases.speeds')}</li>
              <li>{t('help.bases.map')}</li>
            </ul>
          </div>
          <MockScreen title={t('help.bases.mockTitle')}>
            <div className="grid grid-cols-5 gap-1 text-[9px] text-center">
              {['', 'SEC Rap.', 'FRAIS Rap.', 'GEL Rap.', 'MIXTE Rap.'].map((h, i) => (
                <div key={i} className="font-bold py-1" style={{ color: 'var(--text-primary)' }}>{h}</div>
              ))}
              {['Base Mons', '25', '18', '12', '30'].map((v, i) => (
                <div key={i} className="py-1" style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--color-primary)' }}>{v}</div>
              ))}
            </div>
          </MockScreen>
        </section>

        {/* ======= PDVs ======= */}
        <section id="help-pdvs" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🏪 {t('help.sections.pdvs')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.pdvs.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.pdvs.types')}</li>
              <li>{t('help.pdvs.delivery')}</li>
              <li>{t('help.pdvs.constraints')}</li>
              <li>{t('help.pdvs.map')}</li>
            </ul>
          </div>
          <MockScreen title={t('help.pdvs.mockTitle')}>
            <div className="flex gap-3">
              {[
                { label: t('map.pdvNoVolume'), color: '#6b7280' },
                { label: t('map.pdvUnassigned'), color: '#f59e0b' },
                { label: t('map.pdvAssigned'), color: '#22c55e' },
                { label: t('map.pdvSelected'), color: '#3b82f6' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </MockScreen>
        </section>

        {/* ======= VEHICULES / VEHICLES ======= */}
        <section id="help-vehicles" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🚛 {t('help.sections.vehicles')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.vehicles.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.vehicles.tempTypes')}</li>
              <li>{t('help.vehicles.types')}</li>
              <li>{t('help.vehicles.capacity')}</li>
              <li>{t('help.vehicles.tailgate')}</li>
            </ul>
          </div>
        </section>

        {/* ======= VOLUMES ======= */}
        <section id="help-volumes" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            📋 {t('help.sections.volumes')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.volumes.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.volumes.fields')}</li>
              <li>{t('help.volumes.link')}</li>
              <li>{t('help.volumes.import')}</li>
            </ul>
          </div>
        </section>

        {/* ======= CONTRATS / CONTRACTS ======= */}
        <section id="help-contracts" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            📝 {t('help.sections.contracts')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.contracts.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.contracts.costs')}</li>
              <li>{t('help.contracts.schedule')}</li>
              <li>{t('help.contracts.unavailable')}</li>
            </ul>
          </div>
          <MockScreen title={t('help.contracts.mockTitle')}>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
                <div key={d} className="font-bold py-1">{d}</div>
              ))}
              {['✅', '✅', '✅', '✅', '✅', '❌', '❌'].map((s, i) => (
                <div key={i} className="py-1">{s}</div>
              ))}
            </div>
          </MockScreen>
        </section>

        {/* ======= PLANIFICATION / TOUR PLANNING ======= */}
        <section id="help-tour-planning" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🗺️ {t('help.sections.tourPlanning')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.tourPlanning.intro')}</p>
          </div>
          <MockScreen title={t('help.tourPlanning.mockTitle')}>
            <div className="flex gap-3">
              {/* Panel gauche / Left panel */}
              <div className="w-1/3 border-r pr-2 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{t('tourPlanning.availableVolumes')}</div>
                {['PDV001 — 12 EQP', 'PDV002 — 8 EQP', 'PDV003 — 15 EQP'].map((v, i) => (
                  <div key={i} className="rounded border px-1.5 py-1 text-[9px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    {v}
                  </div>
                ))}
              </div>
              {/* Carte / Map */}
              <div className="flex-1">
                <div className="rounded-lg border h-24 flex items-center justify-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>🗺️ {t('help.tourPlanning.mapArea')}</span>
                </div>
              </div>
              {/* Panel droit / Right panel */}
              <div className="w-1/3 border-l pl-2 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{t('tourPlanning.currentTour')}</div>
                <div className="text-[9px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <div>🚛 Semi — GEL — 33 EQP</div>
                  <div className="rounded px-1.5 py-0.5" style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}>
                    {t('tourPlanning.fillRate')}: <span style={{ color: 'var(--color-primary)' }}>72%</span>
                  </div>
                  <div>1. 🏭 Base Mons → PDV001</div>
                  <div>2. PDV001 → PDV003</div>
                  <div>3. PDV003 → 🏭 Base Mons</div>
                </div>
              </div>
            </div>
          </MockScreen>
          <div style={subStyle}>
            <p className="mb-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{t('help.tourPlanning.stepsTitle')}</p>
            <ol className="list-decimal ml-5 space-y-1.5">
              <li>{t('help.tourPlanning.step1')}</li>
              <li>{t('help.tourPlanning.step2')}</li>
              <li>{t('help.tourPlanning.step3')}</li>
              <li>{t('help.tourPlanning.step4')}</li>
              <li>{t('help.tourPlanning.step5')}</li>
              <li>{t('help.tourPlanning.step6')}</li>
            </ol>
          </div>
          <div className="mt-3 p-3 rounded-lg text-xs" style={tipStyle}>
            💡 {t('help.tourPlanning.tip')}
          </div>
          <div className="mt-2 p-3 rounded-lg text-xs" style={tipStyle}>
            💡 {t('help.tourPlanning.tipScheduling')}
          </div>
        </section>

        {/* ======= HISTORIQUE / TOUR HISTORY ======= */}
        <section id="help-tour-history" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            📜 {t('help.sections.tourHistory')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.tourHistory.intro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.tourHistory.statuses')}</li>
              <li>{t('help.tourHistory.kpi')}</li>
              <li>{t('help.tourHistory.delete')}</li>
            </ul>
          </div>
          <MockScreen title={t('help.tourHistory.mockTitle')}>
            <div className="flex gap-2 mb-2">
              <MockBadge label="DRAFT" color="#6b7280" />
              <MockBadge label="VALIDATED" color="#f59e0b" />
              <MockBadge label="IN_PROGRESS" color="#3b82f6" />
              <MockBadge label="COMPLETED" color="#22c55e" />
            </div>
          </MockScreen>
        </section>

        {/* ======= ADMINISTRATION ======= */}
        <section id="help-admin" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            🛡️ {t('help.sections.admin')}
          </h2>
          <div style={subStyle}>
            <p className="mb-3">{t('help.admin.intro')}</p>

            <h3 className="font-semibold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>
              👥 {t('help.admin.usersTitle')}
            </h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.admin.usersCreate')}</li>
              <li>{t('help.admin.usersRoles')}</li>
              <li>{t('help.admin.usersRegions')}</li>
              <li>{t('help.admin.usersSuperadmin')}</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>
              🛡️ {t('help.admin.rolesTitle')}
            </h3>
            <p className="mb-2">{t('help.admin.rolesIntro')}</p>
          </div>
          <MockScreen title={t('help.admin.mockTitle')}>
            <div className="grid grid-cols-5 gap-0.5 text-[9px] text-center">
              <div className="font-bold py-1" style={{ color: 'var(--text-primary)' }}>{t('help.admin.resource')}</div>
              {[t('admin.roles.action_read'), t('admin.roles.action_create'), t('admin.roles.action_update'), t('admin.roles.action_delete')].map((a) => (
                <div key={a} className="font-bold py-1" style={{ color: 'var(--text-primary)' }}>{a}</div>
              ))}
              {['Dashboard', 'PDVs', 'Volumes', 'Tours'].map((r) => (
                [r, '☑️', '☑️', '☑️', '☐'].map((v, i) => (
                  <div key={`${r}-${i}`} className="py-1" style={{ color: i === 0 ? 'var(--text-secondary)' : 'var(--color-primary)' }}>
                    {v}
                  </div>
                ))
              ))}
            </div>
          </MockScreen>
          <div style={subStyle}>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('help.admin.rolesMatrix')}</li>
              <li>{t('help.admin.rolesToggle')}</li>
            </ul>
          </div>
          <div className="mt-3 p-3 rounded-lg text-xs" style={warningStyle}>
            ⚠️ {t('help.admin.warning')}
          </div>
        </section>

        {/* ======= RACCOURCIS / SHORTCUTS ======= */}
        <section id="help-shortcuts" className="mb-10">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={sectionStyle}>
            ⌨️ {t('help.sections.shortcuts')}
          </h2>
          <div style={subStyle}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: '« / »', desc: t('help.shortcuts.sidebar') },
                { key: '☀️ / 🌙', desc: t('help.shortcuts.theme') },
                { key: 'FR EN PT NL', desc: t('help.shortcuts.language') },
                { key: 'F11', desc: t('help.shortcuts.fullscreen') },
                { key: '📍', desc: t('help.shortcuts.scope') },
                { key: '?', desc: t('help.shortcuts.help') },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--color-primary)' }}>
                    {s.key}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t pt-6 pb-10 text-center" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Chaos RouteManager — {t('help.footer')}
          </p>
        </div>
      </main>
    </div>
  )
}
