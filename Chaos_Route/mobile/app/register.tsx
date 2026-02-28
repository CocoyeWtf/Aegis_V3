/* Ecran enregistrement appareil / Device registration screen */

import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import axios from 'axios'
import { useDeviceStore, getOrCreateDeviceUUID } from '../stores/useDeviceStore'
import { COLORS, API_BASE_URL } from '../constants/config'
import { TorchToggleButton } from '../components/TorchToggleButton'

export default function RegisterScreen() {
  const router = useRouter()
  const { register, fetchDeviceInfo } = useDeviceStore()
  const [mode, setMode] = useState<'menu' | 'scan' | 'manual'>('menu')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState(API_BASE_URL)
  const [showServer, setShowServer] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const scannedRef = useRef(false)

  const doRegister = async (registrationCode: string) => {
    setLoading(true)
    try {
      const deviceUUID = await getOrCreateDeviceUUID()
      const baseUrl = serverUrl.replace(/\/api\/?$/, '')

      await axios.post(`${baseUrl}/api/devices/register`, {
        registration_code: registrationCode.trim().toUpperCase(),
        device_identifier: deviceUUID,
      })

      await register(deviceUUID, registrationCode.trim().toUpperCase())
      await fetchDeviceInfo()

      Alert.alert(
        'Enregistrement reussi',
        'L\'appareil est maintenant enregistre.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
      )
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur d\'enregistrement'
      Alert.alert('Erreur', detail)
    } finally {
      setLoading(false)
    }
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return
    scannedRef.current = true

    // Extraire le code d'enregistrement du QR / Extract registration code from QR
    let code: string | null = null

    // Format URL: http://server/app/setup/CODE123
    const urlMatch = data.match(/\/app\/setup\/([A-Z0-9]+)/i)
    if (urlMatch) {
      code = urlMatch[1]
    }

    // Format JSON legacy: {"type":"CMRO_DEVICE_REGISTER","code":"CODE123"}
    if (!code) {
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'CMRO_DEVICE_REGISTER' && parsed.code) {
          code = parsed.code
        }
      } catch {
        // Pas du JSON
      }
    }

    // Format code brut (6-12 caracteres alphanumeriques)
    if (!code && /^[A-Z0-9]{6,12}$/i.test(data)) {
      code = data
    }

    if (code) {
      doRegister(code)
    } else {
      Alert.alert('QR invalide', 'Ce QR code n\'est pas un code d\'enregistrement CMRO', [
        { text: 'Re-scanner', onPress: () => { scannedRef.current = false } },
        { text: 'Retour', onPress: () => setMode('menu') },
      ])
    }
  }

  // Mode scanner QR
  if (mode === 'scan') {
    if (!permission) {
      return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
    }
    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.text}>Acces camera requis pour scanner le QR</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Autoriser la camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('menu')} style={{ marginTop: 16 }}>
            <Text style={styles.linkText}>Retour</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View style={styles.scanContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={loading ? undefined : handleBarCodeScanned}
        />
        <TorchToggleButton enabled={torchOn} onToggle={() => setTorchOn((v) => !v)} />
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.hint}>
            {loading ? 'Enregistrement...' : 'Scannez le QR code affiche sur le serveur'}
          </Text>
          {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />}
        </View>
        <TouchableOpacity onPress={() => { setMode('menu'); scannedRef.current = false }} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Mode saisie manuelle
  if (mode === 'manual') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <Text style={styles.title}>CMRO</Text>
          <Text style={styles.subtitle}>Enregistrement manuel</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Code d'enregistrement</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: A1B2C3D4"
              placeholderTextColor={COLORS.textMuted}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
              onPress={() => doRegister(code)}
              disabled={loading || !code.trim()}
            >
              <Text style={styles.primaryBtnText}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Text>
            </TouchableOpacity>
          </View>

          {/* URL serveur */}
          <TouchableOpacity onPress={() => setShowServer(!showServer)} style={{ marginTop: 20 }}>
            <Text style={styles.linkText}>Serveur</Text>
          </TouchableOpacity>
          {showServer && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="URL serveur"
              placeholderTextColor={COLORS.textMuted}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          )}

          <TouchableOpacity onPress={() => setMode('menu')} style={{ marginTop: 20 }}>
            <Text style={styles.linkText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // Menu principal / Main menu
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>CMRO</Text>
        <Text style={styles.subtitle}>Enregistrement de l'appareil</Text>

        <Text style={styles.description}>
          Cet appareil n'est pas encore enregistre.{'\n'}
          Demandez a votre postier d'afficher le QR code d'enregistrement.
        </Text>

        <View style={styles.form}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { scannedRef.current = false; setMode('scan') }}
          >
            <Text style={styles.primaryBtnText}>Scanner le QR code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setMode('manual')}
          >
            <Text style={styles.secondaryBtnText}>Saisir le code manuellement</Text>
          </TouchableOpacity>
        </View>

        {/* URL serveur */}
        <TouchableOpacity onPress={() => setShowServer(!showServer)} style={{ marginTop: 30 }}>
          <Text style={styles.linkText}>Serveur</Text>
        </TouchableOpacity>
        {showServer && (
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="URL serveur"
            placeholderTextColor={COLORS.textMuted}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 12,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
  // Scanner styles
  scanContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderRadius: 16,
  },
  hint: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
})
