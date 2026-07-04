import asyncio
import logging

from app.crud import (
    deactivate_expired,
    finish_run,
    last_success_time,
    start_run,
    upsert,
)
from app.db import async_session
from app.ingest.base import Adapter
from app.ingest.bdjobs import BDJobsAdapter
from app.ingest.shomvob import ShomvobAdapter
from app.ingest.wordpress import wordpress_adapters

logger = logging.getLogger("aggregator.ingest")


def all_adapters() -> list[Adapter]:
    adapters: list[Adapter] = list(wordpress_adapters())
    adapters.append(BDJobsAdapter())
    adapters.append(ShomvobAdapter())
    return adapters


async def run_ingestion() -> dict:
    """Run every adapter in isolation; one failure never stops the rest."""
    summary: dict[str, dict] = {}

    for adapter in all_adapters():
        async with async_session() as session:
            run = await start_run(session, adapter.source)
            await session.commit()  # persist the 'running' row immediately

        async with async_session() as session:
            run = await session.merge(run)
            try:
                since = await last_success_time(session, adapter.source)
                items = await adapter.fetch(since)
                created = updated = 0
                for n in items:
                    result = await upsert(session, n)
                    created += result == "created"
                    updated += result == "updated"
                await finish_run(
                    session, run, len(items), created, updated, "success"
                )
                await session.commit()
                summary[adapter.source] = {
                    "fetched": len(items),
                    "created": created,
                    "updated": updated,
                    "status": "success",
                }
                logger.info(
                    "ingest %s: fetched=%d created=%d updated=%d",
                    adapter.source,
                    len(items),
                    created,
                    updated,
                )
            except Exception as exc:  # noqa: BLE001 — per-source isolation
                await session.rollback()
                run = await session.merge(run)
                await finish_run(session, run, 0, 0, 0, "error", str(exc))
                await session.commit()
                summary[adapter.source] = {"status": "error", "error": str(exc)}
                logger.exception("ingest %s failed", adapter.source)

        # Be polite — stagger source calls slightly.
        await asyncio.sleep(1.0)

    # Nightly lifecycle sweep after all sources complete.
    async with async_session() as session:
        deactivated = await deactivate_expired(session)
        await session.commit()
    summary["_sweep"] = {"deactivated": deactivated}
    logger.info("ingest sweep: deactivated=%d expired records", deactivated)

    return summary
