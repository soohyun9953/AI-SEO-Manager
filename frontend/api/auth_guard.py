"""
사이트 접근 비밀번호 보호

- 비밀번호는 환경변수 APP_PASSWORD 하나로만 관리한다 (Vercel: Settings > Environment Variables)
- 로그인하면 서명된 세션 쿠키(HttpOnly)를 발급하고, /api/* 요청은 이 쿠키가 없으면 401로 막는다
- 세션 서명 키는 APP_PASSWORD 자체이므로, 비밀번호를 바꾸면 기존 로그인이 모두 무효가 된다
- 로컬 개발: APP_PASSWORD가 없으면 보호가 꺼진다
- Vercel 배포: APP_PASSWORD가 없으면 전부 잠긴다 (실수로 공개되는 일을 막기 위해 fail-closed)

frontend/src/utils/authToken.ts 와 토큰 형식이 같다: "<만료 epoch초>.<hex(HMAC-SHA256(비밀번호, 'v1.<만료>'))>"
이 파일은 backend/ 와 frontend/api/ 에 동일하게 둔다.
"""
import asyncio
import hashlib
import hmac
import os
import time
from typing import Dict, List

from fastapi import Request
from fastapi.responses import JSONResponse

COOKIE_NAME = "seo_session"
SESSION_SECONDS = 30 * 24 * 3600
PUBLIC_API_PATHS = {"/api/auth/login", "/api/auth/logout", "/api/auth/status"}

# 무차별 대입 방지: IP별 최근 실패 시각 (서버 인스턴스 단위의 최소한의 방어)
MAX_FAILS = 5
FAIL_WINDOW_SECONDS = 600
_fails: Dict[str, List[float]] = {}


def _password() -> str:
    return os.getenv("APP_PASSWORD", "")


def auth_enabled() -> bool:
    return bool(_password()) or bool(os.getenv("VERCEL"))


def _sign(expiry: int) -> str:
    return hmac.new(_password().encode("utf-8"), f"v1.{expiry}".encode("utf-8"), hashlib.sha256).hexdigest()


def make_token() -> str:
    expiry = int(time.time()) + SESSION_SECONDS
    return f"{expiry}.{_sign(expiry)}"


def verify_token(token: str) -> bool:
    if not token or not _password():
        return False
    try:
        exp_str, sig = token.split(".", 1)
        expiry = int(exp_str)
    except ValueError:
        return False
    if expiry < time.time():
        return False
    return hmac.compare_digest(sig, _sign(expiry))


def _password_matches(candidate: str) -> bool:
    # 길이가 달라도 같은 시간이 걸리도록 해시끼리 비교한다
    a = hashlib.sha256(candidate.encode("utf-8")).digest()
    b = hashlib.sha256(_password().encode("utf-8")).digest()
    return hmac.compare_digest(a, b)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _recent_fails(ip: str) -> List[float]:
    now = time.time()
    recent = [t for t in _fails.get(ip, []) if now - t < FAIL_WINDOW_SECONDS]
    _fails[ip] = recent
    return recent


def install(app) -> None:
    """FastAPI 앱에 로그인 API와 /api/* 보호 미들웨어를 등록한다"""

    @app.middleware("http")
    async def guard(request: Request, call_next):
        path = request.url.path
        if (
            request.method == "OPTIONS"
            or not auth_enabled()
            or not path.startswith("/api/")
            or path in PUBLIC_API_PATHS
            or verify_token(request.cookies.get(COOKIE_NAME, ""))
        ):
            return await call_next(request)
        return JSONResponse({"detail": "로그인이 필요합니다."}, status_code=401)

    @app.get("/api/auth/status")
    async def auth_status(request: Request):
        return {
            "required": auth_enabled(),
            "configured": bool(_password()),
            "authenticated": (not auth_enabled()) or verify_token(request.cookies.get(COOKIE_NAME, "")),
        }

    @app.post("/api/auth/login")
    async def auth_login(request: Request):
        if not auth_enabled():
            return {"success": True}
        if not _password():
            return JSONResponse({"detail": "서버에 APP_PASSWORD 환경변수가 설정되지 않았습니다."}, status_code=503)

        ip = _client_ip(request)
        if len(_recent_fails(ip)) >= MAX_FAILS:
            return JSONResponse({"detail": "시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요."}, status_code=429)

        try:
            body = await request.json()
            candidate = str(body.get("password", ""))
        except Exception:
            candidate = ""

        if not candidate or not _password_matches(candidate):
            _fails.setdefault(ip, []).append(time.time())
            await asyncio.sleep(1)  # 실패 시 지연으로 추측 속도를 늦춘다
            return JSONResponse({"detail": "비밀번호가 맞지 않습니다."}, status_code=401)

        _fails.pop(ip, None)
        response = JSONResponse({"success": True})
        is_https = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
        response.set_cookie(
            COOKIE_NAME, make_token(), max_age=SESSION_SECONDS, httponly=True,
            secure=is_https, samesite="lax", path="/",
        )
        return response

    @app.post("/api/auth/logout")
    async def auth_logout():
        response = JSONResponse({"success": True})
        response.delete_cookie(COOKIE_NAME, path="/")
        return response
