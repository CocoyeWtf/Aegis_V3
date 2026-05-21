/* Configuration imprimante Bluetooth portable / Portable Bluetooth printer setup.

   Implementation a venir au lot suivant. Pour l'instant : placeholder.
*/

import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../constants/config'

export default function PrinterSettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Imprimante Bluetooth</Text>
      <Text style={styles.note}>
        Module Bluetooth en cours d'integration. Vous pourrez bientot :
        {'\n'}- detecter les imprimantes Zebra et TSC appairees
        {'\n'}- envoyer un test d'impression
        {'\n'}- memoriser l'imprimante de l'appareil
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  note: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
