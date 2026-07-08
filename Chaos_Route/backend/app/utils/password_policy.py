"""
Politique de mot de passe / Password policy.

Point unique de validation de la force des mots de passe (remédiation STIME A2).
Branché sur tous les flux : création/modification utilisateur, changement et
réinitialisation de mot de passe, seed du superadmin.

Règles :
- Longueur ≥ 12 caractères (≥ 14 pour les comptes privilégiés / superadmin).
- Au moins 3 des 4 classes : minuscule, majuscule, chiffre, symbole.
- Rejet des mots de passe courants (liste top-N, insensible à la casse).
"""

import re

MIN_LENGTH = 12
MIN_LENGTH_PRIVILEGED = 14

# Mots de passe courants (top-N + variantes FR + termes du domaine).
# Comparaison insensible à la casse, chiffres/symboles de fin ignorés
# (ex. « Motdepasse2026! » est rejeté).
# Common passwords (top-N + FR variants + domain terms). Case-insensitive,
# trailing digits/symbols stripped before comparison.
COMMON_PASSWORDS = frozenset({
    "password", "passw0rd", "passwort", "pass", "motdepasse", "mdp",
    "azerty", "azertyuiop", "qwerty", "qwertyuiop", "qwertz",
    "123456", "1234567", "12345678", "123456789", "1234567890",
    "12345678910", "0123456789", "987654321", "abc123", "abcd1234",
    "admin", "administrateur", "administrator", "root", "superadmin",
    "welcome", "bienvenue", "bonjour", "hello", "salut",
    "letmein", "iloveyou", "jetaime", "monkey", "dragon", "sunshine",
    "princess", "football", "baseball", "soccer", "master", "shadow",
    "michael", "jordan", "superman", "batman", "trustno1", "starwars",
    "soleil", "chocolat", "doudou", "loulou", "chouchou", "camille",
    "marseille", "nicolas", "julien", "thomas", "olivier", "vanille",
    "secret", "secret123", "changeme", "change-me", "temp", "temporaire",
    "test", "test123", "demo", "demo123", "user", "utilisateur",
    "aaaaaa", "abcdef", "abcdefgh", "azazaz", "wxcvbn",
    "chaos", "chaosroute", "chaosmanager", "routemanager", "chaosroutemanager",
    "intermarche", "mousquetaires", "stime", "logistique", "transport",
})

# Classes de caractères / Character classes
_RE_LOWER = re.compile(r"[a-zà-öø-ÿ]")
_RE_UPPER = re.compile(r"[A-ZÀ-ÖØ-Þ]")
_RE_DIGIT = re.compile(r"\d")
_RE_SYMBOL = re.compile(r"[^a-zA-Zà-öø-ÿÀ-ÖØ-Þ0-9]")


class PasswordPolicyError(ValueError):
    """Mot de passe refusé par la politique / Password rejected by policy."""


def _normalize_for_blocklist(password: str) -> str:
    """Réduire aux lettres de base pour la comparaison à la liste noire /
    Strip trailing digits/symbols and lowercase for blocklist comparison."""
    return re.sub(r"[\d\W_]+$", "", password.lower())


def validate_password_strength(password: str, privileged: bool = False) -> str:
    """Valider la force d'un mot de passe / Validate password strength.

    Args:
        password: le mot de passe en clair à valider.
        privileged: True pour un compte à privilèges (superadmin) → 14 car. min.

    Returns:
        Le mot de passe inchangé si valide (utilisable en validateur Pydantic).

    Raises:
        PasswordPolicyError: message explicite (FR) si le mot de passe est refusé.
    """
    min_length = MIN_LENGTH_PRIVILEGED if privileged else MIN_LENGTH
    if len(password) < min_length:
        suffix = " (compte à privilèges)" if privileged else ""
        raise PasswordPolicyError(
            f"Le mot de passe doit contenir au moins {min_length} caractères{suffix}."
        )

    classes = sum([
        bool(_RE_LOWER.search(password)),
        bool(_RE_UPPER.search(password)),
        bool(_RE_DIGIT.search(password)),
        bool(_RE_SYMBOL.search(password)),
    ])
    if classes < 3:
        raise PasswordPolicyError(
            "Le mot de passe doit combiner au moins 3 types de caractères parmi : "
            "minuscules, majuscules, chiffres, symboles."
        )

    lowered = password.lower()
    if lowered in COMMON_PASSWORDS or _normalize_for_blocklist(password) in COMMON_PASSWORDS:
        raise PasswordPolicyError(
            "Ce mot de passe est trop courant : choisissez un mot de passe plus original."
        )

    return password
