"""
Modèles Authentification et Autorisation / Authentication and Authorization models.
User, Role, Permission + tables de jonction / junction tables.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Table de jonction User <-> Role / Junction table User <-> Role
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

# Table de jonction User <-> Region (scope géographique) / Junction table User <-> Region (geographic scope)
user_regions = Table(
    "user_regions",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("region_id", ForeignKey("regions.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    """Utilisateur de l'application / Application user."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relations
    roles: Mapped[list["Role"]] = relationship(secondary=user_roles, back_populates="users", lazy="selectin")
    regions: Mapped[list["Region"]] = relationship(secondary=user_regions, lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class Role(Base):
    """Rôle avec permissions / Role with permissions."""

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relations
    permissions: Mapped[list["Permission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )
    users: Mapped[list["User"]] = relationship(secondary=user_roles, back_populates="roles")

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class Permission(Base):
    """Permission granulaire rattachée à un rôle / Granular permission attached to a role."""

    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # read, create, update, delete

    # Relations
    role: Mapped["Role"] = relationship(back_populates="permissions")

    def __repr__(self) -> str:
        return f"<Permission {self.resource}:{self.action}>"
