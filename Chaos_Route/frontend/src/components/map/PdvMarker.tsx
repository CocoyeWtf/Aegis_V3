/* Marqueur PDV sur la carte / PDV marker on map */

import { useMemo } from 'react'
import { Marker, Tooltip, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { PDV, PdvPickupSummary } from '../../types'

/* Statut volume du PDV / PDV volume status */
export type PdvVolumeStatus = 'none' | 'unassigned' | 'assigned'

/* Labels courts par type de reprise / Short labels per pickup type */
const PICKUP_TYPE_SHORT: Record<string, string> = {
  CONTAINER: 'Contenants',
  CARDBOARD: 'Cartons',
  MERCHANDISE: 'Marchandise',
  CONSIGNMENT: 'Consignes',
}

/* Cache global d'icônes / Global icon cache */
const iconCache = new Map<string, L.DivIcon>()

function makeIcon(color: string, size: number, borderWidth: number, hasPickup: boolean = false): L.DivIcon {
  const key = `${color}-${size}-${borderWidth}-${hasPickup}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const badge = hasPickup
    ? '<div style="position:absolute;top:-3px;right:-3px;background:#f59e0b;width:8px;height:8px;border-radius:50%;border:1.5px solid #fff"></div>'
    : ''

  const icon = L.divIcon({
    className: '',
    html: `<div style="position:relative;display:inline-block"><div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:${borderWidth}px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>${badge}</div>`,
    iconSize: [size + (hasPickup ? 4 : 0), size + (hasPickup ? 4 : 0)],
    iconAnchor: [(size + (hasPickup ? 4 : 0)) / 2, (size + (hasPickup ? 4 : 0)) / 2],
  })

  iconCache.set(key, icon)
  return icon
}

interface PdvMarkerProps {
  pdv: PDV
  onClick?: (pdv: PDV) => void
  selected?: boolean
  volumeStatus?: PdvVolumeStatus
  pickupSummary?: PdvPickupSummary
}

export function PdvMarker({ pdv, onClick, selected, volumeStatus = 'none', pickupSummary }: PdvMarkerProps) {
  if (!pdv.latitude || !pdv.longitude) return null

  const hasPickup = !!(pickupSummary && pickupSummary.pending_count > 0)

  const icon = useMemo(() => {
    if (selected) return makeIcon('#f97316', 24, 3, hasPickup)
    if (volumeStatus === 'unassigned') return makeIcon('#ef4444', 18, 2, hasPickup)
    if (volumeStatus === 'assigned') return makeIcon('#22c55e', 18, 2, hasPickup)
    return makeIcon('#9ca3af', 14, 2, hasPickup)
  }, [selected, volumeStatus, hasPickup])

  return (
    <Marker
      position={[pdv.latitude, pdv.longitude]}
      icon={icon}
      eventHandlers={onClick ? { click: () => onClick(pdv) } : undefined}
    >
      <Tooltip>
        <div style={{ fontSize: '12px' }}>
          <strong>{pdv.code}</strong> — {pdv.name}<br />
          {pdv.city && <span>{pdv.city}<br /></span>}
          <span style={{ color: '#888' }}>{pdv.type}</span>
          {pdv.has_sas && <span> | SAS: {pdv.sas_capacity} EQC</span>}
          {hasPickup && (
            <div style={{ marginTop: 4, color: '#f59e0b', fontWeight: 600 }}>
              Reprises: {pickupSummary!.requests.map(r => PICKUP_TYPE_SHORT[r.pickup_type]).filter(Boolean).join(', ')}
              {' '}({pickupSummary!.pending_count} étiq.)
            </div>
          )}
        </div>
      </Tooltip>
      {hasPickup && (
        <Popup>
          <div style={{ fontSize: 12, minWidth: 180 }}>
            <strong>{pdv.code}</strong> — {pdv.name}
            <div style={{ margin: '6px 0', borderTop: '1px solid #ddd' }} />
            <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>
              Reprises en attente ({pickupSummary!.pending_count} étiq.)
            </div>
            {Object.entries(
              pickupSummary!.requests.reduce((acc, r) => {
                acc[r.pickup_type] = (acc[r.pickup_type] || 0) + r.quantity
                return acc
              }, {} as Record<string, number>)
            ).map(([type, qty]) => (
              <div key={type}>{PICKUP_TYPE_SHORT[type] || type}: {qty}</div>
            ))}
            {onClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onClick(pdv) }}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '4px 8px',
                  backgroundColor: '#f97316',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Ajouter au tour
              </button>
            )}
          </div>
        </Popup>
      )}
    </Marker>
  )
}
