/* Mode kiosque logiciel / Software kiosk mode
 *
 * Empeche la sortie de l'app via bouton retour Android.
 * Pour quitter : triple-tap zone cachee → saisie mot de passe → sortie autorisee.
 * Prevents app exit via Android back button.
 * To exit: triple-tap hidden zone → password prompt → exit allowed.
 */

import { BackHandler, Alert, TextInput } from 'react-native'
import api from './api'

let exitAllowed = false
let tapCount = 0
let tapTimer: ReturnType<typeof setTimeout> | null = null

const TRIPLE_TAP_TIMEOUT = 1000 // 1 seconde pour faire le triple-tap

export function isExitAllowed(): boolean {
  return exitAllowed
}

export function setExitAllowed(allowed: boolean): void {
  exitAllowed = allowed
}

/* Enregistrer le handler BackHandler / Register BackHandler */
export function enableKioskMode(): () => void {
  const handler = () => {
    if (exitAllowed) return false // Laisser le systeme gerer / Let system handle
    // Bloquer le retour / Block back
    return true
  }
  BackHandler.addEventListener('hardwareBackPress', handler)
  return () => BackHandler.removeEventListener('hardwareBackPress', handler)
}

/* Gerer un tap sur la zone cachee / Handle a tap on the hidden zone */
export function handleKioskTap(): void {
  tapCount++

  if (tapTimer) clearTimeout(tapTimer)

  if (tapCount >= 3) {
    tapCount = 0
    promptKioskPassword()
  } else {
    tapTimer = setTimeout(() => {
      tapCount = 0
    }, TRIPLE_TAP_TIMEOUT)
  }
}

/* Demander le mot de passe pour sortir / Prompt for exit password */
function promptKioskPassword(): void {
  // On utilise Alert.prompt sur iOS, mais sur Android on doit utiliser un workaround
  // Since Alert.prompt doesn't work on Android, we use a simple Alert with a hardcoded flow
  let inputPassword = ''

  Alert.alert(
    'Mode kiosque',
    'Entrez le mot de passe administrateur pour quitter l\'application.\n\nMot de passe :',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Valider',
        onPress: () => {
          // Sur Android, Alert.prompt n'existe pas — on utilise le store temporaire
          // Ceci sera remplace par un vrai prompt dans le composant KioskPasswordModal
          // This will be handled by the KioskPasswordModal component
        },
      },
    ],
  )
}

/* Verifier le mot de passe cote serveur / Verify password server-side */
export async function verifyKioskPassword(password: string): Promise<boolean> {
  try {
    const { data } = await api.post('/driver/verify-kiosk-password', { password })
    if (data.valid) {
      exitAllowed = true
      return true
    }
    return false
  } catch {
    return false
  }
}
