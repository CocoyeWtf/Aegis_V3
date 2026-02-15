"""Modèle Base Logistique / Logistics Base (warehouse) model."""

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base_activity import base_activity_link


class BaseLogistics(Base):
    __tablename__ = "bases_logistics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(150))
    longitude: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float | None] = mapped_column(Float)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Relations
    region: Mapped["Region"] = relationship(back_populates="bases")
    tours: Mapped[list["Tour"]] = relationship(back_populates="base")
    activities: Mapped[list["BaseActivity"]] = relationship(
        secondary=base_activity_link, back_populates="bases", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<BaseLogistics {self.code} - {self.name}>"
