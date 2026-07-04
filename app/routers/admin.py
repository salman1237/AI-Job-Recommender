from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.ingest.runner import run_ingestion
from app.schemas import IngestResult, RunOut

from app.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/ingest", response_model=IngestResult, dependencies=[Depends(require_admin)])
async def trigger_ingest(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_ingestion)
    return IngestResult(
        status="started",
        detail="Ingestion started in the background. Check /admin/runs for progress.",
    )


@router.get(
    "/runs",
    response_model=list[RunOut],
    dependencies=[Depends(require_admin)],
)
async def list_runs(
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
):
    from app.models import IngestionRun

    stmt = select(IngestionRun).order_by(IngestionRun.id.desc()).limit(limit)
    rows = (await session.scalars(stmt)).all()
    return [RunOut.model_validate(r) for r in rows]
