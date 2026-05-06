import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services import asr, llm, pdf_service, literature_service, rag

app = FastAPI(
    title="组会科研助手 Backend",
    description="AI-powered research meeting assistant API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(asr.router)
app.include_router(llm.router)
app.include_router(pdf_service.router)
app.include_router(literature_service.router)
app.include_router(rag.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=9877)
