"""
Map an Opportunity ORM row (as a dict) to a Campus365 OpportunitySchema payload.

Usage:
    from app.campus365 import build, payload_hash

    payload = build(row_dict)          # returns dict ready for POST/PUT
    h = payload_hash(row_dict)         # stable hash — if it changes, the record needs a PUT
"""
import hashlib
import html
import json
import re

import httpx

# ── source display names ──────────────────────────────────────────────────────
SRC = {
    "shomvob": "Shomvob",
    "bdjobs": "BDJobs",
    "opp4africans": "Opportunities For Africans",
    "opp4youth": "Opportunities For Youth",
    "opportunitydesk": "Opportunity Desk",
    "uri_fellowships": "URI Fellowships",
}

# ── WordPress REST bases for tag resolution ───────────────────────────────────
WP = {
    "opportunitydesk": "https://opportunitydesk.org/wp-json/wp/v2",
    "opp4youth": "https://opportunitiesforyouth.org/wp-json/wp/v2",
    "opp4africans": "https://www.opportunitiesforafricans.com/wp-json/wp/v2",
    "uri_fellowships": "https://web.uri.edu/fellowships/wp-json/wp/v2",
}

GENERIC = {
    "all", "fellowship/grant", "scholarship", "scholarships", "fellowship",
    "fellowships", "grant", "grants", "opportunity", "opportunities",
    "uncategorized", "featured", "undergraduate/graduate",
}

# Rule-based tag patterns (applied to title + body for non-job types)
LEVELS = [
    (r"\bph\.?d|doctora", "PhD"),
    (r"\bmaster", "Masters"),
    (r"\bbachelor|\bundergraduate", "Undergraduate"),
    (r"post-?doc", "Postdoctoral"),
    (r"fully[- ]funded|full scholarship|full tuition", "Fully-Funded"),
    (r"\bintern(ship)?\b", "Internship"),
    (r"\bresearch\b", "Research"),
    (r"\bsummer\b", "Summer Program"),
]

_tag_cache: dict = {}


# ── helpers ───────────────────────────────────────────────────────────────────

def _strip_html(h: str) -> str:
    if not h:
        return ""
    h = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>|</div>", "\n", h)
    h = re.sub(r"(?i)<li[^>]*>", "- ", h)
    h = re.sub(r"<[^>]+>", "", h)
    h = html.unescape(h)
    h = re.sub(r"[ \t\xa0]+", " ", h)
    h = re.sub(r" *\n *", "\n", h)
    return re.sub(r"\n{3,}", "\n\n", h).strip()


def _short(text: str, n: int = 220) -> str:
    t = re.sub(r"\s+", " ", text).strip()
    if len(t) <= n:
        return t
    cut = t[:n]
    end = max(cut.rfind(". "), cut.rfind("? "))
    return cut[:end + 1] if end > 80 else cut[:cut.rfind(" ")].rstrip(",;:") + "…"


