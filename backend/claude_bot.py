"""
Claude.ai 웹 브라우저 자동화 봇 (Claude Web Automation Bot - CDP Edition)
- 엔진: 정식 Google Chrome + Playwright CDP (Chrome DevTools Protocol)
- 핵심 장점:
  1. Cloudflare 봇 감지 (Just a moment...) 100% 우회 통과
  2. Google OAuth 보안 로그인 정상 작동 (보안되지 않은 브라우저 차단 회피)
  3. 로그인 세션 영구 보존 (./claude_browser_profile)
  4. 크롬 인스턴스 락(ProcessSingleton Lock) 충돌 원천 차단
  5. E-E-A-T 기반 블로그 원고 작성 및 마크다운/HTML 변환
"""

import os
import sys
import time
import json
import re
import subprocess
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page
import review_seo

# Windows 콘솔 cp949 인코딩 문제 방지
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def log(msg: str):
    """안전한 로그 출력 (인코딩 에러 방지)"""
    try:
        print(msg)
    except Exception:
        try:
            clean = msg.encode('cp949', errors='replace').decode('cp949')
            print(clean)
        except Exception:
            pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLAUDE_PROFILE_DIR = os.path.join(BASE_DIR, "claude_browser_profile")
CLAUDE_NEW_URL = "https://claude.ai/new"
CHROME_DEBUG_PORT = 9222
CHROME_CDP_URL = f"http://127.0.0.1:{CHROME_DEBUG_PORT}"

def find_chrome_exe() -> str:
    """시스템에 설치된 정식 Google Chrome 경로 탐색"""
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return "chrome.exe"

def ensure_debug_chrome() -> Optional[subprocess.Popen]:
    """디버깅 크롬 브라우저가 실행 중인지 확인하고, 없으면 정식 크롬으로 실행"""
    try:
        res = requests.get(f"{CHROME_CDP_URL}/json/version", timeout=1.5)
        if res.status_code == 200:
            log("[OK] [Claude Bot] 기존에 열려있는 디버깅 크롬에 연결합니다.")
            return None
    except Exception:
        pass

    chrome_path = find_chrome_exe()
    os.makedirs(CLAUDE_PROFILE_DIR, exist_ok=True)
    
    cmd = [
        chrome_path,
        f"--remote-debugging-port={CHROME_DEBUG_PORT}",
        f"--user-data-dir={CLAUDE_PROFILE_DIR}",
        "--start-maximized",
        "--no-first-run",
        "--no-default-browser-check",
        CLAUDE_NEW_URL
    ]
    log(f"[START] [Claude Bot] 정식 Google Chrome을 실행합니다... ({chrome_path})")
    proc = subprocess.Popen(cmd)
    
    # 포트 9222 응답 대기
    for _ in range(25):
        time.sleep(0.5)
        try:
            res = requests.get(f"{CHROME_CDP_URL}/json/version", timeout=1)
            if res.status_code == 200:
                log("[OK] [Claude Bot] 크롬 디버깅 포트(9222) 연결 준비 완료!")
                return proc
        except Exception:
            pass
            
    return proc

def force_foreground_window():
    """Windows에서 크롬 브라우저 창을 강제로 화면 맨 앞으로 활성화"""
    if sys.platform == "win32":
        try:
            import ctypes
            EnumWindows = ctypes.windll.user32.EnumWindows
            EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
            GetWindowText = ctypes.windll.user32.GetWindowTextW
            GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
            SetForegroundWindow = ctypes.windll.user32.SetForegroundWindow
            ShowWindow = ctypes.windll.user32.ShowWindow

            def foreach_window(hwnd, lParam):
                length = GetWindowTextLength(hwnd)
                buff = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buff, length + 1)
                title = buff.value
                if "Claude" in title or "Sign in" in title:
                    ShowWindow(hwnd, 9)  # SW_RESTORE
                    SetForegroundWindow(hwnd)
                    return False
                return True

            EnumWindows(EnumWindowsProc(foreach_window), 0)
        except Exception:
            pass

