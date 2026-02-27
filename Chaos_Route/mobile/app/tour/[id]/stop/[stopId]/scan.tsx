/* Scanner QR PDV / PDV QR scanner screen */

import { useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams, useRouter } from 'expo-router'
import api from '../../../../../services/api'
import { COLORS } from '../../../../../constants/config'
import { TorchToggleButton } from '../../../../../components/TorchToggleButton'

export default function ScanPdvScreen() {
  const { id, stopId } = useLocalSearchParams<{ id: string; stopId: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(true)
  const [loading, setLoading] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const scannedRef = useRef(false)

  const tourId = Number(id)
  const tourStopId = Number(stopId)

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current || !scanning) return
    scannedRef.current = true
    setScanning(false)
    setLoading(true)

    try {
      await api.post(`/driver/tour/${tourId}/stops/${tourStopId}/scan-pdv`, {
        scanned_pdv_code: data,
        timestamp: new Date().toISOString(),
      })
      Alert.alert('Succes', 'PDV valide ! Passez au scan des supports.', [
        {
          text: 'OK',
          onPress: () => router.replace(`/tour/${tourId}/stop/${tourStopId}/supports`),
        },
      ])
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      Alert.alert('Erreur', detail, [
        {
          text: 'Re-scanner',
          onPress: () => {
            scannedRef.current = false
            setScanning(true)
            setLoading(false)
          },
        },
        { text: 'Retour', onPress: () => router.back() },
      ])
      setLoading(false)
    }
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Acces camera requis pour scanner les QR</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>Autoriser la camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      />

      {/* Torch toggle */}
      <TorchToggleButton enabled={torchOn} onToggle={() => setTorchOn((v) => !v)} />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>
          {loading ? 'Verification...' : 'Pointez le QR code du PDV'}
        </Text>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />}
      </View>

      {/* Bouton annuler / Cancel button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
    padding: 20,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  permBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderRadius: 16,
  },
  hint: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
})
