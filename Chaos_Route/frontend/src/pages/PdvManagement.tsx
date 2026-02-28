/* Page Points de vente / Point of Sale management page */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { PDV, Region, VehicleType } from '../types'
import { VEHICLE_TYPE_DEFAULTS } from '../types'

export default function PdvManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')
  const [qrPdv, setQrPdv] = useState<PDV | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const vehicleTypeOptions = (Object.keys(VEHICLE_TYPE_DEFAULTS) as VehicleType[]).map((vt) => ({
    value: vt,
    label: VEHICLE_TYPE_DEFAULTS[vt].label,
  }))

  const pdvTypeOptions = [
    { value: 'EXPRESS', label: t('pdvs.express') },
    { value: 'CONTACT', label: t('pdvs.contact') },
    { value: 'SUPER_ALIMENTAIRE', label: t('pdvs.superAlimentaire') },
    { value: 'SUPER_GENERALISTE', label: t('pdvs.superGeneraliste') },
    { value: 'HYPER', label: t('pdvs.hyper') },
    { value: 'NETTO', label: t('pdvs.netto') },
    { value: 'DRIVE', label: t('pdvs.drive') },
    { value: 'URBAIN_PROXI', label: t('pdvs.urbainProxi') },
  ]

  const columns: Column<PDV>[] = [
    {
      key: 'qr' as keyof PDV, label: 'QR', width: '50px',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setQrPdv(row) }}
          title="QR Code"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
        >
          ⊞
        </button>
      ),
    },
    { key: 'code', label: t('common.code'), width: '100px', filterable: true },
    { key: 'name', label: t('common.name'), filterable: true },
    { key: 'type', label: t('common.type'), width: '160px', filterable: true },
    { key: 'address', label: t('common.address'), defaultHidden: true },
    { key: 'postal_code', label: t('common.postalCode'), width: '100px', defaultHidden: true },
    { key: 'city', label: t('common.city'), width: '120px', filterable: true },
    { key: 'phone', label: t('common.phone'), width: '130px', defaultHidden: true },
    { key: 'email', label: t('common.email'), defaultHidden: true },
    { key: 'latitude', label: t('common.latitude'), width: '100px', defaultHidden: true },
    { key: 'longitude', label: t('common.longitude'), width: '100px', defaultHidden: true },
    { key: 'has_sas_sec', label: 'SAS Sec', width: '70px' },
    { key: 'sas_sec_surface_m2', label: 'SAS Sec m²', width: '90px', defaultHidden: true },
    { key: 'sas_sec_capacity_eqc', label: 'SAS Sec EQC', width: '100px', defaultHidden: true },
    { key: 'has_sas_frais', label: 'SAS Frais', width: '70px' },
    { key: 'sas_frais_surface_m2', label: 'SAS Frais m²', width: '100px', defaultHidden: true },
    { key: 'sas_frais_capacity_eqc', label: 'SAS Frais EQC', width: '110px', defaultHidden: true },
    { key: 'has_sas_gel', label: 'SAS Gel', width: '70px' },
    { key: 'sas_gel_surface_m2', label: 'SAS Gel m²', width: '90px', defaultHidden: true },
    { key: 'sas_gel_capacity_eqc', label: 'SAS Gel EQC', width: '100px', defaultHidden: true },
    { key: 'has_dock', label: t('pdvs.hasDock'), width: '60px' },
    { key: 'dock_has_niche', label: t('pdvs.dockHasNiche'), width: '70px', defaultHidden: true },
    { key: 'dock_time_minutes', label: t('pdvs.dockTime'), width: '100px', defaultHidden: true },
    { key: 'unload_time_per_eqp_minutes', label: t('pdvs.unloadTime'), width: '120px', defaultHidden: true },
    { key: 'delivery_window_start', label: t('pdvs.deliveryStart'), width: '100px', defaultHidden: true },
    { key: 'delivery_window_end', label: t('pdvs.deliveryEnd'), width: '100px', defaultHidden: true },
    {
      key: 'allowed_vehicle_types' as keyof PDV, label: 'Types véhicules', width: '150px', defaultHidden: true,
      render: (row) => row.allowed_vehicle_types
        ? row.allowed_vehicle_types.split('|').map((vt) => VEHICLE_TYPE_DEFAULTS[vt as VehicleType]?.label || vt).join(', ')
        : 'Tous',
    },
    {
      key: 'region_id', label: t('common.region'), width: '120px', filterable: true,
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
      filterValue: (row) => regions.find((r) => r.id === row.region_id)?.name || '',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'type', label: t('common.type'), type: 'select', required: true, options: pdvTypeOptions },
    { key: 'address', label: t('common.address'), type: 'text', colSpan: 2 },
    { key: 'postal_code', label: t('common.postalCode'), type: 'text' },
    { key: 'city', label: t('common.city'), type: 'text' },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'email', label: t('common.email'), type: 'text' },
    { key: 'latitude', label: t('common.latitude'), type: 'number', step: 0.000001 },
    { key: 'longitude', label: t('common.longitude'), type: 'number', step: 0.000001 },
    { key: 'has_sas_sec', label: 'SAS Sec', type: 'checkbox' },
    { key: 'sas_sec_surface_m2', label: 'SAS Sec — Surface (m²)', type: 'number', min: 0, step: 0.1 },
    { key: 'sas_sec_capacity_eqc', label: 'SAS Sec — Capacité (EQC)', type: 'number', min: 0 },
    { key: 'has_sas_frais', label: 'SAS Frais', type: 'checkbox' },
    { key: 'sas_frais_surface_m2', label: 'SAS Frais — Surface (m²)', type: 'number', min: 0, step: 0.1 },
    { key: 'sas_frais_capacity_eqc', label: 'SAS Frais — Capacité (EQC)', type: 'number', min: 0 },
    { key: 'has_sas_gel', label: 'SAS Gel', type: 'checkbox' },
    { key: 'sas_gel_surface_m2', label: 'SAS Gel — Surface (m²)', type: 'number', min: 0, step: 0.1 },
    { key: 'sas_gel_capacity_eqc', label: 'SAS Gel — Capacité (EQC)', type: 'number', min: 0 },
    { key: 'has_dock', label: t('pdvs.hasDock'), type: 'checkbox' },
    { key: 'dock_has_niche', label: t('pdvs.dockHasNiche'), type: 'checkbox' },
    { key: 'dock_time_minutes', label: t('pdvs.dockTime'), type: 'number', min: 0 },
    { key: 'unload_time_per_eqp_minutes', label: t('pdvs.unloadTime'), type: 'number', min: 0 },
    { key: 'delivery_window_start', label: t('pdvs.deliveryStart'), type: 'time' },
    { key: 'delivery_window_end', label: t('pdvs.deliveryEnd'), type: 'time' },
    { key: 'access_constraints', label: t('pdvs.accessConstraints'), type: 'textarea' },
    { key: 'allowed_vehicle_types', label: 'Types véhicules autorisés', type: 'multicheck', options: vehicleTypeOptions },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
  ]

  /* Impression QR / Print QR code */
  const handlePrint = () => {
    if (!printRef.current || !qrPdv) return
    const win = window.open('', '_blank', 'width=400,height=500')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>QR ${qrPdv.code}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
        .code { font-size: 28px; font-weight: bold; margin: 16px 0 4px; }
        .name { font-size: 16px; color: #666; margin-bottom: 8px; }
        .city { font-size: 14px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      <script>window.onload=function(){window.print();window.close();}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <>
      <CrudPage<PDV>
        title={t('pdvs.title')}
        endpoint="/pdvs"
        columns={columns}
        fields={fields}
        searchKeys={['code', 'name', 'city']}
        createTitle={t('pdvs.new')}
        editTitle={t('pdvs.edit')}
        importEntity="pdvs"
        exportEntity="pdvs"
        transformPayload={(d) => {
          const avt = d.allowed_vehicle_types as string[] | undefined
          return {
            ...d,
            region_id: Number(d.region_id),
            allowed_vehicle_types: avt && avt.length > 0 ? avt.join('|') : null,
          }
        }}
        transformInitialData={(d) => ({
          ...d,
          allowed_vehicle_types: d.allowed_vehicle_types ? (d.allowed_vehicle_types as string).split('|') : [],
        })}
        formSize="xl"
      />

      {/* Modale QR PDV / PDV QR code modal */}
      {qrPdv && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setQrPdv(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)', borderRadius: 12, padding: 32,
              border: '1px solid var(--border-color)', textAlign: 'center', minWidth: 320,
            }}
          >
            <div ref={printRef}>
              <QRCodeSVG value={qrPdv.code} size={200} level="H" />
              <div className="code" style={{ fontSize: 28, fontWeight: 'bold', marginTop: 16 }}>{qrPdv.code}</div>
              <div className="name" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 4 }}>{qrPdv.name}</div>
              {qrPdv.city && (
                <div className="city" style={{ fontSize: 14, color: 'var(--text-muted)' }}>{qrPdv.address} — {qrPdv.city}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
              <button
                onClick={handlePrint}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--accent-color)', color: '#fff', fontWeight: 600, fontSize: 14,
                }}
              >
                Imprimer
              </button>
              <button
                onClick={() => setQrPdv(null)}
                style={{
                  padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
                  background: 'none', border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14,
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
