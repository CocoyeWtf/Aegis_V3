"""
Modèle des mouvements de consignes Zèbre / Zèbre consignment movement model.
Stocke les lignes LIVRE/REPRIS/REGUL importées depuis l'export XLSX Zèbre.
"""

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConsignmentMovement(Base):
    """Mouvement de consigne importé de Zèbre / Consignment movement imported from Zèbre."""

    __tablename__ = "consignment_movements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    pdv_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    pdv_name: Mapped[str | None] = mapped_column(String(150))
    base: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    waybill_number: Mapped[int | None] = mapped_column(Integer)
    flux_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    consignment_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    consignment_label: Mapped[str | None] = mapped_column(String(150))
    consignment_type: Mapped[str | None] = mapped_column(String(10))  # CO, PA, RE, SF
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # signé: +livré, -repris
    value: Mapped[float | None] = mapped_column(Numeric(12, 2))
    flux_type: Mapped[str] = mapped_column(String(10), nullable=False)  # LIVRE, REPRIS, REGUL
    unit_value: Mapped[float | None] = mapped_column(Numeric(12, 4))
    year: Mapped[int | None] = mapped_column(Integer)
    month: Mapped[int | None] = mapped_column(Integer)

    def __repr__(self) -> str:
        return f"<ConsignmentMovement {self.id} pdv={self.pdv_code} code={self.consignment_code} qty={self.quantity}>"
