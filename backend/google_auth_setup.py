"""
Google OAuth 리프레시 토큰 1회 발급 스크립트 (Search Console + AdSense 읽기 전용)

사전 준비 (Google Cloud Console):
  1. 프로젝트 생성 후 'Google Search Console API', 'AdSense Management API' 사용 설정
  2. OAuth 동의 화면 구성 (테스트 사용자에 본인 구글 계정 추가)
  3. 사용자 인증 정보 > OAuth 클라이언트 ID > 유형 '데스크톱 앱' 생성

실행:
  python google_auth_setup.py <CLIENT_ID> <CLIENT_SECRET>

브라우저에서 승인하면 터미널에 GOOGLE_REFRESH_TOKEN 이 출력됩니다.
출력값은 backend/.env (및 Vercel 환경변수)에만 저장하고 절대 커밋하지 마세요.
"""
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlencode, urlparse, parse_qs

import requests

SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/adsense.readonly",
]
PORT = 8765
REDIRECT_URI = f"http://localhost:{PORT}/"


class _Handler(BaseHTTPRequestHandler):
    code = None

    def do_GET(self):
        _Handler.code = parse_qs(urlparse(self.path).query).get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write("인증이 완료되었습니다. 이 창을 닫고 터미널로 돌아가세요.".encode("utf-8"))

    def log_message(self, *args):
        pass


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    client_id, client_secret = sys.argv[1], sys.argv[2]

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    })
    print("브라우저에서 구글 계정 승인을 진행하세요...")
    webbrowser.open(auth_url)

    server = HTTPServer(("localhost", PORT), _Handler)
    server.handle_request()
    if not _Handler.code:
        print("인증 코드를 받지 못했습니다.")
        sys.exit(1)

    res = requests.post("https://oauth2.googleapis.com/token", data={
        "code": _Handler.code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }, timeout=20)
    body = res.json()
    if "refresh_token" not in body:
        print("리프레시 토큰 발급 실패:", body)
        sys.exit(1)

    print("\n아래 값을 backend/.env 에 추가하세요:\n")
    print(f"GOOGLE_CLIENT_ID={client_id}")
    print(f"GOOGLE_CLIENT_SECRET={client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={body['refresh_token']}")
    print("GSC_SITE_URL=https://s-elegant.tistory.com/   # Search Console에 등록한 속성 그대로")
    print("ADSENSE_ACCOUNT_ID=pub-XXXXXXXXXXXXXXXX      # 애드센스 > 계정 > 계정 정보의 게시자 ID")


if __name__ == "__main__":
    main()
