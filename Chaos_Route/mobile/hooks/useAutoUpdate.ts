/* Hook mise a jour automatique APK / Auto-update APK hook.
   Compare la version installee avec la version minimale du serveur.
   Si obsolete : telecharge le nouvel APK et lance l'installateur Android. */

import { useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system'
import * as IntentLauncher from 'expo-intent-launcher'
import api from '../services/api'
import { useDeviceStore } from '../stores/useDeviceStore'

/** Comparer deux versions semver (ex: "1.2.0" vs "1.3.0") / Compare semver versions */
function isVersionOlder(current: string, required: string): boolean {
  const c = current.split('.').map(Number)
  const r = required.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((c[i] || 0) < (r[i] || 0)) return true
    if ((c[i] || 0) > (r[i] || 0)) return false
  }
  return false
}

export function useAutoUpdate() {
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(0)
  const checkedRef = useRef(false)
  const isRegistered = useDeviceStore((s) => !!s.deviceId)

  useEffect(() => {
    if (Platform.OS !== 'android' || !isRegistered || checkedRef.current) return
    checkedRef.current = true

    const check = async () => {
      try {
        const { data } = await api.get('/driver/device-info')
        const minVersion = data.min_version
        const apkPath = data.apk_url
        if (!minVersion || !apkPath) return

        const currentVersion = Constants.expoConfig?.version || '0.0.0'
        if (!isVersionOlder(currentVersion, minVersion)) return

        // Version obsolete — proposer la mise a jour
        const serverBase = api.defaults.baseURL?.replace(/\/api\/?$/, '') || ''
        const apkUrl = apkPath.startsWith('http') ? apkPath : `${serverBase}${apkPath}`

        Alert.alert(
          'Mise a jour disponible',
          `Une nouvelle version (${minVersion}) est disponible. Version actuelle : ${currentVersion}.\n\nLa mise a jour va se telecharger automatiquement.`,
          [
            {
              text: 'Mettre a jour',
              onPress: () => downloadAndInstall(apkUrl),
            },
            {
              text: 'Plus tard',
              style: 'cancel',
            },
          ],
        )
      } catch {
        // Silencieux si pas de reseau
      }
    }

    // Attendre 2s apres le lancement pour ne pas bloquer le rendu
    const timer = setTimeout(check, 2000)
    return () => clearTimeout(timer)
  }, [isRegistered])

  const downloadAndInstall = async (apkUrl: string) => {
    setUpdating(true)
    setProgress(0)

    try {
      const localUri = `${FileSystem.cacheDirectory}cmro-driver-update.apk`

      // Supprimer l'ancien fichier si existant
      const info = await FileSystem.getInfoAsync(localUri)
      if (info.exists) await FileSystem.deleteAsync(localUri)

      // Telecharger avec progression
      const download = FileSystem.createDownloadResumable(
        apkUrl,
        localUri,
        {},
        (downloadProgress) => {
          const pct = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
          setProgress(Math.round(pct * 100))
        },
      )

      const result = await download.downloadAsync()
      if (!result?.uri) {
        Alert.alert('Erreur', 'Echec du telechargement')
        setUpdating(false)
        return
      }

      // Lancer l'installateur Android via content URI
      const contentUri = await FileSystem.getContentUriAsync(result.uri)
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      })
    } catch (err) {
      console.error('Auto-update failed:', err)
      Alert.alert('Erreur', 'Echec de la mise a jour. Telechargez manuellement depuis le navigateur.')
    } finally {
      setUpdating(false)
    }
  }

  return { updating, progress }
}
