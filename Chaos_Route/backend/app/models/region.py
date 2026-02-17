"""Modèle Région / Region model."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"), nullable=False)

    # Relations
    country: Mapped["Country"] = relationship(back_populates="regions")
    bases: Mapped[list["BaseLogistics"]] = relationship(back_populates="region", cascade="all, delete-orphan")
    pdvs: Mapped[list["PDV"]] = relationship(back_populates="region", cascade="all, delete-orphan")
    suppliers: Mapped[list["Supplier"]] = relationship(back_populates="region", cascade="all, delete-orphan")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="region", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Region {self.name}>"
