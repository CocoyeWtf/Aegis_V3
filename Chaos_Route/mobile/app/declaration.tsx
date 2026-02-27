/* Ecran declaration (anomalie, casse, accident) / Declaration screen */

import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Image, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import api from '../services/api'
import { COLORS } from '../constants/config'
import type { DeclarationType } from '../types'

const DECLARATION_TYPES: { value: DeclarationType; label: string }[] = [
  { value: 'ANOMALY', label: 'Anomalie' },
  { value: 'BREAKAGE', label: 'Casse' },
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'VEHICLE_ISSUE', label: 'Probleme vehicule' },
  { value: 'CLIENT_ISSUE', label: 'Probleme client' },
  { value: 'OTHER', label: 'Autre' },
]

interface PhotoItem {
  uri: string
  fileName?: string
  mimeType?: string
}

export default function DeclarationScreen() {
  const { tourId, tourStopId, driverName } = useLocalSearchParams<{
    tourId?: string
    tourStopId?: string
    driverName?: string
  }>()
  const router = useRouter()

  const [type, setType] = useState<DeclarationType>('ANOMALY')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Recuperer position GPS auto / Auto-get GPS location
  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        })
      } catch (e) {
        console.warn('GPS location failed for declaration:', e)
      }
    })()
  }, [])

  const handleTakePhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limite atteinte', 'Maximum 5 photos par declaration')
      return
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez la camera pour prendre des photos')
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
      }])
    }
  }

  const handlePickPhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limite atteinte', 'Maximum 5 photos par declaration')
      return
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez la galerie pour choisir des photos')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
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
      }])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Description requise', 'Veuillez decrire la situation')
      return
    }

    setSubmitting(true)
    try {
      // 1. Creer la declaration / Create declaration
      const { data: declaration } = await api.post('/declarations/driver', {
        tour_id: tourId ? Number(tourId) : null,
        tour_stop_id: tourStopId ? Number(tourStopId) : null,
        declaration_type: type,
        description: description.trim(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy: location?.accuracy ?? null,
        driver_name: driverName || null,
        created_at: new Date().toISOString(),
      })

      // 2. Uploader les photos / Upload photos
      for (const photo of photos) {
        const formData = new FormData()
        formData.append('file', {
          uri: photo.uri,
          name: photo.fileName || 'photo.jpg',
          type: photo.mimeType || 'image/jpeg',
        } as unknown as Blob)

        await api.post(`/declarations/driver/${declaration.id}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        })
      }

      Alert.alert('Declaration enregistree', 'Votre declaration a ete enregistree avec succes.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      console.error('Failed to submit declaration', e)
      Alert.alert('Erreur', 'Impossible d\'enregistrer la declaration. Reessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nouvelle declaration</Text>

      {/* Selecteur type / Type selector */}
      <Text style={styles.label}>Type de declaration</Text>
      <View style={styles.typeGrid}>
        {DECLARATION_TYPES.map((dt) => (
          <TouchableOpacity
            key={dt.value}
            onPress={() => setType(dt.value)}
            style={[styles.typeBtn, type === dt.value && styles.typeBtnActive]}
          >
            <Text style={[styles.typeBtnText, type === dt.value && styles.typeBtnTextActive]}>
              {dt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="Decrivez la situation..."
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Photos */}
      <Text style={styles.label}>Photos ({photos.length}/5)</Text>
      <View style={styles.photoRow}>
        {photos.map((photo, i) => (
          <TouchableOpacity key={i} onPress={() => removePhoto(i)} style={styles.photoThumb}>
            <Image source={{ uri: photo.uri }} style={styles.photoImg} />
            <View style={styles.photoRemove}>
              <Text style={styles.photoRemoveText}>X</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.photoBtns}>
        <TouchableOpacity onPress={handleTakePhoto} style={styles.photoBtn} disabled={photos.length >= 5}>
          <Text style={styles.photoBtnText}>Prendre photo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickPhoto} style={styles.photoBtnAlt} disabled={photos.length >= 5}>
          <Text style={styles.photoBtnAltText}>Galerie</Text>
        </TouchableOpacity>
      </View>

      {/* GPS */}
      <View style={styles.gpsRow}>
        <Text style={styles.gpsLabel}>GPS:</Text>
        {location ? (
          <Text style={styles.gpsValue}>
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            {location.accuracy ? ` (~${Math.round(location.accuracy)}m)` : ''}
          </Text>
        ) : (
          <Text style={styles.gpsWaiting}>Acquisition en cours...</Text>
        )}
      </View>

      {/* Contexte tour / Tour context */}
      {tourId && (
        <Text style={styles.contextInfo}>Tour #{tourId}{tourStopId ? ` / Stop #${tourStopId}` : ''}</Text>
      )}

      {/* Bouton envoyer / Submit button */}
      <TouchableOpacity
        onPress={handleSubmit}
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.submitBtnText}>Envoyer la declaration</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgSecondary,
  },
  typeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '22',
  },
  typeBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: COLORS.primary,
  },
  textArea: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    minHeight: 100,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  photoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  photoBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  photoBtnAlt: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  photoBtnAltText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.bgSecondary,
  },
  gpsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  gpsValue: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  gpsWaiting: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  contextInfo: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
})
