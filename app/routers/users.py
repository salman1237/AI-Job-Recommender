"""User profile routes: get profile, upload avatar, upload & parse CV."""
import io
import json
import os
from pathlib import Path

import httpx
import PyPDF2
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import get_current_user
from app.models import User

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

    # 1. Save file
    filename = f"cv_user_{current_user.id}.pdf"
    dest = CVS_DIR / filename
    content = await file.read()
    dest.write_bytes(content)

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

    # 3. Call Gemini 2.5 Flash to extract structured CV data
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured")

    prompt = f"""Extract the following information from the resume text below and return it as a single valid JSON object with these exact keys:
- "skills": array of strings
- "education": object with keys like "degree", "institution", "year"  
- "achievements": array of strings
- "projects": array of objects with keys "name" and "description"
- "job_keywords": array of strings (all possible job titles, roles, and technologies this candidate should search for)

Return ONLY the raw JSON. No markdown, no explanation.

RESUME TEXT:
{resume_text[:8000]}"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                headers={
                    "X-goog-api-key": settings.gemini_api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"response_mime_type": "application/json"},
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e.response.text[:300]}")

    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    try:
        parsed_cv = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Gemini returned invalid JSON")

    # 4. Save parsed CV to DB
    user = await session.get(User, current_user.id)
    user.parsed_cv = parsed_cv
    await session.commit()
    await session.refresh(user)
    return user