def _wp_tag_names(source: str, ids: list) -> list[str]:
    """Resolve WordPress numeric tag IDs to names (cached, non-fatal on error)."""
    base = WP.get(source)
    ids = [int(i) for i in ids if str(i).isdigit()]
    if not base or not ids:
        return []
    missing = [i for i in ids if (source, i) not in _tag_cache]
    if missing:
        try:
            r = httpx.get(
                f"{base}/tags",
                params={"include": ",".join(map(str, missing)), "per_page": 100, "_fields": "id,name"},
                timeout=20,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            for t in r.json():
                _tag_cache[(source, t["id"])] = html.unescape(t["name"]).strip()
        except Exception:
            pass
        for i in missing:
            _tag_cache.setdefault((source, i), None)
    return [_tag_cache[(source, i)] for i in ids if _tag_cache.get((source, i))]


def _make_tags(row: dict, body: str) -> str | None:
    title = row["title"].lower()
    out, seen = [], set()

    def add(t: str) -> None:
        t = t.strip(" .,-")
        k = t.lower()
        if not t or k in seen or k in GENERIC or len(t) > 40 or k in title or title in k:
            return
        seen.add(k)
        out.append(t)

    raw = row.get("raw") or {}
    if row["source"] == "shomvob":
        add(raw.get("job_type_en") or raw.get("main_category") or "")

    for n in _wp_tag_names(row["source"], row.get("tags") or []):
        add(n)

    # Rule-based tags — only for non-job types (degree words in job titles = requirements, not tags)
    if row["type"] != "job":
        hay = (row["title"] + " " + (body or "")[:600]).lower()
        for pat, label in LEVELS:
            if re.search(pat, hay):
                add(label)

    return ",".join(out[:5]) or None


# ── main builder ──────────────────────────────────────────────────────────────

def build(row: dict) -> dict:
    """Convert a DB opportunity row (dict) to a Campus365 OpportunitySchema payload."""
    t = row["type"]
    raw = row.get("raw") or {}
    src = row["source"]

    p: dict = {
        "type": t.upper(),
        "category": t.upper(),
        "mode": "OFF_CAMPUS",
        "title": row["title"].strip(),
        "url": html.unescape(row.get("apply_url") or row.get("url") or "").strip() or None,
        "status": "PUBLISHED",
        "featured": False,
        "deadline": (row["deadline"] + "T00:00:00") if row.get("deadline") else None,
        "start_date": row["posted_at"][:19] if row.get("posted_at") else None,
    }

    # location: city + country (jobs only for city)
    city = (row.get("location") or "").strip() if t == "job" else ""
    country = (row.get("country") or "").strip()
    if len(city) > 100:
        city = "Multiple locations"
    p["location"] = (
        f"{city}, {country}"
        if city and country and country.lower() not in city.lower()
        else city or country
    ) or None

    extra: list[str] = []

    if t == "job":
        p["organization"] = row["organization"]
        if src == "shomvob":
            body = _strip_html(row.get("description")) or _strip_html(raw.get("job_responsibilities_en"))
            p.update(
                employment_type=raw.get("employment_status_en"),
                experience_level=raw.get("work_exp_en"),
                compensation=row.get("salary"),
                logo_url=raw.get("company_logo"),
            )
            if raw.get("vacancy") and not raw.get("is_vacancy_hide"):
                extra.append(f"Vacancies: {raw['vacancy']}")
            if raw.get("education_en"):
                extra.append(f"Education: {raw['education_en']}")
        else:  # bdjobs
            body = _strip_html(raw.get("jobDescription"))
            body = ("Education & requirements:\n" + body) if body else body
            p.update(
                employment_type=re.sub(r"(?<=[a-z])(?=[A-Z])", " ", raw.get("JobType") or "") or None,
                experience_level=None if raw.get("experience") in (None, "", "NA") else raw["experience"],
                compensation=None if (row.get("salary") or "").strip() in ("", "--") else row.get("salary", "").strip(),
                logo_url=raw.get("logoUrl") or None,
            )
            if raw.get("Vacancies"):
                extra.append(f"Vacancies: {raw['Vacancies']}")
            if raw.get("WorkPlace"):
                extra.append(f"Work place: {raw['WorkPlace']}")
    else:
        body = _strip_html(row.get("description")) or "Full details, eligibility and how to apply are on the official program page."

    if body and extra:
        body = body + "\n\n" + "\n\n".join(extra)

    p["details"] = (body[:7000].rstrip() + f"\n\nSource: {SRC[src]}") if body else None
    p["short_description"] = _short(body) if (row.get("description") or t == "job") and body else None
    p["tags"] = _make_tags(row, body)

    return {k: v for k, v in p.items() if v not in (None, "")}


def payload_hash(row: dict) -> str:
    """Stable SHA-1 of the fields that matter for change detection."""
    key = {
        "title": row.get("title"),
        "url": row.get("apply_url") or row.get("url"),
        "deadline": str(row.get("deadline")),
        "is_active": row.get("is_active"),
        "content_hash": row.get("content_hash"),
    }
    return hashlib.sha1(json.dumps(key, sort_keys=True).encode()).hexdigest()
