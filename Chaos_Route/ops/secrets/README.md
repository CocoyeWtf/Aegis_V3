# Chiffrement au repos & gestion des secrets (STIME B3)

Répond au point **B3** du [plan de remédiation](../../docs/PLAN_REMEDIATION_STIME.md) :
chiffrement du stockage de la base + sortie des secrets du `.env` en clair.
Exécution : Dominic sur le VPS (fenêtre de maintenance requise pour la partie disque).

## 1. Secrets chiffrés avec SOPS + age

Principe : `.env.production` n'existe plus en clair sur le disque ; il est
stocké chiffré (`.env.production.sops`) et déchiffré uniquement au moment du
`docker compose up`, vers un fichier temporaire à droits restreints.

### Installation (une fois)

```bash
# Sur le VPS
apt-get install -y age
curl -LO https://github.com/getsops/sops/releases/latest/download/sops-v3.9.4.linux.amd64
install -m 755 sops-v3.9.4.linux.amd64 /usr/local/bin/sops

# Clé age DÉDIÉE aux secrets (différente de la clé backup) — générée hors VPS,
# la clé privée est déposée dans /root/.config/sops/age/keys.txt (chmod 600)
# et sa COPIE DE SECOURS dans le coffre de mots de passe.
age-keygen -o secrets_key.txt
mkdir -p /root/.config/sops/age && cp secrets_key.txt /root/.config/sops/age/keys.txt
chmod 600 /root/.config/sops/age/keys.txt
```

### Migration du .env existant

```bash
cd /opt/chaos-route   # (répertoire compose réel)
PUBKEY=$(grep -o 'age1[a-z0-9]*' /root/.config/sops/age/keys.txt | head -1)
sops --encrypt --age "$PUBKEY" .env.production > .env.production.sops
shred -u .env.production          # suppression sûre du fichier en clair
```

### Déploiement (adapter deploy.sh)

```bash
# Avant docker compose up : déchiffrement éphémère
umask 077
sops --decrypt .env.production.sops > .env.production
docker compose up -d --build
rm -f .env.production             # le compose a chargé les variables ; plus de clair au repos
```

> Note : `docker compose` lit `env_file` au démarrage du conteneur ; après
> `rm`, un simple `docker compose restart` suffit tant que le conteneur n'est
> pas recréé. Pour un `up` ultérieur, redéchiffrer d'abord (le script deploy.sh
> doit encapsuler ces étapes).

### Édition d'un secret

```bash
sops .env.production.sops   # ouvre l'éditeur, rechiffre à la sauvegarde
```

## 2. Rotation des clés et secrets

| Secret | Rotation | Procédure |
|---|---|---|
| `SECRET_KEY` (JWT) | annuelle ou sur suspicion | générer `openssl rand -hex 32`, éditer via sops, redéployer — invalide toutes les sessions (prévenir les utilisateurs) |
| `POSTGRES_PASSWORD` | annuelle | `ALTER USER cmro WITH PASSWORD '...'` puis MAJ sops + redéploiement |
| `SMS_API_KEY` | annuelle | régénérer, MAJ sops + config Termux |
| `ADMIN_PASSWORD` | consommé au seed uniquement | retirer du sops après premier démarrage d'une instance neuve |
| Clé age secrets | sur compromission | générer nouvelle paire, `sops updatekeys`, remplacer keys.txt + coffre |

Chaque rotation est consignée (date + opérateur) dans le journal d'exploitation.

## 3. Chiffrement du volume de la base (disque)

Contexte : VPS Hostinger, disque non chiffré par défaut. Deux options par ordre
de préférence :

### Option A — Volume LUKS dédié pour PostgreSQL (recommandé)

```bash
# Fenêtre de maintenance ~30 min. AVANT TOUT : backup vérifié (ops/backup).
docker compose stop app && docker compose stop db

# 1. Fichier-conteneur chiffré de 20 Go (ajuster) monté sur /srv/pgdata-crypt
fallocate -l 20G /root/pgdata.img
cryptsetup luksFormat /root/pgdata.img        # passphrase → coffre
cryptsetup open /root/pgdata.img pgdata_crypt
mkfs.ext4 /dev/mapper/pgdata_crypt
mkdir -p /srv/pgdata-crypt && mount /dev/mapper/pgdata_crypt /srv/pgdata-crypt

# 2. Migrer les données du volume Docker pgdata
docker run --rm -v chaos_route_pgdata:/from -v /srv/pgdata-crypt:/to alpine \
    sh -c "cp -a /from/. /to/"

# 3. docker-compose.yml : remplacer le volume nommé par un bind mount
#      volumes:
#        - /srv/pgdata-crypt:/var/lib/postgresql/data
docker compose up -d db && docker compose up -d app
```

**Conséquence assumée** : après un reboot du VPS, le volume doit être déverrouillé
manuellement (`cryptsetup open` + `mount` + `docker compose up -d`) — la
passphrase n'est PAS stockée sur le VPS (sinon le chiffrement ne protège rien).
Documenter dans le runbook incident ; l'alerting B4 détectera l'app down.

### Option B — si l'hébergeur propose le chiffrement de disque

Vérifier dans hPanel Hostinger si le chiffrement du disque VPS est proposé ;
si oui, l'activer couvre tout (base + fichiers + logs) sans la contrainte de
déverrouillage manuel. À privilégier si disponible.

### Fichiers applicatifs

Les photos/documents (`./data`, `./pdv-plans`, `./apk`) suivent la même logique :
si Option A retenue, créer un second conteneur LUKS ou déplacer ces répertoires
sur le même volume chiffré.

## 4. Preuves pour l'audit STIME

- `lsblk` / `cryptsetup status pgdata_crypt` → volume chiffré actif (Q27/28/105).
- Absence de `.env.production` en clair (`ls -la /opt/chaos-route`) + présence
  du `.sops` (Q114).
- Ce document = procédure de rotation exigée (Q114).
