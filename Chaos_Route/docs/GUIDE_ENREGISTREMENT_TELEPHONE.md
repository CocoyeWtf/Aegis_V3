# Guide Utilisateur — Enregistrement d'un telephone

> **Version** : 1.0 — Mars 2026
> **Application** : Chaos RouteManager — Module Appareils mobiles (CMRO Driver)

---

## Table des matieres

1. [Pre-requis](#1-pre-requis)
2. [Etape 1 — Creer l'appareil dans le backoffice](#2-etape-1--creer-lappareil-dans-le-backoffice)
3. [Etape 2 — Installer l'APK sur le telephone](#3-etape-2--installer-lapk-sur-le-telephone)
4. [Etape 3 — Enregistrer le telephone](#4-etape-3--enregistrer-le-telephone)
5. [Comprendre les profils](#5-comprendre-les-profils)
6. [Gestion courante](#6-gestion-courante)
7. [Verrouiller le telephone — Mode kiosque](#7-verrouiller-le-telephone--mode-kiosque)
8. [FAQ et depannage](#8-faq-et-depannage)

---

## 1. Pre-requis

- Un telephone Android (Samsung XCover 5 recommande)
- Une connexion internet (WiFi ou 4G) sur le telephone
- Un acces administrateur au backoffice Chaos RouteManager
- Connaitre le **numero IMEI** du telephone (voir ci-dessous)

### Trouver le numero IMEI du telephone

Le numero IMEI est un identifiant unique a 15 chiffres grave dans chaque telephone.

**Methode 1 — Depuis le telephone :**
- Ouvrir le **Telephone** (app d'appel)
- Taper `*#06#` sur le clavier
- Le numero IMEI s'affiche a l'ecran

**Methode 2 — Depuis les parametres :**
- Parametres > A propos du telephone > IMEI

**Methode 3 — Sur la boite :**
- Le numero IMEI figure sur l'etiquette collee sur la boite d'origine

> **Conseil** : notez le numero IMEI sur un post-it colle au dos du telephone ou dans un fichier de suivi.

---

## 2. Etape 1 — Creer l'appareil dans le backoffice

### Acceder a la page Appareils

Dans la barre laterale, repérez la section **Administration** :

```
┌─────────────────────────────┐
│  CHAOS ROUTEMANAGER         │
│─────────────────────────────│
│  ...                        │
│                             │
│  ▼ ADMINISTRATION           │
│    ├─ Utilisateurs          │
│    ├─ Roles                 │
│    ├─ Parametres            │
│    └─ Guide telephones      │  <── reference
│                             │
│  ...                        │
│  ▼ BASE DE DONNEES          │
│    ├─ ...                   │
│    └─ Appareils             │  <── cliquez ici
│                             │
└─────────────────────────────┘
```

Cliquez sur **Appareils** pour ouvrir la gestion des telephones.

### Creer un nouvel appareil

Cliquez sur le bouton **+ Ajouter** en haut a droite.

Le formulaire de creation s'ouvre :

```
┌─────────────────────────────────────────────┐
│  NOUVEL APPAREIL                            │
│─────────────────────────────────────────────│
│                                             │
│  Nom de l'appareil *                        │
│  ┌─────────────────────────────────────┐    │
│  │ 355321082345678                     │    │
│  └─────────────────────────────────────┘    │
│  → Saisir le numero IMEI du telephone       │
│    (15 chiffres, cf. *#06# sur le tel)      │
│                                             │
│  Base logistique                            │
│  ┌─────────────────────────────────────┐    │
│  │ VLB                            ▼    │    │
│  └─────────────────────────────────────┘    │
│  → Selectionner la base d'affectation       │
│                                             │
│  Profil                                     │
│  ┌─────────────────────────────────────┐    │
│  │ Chauffeur                      ▼    │    │
│  └─────────────────────────────────────┘    │
│  → Choisir le profil (voir section 5)       │
│                                             │
│          [ Annuler ]  [ Enregistrer ]       │
│                                             │
└─────────────────────────────────────────────┘
```

| Champ | Quoi saisir | Pourquoi |
|-------|-------------|----------|
| **Nom de l'appareil** | Le numero **IMEI** du telephone | Permet d'identifier physiquement chaque telephone de maniere unique. Si un telephone est echange, perdu ou remplace, on sait exactement lequel est concerne. |
| **Base logistique** | La base ou le telephone sera utilise | Filtre les donnees affichees sur le telephone (tours, stocks, etc.) |
| **Profil** | Chauffeur, Reception base ou Inventaire | Determine les fonctionnalites accessibles sur le telephone (voir section 5) |

Cliquez sur **Enregistrer**. L'appareil apparait dans la liste avec un **code d'enregistrement** (6-8 caracteres) et un **QR code**.

> **Important** : le nom = IMEI permet de retrouver quel telephone physique correspond a quel appareil dans le systeme. En cas de doute, tapez `*#06#` sur le telephone et comparez avec la liste.

---

## 3. Etape 2 — Installer l'APK sur le telephone

1. Ouvrir le **navigateur Chrome** sur le telephone
2. Scanner le QR code affiche sur la page Appareils du backoffice
   - OU saisir manuellement : `https://chaosroute.chaosmanager.tech/apk/cmro-driver.apk`
3. Telecharger et installer l'APK
   - Si demande : autoriser l'installation depuis **Sources inconnues**
   - Parametres > Applications > Acces special > Installation d'apps inconnues > Chrome > Autoriser

---

## 4. Etape 3 — Enregistrer le telephone

1. Ouvrir l'application **CMRO Driver** sur le telephone
2. L'ecran d'enregistrement s'affiche automatiquement (premiere ouverture)

```
┌─────────────────────────────────────┐
│                                     │
│         CMRO Driver                 │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  Scanner le QR code         │   │
│   │  [    camera viewfinder   ] │   │
│   └─────────────────────────────┘   │
│                                     │
│   ── OU ──                          │
│                                     │
│   Code manuel :                     │
│   ┌─────────────────────────────┐   │
│   │ A1B2C3D4                    │   │
│   └─────────────────────────────┘   │
│                                     │
│       [ Enregistrer ]               │
│                                     │
└─────────────────────────────────────┘
```

**Option A — Scanner le QR code** (recommande) :
- Pointer la camera du telephone vers le QR code affiche sur le backoffice
- L'enregistrement se fait automatiquement

**Option B — Saisie manuelle** :
- Taper le code a 6-8 caracteres affiche sous le QR code dans le backoffice
- Appuyer sur **Enregistrer**

3. L'application affiche l'ecran de connexion → le telephone est enregistre
4. Se connecter avec les identifiants chauffeur (login / mot de passe)

> **Verification** : dans le backoffice, la colonne "Enregistre" passe a **Oui** pour cet appareil.

---

## 5. Comprendre les profils

Le profil determine ce que le chauffeur ou l'operateur peut faire sur le telephone.

### Tableau des profils

| Profil | Fonctionnalites | Qui l'utilise |
|--------|----------------|---------------|
| **Chauffeur** | **Tours** : voir ses tournees du jour, les stops, les quantites a livrer. Suivi GPS en temps reel. | Le chauffeur en livraison |
| | **Reprises** : scanner et traiter les reprises de contenants chez les PDV. | |
| | **Declarations** : soumettre des declarations (incidents, carburant, heures). | |
| **Reception base** | **Reception** : scanner les marchandises arrivant a la base. Valider les receptions. | L'operateur en entrepot |
| **Inventaire** | **Inventaire** : compter le stock sur un PDV ou a la base. Saisir les quantites. | Le personnel d'inventaire |

### Quel profil choisir ?

```
Le telephone va dans le camion ?
  └─ OUI → Profil CHAUFFEUR

Le telephone reste a la base pour scanner les arrivages ?
  └─ OUI → Profil RECEPTION BASE

Le telephone sert a compter du stock ?
  └─ OUI → Profil INVENTAIRE
```

> **Note** : le profil peut etre modifie a tout moment depuis le backoffice sans reinstaller l'application. La modification prend effet au prochain lancement de l'app.

---

## 6. Gestion courante

### Changer le profil d'un appareil

1. Page **Appareils** > cliquer sur l'icone **modifier** de l'appareil
2. Changer le **Profil** dans le menu deroulant
3. **Enregistrer**
4. Le chauffeur relance l'app → les nouvelles fonctionnalites apparaissent

### Remplacer un telephone (panne, casse)

1. Page **Appareils** > trouver l'ancien telephone (par son IMEI)
2. Cliquer sur **Reinitialiser l'identite** (bouton reset)
3. Modifier le **Nom de l'appareil** avec le nouvel IMEI
4. Scanner le QR code avec le nouveau telephone
5. L'ancien telephone ne peut plus se connecter

### Desactiver un telephone

1. Page **Appareils** > cliquer sur l'icone **supprimer**
2. Choisir **Desactiver** (conserve l'historique) ou **Supprimer definitivement**
3. Le telephone ne peut plus acceder a l'application

### Verifier qu'un telephone n'est pas deja enregistre

Avant de creer un nouvel appareil, recherchez l'IMEI dans la liste des appareils existants.
Si l'IMEI figure deja, ne creez pas de doublon : reutilisez l'appareil existant ou reintialisez son identite.

---

## 7. Verrouiller le telephone — Mode kiosque

L'objectif est que le chauffeur n'ait acces a **rien d'autre que CMRO Driver** sur le telephone.
Toutes les icones sont supprimees de l'ecran d'accueil, seule l'app CMRO reste visible.
Le chauffeur peut toujours acceder aux parametres via le menu des applications, mais cela necessite une action volontaire (balayer vers le haut).

### Etape 1 — Supprimer toutes les icones de l'ecran d'accueil

1. Sur l'ecran d'accueil, **maintenir appuye** sur chaque icone
2. Selectionner **Supprimer** (et non "Desinstaller" — on retire l'icone, pas l'app)
3. Repeter pour **toutes** les icones : Chrome, Galerie, Messages, Telephone, etc.
4. Ne garder que **CMRO Driver**

> **Astuce** : sur Samsung, les icones de la barre du bas (dock) se suppriment de la meme facon.

### Etape 2 — Desactiver le tiroir d'applications (optionnel, Samsung)

Pour empecher l'acces au tiroir d'apps par balayage vers le haut :

1. **Maintenir appuye** sur une zone vide de l'ecran d'accueil
2. Appuyer sur **Parametres** (icone engrenage en bas)
3. **Disposition ecran d'accueil** > choisir **Ecran d'accueil uniquement**
4. Toutes les apps apparaissent alors sur l'ecran d'accueil — supprimer toutes les icones sauf CMRO

> Avec cette option, le balayage vers le haut n'ouvre plus le tiroir d'apps.

### Etape 3 — Epingler l'application (mode ecran epingle)

Le mode epingle bloque le telephone sur une seule application. Pour quitter, il faut maintenir 2 boutons simultanement.

1. Ouvrir **CMRO Driver**
2. Appuyer sur le bouton **Vue recente** (carre en bas de l'ecran)
3. Appuyer sur l'icone de l'app CMRO en haut de la carte > **Epingler cette application**
4. Confirmer

**Pour desepingler** (operation volontaire) :
- Maintenir simultanement **Retour** + **Vue recente** pendant 3 secondes

> Pour activer l'epinglage : Parametres > Securite > Autres parametres de securite > Epingler les fenetres > **Activer**

### Etape 4 — Desactiver les notifications inutiles

1. Parametres > **Notifications** > **Notifications des applications**
2. Desactiver les notifications pour toutes les apps sauf CMRO Driver
3. Cela evite les pop-ups publicitaires ou systeme qui perturbent le chauffeur

### Resultat final

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│          ┌──────────┐           │
│          │  CMRO    │           │
│          │  Driver  │           │
│          └──────────┘           │
│                                 │
│                                 │
│                                 │
│  ○          ○          □        │
└─────────────────────────────────┘
  Seule l'icone CMRO est visible.
  Ecran epingle = impossible de
  quitter sans action volontaire.
```

> **Rappel** : ces reglages se font une seule fois par telephone, avant de le remettre au chauffeur. Les mises a jour de l'app CMRO se font automatiquement sans toucher a cette configuration.

---

## 8. FAQ et depannage

**Q : Le telephone affiche "Code invalide" lors de l'enregistrement**
R : Verifiez que le code saisi correspond exactement a celui affiche dans le backoffice. Le code est sensible a la casse.

**Q : Le telephone est enregistre mais l'app affiche un ecran vide**
R : Verifiez que le profil est correctement assigne et que le chauffeur a un login/mot de passe valide.

**Q : Comment savoir quel telephone correspond a quel chauffeur ?**
R : Le nom de l'appareil (IMEI) identifie le telephone physique. Le login du chauffeur identifie l'utilisateur. Croisez les deux dans le registre de distribution des telephones.

**Q : Un chauffeur utilise le telephone d'un collegue**
R : L'application fonctionne avec le login du chauffeur connecte, pas avec l'appareil. Les tours affiches sont ceux du chauffeur connecte, quel que soit le telephone. Le profil de l'appareil determine uniquement les fonctionnalites disponibles (pas les donnees).

**Q : Comment ajouter un nouveau transporteur et son chauffeur ?**
R : 1) Creer le chauffeur dans Utilisateurs avec un role Chauffeur. 2) Creer l'appareil avec l'IMEI. 3) Donner le login et le telephone au chauffeur.

---

> **Support** : en cas de probleme, contactez l'administrateur de la plateforme.
> Application : Chaos RouteManager — chaosroute.chaosmanager.tech
