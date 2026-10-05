"""Add campus365_sync table

Revision ID: f1e2d3c4b5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-10-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campus365_sync",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "opp_id",
            sa.BigInteger(),
            sa.ForeignKey("opportunities.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("institution_id", sa.String(36), nullable=False),
        sa.Column("campus365_uid", sa.String(36), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("c365_status", sa.String(20), nullable=False, server_default="PUBLISHED"),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_c365_institution", "campus365_sync", ["institution_id"])
    op.create_index("ix_c365_opp_id", "campus365_sync", ["opp_id"])


def downgrade() -> None:
    op.drop_index("ix_c365_institution", table_name="campus365_sync")
    op.drop_index("ix_c365_opp_id", table_name="campus365_sync")
    op.drop_table("campus365_sync")
