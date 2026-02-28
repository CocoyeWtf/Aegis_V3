/* Ecran reglages / Settings screen

Entierement protege par login — le chauffeur n'y a pas acces.
Seuls les utilisateurs avec un compte peuvent voir/modifier les reglages.
*/

import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Modal, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { useAuthStore } from '../../stores/useAuthStore'
import { useDeviceStore } from '../../stores/useDeviceStore'
import api from '../../services/api'
import { COLORS, API_BASE_URL } from '../../constants/config'
import { verifyKioskPassword } from '../../services/kioskMode'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, accessToken, logout } = useAuthStore()
  const { deviceId, registrationCode, friendlyName, baseName, reset: resetDevice } = useDeviceStore()

  const [driverName, setDriverName] = useState('')
  const [switching, setSwitching] = useState(false)

  // Kiosk triple-tap sur version / Triple-tap on version text
  const [showKioskModal, setShowKioskModal] = useState(false)
  const [kioskPassword, setKioskPassword] = useState('')
  const [kioskChecking, setKioskChecking] = useState(false)
  const [kioskError, setKioskError] = useState('')
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleVersionTap = useCallback(() => {
    tapCountRef.current++
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      setKioskPassword('')
      setKioskError('')
      setShowKioskModal(true)
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 1000)
    }
  }, [])

  const handleKioskSubmit = async () => {
    if (!kioskPassword.trim()) return
    setKioskChecking(true)
    setKioskError('')
    const valid = await verifyKioskPassword(kioskPassword)
    setKioskChecking(false)
    if (valid) {
      setShowKioskModal(false)
      Alert.alert('Mode kiosque desactive', 'Vous pouvez quitter l\'application pendant 60 secondes.')
    } else {
      setKioskError('Mot de passe incorrect')
    }
  }

  const isLoggedIn = !!accessToken && !!user

  const handleSwitchDriver = () => {
    if (!driverName.trim()) {
      Alert.alert('', 'Saisissez le nom du chauffeur.')
      return
    }
    Alert.alert(
      'Changer de chauffeur',
      `Confirmer le changement vers "${driverName.trim()}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setSwitching(true)
            try {
              const { data } = await api.post('/driver/switch-driver', { driver_name: driverName.trim() })
              Alert.alert('Chauffeur change', `${data.old_driver || '(vide)'} → ${data.new_driver}`)
              setDriverName('')
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
              Alert.alert('Erreur', msg)
            } finally {
              setSwitching(false)
            }
          },
        },
      ],
    )
  }

  const handleLogin = () => {
    router.push('/login')
  }

  const handleLogout = () => {
    Alert.alert(
      'Deconnexion',
      'Voulez-vous vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Deconnecter', style: 'destructive', onPress: () => logout() },
      ],
    )
  }

  const handleResetDevice = () => {
    Alert.alert(
      'Reinitialiser l\'appareil',
      'Cela supprimera l\'enregistrement de cet appareil. Vous devrez le re-enregistrer via un nouveau QR code.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Reinitialiser',
          style: 'destructive',
          onPress: async () => {
            logout()
            await resetDevice()
            router.replace('/register')
          },
        },
      ],
    )
  }

  // Ecran verrouille — changement chauffeur accessible + login admin
  if (!isLoggedIn) {
    return (
      <View style={styles.lockedContainer}>
        {/* Changement chauffeur accessible sans login / Driver switch without login */}
        <View style={styles.driverSwitchSection}>
          <Text style={styles.driverSwitchTitle}>Changer de chauffeur</Text>
          <TextInput
            style={styles.driverInput}
            placeholder="Nom du chauffeur"
            placeholderTextColor={COLORS.textMuted}
            value={driverName}
            onChangeText={setDriverName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.driverSwitchBtn, (switching || !driverName.trim()) && { opacity: 0.5 }]}
            onPress={handleSwitchDriver}
            disabled={switching || !driverName.trim()}
          >
            <Text style={styles.driverSwitchBtnText}>
              {switching ? 'Changement...' : 'Valider'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={styles.lockTitle}>Reglages administrateur</Text>
        <Text style={styles.lockDesc}>
          Connectez-vous avec un compte administrateur pour acceder aux reglages avances.
        </Text>
        <TouchableOpacity onPress={handleLogin} style={styles.loginBtn}>
          <Text style={styles.loginText}>Se connecter</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleVersionTap} activeOpacity={1}>
          <Text style={styles.version}>
            CMRO Driver v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </TouchableOpacity>

        {/* Modal kiosque / Kiosk modal */}
        <Modal visible={showKioskModal} animationType="fade" transparent>
          <View style={kioskStyles.overlay}>
            <View style={kioskStyles.card}>
              <Text style={kioskStyles.title}>Mode kiosque</Text>
              <Text style={kioskStyles.desc}>Mot de passe administrateur pour quitter l'application.</Text>
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
                <TouchableOpacity onPress={() => setShowKioskModal(false)} style={kioskStyles.cancelBtn}>
                  <Text style={kioskStyles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleKioskSubmit} style={kioskStyles.submitBtn} disabled={kioskChecking}>
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
      </View>
    )
  }

  // Ecran reglages complet (utilisateur connecte)
  return (
    <View style={styles.container}>
      {/* Utilisateur / User */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Administrateur</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Identifiant</Text>
          <Text style={styles.value}>{user?.username || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '—'}</Text>
        </View>
      </View>

      {/* Appareil / Device */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appareil</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nom</Text>
          <Text style={[styles.value, { fontWeight: '700' }]}>{friendlyName || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Base</Text>
          <Text style={styles.value}>{baseName || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Code enregistrement</Text>
          <Text style={[styles.value, { color: COLORS.primary, fontWeight: '700' }]}>{registrationCode || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ID appareil</Text>
          <Text style={[styles.value, { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
            {deviceId ? deviceId.substring(0, 16) + '...' : '—'}
          </Text>
        </View>
      </View>

      {/* Serveur / Server */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Serveur</Text>
        <View style={styles.row}>
          <Text style={styles.label}>URL</Text>
          <Text style={styles.value}>{API_BASE_URL}</Text>
        </View>
      </View>

      {/* Deconnexion / Logout */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Se deconnecter</Text>
      </TouchableOpacity>

      {/* Reinitialisation / Reset device */}
      <TouchableOpacity onPress={handleResetDevice} style={styles.resetBtn}>
        <Text style={styles.resetText}>Reinitialiser l'appareil</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleVersionTap} activeOpacity={1}>
        <Text style={styles.version}>
          CMRO Driver v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    padding: 20,
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  lockDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  loginText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  logoutBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  resetText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 30,
  },
  driverSwitchSection: {
    width: '100%',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverSwitchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  driverInput: {
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  driverSwitchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  driverSwitchBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 24,
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
