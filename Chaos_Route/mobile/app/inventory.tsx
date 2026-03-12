/* Ecran inventaire contenants PDV / PDV container inventory screen
   Flow :
   1. Saisir code PDV → POST /driver/inventory-lookup → info PDV + types supports
   2. Saisir quantites par type de support
   3. Soumettre → POST /driver/inventory
*/

import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import api from '../services/api'
import { COLORS } from '../constants/config'
import { useDeviceStore } from '../stores/useDeviceStore'
import type { SupportTypeBasic, PdvBasic } from '../types'

interface InventorySetup {
  pdv: PdvBasic
  support_types: SupportTypeBasic[]
}

interface QuantityMap {
  [supportTypeId: number]: number
}

export default function InventoryScreen() {
  const router = useRouter()
  const friendlyName = useDeviceStore.getState().friendlyName || 'Chauffeur'

  // Etape 1 : recherche PDV / Step 1: PDV lookup
  const [pdvCode, setPdvCode] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  // Etape 2 : saisie quantites / Step 2: quantity entry
  const [setup, setSetup] = useState<InventorySetup | null>(null)
  const [quantities, setQuantities] = useState<QuantityMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  /* Rechercher le PDV / Lookup PDV */
  const handleLookup = useCallback(async () => {
    const code = pdvCode.trim()
    if (!code) {
      Alert.alert('Erreur', 'Veuillez saisir un code PDV')
      return
    }
    setLookupLoading(true)
    try {
      const { data } = await api.post<InventorySetup>('/driver/inventory-lookup', { pdv_code: code })
      setSetup(data)
      // Initialiser quantites a 0
      const initQty: QuantityMap = {}
      data.support_types.forEach((st) => { initQty[st.id] = 0 })
      setQuantities(initQty)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'PDV non trouve ou erreur serveur'
      Alert.alert('Erreur', detail)
    } finally {
      setLookupLoading(false)
    }
  }, [pdvCode])

  /* Modifier quantite / Update quantity */
  const updateQty = useCallback((stId: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[stId] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [stId]: next }
    })
  }, [])

  const setQtyDirect = useCallback((stId: number, value: string) => {
    const num = parseInt(value, 10)
    setQuantities((prev) => ({
      ...prev,
      [stId]: isNaN(num) ? 0 : Math.max(0, num),
    }))
  }, [])

  /* Soumettre inventaire / Submit inventory */
  const handleSubmit = useCallback(async () => {
    if (!setup) return

    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([stId, qty]) => ({ support_type_id: Number(stId), quantity: qty }))

    if (lines.length === 0) {
      Alert.alert('Attention', 'Aucune quantite saisie. Veuillez saisir au moins une quantite.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/driver/inventory', {
        pdv_id: setup.pdv.id,
        lines,
        inventoried_by: friendlyName,
      })
      setSubmitted(true)
      Alert.alert('Succes', `Inventaire enregistre pour ${setup.pdv.code} - ${setup.pdv.name}`, [
        { text: 'OK' },
      ])
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Erreur lors de l\'enregistrement'
      Alert.alert('Erreur', detail)
    } finally {
      setSubmitting(false)
    }
  }, [setup, quantities, friendlyName])

  /* Reset pour nouveau inventaire / Reset for new inventory */
  const handleReset = useCallback(() => {
    setSetup(null)
    setQuantities({})
    setPdvCode('')
    setSubmitted(false)
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventaire PDV</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Etape 1 : Saisie code PDV / Step 1: PDV code entry */}
          {!setup && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rechercher un PDV</Text>
              <Text style={styles.sectionHint}>
                Saisissez le code du point de vente
              </Text>
              <TextInput
                style={styles.input}
                value={pdvCode}
                onChangeText={setPdvCode}
                placeholder="Code PDV (ex: 12345)"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleLookup}
              />
              <TouchableOpacity
                onPress={handleLookup}
                style={styles.primaryBtn}
                disabled={lookupLoading}
              >
                {lookupLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Rechercher</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Etape 2 : Saisie quantites / Step 2: Quantity entry */}
          {setup && !submitted && (
            <>
              {/* Info PDV */}
              <View style={styles.pdvCard}>
                <Text style={styles.pdvCode}>{setup.pdv.code}</Text>
                <Text style={styles.pdvName}>{setup.pdv.name}</Text>
                <TouchableOpacity onPress={handleReset}>
                  <Text style={styles.changeLink}>Changer de PDV</Text>
                </TouchableOpacity>
              </View>

              {/* Types de supports / Support types */}
              <Text style={styles.sectionTitle}>Quantites en stock</Text>
              <Text style={styles.sectionHint}>
                Saisissez le nombre de contenants par type
              </Text>

              {setup.support_types.map((st) => (
                <View key={st.id} style={styles.supportRow}>
                  <View style={styles.supportInfo}>
                    <Text style={styles.supportCode}>{st.code}</Text>
                    <Text style={styles.supportName}>{st.name}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      onPress={() => updateQty(st.id, -1)}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyInput}
                      value={String(quantities[st.id] || 0)}
                      onChangeText={(v) => setQtyDirect(st.id, v)}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      onPress={() => updateQty(st.id, 1)}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Bouton soumettre / Submit button */}
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Enregistrer l'inventaire</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Etape 3 : Confirmation / Step 3: Confirmation */}
          {submitted && (
            <View style={styles.successSection}>
              <Text style={styles.successIcon}>OK</Text>
              <Text style={styles.successText}>
                Inventaire enregistre pour {setup?.pdv.code}
              </Text>
              <TouchableOpacity onPress={handleReset} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Nouvel inventaire</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                <Text style={styles.linkText}>Retour a l'accueil</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  linkText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  /* PDV card */
  pdvCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderLeftWidth: 3,
  },
  pdvCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  pdvName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changeLink: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 6,
    textDecorationLine: 'underline',
  },

  /* Support type rows */
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  supportInfo: {
    flex: 1,
    marginRight: 12,
  },
  supportCode: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  supportName: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  qtyInput: {
    width: 56,
    height: 44,
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },

  /* Submit */
  submitBtn: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  /* Success */
  successSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  successIcon: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.success,
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
})