class ClaudeWebAutomator:
    def __init__(self, headless: bool = False, timeout_login: int = 300):
        self.headless = headless
        self.profile_dir = CLAUDE_PROFILE_DIR
        self.timeout_login = timeout_login
        os.makedirs(self.profile_dir, exist_ok=True)

    def _ensure_ready_for_chat(self, page: Page) -> str:
        """
        Claude.ai에 로그인되어 있고 새 채팅 입력창이 준비될 때까지 대기 후 셀렉터 반환
        """
        log("[CHECK] [Claude Bot] Claude.ai 로그인 및 채팅 에디터 준비 상태 확인 중...")
        start_time = time.time()
        
        while time.time() - start_time < self.timeout_login:
            curr_url = page.url
            
            # 1. 로그인 페이지인 경우 사용자가 브라우저 창에서 직접 로그인할 때까지 대기
            if "login" in curr_url or "signup" in curr_url or "accounts.google.com" in curr_url:
                log("[LOGIN_WAIT] 크롬 브라우저 창에서 Claude.ai 로그인을 진행해주세요... (로그인 대기 중)")
                force_foreground_window()
                try:
                    page.bring_to_front()
                except Exception:
                    pass
                # 쿠키 팝업 자동 수락
                try:
                    cookie_btn = page.locator("button:has-text('모든 쿠키 허용'), button:has-text('Accept all cookies'), button:has-text('모두 허용')").first
                    if cookie_btn.is_visible(timeout=500):
                        cookie_btn.click()
                except Exception:
                    pass
                time.sleep(3)
                continue
                
            # 2. 팝업, 안내 모달(Got it, Continue, Dismiss 등) 자동 닫기 시도
            try:
                dismiss_buttons = page.locator("button:has-text('Got it'), button:has-text('확인'), button:has-text('Dismiss'), button:has-text('Continue'), button:has-text('Accept'), button[aria-label='Close']").all()
                for d_btn in dismiss_buttons:
                    if d_btn.is_visible(timeout=500):
                        d_btn.click()
                        time.sleep(0.5)
            except Exception:
                pass
                
            # 3. /new 또는 /chat 페이지가 아닌 메인일 경우 /new로 이동 시도
            if "/new" not in page.url and "/chat/" not in page.url and "claude.ai" in page.url:
                try:
                    page.goto(CLAUDE_NEW_URL, wait_until="domcontentloaded", timeout=20000)
                    time.sleep(2)
                except Exception:
                    pass

            # 4. 입력창 셀렉터 탐색
            for sel in [
                "div[contenteditable='true'].ProseMirror",
                "div[contenteditable='true']",
                "div.ProseMirror",
                "textarea[placeholder*='Reply']",
                "textarea[placeholder*='How can Claude help']",
                "textarea[placeholder*='메시지']",
                "textarea"
            ]:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=1000):
                        log(f"[OK] [Claude Bot] Claude 메시지 입력창 준비 완료! ({sel})")
                        return sel
                except Exception:
                    continue

            time.sleep(2)

        raise Exception("Claude.ai 로그인 대기 시간(3분)이 초과되었거나 입력창을 찾지 못했습니다. 열린 브라우저 창에서 로그인을 완료해주세요.")

    def generate_review_article(
        self,
        place_name: str,
        category: str,
        location: str,
        place_url: str = "",
        key_info: str = "",
        special_notes: str = "",
        rating: str = "5.0",
        photo_paths: Optional[List[str]] = None,
        photo_captions: Optional[List[str]] = None,
        photos_data: Optional[List[Dict[str, str]]] = None,
        platform: str = "tistory"
    ) -> Dict[str, Any]:
        """
        Claude.ai 웹에 접속하여 사진 첨부 및 프롬프트를 전송하고 생성된 원고를 추출 (독립 스레드 보장)
        """
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                self._run_generate_review,
                place_name,
                category,
                location,
                place_url,
                key_info,
                special_notes,
                rating,
                photo_paths,
                photo_captions,
                photos_data,
                platform
            )
            return future.result()

    def _run_generate_review(
        self,
        place_name: str,
        category: str,
        location: str,
        place_url: str = "",
        key_info: str = "",
        special_notes: str = "",
        rating: str = "5.0",
        photo_paths: Optional[List[str]] = None,
        photo_captions: Optional[List[str]] = None,
        photos_data: Optional[List[Dict[str, str]]] = None,
        platform: str = "tistory"
    ) -> Dict[str, Any]:
        start_time = datetime.now().isoformat()
        result = {
            "success": False,
            "title": "",
            "article": "",
            "html_article": "",
            "tags": [],
            "tags_string": "",
            "meta_description": "",
            "error": None,
            "start_time": start_time,
            "end_time": None
        }

        prompt = self._build_prompt(
            place_name=place_name,
            category=category,
            location=location,
            place_url=place_url,
            key_info=key_info,
            special_notes=special_notes,
            rating=rating,
            photo_count=len(photo_paths) if photo_paths else 0,
            photo_captions=photo_captions,
            platform=platform
        )

        # 1. 정식 Google Chrome 실행 및 CDP 포트 확보
        ensure_debug_chrome()

        with sync_playwright() as p:
            log(f"[CONNECT] [Claude Bot] Chrome DevTools Protocol로 연결합니다 ({CHROME_CDP_URL})...")
            browser = p.chromium.connect_over_cdp(CHROME_CDP_URL)
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            page = context.pages[0] if context.pages else context.new_page()
            page.on("dialog", lambda dialog: dialog.accept())

            try:
                log(f"[NAVIGATE] [Claude Bot] Claude 새 대화 페이지로 이동: {CLAUDE_NEW_URL}")
                try:
                    page.goto(CLAUDE_NEW_URL, wait_until="domcontentloaded", timeout=60000)
                except Exception as nav_e:
                    log(f"[WARN] 페이지 이동 중 경미한 알림: {nav_e}")

                try:
                    page.bring_to_front()
                except Exception:
                    pass
                time.sleep(2)

                # 1. 로그인 확인 및 입력창 준비 대기
                input_selector = self._ensure_ready_for_chat(page)

                # 2. 사진 파일 첨부 (입력창이 준비된 후 첨부)
                if photo_paths and len(photo_paths) > 0:
                    valid_files = [f for f in photo_paths if os.path.exists(f)]
                    if valid_files:
                        log(f"[PHOTO] [Claude Bot] 이미지 파일 {len(valid_files)}장 첨부 중...")
                        try:
                            file_input = page.locator("input[type='file']").first
                            file_input.set_input_files(valid_files, timeout=15000)
                            log("[OK] [Claude Bot] 이미지 파일 첨부 완료, 업로드 대기 중...")
                            time.sleep(3 + len(valid_files) * 2)
                        except Exception as file_e:
                            log(f"[WARN] [Claude Bot] 파일 첨부 중 에러 (계속 진행): {file_e}")

                # 3. 텍스트 입력창 조작
                input_element = page.locator(input_selector).first
                input_element.click()
                time.sleep(0.5)

                log("[EDIT] [Claude Bot] 프롬프트 텍스트 주입 중...")
                page.evaluate("""
                    ([selector, text]) => {
                        const el = document.querySelector(selector);
                        if (!el) return;
                        if (el.tagName.toLowerCase() === 'textarea') {
                            el.value = text;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            el.focus();
                            document.execCommand('selectAll', false, null);
                            document.execCommand('insertText', false, text);
                        }
                    }
                """, [input_selector, prompt])
                time.sleep(1.5)

                inserted_text = input_element.inner_text()
                if not inserted_text or len(inserted_text.strip()) < 10:
                    log("[WARN] 텍스트 직접 입력 보완 실행...")
                    input_element.click()
                    page.keyboard.insert_text(prompt)
                    time.sleep(1)

                # 4. 전송 버튼 클릭
                log("[SEND] [Claude Bot] 전송 버튼 클릭...")
                send_clicked = False
                send_selectors = [
                    "button[aria-label*='Send']",
                    "button[aria-label*='전송']",
                    "button:has-text('Send')",
                    "fieldset button[type='submit']",
                    "button:has(svg)"
                ]
                
                for s_sel in send_selectors:
                    btn = page.locator(s_sel).last
                    try:
                        if btn.is_visible(timeout=1500) and btn.is_enabled():
                            btn.click()
                            send_clicked = True
                            log(f"[OK] 전송 버튼 클릭 완료 ({s_sel})")
                            break
                    except Exception:
                        continue

                if not send_clicked:
                    log("[WARN] 전송 버튼 클릭 실패, Enter 키 전송 시도...")
                    input_element.press("Enter")

                # 5. 답변 생성 대기
                log("[WAIT] [Claude Bot] 답변 생성 중... 생성이 완료될 때까지 대기합니다...")
                time.sleep(5)

                max_wait_seconds = 180
                poll_interval = 2
                elapsed = 0
                last_content_len = 0
                unchanged_count = 0

                while elapsed < max_wait_seconds:
                    time.sleep(poll_interval)
                    elapsed += poll_interval

                    stop_btn = page.locator("button[aria-label*='Stop'], button:has-text('Stop')").first
                    is_streaming = False
                    try:
                        is_streaming = stop_btn.is_visible(timeout=1000)
                    except Exception:
                        is_streaming = False

                    msg_text = self._get_latest_assistant_message(page)
                    curr_len = len(msg_text.strip())

                    if curr_len > 100:
                        if curr_len == last_content_len:
                            unchanged_count += 1
                        else:
                            unchanged_count = 0
                            last_content_len = curr_len

                    if not is_streaming and curr_len > 200 and unchanged_count >= 2:
                        log("[DONE] [Claude Bot] 답변 생성 완료 감지!")
                        break

                    if elapsed % 10 == 0:
                        log(f"   생성 진행 중... ({elapsed}초 경과, 현재 글자 수: {curr_len}자)")

                # 6. 최종 텍스트 추출 및 파싱
                # 코드블록(원본 마크다운)이 있으면 우선 사용: 렌더링된 텍스트는 ##, 표 등의 서식이 사라짐
                full_raw_text = self._get_latest_markdown_block(page)
                if full_raw_text:
                    log("[OK] [Claude Bot] 코드블록에서 원본 마크다운을 추출했습니다.")
                else:
                    full_raw_text = self._get_latest_assistant_message(page)
                if not full_raw_text or len(full_raw_text.strip()) < 100:
                    raise Exception("Claude로부터 생성된 원고 텍스트를 추출하지 못했습니다.")

                parsed = self._parse_claude_response(full_raw_text, place_name, category, photos=photos_data, platform=platform)
                result.update(parsed)
                result["success"] = True
                result["end_time"] = datetime.now().isoformat()
                log("[OK] [Claude Bot] 원고 추출 및 구조화 성공!")

            except Exception as e:
                log(f"[ERROR] [Claude Bot] 에러 발생: {e}")
                result["error"] = str(e)
            finally:
                try:
                    # CDP 연결 해제 (브라우저 창은 유지하여 사용자가 볼 수 있도록 함)
                    pass
                except Exception:
                    pass

        return result

    # ------------------------------------------------------------------ IT 글 SEO 수정 (다이어그램 포함)
    def generate_it_post(self, original_text: str, keyword: str = "", category: str = "IT", topic_type: str = "it") -> Dict[str, Any]:
        """원문을 SEO에 맞게 다듬고 설명용 다이어그램(SVG)까지 클로드가 작성한 원본 답변을 돌려준다 (독립 스레드)"""
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(self._run_it_post, original_text, keyword, category, topic_type).result()

    def _run_it_post(self, original_text: str, keyword: str, category: str, topic_type: str = "it") -> Dict[str, Any]:
        result: Dict[str, Any] = {"success": False, "raw": "", "error": None}
        prompt = self._build_it_prompt(original_text, keyword, category, topic_type)

        ensure_debug_chrome()
        with sync_playwright() as p:
            log(f"[CONNECT] [Claude Bot] Chrome DevTools Protocol로 연결합니다 ({CHROME_CDP_URL})...")
            browser = p.chromium.connect_over_cdp(CHROME_CDP_URL)
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            # 이미 열린 claude.ai 탭이 있으면 재사용하고, 없으면 새 탭을 연다 (다른 사이트 탭을 건드리지 않기 위함)
            page = next((pg for pg in context.pages if "claude.ai" in pg.url), None) or context.new_page()
            page.on("dialog", lambda dialog: dialog.accept())

            try:
                try:
                    page.goto(CLAUDE_NEW_URL, wait_until="domcontentloaded", timeout=60000)
                except Exception as nav_e:
                    log(f"[WARN] 페이지 이동 중 경미한 알림: {nav_e}")
                try:
                    page.bring_to_front()
                except Exception:
                    pass
                time.sleep(2)

                input_selector = self._ensure_ready_for_chat(page)
                self._inject_and_send(page, input_selector, prompt)
                raw = self._wait_for_answer(page, max_wait_seconds=420)
                if not raw or len(raw.strip()) < 200:
                    raise Exception("Claude로부터 답변 텍스트를 추출하지 못했습니다.")
                result["raw"] = raw
                result["success"] = True
                log("[OK] [Claude Bot] IT 글 답변 추출 완료")
            except Exception as e:
                log(f"[ERROR] [Claude Bot] 에러 발생: {e}")
                result["error"] = str(e)
        return result

    def _inject_and_send(self, page: Page, input_selector: str, prompt: str) -> None:
        """입력창에 프롬프트를 넣고 전송한다"""
        input_element = page.locator(input_selector).first
        input_element.click()
        time.sleep(0.5)
        log("[EDIT] [Claude Bot] 프롬프트 텍스트 주입 중...")
        page.evaluate("""
            ([selector, text]) => {
                const el = document.querySelector(selector);
                if (!el) return;
                if (el.tagName.toLowerCase() === 'textarea') {
                    el.value = text;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    el.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, text);
                }
            }
        """, [input_selector, prompt])
        time.sleep(1.5)
        inserted_text = input_element.inner_text()
        if not inserted_text or len(inserted_text.strip()) < 10:
            log("[WARN] 텍스트 직접 입력 보완 실행...")
            input_element.click()
            page.keyboard.insert_text(prompt)
            time.sleep(1)

        log("[SEND] [Claude Bot] 전송 버튼 클릭...")
        send_clicked = False
        for s_sel in ["button[aria-label*='Send']", "button[aria-label*='전송']", "button:has-text('Send')",
                      "fieldset button[type='submit']", "button:has(svg)"]:
            btn = page.locator(s_sel).last
            try:
                if btn.is_visible(timeout=1500) and btn.is_enabled():
                    btn.click()
                    send_clicked = True
                    log(f"[OK] 전송 버튼 클릭 완료 ({s_sel})")
                    break
            except Exception:
                continue
        if not send_clicked:
            log("[WARN] 전송 버튼 클릭 실패, Enter 키 전송 시도...")
            input_element.press("Enter")

    def _wait_for_answer(self, page: Page, max_wait_seconds: int = 300) -> str:
        """답변 생성이 끝날 때까지 기다린 뒤 원본 텍스트(코드블록 우선)를 추출한다"""
        log("[WAIT] [Claude Bot] 답변 생성 중... 생성이 완료될 때까지 대기합니다...")
        time.sleep(5)
        elapsed, last_len, unchanged = 0, 0, 0
        while elapsed < max_wait_seconds:
            time.sleep(2)
            elapsed += 2
            is_streaming = False
            try:
                is_streaming = page.locator("button[aria-label*='Stop'], button:has-text('Stop')").first.is_visible(timeout=1000)
            except Exception:
                pass
            curr_len = len(self._get_latest_assistant_message(page).strip())
            if curr_len > 100:
                if curr_len == last_len:
                    unchanged += 1
                else:
                    unchanged, last_len = 0, curr_len
            if not is_streaming and curr_len > 200 and unchanged >= 3:
                log("[DONE] [Claude Bot] 답변 생성 완료 감지!")
                break
            if elapsed % 10 == 0:
                log(f"   생성 진행 중... ({elapsed}초 경과, 현재 글자 수: {curr_len}자)")
        raw = self._get_latest_markdown_block(page)
        if raw:
            log("[OK] [Claude Bot] 코드블록에서 원본을 추출했습니다.")
            return raw
        return self._get_latest_assistant_message(page)

    def _build_it_prompt(self, original_text: str, keyword: str, category: str, topic_type: str = "it") -> str:
        """IT·재테크 글을 SEO에 맞게 다듬고 설명용 다이어그램(SVG)을 함께 쓰게 하는 프롬프트"""
        if topic_type == "finance":
            persona = "재테크·금융 정보 블로그 에디터"
            fact_rule = (
                "원문의 금리, 수익률, 세율, 한도, 수수료, 날짜, 상품명, 계산 결과와 예시 수치는 그대로 유지하세요. "
                "원문에 없는 수치·전망·추천 상품·세법/제도 내용을 절대 추가하지 마세요. 확신이 없는 내용은 만들지 말고 "
                "\"기준일과 조건은 공식 안내(금융회사·금융감독원·국세청 등)에서 확인하세요\"처럼 안내하세요."
            )
            extra_rules = (
                "4. 금융 글 주의: 특정 상품의 매수·매도·가입을 권유하는 문구를 새로 만들지 마세요. "
                "\"무조건\", \"확정 수익\", \"반드시 오른다\", \"손실 없음\" 같은 단정·보장 표현은 원문 의미를 바꾸지 않는 범위에서 "
                "\"~일 수 있습니다\", \"예시\" 등으로 완화하세요. 수치에는 가능하면 기준 시점(원문에 있는 경우)을 함께 쓰세요.\n"
            )
            diagram_kinds = "비교도, 계산 흐름도, 절차도, 상품·조건 비교 등"
        else:
            persona = "IT 전문 블로그 에디터"
            fact_rule = (
                "원문의 기술 내용, 수치, 버전, 날짜, 주장, 코드, 명령어는 그대로 유지하세요. "
                "원문에 없는 기술 사실·수치·출시일·성능 비교·고유명사를 절대 추가하지 마세요. 확신이 없는 내용은 만들지 말고 "
                "\"공식 문서에서 확인하세요\"처럼 안내하세요."
            )
            extra_rules = ""
            diagram_kinds = "구조도, 처리 흐름도, 비교도, 단계도 등"

        return f"""
당신은 {persona}이자 검색엔진 최적화(SEO) 전문가입니다.
아래 [원문]을 티스토리 블로그에 올릴 수 있도록 SEO에 맞게 다듬고, 이해를 돕는 설명용 다이어그램을 직접 그려 주세요.

[원문 정보]
- 카테고리: {category or 'IT'}
- 핵심 키워드(선택): {keyword.strip() if keyword and keyword.strip() else '없음 (원문에서 가장 중요한 검색어 1~2개를 직접 고를 것)'}

[핵심 원칙 - 가장 중요]
1. 사실 유지: {fact_rule}
2. 고치는 범위: 제목, 메타설명, 도입부, 핵심 3줄 요약, 소제목 구조, 문단 가독성, 키워드 배치, 마무리 정리, FAQ만 개선하세요. 원문의 설명을 바꾸거나 줄이지 말고, 순서가 어색하면 재배치만 하세요.
3. 코드 블록, 표, 목록은 원문 그대로 보존하세요(마크다운 코드 펜스 유지).
{extra_rules}
[SEO 지침]
- 제목: 공백 포함 35자 이내, 핵심 키워드를 앞쪽에 배치, 클릭을 부르되 과장·낚시 표현 금지.
- 메타설명: 80~120자, 핵심 키워드 포함.
- 본문 구조: 맨 처음은 박스·라벨 없는 140~160자 평문 리드 문단 1개(핵심 결론 포함, 인사말 금지) → 그 바로 아래 "> **핵심 요약**" 인용문 하나로 핵심 3줄 요약(요약 박스는 이 1개뿐, "먼저 보고 가세요"를 따로 만들지 말 것) → "## 소제목" 4~7개(필요하면 "### 소제목") → "## 자주 묻는 질문"(원문 내용으로 답할 수 있는 질문 2~3개만, "**Q. 질문**" 줄바꿈 "A. 답변" 형식) → "## 정리" 마무리.
- 절대 금지: "안녕하세요", "인플루언서입니다", "오늘은 ~에 대해 알아보겠습니다", "포스팅을 시작하겠습니다", "도움이 되셨다면 공감과 댓글 부탁드립니다" 등 AI 인사말·맺음말.
- 표(Table): 원문에 비교표가 없다면 원문에 있는 수치·사실만으로 핵심 비교표를 최소 1개 만들어 본문 중간에 넣으세요(원문에 없는 수치는 지어내지 말 것).
- 소제목은 "소제목 1:" 같은 번호·라벨 없이 내용을 담은 문장으로 쓰세요.
- 핵심 키워드는 제목, 도입부, 소제목 1~2개, 마무리에 자연스럽게 넣고 과도하게 반복하지 마세요.
- 문단은 2~4줄로 끊고, 어려운 용어는 원문 범위 안에서 첫 등장 때 한 줄로 풀어 주세요.
- 태그: 검색 유입용 단어형 태그 8~10개(# 없이, 쉼표로 구분).

[다이어그램 지침]
- 글 이해에 실제로 도움이 되는 설명 그림을 2~4개 직접 SVG로 그리세요({diagram_kinds}). 억지로 늘리지 말고 원문에 근거한 내용만 그리세요.
- 본문에서 그림이 들어갈 자리에 단독 줄로 <!-- [PHOTO_1_SLOT] --> , <!-- [PHOTO_2_SLOT] --> 처럼 번호 순서대로 표시하세요.
- SVG 규칙: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 높이"> 로 시작(높이 300~520), 첫 요소는 흰색 배경 사각형, 글자는 font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif", 글자 크기 16 이상, 한 칸에 들어가는 글자는 짧게(긴 문장은 text를 나누어 여러 줄로), 글자와 도형이 겹치지 않게 충분한 여백, 선과 화살표로 흐름을 분명하게(화살표는 marker 사용 가능), 색은 3~4가지 이내의 차분한 색. 스크립트·외부 이미지·외부 폰트·링크·애니메이션은 사용하지 마세요.

[출력 형식 - 매우 중요]
- 전체 결과물을 백틱 4개로 열고 닫는 하나의 코드블록(````markdown 으로 시작해서 ```` 로 끝남) 안에 작성하세요. 그 안의 코드 예제는 백틱 3개를 그대로 써도 됩니다.
- 코드블록 밖에는 어떤 설명도 쓰지 마세요.
- 아래 라벨을 각각 독립된 한 줄로 정확히 쓰세요.

[제목]
수정한 제목
[메타설명]
메타설명
[본문]
(마크다운 본문. 그림 자리에 <!-- [PHOTO_n_SLOT] --> 표시)
[태그]
태그1, 태그2, 태그3
[다이어그램1]
캡션: 그림을 설명하는 한 줄(원문에 근거한 내용)
<svg ...>...</svg>
[다이어그램2]
캡션: ...
<svg ...>...</svg>

[원문]
{original_text}
""".strip()

    def _get_latest_markdown_block(self, page: Page) -> str:
        """가장 마지막 코드블록(원본 마크다운) 텍스트 추출. 없거나 너무 짧으면 빈 문자열"""
        try:
            blocks = page.locator("pre code").all()
            if blocks:
                text = blocks[-1].inner_text().strip()
                if len(text) > 200:
                    return text
        except Exception as e:
            log(f"코드블록 추출 중 경미한 에러: {e}")
        return ""

    def _get_latest_assistant_message(self, page: Page) -> str:
        """가장 마지막 어시스턴트(Claude) 메시지 텍스트 추출"""
        try:
            selectors = [
                "[data-is-streaming] .font-claude-message",
                ".font-claude-message",
                "div.standard-markdown",
                "[data-message-author-role='assistant']",
                ".grid-cols-1 .prose"
            ]
            for sel in selectors:
                elements = page.locator(sel).all()
                if elements:
                    return elements[-1].inner_text()
            
            all_prose = page.locator("div.prose, div[class*='font-user-message'] ~ div").all()
            if all_prose:
                return all_prose[-1].inner_text()
        except Exception as e:
            log(f"텍스트 추출 중 경미한 에러: {e}")
        return ""

    def _build_prompt(
        self,
        place_name: str,
        category: str,
        location: str,
        place_url: str,
        key_info: str,
        special_notes: str,
        rating: str,
        photo_count: int,
        photo_captions: Optional[List[str]] = None,
        platform: str = "tistory"
    ) -> str:
        """Claude에게 전달할 고수익/SEO 최적화 블로그 원고 작성 프롬프트"""
        if platform == "naver":
            return self._build_naver_prompt(
                place_name, category, location, place_url, key_info,
                special_notes, rating, photo_count, photo_captions
            )
        captions_info = ""
        if photo_captions:
            for idx, c in enumerate(photo_captions):
                captions_info += f"- 사진 {idx+1}: {c}\n"

        photo_slots_guide = review_seo.photo_seo_rules(photo_count)
        photo_seo_guide = review_seo.table_rule()
        return f"""
{review_seo.persona_prompt(category)}
직접 다녀온 '내돈내산 방문/체험 후기'를 티스토리용 전문 블로그 포스팅으로 작성해주세요.

{review_seo.negative_prompt()}

[방문 장소 정보]
- 장소/상호명: {place_name}
- 카테고리: {category}
- 위치/지역: {location or '해당 지역 중심가'}
- 지도/플레이스 링크: {place_url or '정보 없음'}
- 주요 정보(메뉴/가격/입장료/시설 등): {key_info or '대표 정보'}
- 방문 특이사항 및 솔직 메모: {special_notes or '제공되지 않음 (없는 사실은 지어내지 말 것)'}
- 만족도/별점: {rating} / 5.0
- 첨부된 사진 정보(사용자가 적은 설명 힌트):
{captions_info or f'총 {photo_count}장의 사진 첨부됨 (설명 없음)'}

{review_seo.lead_and_summary_rules()}

[필수 작성 지침 및 출력 형식]
반드시 다음 구조로 작성하고, 각 태그 라벨을 정확하게 포함해주세요:

[제목후보]
CTR을 높이는 제목 3개를 한 줄에 하나씩. 각각 공백 포함 35자 이내(40자 초과 금지), 핵심 키워드(지역+상호명+대표 메뉴)를 앞쪽에 두고 숫자·비교·핵심 혜택 중 하나 이상 포함. "내돈내산 솔직 후기! ... 총정리" 같은 반복 틀 금지, 3개를 서로 다른 각도로 작성.

[제목]
위 후보 중 가장 좋은 1개

{review_seo.slug_rules()}
[슬러그]
영문 슬러그 한 줄

[메타설명]
150자 내외(140~160자). 리드 문단의 핵심을 압축한 한 문단.

[본문]
1. 구성 (소제목은 마크다운 "## 소제목 문장", 번호·라벨 문구 금지):
   - (소제목 없이) 리드 문단 → 요약 박스 1개
   - 위치, 인테리어/분위기, 주차 및 웨이팅 꿀팁
   - 핵심 특징, 대표 메뉴/체험 솔직 평가
   - 한눈에 보는 핵심 요약표 (마크다운 표: 장소명, 위치, 주요 가격/메뉴, 편의시설, 총점)
   - 솔직히 아쉬웠던 점 (대기, 가격, 주차 등 1~2가지)
   - 자주 묻는 질문
   - 마무리 총평 (이런 분께 추천, 비추천, 재방문 의사, 최종 한 줄 평)
2. 모바일 가독성: 2~3줄마다 빈 줄.
3. 사실성 원칙: 위 [방문 장소 정보]에 없는 가격, 영업시간, 메뉴명, 주차 여부는 지어내지 말고 '방문 전 확인 추천'으로 처리.

{photo_seo_guide}

{photo_slots_guide}

{review_seo.faq_rules()}

{review_seo.closing_rules()}

[태그]
#지역명, #장소명, #카테고리, #내돈내산 등 검색 유입용 태그 8~10개를 쉼표로 구분하여 작성 (예: #성수동맛집, #성수핫플, #내돈내산)

[출력 형식 - 매우 중요]
[제목후보]부터 [태그]까지 전체 결과물을 반드시 하나의 마크다운 코드블록(```markdown 으로 시작해서 ``` 로 끝남) 안에 작성하세요.
코드블록 밖에는 어떤 설명이나 인사말도 쓰지 마세요. 코드블록 안에서 소제목은 "## "로, 표는 마크다운 표로 쓰세요.

이제 위 지침에 맞추어 전문 블로그 원고를 정성껏 작성해주세요!
""".strip()

    def _build_naver_prompt(
        self,
        place_name: str,
        category: str,
        location: str,
        place_url: str,
        key_info: str,
        special_notes: str,
        rating: str,
        photo_count: int,
        photo_captions: Optional[List[str]] = None
    ) -> str:
        """네이버 블로그(검색 노출 기준)용 후기 작성 프롬프트"""
        captions_info = ""
        for idx, c in enumerate(photo_captions or []):
            captions_info += f"- 사진 {idx+1}: {c}\n"
        photo_count = min(photo_count, 10)
        if photo_count:
            slot_guide = (
                f"첨부된 사진 {photo_count}장을 직접 보고 내용에 맞는 위치를 정해, 각 위치에 아래 마커를 단독 줄로 삽입하세요 "
                f"(사진 번호는 첨부 순서와 같고, 모든 번호를 한 번씩만 사용):\n"
                + "\n".join(f"   <!-- [PHOTO_{i+1}_SLOT] -->" for i in range(photo_count))
            )
        else:
            slot_guide = "사진이 없으므로 사진 마커는 넣지 마세요."

        return f"""
당신은 네이버 블로그 검색(스마트블록, C-Rank, D.I.A.)에 강한 '{category}' 전문 블로거입니다.
직접 다녀온 사람의 시선으로 쓴 '내돈내산 방문 후기'를 네이버 블로그용으로 작성해주세요.

[방문 정보]
- 장소/상호명: {place_name}
- 카테고리: {category}
- 위치/지역: {location or '정보 없음'}
- 지도/플레이스 링크: {place_url or '정보 없음'}
- 주요 정보(메뉴/가격/시설 등): {key_info or '정보 없음'}
- 방문 메모/특이사항: {special_notes or '정보 없음'}
- 만족도: {rating} / 5.0
- 사진 설명:
{captions_info or '사진 설명 없음'}

[네이버 블로그 작성 지침]
1. 제목: 공백 포함 25~40자. 핵심 키워드(지역 + 상호명 + 대표 메뉴/특징)를 앞쪽에 배치하고 "내돈내산 솔직 후기! ... 총정리" 같은 반복 틀은 피할 것.
2. 본문 (공백 제외 1,800~2,500자):
   - 첫 문단 3~4줄 안에 장소명과 핵심 키워드를 자연스럽게 포함하고 방문 계기와 한 줄 요약을 쓸 것.
   - 모바일 가독성을 위해 한 문단은 2~3줄, 문단 사이에 빈 줄.
   - 소제목은 마크다운 "## 소제목 문장" 형식으로 4~6개. "소제목 1:" 같은 번호·라벨 문구는 쓰지 말 것.
   - 도입 바로 아래에 "> **먼저 보고 가세요**" 인용문으로 핵심 3줄(위치/가격대/한 줄 평)을 요약해 이탈을 줄일 것.
   - 구성: 도입(+3줄 요약) → 위치·주차·웨이팅 → 분위기·공간 → 메뉴/체험 상세 평가 → 솔직히 아쉬웠던 점 → 방문 전 자주 묻는 질문(독자가 검색할 만한 질문 3개를 "**Q.** 질문 / A. 답변" 형식으로) → 한눈에 보기(글머리표 목록) → 이런 분께 추천·비추천 + 마무리.
   - 표는 쓰지 말고 글머리표(-) 목록으로 정리할 것.
   - 장점만 늘어놓지 말고 아쉬운 점도 솔직하게 1~2가지 쓸 것.
   - 사진 배치: {slot_guide}
3. 사실 관계 (매우 중요):
   - 위 [방문 정보]와 첨부 사진에서 확인할 수 있는 내용만 쓰고, 영업시간, 가격, 주소, 전화번호, 개업 연도, 웨이팅 시간 등 구체적 사실은 입력되지 않았다면 절대 지어내지 말 것.
   - 모르는 정보는 "방문 전 네이버 지도에서 영업시간을 꼭 확인하세요"처럼 확인을 안내할 것.
4. 어조: 친근하고 담백한 블로그 말투(~했어요, ~더라고요). 과장 표현과 광고 같은 문구, 기계적인 문장은 피할 것.

반드시 아래 구조로 작성하고 각 라벨을 정확하게 포함하세요:

[제목]
네이버용 제목

[메타설명]
글 요약 한 줄 (60자 내외)

[본문]
(마크다운 본문)

[태그]
지역 + 업종 + 메뉴 + 추천 대상 조합의 단어형 태그 20~25개를 쉼표로 구분 (# 없이, 띄어쓰기 없는 단어로)

[출력 형식 - 매우 중요]
[제목]부터 [태그]까지 전체 결과물을 반드시 하나의 마크다운 코드블록(```markdown 으로 시작해서 ``` 로 끝남) 안에 작성하세요.
코드블록 밖에는 어떤 설명이나 인사말도 쓰지 마세요.
""".strip()

    def _naver_html(self, md_content: str, photos: Optional[List[Dict[str, str]]] = None):
        """네이버용: 사진 마커는 그대로 두고(화면에서 실제 사진으로 치환) 본문 HTML과 편집용 텍스트를 생성"""
        import markdown
        photos = photos or []
        count = min(len(photos), 10)
        md = md_content
        for i in range(1, count + 1):
            marker = f"<!-- [PHOTO_{i}_SLOT] -->"
            if marker in md:
                continue
            heads = [m.start() for m in re.finditer(r"\n## ", md)]
            pos = heads[i] if i < len(heads) else len(md)
            md = md[:pos] + f"\n\n{marker}\n\n" + md[pos:]

        article_text = md
        for i in range(count):
            cap = (photos[i].get("caption") or "현장 사진") if isinstance(photos[i], dict) else "현장 사진"
            article_text = article_text.replace(f"<!-- [PHOTO_{i+1}_SLOT] -->", f"📷 [사진 {i+1}: {cap}]")

        html = markdown.markdown(md, extensions=["nl2br"])
        html = html.replace("<h2>", '<h2 style="font-size: 20px; font-weight: bold; margin: 32px 0 14px;">')
        html = html.replace("<p>", '<p style="line-height: 1.9; margin: 0 0 14px; font-size: 15px;">')
        plain = re.sub(r"<!--.*?-->|[#*>\-`]", "", md)
        return html, article_text, len(re.sub(r"\s", "", plain)), md

    def _parse_claude_response(self, text: str, place_name: str, category: str, photos: Optional[List[Dict[str, str]]] = None, platform: str = "tistory") -> Dict[str, Any]:
        """Claude의 응답 텍스트를 제목, 본문, 태그 등으로 분리"""
        title = f"{place_name} 솔직 방문 후기"
        meta_desc = ""
        tags = []
        article = text

        title_match = re.search(r'\[제목\]\s*(.*?)(?=\n\n|\[슬러그\]|\[메타설명\]|\[본문\]|$)', text, re.DOTALL)
        if title_match:
            title = title_match.group(1).strip().replace("#", "").strip()

        meta_match = re.search(r'\[메타설명\]\s*(.*?)(?=\n\n|\[본문\]|$)', text, re.DOTALL)
        if meta_match:
            meta_desc = meta_match.group(1).strip()

        tags_match = re.search(r'\[태그\]\s*(.*?)$', text, re.DOTALL)
        if tags_match:
            raw_tags = tags_match.group(1).strip()
            t_list = re.findall(r'#?([가-힣a-zA-Z0-9_\-]+)', raw_tags)
            tags = [t for t in t_list if t and t.lower() not in ["태그", "tag"]]

        if not tags:
            tags = [place_name, category, "방문후기", "내돈내산", "솔직후기"]

        body_match = re.search(r'\[본문\]\s*(.*?)(?=\n\n\[태그\]|\[태그\]|$)', text, re.DOTALL)
        if body_match:
            article = body_match.group(1).strip()
        else:
            cleaned = text
            if title_match:
                cleaned = cleaned.replace(title_match.group(0), "")
            if tags_match:
                cleaned = cleaned.replace(tags_match.group(0), "")
            article = cleaned.strip()

        slug = ""
        title_candidates: List[str] = []
        photo_seo_raw: List[Dict[str, str]] = []
        if platform != "naver":
            slug_m = re.search(r'\[슬러그\]\s*(.*?)(?=\n\s*\[|$)', text, re.DOTALL)
            if slug_m and slug_m.group(1).strip():
                slug = review_seo.normalize_slug(slug_m.group(1).strip().splitlines()[0])
            cand_m = re.search(r'\[제목후보\]\s*(.*?)(?=\n\s*\[|$)', text, re.DOTALL)
            if cand_m:
                title_candidates = [re.sub(r'^[\s\-\d.)]+', '', ln).strip() for ln in cand_m.group(1).splitlines() if ln.strip()]
            article = review_seo.strip_cliches(article)
            # [IMAGE_SLOT: alt=... | caption=...] → 내부 사진 마커 + 슬롯별 Alt·캡션
            article, photo_seo_raw = review_seo.extract_image_slots(article, len(photos or []))

        if platform == "naver":
            tags = tags[:30]
            html_article, article_text, char_count, article_md = self._naver_html(article, photos)
            return {
                "title": title,
                "article": article_text,
                "html_article": html_article,
                "tags": tags,
                "tags_string": ", ".join(tags),
                "meta_description": meta_desc,
                "char_count": char_count,
                "article_md": article_md
            }

        photo_seo = review_seo.resolve_photo_seo(photo_seo_raw, photos or [], place_name, "") if photos else []
        html_article = self._markdown_to_tistory_html(article, place_name, photos=photos, photo_seo=photo_seo)
        title_candidates = review_seo.clean_title_candidates(title_candidates, title)
        article_for_editor = review_seo.EXPERIENCE_MARKER_RE.sub("\n\n[💡 실무/현장 경험 한 줄 추가 구간]\n\n", article)
        for n, seo in enumerate(photo_seo, start=1):
            article_for_editor = article_for_editor.replace(
                f"<!-- [PHOTO_{n}_SLOT] -->", f"\n\n(사진 {n}) {seo['caption']}\n")

        return {
            "title": title,
            "title_candidates": title_candidates,
            "slug": slug,
            "titles": title_candidates,
            "englishSlug": slug,
            "metaDescription": meta_desc,
            "faqSchema": review_seo.build_faq_schema(article),
            "htmlContent": html_article,
            "article": article_for_editor,
            "html_article": html_article,
            "tags": tags,
            "tags_string": ", ".join(tags),
            "meta_description": meta_desc,
            "photo_seo": photo_seo
        }

    def _markdown_to_tistory_html(self, md_content: str, place_name: str, photos: Optional[List[Dict[str, str]]] = None, photo_seo: Optional[List[Dict[str, str]]] = None) -> str:
        """마크다운을 티스토리 맞춤형 프리미엄 모던 HTML로 변환 및 사진 슬롯 치환"""
        import markdown
        html = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'nl2br'])

        html = html.replace('<h2>', '<h2 style="font-size: 20px; font-weight: bold; border-left: 4px solid #3b82f6; padding-left: 12px; margin-top: 35px; margin-bottom: 15px; color: #1e293b;">')
        html = html.replace('<h3>', '<h3 style="font-size: 17px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #334155;">')
        html = html.replace('<table>', '<table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px; text-align: left; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">')
        html = html.replace('<th>', '<th style="background-color: #f1f5f9; padding: 12px; font-weight: 600; border-bottom: 1px solid #cbd5e1; color: #334155;">')
        html = html.replace('<td>', '<td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">')
        html = html.replace('<p>', '<p style="line-height: 1.85; margin-bottom: 16px; color: #334155; font-size: 15px;">')
        html = review_seo.style_summary_callout(html)

        if photos and len(photos) > 0:
            for idx, p in enumerate(photos):
                slot_marker = f"<!-- [PHOTO_{idx+1}_SLOT] -->"
                data_url = p.get("data_url") or ""
                seo = photo_seo[idx] if photo_seo and idx < len(photo_seo) else {}
                alt_text = seo.get("alt") or f"{place_name} {p.get('caption') or ''}".strip()
                caption = seo.get("caption") or p.get("caption") or place_name

                if data_url:
                    img_card = review_seo.render_figure(idx + 1, data_url, alt_text, caption)
                    if slot_marker in html:
                        html = html.replace(slot_marker, img_card)
                    else:
                        # 마커가 없으면 해당 순번 소제목 앞(없으면 본문 끝)에 삽입
                        h2_positions = [m.start() for m in re.finditer(r"<h2", html)]
                        if len(h2_positions) > idx + 1:
                            pos = h2_positions[idx + 1]
                            html = html[:pos] + img_card + html[pos:]
                        else:
                            html += img_card
                else:
                    html = html.replace(slot_marker, "")
        
        html = re.sub(r'<!--\s*\[PHOTO_\d+_SLOT\]\s*-->', '', html)
        html = review_seo.EXPERIENCE_MARKER_RE.sub(review_seo.EXPERIENCE_BOX_HTML, html, count=1)
        return html
