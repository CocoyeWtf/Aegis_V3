/* Banniere inspection requise / Inspection required banner */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '../constants/config'
import type { InspectionCheckVehicle } from '../types'

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TRACTEUR: 'Tracteur',
  SEMI_REMORQUE: 'Semi-remorque',
  PORTEUR: 'Porteur',
  REMORQUE: 'Remorque',
  VL: 'VL',
}

interface Props {
  tourId: number
  vehicles: InspectionCheckVehicle[]
  driverName?: string
  onDone: () => void
}

export function InspectionRequiredBanner({ tourId, vehicles, driverName, onDone }: Props) {
  const router = useRouter()
  const pending = vehicles.filter((v) => !v.inspection_done)

  if (pending.length === 0) return null

  const handleInspect = (vehicle: InspectionCheckVehicle) => {
    router.push(
      `/inspection?tourId=${tourId}&vehicleId=${vehicle.id}&vehicleCode=${encodeURIComponent(vehicle.code)}&driverName=${encodeURIComponent(driverName || '')}&inspectionType=PRE_DEPARTURE`
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Inspection requise avant depart</Text>
      </View>
      <Text style={styles.desc}>
        Vous devez inspecter {pending.length === 1 ? 'le vehicule suivant' : 'les vehicules suivants'} avant de commencer le tour.
      </Text>

      {vehicles.map((v) => (
        <View key={v.id} style={[styles.vehicleRow, v.inspection_done && styles.vehicleDone]}>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleCode}>{v.code}</Text>
            <Text style={styles.vehicleType}>{VEHICLE_TYPE_LABELS[v.fleet_vehicle_type] || v.fleet_vehicle_type}</Text>
            {v.name ? <Text style={styles.vehicleName}>{v.name}</Text> : null}
          </View>
          {v.inspection_done ? (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>OK</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => handleInspect(v)} style={styles.inspectBtn}>
              <Text style={styles.inspectBtnText}>Inspecter</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {pending.length === 0 && (
        <TouchableOpacity onPress={onDone} style={styles.continueBtn}>
          <Text style={styles.continueBtnText}>Continuer</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.danger + '15',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
    padding: 14,
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  icon: { fontSize: 18 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  desc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vehicleDone: {
    borderColor: COLORS.success + '55',
    opacity: 0.7,
  },
  vehicleInfo: { flex: 1 },
  vehicleCode: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  vehicleType: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  vehicleName: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  doneBadge: {
    backgroundColor: COLORS.success + '22',
    borderColor: COLORS.success,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  doneBadgeText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '700',
  },
  inspectBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inspectBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  continueBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  continueBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
})
