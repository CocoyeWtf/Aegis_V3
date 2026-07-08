# Supervision & alerting CHAOS Platform (STIME B4)

Répond au point **B4** du [plan de remédiation](../../docs/PLAN_REMEDIATION_STIME.md) :
« Alerte reçue en < 5 min si service down ; logs agrégés 6 mois ».

## Architecture

```
Conteneurs Docker ──▶ Promtail ──▶ Loki (rétention 180 j) ◀── Grafana
                                                              https://chaosroute.chaosmanager.tech/grafana/
Watchdog cron (2 min) ──▶ ntfy.sh/<topic secret> ──▶ push téléphone (app ntfy)
UptimeRobot (externe) ──▶ email/push si le VPS entier est mort
```

| Composant | Rôle | Couvre |
|---|---|---|
| **Loki + Promtail** | Agrégation des logs de tous les conteneurs, rétention 180 j | Q15/Q60 (logs ≥ 6 mois centralisés) |
| **Grafana** | Consultation/recherche des logs (`/grafana`, compte admin local) | Requête d'extraction < 24 h |
| **Watchdog** (`chaos_watchdog.sh`) | Toutes les 2 min : API HTTPS, santé des 3 conteneurs, disque > 85 % → push ntfy urgent, rappel 30 min, message de rétablissement | Q138/139 (alerte < 5 min) |
| **UptimeRobot** (à créer, 10 min) | Sonde HTTP externe sur `https://chaosroute.chaosmanager.tech/api/` toutes les 5 min | VPS/réseau entièrement down (le watchdog local ne peut pas s'auto-alerter) |

## Réception des alertes (Dominic, 2 minutes)

1. Installer l'app **ntfy** (Android/iOS, gratuit, sans compte).
2. S'abonner au topic secret : valeur `NTFY_TOPIC` de `/root/.chaos_watchdog.env`
   sur le VPS (le topic fait office de secret — ne pas le publier).
3. Tester : `ssh root@76.13.58.182 '/root/ops/chaos_watchdog.sh'` après avoir
   arrêté un conteneur de test, ou simplement
   `curl -d test ntfy.sh/<topic>` → la notification doit sonner.

## Sonde externe (Dominic, 10 minutes — recommandé)

Créer un compte gratuit [UptimeRobot](https://uptimerobot.com) (ou Better Stack) :
moniteur HTTP(S) sur `https://chaosroute.chaosmanager.tech/api/`, intervalle 5 min,
alerte email + push. C'est la seule couverture du scénario « VPS injoignable ».

## Exploitation

- **Chercher dans les logs** : Grafana → Explore → Loki →
  `{container="chaos-route-app-1"} |= "ERROR"` (6 mois d'historique).
- Mot de passe Grafana : `/root/.grafana_admin` (chmod 600). Changer au premier login si souhaité.
- Journal du watchdog : `/var/log/chaos_watchdog.log`.
- La pile monitoring est **indépendante** du compose applicatif : un
  `deploy.sh` ne la redémarre pas ; MàJ via
  `docker compose -f ops/monitoring/docker-compose.monitoring.yml up -d` après un pull.

## Empreinte

~400 Mo de RAM (Loki+Promtail+Grafana) sur les 15 Go du VPS ; logs sur volume
Docker `loki_data`, croissance bornée par la rétention 180 j.
