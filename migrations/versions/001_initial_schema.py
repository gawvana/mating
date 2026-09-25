"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-25 18:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. mating_users table
    op.create_table(
        "mating_users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("telegram_id_hash", sa.String(length=64), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column("first_name", sa.String(length=128), nullable=True),
        sa.Column("language_code", sa.String(length=5), server_default="ru", nullable=False),
        sa.Column("currency_code", sa.String(length=5), server_default="UZS", nullable=False),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("monthly_budget", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id_hash", name="uq_user_telegram_id_hash"),
    )
    op.create_index("ix_mating_users_telegram_id_hash", "mating_users", ["telegram_id_hash"])

    # 2. mating_items table
    op.create_table(
        "mating_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("quantity", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("unit", sa.String(length=20), server_default="шт", nullable=False),
        sa.Column("category", sa.String(length=64), server_default="Другое", nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("currency_code", sa.String(length=5), server_default="UZS", nullable=False),
        sa.Column("is_purchased", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("raw_input_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("client_mutation_id", sa.String(length=64), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["mating_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "client_mutation_id", name="uq_user_mutation_id"),
    )
    op.create_index("ix_mating_items_user_id", "mating_items", ["user_id"])
    op.create_index("ix_items_user_deleted_purchased", "mating_items", ["user_id", "deleted_at", "is_purchased"])
    op.create_index("ix_items_user_purchased_at", "mating_items", ["user_id", "purchased_at"])


def downgrade() -> None:
    op.drop_index("ix_items_user_purchased_at", table_name="mating_items")
    op.drop_index("ix_items_user_deleted_purchased", table_name="mating_items")
    op.drop_index("ix_mating_items_user_id", table_name="mating_items")
    op.drop_table("mating_items")
    op.drop_index("ix_mating_users_telegram_id_hash", table_name="mating_users")
    op.drop_table("mating_users")
