/* Service impression Bluetooth Classic / Bluetooth Classic print service.

   Wrapper sur react-native-bluetooth-classic. Les imprimantes Zebra (ZQ320/521) et
   TSC (Alpha-30R) parlent Bluetooth Classic SPP (pas BLE), donc on a besoin de ce
   module natif (incompatible Expo Go — necessite un EAS build).

   ATTENTION : le module n'est pas installe par defaut. Pour activer l'impression
   reelle, faire :
     npm install react-native-bluetooth-classic
   puis un EAS build. Le service utilise un import dynamique pour ne pas casser
   l'app si le module n'est pas encore present (mode dev/preview sans Bluetooth).

   Wrapper for react-native-bluetooth-classic. Zebra (ZQ320/521) and TSC (Alpha-30R)
   printers speak Bluetooth Classic SPP (not BLE), so this native module is required
   (incompatible with Expo Go — needs an EAS build).

   NOTE: the module is not installed by default. To enable real printing, run:
     npm install react-native-bluetooth-classic
   then trigger an EAS build. The service uses a dynamic import so the app keeps
   working if the module is not yet present (dev/preview without Bluetooth).
*/

import { Platform, PermissionsAndroid } from 'react-native'

/** Imprimante Bluetooth detectee / Detected Bluetooth printer */
export interface BluetoothPrinter {
  address: string
  name: string
  bonded: boolean
}

/** Resultat d'une operation d'impression / Print operation result */
export interface PrintResult {
  success: boolean
  error?: string
}

/** Module Bluetooth runtime — null si non installe / Runtime Bluetooth module — null if not installed */
let _module: any = null
let _loadAttempted = false

function _loadModule(): any {
  if (_loadAttempted) return _module
  _loadAttempted = true
  try {
    // Import dynamique pour eviter de casser le bundling si le module n'est pas la /
    // Dynamic import so bundling doesn't break when the module is absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-bluetooth-classic')
    _module = mod?.default ?? mod
  } catch {
    _module = null
  }
  return _module
}

/** Le module Bluetooth natif est-il disponible ? / Is the native Bluetooth module available? */
export function isBluetoothModuleAvailable(): boolean {
  return _loadModule() !== null
}

/** Demander les permissions Bluetooth Android 12+ / Request Android 12+ Bluetooth permissions.
 *
 * Sur Android 11 et avant : BLUETOOTH/BLUETOOTH_ADMIN suffisent et sont declarees dans le
 * manifest, pas besoin d'autorisation runtime.
 * Sur Android 12+ : BLUETOOTH_CONNECT et BLUETOOTH_SCAN doivent etre acceptees par l'user.
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0
  if (apiLevel < 31) return true
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ])
    return Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED)
  } catch {
    return false
  }
}

/** Lister les imprimantes Bluetooth appairees / List paired Bluetooth printers.
 *
 * Filtre uniquement les devices reconnus comme imprimantes (heuristique sur le nom).
 * Les utilisateurs doivent appairer leur imprimante via les parametres systeme
 * Android avant que l'app la voie ici.
 */
export async function listPairedPrinters(): Promise<BluetoothPrinter[]> {
  const mod = _loadModule()
  if (!mod) {
    throw new Error(
      'Module Bluetooth non installe. Faites un EAS build avec react-native-bluetooth-classic.',
    )
  }
  const enabled = await mod.isBluetoothEnabled()
  if (!enabled) {
    throw new Error('Bluetooth desactive. Activez-le dans les parametres Android.')
  }
  const devices = await mod.getBondedDevices()
  return (devices || []).map((d: any) => ({
    address: d.address,
    name: d.name || d.address,
    bonded: true,
  }))
}

/** Connecter, envoyer un payload RAW puis deconnecter /
 *  Connect, send RAW payload then disconnect.
 *
 * Implementation simple "connect-and-fire-and-forget" : pas de connexion persistante,
 * chaque impression rouvre la connexion. Plus robuste face aux deconnexions
 * intempestives, au prix d'un delai supplementaire (~500ms) par etiquette.
 */
export async function printRaw(address: string, payload: string): Promise<PrintResult> {
  const mod = _loadModule()
  if (!mod) {
    return {
      success: false,
      error: 'Module Bluetooth non installe (EAS build requis).',
    }
  }
  let device: any = null
  try {
    device = await mod.connectToDevice(address, { CONNECTOR_TYPE: 'rfcomm' })
    // ZPL/TSPL doivent etre envoyes en ASCII brut, sans encodage UTF-8 multibyte /
    // ZPL/TSPL must be sent as raw ASCII, not multibyte UTF-8
    await device.write(payload)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  } finally {
    try {
      if (device?.disconnect) {
        await device.disconnect()
      } else if (mod.disconnectFromDevice) {
        await mod.disconnectFromDevice(address)
      }
    } catch {
      // Best-effort disconnect : ne pas masquer l'erreur d'impression
    }
  }
}

/** ZPL minimal de test (etiquette "TEST") / Minimal ZPL test label. */
export const TEST_ZPL =
  '^XA^PW576^LL400^CI28^FO50,50^A0N,60,60^FDTEST^FS' +
  '^FO50,140^A0N,30,30^FDImprimante Bluetooth^FS' +
  '^FO50,200^A0N,28,28^FDChaos Route^FS' +
  '^FO50,260^BY3,3,100^BCN,100,Y,N,N^FDTEST-12345^FS' +
  '^XZ'

/** TSPL minimal de test / Minimal TSPL test label. */
export const TEST_TSPL =
  'SIZE 72 mm, 50 mm\r\nGAP 2 mm, 0 mm\r\nDIRECTION 1\r\nCLS\r\n' +
  'TEXT 50,50,"5",0,1,1,"TEST"\r\n' +
  'TEXT 50,140,"3",0,1,1,"Imprimante Bluetooth"\r\n' +
  'TEXT 50,200,"3",0,1,1,"Chaos Route"\r\n' +
  'BARCODE 50,260,"128",100,1,0,3,3,"TEST-12345"\r\n' +
  'PRINT 1\r\n'
