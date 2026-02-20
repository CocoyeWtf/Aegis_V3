/* Liste tours du jour + affectation par QR / Daily tour list + QR assignment */

import { useState, useCallback } from 'react'
import {
  View, FlatList, Text, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, ActivityIndicator,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter, useFocusEffect } from 'expo-router'
import api from '../../services/api'
import { TourCard } from '../../components/TourCard'
import { COLORS } from '../../constants/config'
import type { DriverTour } from '../../types'

export default function TourListScreen() {
  const router = useRouter()
  const [tours, setTours] = useState<DriverTour[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const date = new Date().toISOString().slice(0, 10)

  const loadTours = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<DriverTour[]>('/driver/my-tours', { params: { date } })
      setTours(data)
    } catch (e) {
      console.error('Failed to load tours', e)
    } finally {
      setLoading(false)
    }
  }, [date])

  // Recharger a chaque focus / Reload on focus
  useFocusEffect(
    useCallback(() => {
      loadTours()
    }, [loadTours])
  )

  /* Scanner QR affectation / Scan QR for assignment */
  const handleQrScanned = useCallback(({ data: qrData }: { data: string }) => {
    if (assigning) return

    // Format attendu : "TOUR:123" / Expected format: "TOUR:123"
    const match = qrData.match(/^TOUR:(\d+)$/)
    if (!match) return

    const tourId = Number(match[1])
    setAssigning(true)

    api.post('/driver/assign-tour', { tour_id: tourId })
      .then(() => {
        Alert.alert('Tour affecte', 'Le tour a ete affecte a ce telephone.', [
          { text: 'OK', onPress: () => loadTours() },
        ])
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
        Alert.alert('Erreur', msg)
      })
      .finally(() => {
        setAssigning(false)
      })
  }, [assigning, loadTours])

  // Tours actifs (non termines) / Active (non-completed) tours
  const activeTours = tours.filter((t) => t.status !== 'COMPLETED')
  const hasOnlyCompleted = tours.length > 0 && activeTours.length === 0

  // Mode affectation : pas de tour actif → scanner QR / Assignment mode: no active tour → QR scanner
  if (!loading && (tours.length === 0 || hasOnlyCompleted)) {
    return (
      <View style={styles.container}>
        <View style={styles.assignHeader}>
          <Text style={styles.assignTitle}>Affecter un tour</Text>
          <Text style={styles.assignSubtitle}>
            {hasOnlyCompleted
              ? `${tours.length} tour(s) termine(s) · ${date}`
              : `Date: ${date}`}
          </Text>
        </View>

        {/* Scanner QR / QR Scanner */}
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permText}>Acces camera requis pour scanner le QR du tour</Text>
            <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Autoriser la camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scanSection}>
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
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={handleQrScanned}
                />
              )}
              <View style={styles.cameraOverlay}>
                <View style={styles.qrFrame} />
                <Text style={styles.scanHint}>
                  Scannez le QR affiche sur l'ecran postier
                </Text>
              </View>
            </View>

            {/* Bouton rafraichir / Refresh button */}
            <TouchableOpacity onPress={loadTours} style={styles.refreshBtn}>
              <Text style={styles.refreshBtnText}>Rafraichir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  // Mode normal : tours assignes / Normal mode: assigned tours
  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <Text style={styles.dateLabel}>Date: {date}</Text>
      </View>

      <FlatList
        data={activeTours}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TourCard
            tour={item}
            onPress={() => router.push(`/tour/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadTours} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? 'Chargement...' : 'Aucun tour pour cette date'}
            </Text>
          </View>
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
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  /* Ecran affectation / Assignment screen */
  assignHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgSecondary,
  },
  assignTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  assignSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  scanSection: {
    flex: 1,
    padding: 14,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
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
  permText: {
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
  refreshBtn: {
    marginTop: 12,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
})
