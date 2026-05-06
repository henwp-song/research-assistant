import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from openai import OpenAI
from ollama import Client as OllamaClient

router = APIRouter(prefix="/api/llm", tags=["llm"])


class SummarizeRequest(BaseModel):
    text: str
    type: str = "meeting"  # "meeting" | "literature"
    provider: str = "openai"  # "openai" | "ollama"


class SummarizeResponse(BaseModel):
    summary: str
    key_points: list[str]
    provider: str = "openai"


MEETING_PROMPT = """
你是一个专业的科研组会记录助手。请根据以下会议转写内容，生成：

1. 会议摘要（2-3句话概括核心内容）
2. 关键要点列表（每点一行，用短语表达）

注意：
- 用中文输出
- 摘要简洁有力
- 关键要点按重要性排序
- 忽略录音中的语气词和重复内容

会议转写内容：
{text}
"""

LITERATURE_PROMPT = """
你是一个专业的文献阅读助手。请根据以下论文内容，生成结构化总结：

1. 论文摘要（2-3句话概括）
2. 关键要点（包括：研究问题、方法、主要发现、创新点）

注意：
- 用中文输出
- 如果原文是英文，翻译为中文
- 保持学术严谨性

论文内容：
{text}
"""


def summarize_with_openai(text: str, summary_type: str):
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set")
    client = OpenAI(api_key=api_key)

    if summary_type == "literature":
        system_prompt = "你是一个专业的科研文献总结助手。"
        user_prompt = LITERATURE_PROMPT.format(text=text)
    else:
        system_prompt = "你是一个专业的科研组会记录助手。"
        user_prompt = MEETING_PROMPT.format(text=text)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


def summarize_with_ollama(text: str, summary_type: str):
    ollama_host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    client = OllamaClient(host=ollama_host)

    if summary_type == "literature":
        system_prompt = "你是一个专业的科研文献总结助手。"
        user_prompt = LITERATURE_PROMPT.format(text=text)
    else:
        system_prompt = "你是一个专业的科研组会记录助手。"
        user_prompt = MEETING_PROMPT.format(text=text)

    response = client.chat(
        model=ollama_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response["message"]["content"]


def parse_summary(content: str) -> tuple[str, list[str]]:
    lines = content.strip().split("\n")
    summary = lines[0] if lines else content
    key_points = [
        p.lstrip("-•0123456789. ") for p in lines[1:] if p.strip()
    ]
    if not key_points:
        key_points = [summary]
    return summary, key_points


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: Request, req: SummarizeRequest):
    try:
        if req.provider == "ollama":
            content = summarize_with_ollama(req.text, req.type)
            summary, key_points = parse_summary(content)
            return SummarizeResponse(summary=summary, key_points=key_points, provider="ollama")
        else:
            content = summarize_with_openai(req.text, req.type)
            summary, key_points = parse_summary(content)
            return SummarizeResponse(summary=summary, key_points=key_points, provider="openai")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ollama/status")
async def ollama_status():
    try:
        ollama_host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
        client = OllamaClient(host=ollama_host)
        models = client.list()
        return {
            "available": True,
            "models": [m["model"] for m in models.get("models", [])],
        }
    except Exception:
        return {"available": False, "models": []}
