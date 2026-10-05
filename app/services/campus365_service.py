"""
Daily Campus365 sync service.

Run order (called by scheduler at 03:00 UTC, after the 02:07 ingest):
  1. Login → get bearer token
  2. Push NEW active opportunities not yet in campus365_sync  → POST → insert row
  3. Update CHANGED records (content_hash drift)              → PUT  → update row
  4. Expire records whose deadline has passed (or is_active=False) → PUT status=EXPIRED → update row
"""
import logging
from datetime import date, datetime, timezone

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.campus365 import build, payload_hash
from app.config import settings
from app.db import async_session
from app.models import Campus365Sync, Opportunity

logger = logging.getLogger("aggregator.campus365")

BATCH = 50       # records per sync run for new pushes (keeps run time short)
INST  = settings.campus365_institution_id


# ── auth ──────────────────────────────────────────────────────────────────────

async def _login(client: httpx.AsyncClient) -> str:
    r = await client.post(
        "/auth/login",
        json={"email": settings.campus365_email, "password": settings.campus365_password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


# ── row → dict helper (SQLAlchemy ORM → plain dict) ──────────────────────────

def _opp_to_dict(opp: Opportunity) -> dict:
    return {
        "id":           opp.id,
        "source":       opp.source,
        "type":         opp.type,
        "title":        opp.title,
        "organization": opp.organization,
        "description":  opp.description,
        "url":          opp.url,
        "apply_url":    opp.apply_url,
        "location":     opp.location,
        "country":      opp.country,
        "tags":         opp.tags,
        "salary":       opp.salary,
        "deadline":     str(opp.deadline) if opp.deadline else None,
        "posted_at":    opp.posted_at.isoformat() if opp.posted_at else None,
        "is_active":    opp.is_active,
        "content_hash": opp.content_hash,
        "raw":          opp.raw,
    }


# ── main sync logic ───────────────────────────────────────────────────────────

async def run_campus365_sync(dry_run: bool = False) -> dict:
    """
    Sync opportunities to Campus365.  Returns a summary dict.
    Pass dry_run=True to build payloads and log actions without hitting the API.
    """
    if not INST:
        logger.warning("campus365_institution_id not configured — skipping sync")
        return {"skipped": True}

    summary = {"pushed": 0, "updated": 0, "expired": 0, "errors": 0}

    async with async_session() as db:
        async with httpx.AsyncClient(
            base_url=settings.campus365_base_url, timeout=60
        ) as client:
            token = await _login(client)
            headers = {"Authorization": f"Bearer {token}"}

            async def _put(uid: str, payload: dict) -> bool:
                nonlocal token
                for attempt in range(2):
                    try:
                        r = await client.put(f"/opportunities/{uid}", json=payload, headers=headers)
                        if r.status_code == 401 and attempt == 0:
                            token = await _login(client)
                            headers["Authorization"] = f"Bearer {token}"
                            continue
                        return r.status_code == 200
                    except httpx.HTTPError:
                        pass
                return False

            async def _post(payload: dict) -> str | None:
                nonlocal token
                for attempt in range(2):
                    try:
                        r = await client.post(
                            f"/institutions/{INST}/opportunities",
                            json=payload,
                            headers=headers,
                        )
                        if r.status_code == 401 and attempt == 0:
                            token = await _login(client)
                            headers["Authorization"] = f"Bearer {token}"
                            continue
                        if r.status_code == 201:
                            return r.json()["opportunity"]["uid"]
                    except httpx.HTTPError:
                        pass
                return None

            # ── 1. Push new active opportunities ─────────────────────────────
            synced_ids_q = select(Campus365Sync.opp_id).where(
                Campus365Sync.institution_id == INST
            )
            synced_ids = set(
                row[0] for row in (await db.execute(synced_ids_q)).all()
            )

            new_opps_q = (
                select(Opportunity)
                .where(
                    Opportunity.is_active == True,  # noqa: E712
                    Opportunity.url != None,         # noqa: E711
                    Opportunity.title != None,       # noqa: E711
                    ~Opportunity.id.in_(synced_ids),
                )
                .order_by(Opportunity.posted_at.desc().nullslast())
                .limit(BATCH)
            )
            new_opps = (await db.execute(new_opps_q)).scalars().all()
            logger.info("campus365 sync: %d new opportunities to push", len(new_opps))

            for opp in new_opps:
                row = _opp_to_dict(opp)
                payload = build(row)
                if not payload.get("url", "").startswith("http"):
                    continue
                if dry_run:
                    logger.info("[DRY] would POST #%d %s", opp.id, opp.title[:60])
                    continue
                uid = await _post(payload)
                if uid:
                    db.add(Campus365Sync(
                        opp_id=opp.id,
                        institution_id=INST,
                        campus365_uid=uid,
                        content_hash=payload_hash(row),
                        c365_status="PUBLISHED",
                        synced_at=datetime.now(timezone.utc),
                    ))
                    summary["pushed"] += 1
                else:
                    logger.warning("campus365: POST failed for opp #%d", opp.id)
                    summary["errors"] += 1

            await db.flush()

            # ── 2. Update changed records ─────────────────────────────────────
            synced_q = (
                select(Campus365Sync, Opportunity)
                .join(Opportunity, Campus365Sync.opp_id == Opportunity.id)
                .where(
                    Campus365Sync.institution_id == INST,
                    Campus365Sync.c365_status == "PUBLISHED",
                    Opportunity.is_active == True,  # noqa: E712
                )
            )
            synced_rows = (await db.execute(synced_q)).all()

            for sync_row, opp in synced_rows:
                row = _opp_to_dict(opp)
                new_hash = payload_hash(row)
                if new_hash == sync_row.content_hash:
                    continue
                payload = build(row)
                if dry_run:
                    logger.info("[DRY] would PUT (update) #%d %s", opp.id, opp.title[:60])
                    continue
                ok = await _put(sync_row.campus365_uid, payload)
                if ok:
                    sync_row.content_hash = new_hash
                    sync_row.synced_at = datetime.now(timezone.utc)
                    summary["updated"] += 1
                else:
                    logger.warning("campus365: PUT update failed for opp #%d uid=%s",
                                   opp.id, sync_row.campus365_uid)
                    summary["errors"] += 1

            # ── 3. Expire records whose deadline has passed / is_active=False ─
            today = date.today()
            expire_q = (
                select(Campus365Sync, Opportunity)
                .join(Opportunity, Campus365Sync.opp_id == Opportunity.id)
                .where(
                    Campus365Sync.institution_id == INST,
                    Campus365Sync.c365_status == "PUBLISHED",
                    (
                        (Opportunity.is_active == False) |  # noqa: E712
                        (
                            (Opportunity.deadline != None) &  # noqa: E711
                            (Opportunity.deadline < today)
                        )
                    ),
                )
            )
            expire_rows = (await db.execute(expire_q)).all()
            logger.info("campus365 sync: %d records to expire", len(expire_rows))

            for sync_row, opp in expire_rows:
                if dry_run:
                    logger.info("[DRY] would PUT status=EXPIRED #%d %s",
                                opp.id, opp.title[:60])
                    continue
                ok = await _put(sync_row.campus365_uid, {"status": "EXPIRED"})
                if ok:
                    sync_row.c365_status = "EXPIRED"
                    sync_row.synced_at = datetime.now(timezone.utc)
                    summary["expired"] += 1
                else:
                    logger.warning("campus365: PUT expire failed for opp #%d uid=%s",
                                   opp.id, sync_row.campus365_uid)
                    summary["errors"] += 1

            if not dry_run:
                await db.commit()

    logger.info(
        "campus365 sync done — pushed=%d updated=%d expired=%d errors=%d",
        summary["pushed"], summary["updated"], summary["expired"], summary["errors"],
    )
    return summary
