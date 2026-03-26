/* Hook mise a jour automatique APK / Auto-update APK hook.
   Utilise expo-application pour lire la version native (jamais undefined).
   Compare build_number (entier) — ne declenche la MAJ que si le serveur a un numero superieur. */

import { useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import * as Application from 'expo-application'
import * as FileSystem from 'expo-file-system'
import * as IntentLauncher from 'expo-intent-launcher'
import api from '../services/api'
import { useDeviceStore } from '../stores/useDeviceStore'

/** Version native compilee — jamais undefined sur appareil / Native compiled version — never undefined on device */
const LOCAL_VERSION = Application.nativeApplicationVersion ?? '0.0.0'
const LOCAL_BUILD = Number(Application.nativeBuildVersion ?? '0')

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
        const minBuild = data.min_build_number
        const apkPath = data.apk_url
        if (!minBuild || !apkPath) return

        // Comparer par build_number (entier) — uniquement si serveur > local
        if (LOCAL_BUILD >= minBuild) return

        const serverBase = api.defaults.baseURL?.replace(/\/api\/?$/, '') || ''
        const apkUrl = apkPath.startsWith('http') ? apkPath : `${serverBase}${apkPath}`

        Alert.alert(
          'Mise a jour disponible',
          `Version ${data.min_version || '?'} disponible (actuelle: ${LOCAL_VERSION}, build ${LOCAL_BUILD}).\n\nLa mise a jour va se telecharger.`,
          [
            { text: 'Mettre a jour', onPress: () => downloadAndInstall(apkUrl) },
            { text: 'Plus tard', style: 'cancel' },
          ],
        )
      } catch {
        // Silencieux si pas de reseau ou erreur API
      }
    }

    const timer = setTimeout(check, 3000)
    return () => clearTimeout(timer)
  }, [isRegistered])

  const downloadAndInstall = async (apkUrl: string) => {
    setUpdating(true)
    setProgress(0)

    try {
      const localUri = `${FileSystem.cacheDirectory}cmro-driver-update.apk`

      // Nettoyer l'ancien fichier cache / Clean old cached APK
      const info = await FileSystem.getInfoAsync(localUri)
      if (info.exists) await FileSystem.deleteAsync(localUri, { idempotent: true })

      const download = FileSystem.createDownloadResumable(
        apkUrl,
        localUri,
        {},
        (dp) => {
          const pct = dp.totalBytesWritten / dp.totalBytesExpectedToWrite
          setProgress(Math.round(pct * 100))
        },
      )

      const result = await download.downloadAsync()
      if (!result?.uri) {
        Alert.alert('Erreur', 'Echec du telechargement')
        setUpdating(false)
        return
      }

      // Lancer l'installateur Android / Launch Android installer
      const contentUri = await FileSystem.getContentUriAsync(result.uri)
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        flags: 1 | 0x10000000,  // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
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
