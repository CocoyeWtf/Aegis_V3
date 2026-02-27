"""Seed templates inspection par defaut / Seed default inspection templates.

Appele au demarrage si la table inspection_templates est vide.
Called on startup if the inspection_templates table is empty.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inspection_template import InspectionCategory, InspectionTemplate


# (label, category, applicable_vehicle_types, is_critical, requires_photo)
# applicable_vehicle_types: CSV ou None = tous / CSV or None = all

SEED_ITEMS = [
    # === TRACTEUR ===
    ("Etat general carrosserie", InspectionCategory.EXTERIOR, "TRACTEUR,PORTEUR", False, False),
    ("Retroviseurs (intacts, regles)", InspectionCategory.EXTERIOR, "TRACTEUR,PORTEUR", True, False),
    ("Essuie-glaces (fonctionnels)", InspectionCategory.EXTERIOR, "TRACTEUR,PORTEUR", False, False),
    ("Pare-brise (pas de fissure)", InspectionCategory.EXTERIOR, "TRACTEUR,PORTEUR", False, True),

    ("Niveau huile moteur", InspectionCategory.ENGINE, "TRACTEUR,PORTEUR", True, False),
    ("Niveau liquide de refroidissement", InspectionCategory.ENGINE, "TRACTEUR,PORTEUR", True, False),
    ("Niveau liquide de frein", InspectionCategory.ENGINE, "TRACTEUR,PORTEUR", True, False),
    ("Fuites visibles (huile, eau)", InspectionCategory.ENGINE, "TRACTEUR,PORTEUR", False, True),
    ("Etat courroies", InspectionCategory.ENGINE, "TRACTEUR,PORTEUR", False, False),

    ("Pneus avant (profondeur, pression, usure)", InspectionCategory.TIRES, "TRACTEUR,PORTEUR", True, True),
    ("Pneus arriere (profondeur, pression, usure)", InspectionCategory.TIRES, "TRACTEUR,PORTEUR", True, True),

    ("Phares avant (codes et pleins phares)", InspectionCategory.LIGHTS, "TRACTEUR,PORTEUR", True, False),
    ("Feux stop", InspectionCategory.LIGHTS, "TRACTEUR,PORTEUR", True, False),
    ("Clignotants avant et arriere", InspectionCategory.LIGHTS, "TRACTEUR,PORTEUR", True, False),
    ("Feux de gabarit", InspectionCategory.LIGHTS, "TRACTEUR,PORTEUR,SEMI_REMORQUE", False, False),

    ("Ceinture de securite", InspectionCategory.CABIN, "TRACTEUR,PORTEUR", True, False),
    ("Siege chauffeur (reglable, bloque)", InspectionCategory.CABIN, "TRACTEUR,PORTEUR", False, False),
    ("Klaxon", InspectionCategory.CABIN, "TRACTEUR,PORTEUR", False, False),
    ("Tableau de bord (voyants)", InspectionCategory.CABIN, "TRACTEUR,PORTEUR", True, False),

    ("Extincteur (present, date validite)", InspectionCategory.SAFETY, None, True, False),
    ("Gilet haute visibilite", InspectionCategory.SAFETY, None, False, False),
    ("Triangle de signalisation", InspectionCategory.SAFETY, None, False, False),
    ("Cales de roue", InspectionCategory.SAFETY, "TRACTEUR,PORTEUR,SEMI_REMORQUE", False, False),

    ("Carte grise a bord", InspectionCategory.DOCUMENTS, None, False, False),
    ("Attestation d'assurance", InspectionCategory.DOCUMENTS, None, False, False),
    ("Permis de conduire", InspectionCategory.DOCUMENTS, "TRACTEUR,PORTEUR", False, False),

    # === SEMI_REMORQUE ===
    ("Etat general carrosserie semi", InspectionCategory.EXTERIOR, "SEMI_REMORQUE", False, False),
    ("Systeme d'attelage (sellette, king pin)", InspectionCategory.EXTERIOR, "SEMI_REMORQUE", True, True),
    ("Bequilles (etat, fonctionnement)", InspectionCategory.EXTERIOR, "SEMI_REMORQUE", False, False),

    ("Systeme pneumatique freins", InspectionCategory.BRAKES, "SEMI_REMORQUE", True, False),
    ("Flexibles de frein (fuites, usure)", InspectionCategory.BRAKES, "SEMI_REMORQUE", True, True),
    ("Plaquettes de frein", InspectionCategory.BRAKES, "SEMI_REMORQUE", False, False),

    ("Pneus essieu(x) semi (profondeur, pression)", InspectionCategory.TIRES, "SEMI_REMORQUE", True, True),

    ("Feux stop semi", InspectionCategory.LIGHTS, "SEMI_REMORQUE", True, False),
    ("Clignotants semi", InspectionCategory.LIGHTS, "SEMI_REMORQUE", True, False),
    ("Catadioptres", InspectionCategory.LIGHTS, "SEMI_REMORQUE", False, False),

    ("Portes arriere (ouverture, fermeture, joints)", InspectionCategory.CARGO, "SEMI_REMORQUE,PORTEUR", True, False),
    ("Plancher (etat, proprete)", InspectionCategory.CARGO, "SEMI_REMORQUE,PORTEUR", False, False),
    ("Points d'arrimage", InspectionCategory.CARGO, "SEMI_REMORQUE,PORTEUR", False, False),

    ("Groupe froid (si equipe)", InspectionCategory.REFRIGERATION, "SEMI_REMORQUE,PORTEUR", False, False),
    ("Temperature zone cargo", InspectionCategory.REFRIGERATION, "SEMI_REMORQUE,PORTEUR", False, False),

    # === PORTEUR specifique (cargo integre) ===
    ("Hayon (fonctionnement)", InspectionCategory.CARGO, "PORTEUR", False, False),
]


async def seed_inspection_templates(db: AsyncSession):
    """Inserer les templates par defaut si la table est vide / Seed defaults if table is empty."""
    count_result = await db.execute(select(func.count()).select_from(InspectionTemplate))
    count = count_result.scalar()
    if count and count > 0:
        return  # Deja peuple / Already seeded

    for i, (label, category, types, critical, photo) in enumerate(SEED_ITEMS):
        tpl = InspectionTemplate(
            label=label,
            category=category,
            applicable_vehicle_types=types,
            is_critical=critical,
            requires_photo=photo,
            display_order=i * 10,
            is_active=True,
        )
        db.add(tpl)

    await db.flush()
    print(f"[seed] {len(SEED_ITEMS)} inspection templates created")
