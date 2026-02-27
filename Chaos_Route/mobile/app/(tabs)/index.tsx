/* Liste tours du jour + affectation / Daily tour list + assignment
   Deux modes :
   - Liste : tours assignes + tours disponibles (auto-affectation par tap)
   - Scanner QR : optionnel, accessible via bouton
*/

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, FlatList, Text, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, ActivityIndicator, Vibration,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter, useFocusEffect } from 'expo-router'
import api from '../../services/api'
import { TourCard } from '../../components/TourCard'
import { COLORS } from '../../constants/config'
import { TorchToggleButton } from '../../components/TorchToggleButton'
import type { DriverTour, AvailableTour } from '../../types'

export default function TourListScreen() {
  const router = useRouter()
  const [tours, setTours] = useState<DriverTour[]>([])
  const [availableTours, setAvailableTours] = useState<AvailableTour[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const scannedRef = useRef(false)
  const date = new Date().toISOString().slice(0, 10)

  const loadTours = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<DriverTour[]>('/driver/my-tours', { params: { date } })
      setTours(data)
      prevTourIdsRef.current = data.map((t) => t.id).sort().join(',')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (e as { message?: string })?.message || 'Erreur chargement tours'
      console.error('Failed to load tours', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [date])

  const loadAvailable = useCallback(async () => {
    try {
      const { data } = await api.get<AvailableTour[]>('/driver/available-tours', { params: { date } })
      setAvailableTours(data)
    } catch {
      // Silencieux — pas critique
    }
  }, [date])

  // Recharger a chaque focus / Reload on focus
  useFocusEffect(
    useCallback(() => {
      loadTours()
      loadAvailable()
    }, [loadTours, loadAvailable])
  )

  // Polling 30s quand aucun tour actif — detecter affectation distante / Poll when no active tour
  const prevTourIdsRef = useRef<string>('')
  useEffect(() => {
    if (tours.some((t) => t.status === 'IN_PROGRESS' || t.status === 'VALIDATED')) return
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get<DriverTour[]>('/driver/my-tours', { params: { date } })
        const newIds = data.map((t) => t.id).sort().join(',')
        if (newIds && newIds !== prevTourIdsRef.current && prevTourIdsRef.current !== '') {
          // Nouveau tour detecte / New tour detected
          const newTour = data.find((t) => !prevTourIdsRef.current.includes(String(t.id)))
          Vibration.vibrate([0, 200, 100, 200])
          Alert.alert('Nouveau tour assigne', newTour ? `${newTour.code} — ${newTour.stops.length} arrets` : 'Un tour a ete assigne')
          setTours(data)
          loadAvailable()
        }
        prevTourIdsRef.current = newIds || prevTourIdsRef.current
        if (!prevTourIdsRef.current) {
          prevTourIdsRef.current = data.map((t) => t.id).sort().join(',')
        }
      } catch {}
    }, 30_000)
    return () => clearInterval(interval)
  }, [tours, date, loadAvailable])

  /* Affecter un tour (depuis liste ou QR) / Assign tour (from list or QR) */
  const doAssign = useCallback(async (tourId: number) => {
    if (assigning) return
    setAssigning(true)
    try {
      const { data: assigned } = await api.post('/driver/assign-tour', { tour_id: tourId })
      await loadTours()
      await loadAvailable()
      setShowScanner(false)
      scannedRef.current = false
      Alert.alert('Tour affecte', `${assigned.code} — ${assigned.stops?.length ?? 0} arrets`, [
        { text: 'OK' },
      ])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur affectation'
      Alert.alert('Erreur', msg, [
        { text: 'OK', onPress: () => { scannedRef.current = false } },
      ])
    } finally {
      setAssigning(false)
    }
  }, [assigning, loadTours, loadAvailable])

  /* Scanner QR affectation / Scan QR for assignment */
  const handleQrScanned = useCallback(({ data: qrData }: { data: string }) => {
    if (scannedRef.current || assigning) return
    scannedRef.current = true

    // Format attendu : "TOUR:123" / Expected format: "TOUR:123"
    const match = qrData.match(/^TOUR:(\d+)$/)
    if (!match) {
      Alert.alert('QR invalide', 'Format attendu: TOUR:xxx', [
        { text: 'Re-scanner', onPress: () => { scannedRef.current = false } },
        { text: 'Fermer', onPress: () => { setShowScanner(false); scannedRef.current = false; setTorchOn(false) } },
      ])
      return
    }

    doAssign(Number(match[1]))
  }, [assigning, doAssign])

  /* Affecter depuis la liste (sans confirmation) / Assign from available list (no confirmation) */
  const handleTapAssign = useCallback((tour: AvailableTour) => {
    doAssign(tour.id)
  }, [doAssign])

  // Tours actifs (non termines) / Active (non-completed) tours
  const activeTours = tours.filter((t) => t.status !== 'COMPLETED')
  const completedTours = tours.filter((t) => t.status === 'COMPLETED')

  /* Mode scanner QR plein ecran / Full-screen QR scanner mode */
  if (showScanner) {
    if (!permission) {
      return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
    }
    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.permText}>Acces camera requis pour scanner le QR du tour</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowScanner(false); scannedRef.current = false; setTorchOn(false) }} style={{ marginTop: 16 }}>
            <Text style={styles.linkText}>Retour</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View style={styles.scanContainer}>
        <View style={styles.cameraWrapper}>
          {assigning ? (
            <View style={styles.assigningOverlay}>
              <ActivityIndicator color={COLORS.white} size="large" />
              <Text style={styles.assigningText}>Affectation en cours...</Text>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleQrScanned}
            />
          )}
          <TorchToggleButton enabled={torchOn} onToggle={() => setTorchOn((v) => !v)} />
          <View style={styles.cameraOverlay}>
            <View style={styles.qrFrame} />
            <Text style={styles.scanHint}>
              Scannez le QR du tour
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => { setShowScanner(false); scannedRef.current = false; setTorchOn(false) }}
          style={styles.closeScannerBtn}
        >
          <Text style={styles.closeScannerText}>Fermer le scanner</Text>
        </TouchableOpacity>
      </View>
    )
  }

  /* Mode normal : liste tours / Normal mode: tour list */
  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <Text style={styles.dateLabel}>{date}</Text>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={() => null}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { loadTours(); loadAvailable() }}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* Erreur / Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={loadTours}>
                  <Text style={styles.retryText}>Reessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Section tours actifs / Active tours section */}
            {activeTours.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mes tours</Text>
                {activeTours.map((tour) => (
                  <TourCard
                    key={tour.id}
                    tour={tour}
                    onPress={() => router.push(`/tour/${tour.id}`)}
                  />
                ))}
              </View>
            )}

            {/* Section tours termines / Completed tours section */}
            {completedTours.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: COLORS.success }]}>
                  Termines ({completedTours.length})
                </Text>
                {completedTours.map((tour) => (
                  <TourCard
                    key={tour.id}
                    tour={tour}
                    onPress={() => router.push(`/tour/${tour.id}`)}
                  />
                ))}
              </View>
            )}

            {/* Section tours disponibles / Available tours section */}
            {availableTours.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tours disponibles</Text>
                <Text style={styles.sectionHint}>Appuyez pour affecter a cet appareil</Text>
                {availableTours.map((tour) => (
                  <TouchableOpacity
                    key={tour.id}
                    style={styles.availableCard}
                    onPress={() => handleTapAssign(tour)}
                    activeOpacity={0.7}
                    disabled={assigning}
                  >
                    <View style={styles.availableHeader}>
                      <Text style={styles.availableCode}>{tour.code}</Text>
                      {tour.departure_time && (
                        <Text style={styles.availableTime}>Dep. {tour.departure_time}</Text>
                      )}
                    </View>
                    <View style={styles.availableRow}>
                      <Text style={styles.availableLabel}>
                        {tour.stops_count} arrets · {tour.total_eqp || 0} EQC
                      </Text>
                      {tour.vehicle_code && (
                        <Text style={styles.availableLabel}>{tour.vehicle_code}</Text>
                      )}
                    </View>
                    {tour.driver_name && (
                      <Text style={styles.availableDriver}>{tour.driver_name}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Message vide / Empty message */}
            {!loading && activeTours.length === 0 && availableTours.length === 0 && completedTours.length === 0 && !error && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Aucun tour pour cette date</Text>
                <Text style={styles.emptyHint}>
                  Tirez vers le bas pour rafraichir{'\n'}
                  ou scannez un QR avec le bouton ci-dessous
                </Text>
              </View>
            )}
          </>
        }
      />

      {/* Bouton scanner QR / QR scanner button */}
      <TouchableOpacity
        style={styles.qrButton}
        onPress={() => { scannedRef.current = false; setShowScanner(true) }}
      >
        <Text style={styles.qrButtonText}>Scanner QR tour</Text>
      </TouchableOpacity>

      {/* Overlay affectation en cours / Assigning overlay */}
      {assigning && (
        <View style={styles.assigningFullOverlay}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.assigningFullText}>Affectation en cours...</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  list: {
    padding: 14,
    paddingBottom: 80,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
    padding: 20,
  },

  /* Sections */
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },

  /* Tours disponibles / Available tours */
  availableCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  availableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  availableCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  availableTime: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  availableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  availableLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  availableDriver: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* Vide / Empty */
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  /* Erreur / Error */
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  /* Bouton QR flottant / Floating QR button */
  qrButton: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    right: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  qrButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  /* Scanner plein ecran / Full-screen scanner */
  scanContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 16,
    opacity: 0.7,
  },
  scanHint: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  closeScannerBtn: {
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeScannerText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  assigningOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  assigningText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },

  /* Overlay affectation liste / List assignment overlay */
  assigningFullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigningFullText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },

  /* Permissions */
  permText: {
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
})
