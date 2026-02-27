/* Guide de preparation telephone Samsung XCover 5 / Phone setup guide */

const STEPS = [
  {
    title: '1. Deballage et premiere mise en route',
    items: [
      'Sortir le telephone de son emballage et retirer les films protecteurs.',
      'Inserer la carte SIM 4G (ou verifier que le WiFi est disponible sur la base).',
      'Allumer le telephone en maintenant le bouton lateral 3 secondes.',
      'Suivre l\'assistant de configuration Samsung : langue, WiFi, compte Google (optionnel).',
    ],
  },
  {
    title: '2. Connexion reseau',
    items: [
      'WiFi : Parametres > WiFi > Se connecter au reseau de la base.',
      '4G : La carte SIM doit etre activee. Verifier dans Parametres > Connexions > Reseaux mobiles.',
      'Tester la connexion en ouvrant le navigateur sur https://chaosroute.chaosmanager.tech',
    ],
  },
  {
    title: '3. Nettoyage de l\'ecran d\'accueil',
    items: [
      'Maintenir appuye sur chaque icone inutile > Supprimer (ou Desinstaller si possible).',
      'Garder uniquement : Parametres, Navigateur, et l\'APK CMRO Driver une fois installe.',
      'Desactiver les notifications inutiles : Parametres > Notifications > desactiver pour les apps non essentielles.',
    ],
  },
  {
    title: '4. Installation de l\'APK CMRO Driver',
    items: [
      'Ouvrir le navigateur Chrome sur le telephone.',
      'Scanner le QR code de la page "Appareils" du backoffice (ou saisir l\'URL manuellement).',
      'Appuyer sur "Telecharger CMRO Driver".',
      'Si demande : autoriser l\'installation depuis "Sources inconnues" (Parametres > Applications > Acces special > Installation d\'apps inconnues > Chrome > Autoriser).',
      'Ouvrir le fichier telecharge et installer.',
    ],
  },
  {
    title: '5. Enregistrement de l\'appareil',
    items: [
      'Ouvrir l\'application CMRO Driver.',
      'L\'ecran d\'enregistrement s\'affiche : saisir le code a 6 caracteres fourni par le QR.',
      'Le code se trouve sur la page web de configuration (affiche apres le telechargement de l\'APK).',
      'Appuyer sur "Enregistrer".',
      'L\'appareil apparait maintenant dans la liste "Appareils" du backoffice.',
    ],
  },
  {
    title: '6. Permissions obligatoires',
    items: [
      'Camera : autorise automatiquement au premier scan QR — accepter "Autoriser".',
      'Localisation : autorise au demarrage d\'un tour — accepter "Autoriser en permanence" (pas "Uniquement pendant l\'utilisation").',
      'Si une permission a ete refusee : Parametres > Applications > CMRO Driver > Autorisations > reactiver.',
    ],
  },
  {
    title: '7. Epinglage d\'ecran (recommande)',
    items: [
      'Permet de bloquer le telephone sur l\'application CMRO Driver.',
      'Parametres > Securite > Epinglage d\'ecran (ou "Pin windows") > Activer.',
      'Ouvrir CMRO Driver > Afficher les apps recentes > Appuyer sur l\'icone CMRO > "Epingler cette application".',
      'Pour desencastrer : maintenir Retour + Recents simultanement.',
    ],
  },
  {
    title: '8. Exclusion de l\'optimisation batterie',
    items: [
      'IMPORTANT : Empeche Android de tuer l\'application en arriere-plan (GPS).',
      'Parametres > Applications > CMRO Driver > Batterie > "Non restreint".',
      'Parametres > Entretien de l\'appareil > Batterie > Limites d\'utilisation en arriere-plan > s\'assurer que CMRO Driver n\'est pas dans la liste.',
    ],
  },
  {
    title: '9. Depannage courant',
    items: [
      'Le GPS ne fonctionne pas : verifier les permissions de localisation (etape 6). Redemarrer l\'app.',
      'L\'app ne se lance pas : verifier la connexion internet. Reinstaller l\'APK.',
      'Le scan QR ne fonctionne pas : verifier que la camera n\'est pas utilisee par une autre app. Nettoyer l\'objectif.',
      'L\'ecran est noir : appuyer longtemps sur le bouton lateral pour redemarrer le telephone.',
      'Mise a jour bloquee : verifier que "Sources inconnues" est active pour le navigateur Chrome (etape 4).',
      'Le telephone revient a l\'ecran d\'accueil : reactiver l\'epinglage d\'ecran (etape 7) et l\'exclusion batterie (etape 8).',
    ],
  },
]

export default function PhoneSetupGuide() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Guide de preparation telephone
        </h1>
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          Imprimer / PDF
        </button>
      </div>

      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Procedure de configuration pour les Samsung Galaxy XCover 5 (ou equivalent) utilises avec CMRO Driver.
      </p>

      {STEPS.map((step, i) => (
        <div
          key={i}
          className="rounded-xl border p-5 mb-4"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
            {step.title}
          </h2>
          <ul className="space-y-2">
            {step.items.map((item, j) => (
              <li
                key={j}
                className="text-sm flex items-start gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Footer impression / Print footer */}
      <div className="mt-8 text-center text-xs print:block hidden" style={{ color: 'var(--text-muted)' }}>
        CMRO — Chaos Manager Route Optimizer — Guide de preparation telephone
      </div>
    </div>
  )
}
