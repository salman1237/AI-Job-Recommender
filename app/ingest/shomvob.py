from datetime import date, datetime

from app.config import settings
from app.ingest.base import Adapter, Normalized
from app.ingest.http import make_client, request_with_retry

SHOMVOB_URL = (
    "https://backend-api.shomvob.co/api/v2/jobpost/get-active-job-list-guest"
)


def _str(value) -> str | None:
    if value in (None, ""):
        return None
    return str(value).strip() or None


def _parse_deadline(value) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


class ShomvobAdapter(Adapter):
    """Shomvob guest endpoint — returns all active jobs in one POST."""

    source = "shomvob"

    async def fetch(self, since: datetime | None) -> list[Normalized]:
        headers = {
            "Authorization": f"Bearer {settings.shomvob_token}",
            "Content-Type": "application/json",
        }
        async with make_client(headers=headers) as client:
            resp = await request_with_retry(
                client, "POST", SHOMVOB_URL, json={}
            )
            resp.raise_for_status()
            payload = resp.json()

        if payload.get("error"):
            raise RuntimeError(f"Shomvob API error: {payload['error']}")

        jobs = payload.get("data") or []
        results: list[Normalized] = []
        for job in jobs:
            n = self._normalize(job)
            if n is not None:
                results.append(n)
        return results

    def _normalize(self, job: dict) -> Normalized | None:
        job_id = _str(job.get("id"))
        if not job_id:
            return None
        title = _str(job.get("job_title")) or "(untitled)"
        location = (
            _str(job.get("location_en"))
            or _str(job.get("job_locations_en"))
            or _str(job.get("job_locations"))
        )
        return Normalized(
            source=self.source,
            external_id=job_id,
            type="job",
            title=title,
            url=f"https://app.shomvob.co/all-jobs?job={job_id}",
            organization=_str(job.get("company_name")),
            description=_str(job.get("job_description"))
            or _str(job.get("job_responsibilities_en")),
            apply_url=f"https://app.shomvob.co/all-jobs?job={job_id}",
            location=location,
            country=_str(job.get("country_en")) or "Bangladesh",
            category=_str(job.get("job_type_en")) or "job",
            salary=_str(job.get("salary_range")),
            deadline=_parse_deadline(job.get("application_deadline")),
            posted_at=None,
            raw=job,
        )
