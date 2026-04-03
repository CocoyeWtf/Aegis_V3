/* Modal capture photo pour mode controle / Control mode photo capture modal.
   Affiche la camera en mode photo (pas barcode) avec un bouton de capture.
   Retourne l'URI de la photo au parent.
*/

import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, Image,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { COLORS } from '../constants/config'

interface ControlPhotoCaptureProps {
  instruction?: string
  onCapture: (photoUri: string) => void
  onCancel: () => void
}

export function ControlPhotoCapture({ instruction, onCapture, onCancel }: ControlPhotoCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [capturing, setCapturing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      })
      if (photo?.uri) {
        setPreview(photo.uri)
      }
    } catch {
      // silently fail
    } finally {
      setCapturing(false)
    }
  }, [capturing])

  const handleConfirm = useCallback(() => {
    if (preview) onCapture(preview)
  }, [preview, onCapture])

  const handleRetake = useCallback(() => {
    setPreview(null)
  }, [])

  if (!permission) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} /></SafeAreaView>
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.text}>Acces camera requis pour le controle</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // Mode apercu photo / Photo preview mode
  if (preview) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verifier la photo</Text>
        </View>
        <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" />
        <View style={styles.previewActions}>
          <TouchableOpacity onPress={handleRetake} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Reprendre</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirm} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Mode capture / Capture mode
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo controle</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.instructionBar}>
        <Text style={styles.instructionText}>
          {instruction || 'Prenez une photo de ce que vous reprenez'}
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        />
      </View>

      <View style={styles.captureBar}>
        {capturing ? (
          <ActivityIndicator color={COLORS.primary} size="large" />
        ) : (
          <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary, padding: 32 },
  text: { color: COLORS.textPrimary, fontSize: 15, textAlign: 'center', marginBottom: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  cancelBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  instructionBar: {
    backgroundColor: '#f59e0b18', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f59e0b44',
  },
  instructionText: { color: '#f59e0b', fontWeight: '700', fontSize: 13, textAlign: 'center' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  captureBar: {
    paddingVertical: 20, alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
  },

  previewImage: { flex: 1, backgroundColor: '#000' },
  previewActions: {
    flexDirection: 'row', gap: 12,
    paddingVertical: 16, paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: { backgroundColor: COLORS.bgTertiary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  secondaryBtnText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 15 },
})
