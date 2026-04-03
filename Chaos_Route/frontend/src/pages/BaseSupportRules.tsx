/* Page matrice regles support par base / Base-support rules matrix page */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface BaseInfo { id: number; code: string; name: string }
interface SupportInfo { id: number; code: string; name: string }
interface RuleEntry { base_id: number; support_type_id: number; allowed: boolean }

export default function BaseSupportRules() {
  const [bases, setBases] = useState<BaseInfo[]>([])
  const [supportTypes, setSupportTypes] = useState<SupportInfo[]>([])
  const [rules, setRules] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const ruleKey = (baseId: number, stId: number) => `${baseId}-${stId}`

  const loadMatrix = useCallback(async () => {
    try {
      const { data } = await api.get('/base-support-rules/matrix')
      setBases(data.bases)
      setSupportTypes(data.support_types)
      const map = new Map<string, boolean>()
      for (const r of data.rules_list as RuleEntry[]) {
        map.set(ruleKey(r.base_id, r.support_type_id), r.allowed)
      }
      setRules(map)
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMatrix() }, [loadMatrix])

  const handleToggle = useCallback(async (baseId: number, stId: number) => {
    const key = ruleKey(baseId, stId)
    setToggling(key)
    // Etat actuel : si pas de regle = autorise (true), sinon valeur stockee
    const current = rules.get(key) ?? true
    const newValue = !current
    try {
      await api.put('/base-support-rules/toggle', null, {
        params: { base_id: baseId, support_type_id: stId, allowed: newValue },
      })
      setRules((prev) => {
        const next = new Map(prev)
        next.set(key, newValue)
        return next
      })
    } catch {
      /* revert silently */
    } finally {
      setToggling(null)
    }
  }, [rules])

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Regles support par base
      </h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Definir quels types de support peuvent etre repris par chaque base.
        Cellule vide = autorise par defaut. Cliquez pour bloquer ou autoriser.
      </p>

      <div className="rounded-xl border overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <table className="text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="px-3 py-2 text-left font-medium sticky left-0 z-10"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', minWidth: '200px' }}>
                Support
              </th>
              {bases.map((b) => (
                <th key={b.id} className="px-2 py-2 text-center font-medium whitespace-nowrap"
                  style={{ color: 'var(--text-muted)', minWidth: '80px' }}>
                  {b.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supportTypes.map((st) => (
              <tr key={st.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                <td className="px-3 py-1.5 font-medium sticky left-0 z-10"
                  style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="font-mono text-[10px] mr-1" style={{ color: 'var(--text-muted)' }}>{st.code}</span>
                  {st.name}
                </td>
                {bases.map((b) => {
                  const key = ruleKey(b.id, st.id)
                  const value = rules.get(key)  // undefined = pas de regle = autorise
                  const isAllowed = value === undefined || value === true
                  const hasRule = value !== undefined
                  const isToggling = toggling === key

                  return (
                    <td key={b.id} className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleToggle(b.id, st.id)}
                        disabled={isToggling}
                        className="w-8 h-8 rounded-lg text-sm font-bold transition-all"
                        style={{
                          backgroundColor: isAllowed
                            ? hasRule ? 'rgba(34,197,94,0.2)' : 'transparent'
                            : 'rgba(239,68,68,0.2)',
                          color: isAllowed
                            ? hasRule ? '#22c55e' : 'var(--text-muted)'
                            : '#ef4444',
                          border: `1px solid ${isAllowed
                            ? hasRule ? '#22c55e44' : 'var(--border-color)'
                            : '#ef444444'}`,
                          opacity: isToggling ? 0.5 : 1,
                        }}
                        title={isAllowed ? (hasRule ? 'Autorise (explicite)' : 'Autorise (defaut)') : 'Bloque'}
                      >
                        {isAllowed ? (hasRule ? '✓' : '·') : '✗'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span><span className="font-bold" style={{ color: 'var(--text-muted)' }}>·</span> = Autorise (defaut)</span>
        <span><span className="font-bold" style={{ color: '#22c55e' }}>✓</span> = Autorise (explicite)</span>
        <span><span className="font-bold" style={{ color: '#ef4444' }}>✗</span> = Bloque</span>
      </div>
    </div>
  )
}
