# WAF & anti-DDoS (STIME B5) — note de décision

Réf. Q36/Q138. État actuel : Caddy TLS + headers durcis + rate limiting
applicatif (slowapi : login 5/min, GPS 30/min) + middleware anti-XSS backend.
Il manque une couche WAF (règles OWASP) et une protection DDoS réseau.

## Option A — Cloudflare (recommandée) — décision D, ~1 h

Gratuit pour ce besoin, standard de fait, zéro maintenance serveur :
1. Ajouter le domaine `chaosmanager.tech` à un compte Cloudflare (plan Free).
2. Reporter les DNS chez Cloudflare (chaosroute + mexprt en « proxied » 🟠).
3. SSL/TLS mode **Full (strict)** (le certificat Caddy reste en place).
4. Activer : WAF Managed Rules (OWASP core), Bot Fight Mode, rate limiting
   (ex. 100 req/10 s par IP sur `/api/*`).
5. Restaurer l'IP réelle dans les logs : ajouter `trusted_proxies` Cloudflare
   dans le Caddyfile (sinon l'audit log verra les IP Cloudflare).
6. (Optionnel, fort) N'autoriser en firewall VPS (ufw) le 80/443 que depuis
   [les plages IP Cloudflare](https://www.cloudflare.com/ips/) → l'origine
   devient injoignable en direct, le WAF est incontournable.

**Ce que ça couvre :** OWASP top 10 en périmètre, DDoS L3/L4/L7, bots.
**Impact :** migration DNS (TTL court, coupure ~0) ; l'app mobile ne change pas.

## Option B — Coraza WAF dans Caddy (sans tiers)

Module [coraza-caddy](https://github.com/corazawaf/coraza-caddy) + OWASP CRS,
compilé via `xcaddy` (image Docker custom à maintenir). Pas de dépendance
externe, mais : build custom à chaque mise à jour Caddy, tuning CRS manuel
(faux positifs sur les imports Excel volumineux à prévoir), et **aucune
protection DDoS volumétrique** (le VPS reste saturable en amont).

## Recommandation

**Option A.** L'option B ne protège pas du DDoS (exigence Q138) et ajoute de
la maintenance. Prérequis : accès registrar pour changer les NS — à faire dans
une fenêtre calme, tablettes prévenues (aucun changement app attendu).

Une fois la décision prise, l'exécution (config Cloudflare + trusted_proxies
Caddy + ufw) peut être pilotée par Claude Code en ~1 h.
