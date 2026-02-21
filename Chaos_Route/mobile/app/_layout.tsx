/* Layout racine — Device gate + navigation / Root layout */

import { useEffect } from 'react'
import { View, Text } from 'react-native'
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

    if (!isRegistered && !inRegister) {
      router.replace('/register')
    } else if (isRegistered && inRegister) {
      router.replace('/(tabs)')
    }
  }, [isRegistered, isLoading, segments, router])

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
