/* Validation du tour (phase construction) / Tour validation rules (construction phase) */

import { useTranslation } from 'react-i18next'
import type { TourStop, VehicleType, TemperatureType } from '../../types'
import { TEMPERATURE_TYPE_LABELS } from '../../types'

interface TourValidationProps {
  stops: TourStop[]
  vehicleType: VehicleType | null
  capacityEqp: number
  totalEqp: number
  onValidate: () => void
  onReset: () => void
  temperatureType?: TemperatureType | null
}

interface ValidationMessage {
  type: 'error' | 'warning' | 'info'
  message: string
}

export function TourValidation({ stops, vehicleType, capacityEqp, totalEqp, onValidate, onReset, temperatureType }: TourValidationProps) {
  const { t } = useTranslation()

  const messages: ValidationMessage[] = []

  if (!vehicleType) {
    messages.push({ type: 'error', message: t('tourPlanning.validation.noVehicle') })
  }

  if (stops.length === 0) {
    messages.push({ type: 'error', message: t('tourPlanning.validation.noStops') })
  }

  if (capacityEqp > 0 && totalEqp > capacityEqp) {
    messages.push({
      type: 'error',
      message: t('tourPlanning.validation.overCapacity', {
        over: totalEqp - capacityEqp,
      }),
    })
  }

  if (capacityEqp > 0 && totalEqp > 0 && totalEqp < capacityEqp * 0.5) {
    messages.push({
      type: 'warning',
      message: t('tourPlanning.validation.lowFillRate', {
        pct: Math.round((totalEqp / capacityEqp) * 100),
      }),
    })
  }

  if (vehicleType && !temperatureType) {
    messages.push({ type: 'warning', message: 'Température non sélectionnée' })
  }

  if (temperatureType) {
    messages.push({ type: 'info', message: `Température: ${TEMPERATURE_TYPE_LABELS[temperatureType]}` })
  }

  if (vehicleType && stops.length > 0 && totalEqp <= capacityEqp) {
    messages.push({ type: 'info', message: t('tourPlanning.validation.readyDraft') })
  }

  const hasErrors = messages.some((m) => m.type === 'error')

  const colorMap = {
    error: { bg: 'rgba(239,68,68,0.1)', text: 'var(--color-danger)', icon: '✕' },
    warning: { bg: 'rgba(234,179,8,0.1)', text: 'var(--color-warning)', icon: '⚠' },
    info: { bg: 'rgba(34,197,94,0.1)', text: 'var(--color-success)', icon: '✓' },
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('tourPlanning.validation.title')}
        </h3>
      </div>

      <div className="p-3 space-y-2">
        {messages.map((msg, i) => {
          const style = colorMap[msg.type]
          return (
            <div
              key={i}
              className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              <span className="font-bold">{style.icon}</span>
              {msg.message}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
        <button
          className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
          style={{
            backgroundColor: hasErrors ? 'var(--bg-tertiary)' : 'var(--color-primary)',
            color: hasErrors ? 'var(--text-muted)' : '#fff',
          }}
          disabled={hasErrors}
          onClick={onValidate}
        >
          {t('tourPlanning.validation.saveDraft')}
        </button>
        <button
          className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          onClick={onReset}
        >
          {t('tourPlanning.resetTour')}
        </button>
      </div>
    </div>
  )
}
