/* Carte stop dans le detail tour / Stop card in tour detail */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Linking from 'expo-linking'
import { COLORS, STATUS_COLORS } from '../constants/config'
import type { DriverTourStop } from '../types'

interface StopCardProps {
  stop: DriverTourStop
  onScanPdv: () => void
  onScanSupports: () => void
  onScanPickups: () => void
  onClose: () => void
  onRefusePickup?: () => void
}

export function StopCard({ stop, onScanPdv, onScanSupports, onScanPickups, onClose, onRefusePickup }: StopCardProps) {
  const status = stop.delivery_status || 'PENDING'
  const color = STATUS_COLORS[status] || COLORS.textMuted
  const isPending = status === 'PENDING'
  const isArrived = status === 'ARRIVED'

  const openNavigation = () => {
    if (stop.pdv_latitude && stop.pdv_longitude) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${stop.pdv_latitude},${stop.pdv_longitude}`
      )
    }
  }

  const pickups = [
    stop.pickup_cardboard && 'Cartons',
    stop.pickup_containers && 'Bacs',
    stop.pickup_returns && 'Retours',
    stop.pickup_consignment && 'Consignes',
  ].filter(Boolean).join(', ')

  const hasSummary = stop.pickup_summary && stop.pickup_summary.length > 0

  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sequence}>#{stop.sequence_order}</Text>
          <Text style={styles.pdvCode}>{stop.pdv_code || '—'}</Text>
          <Text style={styles.pdvName}>{stop.pdv_name || ''}</Text>
          {stop.pdv_city ? <Text style={styles.city}>{stop.pdv_address} — {stop.pdv_city}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.statusBadge, { color }]}>{status}</Text>
          <Text style={styles.eqc}>{stop.eqp_count} EQC</Text>
          {stop.arrival_time ? <Text style={styles.time}>Prevu {stop.arrival_time}</Text> : null}
        </View>
      </View>

      {/* Banniere reprises / Pickup banner */}
      {hasSummary ? (
        <View style={styles.pickupBanner}>
          <Text style={styles.pickupBannerTitle}>Reprises a effectuer</Text>
          {stop.pickup_summary!.map((item) => (
            <Text key={item.support_type_code} style={styles.pickupBannerLine}>
              {item.support_type_name} : {item.pending_labels}/{item.total_labels} restante(s)
            </Text>
          ))}
        </View>
      ) : pickups ? (
        <Text style={styles.pickups}>Reprises: {pickups}</Text>
      ) : null}

      {/* Boutons actions / Action buttons */}
      <View style={styles.actions}>
        {stop.pdv_latitude != null && stop.pdv_longitude != null && (
          <TouchableOpacity onPress={openNavigation} style={styles.navBtn}>
            <Text style={styles.navBtnText}>Navigation</Text>
          </TouchableOpacity>
        )}

        {isPending && (
          <TouchableOpacity onPress={onScanPdv} style={styles.scanBtn}>
            <Text style={styles.scanBtnText}>Scanner PDV</Text>
          </TouchableOpacity>
        )}

        {isArrived && (
          <TouchableOpacity onPress={onScanSupports} style={styles.supportBtn}>
            <Text style={styles.supportBtnText}>
              Scanner supports{stop.scanned_supports_count ? ` (${stop.scanned_supports_count})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {isArrived && (stop.pending_pickup_labels_count ?? 0) > 0 && (
          <TouchableOpacity onPress={onScanPickups} style={styles.pickupBtn}>
            <Text style={styles.pickupBtnText}>
              Scanner reprises ({stop.pending_pickup_labels_count})
            </Text>
          </TouchableOpacity>
        )}

        {isArrived && (stop.pending_pickup_labels_count ?? 0) > 0 && onRefusePickup && (
          <TouchableOpacity onPress={onRefusePickup} style={styles.refuseBtn}>
            <Text style={styles.refuseBtnText}>Refuser</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sequence: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  pdvCode: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  pdvName: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  city: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  eqc: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pickups: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 6,
  },
  pickupBanner: {
    backgroundColor: '#f97316' + '22',
    borderWidth: 1,
    borderColor: '#f97316',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  pickupBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 4,
  },
  pickupBannerLine: {
    fontSize: 11,
    color: COLORS.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navBtnText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scanBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    flex: 1,
    alignItems: 'center',
  },
  scanBtnText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  supportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    flex: 1,
    alignItems: 'center',
  },
  supportBtnText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  pickupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    flex: 1,
    alignItems: 'center',
  },
  pickupBtnText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  refuseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  refuseBtnText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
})
