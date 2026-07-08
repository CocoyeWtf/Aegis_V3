/* Notice d'information + consentement geolocalisation (RGPD, STIME A7).
   Affichee au premier lancement chauffeur (aucun choix enregistre cote
   serveur). Le choix est journalise cote serveur (append-only) ; le refus
   coupe aussi l'ingestion GPS cote serveur (defense en profondeur). */

import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import api from '../services/api'
import { COLORS } from '../constants/config'

export default function GpsConsentScreen() {
  const router = useRouter()
  const [notice, setNotice] = useState<{ version: string; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/gdpr/privacy-notice/gps')
      .then(({ data }) => setNotice(data))
      .catch(() => setNotice({
        version: 'hors-ligne',
        text: "Pendant vos tournées, l'application transmet la position du véhicule "
          + "pour le suivi opérationnel, la preuve de passage et la sécurité. "
          + "Positions conservées 60 jours. Vous pouvez refuser ou retirer votre "
          + "consentement à tout moment dans Réglages.",
      }))
  }, [])

  const submit = async (granted: boolean) => {
    setSaving(true)
    try {
      await api.post('/gdpr/consent/device', {
        consent_type: 'gps_tracking',
        granted,
        info_version: notice?.version,
      })
      if (!granted) {
        Alert.alert(
          'Suivi désactivé',
          'Votre position ne sera pas transmise. Vous pouvez changer d\'avis à tout moment dans Réglages → Confidentialité.',
        )
      }
      router.back()
    } catch {
      Alert.alert('Erreur', 'Choix non enregistré (réseau ?). Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suivi GPS des tournées</Text>
      <ScrollView style={styles.noticeBox}>
        {notice
          ? <Text style={styles.noticeText}>{notice.text}</Text>
          : <ActivityIndicator color={COLORS.primary} />}
      </ScrollView>
      <TouchableOpacity
        style={[styles.button, styles.accept, saving && { opacity: 0.5 }]}
        onPress={() => submit(true)}
        disabled={saving || !notice}
      >
        <Text style={styles.buttonText}>J'accepte le suivi pendant mes tournées</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.refuse, saving && { opacity: 0.5 }]}
        onPress={() => submit(false)}
        disabled={saving || !notice}
      >
        <Text style={styles.refuseText}>Je refuse</Text>
      </TouchableOpacity>
      {notice && <Text style={styles.version}>Notice v{notice.version}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 20, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 16 },
  noticeBox: {
    flex: 1, backgroundColor: COLORS.bgSecondary, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 16,
  },
  noticeText: { fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  accept: { backgroundColor: COLORS.primary },
  refuse: { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border },
  buttonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  refuseText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
  version: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
})
