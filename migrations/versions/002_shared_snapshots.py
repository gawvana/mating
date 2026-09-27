"""add shared snapshots table

Revision ID: 002_shared_snapshots
Revises: 001_initial_schema
Create Date: 2026-09-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002_shared_snapshots"
down_revision: Union[str, Sequence[str], None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mating_shared_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=256), server_default="Список покупок", nullable=False),
        sa.Column("snapshot_payload", sa.Text(), nullable=False),
        sa.Column("item_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["mating_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_shared_snapshots_token"),
    )
    op.create_index("ix_mating_shared_snapshots_token", "mating_shared_snapshots", ["token"])
    op.create_index("ix_mating_shared_snapshots_user_id", "mating_shared_snapshots", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_mating_shared_snapshots_user_id", table_name="mating_shared_snapshots")
    op.drop_index("ix_mating_shared_snapshots_token", table_name="mating_shared_snapshots")
    op.drop_table("mating_shared_snapshots")
