from datetime import datetime

from dateutil import parser as dateparser

from app.ingest.base import Adapter, Normalized
from app.ingest.http import make_client, request_with_retry

BDJOBS_URL = "https://api.bdjobs.com/Jobs/api/JobSearch/GetJobSearch"

BROWSER_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.bdjobs.com",
    "Referer": "https://www.bdjobs.com/",
}


def _first(d: dict, *keys: str) -> str | None:
    """Return the first present, non-empty value among casing variants."""
    for k in keys:
        v = d.get(k)
        if v not in (None, ""):
            return str(v).strip()
    return None


def _parse_skills(*values: str | None) -> list[str]:
    skills: list[str] = []
    for value in values:
        if not value:
            continue
        for part in value.replace("|", ",").split(","):
            part = part.strip()
            if part and part not in skills:
                skills.append(part)
    return skills


def _parse_deadline(value: str | None):
    if not value:
        return None
    try:
        return dateparser.parse(value).date()
    except (ValueError, OverflowError, TypeError):
        return None


class BDJobsAdapter(Adapter):
    """Unofficial BDJobs search endpoint. No date filter — dedup handles novelty."""

    source = "bdjobs"
    RPP = 100
    MAX_PAGES = 20

    async def fetch(self, since: datetime | None) -> list[Normalized]:
        results: list[Normalized] = []
        seen_ids: set[str] = set()

        async with make_client(headers=BROWSER_HEADERS) as client:
            page = 1
            while page <= self.MAX_PAGES:
                params = {
                    "keyword": "",
                    "pg": page,
                    "rpp": self.RPP,
                    "ToggleJobs": "true",
                    "isPro": 1,
                    "location": "",
                }
                resp = await request_with_retry(
                    client, "GET", BDJOBS_URL, params=params
                )
                resp.raise_for_status()
                payload = resp.json()

                if str(payload.get("statuscode")) != "1":
                    break

                jobs = (payload.get("data") or []) + (payload.get("premiumData") or [])
                if not jobs:
                    break

                new_on_page = 0
                for job in jobs:
                    n = self._normalize(job)
                    if n is None or n.external_id in seen_ids:
                        continue
                    seen_ids.add(n.external_id)
                    results.append(n)
                    new_on_page += 1

                # If a page returns nothing new, the API is looping — stop.
                if new_on_page == 0:
                    break
                page += 1

        return results

    def _normalize(self, job: dict) -> Normalized | None:
        job_id = _first(job, "Jobid", "jobid", "JobId")
        if not job_id:
            return None
        title = _first(job, "jobTitle", "jobtitle", "JobTitle") or "(untitled)"
        url = f"https://jobs.bdjobs.com/jobdetails.asp?id={job_id}&ln=1"
        skills = _parse_skills(
            job.get("SkillsRequired"), job.get("SuggestedSkills")
        )
        return Normalized(
            source=self.source,
            external_id=job_id,
            type="job",
            title=title,
            url=url,
            organization=_first(job, "companyName", "companyname", "CompnayName"),
            description=_first(job, "JobDescription"),
            apply_url=url,
            location=_first(job, "location", "jobLocation", "JobLocation"),
            country="Bangladesh",
            category="job",
            tags=skills,
            deadline=_parse_deadline(
                _first(job, "deadLine", "deadline", "Deadline")
            ),
            posted_at=self._parse_posted(job),
            raw=job,
        )

    @staticmethod
    def _parse_posted(job: dict):
        value = _first(job, "publishDate", "postedon")
        if not value:
            return None
        try:
            return dateparser.parse(value)
        except (ValueError, OverflowError, TypeError):
            return None
