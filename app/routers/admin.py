import asyncio
import json

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.ingest.runner import run_ingestion
from app.ingest.wordpress import _parse_deadline, _parse_organization, _parse_location
from app.schemas import IngestResult, RunOut, EmailLogOut
from app.services.email_service import run_daily_opportunity_digests, run_deadline_alerts

from app.dependencies import require_admin, require_admin_or_cron

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/ingest", response_model=IngestResult, dependencies=[Depends(require_admin_or_cron)])
async def trigger_ingest(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_ingestion)
    return IngestResult(
        status="started",
        detail="Ingestion started in the background. Check /admin/runs for progress.",
    )


@router.post("/trigger-emails", dependencies=[Depends(require_admin_or_cron)])
async def trigger_emails(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_daily_opportunity_digests)
    background_tasks.add_task(run_deadline_alerts)
    return {"status": "started", "detail": "Emails triggered in the background. Check /admin/email-logs for progress."}


@router.post("/backfill-wp", dependencies=[Depends(require_admin)])
async def backfill_wp_fields():
    """
    Stream SSE progress while re-extracting deadline, organization, and location
    from stored raw JSON of all WordPress-sourced opportunities.
    Yields: start → progress (every 50 rows) → done events.
    """
    from app.db import async_session
    from app.models import Opportunity

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    async def generate():
        WP_SOURCES = {"opportunitydesk", "opp4youth", "opp4africans", "uri_fellowships"}
        async with async_session() as session:
            rows = (
                await session.scalars(
                    select(Opportunity).where(Opportunity.source.in_(WP_SOURCES))
                )
            ).all()

            total = len(rows)
            yield _sse({"type": "start", "total": total})

            updated = deadline_filled = org_filled = loc_filled = 0

            for i, opp in enumerate(rows):
                if opp.raw:
                    content_html = (opp.raw.get("content") or {}).get("rendered")
                    class_list = opp.raw.get("class_list")
                    changed = False

                    if opp.deadline is None:
                        val = _parse_deadline(content_html)
                        if val:
                            opp.deadline = val
                            deadline_filled += 1
                            changed = True

                    if not opp.organization:
                        val = _parse_organization(content_html)
                        if val:
                            opp.organization = val
                            org_filled += 1
                            changed = True

                    if not opp.location:
                        val = _parse_location(content_html, class_list)
                        if val:
                            opp.location = val
                            loc_filled += 1
                            changed = True

                    if changed:
                        updated += 1

                # Emit progress every 50 records and on the last one
                if (i + 1) % 50 == 0 or (i + 1) == total:
                    pct = round((i + 1) / total * 100) if total else 100
                    yield _sse({
                        "type": "progress",
                        "processed": i + 1,
                        "total": total,
                        "pct": pct,
                        "updated": updated,
                        "deadline_filled": deadline_filled,
                        "org_filled": org_filled,
                        "loc_filled": loc_filled,
                    })
                    await asyncio.sleep(0)  # yield control to event loop

            await session.commit()
            yield _sse({
                "type": "done",
                "total_wp_records": total,
                "records_updated": updated,
                "deadline_filled": deadline_filled,
                "organization_filled": org_filled,
                "location_filled": loc_filled,
            })

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
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


@router.get(
    "/email-logs",
    response_model=list[EmailLogOut],
    dependencies=[Depends(require_admin)],
)
async def list_email_logs(
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
):
    from app.models import EmailLog, User

    # Join EmailLog with User to get the email address
    stmt = (
        select(EmailLog, User.email)
        .outerjoin(User, EmailLog.user_id == User.id)
        .order_by(EmailLog.id.desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    
    out = []
    for log, email in rows:
        log_out = EmailLogOut.model_validate(log)
        log_out.user_email = email
        out.append(log_out)
        
    return out
