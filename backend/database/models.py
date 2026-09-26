"""SQLAlchemy 2.0 async database models for Mating."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "mating_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    telegram_id_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    language_code: Mapped[str] = mapped_column(String(5), default="ru", nullable=False)
    currency_code: Mapped[str] = mapped_column(String(5), default="UZS", nullable=False)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    monthly_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    items: Mapped[list[ShoppingItem]] = relationship(
        "ShoppingItem", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.id} hash={self.telegram_id_hash[:8]}...>"


class ShoppingItem(Base):
    __tablename__ = "mating_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("mating_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="шт", nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="Другое", nullable=False)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency_code: Mapped[str] = mapped_column(String(5), default="UZS", nullable=False)
    is_purchased: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    raw_input_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    purchased_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    client_mutation_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship("User", back_populates="items")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "client_mutation_id", name="uq_user_mutation_id"
        ),
        Index("ix_items_user_deleted_purchased", "user_id", "deleted_at", "is_purchased"),
        Index("ix_items_user_purchased_at", "user_id", "purchased_at"),
    )

    def __repr__(self) -> str:
        return f"<ShoppingItem {self.id} '{self.name}' v={self.version} purchased={self.is_purchased}>"
