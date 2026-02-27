/* Bouton toggle lampe torche pour les scanners / Torch toggle button for scanner screens */

import { TouchableOpacity, Text, StyleSheet } from 'react-native'

interface TorchToggleButtonProps {
  enabled: boolean
  onToggle: () => void
}

export function TorchToggleButton({ enabled, onToggle }: TorchToggleButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, enabled && styles.btnActive]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{enabled ? '\u{1F526}' : '\u{1F506}'}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  btnActive: {
    backgroundColor: 'rgba(255,200,0,0.7)',
  },
  icon: {
    fontSize: 22,
  },
})
