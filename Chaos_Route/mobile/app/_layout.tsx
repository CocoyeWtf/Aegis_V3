/* Layout racine — Device gate + navigation / Root layout

Seul gate : l'appareil doit etre enregistre.
Pas de login pour acceder aux tours — le telephone est l'identite.
Le login est reserve aux reglages (acces admin).
*/

import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useDeviceStore } from '../stores/useDeviceStore'
import { COLORS } from '../constants/config'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { isRegistered, isLoading, loadDevice } = useDeviceStore()

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
      </Stack>
    </>
  )
}
