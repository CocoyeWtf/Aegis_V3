/* Carte tour dans la liste / Tour card in list */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { COLORS, STATUS_COLORS } from '../constants/config'
import type { DriverTour } from '../types'

interface TourCardProps {
  tour: DriverTour
  onPress: () => void
}

export function TourCard({ tour, onPress }: TourCardProps) {
  const delivered = tour.stops.filter((s) => s.delivery_status === 'DELIVERED').length
  const total = tour.stops.length
  const statusColor = STATUS_COLORS[tour.status] || COLORS.textMuted

  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.code}>{tour.code}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{tour.status}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Depart</Text>
        <Text style={styles.value}>{tour.departure_time || '—'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Arrets</Text>
        <Text style={styles.value}>{delivered}/{total}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>EQC</Text>
        <Text style={styles.value}>{tour.total_eqp || 0}</Text>
      </View>

      {tour.vehicle_code ? (
        <View style={styles.row}>
          <Text style={styles.label}>Vehicule</Text>
          <Text style={styles.value}>{tour.vehicle_code}</Text>
        </View>
      ) : null}

      {/* Barre progression / Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: total > 0 ? `${(delivered / total) * 100}%` : '0%' }]} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  code: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  label: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  value: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  progressBg: {
    height: 4,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: COLORS.success,
    borderRadius: 2,
  },
})
