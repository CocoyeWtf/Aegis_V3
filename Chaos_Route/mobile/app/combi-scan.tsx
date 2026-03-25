/* Ecran scan combis + reprises au PDV / Combi & pickup scan screen at PDV.
   Flow :
   1. Scanner code-barres PDV (obligatoire) → identifie le point de vente
   2. Scanner librement : combis (RM######) et/ou etiquettes reprises (RET-xxx)
   3. Alterner entre types dans n'importe quel ordre
   Geoloc enregistree a chaque scan.
*/

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Vibration, SafeAreaView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import api from '../services/api'
import { COLORS } from '../constants/config'
import { TorchToggleButton } from '../components/TorchToggleButton'

/* Types de scan / Scan types */
type ScanType = 'PDV' | 'COMBI' | 'LABEL'

interface ScanEntry {
  id: string
  type: ScanType
  barcode: string
  pdvCode?: string
  pdvName?: string
  supportType?: string
  timestamp: string
  status: string
}

/** Detecter le type de code-barres / Detect barcode type */
function detectBarcodeType(data: string): ScanType | null {
  if (/^RM\d{4,8}$/i.test(data)) return 'COMBI'
  if (data.startsWith('RET-')) return 'LABEL'
  if (/^\d{3,6}$/.test(data)) return 'PDV'
  return null
}

/** Obtenir la position GPS / Get GPS position */
async function getGeoLoc(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null
    const loc = await Location.getLastKnownPositionAsync()
    if (loc) return { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? 0 }
    const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude, accuracy: fresh.coords.accuracy ?? 0 }
  } catch {
    return null
  }
}

