"""
티스토리 최초 1회 대화형 로그인 도우미 (Interactive Login Helper)
사용자가 더블클릭으로 실행하여 모니터 화면에서 카카오 로그인을 완료하면
세션 쿠키를 tistory_cookies.json에 영구 저장합니다.
"""

import os
import sys
import json
import time

# Windows 콘솔 utf-8 인코딩 지원
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

from playwright.sync_api import sync_playwright
PROFILE_DIR = os.path.join(BASE_DIR, "tistory_browser_profile")
COOKIE_FILE = os.path.join(BASE_DIR, "tistory_cookies.json")
BLOG_NAME = "s-elegant"
WRITE_URL = f"https://{BLOG_NAME}.tistory.com/manage/post"

def cleanup_profile_locks():
    """기존에 tistory_browser_profile을 잡고 있는 프로세스 및 잔여 락 파일 정리"""
    try:
        import psutil
        for p in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if p.info['name'] and 'chrome' in p.info['name'].lower():
                    cmd = " ".join(p.info['cmdline'] or [])
                    if 'tistory_browser_profile' in cmd or '9223' in cmd:
                        p.kill()
            except Exception:
                pass
    except Exception:
        pass

    # 잔여 락 파일 안전 삭제
    for lf in ["SingletonLock", "SingletonCookie", "SingletonSocket"]:
        lock_path = os.path.join(PROFILE_DIR, lf)
        if os.path.exists(lock_path):
            try:
                os.remove(lock_path)
            except Exception:
                pass

def main():
    print("=" * 60)
    print("🔑 AI SEO Manager - 티스토리 카카오 로그인 세션 연동 도우미")
    print("=" * 60)
    print("\n브라우저 창이 열립니다. 카카오 계정으로 로그인을 완료해 주세요...\n")

    os.makedirs(PROFILE_DIR, exist_ok=True)
    cleanup_profile_locks()
    time.sleep(1)

    with sync_playwright() as p:
        # 사용자 대화형 화면에 크롬 창 팝업
        context = p.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            channel="chrome",  # 시스템에 설치된 정식 Google Chrome 사용
            viewport={"width": 1280, "height": 900},
            args=["--start-maximized"]
        )

        page = context.pages[0] if context.pages else context.new_page()
        page.goto(WRITE_URL)

        print("👉 브라우저에서 카카오 로그인을 완료해 주세요 (로그인 시 자동 감지됩니다)...")

        start_time = time.time()
        logged_in = False
        while time.time() - start_time < 300: # 5분 대기
            time.sleep(2)
            for pg in context.pages:
                try:
                    curr_url = pg.url
                except Exception:
                    continue
                # 블로그 관리자 화면에 진입했는지 확인
                if f"{BLOG_NAME}.tistory.com/manage" in curr_url and "login" not in curr_url:
                    logged_in = True
                    try:
                        with open(COOKIE_FILE, "w", encoding="utf-8") as f:
                            json.dump(context.cookies(), f, ensure_ascii=False)
                        print("\n" + "=" * 60)
                        print("🎉 [성공] 카카오 로그인이 확인되어 세션 쿠키가 저장되었습니다!")
                        print(f"📁 저장 위치: {COOKIE_FILE}")
                        print("=" * 60)
                        print("\n이제 웹 대시보드(localhost:3000/analytics)에서")
                        print("[티스토리 에디터에 임시저장하기] 버튼을 누르시면 자동으로 저장됩니다!")
                    except Exception as e:
                        print(f"쿠키 저장 오류: {e}")
                    break
            if logged_in:
                break

        if not logged_in:
            print("\n❌ 5분 동안 로그인이 완료되지 않아 종료합니다.")

        time.sleep(2)
        try:
            context.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
