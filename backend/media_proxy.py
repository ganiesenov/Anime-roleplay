"""
Image proxy — /api/img?url=<external image url>.

Зачем: фронт рендерит аватары/фоны тегом <img src="...">, и если внешний
хост (например files.catbox.moe) заблокирован провайдером пользователя или
лежит, картинка не грузится — пользователь видит placeholder. Прокси тянет
файл СЕРВЕРОМ и отдаёт браузеру со своего домена, обходя браузерные/ISP
блокировки внешнего хоста в части случаев и убирая mixed-content/CORS-нюансы.

Лёгкий SSRF-guard: пропускаем только http/https и блокируем приватные/loopback
адреса, чтобы прокси нельзя было натравить на внутренние сервисы (включая сам
Ollama на localhost).
"""
import asyncio
import base64
import ipaddress
import socket
import uuid
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, Response

router = APIRouter()

# Shikimori (anime DB) needs a descriptive User-Agent and blocks browser CORS, so
# we proxy it server-side. https://shikimori.one/api/doc
_SHIKI_BASE = "https://shikimori.one/api"
_SHIKI_UA = "Aria-Roleplay/1.0 (local roleplay app)"


async def _shiki_get(path: str, params: dict | None = None):
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(
                _SHIKI_BASE + path,
                params=params or {},
                headers={"User-Agent": _SHIKI_UA, "Accept": "application/json"},
            )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Shikimori fetch failed: {e}") from e
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "Shikimori returned an error")
    return resp.json()


@router.get("/api/shikimori/search")
async def shikimori_search(q: str = Query(..., min_length=1)):
    data = await _shiki_get("/characters/search", {"search": q})
    # Trim to the fields the frontend needs.
    def img_url(c):
        rel = (c.get("image") or {}).get("preview") or (c.get("image") or {}).get("original")
        return ("https://shikimori.one" + rel) if rel else ""
    out = [
        {"id": c.get("id"), "name": c.get("name"), "russian": c.get("russian"), "image": img_url(c)}
        for c in (data or [])[:20]
    ]
    return JSONResponse(out)


@router.get("/api/shikimori/character")
async def shikimori_character(id: int = Query(...)):
    c = await _shiki_get(f"/characters/{id}")
    img = c.get("image") or {}
    # Derive tags from the works the character appears in (series names).
    works = (c.get("animes") or []) + (c.get("mangas") or [])
    seen, tags = set(), []
    for w in works:
        nm = (w.get("name") or "").strip()
        key = nm.lower()
        if nm and key not in seen:
            seen.add(key)
            tags.append(nm)
        if len(tags) >= 3:
            break
    return JSONResponse({
        "id": c.get("id"),
        "name": c.get("name"),
        "russian": c.get("russian"),
        "japanese": c.get("japanese"),
        "description": c.get("description_html") or c.get("description") or "",
        "image": ("https://shikimori.one" + img["original"]) if img.get("original") else "",
        "tags": ", ".join(tags),
    })

_NEG_DEFAULT = (
    "lowres, worst quality, low quality, bad anatomy, bad hands, missing fingers, "
    "extra digit, fewer digits, text, error, signature, watermark, username, "
    "jpeg artifacts, blurry, deformed, ugly"
)

# Кэш ответа в браузере — аватары меняются редко.
_CACHE_CONTROL = "public, max-age=86400"
_MAX_BYTES = 12 * 1024 * 1024  # 12 МБ — потолок, чтобы не тянуть гигантские файлы
_ALLOWED_CONTENT_PREFIXES = ("image/",)


