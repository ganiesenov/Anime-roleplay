"""Local neural text-to-speech via Kokoro (kokoro-onnx) — natural, fully offline,
no GPU needed. Each character can be given its own Kokoro voice, so replies are
spoken in distinct voices instead of the robotic browser SpeechSynthesis voices.

Model files (download once, ~340MB total, git-ignored under backend/models/kokoro):
  kokoro-v1.0.onnx  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  voices-v1.0.bin   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
Override the directory with KOKORO_MODEL_DIR.
"""
import io
import os
import wave
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter()

_MODEL_DIR = Path(os.environ.get("KOKORO_MODEL_DIR", str(Path(__file__).parent / "models" / "kokoro")))
_CACHE = {"engine": None, "voices": None, "error": None}


def _load():
    """Lazy-load the Kokoro engine once. Returns (engine, error_message)."""
    if _CACHE["engine"] is not None:
        return _CACHE["engine"], None
    if _CACHE["error"] is not None:
        return None, _CACHE["error"]
    onnx = _MODEL_DIR / "kokoro-v1.0.onnx"
    voices = _MODEL_DIR / "voices-v1.0.bin"
    if not onnx.exists() or not voices.exists():
        _CACHE["error"] = (
            f"Kokoro model files missing in {_MODEL_DIR}. Download kokoro-v1.0.onnx and "
            "voices-v1.0.bin from the kokoro-onnx v1.0 release into that folder."
        )
        return None, _CACHE["error"]
    try:
        from kokoro_onnx import Kokoro
        eng = Kokoro(str(onnx), str(voices))
        _CACHE["engine"] = eng
        try:
            _CACHE["voices"] = sorted(eng.get_voices())
        except Exception:
            _CACHE["voices"] = []
        return eng, None
    except Exception as e:  # import error / corrupt model
        _CACHE["error"] = f"Could not initialise Kokoro: {e}"
        return None, _CACHE["error"]


def _wav_bytes(samples, sample_rate):
    """Encode float32 [-1,1] samples to 16-bit PCM WAV bytes (no numpy/soundfile dep at call time)."""
    import numpy as np
    pcm = np.clip(np.asarray(samples, dtype="float32"), -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(sample_rate))
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


@router.get("/api/tts/voices")
async def tts_voices():
    """List available Kokoro voice ids (for the character voice picker)."""
    eng, err = _load()
    if err:
        return {"available": False, "voices": [], "error": err}
    return {"available": True, "voices": _CACHE["voices"] or []}


@router.get("/api/tts")
async def tts(
    text: str = Query(..., min_length=1, max_length=2000),
    voice: str = Query("af_heart"),
    speed: float = Query(1.0, ge=0.5, le=2.0),
    lang: str = Query("en-us"),
):
    """Synthesize speech locally with Kokoro and return WAV audio."""
    eng, err = _load()
    if err:
        raise HTTPException(503, err)
    v = voice if (voice and voice in (_CACHE["voices"] or [])) else "af_heart"
    try:
        samples, sr = eng.create(text, voice=v, speed=float(speed), lang=lang)
    except Exception as e:
        raise HTTPException(500, f"TTS synthesis failed: {e}") from e
    data = _wav_bytes(samples, sr)
    return Response(content=data, media_type="audio/wav", headers={"Cache-Control": "no-store"})
