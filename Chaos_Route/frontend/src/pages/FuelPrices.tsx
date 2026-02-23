/* Page Prix du gasoil / Fuel price management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { FuelPrice } from '../types'
import { formatDate } from '../utils/tourTimeUtils'

export default function FuelPrices() {
  const { t } = useTranslation()

  const columns: Column<FuelPrice>[] = [
    { key: 'start_date', label: t('fuelPrices.startDate'), width: '120px', render: (row) => formatDate(row.start_date) },
    { key: 'end_date', label: t('fuelPrices.endDate'), width: '120px', render: (row) => formatDate(row.end_date) },
    {
      key: 'price_per_liter', label: t('fuelPrices.pricePerLiter'), width: '140px',
      render: (row) => `${row.price_per_liter} €/L`,
    },
  ]

  const fields: FieldDef[] = [
    { key: 'start_date', label: t('fuelPrices.startDate'), type: 'date', required: true },
    { key: 'end_date', label: t('fuelPrices.endDate'), type: 'date', required: true },
    { key: 'price_per_liter', label: t('fuelPrices.pricePerLiter'), type: 'number', required: true, step: 0.0001, min: 0 },
  ]

  return (
    <CrudPage<FuelPrice>
      title={t('fuelPrices.title')}
      endpoint="/fuel-prices"
      columns={columns}
      fields={fields}
      searchKeys={['start_date', 'end_date']}
      createTitle={t('fuelPrices.new')}
      editTitle={t('fuelPrices.edit')}
    />
  )
}