def _is_public_host(host: str) -> bool:
    """True, если host резолвится в публичный IP (не loopback/private/link-local)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return False
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
        ):
            return False
    return True


@router.get("/api/img")
async def proxy_image(url: str = Query(..., description="External image URL")):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Only http/https URLs are allowed")
    if not parsed.hostname:
        raise HTTPException(400, "URL has no host")
    if not _is_public_host(parsed.hostname):
        raise HTTPException(400, "Refusing to fetch private/loopback address")

    try:
        async with httpx.AsyncClient(
            # 30s: on-the-fly image generation (e.g. pollinations) can be slow to first byte.
            timeout=30.0, follow_redirects=True, max_redirects=4
        ) as client:
            resp = await client.get(
                url,
                headers={
                    # некоторые хосты (catbox и т.п.) отдают 403 без UA/Referer
                    "User-Agent": "Mozilla/5.0 (compatible; AriaImageProxy/1.0)",
                    "Accept": "image/*,*/*;q=0.8",
                },
            )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Upstream fetch failed: {e}") from e

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "Upstream returned an error")

    content_type = resp.headers.get("content-type", "application/octet-stream")
    # пускаем только картинки — прокси не должен раздавать произвольный контент
    if not content_type.startswith(_ALLOWED_CONTENT_PREFIXES):
        raise HTTPException(415, f"Not an image (content-type: {content_type})")

    data = resp.content
    if len(data) > _MAX_BYTES:
        raise HTTPException(413, "Image too large")

    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": _CACHE_CONTROL},
    )


async def _a1111_txt2img(base, prompt, negative, width, height, steps, seed):
    payload = {
        "prompt": prompt,
        "negative_prompt": negative,
        "steps": steps,
        "width": width,
        "height": height,
        "seed": seed,
        "cfg_scale": 6.5,
        "sampler_name": "DPM++ 2M Karras",
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(f"{base}/sdapi/v1/txt2img", json=payload)
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "Stable Diffusion returned an error")
    images = (resp.json() or {}).get("images") or []
    if not images:
        raise HTTPException(502, "Stable Diffusion returned no image")
    return base64.b64decode(images[0].split(",", 1)[-1])


def _comfy_workflow(model, prompt, negative, width, height, steps, seed):
    """Standard txt2img graph in ComfyUI's /prompt API format."""
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": steps, "cfg": 6.5, "sampler_name": "euler",
            "scheduler": "normal", "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
        }},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "aria", "images": ["8", 0]}},
    }


def _comfy_video_workflow(model, svd, prompt, negative, width, height, steps, seed, frames, motion, fps):
    """One-shot image-to-video: render a still with the SDXL `model`, then animate it
    with Stable Video Diffusion (`svd` checkpoint) → an animated WebP. Node wiring is
    matched to ComfyUI's built-in SVD nodes (ImageOnlyCheckpointLoader +
    SVD_img2vid_Conditioning + VideoLinearCFGGuidance)."""
    return {
        # --- still image (SDXL) ---
        "10": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}},
        "11": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "12": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["10", 1]}},
        "13": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["10", 1]}},
        "14": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": steps, "cfg": 6.5, "sampler_name": "euler", "scheduler": "normal",
            "denoise": 1.0, "model": ["10", 0], "positive": ["12", 0], "negative": ["13", 0], "latent_image": ["11", 0]}},
        "15": {"class_type": "VAEDecode", "inputs": {"samples": ["14", 0], "vae": ["10", 2]}},
        # --- animate it (SVD) ---
        "20": {"class_type": "ImageOnlyCheckpointLoader", "inputs": {"ckpt_name": svd}},
        "21": {"class_type": "SVD_img2vid_Conditioning", "inputs": {
            "clip_vision": ["20", 1], "init_image": ["15", 0], "vae": ["20", 2],
            "width": width, "height": height, "video_frames": frames,
            "motion_bucket_id": motion, "fps": fps, "augmentation_level": 0.0}},
        "22": {"class_type": "VideoLinearCFGGuidance", "inputs": {"model": ["20", 0], "min_cfg": 1.0}},
        "23": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": steps, "cfg": 2.5, "sampler_name": "euler", "scheduler": "karras",
            "denoise": 1.0, "model": ["22", 0], "positive": ["21", 0], "negative": ["21", 1], "latent_image": ["21", 2]}},
        "24": {"class_type": "VAEDecode", "inputs": {"samples": ["23", 0], "vae": ["20", 2]}},
        "25": {"class_type": "SaveAnimatedWEBP", "inputs": {
            "images": ["24", 0], "filename_prefix": "aria_vid", "fps": float(fps), "lossless": False, "quality": 85, "method": "default"}},
    }


