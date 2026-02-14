"""Modèle Pays / Country model."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)  # ISO 3166

    # Relations
    regions: Mapped[list["Region"]] = relationship(back_populates="country", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Country {self.code} - {self.name}>"
