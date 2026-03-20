/* Modal controle temperature chauffeur / Driver temperature check modal.
   Affiche au depart et a chaque stop pour les tours temperature (FRAIS, GEL, BI_TEMP, TRI_TEMP).
   Le chauffeur confirme : groupe froid OK + consigne correcte. Si NOK → "Appelez la base". */

import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native'
import { COLORS } from '../constants/config'
import api from '../services/api'

interface TempCheckModalProps {
  visible: boolean
  tourId: number
  tourStopId?: number
  checkpoint: 'DEPARTURE_CHECK' | 'STOP_CHECK'
  temperatureType: string  // FRAIS, GEL, BI_TEMP, TRI_TEMP
  onComplete: () => void   // Controle OK → continuer
  onCancel: () => void     // Retour arriere
}

/** Temperature de consigne attendue / Expected setpoint temperature */
function getExpectedSetpoints(tempType: string): { label: string; value: number }[] {
  switch (tempType) {
    case 'GEL':
      return [{ label: '-22°C (Gel)', value: -22 }]
    case 'FRAIS':
      return [{ label: '1°C (Frais)', value: 1 }]
    case 'BI_TEMP':
      return [
        { label: '-22°C (Gel)', value: -22 },
        { label: '1°C (Frais)', value: 1 },
      ]
    case 'TRI_TEMP':
      return [
        { label: '-22°C (Gel)', value: -22 },
        { label: '1°C (Frais)', value: 1 },
        { label: '4°C (Ultra-frais)', value: 4 },
      ]
    default:
      return []
  }
}

export function TempCheckModal({
  visible, tourId, tourStopId, checkpoint, temperatureType, onComplete, onCancel,
}: TempCheckModalProps) {
  const [loading, setLoading] = useState(false)
  const [nokMessage, setNokMessage] = useState(false)

  const setpoints = getExpectedSetpoints(temperatureType)
  const isDeparture = checkpoint === 'DEPARTURE_CHECK'

  const handleConfirmOK = async () => {
    setLoading(true)
    try {
      // Enregistrer un check pour chaque consigne attendue / Record a check for each expected setpoint
      for (const sp of setpoints) {
        await api.post(`/driver/tour/${tourId}/temp-check`, {
          checkpoint,
          tour_stop_id: tourStopId || null,
          cooling_unit_ok: true,
          setpoint_ok: true,
          setpoint_temperature: sp.value,
        })
      }
      setNokMessage(false)
      onComplete()
    } catch (e) {
      console.error('Temp check failed', e)
      // En cas d'erreur API, laisser passer pour ne pas bloquer le chauffeur
      onComplete()
    } finally {
      setLoading(false)
    }
  }

  const handleNOK = async () => {
    // Enregistrer le NOK pour tracabilite / Record NOK for traceability
    try {
      await api.post(`/driver/tour/${tourId}/temp-check`, {
        checkpoint,
        tour_stop_id: tourStopId || null,
        cooling_unit_ok: false,
        setpoint_ok: false,
        setpoint_temperature: setpoints[0]?.value || 0,
      })
    } catch {
      // silencieux
    }
    setNokMessage(true)
  }

  const handleDismissNok = () => {
    setNokMessage(false)
    onCancel()
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {nokMessage ? (
            /* Ecran NOK — Appelez la base */
            <>
              <View style={styles.nokHeader}>
                <Text style={styles.nokIcon}>!</Text>
              </View>
              <Text style={styles.nokTitle}>Appelez la base</Text>
              <Text style={styles.nokText}>
                Un probleme a ete detecte sur le groupe froid ou la consigne de temperature.
                Contactez votre responsable avant de continuer.
              </Text>
              <TouchableOpacity onPress={handleDismissNok} style={styles.nokBtn}>
                <Text style={styles.nokBtnText}>Compris</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Ecran controle normal */
            <>
              <Text style={styles.title}>
                {isDeparture ? 'Controle temperature — Depart' : 'Controle temperature'}
              </Text>

              <View style={styles.checkList}>
                <Text style={styles.checkItem}>
                  Groupe froid allume et sans alarme ?
                </Text>
                <Text style={styles.checkItem}>
                  Consigne de temperature correcte ?
                </Text>
                {setpoints.map((sp) => (
                  <Text key={sp.value} style={styles.setpointItem}>
                    {sp.label}
                  </Text>
                ))}
              </View>

              <View style={styles.buttons}>
                <TouchableOpacity
                  onPress={handleConfirmOK}
                  style={styles.okBtn}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.okBtnText}>Tout est OK</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleNOK} style={styles.problemBtn} disabled={loading}>
                  <Text style={styles.problemBtnText}>Probleme</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} disabled={loading}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  checkList: {
    marginBottom: 24,
  },
  checkItem: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 8,
    fontWeight: '600',
  },
  setpointItem: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '700',
    marginLeft: 12,
    marginBottom: 4,
  },
  buttons: {
    gap: 10,
  },
  okBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  problemBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  problemBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  /* NOK screen */
  nokHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  nokIcon: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.danger,
    backgroundColor: COLORS.danger + '22',
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: 'center',
    borderRadius: 32,
    overflow: 'hidden',
  },
  nokTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  nokText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  nokBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nokBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
})
