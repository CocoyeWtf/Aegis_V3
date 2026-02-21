/* Layout racine — Device gate + navigation / Root layout

Au demarrage :
1. Gate device : l'appareil doit etre enregistre
2. OTA check en arriere-plan (non-bloquant)
*/

import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import { useDeviceStore } from '../stores/useDeviceStore'
import { COLORS } from '../constants/config'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { isRegistered, isLoading, loadDevice } = useDeviceStore()

  // OTA check en arriere-plan (non-bloquant) / Background OTA check (non-blocking)
  useEffect(() => {
    if (__DEV__) return
    Updates.checkForUpdateAsync()
      .then((update) => {
        if (update.isAvailable) {
          Updates.fetchUpdateAsync()
            .then(() => Updates.reloadAsync())
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadDevice()
  }, [loadDevice])

  useEffect(() => {
    if (isLoading) return

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
  }, [isRegistered, isLoading, segments, router])

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
