# Passerelle SMS Termux

Envoie les SMS de notification (n° de quai) aux chauffeurs via un smartphone Android.

## Installation sur le telephone

1. Installer **Termux** + **Termux:API** + **Termux:Boot** depuis F-Droid
2. Dans Termux :
   ```bash
   pkg install python termux-api
   pip install requests
   ```
3. Copier les fichiers :
   ```bash
   # Depuis un PC (adb ou scp)
   adb push gateway.py /data/data/com.termux/files/home/
   adb push config.py /data/data/com.termux/files/home/
   ```
4. Editer `config.py` avec la bonne API_KEY
5. Tester : `python ~/gateway.py`

## Lancement automatique au demarrage

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start_sms_gateway.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
sleep 30
python ~/gateway.py >> ~/sms_gateway.log 2>&1 &
EOF
chmod +x ~/.termux/boot/start_sms_gateway.sh
```

## Configuration serveur

Ajouter dans `/opt/chaos-route/.env` :
```
SMS_API_KEY=votre_cle_secrete
```

## Fonctionnement

- Le script tourne en boucle (toutes les 60 secondes)
- Il interroge `GET /api/sms/pending/` pour recuperer les SMS en attente
- Il envoie chaque SMS via `termux-sms-send`
- Il confirme l'envoi via `POST /api/sms/{id}/sent`
- Apres 3 echecs, le SMS passe en FAILED
- Delai de 5s entre chaque SMS (anti-spam operateur)
