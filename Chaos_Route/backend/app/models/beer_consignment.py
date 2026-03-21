"""Registre consignes bière / Beer consignment ledger.
Suivi livré vs retourné par PDV × type de casier.
Tracks delivered vs returned per PDV × crate type.
"""

import enum

from sqlalchemy import Column, Enum, Index, Integer, Numeric, String, Text, ForeignKey
from app.database import Base


class BeerTransactionType(str, enum.Enum):
    """Type de transaction consigne / Consignment transaction type."""
    DELIVERY = "DELIVERY"            # Livraison vers PDV / Delivery to PDV
    RETURN = "RETURN"                # Retour vidanges depuis PDV / Empties return from PDV
    ADJUSTMENT = "ADJUSTMENT"        # Correction inventaire / Inventory correction
    WRITE_OFF = "WRITE_OFF"          # Perte/casse / Loss/breakage


class BeerConsignmentTx(Base):
    """Transaction consigne bière — registre livré/retourné.
    Beer consignment transaction — delivery/return ledger."""
    __tablename__ = "beer_consignment_txs"
    __table_args__ = (
        Index("ix_beer_tx_pdv", "pdv_id"),
        Index("ix_beer_tx_support_type", "support_type_id"),
        Index("ix_beer_tx_date", "transaction_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    pdv_id = Column(Integer, ForeignKey("pdvs.id"), nullable=False)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    transaction_type = Column(Enum(BeerTransactionType), nullable=False)
    # Quantité en unités (casiers) — positif = livré, négatif = retourné
    crate_qty = Column(Integer, nullable=False)
    # Quantité bouteilles individuelles hors casier complet
    loose_bottle_qty = Column(Integer, nullable=False, default=0)
    # Valeur unitaire au moment de la transaction (snapshot)
    unit_value_snapshot = Column(Numeric(10, 4), nullable=True)
    bottle_value_snapshot = Column(Numeric(10, 4), nullable=True)
    # Référence document (bon de livraison, n° tournée, etc.)
    reference = Column(String(100), nullable=True)
    transaction_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    created_at = Column(String(32), nullable=False)  # ISO 8601
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)


class BeerConsignmentBalance(Base):
    """Solde consigne courant par PDV × type de casier.
    Current consignment balance per PDV × crate type."""
    __tablename__ = "beer_consignment_balances"
    __table_args__ = (
        Index("ix_beer_bal_pdv_support", "pdv_id", "support_type_id", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    pdv_id = Column(Integer, ForeignKey("pdvs.id"), nullable=False)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    # Solde = total livré - total retourné (en casiers)
    crate_balance = Column(Integer, nullable=False, default=0)
    # Bouteilles individuelles en solde
    loose_bottle_balance = Column(Integer, nullable=False, default=0)
    # Totaux cumulés pour stats
    total_delivered = Column(Integer, nullable=False, default=0)
    total_returned = Column(Integer, nullable=False, default=0)
    total_write_off = Column(Integer, nullable=False, default=0)
    last_delivery_date = Column(String(10), nullable=True)
    last_return_date = Column(String(10), nullable=True)
    last_updated_at = Column(String(32), nullable=True)
