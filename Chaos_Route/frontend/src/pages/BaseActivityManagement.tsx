/* Page gestion des activités de base / Base Activity management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { BaseActivity } from '../types'

export default function BaseActivityManagement() {
  const { t } = useTranslation()

  const columns: Column<BaseActivity>[] = [
    { key: 'id', label: t('common.id'), width: '60px' },
    { key: 'code', label: t('common.code'), width: '200px' },
    { key: 'name', label: t('common.name') },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
  ]

  return (
    <CrudPage<BaseActivity>
      title={t('baseActivities.title')}
      endpoint="/base-activities"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name']}
      createTitle={t('baseActivities.new')}
      editTitle={t('baseActivities.edit')}
    />
  )
}
