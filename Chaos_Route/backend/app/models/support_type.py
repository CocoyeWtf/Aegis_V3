"""Modèle Type de Support / Support Type model (palettes, CHEP, etc.)."""

from sqlalchemy import Boolean, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupportType(Base):
    """Type de contenant réutilisable / Reusable container type (e.g. Palette Europe, CHEP)."""
    __tablename__ = "support_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    short_code: Mapped[str | None] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # ex: 15 palettes par pile
    unit_label: Mapped[str | None] = mapped_column(String(100))  # ex: "pile de 15"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    image_path: Mapped[str | None] = mapped_column(String(255))

    # Valeur consigne / Consignment value (nullable — non tous les supports ont une consigne)
    unit_value: Mapped[float | None] = mapped_column(Numeric(10, 2))          # ex: 2.10 € par bac
    # Contenu du support (ex: bouteilles dans un bac) / Container content (e.g., bottles in a crate)
    content_item_label: Mapped[str | None] = mapped_column(String(50))        # ex: "bouteille"
    content_items_per_unit: Mapped[int | None] = mapped_column(Integer)       # ex: 24 bouteilles par bac
    content_item_value: Mapped[float | None] = mapped_column(Numeric(10, 4))  # ex: 0.10 € par bouteille
    # Usine fournisseur pour export (ex: "InBev JUPILLE") / Supplier plant for export
    supplier_plant: Mapped[str | None] = mapped_column(String(100))
