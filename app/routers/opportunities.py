import json
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import get_current_user
from app.models import Opportunity, User
from app.schemas import (
    CandidateProfile,
    OpportunityDetail,
    OpportunityList,
    OpportunityOut,
    RerankedList,
    RerankedOpportunity,
    SourceCount,
)

router = APIRouter(tags=["opportunities"])

_SORTABLE = {
    "posted_at": Opportunity.posted_at,
    "title": Opportunity.title,
    "organization": Opportunity.organization,
    "deadline": Opportunity.deadline,
    "type": Opportunity.type,
    "source": Opportunity.source,
}


@router.get("/opportunities", response_model=OpportunityList)
async def list_opportunities(
    q: list[str] = Query(default=[], description="One or more keywords (OR logic). E.g. ?q=Python&q=Laravel"),
    type: str | None = Query(None, description="job/scholarship/fellowship/grant/internship"),
    source: str | None = None,
    country: str | None = None,
    active_only: bool = True,
    sort_by: str = Query("posted_at", description="posted_at | title | organization | deadline | type | source"),
    sort_dir: str = Query("desc", description="asc | desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    filters = []
    if type:
        filters.append(Opportunity.type == type)
    if source:
        filters.append(Opportunity.source == source)
    if country:
        filters.append(Opportunity.country == country)
    if active_only:
        filters.append(Opportunity.is_active.is_(True))
    if q:
        # Split each phrase into tokens and OR all tokens together so "software engineer"
        # matches opportunities containing either word, not requiring both.
        tokens = [token for phrase in q for token in phrase.split()]
        keyword_filters = [
            Opportunity.search_tsv.op("@@")(func.plainto_tsquery("simple", token))
            for token in tokens
        ]
        filters.append(or_(*keyword_filters))

    count_stmt = select(func.count()).select_from(Opportunity)
    list_stmt = select(Opportunity)
    for f in filters:
        count_stmt = count_stmt.where(f)
        list_stmt = list_stmt.where(f)

    total = await session.scalar(count_stmt) or 0

    sort_col = _SORTABLE.get(sort_by, Opportunity.posted_at)
    if sort_dir.lower() == "asc":
        primary_order = sort_col.asc().nullsfirst()
    else:
        primary_order = sort_col.desc().nullslast()

    list_stmt = (
        list_stmt.order_by(primary_order, Opportunity.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await session.scalars(list_stmt)).all()

    return OpportunityList(
        total=total,
        page=page,
        page_size=page_size,
        items=[OpportunityOut.model_validate(r) for r in rows],
    )


@router.get("/opportunities/types")
async def get_opportunity_types(session: AsyncSession = Depends(get_session)):
    """Returns all distinct opportunity types present in the database."""
    rows = await session.execute(
        select(distinct(Opportunity.type)).where(Opportunity.type.isnot(None), Opportunity.is_active.is_(True))
    )
    types = sorted([r[0] for r in rows if r[0]])
    return {"types": types}


@router.get("/opportunities/recommended", response_model=RerankedList)
async def get_recommended_opportunities(
    top_n: int = Query(30, ge=1, le=100, description="Top N from DB to send to AI (max 100)"),
    refresh: bool = Query(False, description="Force a fresh AI call, ignoring cache"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Returns AI-ranked recommendations for the logged-in user.
    Results are cached in the DB per user. Pass ?refresh=true to re-run the AI scorer.
    """
    if not current_user.parsed_cv:
        raise HTTPException(
            status_code=422,
            detail="No CV found on your profile. Please upload your CV first.",
        )
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    # --- Return cache if exists and refresh not requested ---
    user = await session.get(User, current_user.id)
    if not refresh and user.cached_recommendations:
        items = [
            RerankedOpportunity(**item)
            for item in user.cached_recommendations
        ]
        return RerankedList(total=len(items), items=items, cached=True)

    profile = user.parsed_cv
    keywords = profile.get("job_keywords", [])[:15]
    if not keywords:
        raise HTTPException(status_code=422, detail="CV has no job keywords. Please re-upload your CV.")

    # --- Step 1: DB fetch (across all types) ---
    keyword_filters = [
        Opportunity.search_tsv.op("@@")(func.plainto_tsquery("simple", kw))
        for kw in keywords
    ]
    
    combined_keywords = " OR ".join([f'"{kw}"' for kw in keywords])
    ts_query = func.websearch_to_tsquery("simple", combined_keywords)
    rank_col = func.ts_rank(Opportunity.search_tsv, ts_query).label("rank")

    stmt = (
        select(Opportunity, rank_col)
        .where(Opportunity.is_active.is_(True))
        .where(or_(*keyword_filters))
        .order_by(rank_col.desc(), Opportunity.posted_at.desc().nullslast())
        .limit(1000)
    )
    db_rows = (await session.execute(stmt)).all()

    if not db_rows:
        return RerankedList(total=0, items=[], cached=False)
        
    all_rows = [r[0] for r in db_rows]
    all_ranks = {r[0].id: r[1] for r in db_rows}
    
    rows_for_ai = all_rows[:top_n]

    # --- Step 2: Build scoring prompt ---
    candidate_summary = (
        f"Skills: {', '.join(profile.get('skills', []))}. "
        f"Keywords: {', '.join(profile.get('job_keywords', []))}. "
        f"Projects: {'; '.join(p.get('name', '') for p in profile.get('projects', []))}. "
        f"Achievements: {'; '.join(profile.get('achievements', [])[:5])}."
    )
    opportunities_context = [
        {
            "id": row.id,
            "title": row.title,
            "organization": row.organization,
            "type": row.type,
            "description": (row.description or "")[:400],
            "tags": row.tags,
        }
        for row in rows_for_ai
    ]

    scoring_prompt = f"""You are an expert career advisor. Score each opportunity for the candidate below.
Only give high scores (80+) for genuinely strong matches. Be precise.

CANDIDATE PROFILE:
{candidate_summary}

OPPORTUNITIES:
{json.dumps(opportunities_context, ensure_ascii=False)}

Return ONLY a valid JSON array:
[{{"id": <opportunity_id>, "match_score": <integer 0-100>, "match_reason": "<one concise sentence>"}}]"""

    # --- Step 3: Call GPT-5.5 ---
    _score_schema = {
        "type": "object",
        "properties": {
            "scores": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id":           {"type": "integer"},
                        "match_score":  {"type": "integer"},
                        "match_reason": {"type": "string"},
                    },
                    "required": ["id", "match_score", "match_reason"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["scores"],
        "additionalProperties": False,
    }

    fallback_active = False
    scores = []
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            ai_resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-5.5",
                    "messages": [{"role": "user", "content": scoring_prompt}],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "job_scores",
                            "strict": True,
                            "schema": _score_schema,
                        },
                    },
                },
            )
            ai_resp.raise_for_status()

        scores = json.loads(ai_resp.json()["choices"][0]["message"]["content"])["scores"]
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"OpenAI API failed, falling back to DB ranking. Error: {e}")
        fallback_active = True

    # --- Step 4: Merge rows with scores ---
    reranked = []
    if fallback_active:
        max_rank = max(all_ranks.values()) if all_ranks else 1.0
        if max_rank <= 0.0:
            max_rank = 1.0
            
        for row in all_rows:
            rank = all_ranks.get(row.id, 0.0)
            fallback_score = int((rank / max_rank) * 100)
            opp_out = OpportunityOut.model_validate(row)
            reranked.append(
                RerankedOpportunity(
                    **opp_out.model_dump(),
                    match_score=fallback_score,
                    match_reason="Matched by keyword relevance (AI fallback active).",
                )
            )
    else:
        score_map = {item["id"]: item for item in scores}
        for row in rows_for_ai:
            score_data = score_map.get(row.id, {"match_score": 0, "match_reason": "No reason provided."})
            opp_out = OpportunityOut.model_validate(row)
            reranked.append(
                RerankedOpportunity(
                    **opp_out.model_dump(),
                    match_score=score_data.get("match_score", 0),
                    match_reason=score_data.get("match_reason", ""),
                )
            )

    reranked.sort(key=lambda x: x.match_score, reverse=True)

    # --- Step 5: Save to cache ---
    user.cached_recommendations = [item.model_dump(mode="json") for item in reranked]
    user.recommendations_cached_at = datetime.now(timezone.utc)
    await session.commit()

    return RerankedList(total=len(reranked), items=reranked, cached=False)



@router.get("/opportunities/{opp_id}", response_model=OpportunityDetail)
async def get_opportunity(
    opp_id: int,
    session: AsyncSession = Depends(get_session),
):
    row = await session.get(Opportunity, opp_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return OpportunityDetail.model_validate(row)



@router.post("/opportunities/rerank", response_model=RerankedList)
async def rerank_opportunities(
    profile: CandidateProfile,
    type: str | None = Query(None, description="job/scholarship/fellowship/grant/internship"),
    top_n: int = Query(20, ge=1, le=50, description="Number of candidates to fetch from DB before AI re-ranking"),
    session: AsyncSession = Depends(get_session),
):
    """
    Fetches the top matching opportunities from the DB using keyword OR-search,
    then calls GPT-5.5 to score and rank each one against the candidate's full
    profile. Returns results sorted by match_score descending.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured on the server.")

    if not profile.job_keywords:
        raise HTTPException(status_code=422, detail="CandidateProfile must contain at least one job_keyword.")

    # --- Step 1: Fast DB fetch using OR keyword logic ---
    filters = [Opportunity.is_active.is_(True)]
    if type:
        filters.append(Opportunity.type == type)

    keywords = profile.job_keywords[:15]
    keyword_filters = [
        Opportunity.search_tsv.op("@@")(func.plainto_tsquery("simple", kw))
        for kw in keywords
    ]
    filters.append(or_(*keyword_filters))
    
    combined_keywords = " OR ".join([f'"{kw}"' for kw in keywords])
    ts_query = func.websearch_to_tsquery("simple", combined_keywords)
    rank_col = func.ts_rank(Opportunity.search_tsv, ts_query).label("rank")

    stmt = select(Opportunity, rank_col)
    for f in filters:
        stmt = stmt.where(f)
    stmt = stmt.order_by(rank_col.desc(), Opportunity.posted_at.desc().nullslast()).limit(1000)
    db_rows = (await session.execute(stmt)).all()

    if not db_rows:
        return RerankedList(total=0, items=[])
        
    all_rows = [r[0] for r in db_rows]
    all_ranks = {r[0].id: r[1] for r in db_rows}
    
    rows_for_ai = all_rows[:top_n]

    # --- Step 2: Build a compact context for the scorer ---
    candidate_summary = (
        f"Skills: {', '.join(profile.skills)}. "
        f"Keywords: {', '.join(profile.job_keywords)}. "
        f"Projects: {'; '.join(p.get('name', '') for p in profile.projects)}. "
        f"Achievements: {'; '.join(profile.achievements[:5])}."
    )

    opportunities_context = [
        {
            "id": row.id,
            "title": row.title,
            "organization": row.organization,
            "type": row.type,
            "description": (row.description or "")[:400],  # Truncate to save tokens
            "tags": row.tags,
        }
        for row in rows_for_ai
    ]

    scoring_prompt = f"""You are an expert career advisor. Given the candidate profile and a list of opportunities, \
return a JSON array scoring each opportunity. Be precise and strict — only give high scores (80+) for genuinely strong matches.

CANDIDATE PROFILE:
{candidate_summary}

OPPORTUNITIES (list of objects with id, title, type, description, tags):
{json.dumps(opportunities_context, ensure_ascii=False)}

Return ONLY a valid JSON array (no markdown, no explanation) in this exact format:
[{{"id": <opportunity_id>, "match_score": <integer 0-100>, "match_reason": "<one concise sentence why>"}}]"""

    # --- Step 3: Call GPT-5.5 ---
    _score_schema = {
        "type": "object",
        "properties": {
            "scores": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id":           {"type": "integer"},
                        "match_score":  {"type": "integer"},
                        "match_reason": {"type": "string"},
                    },
                    "required": ["id", "match_score", "match_reason"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["scores"],
        "additionalProperties": False,
    }

    fallback_active = False
    scores = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            ai_resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-5.5",
                    "messages": [{"role": "user", "content": scoring_prompt}],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "job_scores",
                            "strict": True,
                            "schema": _score_schema,
                        },
                    },
                },
            )
            ai_resp.raise_for_status()

        scores = json.loads(ai_resp.json()["choices"][0]["message"]["content"])["scores"]
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"OpenAI API failed during rerank, falling back to DB ranking. Error: {e}")
        fallback_active = True

    # --- Step 4: Merge scores with DB rows and sort ---
    reranked = []
    if fallback_active:
        max_rank = max(all_ranks.values()) if all_ranks else 1.0
        if max_rank <= 0.0:
            max_rank = 1.0
            
        for row in all_rows:
            rank = all_ranks.get(row.id, 0.0)
            fallback_score = int((rank / max_rank) * 100)
            opp_out = OpportunityOut.model_validate(row)
            reranked.append(
                RerankedOpportunity(
                    **opp_out.model_dump(),
                    match_score=fallback_score,
                    match_reason="Matched by keyword relevance (AI fallback active).",
                )
            )
    else:
        score_map = {item["id"]: item for item in scores}
        for row in rows_for_ai:
            score_data = score_map.get(row.id, {"match_score": 0, "match_reason": "No score returned by AI."})
            opp_out = OpportunityOut.model_validate(row)
            reranked.append(
                RerankedOpportunity(
                    **opp_out.model_dump(),
                    match_score=score_data.get("match_score", 0),
                    match_reason=score_data.get("match_reason", ""),
                )
            )

    reranked.sort(key=lambda x: x.match_score, reverse=True)

    return RerankedList(total=len(reranked), items=reranked)


@router.get("/sources", response_model=list[SourceCount], tags=["meta"])
async def list_sources(session: AsyncSession = Depends(get_session)):
    stmt = (
        select(Opportunity.source, func.count().label("count"))
        .group_by(Opportunity.source)
        .order_by(func.count().desc())
    )
    rows = (await session.execute(stmt)).all()
    return [SourceCount(source=r.source, count=r.count) for r in rows]
