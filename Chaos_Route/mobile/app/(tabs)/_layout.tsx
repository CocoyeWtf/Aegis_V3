/* Tab bar layout (Mes tours | Reglages) / Tab bar layout */

import { Text, View } from 'react-native'
import { Tabs } from 'expo-router'
import { COLORS } from '../../constants/config'
import { useDeviceStore } from '../../stores/useDeviceStore'

export default function TabLayout() {
  const { friendlyName, baseName } = useDeviceStore()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.bgSecondary,
          borderTopColor: COLORS.border,
        },
        headerStyle: { backgroundColor: COLORS.bgPrimary },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: friendlyName || 'Mes tours',
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textPrimary, fontSize: 17, fontWeight: 'bold' }}>
                {friendlyName || 'Mes tours'}
              </Text>
              {baseName && (
                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                  {baseName}
                </Text>
              )}
            </View>
          ),
          tabBarLabel: 'Mes tours',
          tabBarIcon: ({ color }) => (
            <TabIcon label="🚛" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Reglages',
          tabBarLabel: 'Reglages',
          tabBarIcon: ({ color }) => (
            <TabIcon label="⚙️" color={color} />
          ),
        }}
      />
    </Tabs>
  )
}

function TabIcon({ label }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{label}</Text>
}
