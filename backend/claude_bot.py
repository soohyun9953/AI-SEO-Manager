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

        photo_slots_guide = ""
        for i in range(1, max(photo_count, 2) + 1):
            photo_slots_guide += f"- 소제목 중간 적절한 위치에 '<!-- [PHOTO_{i}_SLOT] -->' 마커를 단독 줄로 삽입할 것\n"

        return f"""
당신은 네이버 블로그 스마트블록 및 다음/구글 검색 상위 노출 전문 '라이프스타일·여행·미식 인플루언서'입니다.
직접 다녀온 솔직하고 생생한 '내돈내산 방문/체험 후기'를 티스토리 및 네이버에 적합한 전문 블로그 포스팅으로 작성해주세요.

[방문 장소 정보]
- 장소/상호명: {place_name}
- 카테고리: {category}
- 위치/지역: {location or '해당 지역 중심가'}
- 지도/플레이스 링크: {place_url or '정보 없음'}
- 주요 정보(메뉴/가격/입장료/시설 등): {key_info or '대표 정보'}
- 방문 특이사항 및 솔직 메모: {special_notes or '분위기 좋고 만족스러움, 재방문 의사 있음'}
- 만족도/별점: {rating} / 5.0
- 첨부된 사진 정보:
{captions_info or f'총 {photo_count}장의 현장 사진 첨부됨'}

[필수 작성 지침 및 출력 형식]
반드시 다음 구조로 작성하고, 각 태그 라벨을 정확하게 포함해주세요:

[제목]
클릭률(CTR)과 검색 노출을 극대화하는 제목.
- 공백 포함 35자 이내로 짧게 쓸 것 (검색 결과에서 길면 잘림, 40자 초과 금지)
- 핵심 키워드(지역 + 상호명 + 대표 메뉴)를 제목 앞쪽에 배치
- "내돈내산 솔직 후기! ... 총정리" 같은 반복 틀은 피하고 글마다 다른 표현 사용
- 예시: {location} {place_name} 후기 | 대표메뉴와 웨이팅·주차 팁

[메타설명]
검색엔진 스니펫용 1~2줄 요약 (80~120자 내외)

[본문]
1. 톤 앤 매너:
   - 생생한 E-E-A-T 기반의 친근하고 다정한 어조(~했어요, ~더라고요, ~추천해요).
   - 기계적인 AI 느낌 없이 손님/여행자의 입장에서 느낀 솔직한 장단점과 팁 기술.
   - 모바일 가독성을 위해 2~3줄마다 빈 줄(줄바꿈) 적용.
2. 구성:
   - 도입부: 방문 동기와 첫인상
   - 첫 번째 소제목 (주제: 위치, 인테리어/분위기, 주차 및 웨이팅 꿀팁)
   - 두 번째 소제목 (주제: 핵심 특징, 대표 메뉴/체험 솔직 평가)
   - 세 번째 소제목 (주제: 한눈에 보는 핵심 요약 - 마크다운 표 Table로 정리: 장소명, 위치, 주요 가격/메뉴, 편의시설, 총점)
   - 마무리 소제목 (이런 분께 추천, 재방문 의사, 최종 한 줄 평)
   - 각 소제목은 반드시 마크다운 "## 소제목 문장" 형식으로 쓰고, "소제목 1:" 같은 번호·라벨 문구는 쓰지 말고 주제를 담은 매력적인 제목 문장만 쓸 것
3. 사진 슬롯 마커 배치:
{photo_slots_guide}

[태그]
#지역명, #장소명, #카테고리, #내돈내산 등 검색 유입용 태그 10~15개를 쉼표로 구분하여 작성 (예: #성수동맛집, #성수핫플, #내돈내산)

[출력 형식 - 매우 중요]
[제목]부터 [태그]까지 전체 결과물을 반드시 하나의 마크다운 코드블록(```markdown 으로 시작해서 ``` 로 끝남) 안에 작성하세요.
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
   - 소제목은 마크다운 "## 소제목 문장" 형식으로 3~5개. "소제목 1:" 같은 번호·라벨 문구는 쓰지 말 것.
   - 구성: 도입 → 위치·주차·웨이팅 → 분위기·공간 → 메뉴/체험 상세 평가 → 아쉬운 점 → 한눈에 보기(글머리표 목록) → 이런 분께 추천 + 마무리.
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
        return html, article_text, len(re.sub(r"\s", "", plain))

    def _parse_claude_response(self, text: str, place_name: str, category: str, photos: Optional[List[Dict[str, str]]] = None, platform: str = "tistory") -> Dict[str, Any]:
        """Claude의 응답 텍스트를 제목, 본문, 태그 등으로 분리"""
        title = f"{place_name} 솔직 방문 후기"
        meta_desc = ""
        tags = []
        article = text

        title_match = re.search(r'\[제목\]\s*(.*?)(?=\n\n|\[메타설명\]|\[본문\]|$)', text, re.DOTALL)
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

        if platform == "naver":
            tags = tags[:30]
            html_article, article_text, char_count = self._naver_html(article, photos)
            return {
                "title": title,
                "article": article_text,
                "html_article": html_article,
                "tags": tags,
                "tags_string": ", ".join(tags),
                "meta_description": meta_desc,
                "char_count": char_count
            }

        html_article = self._markdown_to_tistory_html(article, place_name, photos=photos)

        return {
            "title": title,
            "article": article,
            "html_article": html_article,
            "tags": tags,
            "tags_string": ", ".join(tags),
            "meta_description": meta_desc
        }

    def _markdown_to_tistory_html(self, md_content: str, place_name: str, photos: Optional[List[Dict[str, str]]] = None) -> str:
        """마크다운을 티스토리 맞춤형 프리미엄 모던 HTML로 변환 및 사진 슬롯 치환"""
        import markdown
        html = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'nl2br'])

        html = html.replace('<h2>', '<h2 style="font-size: 20px; font-weight: bold; border-left: 4px solid #3b82f6; padding-left: 12px; margin-top: 35px; margin-bottom: 15px; color: #1e293b;">')
        html = html.replace('<h3>', '<h3 style="font-size: 17px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #334155;">')
        html = html.replace('<table>', '<table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px; text-align: left; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">')
        html = html.replace('<th>', '<th style="background-color: #f1f5f9; padding: 12px; font-weight: 600; border-bottom: 1px solid #cbd5e1; color: #334155;">')
        html = html.replace('<td>', '<td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">')
        html = html.replace('<p>', '<p style="line-height: 1.85; margin-bottom: 16px; color: #334155; font-size: 15px;">')

        if photos and len(photos) > 0:
            for idx, p in enumerate(photos):
                slot_marker = f"<!-- [PHOTO_{idx+1}_SLOT] -->"
                data_url = p.get("data_url") or ""
                caption = p.get("caption") or f"{place_name} 현장 사진 {idx+1}"
                
                if data_url:
                    img_card = f"""
<div style="margin: 25px 0; text-align: center;">
  <img src="{data_url}" alt="{caption}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
  <p style="font-size: 13px; color: #64748b; margin-top: 8px;">📷 {caption}</p>
</div>
"""
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
        return html
