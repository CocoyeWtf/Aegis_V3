/* Service de mise a jour automatique / Auto-update service
 *
 * Utilise expo-application pour lire la version native (jamais undefined).
 * Compare par build_number (entier) — ne declenche que si le serveur a un numero SUPERIEUR.
 * Cela evite la boucle quand la version string ne correspond pas.
 */

import * as FileSystem from 'expo-file-system'
import * as IntentLauncher from 'expo-intent-launcher'
import * as Application from 'expo-application'
import { Platform } from 'react-native'
import { API_BASE_URL } from '../constants/config'

/** Version native compilee — jamais undefined sur appareil */
const LOCAL_VERSION = Application.nativeApplicationVersion ?? '0.0.0'
const LOCAL_BUILD = Number(Application.nativeBuildVersion ?? '0')

interface VersionInfo {
  version: string
  build_number: number
  download_url: string | null
  force_update: boolean
}

export function getLocalVersion(): string {
  return LOCAL_VERSION
}

export function getLocalBuild(): number {
  return LOCAL_BUILD
}

export async function checkForUpdate(): Promise<{
  updateAvailable: boolean
  versionInfo: VersionInfo | null
}> {
  if (Platform.OS !== 'android') return { updateAvailable: false, versionInfo: null }

  try {
    const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
    const response = await fetch(`${baseUrl}/app/version`)
    if (!response.ok) return { updateAvailable: false, versionInfo: null }

    const info: VersionInfo = await response.json()

    // Comparer par build_number (entier) — uniquement si serveur > local
    const serverBuild = info.build_number ?? 0
    const needsUpdate = info.force_update && serverBuild > LOCAL_BUILD

    console.log(
      `[AutoUpdate] local=${LOCAL_VERSION} build=${LOCAL_BUILD} | server=${info.version} build=${serverBuild} | needsUpdate=${needsUpdate}`
    )

    if (needsUpdate && info.download_url) {
      return { updateAvailable: true, versionInfo: info }
    }

    return { updateAvailable: false, versionInfo: info }
  } catch (e) {
    console.warn('[AutoUpdate] check failed:', e)
    return { updateAvailable: false, versionInfo: null }
  }
}

export async function downloadAndInstallApk(downloadUrl: string): Promise<void> {
  if (Platform.OS !== 'android') return

  const fileUri = FileSystem.cacheDirectory + 'cmro-driver-update.apk'

  // Nettoyer l'ancien cache / Clean old cached APK
  const fileInfo = await FileSystem.getInfoAsync(fileUri)
  if (fileInfo.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true })

  // Telecharger / Download
  const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri)

  if (downloadResult.status !== 200) {
    throw new Error(`Telechargement echoue (status ${downloadResult.status})`)
  }

  // Lancer l'installeur Android / Launch Android installer
  const contentUri = await FileSystem.getContentUriAsync(fileUri)
  await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    flags: 1 | 0x10000000,  // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
    type: 'application/vnd.android.package-archive',
  })
}
