/* Carte KPI individuelle / Individual KPI card */

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  color: string
  icon?: string
}

export function KpiCard({ label, value, unit, color, icon }: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-5 border"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
        {unit && <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </p>
    </div>
  )
}
