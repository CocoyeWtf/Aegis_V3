/* Page Prix carburant (gasoil + gaz) / Fuel price management page (diesel + gas) */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { FuelPrice, FuelType } from '../types'
import { formatDate } from '../utils/tourTimeUtils'

export default function FuelPrices() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<FuelType>('DIESEL')

  // Gasoil (DIESEL) = €/L, Gaz (GNV) = €/kg
  const unit = tab === 'GNV' ? '€/kg' : '€/L'
  const priceLabel = tab === 'GNV' ? t('fuelPrices.pricePerKg') : t('fuelPrices.pricePerLiter')

  const columns: Column<FuelPrice>[] = [
    { key: 'start_date', label: t('fuelPrices.startDate'), width: '120px', render: (row) => formatDate(row.start_date) },
    { key: 'end_date', label: t('fuelPrices.endDate'), width: '120px', render: (row) => formatDate(row.end_date) },
    {
      key: 'price_per_liter', label: priceLabel, width: '140px',
      render: (row) => `${row.price_per_liter} ${unit}`,
    },
  ]

  const fields: FieldDef[] = [
    { key: 'start_date', label: t('fuelPrices.startDate'), type: 'date', required: true },
    { key: 'end_date', label: t('fuelPrices.endDate'), type: 'date', required: true },
    { key: 'price_per_liter', label: priceLabel, type: 'number', required: true, step: 0.0001, min: 0 },
  ]

  const tabs: { value: FuelType; label: string }[] = [
    { value: 'DIESEL', label: t('fuelPrices.tabGasoil') },
    { value: 'GNV', label: t('fuelPrices.tabGaz') },
  ]

  const toolbarExtra = (
    <div className="flex gap-2 mb-4">
      {tabs.map((ti) => {
        const active = ti.value === tab
        return (
          <button
            key={ti.value}
            onClick={() => setTab(ti.value)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
            style={{
              backgroundColor: active ? 'rgba(249,115,22,0.12)' : 'var(--bg-tertiary)',
              borderColor: active ? 'var(--color-primary)' : 'var(--border-color)',
              color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
            }}
          >
            {ti.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <CrudPage<FuelPrice>
      key={tab}
      resource="fleet"
      title={`${t('fuelPrices.title')} — ${tab === 'GNV' ? t('fuelPrices.tabGaz') : t('fuelPrices.tabGasoil')}`}
      endpoint="/fuel-prices"
      columns={columns}
      fields={fields}
      searchKeys={['start_date', 'end_date']}
      createTitle={t('fuelPrices.new')}
      editTitle={t('fuelPrices.edit')}
      toolbarExtra={toolbarExtra}
      filterData={(rows) => rows.filter((r) => (r.fuel_type ?? 'DIESEL') === tab)}
      transformPayload={(d) => ({ ...d, fuel_type: tab, price_per_liter: Number(d.price_per_liter) })}
    />
  )
}
