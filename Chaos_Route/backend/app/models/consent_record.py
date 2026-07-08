"""Registre des consentements / Consent records (STIME A7, action DPIA A3).

Journal append-only : chaque changement de choix crée une nouvelle ligne
(traçabilité RGPD — qui a consenti à quoi, quand, sur quelle version de la
notice d'information). L'état courant = dernière ligne pour un sujet et un
type de consentement donnés.
"""

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TenantMixin


class ConsentRecord(Base, TenantMixin):
    """Trace d'un choix de consentement / A consent choice record."""

    __tablename__ = "consent_records"
    __table_args__ = (
        Index("ix_consent_type_device", "consent_type", "device_id"),
        Index("ix_consent_type_user", "consent_type", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Type de consentement (ex. "gps_tracking") / Consent type
    consent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Sujet : appareil mobile (chauffeur sur tablette) et/ou compte utilisateur
    device_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("mobile_devices.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    # Nom déclaré du sujet au moment du choix (chauffeurs sans compte)
    subject_name: Mapped[str | None] = mapped_column(String(150))
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Version de la notice d'information affichée / Displayed notice version
    info_version: Mapped[str | None] = mapped_column(String(20))
    source: Mapped[str | None] = mapped_column(String(30))  # mobile_app, web, admin
    recorded_at: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601

    def __repr__(self) -> str:
        return f"<ConsentRecord {self.consent_type} granted={self.granted}>"
