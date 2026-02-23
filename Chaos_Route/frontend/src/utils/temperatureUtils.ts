/* Fonctions pures température / Pure temperature utility functions */

import type { TemperatureClass, TemperatureType } from '../types'

/**
 * Détermine le type température requis selon les classes présentes /
 * Determine required temperature type based on present classes
 */
export function getRequiredTemperatureType(temps: Set<TemperatureClass>): TemperatureType {
  if (temps.size === 0) return 'SEC'
  if (temps.size === 1) return [...temps][0] as TemperatureType
  if (temps.size === 2) return 'BI_TEMP'
  return 'TRI_TEMP'
}

/**
 * Vérifie la compatibilité d'un volume avec le type température du tour /
 * Check temperature compatibility of a volume with the tour's temperature type
 */
export function checkTemperatureCompatibility(
  volumeTemp: TemperatureClass,
  tourTempType: TemperatureType | null,
  currentTemps: Set<TemperatureClass>,
): { compatible: true } | { compatible: false; upgradeTo: TemperatureType } {
  if (!tourTempType) return { compatible: true }

  // Mono-temp : seule la même classe est compatible / Mono: only same class is compatible
  if (tourTempType === 'SEC' || tourTempType === 'FRAIS' || tourTempType === 'GEL') {
    if (volumeTemp === tourTempType) return { compatible: true }
    const newTemps = new Set(currentTemps)
    newTemps.add(volumeTemp)
    return { compatible: false, upgradeTo: getRequiredTemperatureType(newTemps) }
  }

  // BI_TEMP : 2 classes max / BI_TEMP: max 2 classes
  if (tourTempType === 'BI_TEMP') {
    if (currentTemps.has(volumeTemp)) return { compatible: true }
    if (currentTemps.size < 2) return { compatible: true }
    return { compatible: false, upgradeTo: 'TRI_TEMP' }
  }

  // TRI_TEMP : tout est compatible / TRI_TEMP: everything is compatible
  return { compatible: true }
}

/**
 * Retourne les monos incompatibles avec les volumes actuels /
 * Return mono types incompatible with current tour volumes
 */
export function getDisabledMonoTemps(currentTemps: Set<TemperatureClass>): Set<TemperatureClass> {
  const disabled = new Set<TemperatureClass>()
  const allClasses: TemperatureClass[] = ['SEC', 'FRAIS', 'GEL']
  for (const cls of allClasses) {
    if (!currentTemps.has(cls) && currentTemps.size > 0) {
      disabled.add(cls)
    }
  }
  return disabled
}
