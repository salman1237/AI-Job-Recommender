"""Add saved_searches table and fix email pref schema drift

Revision ID: a1b2c3d4e5f6
Revises: e48cf1f52cdd
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e48cf1f52cdd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    # Fix schema drift: email pref columns may already exist if create_all ran
    if not _column_exists("users", "email_digest_enabled"):
        op.add_column(
            "users",
            sa.Column("email_digest_enabled", sa.Boolean(), nullable=False, server_default="true"),
        )
    if not _column_exists("users", "email_alerts_enabled"):
        op.add_column(
            "users",
            sa.Column("email_alerts_enabled", sa.Boolean(), nullable=False, server_default="true"),
        )

    op.create_table(
        "saved_searches",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("keywords", sa.Text(), nullable=True),
        sa.Column("opp_type", sa.Text(), nullable=True),
        sa.Column("country", sa.Text(), nullable=True),
        sa.Column("notify_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_alerted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_saved_searches_user_id", "saved_searches", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_searches_user_id", table_name="saved_searches")
    op.drop_table("saved_searches")
