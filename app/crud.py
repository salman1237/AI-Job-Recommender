from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.base import Normalized
from app.models import IngestionRun, Opportunity

# Columns that an adapter is allowed to write. search_tsv is DB-generated and
# id/created_at are managed by the DB.
_WRITABLE = (
    "source",
    "external_id",
    "type",
    "title",
    "organization",
    "description",
    "url",
    "apply_url",
    "location",
    "country",
    "category",
    "tags",
    "salary",
    "deadline",
    "posted_at",
    "raw",
)


def to_dict(n: Normalized) -> dict:
    d = {k: getattr(n, k) for k in _WRITABLE}
    d["content_hash"] = n.content_hash()
    return d


async def upsert(session: AsyncSession, n: Normalized) -> str:
    """Insert/update one normalized record. Returns 'created'|'updated'|'unchanged'."""
    existing = await session.scalar(
        select(Opportunity).where(
            Opportunity.source == n.source,
            Opportunity.external_id == n.external_id,
        )
    )
    if existing is None:
        session.add(Opportunity(**to_dict(n)))
        return "created"

    if existing.content_hash != n.content_hash():
        for k, v in to_dict(n).items():
            setattr(existing, k, v)
        existing.updated_at = datetime.now(timezone.utc)
        existing.is_active = True
        return "updated"

    return "unchanged"


# --- ingestion_runs audit helpers ---------------------------------------------


async def start_run(session: AsyncSession, source: str) -> IngestionRun:
    run = IngestionRun(source=source, status="running")
    session.add(run)
    await session.flush()
    return run


async def finish_run(
    session: AsyncSession,
    run: IngestionRun,
    fetched: int,
    created: int,
    updated: int,
    status: str,
    error: str | None = None,
) -> None:
    run.finished_at = datetime.now(timezone.utc)
    run.fetched = fetched
    run.created = created
    run.updated = updated
    run.status = status
    run.error = error


async def last_success_time(session: AsyncSession, source: str) -> datetime | None:
    """Most recent successful finish for a source — used for incremental fetch."""
    return await session.scalar(
        select(func.max(IngestionRun.finished_at)).where(
            IngestionRun.source == source,
            IngestionRun.status == "success",
        )
    )


async def deactivate_expired(session: AsyncSession) -> int:
    """Nightly sweep: mark opportunities inactive if:
    - their deadline has passed, OR
    - they have no deadline and were posted (or created) more than 365 days ago.
    """
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    result = await session.execute(
        update(Opportunity)
        .where(
            Opportunity.is_active.is_(True),
            or_(
                Opportunity.deadline < date.today(),
                and_(
                    Opportunity.deadline.is_(None),
                    func.coalesce(Opportunity.posted_at, Opportunity.created_at) < stale_cutoff,
                ),
            ),
        )
        .values(is_active=False)
    )
    return result.rowcount or 0
