"""Modèle Activité de base / Base Activity model (configurable base types)."""

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Table d'association M2M / Many-to-many association table
base_activity_link = Table(
    "base_activity_link",
    Base.metadata,
    Column("base_id", ForeignKey("bases_logistics.id", ondelete="CASCADE"), primary_key=True),
    Column("activity_id", ForeignKey("base_activities.id", ondelete="CASCADE"), primary_key=True),
)


class BaseActivity(Base):
    """Activité configurable pour les bases / Configurable activity for bases."""
    __tablename__ = "base_activities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relation inverse / Back reference
    bases: Mapped[list["BaseLogistics"]] = relationship(
        secondary=base_activity_link, back_populates="activities"
    )

    def __repr__(self) -> str:
        return f"<BaseActivity {self.code} - {self.name}>"
