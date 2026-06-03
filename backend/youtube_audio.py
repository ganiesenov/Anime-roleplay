"""
YouTube audio proxy.

The browser cannot play YouTube directly here: the <iframe> embed fails with
"Error 153 / video player configuration error" on some networks, and the raw
googlevideo stream URL is IP-locked and serves no CORS headers, so the browser
can't fetch it either. So we go through the backend:

  GET /api/yt-audio?url=<youtube watch/share url>

yt-dlp (running on the same machine/IP) resolves a direct audio-only stream URL,
and we proxy the bytes to the browser with HTTP Range support so the <audio>
element can play and seek. The frontend just points an <audio> tag at this route.
"""
import asyncio
import re
import time
from urllib.parse import urlparse, parse_qs

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

# Resolved direct URLs are short-lived (they carry an `expire` epoch in the query).
# Cache per video id so repeated play/seek/loop doesn't re-run yt-dlp every time.
# value: {"url": str, "mime": str, "expire": int}
_cache: dict[str, dict] = {}

_YT_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|v/|shorts/))([A-Za-z0-9_-]{11})"
)


def _video_id(url: str) -> str | None:
    m = _YT_ID_RE.search(url)
    return m.group(1) if m else None


def _resolve_audio(url: str) -> dict:
    """Blocking yt-dlp extraction. Returns {"url", "mime", "expire"}."""
    import yt_dlp

    ydl_opts = {
        # Audio-only YouTube streams (itag 140/251 …) are FRAGMENTED MP4/WebM (DASH)
        # and a plain <audio src> can't decode them progressively. Prefer a
        # PROGRESSIVE container instead: itag 18/22 are classic mp4 (moov-at-front,
        # AAC audio) that <audio> plays directly — we just ignore the video track.
        # Fall back to audio-only only if no progressive format exists.
        "format": "18/22/bestaudio[ext=m4a]/bestaudio",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    direct = info.get("url")
    if not direct:
        # When format resolves to a merged set, the audio is under requested_downloads
        reqs = info.get("requested_downloads") or []
        if reqs:
            direct = reqs[0].get("url")
    if not direct:
        raise RuntimeError("no audio stream found")

    ext = (info.get("ext") or "").lower()
    mime = "audio/mp4" if ext in ("m4a", "mp4") else "audio/webm" if ext == "webm" else "audio/*"

    q = parse_qs(urlparse(direct).query)
    try:
        expire = int(q.get("expire", ["0"])[0])
    except ValueError:
        expire = 0

    return {"url": direct, "mime": mime, "expire": expire}


async def _get_direct(url: str) -> dict:
    vid = _video_id(url)
    now = int(time.time())
    if vid and vid in _cache:
        cached = _cache[vid]
        # keep a 120s safety margin before the URL expires
        if cached["expire"] - now > 120:
            return cached

    resolved = await asyncio.to_thread(_resolve_audio, url)
    if vid:
        _cache[vid] = resolved
    return resolved


@router.get("/api/yt-audio")
async def yt_audio(url: str, request: Request):
    if not _video_id(url):
        raise HTTPException(400, "not a recognizable YouTube URL")

    try:
        info = await _get_direct(url)
    except Exception as e:  # extraction failed (geo/age block, removed, network)
        raise HTTPException(502, f"could not resolve YouTube audio: {e}")

    # Forward the browser's Range request so <audio> can seek; default to a fresh
    # request from the start otherwise.
    upstream_headers = {
        "User-Agent": request.headers.get("user-agent", "Mozilla/5.0"),
    }
    rng = request.headers.get("range")
    if rng:
        upstream_headers["Range"] = rng

    client = httpx.AsyncClient(timeout=None, follow_redirects=True)
    try:
        req = client.build_request("GET", info["url"], headers=upstream_headers)
        upstream = await client.send(req, stream=True)
    except Exception as e:
        await client.aclose()
        raise HTTPException(502, f"upstream fetch failed: {e}")

    # If the cached URL expired (403/410), drop cache so next play re-resolves.
    if upstream.status_code in (403, 410):
        await upstream.aclose()
        await client.aclose()
        _cache.pop(_video_id(url), None)
        raise HTTPException(503, "stream URL expired, retry")

    passthrough = {"Accept-Ranges": "bytes"}
    for h in ("content-length", "content-range", "content-type"):
        if h in upstream.headers:
            passthrough[h] = upstream.headers[h]
    passthrough.setdefault("content-type", info["mime"])

    async def _body():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        _body(), status_code=upstream.status_code, headers=passthrough
    )
