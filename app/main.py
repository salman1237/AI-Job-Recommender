import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import engine
from app.models import Base
from app.routers import admin, auth, config, opportunities, stats, users
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload dirs exist on startup
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.upload_dir) / "avatars").mkdir(parents=True, exist_ok=True)
    (Path(settings.upload_dir) / "cvs").mkdir(parents=True, exist_ok=True)
    # Create any new tables (safe — skips tables that already exist)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()


app = FastAPI(
    title="Opportunity Finder — AI-Powered Job & Scholarship Aggregator",
    description="Aggregates scholarships, fellowships, grants and jobs from multiple sources.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend and any configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploaded avatars
uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(opportunities.router)
app.include_router(stats.router)
app.include_router(admin.router)
app.include_router(config.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
