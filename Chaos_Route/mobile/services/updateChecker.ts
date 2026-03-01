/* Service de mise a jour automatique / Auto-update service
 *
 * Au lancement : appelle GET /app/version, compare avec la version locale.
 * Si differente et force_update = true : modal bloquant + telechargement APK.
 * On app launch: calls GET /app/version, compares with local version.
 * If different and force_update = true: blocking modal + APK download.
 */

import { Platform, Linking } from 'react-native'
import Constants from 'expo-constants'
import { API_BASE_URL } from '../constants/config'

const LOCAL_VERSION = Constants.expoConfig?.version || '1.0.0'

interface VersionInfo {
  version: string
  build_number: number
  download_url: string | null
  force_update: boolean
}

export async function checkForUpdate(): Promise<{
  updateAvailable: boolean
  versionInfo: VersionInfo | null
}> {
  try {
    // Appeler sans axios pour eviter l'intercepteur device / Call without axios to avoid device interceptor
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/app/version`)
    if (!response.ok) return { updateAvailable: false, versionInfo: null }

    const info: VersionInfo = await response.json()

    if (info.version !== LOCAL_VERSION && info.force_update) {
      return { updateAvailable: true, versionInfo: info }
    }

    return { updateAvailable: false, versionInfo: info }
  } catch (e) {
    console.warn('Update check failed:', e)
    return { updateAvailable: false, versionInfo: null }
  }
}

export async function downloadAndInstallApk(downloadUrl: string): Promise<void> {
  if (Platform.OS !== 'android') return

  // Ouvrir l'URL dans le navigateur — Android gere le telechargement et l'installation
  // Open URL in browser — Android handles download and installation natively
  await Linking.openURL(downloadUrl)
}