async def _comfy_run(base, graph):
    """Queue a ComfyUI graph, poll history, return the first output media bytes."""
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(f"{base}/prompt", json={"prompt": graph, "client_id": uuid.uuid4().hex})
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"ComfyUI rejected the workflow: {r.text[:300]}")
        pid = (r.json() or {}).get("prompt_id")
        if not pid:
            raise HTTPException(502, "ComfyUI did not queue the job")
        outputs = None
        for _ in range(300):
            h = (await client.get(f"{base}/history/{pid}")).json()
            if pid in h and h[pid].get("outputs"):
                outputs = h[pid]["outputs"]
                break
            await asyncio.sleep(2)
        if not outputs:
            raise HTTPException(504, "ComfyUI timed out")
        img = None
        for node in outputs.values():
            if node.get("images"):
                img = node["images"][0]
                break
        if not img:
            raise HTTPException(502, "ComfyUI returned no media")
        view = await client.get(f"{base}/view", params={
            "filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
        if view.status_code != 200:
            raise HTTPException(502, "Could not fetch media from ComfyUI")
        return view.content, view.headers.get("content-type", "image/webp")


async def _comfy_img2vid(base, prompt, negative, width, height, steps, seed, model, svd, frames, motion, fps):
    async with httpx.AsyncClient(timeout=30.0) as client:
        if not model:
            info = (await client.get(f"{base}/object_info/CheckpointLoaderSimple")).json()
            ckpts = info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
            if not ckpts:
                raise HTTPException(502, "ComfyUI has no checkpoints installed")
            model = ckpts[0]
        if not svd:
            info = (await client.get(f"{base}/object_info/ImageOnlyCheckpointLoader")).json()
            names = info["ImageOnlyCheckpointLoader"]["input"]["required"]["ckpt_name"][0]
            svd = next((n for n in names if "svd" in n.lower()), "")
            if not svd:
                raise HTTPException(502, "No Stable Video Diffusion checkpoint found — download svd_xt.safetensors into ComfyUI/models/checkpoints")
    graph = _comfy_video_workflow(model, svd, prompt, negative, width, height, steps, seed, frames, motion, fps)
    data, _ctype = await _comfy_run(base, graph)
    return data


async def _comfy_txt2img(base, prompt, negative, width, height, steps, seed, model):
    async with httpx.AsyncClient(timeout=300.0) as client:
        # Resolve a checkpoint if the caller didn't name one (use the first available).
        if not model:
            info = (await client.get(f"{base}/object_info/CheckpointLoaderSimple")).json()
            ckpts = info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
            if not ckpts:
                raise HTTPException(502, "ComfyUI has no checkpoints installed")
            model = ckpts[0]

        graph = _comfy_workflow(model, prompt, negative, width, height, steps, seed)
        r = await client.post(f"{base}/prompt", json={"prompt": graph, "client_id": uuid.uuid4().hex})
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"ComfyUI rejected the workflow: {r.text[:200]}")
        pid = (r.json() or {}).get("prompt_id")
        if not pid:
            raise HTTPException(502, "ComfyUI did not queue the job")

        # Poll the history until the job produces an output (up to ~5 min).
        outputs = None
        for _ in range(150):
            h = (await client.get(f"{base}/history/{pid}")).json()
            if pid in h and h[pid].get("outputs"):
                outputs = h[pid]["outputs"]
                break
            await asyncio.sleep(2)
        if not outputs:
            raise HTTPException(504, "ComfyUI timed out generating the image")

        img = None
        for node in outputs.values():
            if node.get("images"):
                img = node["images"][0]
                break
        if not img:
            raise HTTPException(502, "ComfyUI returned no image")

        view = await client.get(f"{base}/view", params={
            "filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output"),
        })
        if view.status_code != 200:
            raise HTTPException(502, "Could not fetch the image from ComfyUI")
        return view.content


@router.get("/api/txt2img")
async def txt2img(
    prompt: str = Query(..., description="Positive prompt"),
    backend: str = Query("a1111", description="a1111 | comfy"),
    url: str = Query("", description="SD/ComfyUI base URL (local)"),
    model: str = Query("", description="ComfyUI checkpoint name (optional)"),
    negative: str = Query(_NEG_DEFAULT),
    width: int = Query(512, ge=64, le=1536),
    height: int = Query(512, ge=64, le=1536),
    steps: int = Query(24, ge=1, le=60),
    seed: int = Query(-1),
):
    """Generate an image via the user's OWN local image backend (Automatic1111 or
    ComfyUI). Unlike /api/img this deliberately allows loopback/private hosts. Returns
    PNG bytes directly so the frontend can use it straight in an <img src>."""
    default_url = "http://127.0.0.1:8188" if backend == "comfy" else "http://127.0.0.1:7860"
    base = (url or default_url).rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Only http/https URLs are allowed")
    if seed < 0:
        seed = uuid.uuid4().int % (2 ** 32)

    try:
        if backend == "comfy":
            data = await _comfy_txt2img(base, prompt, negative, width, height, steps, seed, model.strip())
        else:
            data = await _a1111_txt2img(base, prompt, negative, width, height, steps, seed)
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Could not reach the image backend at {base} — is it running? ({e})") from e

    return Response(content=data, media_type="image/png", headers={"Cache-Control": _CACHE_CONTROL})


def _first_url(out) -> str:
    """Pull the first http(s) URL out of a Replicate prediction output (string, list,
    or dict of those)."""
    if isinstance(out, str):
        return out if out.startswith("http") else ""
    if isinstance(out, list):
        for item in out:
            u = _first_url(item)
            if u:
                return u
    if isinstance(out, dict):
        for item in out.values():
            u = _first_url(item)
            if u:
                return u
    return ""


