from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/api/literature", tags=["literature"])


class LookupRequest(BaseModel):
    title: str | None = None
    doi: str | None = None


class LookupResponse(BaseModel):
    title: str | None = None
    authors: str | None = None
    year: int | None = None
    journal: str | None = None
    doi: str | None = None
    abstract: str | None = None
    keywords: list[str] = []
    citation_count: int | None = None
    url: str | None = None
    source: str = ""


async def lookup_crossref_title(title: str) -> dict:
    """Search CrossRef by title (free, no API key needed)"""
    url = "https://api.crossref.org/works"
    params = {"query.bibliographic": title, "rows": 3}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return {}
        data = resp.json()
        items = data.get("message", {}).get("items", [])
        if not items:
            return {}
        item = items[0]
        return {
            "title": item.get("title", [None])[0],
            "authors": ", ".join(
                f"{a.get('given', '')} {a.get('family', '')}".strip()
                for a in item.get("author", [])
            ),
            "year": item.get("published-print", {}).get("date-parts", [[None]])[0][0],
            "journal": (item.get("container-title") or [None])[0],
            "doi": item.get("DOI"),
            "abstract": item.get("abstract"),
            "keywords": item.get("subject", []),
            "citation_count": item.get("is-referenced-by-count"),
            "url": item.get("URL"),
            "source": "crossref",
        }


async def lookup_semantic_scholar(title: str) -> dict:
    """Search Semantic Scholar (free, no API key needed)"""
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": title,
        "limit": 3,
        "fields": "title,authors,year,journal,externalIds,abstract,citationCount,url,publicationTypes",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return {}
        data = resp.json()
        papers = data.get("data", [])
        if not papers:
            return {}
        p = papers[0]
        authors = ", ".join(a.get("name", "") for a in p.get("authors", []))
        return {
            "title": p.get("title"),
            "authors": authors,
            "year": p.get("year"),
            "journal": p.get("journal", {}).get("name") if p.get("journal") else None,
            "doi": p.get("externalIds", {}).get("DOI"),
            "abstract": p.get("abstract"),
            "keywords": [],
            "citation_count": p.get("citationCount"),
            "url": p.get("url"),
            "source": "semantic_scholar",
        }


async def lookup_crossref_doi(doi: str) -> dict:
    """Look up by DOI"""
    url = f"https://api.crossref.org/works/{doi}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return {}
        data = resp.json()
        item = data.get("message", {})
        return {
            "title": item.get("title", [None])[0],
            "authors": ", ".join(
                f"{a.get('given', '')} {a.get('family', '')}".strip()
                for a in item.get("author", [])
            ),
            "year": item.get("published-print", {}).get("date-parts", [[None]])[0][0]
            or item.get("created", {}).get("date-parts", [[None]])[0][0],
            "journal": (item.get("container-title") or [None])[0],
            "doi": item.get("DOI"),
            "abstract": item.get("abstract"),
            "keywords": item.get("subject", []),
            "citation_count": item.get("is-referenced-by-count"),
            "url": item.get("URL"),
            "source": "crossref_doi",
        }


@router.post("/lookup", response_model=LookupResponse)
async def lookup_paper(req: LookupRequest):
    """Look up paper metadata from academic databases"""
    result = {}

    # Try DOI first (most accurate)
    if req.doi:
        result = await lookup_crossref_doi(req.doi)
        if result:
            return LookupResponse(**result)

    # Try title-based search
    if req.title:
        result = await lookup_crossref_title(req.title)
        if result.get("title"):
            return LookupResponse(**result)

        # Fallback to Semantic Scholar
        result = await lookup_semantic_scholar(req.title)
        if result.get("title"):
            return LookupResponse(**result)

    raise HTTPException(status_code=404, detail="未找到匹配的文献信息")


@router.post("/lookup-auto", response_model=LookupResponse)
async def lookup_auto(req: LookupRequest):
    """Auto-lookup: returns partial results if found, empty if not"""
    result = {}

    if req.doi:
        result = await lookup_crossref_doi(req.doi)

    if not result and req.title:
        result = await lookup_crossref_title(req.title)
        if not result.get("title"):
            result = await lookup_semantic_scholar(req.title)

    return LookupResponse(**(result or {}))
