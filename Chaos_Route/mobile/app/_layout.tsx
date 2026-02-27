/* Layout racine — Device gate + auto-update + mode kiosque / Root layout */

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, Modal, TouchableOpacity, ActivityIndicator,
  StyleSheet, BackHandler, TextInput, Alert, Platform,
} from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useDeviceStore } from '../stores/useDeviceStore'
import { COLORS } from '../constants/config'
import { checkForUpdate, downloadAndInstallApk } from '../services/updateChecker'
import { verifyKioskPassword } from '../services/kioskMode'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { isRegistered, isLoading, loadDevice } = useDeviceStore()

  // Auto-update state
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Kiosk mode state
  const [kioskExitAllowed, setKioskExitAllowed] = useState(false)
  const [showKioskModal, setShowKioskModal] = useState(false)
  const [kioskPassword, setKioskPassword] = useState('')
  const [kioskChecking, setKioskChecking] = useState(false)
  const [kioskError, setKioskError] = useState('')
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadDevice()
  }, [loadDevice])

  // Verification mise a jour au lancement / Check for update on launch
  useEffect(() => {
    ;(async () => {
      const { updateAvailable: hasUpdate, versionInfo } = await checkForUpdate()
      if (hasUpdate && versionInfo?.download_url) {
        setUpdateAvailable(true)
        setUpdateVersion(versionInfo.version)
        setDownloadUrl(versionInfo.download_url)
      }
    })()
  }, [])

  // Mode kiosque — bloquer bouton retour Android / Kiosk mode — block Android back button
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const handler = () => {
      if (kioskExitAllowed) return false // Laisser le systeme gerer
      return true // Bloquer la sortie
    }
    BackHandler.addEventListener('hardwareBackPress', handler)
    return () => BackHandler.removeEventListener('hardwareBackPress', handler)
  }, [kioskExitAllowed])

  useEffect(() => {
    if (isLoading) return
    const inRegister = segments[0] === 'register'
    if (!isRegistered && !inRegister) {
      router.replace('/register')
    } else if (isRegistered && inRegister) {
      router.replace('/(tabs)')
    }
  }, [isRegistered, isLoading, segments, router])

  const handleUpdate = async () => {
    setDownloading(true)
    try {
      await downloadAndInstallApk(downloadUrl)
    } catch (e) {
      console.error('Update download failed:', e)
      setDownloading(false)
    }
  }

  // Triple-tap pour ouvrir la modale kiosque / Triple-tap to open kiosk modal
  const handleKioskTap = useCallback(() => {
    tapCountRef.current++
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      setKioskPassword('')
      setKioskError('')
      setShowKioskModal(true)
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0
      }, 1000)
    }
  }, [])

  // Verifier mot de passe kiosque / Verify kiosk password
  const handleKioskSubmit = async () => {
    if (!kioskPassword.trim()) return
    setKioskChecking(true)
    setKioskError('')
    const valid = await verifyKioskPassword(kioskPassword)
    setKioskChecking(false)
    if (valid) {
      setKioskExitAllowed(true)
      setShowKioskModal(false)
      Alert.alert('Mode kiosque desactive', 'Vous pouvez maintenant quitter l\'application.')
      // Re-activer apres 60 secondes / Re-enable after 60 seconds
      setTimeout(() => setKioskExitAllowed(false), 60_000)
    } else {
      setKioskError('Mot de passe incorrect')
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.primary, fontSize: 20, fontWeight: 'bold' }}>Chargement...</Text>
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />

      {/* Modal bloquant mise a jour / Blocking update modal */}
      <Modal visible={updateAvailable} animationType="fade" transparent>
        <View style={updateStyles.overlay}>
          <View style={updateStyles.card}>
            <Text style={updateStyles.title}>Mise a jour obligatoire</Text>
            <Text style={updateStyles.version}>Version {updateVersion} disponible</Text>
            <Text style={updateStyles.desc}>
              Une nouvelle version de CMRO Driver est disponible. Vous devez mettre a jour pour continuer.
            </Text>
            {downloading ? (
              <View style={updateStyles.progressRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={updateStyles.progressText}>Telechargement en cours...</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleUpdate} style={updateStyles.btn}>
                <Text style={updateStyles.btnText}>Mettre a jour</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal mot de passe kiosque / Kiosk password modal */}
      <Modal visible={showKioskModal} animationType="fade" transparent>
        <View style={kioskStyles.overlay}>
          <View style={kioskStyles.card}>
            <Text style={kioskStyles.title}>Mode kiosque</Text>
            <Text style={kioskStyles.desc}>Entrez le mot de passe administrateur pour quitter l'application.</Text>
            <TextInput
              style={kioskStyles.input}
              value={kioskPassword}
              onChangeText={setKioskPassword}
              placeholder="Mot de passe"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoFocus
            />
            {kioskError ? <Text style={kioskStyles.error}>{kioskError}</Text> : null}
            <View style={kioskStyles.btnRow}>
              <TouchableOpacity
                onPress={() => setShowKioskModal(false)}
                style={kioskStyles.cancelBtn}
              >
                <Text style={kioskStyles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleKioskSubmit}
                style={kioskStyles.submitBtn}
                disabled={kioskChecking}
              >
                {kioskChecking ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={kioskStyles.submitBtnText}>Valider</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bgPrimary },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: COLORS.bgPrimary },
          // Zone cachee triple-tap dans le header / Hidden triple-tap zone in header
          headerRight: () => (
            <TouchableOpacity
              onPress={handleKioskTap}
              activeOpacity={1}
              style={{ width: 44, height: 44 }}
            />
          ),
        }}
      >
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tour/[id]" options={{ title: 'Detail tour' }} />
        <Stack.Screen name="tour/[id]/stop/[stopId]/scan" options={{ title: 'Scanner PDV', presentation: 'modal' }} />
        <Stack.Screen name="tour/[id]/stop/[stopId]/supports" options={{ title: 'Scan supports' }} />
        <Stack.Screen name="tour/[id]/stop/[stopId]/pickups" options={{ title: 'Scanner reprises' }} />
        <Stack.Screen name="declaration" options={{ title: 'Declaration', presentation: 'modal' }} />
      </Stack>
    </>
  )
}

const updateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  desc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
})

const kioskStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: 8,
  },
  error: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
})
