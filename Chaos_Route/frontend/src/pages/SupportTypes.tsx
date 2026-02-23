/* Page Types de support / Support type management page */

import { useRef, useCallback, useState } from 'react'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { SupportType } from '../types'
import api from '../services/api'

export default function SupportTypes() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadIdRef = useRef<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUploadClick = useCallback((id: number) => {
    uploadIdRef.current = id
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id = uploadIdRef.current
    if (!file || !id) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post(`/support-types/${id}/image`, formData, {
        headers: { 'Content-Type': undefined },
      })
      setRefreshKey((k) => k + 1)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur upload'
      alert(detail)
    } finally {
      e.target.value = ''
    }
  }, [])

  const columns: Column<SupportType>[] = [
    {
      key: 'image_path' as keyof SupportType, label: 'Photo', width: '80px',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {row.image_path ? (
            <img
              src={`/api/support-types/${row.id}/image?v=${refreshKey}`}
              alt={row.name}
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', color: 'var(--text-muted)',
            }}>
              —
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleUploadClick(row.id) }}
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            title="Changer la photo"
          >
            Photo
          </button>
        </div>
      ),
    },
    { key: 'code', label: 'Code', width: '120px', filterable: true },
    { key: 'name', label: 'Nom', filterable: true },
    { key: 'unit_quantity', label: 'Qte/unite', width: '100px' },
    { key: 'unit_label', label: 'Libelle unite', filterable: true },
    {
      key: 'is_active', label: 'Actif', width: '80px',
      render: (row) => row.is_active ? '✓' : '✗',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'unit_quantity', label: 'Quantite par unite', type: 'number', required: true },
    { key: 'unit_label', label: 'Libelle unite (ex: pile de 15)', type: 'text' },
    {
      key: 'is_active', label: 'Actif', type: 'select',
      defaultValue: 'true',
      options: [
        { value: 'true', label: 'Oui' },
        { value: 'false', label: 'Non' },
      ],
    },
  ]

  const renderFormImage = useCallback((_formData: Record<string, unknown>, initialData?: Record<string, unknown>) => {
    const id = initialData?.id as number | undefined
    const imagePath = initialData?.image_path
    if (!id) return (
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        La photo pourra etre ajoutee apres la creation.
      </div>
    )

    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Photo
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {imagePath ? (
            <img
              src={`/api/support-types/${id}/image?v=${refreshKey}`}
              alt="Support type"
              style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border-color)' }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 6,
              backgroundColor: 'var(--bg-tertiary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', color: 'var(--text-muted)',
              border: '1px dashed var(--border-color)',
            }}>
              Pas de photo
            </div>
          )}
          <button
            type="button"
            onClick={() => handleUploadClick(id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            {imagePath ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
        </div>
      </div>
    )
  }, [refreshKey, handleUploadClick])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <CrudPage<SupportType>
        key={refreshKey}
        title="Types de support"
        endpoint="/support-types"
        columns={columns}
        fields={fields}
        searchKeys={['code', 'name']}
        createTitle="Nouveau type de support"
        editTitle="Modifier type de support"
        transformPayload={(d) => ({
          ...d,
          unit_quantity: Number(d.unit_quantity),
          is_active: d.is_active === 'true' || d.is_active === true,
        })}
        formExtra={renderFormImage}
      />
    </>
  )
}
