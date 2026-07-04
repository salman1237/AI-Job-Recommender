from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import IngestionRun, Opportunity
from app.schemas import SourceStat, Stats

router = APIRouter(tags=["meta"])


@router.get("/stats", response_model=Stats)
async def get_stats(session: AsyncSession = Depends(get_session)):
    total = await session.scalar(select(func.count()).select_from(Opportunity)) or 0
    active = (
        await session.scalar(
            select(func.count())
            .select_from(Opportunity)
            .where(Opportunity.is_active.is_(True))
        )
        or 0
    )

    by_type_rows = (
        await session.execute(
            select(Opportunity.type, func.count()).group_by(Opportunity.type)
        )
    ).all()
    by_type = {t: c for t, c in by_type_rows}

    counts = {
        s: c
        for s, c in (
            await session.execute(
                select(Opportunity.source, func.count()).group_by(Opportunity.source)
            )
        ).all()
    }

    # Latest successful run timestamp per source.
    last_success_rows = (
        await session.execute(
            select(
                IngestionRun.source,
                func.max(IngestionRun.finished_at),
            )
            .where(IngestionRun.status == "success")
            .group_by(IngestionRun.source)
        )
    ).all()
    last_success = {s: ts for s, ts in last_success_rows}

    sources = sorted(
        set(counts) | set(last_success),
        key=lambda s: counts.get(s, 0),
        reverse=True,
    )
    source_stats = [
        SourceStat(
            source=s,
            count=counts.get(s, 0),
            last_success=last_success.get(s),
        )
        for s in sources
    ]

    return Stats(total=total, active=active, by_type=by_type, sources=source_stats)
