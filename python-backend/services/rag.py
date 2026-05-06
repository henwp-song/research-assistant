import os
import lancedb
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/rag", tags=["rag"])

_db = None
_model = None

DATA_DIR = os.path.join(os.path.expanduser("~"), ".my-assistant", "lancedb")


class IndexRequest(BaseModel):
    documents: list[dict]


class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    type: str | None = None


class SearchResult(BaseModel):
    id: str
    content: str
    type: str
    source_id: str | None = None
    score: float


def get_db():
    global _db
    if _db is None:
        os.makedirs(DATA_DIR, exist_ok=True)
        _db = lancedb.connect(DATA_DIR)
    return _db


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        _model = SentenceTransformer(model_name)
    return _model


@router.post("/index")
async def index_documents(req: IndexRequest):
    """Index documents into the vector store"""
    if not req.documents:
        return {"indexed": 0}

    model = get_model()
    texts = [d["content"][:4000] for d in req.documents]
    embeddings = model.encode(texts, show_progress_bar=False)

    db = get_db()
    table_name = "documents"

    data = []
    for i, doc in enumerate(req.documents):
        data.append({
            "id": doc["id"],
            "content": doc["content"][:4000],
            "type": doc.get("type", "note"),
            "source_id": doc.get("source_id", ""),
            "vector": embeddings[i].tolist(),
        })

    if table_name in db.table_names():
        tbl = db.open_table(table_name)
        tbl.add(data)
    else:
        db.create_table(table_name, data)

    return {"indexed": len(data)}


@router.post("/search", response_model=list[SearchResult])
async def search_documents(req: SearchRequest):
    """Search documents by semantic similarity"""
    model = get_model()
    db = get_db()
    table_name = "documents"

    if table_name not in db.table_names():
        return []

    query_embedding = model.encode([req.query])[0]

    tbl = db.open_table(table_name)
    results = tbl.search(query_embedding.tolist()).limit(req.limit).to_list()

    return [
        SearchResult(
            id=r["id"],
            content=r["content"],
            type=r["type"],
            source_id=r.get("source_id"),
            score=1.0 - r.get("_distance", 0),
        )
        for r in results
        if r.get("_distance", 1) < 0.7
    ]


@router.post("/clear")
async def clear_index():
    """Clear all indexed documents"""
    db = get_db()
    if "documents" in db.table_names():
        db.drop_table("documents")
    return {"status": "cleared"}


@router.get("/stats")
async def get_stats():
    """Get index statistics"""
    db = get_db()
    if "documents" in db.table_names():
        tbl = db.open_table("documents")
        return {"count": tbl.count_rows()}
    return {"count": 0}
