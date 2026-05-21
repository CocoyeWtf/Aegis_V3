/* Declaration de contenants PDV avec impression mobile / PDV containers declaration with mobile printing.

   Implementation a venir au lot suivant. Pour l'instant : placeholder accessible
   depuis pdv-home.
*/

import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../constants/config'

export default function PdvPickupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Declaration contenants</Text>
      <Text style={styles.note}>
        Ecran de saisie en preparation. Configurez d'abord l'imprimante Bluetooth
        dans "Imprimante Bluetooth" du menu PDV.
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
