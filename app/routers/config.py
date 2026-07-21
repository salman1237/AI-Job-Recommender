"""Public configuration endpoints — no auth required."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import SiteConfig

router = APIRouter(prefix="/config", tags=["config"])

DEFAULT_LANDING: dict = {
    "hero": {
        "badge": "AI-Powered Opportunity Discovery",
        "headline": "Find Your Perfect Opportunity with AI",
        "subtext": (
            "Upload your CV or enter your skills. Our AI matches you to jobs, "
            "scholarships, fellowships, and more — instantly ranked by fit."
        ),
        "cta_primary": "Get Started Free",
        "cta_secondary": "Browse Opportunities",
    },
    "stats": [
        {"value": "500+", "label": "Active Opportunities"},
        {"value": "5 Types", "label": "Jobs, Grants & More"},
        {"value": "AI", "label": "Ranked by Fit"},
        {"value": "Free", "label": "No Cost, No Limits"},
    ],
    "types_label": "One platform for every opportunity type",
    "how_it_works": {
        "title": "How It Works",
        "subtitle": "From sign-up to your first AI match in under two minutes.",
        "steps": [
            {
                "num": "01",
                "title": "Create your account",
                "desc": "Sign up in under a minute with just your email address.",
            },
            {
                "num": "02",
                "title": "Add your profile",
                "desc": "Upload a PDF CV or manually enter your skills, education, and projects.",
            },
            {
                "num": "03",
                "title": "Get AI-matched",
                "desc": "AI ranks hundreds of opportunities by fit and presents the best ones first.",
            },
        ],
    },
    "features": {
        "title": "Everything You Need",
        "subtitle": "Built for job seekers, students, and researchers who want better matches faster.",
        "items": [
            {
                "icon": "Sparkles",
                "title": "AI-Powered Matching",
                "desc": "Upload your CV or enter your skills. Our AI ranks every opportunity by how well it fits your unique background.",
            },
            {
                "icon": "Globe",
                "title": "Diverse Opportunities",
                "desc": "Jobs, scholarships, fellowships, grants, and internships — all in one place, continuously updated.",
            },
            {
                "icon": "Search",
                "title": "Smart Browse & Filter",
                "desc": "Filter by type, location, or deadline. Sort by score or date. Find what matters without the noise.",
            },
            {
                "icon": "Mail",
                "title": "Email Alerts",
                "desc": "Get notified about new opportunities that match your profile so you never miss a deadline.",
            },
        ],
    },
    "cta_banner": {
        "title": "Ready to find your next opportunity?",
        "subtitle": "It's free. Sign up in seconds and let AI do the searching.",
        "button": "Start for Free",
    },
}


@router.get("/landing")
async def get_landing_content(session: AsyncSession = Depends(get_session)):
    record = await session.get(SiteConfig, "landing_page")
    return record.value if record else DEFAULT_LANDING
