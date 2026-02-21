/* Layout racine — OTA update check + Device gate + navigation / Root layout

Au demarrage :
1. Verifier s'il y a une mise a jour OTA disponible
2. Si oui, telecharger et relancer l'app
3. Ensuite, gate device : l'appareil doit etre enregistre.
*/

import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import * as Updates from 'expo-updates'
import { useDeviceStore } from '../stores/useDeviceStore'
import { COLORS } from '../constants/config'

function UpdateScreen() {
  return (
    <View style={updateStyles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={updateStyles.text}>Mise a jour en cours...</Text>
    </View>
  )
}

const updateStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginTop: 20,
  },
})

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { isRegistered, isLoading, loadDevice } = useDeviceStore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateChecked, setUpdateChecked] = useState(false)

  // Check OTA updates au demarrage (avant le device gate)
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync()
        if (update.isAvailable) {
          setIsUpdating(true)
          await Updates.fetchUpdateAsync()
          await Updates.reloadAsync()
        }
      } catch {
        // Fail silencieux — continuer normalement
      } finally {
        setUpdateChecked(true)
      }
    }

    if (!__DEV__) {
      checkForUpdates()
    } else {
      setUpdateChecked(true)
    }
  }, [])

  useEffect(() => {
    loadDevice()
  }, [loadDevice])

  useEffect(() => {
    if (isLoading || !updateChecked || isUpdating) return

    const inRegister = segments[0] === 'register'
    const inLogin = segments[0] === 'login'

    // Appareil non enregistre → ecran register
    if (!isRegistered && !inRegister) {
      router.replace('/register')
      return
    }

    // Appareil enregistre + sur register → aller aux tabs
    if (isRegistered && inRegister) {
      router.replace('/(tabs)')
      return
    }

    // Apres login reussi → retour aux tabs
    if (isRegistered && inLogin) {
      // login.tsx gere la redirection apres connexion
      return
    }
  }, [isRegistered, isLoading, segments, router, updateChecked, isUpdating])

  // Ecran de mise a jour OTA
  if (isUpdating) {
    return <UpdateScreen />
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bgPrimary },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: COLORS.bgPrimary },
        }}
      >
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tour/[id]" options={{ title: 'Detail tour' }} />
        <Stack.Screen name="tour/[id]/stop/[stopId]/scan" options={{ title: 'Scanner PDV', presentation: 'modal' }} />
        <Stack.Screen name="tour/[id]/stop/[stopId]/supports" options={{ title: 'Scan supports' }} />
        <Stack.Screen name="tour/[id]/stop/[stopId]/pickups" options={{ title: 'Scanner reprises' }} />
      </Stack>
    </>
  )
}
