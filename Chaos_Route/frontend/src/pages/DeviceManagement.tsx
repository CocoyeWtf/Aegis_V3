/* Page gestion appareils mobiles / Mobile device management page */

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../services/api'
import type { MobileDevice, BaseLogistics } from '../types'

/** URL du backend accessible depuis le reseau / Backend URL reachable from network */
function getServerBaseUrl(): string {
  return `${window.location.protocol}//${window.location.host}`
}

export default function DeviceManagement() {
  const [devices, setDevices] = useState<MobileDevice[]>([])
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ friendly_name: '', base_id: '' as string })
  const [qrDevice, setQrDevice] = useState<MobileDevice | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ friendly_name: '', base_id: '' as string })
  const [serverUrl, setServerUrl] = useState(() => getServerBaseUrl())

  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data)).catch(() => {})
  }, [])

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<MobileDevice[]>('/devices/')
      setDevices(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  const handleCreate = async () => {
    try {
      const { data } = await api.post<MobileDevice>('/devices/', {
        friendly_name: form.friendly_name || null,
        base_id: form.base_id ? Number(form.base_id) : null,
      })
      setForm({ friendly_name: '', base_id: '' })
      setShowCreate(false)
      setQrDevice(data)
      loadDevices()
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg = typeof raw === 'string' ? raw : raw ? JSON.stringify(raw) : 'Erreur lors de la creation'
      alert(msg)
    }
  }

  const handleUpdate = async (id: number) => {
    try {
      await api.put(`/devices/${id}`, {
        friendly_name: editForm.friendly_name || null,
        base_id: editForm.base_id ? Number(editForm.base_id) : null,
      })
      setEditingId(null)
      loadDevices()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur lors de la modification'
      alert(msg)
    }
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/devices/${id}`)
    loadDevices()
  }

  const startEdit = (d: MobileDevice) => {
    setEditingId(d.id)
    setEditForm({
      friendly_name: d.friendly_name || '',
      base_id: d.base_id ? String(d.base_id) : '',
    })
  }

  const baseName = (id: number | null | undefined) => {
    if (!id) return '—'
    const b = bases.find((x) => x.id === id)
    return b ? `${b.code} — ${b.name}` : `#${id}`
  }

  const isRegistered = (d: MobileDevice) => !!d.device_identifier

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Gestion des appareils
        </h1>
        <button
          onClick={() => { setShowCreate(true); setForm({ friendly_name: '', base_id: '' }) }}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          + Ajouter un appareil
        </button>
      </div>

      {/* Formulaire creation / Create form */}
      {showCreate && (
        <div className="mb-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Nouvel appareil</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Nom de l'appareil</label>
              <input type="text" value={form.friendly_name} onChange={(e) => setForm({ ...form, friendly_name: e.target.value })}
                placeholder="Ex: Phone-01"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Base</label>
              <select value={form.base_id} onChange={(e) => setForm({ ...form, base_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="">—</option>
                {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleCreate}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>Creer</button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale QR Code / QR Code modal */}
      {qrDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 max-w-md w-full mx-4 text-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {qrDevice.friendly_name || 'Nouvel appareil'}
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Scannez ce QR code avec le telephone pour installer l'app et enregistrer l'appareil
            </p>

            {/* URL serveur editable / Editable server URL */}
            <div className="mb-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>URL serveur (accessible depuis le telephone)</label>
              <input
                type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-xs text-center font-mono"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              />
            </div>

            {/* QR Code — contient l'URL de setup / Contains setup URL */}
            <div className="flex justify-center mb-3">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={`${serverUrl}/app/setup/${qrDevice.registration_code}`}
                  size={200}
                  level="M"
                />
              </div>
            </div>

            <div className="text-xs font-mono mb-3 break-all" style={{ color: 'var(--text-muted)' }}>
              {serverUrl}/app/setup/{qrDevice.registration_code}
            </div>

            {/* Code lisible / Readable code */}
            <div className="mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Code d'enregistrement</span>
              <div className="font-mono text-2xl font-bold tracking-widest mt-1" style={{ color: 'var(--color-primary)' }}>
                {qrDevice.registration_code}
              </div>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              1. Scanner ce QR avec la camera du telephone<br />
              2. Telecharger et installer l'app CMRO Driver<br />
              3. Ouvrir l'app et saisir le code ci-dessus<br />
              4. L'appareil est enregistre
            </p>

            <button
              onClick={() => setQrDevice(null)}
              className="px-6 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Tableau / Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Chargement...</p>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Nom</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Identifiant</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Base</th>
                <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>Actif</th>
                <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                  {editingId === d.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input type="text" value={editForm.friendly_name} onChange={(e) => setEditForm({ ...editForm, friendly_name: e.target.value })}
                          className="w-full px-2 py-1 rounded border text-xs"
                          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                      </td>
                      <td className="px-3 py-2">
                        {isRegistered(d)
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#22c55e22', color: '#22c55e' }}>Enregistre</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b22', color: '#f59e0b' }}>En attente</span>
                        }
                      </td>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{d.device_identifier || '—'}</td>
                      <td className="px-3 py-2">
                        <select value={editForm.base_id} onChange={(e) => setEditForm({ ...editForm, base_id: e.target.value })}
                          className="w-full px-2 py-1 rounded border text-xs"
                          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                          <option value="">—</option>
                          {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">{d.is_active ? '✓' : '✗'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleUpdate(d.id)} className="text-xs font-semibold mr-2" style={{ color: 'var(--color-primary)' }}>OK</button>
                        <button onClick={() => setEditingId(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{d.friendly_name || '—'}</td>
                      <td className="px-3 py-2">
                        {isRegistered(d)
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#22c55e22', color: '#22c55e' }}>Enregistre</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b22', color: '#f59e0b' }}>En attente</span>
                        }
                      </td>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{d.device_identifier || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{baseName(d.base_id)}</td>
                      <td className="px-3 py-2 text-center" style={{ color: d.is_active ? '#22c55e' : 'var(--color-danger)' }}>
                        {d.is_active ? '✓' : '✗'}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {/* Bouton QR pour afficher le code / QR button to show code */}
                        <button onClick={() => setQrDevice(d)} className="text-xs font-semibold mr-2" style={{ color: 'var(--color-primary)' }}
                          title="Afficher le QR code">
                          QR
                        </button>
                        <button onClick={() => startEdit(d)} className="text-xs font-semibold mr-2" style={{ color: 'var(--text-secondary)' }}>Modifier</button>
                        {d.is_active && (
                          <button onClick={() => handleDelete(d.id)} className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>Desactiver</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    Aucun appareil enregistre — cliquez sur "Ajouter" pour creer un appareil
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
