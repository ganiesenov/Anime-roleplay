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
import ipaddress
import socket
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter()

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
            timeout=15.0, follow_redirects=True, max_redirects=4
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
