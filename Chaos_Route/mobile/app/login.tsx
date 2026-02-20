/* Ecran connexion / Login screen */

import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/useAuthStore'
import { COLORS, API_BASE_URL } from '../constants/config'
import api from '../services/api'
import type { TokenResponse } from '../types'

export default function LoginScreen() {
  const router = useRouter()
  const { setTokens, setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState(API_BASE_URL)
  const [showServer, setShowServer] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) return
    setLoading(true)
    try {
      // Mettre a jour l'URL si modifiee / Update URL if changed
      if (serverUrl !== api.defaults.baseURL) {
        api.defaults.baseURL = serverUrl
      }

      const { data } = await api.post<TokenResponse>('/auth/login', { username, password })
      setTokens(data.access_token, data.refresh_token)

      const meRes = await api.get('/auth/me')
      setUser(meRes.data)

      router.back()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur de connexion'
      Alert.alert('Erreur', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>CMRO</Text>
        <Text style={styles.subtitle}>Chaos Manager Route Optimizer</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Identifiant"
            placeholderTextColor={COLORS.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.5 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
          </TouchableOpacity>
        </View>

        {/* URL serveur configurable / Configurable server URL */}
        <TouchableOpacity onPress={() => setShowServer(!showServer)} style={{ marginTop: 20 }}>
          <Text style={styles.serverToggle}>Serveur</Text>
        </TouchableOpacity>
        {showServer && (
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="URL serveur"
            placeholderTextColor={COLORS.textMuted}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        )}
      </View>
    </KeyboardAvoidingView>
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
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 12,
    width: '100%',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  serverToggle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
})
