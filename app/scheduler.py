import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.ingest.runner import run_ingestion
from app.services.email_service import (
    run_daily_opportunity_digests,
    run_deadline_alerts,
    run_saved_search_alerts,
)

logger = logging.getLogger("aggregator.scheduler")

scheduler = AsyncIOScheduler(timezone="UTC")

def start_scheduler() -> None:
    # 1. Existing Data Ingestion Cron
    trigger_ingest = CronTrigger(
        hour=settings.ingest_hour_utc,
        minute=settings.ingest_minute_utc,
        timezone="UTC",
    )
    scheduler.add_job(
        run_ingestion,
        trigger=trigger_ingest,
        id="daily_ingest",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    
    # 2. Daily Opportunity Digests (6:00 AM BDT is 00:00 UTC)
    trigger_emails = CronTrigger(
        hour=0,
        minute=0,
        timezone="UTC",
    )
    scheduler.add_job(
        run_daily_opportunity_digests,
        trigger=trigger_emails,
        id="daily_email_digest",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    
    # 3. Deadline Alerts (Run right after daily digests)
    scheduler.add_job(
        run_deadline_alerts,
        trigger=trigger_emails,
        id="daily_deadline_alerts",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # 4. Saved Search Alerts (01:00 UTC = 7:00 AM BDT, 1 hour after digest)
    scheduler.add_job(
        run_saved_search_alerts,
        trigger=CronTrigger(hour=1, minute=0, timezone="UTC"),
        id="saved_search_alerts",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    logger.info(
        "Scheduler started — daily ingest at %02d:%02d UTC, daily emails at 00:00 UTC",
        settings.ingest_hour_utc,
        settings.ingest_minute_utc,
    )

def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
