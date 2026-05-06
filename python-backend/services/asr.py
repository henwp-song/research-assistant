import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter(prefix="/api/asr", tags=["asr"])

# Lazy-loaded local model
_model = None
_model_lock = False


class TranscribeResponse(BaseModel):
    text: str


class LocalTranscribeResponse(BaseModel):
    text: str
    model: str
    segments: list[dict] = []


def get_client(request: Request, provider: str = "openai"):
    if provider == "openai":
        api_key = request.headers.get("X-API-Key") or os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set")
        return OpenAI(api_key=api_key)
    return None


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: Request, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    client = get_client(request)

    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
        return TranscribeResponse(text=transcript)  # type: ignore[arg-type]
    finally:
        os.unlink(tmp_path)


@router.post("/transcribe-local", response_model=LocalTranscribeResponse)
async def transcribe_audio_local(file: UploadFile = File(...)):
    global _model

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    from faster_whisper import WhisperModel

    if _model is None:
        model_size = os.getenv("WHISPER_MODEL", "base")
        _model = WhisperModel(model_size, device="cpu", compute_type="int8")

    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        segments, info = _model.transcribe(tmp_path, beam_size=5, language="zh")
        text = ""
        segs = []
        for seg in segments:
            text += seg.text
            segs.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
        return LocalTranscribeResponse(
            text=text.strip(),
            model=f"whisper-{os.getenv('WHISPER_MODEL', 'base')}",
            segments=segs,
        )
    finally:
        os.unlink(tmp_path)
