#!/bin/bash
# =============================================================
# Setup initial du VPS Hostinger / Initial VPS setup
# À exécuter une seule fois en root / Run once as root
# Usage : sudo bash setup-server.sh
# =============================================================
set -e

REPO_URL="https://github.com/CocoyeWtf/Aegis_V3.git"
DEV_USER="dev"

echo "=== 1. Mise à jour système / System update ==="
apt update && apt upgrade -y

echo "=== 2. Installation Docker ==="
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=== 3. Installation outils dev (Node.js, Python, git) ==="
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Python 3 + venv + pip
apt install -y python3 python3-pip python3-venv git

echo "=== 4. Création utilisateur dev / Creating dev user ==="
if ! id "$DEV_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$DEV_USER"
    usermod -aG docker "$DEV_USER"
    echo "Utilisateur $DEV_USER créé. Configurer la clé SSH :"
    echo "  mkdir -p /home/$DEV_USER/.ssh"
    echo "  cat votre_clé.pub >> /home/$DEV_USER/.ssh/authorized_keys"
    echo "  chown -R $DEV_USER:$DEV_USER /home/$DEV_USER/.ssh"
fi

echo "=== 5. Configuration firewall UFW ==="
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (prod)
ufw --force enable
echo "Firewall activé : SSH(22) + HTTP(80) uniquement"

echo "=== 6. Clone du repo ==="
# Environnement dev
if [ ! -d "/home/$DEV_USER/Chaos_Route" ]; then
    su - "$DEV_USER" -c "git clone $REPO_URL /home/$DEV_USER/Chaos_Route"
fi

# Environnement prod
if [ ! -d "/opt/chaos-route" ]; then
    git clone "$REPO_URL" /opt/chaos-route
    chown -R "$DEV_USER:$DEV_USER" /opt/chaos-route
fi

echo "=== 7. Setup venv Python dev ==="
su - "$DEV_USER" -c "
    cd /home/$DEV_USER/Chaos_Route/backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
"

echo "=== 8. Setup frontend dev ==="
su - "$DEV_USER" -c "
    cd /home/$DEV_USER/Chaos_Route/frontend
    npm ci
"

echo "=== 9. Génération SECRET_KEY prod ==="
SECRET=$(openssl rand -hex 32)
if [ ! -f /opt/chaos-route/.env.production ]; then
    cp /opt/chaos-route/.env.production.example /opt/chaos-route/.env.production
    sed -i "s|<générer-avec-openssl-rand-hex-32>|$SECRET|g" /opt/chaos-route/.env.production
    echo "SECRET_KEY générée. Modifier CORS_ORIGINS dans /opt/chaos-route/.env.production"
else
    echo ".env.production existe déjà, ignoré"
fi

# Créer le dossier data prod
mkdir -p /opt/chaos-route/data
chown -R "$DEV_USER:$DEV_USER" /opt/chaos-route/data

echo ""
echo "=========================================="
echo " Setup terminé / Setup complete"
echo "=========================================="
echo ""
echo "Prochaines étapes / Next steps :"
echo "  1. Configurer la clé SSH pour l'utilisateur dev"
echo "  2. Modifier /opt/chaos-route/.env.production (CORS_ORIGINS = IP du VPS)"
echo "  3. cd /opt/chaos-route && sudo ./deploy.sh"
echo ""
