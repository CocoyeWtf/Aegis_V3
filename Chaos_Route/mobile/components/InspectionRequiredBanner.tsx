/* Banniere inspection requise / Inspection required banner */

import { useState, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { COLORS } from '../constants/config'
import type { InspectionCheckVehicle } from '../types'

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TRACTEUR: 'Tracteur',
  SEMI_REMORQUE: 'Semi-remorque',
  PORTEUR: 'Porteur',
  PORTEUR_SURBAISSE: 'Porteur surbaissé',
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
  const [showScanner, setShowScanner] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const scannedRef = useRef(false)

  if (pending.length === 0) return null

  const handleInspect = (vehicle: InspectionCheckVehicle) => {
    router.push(
      `/inspection?tourId=${tourId}&vehicleId=${vehicle.id}&vehicleCode=${encodeURIComponent(vehicle.code)}&driverName=${encodeURIComponent(driverName || '')}&inspectionType=PRE_DEPARTURE`
    )
  }

  const handleQrScanned = useCallback(({ data: qrData }: { data: string }) => {
    if (scannedRef.current) return
    scannedRef.current = true

    // Format attendu : "VEH:{code}" / Expected format: "VEH:{code}"
    const match = qrData.match(/^VEH:([A-F0-9]{8})$/i)
    if (!match) {
      Alert.alert('QR invalide', 'Format attendu: QR vehicule CMRO', [
        { text: 'Re-scanner', onPress: () => { scannedRef.current = false } },
        { text: 'Fermer', onPress: () => { setShowScanner(false); scannedRef.current = false } },
      ])
      return
    }

    const scannedCode = match[1].toUpperCase()
    const matched = pending.find((v) => v.qr_code?.toUpperCase() === scannedCode)

    if (!matched) {
      Alert.alert('Vehicule non trouve', 'Ce vehicule n\'est pas sur ce tour', [
        { text: 'Re-scanner', onPress: () => { scannedRef.current = false } },
        { text: 'Fermer', onPress: () => { setShowScanner(false); scannedRef.current = false } },
      ])
      return
    }

    setShowScanner(false)
    scannedRef.current = false
    handleInspect(matched)
  }, [pending, tourId, driverName])

  /* Mode scanner QR / QR scanner mode */
  if (showScanner) {
    if (!permission) {
      return <View style={styles.scanCenter}><ActivityIndicator color={COLORS.primary} /></View>
    }
    if (!permission.granted) {
      return (
        <View style={styles.scanCenter}>
          <Text style={styles.permText}>Acces camera requis pour scanner le QR vehicule</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.inspectBtn}>
            <Text style={styles.inspectBtnText}>Autoriser la camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowScanner(false); scannedRef.current = false }} style={{ marginTop: 12 }}>
            <Text style={{ color: COLORS.primary, fontSize: 13 }}>Retour</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View style={styles.scanContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleQrScanned}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.qrFrame} />
          <Text style={styles.scanHint}>Scannez le QR du vehicule</Text>
        </View>
        <TouchableOpacity
          onPress={() => { setShowScanner(false); scannedRef.current = false }}
          style={styles.closeScanBtn}
        >
          <Text style={styles.closeScanBtnText}>Fermer</Text>
        </TouchableOpacity>
      </View>
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

      {/* Bouton scanner QR / Scan QR button */}
      <TouchableOpacity
        onPress={() => { scannedRef.current = false; setShowScanner(true) }}
        style={styles.scanQrBtn}
      >
        <Text style={styles.scanQrBtnText}>Scanner QR vehicule</Text>
      </TouchableOpacity>

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
  scanQrBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  scanQrBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
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
  /* Scanner styles */
  scanContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrFrame: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 16,
  },
  scanHint: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  closeScanBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  closeScanBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  scanCenter: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  permText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
})
