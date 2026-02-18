/* Page Contrats transporteurs (fusionné véhicule) / Contract management page (merged with vehicle) */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import { ScheduleCalendar } from '../components/contract/ScheduleCalendar'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import api from '../services/api'
import type { Contract, Region } from '../types'

export default function ContractManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')
  const [scheduleContract, setScheduleContract] = useState<Contract | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)

  const tempOptions = [
    { value: 'GEL', label: t('vehicles.gel') },
    { value: 'FRAIS', label: t('vehicles.frais') },
    { value: 'SEC', label: t('vehicles.sec') },
    { value: 'BI_TEMP', label: t('vehicles.biTemp') },
    { value: 'TRI_TEMP', label: t('vehicles.triTemp') },
  ]

  const vehicleTypeOptions = [
    { value: 'SEMI', label: t('vehicles.semi') },
    { value: 'PORTEUR', label: t('vehicles.porteur') },
    { value: 'PORTEUR_REMORQUE', label: t('vehicles.porteurRemorque') },
    { value: 'CITY', label: t('vehicles.city') },
    { value: 'VL', label: t('vehicles.vl') },
  ]

  const tailgateOptions = [
    { value: 'RETRACTABLE', label: t('vehicles.retractable') },
    { value: 'RABATTABLE', label: t('vehicles.rabattable') },
  ]

  const columns: Column<Contract>[] = [
    { key: 'code', label: t('common.code'), width: '90px' },
    { key: 'transporter_name', label: t('contracts.transporterName'), width: '140px' },
    { key: 'vehicle_code' as keyof Contract, label: t('contracts.vehicleCode'), width: '100px' },
    { key: 'vehicle_name' as keyof Contract, label: t('contracts.vehicleName'), width: '130px' },
    {
      key: 'temperature_type' as keyof Contract, label: t('vehicles.temperatureType'), width: '90px',
      render: (row) => row.temperature_type ?? '—',
    },
    {
      key: 'vehicle_type' as keyof Contract, label: t('vehicles.vehicleType'), width: '100px',
      render: (row) => row.vehicle_type ?? '—',
    },
    { key: 'capacity_eqp' as keyof Contract, label: t('contracts.capacity'), width: '80px' },
    {
      key: 'fixed_daily_cost', label: t('contracts.fixedDailyCost'), width: '100px',
      render: (row) => row.fixed_daily_cost != null ? `${row.fixed_daily_cost} €` : '—',
    },
    {
      key: 'cost_per_km', label: t('contracts.costPerKm'), width: '80px',
      render: (row) => row.cost_per_km != null ? `${row.cost_per_km} €` : '—',
    },
    {
      key: 'consumption_coefficient' as keyof Contract, label: t('contracts.consumptionCoefficient'), width: '100px',
      render: (row) => row.consumption_coefficient != null ? String(row.consumption_coefficient) : '—',
    },
    { key: 'start_date', label: t('common.startDate'), width: '100px' },
    { key: 'end_date', label: t('common.endDate'), width: '100px' },
    {
      key: 'region_id', label: t('common.region'), width: '100px',
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
    },
    {
      key: 'id' as keyof Contract,
      label: t('contracts.schedule'),
      width: '90px',
      render: (row) => (
        <button
          className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--color-primary)', backgroundColor: 'rgba(249,115,22,0.1)' }}
          onClick={(e) => {
            e.stopPropagation()
            setScheduleContract(row)
          }}
        >
          {t('contracts.schedule')}
        </button>
      ),
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'transporter_name', label: t('contracts.transporterName'), type: 'text', required: true },
    { key: 'vehicle_code', label: t('contracts.vehicleCode'), type: 'text' },
    { key: 'vehicle_name', label: t('contracts.vehicleName'), type: 'text' },
    { key: 'temperature_type', label: t('vehicles.temperatureType'), type: 'select', options: tempOptions },
    { key: 'vehicle_type', label: t('vehicles.vehicleType'), type: 'select', options: vehicleTypeOptions },
    { key: 'capacity_eqp', label: t('contracts.capacity'), type: 'number', min: 1 },
    { key: 'capacity_weight_kg', label: t('vehicles.capacityWeight'), type: 'number', min: 0 },
    { key: 'has_tailgate', label: t('vehicles.hasTailgate'), type: 'checkbox' },
    { key: 'tailgate_type', label: t('vehicles.tailgateType'), type: 'select', options: tailgateOptions },
    { key: 'fixed_daily_cost', label: t('contracts.fixedDailyCost'), type: 'number', step: 0.01 },
    { key: 'cost_per_km', label: t('contracts.costPerKm'), type: 'number', step: 0.0001 },
    { key: 'cost_per_hour', label: t('contracts.costPerHour'), type: 'number', step: 0.01 },
    { key: 'min_hours_per_day', label: t('contracts.minHoursPerDay'), type: 'number', step: 0.5 },
    { key: 'min_km_per_day', label: t('contracts.minKmPerDay'), type: 'number' },
    { key: 'consumption_coefficient', label: t('contracts.consumptionCoefficient'), type: 'number', step: 0.0001 },
    { key: 'start_date', label: t('common.startDate'), type: 'text', placeholder: 'YYYY-MM-DD' },
    { key: 'end_date', label: t('common.endDate'), type: 'text', placeholder: 'YYYY-MM-DD' },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
  ]

  // Dates indisponibles du contrat sélectionné / Unavailable dates of selected contract
  const unavailableDates = useMemo(() => {
    const set = new Set<string>()
    if (scheduleContract?.schedules) {
      for (const s of scheduleContract.schedules) {
        if (!s.is_available) set.add(s.date)
      }
    }
    return set
  }, [scheduleContract])

  const saveSchedule = useCallback(async (changes: Array<{ date: string; is_available: boolean }>) => {
    if (!scheduleContract || changes.length === 0) return
    setSavingSchedule(true)
    try {
      await api.put(`/contracts/${scheduleContract.id}/schedule`, changes)
      setScheduleContract(null)
    } catch (e) {
      console.error('Failed to save schedule', e)
    } finally {
      setSavingSchedule(false)
    }
  }, [scheduleContract])

  return (
    <>
      <CrudPage<Contract>
        title={t('contracts.title')}
        endpoint="/contracts"
        columns={columns}
        fields={fields}
        searchKeys={['code', 'transporter_name', 'vehicle_code', 'vehicle_name']}
        createTitle={t('contracts.new')}
        editTitle={t('contracts.edit')}
        importEntity="contracts"
        exportEntity="contracts"
        allowDuplicate
        transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
      />

      {scheduleContract && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div
            className="rounded-xl border shadow-2xl p-6 w-[420px]"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t('contracts.calendarTitle')} — {scheduleContract.code}
            </h3>
            <ScheduleCalendar
              unavailableDates={unavailableDates}
              onSave={saveSchedule}
              saving={savingSchedule}
              onClose={() => setScheduleContract(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}
