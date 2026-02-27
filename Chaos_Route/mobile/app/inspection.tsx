/* Ecran inspection vehicule / Vehicle inspection screen */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Image, ActivityIndicator, TextInput,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import api from '../services/api'
import { COLORS } from '../constants/config'
import type { InspectionStartResponse, InspectionStartItem, InspectionItemResult } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  EXTERIOR: 'Exterieur',
  CABIN: 'Cabine',
  ENGINE: 'Moteur',
  BRAKES: 'Freins',
  TIRES: 'Pneus',
  LIGHTS: 'Eclairage',
  CARGO: 'Cargo',
  REFRIGERATION: 'Froid',
  SAFETY: 'Securite',
  DOCUMENTS: 'Documents',
}

const RESULT_COLORS: Record<string, string> = {
  OK: COLORS.success,
  KO: COLORS.danger,
  NA: COLORS.textMuted,
  NOT_CHECKED: COLORS.border,
}

interface PhotoItem {
  uri: string
  fileName?: string
  mimeType?: string
  itemId?: number
}

interface ItemState {
  result: InspectionItemResult
  comment: string
}

export default function InspectionScreen() {
  const { tourId, vehicleId, vehicleCode, driverName, inspectionType } = useLocalSearchParams<{
    tourId?: string
    vehicleId: string
    vehicleCode?: string
    driverName?: string
    inspectionType?: string
  }>()
  const router = useRouter()

  const [inspectionId, setInspectionId] = useState<number | null>(null)
  const [items, setItems] = useState<InspectionStartItem[]>([])
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({})
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [km, setKm] = useState('')
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  /* Recuperer GPS / Get GPS location */
  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      } catch (e) {
        console.warn('GPS failed for inspection:', e)
      }
    })()
  }, [])

  /* Demarrer inspection via API / Start inspection via API */
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.post<InspectionStartResponse>('/inspections/driver/start', {
          vehicle_id: Number(vehicleId),
          tour_id: tourId ? Number(tourId) : null,
          inspection_type: inspectionType || 'PRE_DEPARTURE',
          driver_name: driverName || null,
          km_at_inspection: km ? Number(km) : null,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
        })
        setInspectionId(data.inspection_id)
        setItems(data.items)
        /* Initialiser les etats items / Initialize item states */
        const states: Record<number, ItemState> = {}
        for (const item of data.items) {
          states[item.id] = { result: 'NOT_CHECKED', comment: '' }
        }
        setItemStates(states)
      } catch (e) {
        console.error('Failed to start inspection', e)
        Alert.alert('Erreur', 'Impossible de demarrer l\'inspection')
      } finally {
        setLoading(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateItemResult = (itemId: number, result: InspectionItemResult) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], result },
    }))
  }

  const updateItemComment = (itemId: number, comment: string) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment },
    }))
  }

  /* Photo / Photo handling */
  const handleTakePhoto = async (itemId?: number) => {
    if (photos.length >= 20) {
      Alert.alert('Limite', 'Maximum 20 photos par inspection')
      return
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez la camera')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setPhotos((prev) => [...prev, {
        uri: asset.uri,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        itemId,
      }])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  /* Stats / Statistics */
  const checkedCount = Object.values(itemStates).filter((s) => s.result !== 'NOT_CHECKED').length
  const totalCount = items.length
  const hasUncheckedCritical = items.some(
    (item) => item.is_critical && itemStates[item.id]?.result === 'NOT_CHECKED'
  )
  const hasCriticalKOWithoutPhoto = items.some(
    (item) => item.is_critical && itemStates[item.id]?.result === 'KO' &&
    item.requires_photo && !photos.some((p) => p.itemId === item.id)
  )

  /* Soumettre / Submit inspection */
  const handleSubmit = async () => {
    if (hasUncheckedCritical) {
      Alert.alert('Points critiques', 'Tous les points critiques doivent etre verifies')
      return
    }
    if (hasCriticalKOWithoutPhoto) {
      Alert.alert('Photo requise', 'Une photo est requise pour les points critiques KO')
      return
    }

    setSubmitting(true)
    try {
      /* 1. Soumettre resultats items / Submit item results */
      const itemsPayload = Object.entries(itemStates).map(([id, state]) => ({
        item_id: Number(id),
        result: state.result,
        comment: state.comment || null,
      }))
      await api.put(`/inspections/driver/${inspectionId}/items`, { items: itemsPayload })

      /* 2. Uploader photos / Upload photos */
      for (const photo of photos) {
        const formData = new FormData()
        formData.append('file', {
          uri: photo.uri,
          name: photo.fileName || 'photo.jpg',
          type: photo.mimeType || 'image/jpeg',
        } as unknown as Blob)
        if (photo.itemId) {
          formData.append('item_id', String(photo.itemId))
        }
        await api.post(`/inspections/driver/${inspectionId}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        })
      }

      /* 3. Finaliser / Complete */
      await api.post(`/inspections/driver/${inspectionId}/complete`, {
        remarks: remarks || null,
        km_at_inspection: km ? Number(km) : null,
      })

      Alert.alert('Inspection terminee', 'L\'inspection a ete enregistree avec succes.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      console.error('Failed to submit inspection', e)
      Alert.alert('Erreur', 'Impossible de terminer l\'inspection. Reessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement de l'inspection...</Text>
      </View>
    )
  }

  /* Grouper items par categorie / Group items by category */
  const categories = new Map<string, InspectionStartItem[]>()
  for (const item of items) {
    const cat = item.category || 'AUTRE'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(item)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inspection {vehicleCode || `#${vehicleId}`}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{checkedCount}/{totalCount} verifies</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : '0%' }]} />
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Km */}
        <View style={styles.kmRow}>
          <Text style={styles.label}>Kilometrage actuel</Text>
          <TextInput
            style={styles.kmInput}
            value={km}
            onChangeText={setKm}
            placeholder="Km..."
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
          />
        </View>

        {/* Items par categorie / Items by category */}
        {Array.from(categories.entries()).map(([cat, catItems]) => (
          <View key={cat} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{CATEGORY_LABELS[cat] || cat}</Text>
            {catItems.map((item) => {
              const state = itemStates[item.id] || { result: 'NOT_CHECKED', comment: '' }
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemLabelRow}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      {item.is_critical && <Text style={styles.criticalBadge}>CRITIQUE</Text>}
                    </View>
                    <View style={styles.resultBtns}>
                      {(['OK', 'KO', 'NA'] as InspectionItemResult[]).map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => updateItemResult(item.id, r)}
                          style={[
                            styles.resultBtn,
                            state.result === r && { backgroundColor: RESULT_COLORS[r] + '33', borderColor: RESULT_COLORS[r] },
                          ]}
                        >
                          <Text style={[
                            styles.resultBtnText,
                            state.result === r && { color: RESULT_COLORS[r], fontWeight: '700' },
                          ]}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Commentaire si KO / Comment if KO */}
                  {state.result === 'KO' && (
                    <TextInput
                      style={styles.commentInput}
                      value={state.comment}
                      onChangeText={(text) => updateItemComment(item.id, text)}
                      placeholder="Commentaire..."
                      placeholderTextColor={COLORS.textMuted}
                    />
                  )}

                  {/* Photo si KO critique / Photo if critical KO */}
                  {state.result === 'KO' && item.is_critical && (
                    <View style={styles.photoSection}>
                      <View style={styles.photoRow}>
                        {photos.filter((p) => p.itemId === item.id).map((p, i) => (
                          <TouchableOpacity key={i} onPress={() => removePhoto(photos.indexOf(p))} style={styles.photoThumb}>
                            <Image source={{ uri: p.uri }} style={styles.photoImg} />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity onPress={() => handleTakePhoto(item.id)} style={styles.addPhotoBtn}>
                        <Text style={styles.addPhotoBtnText}>+ Photo</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}

        {/* Photos generales / General photos */}
        <View style={styles.generalPhotos}>
          <Text style={styles.label}>Photos generales ({photos.filter((p) => !p.itemId).length})</Text>
          <View style={styles.photoRow}>
            {photos.filter((p) => !p.itemId).map((p, i) => (
              <TouchableOpacity key={i} onPress={() => removePhoto(photos.indexOf(p))} style={styles.photoThumb}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => handleTakePhoto()} style={styles.addPhotoBtn}>
            <Text style={styles.addPhotoBtnText}>+ Photo generale</Text>
          </TouchableOpacity>
        </View>

        {/* Remarques / Remarks */}
        <Text style={styles.label}>Remarques</Text>
        <TextInput
          style={styles.remarksInput}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Remarques generales..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* GPS */}
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>GPS:</Text>
          {location ? (
            <Text style={styles.gpsValue}>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.gpsWaiting}>En cours...</Text>
          )}
        </View>

        {/* Bouton terminer / Complete button */}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>Terminer l'inspection</Text>
          )}
        </TouchableOpacity>

        {/* Avertissements / Warnings */}
        {hasUncheckedCritical && (
          <Text style={styles.warning}>Des points critiques n'ont pas ete verifies</Text>
        )}
        {hasCriticalKOWithoutPhoto && (
          <Text style={styles.warning}>Photo requise pour les points critiques KO</Text>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary },
  loadingText: { color: COLORS.textMuted, marginTop: 12, fontSize: 14 },
  header: {
    backgroundColor: COLORS.bgSecondary,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, width: 80 },
  progressBg: { flex: 1, height: 6, backgroundColor: COLORS.bgTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: COLORS.success, borderRadius: 3 },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 40 },
  kmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  kmInput: {
    flex: 1, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: COLORS.textPrimary, fontSize: 14,
  },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 4 },
  categorySection: { marginBottom: 16 },
  categoryTitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.primary,
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: 6,
    backgroundColor: COLORS.primary + '15', borderRadius: 6,
  },
  itemCard: {
    backgroundColor: COLORS.bgSecondary, borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemLabelRow: { flex: 1, marginRight: 8 },
  itemLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  criticalBadge: {
    fontSize: 9, fontWeight: '700', color: COLORS.danger,
    backgroundColor: COLORS.danger + '22', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginTop: 3, alignSelf: 'flex-start',
  },
  resultBtns: { flexDirection: 'row', gap: 4 },
  resultBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgTertiary,
  },
  resultBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  commentInput: {
    marginTop: 8, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, color: COLORS.textPrimary, fontSize: 12,
  },
  photoSection: { marginTop: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  photoThumb: { width: 56, height: 56, borderRadius: 6, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  addPhotoBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.primary, alignSelf: 'flex-start',
  },
  addPhotoBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  generalPhotos: { marginTop: 12, marginBottom: 12 },
  remarksInput: {
    backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, color: COLORS.textPrimary, fontSize: 14, minHeight: 70,
  },
  gpsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: COLORS.bgSecondary,
  },
  gpsLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  gpsValue: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  gpsWaiting: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  submitBtn: {
    marginTop: 20, paddingVertical: 16, borderRadius: 12,
    backgroundColor: COLORS.success, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  warning: {
    textAlign: 'center', fontSize: 12, color: COLORS.danger,
    fontWeight: '600', marginTop: 8,
  },
})
