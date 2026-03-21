"""Table de référence Filiale/CNUF → type température / Reference table Filiale/CNUF → temperature type.
Permet de déterminer automatiquement le type de température (SEC/FRAIS/GEL/FFL)
à partir du code CNUF et de la filiale lors de l'import des commandes.
"""

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CnufTemperature(Base):
    """Mapping CNUF/Filiale → type température / CNUF/Filiale → temperature type mapping."""
    __tablename__ = "cnuf_temperatures"
    __table_args__ = (
        UniqueConstraint("cnuf", "filiale", name="uq_cnuf_filiale"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cnuf: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    filiale: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    temperature_type: Mapped[str] = mapped_column(String(10), nullable=False)  # SEC, FRAIS, GEL, FFL
    label: Mapped[str | None] = mapped_column(String(150))  # Description libre / Free description
    base_id: Mapped[int | None] = mapped_column(ForeignKey("base_logistics.id"))

    # Relations
    base: Mapped["BaseLogistics | None"] = relationship()

    def __repr__(self) -> str:
        return f"<CnufTemperature {self.cnuf}/{self.filiale} → {self.temperature_type}>"
