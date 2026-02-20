/* Tab bar layout (Mes tours | Reglages) / Tab bar layout */

import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { COLORS } from '../../constants/config'

export default function TabLayout() {
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
          title: 'Mes tours',
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
