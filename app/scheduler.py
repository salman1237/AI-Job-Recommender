import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.ingest.runner import run_ingestion

logger = logging.getLogger("aggregator.scheduler")

scheduler = AsyncIOScheduler(timezone="UTC")


def start_scheduler() -> None:
    trigger = CronTrigger(
        hour=settings.ingest_hour_utc,
        minute=settings.ingest_minute_utc,
        timezone="UTC",
    )
    scheduler.add_job(
        run_ingestion,
        trigger=trigger,
        id="daily_ingest",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started — daily ingest at %02d:%02d UTC",
        settings.ingest_hour_utc,
        settings.ingest_minute_utc,
    )


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
