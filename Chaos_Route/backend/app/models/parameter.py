"""Modèle Paramètre système / System parameter model."""

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Parameter(Base):
    __tablename__ = "parameters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False)  # int, float, string, bool
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))  # null = global
    effective_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    end_date: Mapped[str | None] = mapped_column(String(10))

    def __repr__(self) -> str:
        return f"<Parameter {self.key}={self.value}>"
