/* Ecran scanner reprises autonome (sans tour) / Standalone pickup scanner screen
   Flow : camera 1D → scan etiquette RET-xxx → POST /driver/standalone-pickup/{code} → compteur
*/

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Vibration, Platform, SafeAreaView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import api from '../services/api'
import { COLORS } from '../constants/config'
import { TorchToggleButton } from '../components/TorchToggleButton'
import type { StandalonePickupScan } from '../types'

export default function StandalonePickupsScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()

  const [scans, setScans] = useState<StandalonePickupScan[]>([])
  const [loading, setLoading] = useState(true)
  const [lastScanned, setLastScanned] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef(0)

  /* Charger les scans du jour au montage / Load today's scans on mount */
  useEffect(() => {
    api.get<StandalonePickupScan[]>('/driver/standalone-pickups')
      .then(({ data }) => setScans(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /* Scanner un code barre etiquette / Scan a pickup label barcode */
  const handleBarCodeScanned = useCallback(({ data: rawData }: { data: string }) => {
    const data = rawData.trim()
    // Anti-doublon : 3 secondes
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 3000) return
    lastScanRef.current = data
    lastScanTimeRef.current = now

    // Verifier que c'est un code RET-xxx
    if (!data.startsWith('RET-')) return

    Vibration.vibrate(100)
    setLastScanned(data)
    setTimeout(() => setLastScanned(''), 2000)

    // Envoyer au serveur / Send to server
    api.post<StandalonePickupScan>(`/driver/standalone-pickup/${encodeURIComponent(data)}`)
      .then(({ data: scan }) => {
        setScans((prev) => {
          // Anti-doublon dans la liste
          if (prev.find((s) => s.label_code === scan.label_code)) return prev
          return [scan, ...prev]
        })
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail || 'Erreur scan'
        Alert.alert('Erreur', detail)
      })
  }, [])

  /* Permission camera / Camera permission */
  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    )
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.text}>Acces camera requis pour scanner les reprises</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.linkText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner reprises</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Camera */}
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
            <Text style={styles.scanHint}>Pointez une etiquette reprise RET-xxx</Text>
          )}
        </View>
      </View>

      {/* Compteur / Counter */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {scans.length} etiquette(s) scannee(s)
        </Text>
      </View>

      {/* Liste scannee / Scanned list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(item, idx) => `${item.label_code}-${idx}`}
          renderItem={({ item, index }) => (
            <View style={styles.scanRow}>
              <Text style={styles.scanIndex}>{scans.length - index}</Text>
              <View style={styles.scanInfo}>
                <Text style={styles.scanBarcode}>{item.label_code}</Text>
                <View style={styles.scanDetails}>
                  {item.pdv_code && (
                    <Text style={styles.scanDetail}>
                      {item.pdv_code}{item.pdv_name ? ` - ${item.pdv_name}` : ''}
                    </Text>
                  )}
                  {item.support_type_code && (
                    <Text style={styles.scanDetail}>
                      {item.support_type_code}{item.support_type_name ? ` (${item.support_type_name})` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.scanRight}>
                <Text style={styles.scanStatus}>
                  {item.status === 'PICKED_UP' ? 'OK' : item.status}
                </Text>
                {item.picked_up_at && (
                  <Text style={styles.scanTime}>
                    {new Date(item.picked_up_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucune reprise scannee aujourd'hui</Text>
          }
        />
      )}
    </SafeAreaView>
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
  linkText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  backBtn: {
    paddingHorizontal: 12,
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
  counter: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  scanInfo: {
    flex: 1,
  },
  scanBarcode: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scanDetails: {
    marginTop: 2,
  },
  scanDetail: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  scanRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  scanStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  scanTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 30,
  },
})
