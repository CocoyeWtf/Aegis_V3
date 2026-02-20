/* Ecran reglages / Settings screen

Entierement protege par login — le chauffeur n'y a pas acces.
Seuls les utilisateurs avec un compte peuvent voir/modifier les reglages.
*/

import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/useAuthStore'
import { useDeviceStore } from '../../stores/useDeviceStore'
import { COLORS, API_BASE_URL } from '../../constants/config'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, accessToken, logout } = useAuthStore()
  const { deviceId, registrationCode, reset: resetDevice } = useDeviceStore()

  const isLoggedIn = !!accessToken && !!user

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

  // Ecran verrouille — demander le login
  if (!isLoggedIn) {
    return (
      <View style={styles.lockedContainer}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Acces restreint</Text>
        <Text style={styles.lockDesc}>
          Connectez-vous avec un compte administrateur pour acceder aux reglages.
        </Text>
        <TouchableOpacity onPress={handleLogin} style={styles.loginBtn}>
          <Text style={styles.loginText}>Se connecter</Text>
        </TouchableOpacity>
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

      <Text style={styles.version}>CMRO Driver v1.0.0</Text>
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
})