async def _hosted_t2v(prompt: str, token: str, model: str, frames: int, fps: int, seed: int) -> tuple[bytes, str]:
    """Generate a clip via a hosted Replicate-compatible API and return (bytes, mime).

    `model` is either an "owner/name" slug (uses the official-models endpoint) or a
    bare version hash. The user supplies their own API token. We submit, poll until the
    prediction succeeds, then download the resulting video. Replicate hosts both SFW and
    uncensored text-to-video models, so the user picks what they want."""
    if not token:
        raise HTTPException(400, "A hosted-video API token is required (set it in Settings → Photos).")
    model = (model or "").strip()
    if not model:
        raise HTTPException(400, "A hosted-video model is required (e.g. owner/name on Replicate).")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # Keep the input MINIMAL: text-to-video models all accept `prompt`, but the names
    # for length/fps/etc. differ wildly (num_frames / duration / length …) and a strict
    # OpenAPI schema rejects unknown keys with a 422. Omit them and let the model use
    # its own defaults; `frames`/`fps` only drive the local ComfyUI path.
    inp = {"prompt": prompt}
    if "/" in model and not _looks_like_hash(model):
        create_url = f"https://api.replicate.com/v1/models/{model}/predictions"
        body = {"input": inp}
    else:
        create_url = "https://api.replicate.com/v1/predictions"
        body = {"version": model, "input": inp}
    async with httpx.AsyncClient(timeout=600.0) as client:
        # `Prefer: wait` lets Replicate hold the request open until the run finishes.
        resp = await client.post(create_url, json=body, headers={**headers, "Prefer": "wait"})
        if resp.status_code >= 400:
            raise HTTPException(502, f"Hosted video provider error {resp.status_code}: {resp.text[:300]}")
        pred = resp.json()
        status = pred.get("status")
        get_url = (pred.get("urls") or {}).get("get")
        # Fall back to polling if the provider didn't block to completion.
        for _ in range(120):
            if status in ("succeeded", "failed", "canceled"):
                break
            await asyncio.sleep(2.0)
            if not get_url:
                break
            pr = await client.get(get_url, headers=headers)
            pred = pr.json()
            status = pred.get("status")
        if status != "succeeded":
            raise HTTPException(502, f"Hosted video generation {status or 'did not complete'}: {str(pred.get('error'))[:200]}")
        media_url = _first_url(pred.get("output"))
        if not media_url:
            raise HTTPException(502, "Hosted provider returned no video URL.")
        dl = await client.get(media_url)
        if dl.status_code >= 400:
            raise HTTPException(502, f"Could not download the generated video ({dl.status_code}).")
        mime = dl.headers.get("content-type", "video/mp4").split(";")[0].strip() or "video/mp4"
        return dl.content, mime


def _looks_like_hash(s: str) -> bool:
    s = s.strip()
    return len(s) >= 32 and all(c in "0123456789abcdef" for c in s.lower())


@router.get("/api/img2vid")
async def img2vid(
    prompt: str = Query(..., description="Positive prompt for the still frame"),
    provider: str = Query("comfy", description="'comfy' (local SVD) | 'hosted' (Replicate-compatible)"),
    token: str = Query("", description="API token for the hosted provider"),
    hostedModel: str = Query("", description="Hosted video model: owner/name slug or version hash"),
    url: str = Query("", description="ComfyUI base URL (local)"),
    model: str = Query("", description="SDXL checkpoint for the still (optional)"),
    svd: str = Query("", description="SVD checkpoint (optional; auto-detects an 'svd' model)"),
    negative: str = Query(_NEG_DEFAULT),
    width: int = Query(768, ge=256, le=1280),
    height: int = Query(768, ge=256, le=1280),
    steps: int = Query(20, ge=1, le=40),
    frames: int = Query(14, ge=6, le=25),
    motion: int = Query(127, ge=1, le=255),
    fps: int = Query(8, ge=1, le=24),
    seed: int = Query(-1),
):
    """Generate a short clip. Two providers:
    • 'comfy'  — local ComfyUI + Stable Video Diffusion (render a still, then animate it);
      needs an SVD checkpoint. Returns animated WebP (plays in a plain <img>).
    • 'hosted' — a Replicate-compatible text-to-video API with the user's own token/model;
      no local GPU needed. Returns MP4 (rendered in a <video>)."""
    if seed < 0:
        seed = uuid.uuid4().int % (2 ** 32)
    if provider == "hosted":
        data, mime = await _hosted_t2v(prompt, token.strip(), hostedModel.strip(), frames, fps, seed)
        return Response(content=data, media_type=mime, headers={"Cache-Control": _CACHE_CONTROL})
    base = (url or "http://127.0.0.1:8188").rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Only http/https URLs are allowed")
    try:
        data = await _comfy_img2vid(base, prompt, negative, width, height, steps, seed, model.strip(), svd.strip(), frames, motion, fps)
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Could not reach ComfyUI at {base} — is it running? ({e})") from e
    return Response(content=data, media_type="image/webp", headers={"Cache-Control": _CACHE_CONTROL})
