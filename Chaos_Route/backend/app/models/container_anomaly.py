"""Anomalies contenants — workflow kanban / Container anomaly — kanban workflow.
Signalement, suivi et résolution des écarts contenants.
"""

import enum

from sqlalchemy import Column, Enum, Float, Index, Integer, String, Text, ForeignKey
from app.database import Base


class AnomalyStatus(str, enum.Enum):
    """Statut kanban / Kanban status."""
    OPEN = "OPEN"              # A traiter / To process
    IN_PROGRESS = "IN_PROGRESS"  # En cours / In progress
    RESOLVED = "RESOLVED"      # Résolu / Resolved
    CLOSED = "CLOSED"          # Classé / Closed (no action needed)


class AnomalyCategory(str, enum.Enum):
    """Catégorie d'anomalie / Anomaly category."""
    MISSING = "MISSING"            # Contenants manquants / Missing containers
    DAMAGED = "DAMAGED"            # Contenants endommagés / Damaged containers
    SURPLUS = "SURPLUS"            # Excédent non justifié / Unjustified surplus
    WRONG_TYPE = "WRONG_TYPE"      # Mauvais type retourné / Wrong type returned
    DISPUTE = "DISPUTE"            # Litige quantité PDV/base / Quantity dispute
    EXPIRED = "EXPIRED"            # Contenant hors service / End-of-life container
    OTHER = "OTHER"


class AnomalySeverity(str, enum.Enum):
    """Sévérité / Severity."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ContainerAnomaly(Base):
    """Anomalie contenant — ticket kanban.
    Container anomaly — kanban ticket."""
    __tablename__ = "container_anomalies"
    __table_args__ = (
        Index("ix_anomaly_status", "status"),
        Index("ix_anomaly_pdv", "pdv_id"),
        Index("ix_anomaly_created", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    # Contexte / Context
    pdv_id = Column(Integer, ForeignKey("pdvs.id"), nullable=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=True)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=True)
    # Classification
    category = Column(Enum(AnomalyCategory), nullable=False)
    severity = Column(Enum(AnomalySeverity), nullable=False, default=AnomalySeverity.MEDIUM)
    status = Column(Enum(AnomalyStatus), nullable=False, default=AnomalyStatus.OPEN)
    # Détails / Details
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    quantity_expected = Column(Integer, nullable=True)
    quantity_actual = Column(Integer, nullable=True)
    financial_impact = Column(Float, nullable=True)  # EUR estimé
    # Référence document (tournée, bon livraison, etc.)
    reference = Column(String(100), nullable=True)
    # Workflow
    created_at = Column(String(32), nullable=False)  # ISO 8601
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(String(32), nullable=True)  # Passage en IN_PROGRESS
    resolved_at = Column(String(32), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    # Deadline
    due_date = Column(String(10), nullable=True)  # YYYY-MM-DD


class AnomalyPhoto(Base):
    """Photo attachée à une anomalie / Photo attached to an anomaly."""
    __tablename__ = "anomaly_photos"
    __table_args__ = (
        Index("ix_anomaly_photos_anomaly", "anomaly_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("container_anomalies.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(50), nullable=True)
    uploaded_at = Column(String(32), nullable=False)  # ISO 8601


class AnomalyComment(Base):
    """Commentaire sur une anomalie / Comment on an anomaly."""
    __tablename__ = "anomaly_comments"
    __table_args__ = (
        Index("ix_anomaly_comments_anomaly", "anomaly_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("container_anomalies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(String(32), nullable=False)
