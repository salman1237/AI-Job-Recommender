"""User profile routes: get profile, upload avatar, upload & parse CV."""
import hashlib
import hmac
import io
import json
import os
from pathlib import Path

import httpx
import PyPDF2
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import get_current_user
from app.models import SavedSearch, User
from app.schemas import SavedSearchCreate, SavedSearchOut, SavedSearchUpdate
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])

UPLOAD_DIR = Path(settings.upload_dir)
AVATARS_DIR = UPLOAD_DIR / "avatars"
CVS_DIR = UPLOAD_DIR / "cvs"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
CVS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_CV_TYPES = {"application/pdf"}


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    avatar_path: str | None
    parsed_cv: dict | None
    email_digest_enabled: bool = True
    email_alerts_enabled: bool = True

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/avatar")
async def get_avatar(current_user: User = Depends(get_current_user)):
    if not current_user.avatar_path or not Path(current_user.avatar_path).exists():
        raise HTTPException(status_code=404, detail="No avatar uploaded")
    return FileResponse(current_user.avatar_path)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, or GIF images allowed")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"user_{current_user.id}.{ext}"
    dest = AVATARS_DIR / filename

    content = await file.read()
    dest.write_bytes(content)

    # Reload user in session scope to update
    user = await session.get(User, current_user.id)
    user.avatar_path = str(dest)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/me/cv", response_model=UserOut)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in ALLOWED_CV_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # 1. Read file into memory (no longer saving to disk)
    content = await file.read()

    # 2. Extract text with PyPDF2
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        resume_text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        ).strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")

    if not resume_text:
        raise HTTPException(status_code=422, detail="PDF appears to be empty or image-only")

    # 3. Call GPT-5.5 to extract structured CV data
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")

    prompt = f"""Extract structured information from the resume text below.

RESUME TEXT:
{resume_text[:8000]}"""

    cv_schema = {
        "type": "object",
        "properties": {
            "skills":       {"type": "array", "items": {"type": "string"}},
            "education": {
                "type": "object",
                "properties": {
                    "degree":      {"type": ["string", "null"]},
                    "institution": {"type": ["string", "null"]},
                    "year":        {"type": ["string", "null"]},
                },
                "required": ["degree", "institution", "year"],
                "additionalProperties": False,
            },
            "experience": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title":        {"type": "string"},
                        "company":      {"type": "string"},
                        "duration":     {"type": "string"},
                        "description":  {"type": "string"},
                    },
                    "required": ["title", "company", "duration", "description"],
                    "additionalProperties": False,
                },
            },
            "achievements": {"type": "array", "items": {"type": "string"}},
            "projects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name":        {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["name", "description"],
                    "additionalProperties": False,
                },
            },
            "job_keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["skills", "education", "experience", "achievements", "projects", "job_keywords"],
        "additionalProperties": False,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-5.5",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a CV parser. Extract skills, education, work experience, achievements, "
                                "projects, and job keywords from the resume. "
                                "For experience, extract each role as title, company, duration, and a brief description of responsibilities. "
                                "job_keywords should be broad, short, searchable terms: role titles WITHOUT seniority "
                                "qualifiers (write 'Software Engineer' not 'Software Engineer Intern'), "
                                "technologies, frameworks, and domains the candidate works with. "
                                "Avoid overly specific multi-word phrases. Aim for 15-25 clean keywords."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "parsed_cv",
                            "strict": True,
                            "schema": cv_schema,
                        },
                    },
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e.response.text[:300]}")

    try:
        parsed_cv = json.loads(resp.json()["choices"][0]["message"]["content"])
    except (KeyError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=502, detail=f"OpenAI returned unexpected response: {e}")

    # 4. Save parsed CV to DB
    user = await session.get(User, current_user.id)
    user.parsed_cv = parsed_cv
    await session.commit()
    await session.refresh(user)
    return user


class ManualProfileIn(BaseModel):
    skills: list[str] = []
    education: dict | None = None
    experience: list[dict] = []
    achievements: list[str] = []
    projects: list[dict] = []


