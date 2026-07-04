"""search vector: include description (weighted)

Revision ID: c1a2b3d4e5f6
Revises: b6079e21b7a4
Create Date: 2026-06-21

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b6079e21b7a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_EXPR = (
    "setweight(to_tsvector('simple', coalesce(title,'')), 'A') || "
    "setweight(to_tsvector('simple', coalesce(organization,'')), 'B') || "
    "setweight(to_tsvector('simple', coalesce(location,'')), 'B') || "
    "setweight(to_tsvector('simple', coalesce(category,'')), 'B') || "
    "setweight(to_tsvector('simple', coalesce(description,'')), 'C')"
)

_OLD_EXPR = (
    "to_tsvector('simple', "
    "coalesce(title,'') || ' ' || "
    "coalesce(organization,'') || ' ' || "
    "coalesce(location,'') || ' ' || "
    "coalesce(category,''))"
)


def _rebuild(expr: str) -> None:
    # A STORED generated column's expression cannot be altered in place;
    # drop the dependent index + column, then recreate both.
    op.execute("DROP INDEX IF EXISTS ix_opp_search")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS search_tsv")
    op.execute(
        f"ALTER TABLE opportunities ADD COLUMN search_tsv tsvector "
        f"GENERATED ALWAYS AS ({expr}) STORED"
    )
    op.execute(
        "CREATE INDEX ix_opp_search ON opportunities USING gin (search_tsv)"
    )


def upgrade() -> None:
    _rebuild(_NEW_EXPR)


def downgrade() -> None:
    _rebuild(_OLD_EXPR)
