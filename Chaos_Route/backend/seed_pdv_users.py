"""Seed PDV user accounts / Création comptes utilisateurs PDV.

Pour chaque PDV en base :
- Met à jour l'email au format PDV0{code}@mousquetaires.com
- Crée un utilisateur avec login PDV0{code}, mdp 0{code}, lié au PDV
- Assigne le rôle "PDV" (créé si inexistant) avec permissions limitées

Usage: python seed_pdv_users.py
"""

import sqlite3
import bcrypt

DB_PATH = "chaos_route.db"

# Permissions du rôle PDV / PDV role permissions
PDV_PERMISSIONS = [
    ("pdvs", "read"),
    ("pickup-requests", "read"),
    ("pickup-requests", "create"),
    ("pdv-stock", "read"),
    ("dashboard", "read"),
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Créer ou récupérer le rôle PDV / Create or get PDV role
    cur.execute("SELECT id FROM roles WHERE name = 'PDV'")
    row = cur.fetchone()
    if row:
        role_id = row[0]
        print(f"Rôle PDV existant (id={role_id})")
    else:
        cur.execute("INSERT INTO roles (name, description) VALUES (?, ?)", ("PDV", "Utilisateur Point de Vente — accès limité à son PDV"))
        role_id = cur.lastrowid
        print(f"Rôle PDV créé (id={role_id})")

    # 2. Ajouter les permissions au rôle / Add permissions to role
    for resource, action in PDV_PERMISSIONS:
        cur.execute(
            "SELECT id FROM permissions WHERE role_id = ? AND resource = ? AND action = ?",
            (role_id, resource, action),
        )
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO permissions (role_id, resource, action) VALUES (?, ?, ?)",
                (role_id, resource, action),
            )
            print(f"  Permission ajoutée : {resource}:{action}")

    # 3. Charger tous les PDVs / Load all PDVs
    pdvs = cur.execute("SELECT id, code, name FROM pdvs ORDER BY code").fetchall()
    print(f"\n{len(pdvs)} PDVs trouvés")

    created = 0
    skipped = 0
    emails_updated = 0

    for pdv_id, code, name in pdvs:
        login = f"PDV0{code}"
        email = f"{login}@mousquetaires.com"
        password = f"0{code}"

        # 4. Mettre à jour l'email du PDV / Update PDV email
        cur.execute("UPDATE pdvs SET email = ? WHERE id = ?", (email, pdv_id))
        emails_updated += 1

        # 5. Vérifier si l'utilisateur existe déjà / Check if user already exists
        cur.execute("SELECT id FROM users WHERE username = ?", (login,))
        if cur.fetchone():
            skipped += 1
            continue

        # Vérifier unicité email / Check email uniqueness
        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cur.fetchone():
            print(f"  WARN Email deja pris pour {login}, skip")
            skipped += 1
            continue

        # 6. Créer l'utilisateur / Create user
        hashed = hash_password(password)
        cur.execute(
            "INSERT INTO users (username, email, hashed_password, is_active, is_superadmin, pdv_id) VALUES (?, ?, ?, 1, 0, ?)",
            (login, email, hashed, pdv_id),
        )
        user_id = cur.lastrowid

        # 7. Assigner le rôle PDV / Assign PDV role
        cur.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", (user_id, role_id))

        created += 1
        print(f"  OK {login} (PDV {code} - {name})")

    conn.commit()
    conn.close()

    print(f"\nResume : {created} comptes crees, {skipped} ignores, {emails_updated} emails mis a jour")


if __name__ == "__main__":
    main()
