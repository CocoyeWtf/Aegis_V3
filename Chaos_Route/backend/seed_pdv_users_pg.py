"""Seed PDV user accounts on PostgreSQL / Creation comptes utilisateurs PDV (prod).

Usage: docker exec chaos-route-app-1 python seed_pdv_users_pg.py
"""

import os
import bcrypt

# psycopg2 for sync PostgreSQL access
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "")
# Convert asyncpg URL to psycopg2 format
DSN = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

PDV_PERMISSIONS = [
    ("pdvs", "read"),
    ("pickup-requests", "read"),
    ("pickup-requests", "create"),
    ("pdv-stock", "read"),
    ("support-types", "read"),
    ("dashboard", "read"),
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. Role PDV
    cur.execute("SELECT id FROM roles WHERE name = 'PDV'")
    row = cur.fetchone()
    if row:
        role_id = row[0]
        print(f"Role PDV existant (id={role_id})")
    else:
        cur.execute("INSERT INTO roles (name, description) VALUES (%s, %s) RETURNING id",
                     ("PDV", "Utilisateur Point de Vente"))
        role_id = cur.fetchone()[0]
        print(f"Role PDV cree (id={role_id})")

    # 2. Permissions
    for resource, action in PDV_PERMISSIONS:
        cur.execute("SELECT id FROM permissions WHERE role_id = %s AND resource = %s AND action = %s",
                     (role_id, resource, action))
        if not cur.fetchone():
            cur.execute("INSERT INTO permissions (role_id, resource, action) VALUES (%s, %s, %s)",
                         (role_id, resource, action))
            print(f"  Permission: {resource}:{action}")

    # 3. Load PDVs
    cur.execute("SELECT id, code, name FROM pdvs ORDER BY code")
    pdvs = cur.fetchall()
    print(f"\n{len(pdvs)} PDVs")

    created = 0
    skipped = 0

    for pdv_id, code, name in pdvs:
        login = f"PDV0{code}"
        email = f"{login}@mousquetaires.com"
        password = f"0{code}"

        # Update PDV email
        cur.execute("UPDATE pdvs SET email = %s WHERE id = %s", (email, pdv_id))

        # Check existing user
        cur.execute("SELECT id FROM users WHERE username = %s", (login,))
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            skipped += 1
            continue

        # Create user
        hashed = hash_password(password)
        cur.execute(
            "INSERT INTO users (username, email, hashed_password, is_active, is_superadmin, pdv_id) VALUES (%s, %s, %s, true, false, %s) RETURNING id",
            (login, email, hashed, pdv_id),
        )
        user_id = cur.fetchone()[0]

        # Assign role
        cur.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)", (user_id, role_id))

        created += 1
        print(f"  OK {login} ({name})")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone: {created} created, {skipped} skipped")


if __name__ == "__main__":
    main()
