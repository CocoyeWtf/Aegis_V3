/* Ecran scan reprises contenants / Pickup label scanning screen

Flow : camera 1D → scan etiquette reprise → API PICKED_UP → compteur
*/

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Vibration, Platform,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams, useRouter } from 'expo-router'
import api from '../../../../../services/api'
import { COLORS } from '../../../../../constants/config'
import { TorchToggleButton } from '../../../../../components/TorchToggleButton'
import type { PickupLabelMobile } from '../../../../../types'

export default function PickupScanScreen() {
  const { id, stopId } = useLocalSearchParams<{ id: string; stopId: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()

  const tourId = Number(id)

  const [labels, setLabels] = useState<PickupLabelMobile[]>([])
  const [scannedLabels, setScannedLabels] = useState<PickupLabelMobile[]>([])
  const [hpLabels, setHpLabels] = useState<PickupLabelMobile[]>([])  // hors-planning
  const [scanning, setScanning] = useState(true)
  const [lastScanned, setLastScanned] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef(0)

  /* Charger les etiquettes du tour / Load tour pickup labels */
  useEffect(() => {
    api.get<PickupLabelMobile[]>(`/driver/tour/${tourId}/pickups`)
      .then(({ data }) => {
        setLabels(data)
        setScannedLabels(data.filter((l) => l.status === 'PICKED_UP' || l.status === 'RECEIVED'))
      })
      .catch(() => {})
  }, [tourId])

  /* Scanner un code barre etiquette / Scan a pickup label barcode */
  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    if (!scanning) return

    // Anti-doublon
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 3000) return
    lastScanRef.current = data
    lastScanTimeRef.current = now

    // Verifier que c'est un code RET-xxx
    if (!data.startsWith('RET-')) return

    Vibration.vibrate(100)
    setLastScanned(data)
    setTimeout(() => setLastScanned(''), 2000)

    // Envoyer au serveur avec stop_id pour lier les labels hors-planning
    api.post<PickupLabelMobile>(`/driver/pickup-labels/${encodeURIComponent(data)}/scan?stop_id=${stopId}`)
      .then(({ data: label }) => {
        // Verifier si c'est un label hors-planning (pas dans la liste initiale)
        const isPlanned = labels.some((l) => l.id === label.id)
        if (isPlanned) {
          setScannedLabels((prev) => {
            if (prev.find((l) => l.id === label.id)) return prev
            return [label, ...prev]
          })
        } else {
          setHpLabels((prev) => {
            if (prev.find((l) => l.id === label.id)) return prev
            return [label, ...prev]
          })
        }
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail || 'Erreur scan'
        Alert.alert('Erreur', detail)
      })
  }, [scanning, labels, stopId])

  const totalExpected = labels.length
  const scannedCount = scannedLabels.length
  const hpCount = hpLabels.length
  const allPlannedScanned = totalExpected > 0 && scannedCount >= totalExpected

  /* Permission camera / Camera permission */
  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Acces camera requis pour scanner les reprises</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      {scanning ? (
        <View style={styles.cameraSection}>
          <CameraView
            style={styles.camera}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['code128', 'code39', 'ean13', 'qr'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <TorchToggleButton enabled={torchOn} onToggle={() => setTorchOn((v) => !v)} />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanLine} />
            {lastScanned ? (
              <Text style={styles.scanSuccess}>{lastScanned}</Text>
            ) : (
              <Text style={styles.scanHint}>
                {allPlannedScanned
                  ? 'Scannez les reprises hors planning'
                  : 'Pointez une etiquette reprise'}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.cameraDone, allPlannedScanned && { backgroundColor: COLORS.success }]}>
          <Text style={styles.cameraDoneText}>
            {allPlannedScanned ? 'Toutes les reprises scannees !' : 'Scan termine'}
          </Text>
        </View>
      )}

      {/* Compteur / Counter */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {scannedCount}/{totalExpected}
          {hpCount > 0 ? ` + ${hpCount} hors planning` : ''} scannees
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {scanning && (
            <TouchableOpacity onPress={() => setScanning(false)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Stop</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste scannee / Scanned list (planned + hors-planning) */}
      <FlatList
        data={[...hpLabels.map((l) => ({ ...l, _hp: true })), ...scannedLabels.map((l) => ({ ...l, _hp: false }))]}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const allCount = hpLabels.length + scannedLabels.length
          return (
            <View style={styles.scanRow}>
              <Text style={styles.scanIndex}>{allCount - index}</Text>
              {item._hp && <Text style={styles.hpBadge}>HP</Text>}
              <Text style={styles.scanBarcode}>{item.label_code}</Text>
              <Text style={styles.scanStatus}>
                {item.status === 'PICKED_UP' ? 'OK' : item.status}
              </Text>
            </View>
          )
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Scannez les etiquettes de reprise...</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
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
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  cameraSection: {
    height: 250,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#22c55e',
    opacity: 0.8,
  },
  scanHint: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  scanSuccess: {
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  cameraDone: {
    height: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraDoneText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  counter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  counterText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  list: {
    padding: 12,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scanIndex: {
    width: 30,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  hpBadge: {
    backgroundColor: '#f97316',
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
    overflow: 'hidden',
  },
  scanBarcode: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scanStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 30,
  },
})
