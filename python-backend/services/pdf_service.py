import os
import tempfile
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/pdf", tags=["pdf"])


class PDFExtractResponse(BaseModel):
    text: str
    pages: int
    title: str | None = None
    authors: str | None = None
    doi: str | None = None
    keywords: str | None = None
    year: int | None = None


@router.post("/extract", response_model=PDFExtractResponse)
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        doc = fitz.open(tmp_path)
        text = ""
        title = None
        authors = None
        doi = None
        keywords = None

        # Extract PDF metadata
        meta = doc.metadata
        title = meta.get("title") or None
        authors = meta.get("author") or None
        if meta.get("subject"):
            keywords = meta.get("subject")

        for page in doc:
            page_text = page.get_text()
            text += page_text + "\n"

            # Try to extract title from first page (largest font text) if not in metadata
            if not title:
                blocks = page.get_text("dict")["blocks"]
                max_font = 0
                for block in blocks:
                    if "lines" in block:
                        for line in block["lines"]:
                            for span in line["spans"]:
                                if span["size"] > max_font and span["text"].strip():
                                    max_font = span["size"]
                                    title = span["text"].strip()

        pages = len(doc)

        # Try to extract DOI from text
        import re
        doi_match = re.search(r'(?:doi|DOI)[: ]*(10\.\d{4,}/[^\s]+)', text[:3000])
        if doi_match:
            doi = doi_match.group(1)

        doc.close()

        return PDFExtractResponse(
            text=text[:10000],
            pages=pages,
            title=title,
            authors=authors,
            doi=doi,
            keywords=keywords,
            year=meta.get("creationDate")[:4] if meta.get("creationDate") and len(meta["creationDate"]) >= 4 else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)