export default function CombiScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()

  // Phase : null = scan PDV, string = PDV scanne (scan libre)
  const [activePdv, setActivePdv] = useState<{ code: string; name: string } | null>(null)
  const [scans, setScans] = useState<ScanEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [lastScanned, setLastScanned] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef(0)

  /* Charger les scans combis du jour / Load today's combi scans */
  useEffect(() => {
    api.get('/driver/combi-scans/')
      .then(({ data }) => {
        const entries: ScanEntry[] = data.map((s: any) => ({
          id: `combi-${s.id}`,
          type: 'COMBI' as ScanType,
          barcode: s.barcode,
          pdvCode: s.pdv_code_scanned,
          pdvName: s.pdv_name,
          timestamp: s.timestamp,
          status: 'OK',
        }))
        setScans(entries)
      })
      .catch(() => {})
  }, [])

  const handleBarCodeScanned = useCallback(async ({ data: rawData }: { data: string }) => {
    const data = rawData.trim().toUpperCase()
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 3000) return
    lastScanRef.current = data
    lastScanTimeRef.current = now

    const type = detectBarcodeType(data)
    if (!type) return

    Vibration.vibrate(100)

    // Phase 1 : Scan PDV
    if (type === 'PDV') {
      setLoading(true)
      try {
        // Verifier que le PDV existe via l'API PDV
        const { data: pdvs } = await api.get(`/pdvs/?search=${data}`)
        const pdv = pdvs.find((p: any) => p.code === data || p.code === data.padStart(5, '0'))
        if (!pdv) {
          Alert.alert('PDV inconnu', `Aucun PDV trouve avec le code ${data}`)
          return
        }
        setActivePdv({ code: pdv.code, name: pdv.name })
        setLastScanned(`PDV ${pdv.code} — ${pdv.name}`)
        setTimeout(() => setLastScanned(''), 3000)
      } catch {
        Alert.alert('Erreur', 'Impossible de verifier le PDV')
      } finally {
        setLoading(false)
      }
      return
    }

    // Phase 2 : Scan libre (combi ou etiquette) — PDV requis
    if (!activePdv) {
      Alert.alert('PDV requis', 'Scannez d\'abord le code-barres du PDV avant de scanner les contenants.')
      return
    }

    const geo = await getGeoLoc()
    const ts = new Date().toISOString()

    if (type === 'COMBI') {
      // Scan combi → POST /driver/combi-scan/
      try {
        const { data: scan } = await api.post('/driver/combi-scan/', {
          barcode: data,
          pdv_code_scanned: activePdv.code,
          timestamp: ts,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          accuracy: geo?.accuracy ?? null,
        })
        setScans((prev) => {
          if (prev.find((s) => s.barcode === data && s.type === 'COMBI')) return prev
          return [{
            id: `combi-${scan.id}`,
            type: 'COMBI',
            barcode: scan.barcode,
            pdvCode: activePdv.code,
            pdvName: activePdv.name,
            timestamp: ts,
            status: 'OK',
          }, ...prev]
        })
        setLastScanned(`COMBI ${data}`)
      } catch (err: any) {
        Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur scan combi')
      }
    } else if (type === 'LABEL') {
      // Scan etiquette reprise → POST /driver/standalone-pickup/{code}
      try {
        const { data: scan } = await api.post(`/driver/standalone-pickup/${encodeURIComponent(data)}`)
        setScans((prev) => {
          if (prev.find((s) => s.barcode === data && s.type === 'LABEL')) return prev
          return [{
            id: `label-${scan.label_code}`,
            type: 'LABEL',
            barcode: scan.label_code,
            pdvCode: scan.pdv_code,
            pdvName: scan.pdv_name,
            supportType: scan.support_type_name,
            timestamp: ts,
            status: scan.status || 'OK',
          }, ...prev]
        })
        setLastScanned(`REPRISE ${data}`)
      } catch (err: any) {
        Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur scan etiquette')
      }
    }
    setTimeout(() => setLastScanned(''), 2000)
  }, [activePdv])

  /* Changer de PDV / Switch PDV */
  const handleChangePdv = () => {
    setActivePdv(null)
    setLastScanned('')
  }

  /* Permission camera / Camera permission */
  if (!permission) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} /></SafeAreaView>
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.text}>Acces camera requis pour scanner</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.linkText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const combiCount = scans.filter((s) => s.type === 'COMBI').length
  const labelCount = scans.filter((s) => s.type === 'LABEL').length

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan contenants</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* PDV context banner */}
      {activePdv ? (
        <View style={styles.pdvBanner}>
          <View>
            <Text style={styles.pdvBannerCode}>{activePdv.code}</Text>
            <Text style={styles.pdvBannerName}>{activePdv.name}</Text>
          </View>
          <TouchableOpacity onPress={handleChangePdv} style={styles.changePdvBtn}>
            <Text style={styles.changePdvText}>Changer PDV</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pdvRequired}>
          <Text style={styles.pdvRequiredText}>Scannez le code-barres du PDV</Text>
        </View>
      )}

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
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : lastScanned ? (
            <Text style={styles.scanSuccess}>{lastScanned}</Text>
          ) : (
            <Text style={styles.scanHint}>
              {activePdv ? 'Scannez combis (RM) ou etiquettes (RET)' : 'Scannez le code-barres PDV'}
            </Text>
          )}
        </View>
      </View>

      {/* Compteurs / Counters */}
      <View style={styles.counters}>
        <View style={styles.counterBox}>
          <Text style={[styles.counterNum, { color: '#8b5cf6' }]}>{combiCount}</Text>
          <Text style={styles.counterLabel}>Combis</Text>
        </View>
        <View style={styles.counterBox}>
          <Text style={[styles.counterNum, { color: COLORS.primary }]}>{labelCount}</Text>
          <Text style={styles.counterLabel}>Etiquettes</Text>
        </View>
        <View style={styles.counterBox}>
          <Text style={[styles.counterNum, { color: COLORS.success }]}>{combiCount + labelCount}</Text>
          <Text style={styles.counterLabel}>Total</Text>
        </View>
      </View>

      {/* Liste scannee / Scanned list */}
      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.scanRow}>
            <View style={[styles.typeBadge, { backgroundColor: item.type === 'COMBI' ? '#8b5cf622' : '#f9731622' }]}>
              <Text style={[styles.typeBadgeText, { color: item.type === 'COMBI' ? '#8b5cf6' : COLORS.primary }]}>
                {item.type === 'COMBI' ? 'COMBI' : 'REPRISE'}
              </Text>
            </View>
            <View style={styles.scanInfo}>
              <Text style={styles.scanBarcode}>{item.barcode}</Text>
              <Text style={styles.scanDetail}>
                {item.pdvCode}{item.pdvName ? ` — ${item.pdvName}` : ''}
                {item.supportType ? ` | ${item.supportType}` : ''}
              </Text>
            </View>
            <Text style={styles.scanStatus}>{item.status}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucun scan aujourd'hui</Text>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary, padding: 32 },
  text: { color: COLORS.textPrimary, fontSize: 15, textAlign: 'center', marginBottom: 16 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: COLORS.primary, fontSize: 14 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  headerTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },

  pdvBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#22c55e18', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#22c55e44' },
  pdvBannerCode: { color: '#22c55e', fontWeight: '900', fontSize: 20 },
  pdvBannerName: { color: COLORS.textSecondary, fontSize: 12 },
  changePdvBtn: { backgroundColor: COLORS.bgTertiary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  changePdvText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

  pdvRequired: { backgroundColor: '#f59e0b18', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f59e0b44' },
  pdvRequiredText: { color: '#f59e0b', fontWeight: '700', fontSize: 14, textAlign: 'center' },

  cameraSection: { height: 200, position: 'relative' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 8 },
  scanLine: { width: '70%', height: 2, backgroundColor: COLORS.primary, borderRadius: 1, marginBottom: 6, opacity: 0.8 },
  scanSuccess: { color: COLORS.success, fontWeight: '700', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  scanHint: { color: COLORS.white, fontSize: 12, opacity: 0.8, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  counters: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, gap: 8 },
  counterBox: { flex: 1, alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border },
  counterNum: { fontSize: 22, fontWeight: '900' },
  counterLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  list: { paddingHorizontal: 12, paddingBottom: 20 },
  scanRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  typeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 10 },
  typeBadgeText: { fontSize: 9, fontWeight: '800' },
  scanInfo: { flex: 1 },
  scanBarcode: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, fontFamily: 'monospace' },
  scanDetail: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  scanStatus: { color: COLORS.success, fontWeight: '700', fontSize: 12 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 32, fontSize: 14 },
})
