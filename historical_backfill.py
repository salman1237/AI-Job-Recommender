import asyncio
import logging
import sys

from app.config import settings

# Temporarily override MAX_PAGES for all adapters
import app.ingest.wordpress as wp
import app.ingest.bdjobs as bd

wp.WordPressAdapter.MAX_PAGES = 50
bd.BDJobsAdapter.MAX_PAGES = 20

from app.ingest.runner import all_adapters
from app.db import async_session
from app.crud import start_run, finish_run, last_success_time, upsert, deactivate_expired

logging.basicConfig(level=logging.WARNING)

async def main():
    print("=====================================================")
    print("🚀 Starting MASSIVE historical backfill... ")
    print("=====================================================")
    print("This will bypass the 60-second cloud limit because it is running locally.")
    print("It will securely save all jobs directly into your live Neon database!")
    print("This might take 10-15 minutes. Please leave this terminal open.\n")
    
    summary = {}
    for adapter in all_adapters():
        print(f"\n[{adapter.source}] Connecting...")
        async with async_session() as session:
            run = await start_run(session, adapter.source)
            await session.commit()
            
        async with async_session() as session:
            run = await session.merge(run)
            try:
                # since = await last_success_time(session, adapter.source)
                # FOR A FULL BACKFILL, WE IGNORE SINCE!
                since = None 
                print(f"[{adapter.source}] Fetching from web API (this might take a minute)...")
                
                items = await adapter.fetch(since)
                total = len(items)
                print(f"[{adapter.source}] Found {total} items! Saving to database...")
                
                created = updated = 0
                for i, n in enumerate(items, 1):
                    result = await upsert(session, n)
                    if result == "created": created += 1
                    if result == "updated": updated += 1
                    
                    # Print progress bar
                    percent = int((i / total) * 100)
                    bar = "█" * (percent // 2) + "-" * (50 - (percent // 2))
                    sys.stdout.write(f"\r[{adapter.source}] Progress: |{bar}| {percent}% ({i}/{total})")
                    sys.stdout.flush()
                
                await finish_run(session, run, total, created, updated, "success")
                await session.commit()
                print(f"\n[{adapter.source}] ✅ Done! Created: {created}, Updated: {updated}")
                
            except Exception as exc:
                print(f"\n[{adapter.source}] ❌ Error: {exc}")
                await session.rollback()
                run = await session.merge(run)
                await finish_run(session, run, 0, 0, 0, "error", str(exc))
                await session.commit()
                
        await asyncio.sleep(1.0)
        
    print("\n[Sweep] Cleaning up expired jobs...")
    async with async_session() as session:
        deactivated = await deactivate_expired(session)
        await session.commit()
        print(f"[Sweep] ✅ Done! Deactivated {deactivated} expired records.")
        
    print("\n🎉 ALL SOURCES FINISHED! You can close this terminal now.")

if __name__ == "__main__":
    asyncio.run(main())