@router.put("/me/manual-profile", response_model=UserOut)
async def update_manual_profile(
    body: ManualProfileIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")

    lines = []
    if body.skills:
        lines.append(f"Skills: {', '.join(body.skills)}")
    if body.education:
        edu = body.education
        lines.append(
            f"Education: {edu.get('degree', '')} at {edu.get('institution', '')} ({edu.get('year', '')})"
        )
    for exp in body.experience:
        title = exp.get("title", "")
        company = exp.get("company", "")
        duration = exp.get("duration", "")
        desc = exp.get("description", "")
        lines.append(f"Experience: {title} at {company} ({duration}) — {desc}")
    if body.achievements:
        lines.append(f"Achievements: {'; '.join(body.achievements)}")
    for p in body.projects:
        name = p.get("name", "")
        desc = p.get("description", "")
        lines.append(f"Project '{name}': {desc}")

    profile_text = "\n".join(lines) if lines else "No profile data provided."

    keywords_schema = {
        "type": "object",
        "properties": {
            "job_keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["job_keywords"],
        "additionalProperties": False,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-5.5",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a career AI. Given a candidate's profile, generate a list of "
                                "targeted job keywords they should search for — job titles, roles, "
                                "technologies, domains, and opportunity types that best match their background. "
                                "Return 15-30 keywords."
                            ),
                        },
                        {"role": "user", "content": profile_text},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "keywords_result",
                            "strict": True,
                            "schema": keywords_schema,
                        },
                    },
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e.response.text[:300]}")

    try:
        ai_result = json.loads(resp.json()["choices"][0]["message"]["content"])
        job_keywords = ai_result.get("job_keywords", [])
    except (KeyError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=502, detail=f"OpenAI returned unexpected response: {e}")

    existing = dict(current_user.parsed_cv or {})
    education = (
        body.education
        or existing.get("education")
        or {"degree": None, "institution": None, "year": None}
    )

    updated_cv = {
        "skills": body.skills,
        "education": education,
        "experience": body.experience,
        "achievements": body.achievements,
        "projects": body.projects,
        "job_keywords": job_keywords,
    }

    user = await session.get(User, current_user.id)
    user.parsed_cv = updated_cv
    await session.commit()
    await session.refresh(user)
    return user


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.put("/me/password")
async def change_password(
    body: ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters.")
    user = await session.get(User, current_user.id)
    user.hashed_password = hash_password(body.new_password)
    await session.commit()
    return {"message": "Password changed successfully."}


@router.delete("/me")
async def delete_account(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be self-deleted.")
    user = await session.get(User, current_user.id)
    await session.delete(user)
    await session.commit()
    return {"message": "Account deleted successfully."}


class EmailPreferencesIn(BaseModel):
    email_digest_enabled: bool
    email_alerts_enabled: bool


@router.put("/me/email-preferences", response_model=UserOut)
async def update_email_preferences(
    body: EmailPreferencesIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, current_user.id)
    user.email_digest_enabled = body.email_digest_enabled
    user.email_alerts_enabled = body.email_alerts_enabled
    await session.commit()
    await session.refresh(user)
    return user


MAX_SAVED_SEARCHES = 5


@router.get("/me/saved-searches", response_model=list[SavedSearchOut])
async def list_saved_searches(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(SavedSearch)
        .where(SavedSearch.user_id == current_user.id)
        .order_by(SavedSearch.created_at.desc())
    )
    return result.scalars().all()


@router.post("/me/saved-searches", response_model=SavedSearchOut, status_code=201)
async def create_saved_search(
    body: SavedSearchCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    count = await session.scalar(
        select(func.count()).select_from(SavedSearch).where(SavedSearch.user_id == current_user.id)
    )
    if count >= MAX_SAVED_SEARCHES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_SAVED_SEARCHES} saved searches reached. Delete one to add a new search.",
        )
    search = SavedSearch(
        user_id=current_user.id,
        name=body.name.strip() or "My Search",
        keywords=body.keywords or None,
        opp_type=body.opp_type or None,
        country=body.country or None,
    )
    session.add(search)
    await session.commit()
    await session.refresh(search)
    return search


@router.patch("/me/saved-searches/{search_id}", response_model=SavedSearchOut)
async def update_saved_search(
    search_id: int,
    body: SavedSearchUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    search = await session.scalar(
        select(SavedSearch).where(
            SavedSearch.id == search_id, SavedSearch.user_id == current_user.id
        )
    )
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found.")
    if body.name is not None:
        search.name = body.name.strip() or search.name
    if body.notify_enabled is not None:
        search.notify_enabled = body.notify_enabled
    await session.commit()
    await session.refresh(search)
    return search


@router.delete("/me/saved-searches/{search_id}", status_code=204)
async def delete_saved_search(
    search_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    search = await session.scalar(
        select(SavedSearch).where(
            SavedSearch.id == search_id, SavedSearch.user_id == current_user.id
        )
    )
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found.")
    await session.delete(search)
    await session.commit()


def _make_unsub_sig(email: str, type_: str) -> str:
    key = settings.jwt_secret.encode()
    msg = f"{email}:{type_}".encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


@router.get("/unsubscribe")
async def unsubscribe(
    email: str = Query(...),
    type: str = Query(..., description="digest | alerts | all"),
    sig: str = Query(...),
    session: AsyncSession = Depends(get_session),
):
    """Public one-click unsubscribe link embedded in emails. No login required."""
    expected = _make_unsub_sig(email, type)
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link.")

    user = await session.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if type in ("digest", "all"):
        user.email_digest_enabled = False
    if type in ("alerts", "all"):
        user.email_alerts_enabled = False
    await session.commit()

    return RedirectResponse(url=f"{settings.app_url}/unsubscribe-success?type={type}&done=1", status_code=302)
