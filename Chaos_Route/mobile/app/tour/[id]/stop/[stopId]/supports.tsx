/* Ecran scan supports / Support barcode scanning screen

Flow : camera 1D en continu → liste des supports scannes → chauffeur tape "fin" → cloture
*/

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Vibration,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import api from '../../../../../services/api'
import { COLORS } from '../../../../../constants/config'
import type { SupportScan } from '../../../../../types'

export default function SupportScanScreen() {
  const { id, stopId } = useLocalSearchParams<{ id: string; stopId: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()

  const tourId = Number(id)
  const tourStopId = Number(stopId)

  const [scans, setScans] = useState<SupportScan[]>([])
  const [scanning, setScanning] = useState(true)
  const [finText, setFinText] = useState('')
  const [closing, setClosing] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [lastScanned, setLastScanned] = useState('')
  const [scanCount, setScanCount] = useState(0)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef(0)

  /* Charger les scans existants / Load existing scans */
  useEffect(() => {
    api.get<SupportScan[]>(`/driver/tour/${tourId}/stops/${tourStopId}/supports`)
      .then(({ data }) => {
        if (data.length > 0) {
          setScans(data.reverse())
          setScanCount(data.length)
        }
      })
      .catch(() => {})
  }, [tourId, tourStopId])

  /* Scanner un code barre support / Scan a support barcode */
  const handleBarCodeScanned = useCallback(async ({ data, type }: { data: string; type: string }) => {
    if (!scanning) return

    // Anti-doublon : ignorer si meme code dans les 3 dernieres secondes
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 3000) return
    lastScanRef.current = data
    lastScanTimeRef.current = now

    // Feedback immediat avant appel API
    setScanCount((c) => c + 1)
    Vibration.vibrate(100)
    setLastScanned(`${data} (${type})`)
    setTimeout(() => setLastScanned(''), 2000)

    // Obtenir la position GPS (quasi-instantane) / Get GPS position (near-instant)
    let lat: number | undefined
    let lon: number | undefined
    try {
      const loc = await Location.getLastKnownPositionAsync()
      if (loc) { lat = loc.coords.latitude; lon = loc.coords.longitude }
    } catch {}

    // Envoyer au serveur en arriere-plan
    api.post<SupportScan>(
      `/driver/tour/${tourId}/stops/${tourStopId}/scan-support`,
      { barcode: data, latitude: lat, longitude: lon, timestamp: new Date().toISOString() },
    ).then(({ data: scan }) => {
      setScans((prev) => [scan, ...prev])
      if (!scan.expected_at_stop) {
        Vibration.vibrate([0, 300, 100, 300])  // double vibration longue
        Alert.alert(
          'Mauvais PDV',
          `Ce support est destine au PDV ${scan.expected_pdv_code || 'inconnu'}`,
          [{ text: 'Compris' }],
        )
      }
    }).catch((err) => {
      // Ajouter quand meme en local pour le feedback
      console.warn('Support scan API error:', err?.response?.data?.detail || err.message)
      setScans((prev) => [{ id: Date.now(), tour_stop_id: tourStopId, barcode: data, timestamp: new Date().toISOString(), expected_at_stop: true }, ...prev])
    })
  }, [scanning, tourId, tourStopId])

  /* Verifier le mot "fin" / Check for "fin" keyword */
  const handleFinSubmit = () => {
    if (finText.trim().toLowerCase() !== 'fin') {
      Alert.alert('', 'Tapez "fin" pour terminer le scan des supports.')
      return
    }
    setScanning(false)

    const count = scans.length
    const wrongCount = scans.filter(s => !s.expected_at_stop).length
    if (count === 0) {
      Alert.alert(
        'Aucun support scanne',
        'Aucun support n\'a ete scanne pour ce stop. Voulez-vous cloturer quand meme ?',
        [
          { text: 'Reprendre', onPress: () => { setScanning(true); setFinText('') } },
          { text: 'Cloturer', onPress: () => setShowClose(true) },
        ],
      )
    } else {
      const msg = wrongCount > 0
        ? `${count} support(s) scanne(s) dont ${wrongCount} mauvais PDV !`
        : `${count} support(s) scanne(s).`
      Alert.alert(
        'Scan termine',
        msg,
        [{ text: 'OK', onPress: () => setShowClose(true) }],
      )
    }
  }

  /* Cloturer le stop / Close the stop */
  const handleClose = async () => {
    setClosing(true)
    try {
      await api.post(`/driver/tour/${tourId}/stops/${tourStopId}/close`, {
        timestamp: new Date().toISOString(),
        force: false,
      })
      Alert.alert('Stop cloture', 'Livraison enregistree.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      const msg = err?.response?.data?.detail || 'Erreur'
      const status = err?.response?.status

      // 422 reprises en attente → proposer Scanner reprises ou Forcer
      if (status === 422 && msg.includes('Reprises en attente')) {
        Alert.alert('Reprises en attente', msg, [
          {
            text: 'Scanner reprises',
            onPress: () => router.replace(`/tour/${tourId}/stop/${tourStopId}/pickups`),
          },
          {
            text: 'Forcer',
            style: 'destructive',
            onPress: async () => {
              await api.post(`/driver/tour/${tourId}/stops/${tourStopId}/close`, {
                timestamp: new Date().toISOString(),
                force: true,
              })
              Alert.alert('Stop cloture (force)', 'Livraison enregistree.', [
                { text: 'OK', onPress: () => router.back() },
              ])
            },
          },
        ])
      } else {
        Alert.alert('Erreur', msg, [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Forcer',
            style: 'destructive',
            onPress: async () => {
              await api.post(`/driver/tour/${tourId}/stops/${tourStopId}/close`, {
                timestamp: new Date().toISOString(),
                force: true,
              })
              Alert.alert('Stop cloture (force)', 'Livraison enregistree.', [
                { text: 'OK', onPress: () => router.back() },
              ])
            },
          },
        ])
      }
    } finally {
      setClosing(false)
    }
  }

  /* Permission camera / Camera permission */
  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Acces camera requis pour scanner les supports</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Camera 1D barcode — visible tant que scanning=true */}
      {scanning ? (
        <View style={styles.cameraSection}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13', 'ean8', 'code128', 'code39', 'code93',
                'itf14', 'upc_a', 'upc_e', 'codabar',
                'datamatrix', 'pdf417', 'aztec', 'qr',
              ],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanLine} />
            {lastScanned ? (
              <Text style={styles.scanSuccess}>{lastScanned}</Text>
            ) : (
              <Text style={styles.scanHint}>Pointez un code barre</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.cameraDone}>
          <Text style={styles.cameraDoneText}>Scan termine</Text>
        </View>
      )}

      {/* Zone saisie "fin" ou bouton cloture — en haut sous la camera */}
      <View style={styles.actionBar}>
        {showClose ? (
          <TouchableOpacity
            style={[styles.closeBtn, closing && { opacity: 0.5 }]}
            onPress={handleClose}
            disabled={closing}
          >
            <Text style={styles.closeBtnText}>
              {closing ? 'Cloture en cours...' : 'Cloturer et partir'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.finRow}>
            <TextInput
              style={styles.finInput}
              placeholder='Tapez "fin" pour terminer'
              placeholderTextColor={COLORS.textMuted}
              value={finText}
              onChangeText={setFinText}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleFinSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.finBtn} onPress={handleFinSubmit}>
              <Text style={styles.finBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Liste supports scannes / Scanned supports list */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>
          {scans.length > 0 ? `${scans.length} support(s) scanne(s)` : 'Scannez les supports...'}
          {scanCount > 0 ? ` [detectes: ${scanCount}]` : ''}
        </Text>

        <FlatList
          data={scans}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item, index }) => (
            <View style={[styles.scanRow, {
              borderLeftWidth: 4,
              borderLeftColor: item.expected_at_stop ? COLORS.success : COLORS.danger,
            }]}>
              <Text style={styles.scanIndex}>{scans.length - index}</Text>
              <Text style={styles.scanBarcode}>{item.barcode}</Text>
              {!item.expected_at_stop && (
                <Text style={{ color: COLORS.danger, fontSize: 10, fontWeight: '700', marginRight: 6 }}>
                  {'\u2260'} {item.expected_pdv_code || '?'}
                </Text>
              )}
              <Text style={styles.scanTime}>
                {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
          )}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>En attente de scan...</Text>
          }
        />
      </View>
    </KeyboardAvoidingView>
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
  /* Camera section */
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
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraDoneText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  /* List section */
  listSection: {
    flex: 1,
    padding: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  list: {
    flex: 1,
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
  scanBarcode: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scanTime: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 30,
  },
  /* Action bar (sous la camera) / Action bar (below camera) */
  actionBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgSecondary,
  },
  finRow: {
    flexDirection: 'row',
    gap: 8,
  },
  finInput: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  finBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  closeBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
})
