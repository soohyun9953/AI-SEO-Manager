"""
티스토리 브라우저 자동 등록 봇 (Tistory Browser Automation Bot)
- 엔진: Playwright (Chromium)
- 브라우저 프로필 영속화: ./tistory_browser_profile (카카오 로그인 1회 시 세션 영구 보존)
- 주요 기능: 티스토리 에디터 자동 접속, 로그인 감지, 제목/본문(HTML)/카테고리/태그 주입, 임시저장 및 발행
- 보안: 비밀번호 불필요, 사용자 정상 세션 활용, 외부 유출 차단
"""

import os
import re
import sys
import base64
import html as html_lib
import tempfile
import time
import json
import subprocess
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
from playwright.sync_api import sync_playwright, BrowserContext, Page

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

# 기본 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(BASE_DIR, "tistory_browser_profile")
COOKIE_FILE = os.path.join(BASE_DIR, "tistory_cookies.json")  # 세션 쿠키 보관
DEFAULT_BLOG = "s-elegant"
TISTORY_DEBUG_PORT = 9223
TISTORY_CDP_URL = f"http://127.0.0.1:{TISTORY_DEBUG_PORT}"

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

def ensure_tistory_chrome(blog_name: str = DEFAULT_BLOG) -> Optional[subprocess.Popen]:
    """티스토리 전용 디버깅 크롬 브라우저가 실행 중인지 확인하고, 없으면 정식 크롬으로 화면에 팝업 실행"""
    write_url = f"https://{blog_name}.tistory.com/manage/post"
    try:
        res = requests.get(f"{TISTORY_CDP_URL}/json/version", timeout=1.5)
        if res.status_code == 200:
            log("[OK] [Tistory Bot] 기존에 열려있는 티스토리 전용 크롬(CDP 9223)에 연결합니다.")
            force_foreground_window()
            return None
    except Exception:
        pass

    chrome_path = find_chrome_exe()
    os.makedirs(PROFILE_DIR, exist_ok=True)
    
    cmd = [
        chrome_path,
        f"--remote-debugging-port={TISTORY_DEBUG_PORT}",
        f"--user-data-dir={PROFILE_DIR}",
        "--start-maximized",
        "--no-first-run",
        "--no-default-browser-check",
        write_url
    ]
    log(f"[START] [Tistory Bot] 정식 Google Chrome을 화면에 실행합니다... ({chrome_path})")
    proc = subprocess.Popen(cmd)
    
    # 포트 9223 응답 대기 (최대 15초)
    for _ in range(30):
        time.sleep(0.5)
        try:
            res = requests.get(f"{TISTORY_CDP_URL}/json/version", timeout=1)
            if res.status_code == 200:
                log("[OK] [Tistory Bot] 크롬 디버깅 포트(9223) 연결 준비 완료!")
                force_foreground_window()
                return proc
        except Exception:
            pass
            
    force_foreground_window()
    return proc

def force_foreground_window():
    """Windows에서 티스토리 및 카카오 로그인 브라우저 창을 강제로 화면 맨 앞으로 활성화"""
    if sys.platform == "win32":
        try:
            import ctypes
            user32 = ctypes.windll.user32
            EnumWindows = user32.EnumWindows
            EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
            GetWindowText = user32.GetWindowTextW
            GetWindowTextLength = user32.GetWindowTextLengthW
            SetForegroundWindow = user32.SetForegroundWindow
            ShowWindow = user32.ShowWindow
            BringWindowToTop = user32.BringWindowToTop
            SetWindowPos = user32.SetWindowPos

            HWND_TOPMOST = -1
            HWND_NOTOPMOST = -2
            SWP_NOMOVE = 0x0002
            SWP_NOSIZE = 0x0001
            SW_RESTORE = 9

            def foreach_window(hwnd, lParam):
                length = GetWindowTextLength(hwnd)
                if length == 0:
                    return True
                buff = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buff, length + 1)
                title = buff.value
                # 티스토리, 카카오, 로그인 관련 창 맨 앞으로
                if any(k in title for k in ("티스토리", "카카오", "Tistory", "Kakao", "Daum", "로그인", "Chrome")):
                    ShowWindow(hwnd, SW_RESTORE)
                    SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
                    SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
                    BringWindowToTop(hwnd)
                    SetForegroundWindow(hwnd)
                    return False
                return True

            EnumWindows(EnumWindowsProc(foreach_window), 0)
        except Exception:
            pass

class TistoryAutomator:
    def __init__(self, blog_name: str = DEFAULT_BLOG, headless: bool = False):
        self.blog_name = blog_name
        self.headless = headless
        self.write_url = f"https://{self.blog_name}.tistory.com/manage/post"
        self.profile_dir = PROFILE_DIR
        os.makedirs(self.profile_dir, exist_ok=True)

    def _is_login_url(self, url: str) -> bool:
        return "accounts.kakao.com" in url or "/auth/login" in url or "login" in url.split("?")[0]

    def _wait_for_user_login(self, page: Page, timeout_seconds: int = 300) -> Optional[Page]:
        """사용자가 카카오 로그인을 완료할 때까지 대기. 열린 모든 탭을 확인하고, 로그인 완료된 탭(Page)을 반환"""
        log("[LOGIN] 카카오 로그인이 필요합니다. 화면에 열린 브라우저 창에서 카카오 로그인을 진행해주세요...")
        force_foreground_window()
        try:
            page.bring_to_front()
        except Exception:
            pass

        start_time = time.time()
        last_fg_time = time.time()
        while time.time() - start_time < timeout_seconds:
            # 5초마다 창 앞으로 복원 시도
            if time.time() - last_fg_time > 5:
                force_foreground_window()
                last_fg_time = time.time()

            page.wait_for_timeout(2000)
            try:
                urls = []
                for pg in page.context.pages:
                    try:
                        curr_url = pg.url
                    except Exception:
                        continue
                    urls.append(curr_url[:90])
                    if self._is_login_url(curr_url) or curr_url.startswith("about:"):
                        continue
                    # 블로그 도메인(관리/에디터 화면)에 도달했다면 로그인 완료
                    if f"{self.blog_name}.tistory.com/manage" in curr_url:
                        log("[OK] 로그인 확인 완료! 글쓰기 편집기로 진입합니다.")
                        # 쿠키 즉시 영구 저장
                        try:
                            with open(COOKIE_FILE, "w", encoding="utf-8") as f:
                                json.dump(page.context.cookies(), f, ensure_ascii=False)
                            log("[OK] 로그인 세션 쿠키를 tistory_cookies.json에 즉시 보존했습니다.")
                        except Exception:
                            pass
                        return pg
                    # 그 외 주소(티스토리 메인 등)라면 글쓰기 화면으로 이동해 다시 확인
                    if "tistory.com" in curr_url:
                        pg.goto(self.write_url, wait_until="domcontentloaded", timeout=60000)
                log(f"[LOGIN] 열린 탭: {urls}")
            except Exception as e:
                log(f"[LOGIN] 확인 중 일시 오류(무시): {e}")
        log("[ERROR] 로그인 대기 시간(5분)이 초과되었습니다.")
        return None

    def _dismiss_resume_prompt(self, page: Page):
        """'작성 중인 글이 있습니다. 이어서 작성할까요?' 확인창이 뜨면 새 글로 시작(취소)"""
        try:
            page.wait_for_timeout(1500)
            handled = page.evaluate("""() => {
                const keys = ['이어서', '작성 중인', '작성중인', '저장된 글'];
                const layers = Array.from(document.querySelectorAll('[class*=layer],[class*=modal],[class*=popup],[class*=confirm],[role=dialog],[role=alertdialog]'))
                    .filter(e => e.offsetParent !== null && keys.some(k => e.innerText.includes(k)));
                for (const layer of layers) {
                    const btns = Array.from(layer.querySelectorAll('button, a'));
                    const cancel = btns.find(b => /취소|아니|새로|닫기/.test(b.innerText));
                    if (cancel) { cancel.click(); return layer.innerText.trim().slice(0, 60); }
                }
                return '';
            }""")
            if handled:
                log(f"[OK] '이어서 작성' 확인창을 닫고 새 글로 시작합니다: {handled}")
        except Exception as e:
            log(f"[WARN] 확인창 처리 중 오류(무시): {e}")

    def _meta_summary_html(self, meta_description: str) -> str:
        """티스토리는 별도 검색 설명 입력란이 없어 본문 첫 부분이 검색 설명으로 쓰이므로, 메타 설명을 맨 위 요약 문단으로 삽입"""
        # 본문 첫 문단(리드 문단, 140~160자)이 곧 검색 스니펫이므로, 그 앞에 '핵심 요약' 라벨 문단을 끼워 넣지 않는다.
        # (예전에는 여기서 요약 박스를 맨 위에 붙여 스니펫이 라벨 텍스트로 시작하는 문제가 있었다.)
        return ""
        meta = (meta_description or "").strip()
        if not meta:
            return ""
        return (
            '<p style="padding: 14px 18px; background: #f8fafc; border-left: 4px solid #3b82f6; '
            'border-radius: 6px; color: #334155; font-size: 15px; line-height: 1.7;">'
            f'<strong>핵심 요약</strong> · {html_lib.escape(meta)}</p>'
        )

    def _category_candidates(self, category: str, hint_text: str) -> List[str]:
        """앱 카테고리를 블로그의 실제 카테고리명 후보 목록(우선순위순)으로 변환"""
        cat = (category or "").strip()
        cands = [cat] if cat else []
        if cat == "맛집/카페":
            if re.search(r"카페|커피|로스터|디저트|베이커리|브런치", hint_text):
                cands += ["카페", "음식점", "맛집"]
            else:
                cands += ["음식점", "맛집", "카페"]
        elif cat == "여행/나들이":
            cands += ["여행", "나들이", "일상"]
        elif cat == "숙소/호텔":
            cands += ["숙소", "호텔", "여행", "일상"]
        elif cat == "문화/전시":
            cands += ["문화", "전시", "일상"]
        elif cat == "생활/체험":
            cands += ["체험", "일상"]
        return cands

    def _select_category(self, page: Page, category: str, hint_text: str) -> bool:
        """블로그의 실제 카테고리 목록에서 후보와 일치하는 항목을 찾아 선택"""
        try:
            page.locator("#category-btn").first.click(timeout=4000)
            page.wait_for_timeout(800)
            options = page.evaluate(
                "() => Array.from(document.querySelectorAll('[id^=category-item-]')).map(e => ({id: e.id, text: e.innerText.trim()}))")
            names = [o["text"].lstrip("- ").strip() for o in options]
            log(f"📂 블로그 카테고리 목록: {names}")
            for cand in self._category_candidates(category, hint_text):
                for opt, name in zip(options, names):
                    if name == cand or cand in name:
                        page.locator(f"[id='{opt['id']}']").first.click()
                        page.wait_for_timeout(600)
                        log(f"✅ 카테고리 '{name}' 선택 완료 (요청: {category})")
                        return True
            # 맞는 항목이 없으면 목록을 닫음
            page.locator("#category-btn").first.click()
            log(f"⚠️ '{category}'에 맞는 블로그 카테고리를 찾지 못해 카테고리를 지정하지 않았습니다.")
        except Exception as cat_e:
            log(f"⚠️ 카테고리 선택 스킵 ({cat_e})")
        return False

    def _extract_photos(self, content_html: str):
        """본문 속 base64 사진(<figure> 또는 <img>)을 임시 파일로 저장하고, 해당 위치에 업로드용 자리표시자를 남긴다."""
        photo_files = []
        tmp_dir = tempfile.mkdtemp(prefix="tistory_photos_")

        def save_data_url(data_url: str, idx: int) -> Optional[str]:
            m = re.match(r"data:image/(\w+);base64,(.+)", data_url, re.S)
            if not m:
                return None
            ext = "jpg" if m.group(1).lower() == "jpeg" else m.group(1).lower()
            path = os.path.join(tmp_dir, f"photo_{idx}.{ext}")
            with open(path, "wb") as f:
                f.write(base64.b64decode(m.group(2)))
            return path

        def figure_repl(m):
            block = m.group(0)
            img = re.search(r'<img[^>]+src="(data:image/[^"]+)"', block)
            if not img:
                return block
            path = save_data_url(img.group(1), len(photo_files) + 1)
            if not path:
                return block
            photo_files.append(path)
            cap = re.search(r"<figcaption[^>]*>(.*?)</figcaption>", block, re.S)
            cap_html = ""
            if cap:
                cap_html = f'<p style="text-align:center; font-size:13px; color:#71717a;">{cap.group(1).strip()}</p>'
            return f'<p id="photo-slot-{len(photo_files)}"><br></p>{cap_html}'

        html = re.sub(r"<figure[^>]*>.*?</figure>", figure_repl, content_html, flags=re.S)

        def img_repl(m):
            path = save_data_url(m.group(1), len(photo_files) + 1)
            if not path:
                return m.group(0)
            photo_files.append(path)
            return f'<p id="photo-slot-{len(photo_files)}"><br></p>'

        html = re.sub(r'<img[^>]+src="(data:image/[^"]+)"[^>]*>', img_repl, html)
        return html, photo_files

    def _upload_photos(self, page: Page, photo_files: List[str]) -> int:
        """에디터의 [첨부 > 사진] 메뉴로 사진을 업로드해 자리표시자 위치에 삽입"""
        uploaded = 0
        for n, path in enumerate(photo_files, start=1):
            try:
                before = page.evaluate("() => tinymce.activeEditor.getBody().querySelectorAll('img').length")
                placed = page.evaluate(
                    """(id) => {
                        const ed = tinymce.activeEditor;
                        const el = ed.dom.get(id);
                        if (!el) return false;
                        ed.focus();
                        ed.selection.setCursorLocation(el, 0);
                        return true;
                    }""", f"photo-slot-{n}")
                if not placed:
                    log(f"[WARN] 사진 {n} 자리를 찾지 못해 건너뜁니다.")
                    continue
                page.locator("#mceu_0-open").click()
                time.sleep(0.5)
                with page.expect_file_chooser(timeout=10000) as fc_info:
                    page.locator("#attach-image").click()
                fc_info.value.set_files(path)
                # 업로드 완료(이미지 개수 증가) 대기
                page.wait_for_function(
                    "(b) => tinymce.activeEditor.getBody().querySelectorAll('img').length > b",
                    arg=before, timeout=45000)
                time.sleep(1.5)
                uploaded += 1
                log(f"[OK] 사진 {n}/{len(photo_files)} 업로드 완료")
            except Exception as ph_err:
                log(f"[WARN] 사진 {n} 업로드 실패: {ph_err}")
        # 비어 있는 자리표시자 정리
        try:
            page.evaluate("""() => {
                const ed = tinymce.activeEditor;
                ed.getBody().querySelectorAll('p[id^=photo-slot-]').forEach(p => {
                    if (!p.querySelector('img') && !p.textContent.trim()) p.remove();
                });
            }""")
        except Exception:
            pass
        return uploaded

    def post_content(
        self,
        title: str,
        content_html: str,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        action: str = "TEMP_SAVE",
        meta_description: str = ""
    ) -> Dict[str, Any]:
        """
        티스토리 에디터에 콘텐츠 등록 실행 (독립 스레드 보장)
        """
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self._run_post_content, title, content_html, tags, category, action, meta_description)
            return future.result()

    def _run_post_content(
        self,
        title: str,
        content_html: str,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        action: str = "TEMP_SAVE",
        meta_description: str = ""
    ) -> Dict[str, Any]:
        start_time = datetime.now().isoformat()
        result = {
            "success": False,
            "action": action,
            "start_time": start_time,
            "end_time": None,
            "post_url": None,
            "error": None,
            "message": ""
        }

        with sync_playwright() as p:
            browser = None
            context = None
            
            # 1. 9223 디버깅 크롬 포트가 열려 있다면 CDP로 우선 연결
            try:
                res = requests.get(f"{TISTORY_CDP_URL}/json/version", timeout=1)
                if res.status_code == 200:
                    log(f"[CONNECT] [Tistory Bot] 열려있는 디버깅 크롬({TISTORY_CDP_URL})에 연결합니다...")
                    browser = p.chromium.connect_over_cdp(TISTORY_CDP_URL)
                    context = browser.contexts[0] if browser.contexts else browser.new_context()
            except Exception:
                pass

            # 2. 열려있지 않다면 직접 정식 크롬 Context 실행
            if not context:
                log(f"[START] [Tistory Bot] 정식 Google Chrome 브라우저를 실행합니다... (프로필: {self.profile_dir})")
                context = p.chromium.launch_persistent_context(
                    user_data_dir=self.profile_dir,
                    channel="chrome",
                    headless=self.headless,
                    viewport={"width": 1280, "height": 900},
                    args=["--disable-blink-features=AutomationControlled", "--start-maximized"]
                )

            # 이전에 저장해 둔 로그인 쿠키 복원
            try:
                if os.path.exists(COOKIE_FILE):
                    with open(COOKIE_FILE, "r", encoding="utf-8") as f:
                        context.add_cookies(json.load(f))
                    log("[OK] 저장된 로그인 세션을 복원했습니다.")
            except Exception as ck_err:
                log(f"[WARN] 로그인 세션 복원 실패(무시): {ck_err}")

            # 티스토리 관련 탭 탐색 또는 새 페이지
            page = None
            for pg in context.pages:
                if "tistory.com" in pg.url or "kakao.com" in pg.url:
                    page = pg
                    break
            if not page:
                page = context.pages[0] if context.pages else context.new_page()

            # 다이얼로그(alert, confirm) 자동 수락 설정 (모드 변경 시 확인창 등)
            def _accept_dialog(dialog):
                try:
                    msg = dialog.message or ""
                    if any(k in msg for k in ("이어서", "작성 중인", "작성중인", "저장된 글")):
                        log(f"[OK] 이어쓰기 확인창 취소(새 글로 시작): {msg[:60]}")
                        dialog.dismiss()
                    else:
                        dialog.accept()
                except Exception:
                    pass
            page.on("dialog", _accept_dialog)

            try:
                print(f"🌐 글쓰기 화면으로 이동: {self.write_url}")
                page.goto(self.write_url, wait_until="networkidle", timeout=60000)
                time.sleep(3)

                # 1. 로그인 상태 점검
                current_url = page.url
                if "accounts.kakao.com" in current_url or "login" in current_url:
                    logged_page = self._wait_for_user_login(page)
                    if not logged_page:
                        raise Exception("로그인이 완료되지 않아 작업을 중단합니다. (5분 내 카카오 로그인을 완료해 주세요)")
                    if logged_page is not page:
                        page = logged_page
                        page.on("dialog", _accept_dialog)
                    if "/manage/" not in page.url:
                        page.goto(self.write_url, wait_until="domcontentloaded", timeout=60000)
                    time.sleep(3)

                # 2. 에디터 로딩 대기
                print("📝 티스토리 에디터 로딩 확인 중...")
                self._dismiss_resume_prompt(page)
                # 제목 입력 요소 탐색 (다양한 티스토리 에디터 버전 대응)
                title_selector = None
                for sel in ["#post-title", "textarea.textarea_tit", "textarea[placeholder*='제목']", "input.tit_post"]:
                    if page.locator(sel).count() > 0:
                        title_selector = sel
                        break

                if not title_selector:
                    # 대체 셀렉터 재시도
                    page.wait_for_selector("textarea", timeout=15000)
                    title_selector = "textarea"

                print(f"📌 제목 입력 필드 발견 ({title_selector})")

                # 3. 제목 입력
                print(f"✍️ 제목 입력 중: {title}")
                page.click(title_selector)
                page.fill(title_selector, title)
                time.sleep(1)

                # 4. 카테고리 선택 (블로그의 실제 카테고리명과 매칭)
                if category:
                    hint = f"{title} {re.sub(r'<[^>]+>', ' ', content_html)[:600]}"
                    self._select_category(page, category, hint)

                # 5. 본문 입력 (HTML 모드 전환 주입)
                print("📄 본문 내용 주입 준비 (HTML 모드 전환)...")
                
                # 본문 속 base64 사진은 티스토리에 직접 업로드하기 위해 분리
                summary_html = self._meta_summary_html(meta_description)
                if summary_html:
                    content_html = summary_html + content_html
                    print("📝 메타 설명을 본문 상단 요약 문단으로 추가")
                body_html, photo_files = self._extract_photos(content_html)
                if photo_files:
                    print(f"📷 업로드할 사진 {len(photo_files)}장 확인")

                # 0순위: TinyMCE API로 본문 HTML 직접 주입 (티스토리 기본 에디터)
                content_injected = False
                try:
                    page.wait_for_function("() => window.tinymce && tinymce.activeEditor", timeout=15000)
                    content_injected = bool(page.evaluate(
                        """(content) => {
                            const ed = tinymce.activeEditor;
                            if (!ed) return false;
                            ed.setContent(content);
                            ed.save();
                            ed.fire('change');
                            return ed.getContent().length > 0;
                        }""", body_html))
                    if content_injected:
                        print("✅ 본문 HTML 주입 성공 (TinyMCE)")
                        if photo_files:
                            ok_cnt = self._upload_photos(page, photo_files)
                            print(f"📷 사진 업로드 결과: {ok_cnt}/{len(photo_files)}장")
                except Exception as mce_err:
                    print(f"⚠️ TinyMCE 주입 실패, 대체 방식 시도: {mce_err}")

                # 에디터 모드 전환 버튼 찾기 (기본모드 -> HTML)
                html_mode_switched = False
                mode_btn = page.locator("#editor-mode-select, button.btn_mode, #editor-mode, button:has-text('기본모드')").first
                
                if not content_injected and mode_btn.is_visible(timeout=4000):
                    mode_btn.click()
                    time.sleep(1)
                    html_option = page.locator("button:has-text('HTML'), li:has-text('HTML'), span:has-text('HTML')").first
                    if html_option.is_visible(timeout=3000):
                        html_option.click()
                        time.sleep(2)
                        html_mode_switched = True
                        print("✅ HTML 편집 모드로 전환 완료")

                if html_mode_switched:
                    # CodeMirror 또는 textarea에 HTML 주입
                    try:
                        # 1순위: CodeMirror API 주입
                        page.evaluate("""
                            (content) => {
                                const cmEl = document.querySelector('.CodeMirror');
                                if (cmEl && cmEl.CodeMirror) {
                                    cmEl.CodeMirror.setValue(content);
                                    return true;
                                }
                                const ta = document.querySelector('textarea.CodeMirror-textarea, textarea');
                                if (ta) {
                                    ta.value = content;
                                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                                    return true;
                                }
                                return false;
                            }
                        """, content_html)
                        print("✅ HTML 코드 주입 성공 (CodeMirror)")
                        time.sleep(2)

                        # 다시 기본모드로 전환하여 비주얼 렌더링 확인
                        mode_btn_html = page.locator("#editor-mode-select, button.btn_mode, #editor-mode, button:has-text('HTML')").first
                        if mode_btn_html.is_visible(timeout=3000):
                            mode_btn_html.click()
                            time.sleep(1)
                            basic_option = page.locator("button:has-text('기본모드'), li:has-text('기본모드'), span:has-text('기본모드')").first
                            if basic_option.is_visible(timeout=3000):
                                basic_option.click()
                                time.sleep(2)
                                print("✅ 기본모드로 재전환하여 서식 및 이미지 렌더링 확인 완료")
                    except Exception as html_err:
                        print(f"⚠️ CodeMirror 직접 주입 실패, 대체 클립보드 주입 시도: {html_err}")
                elif not content_injected:
                    # HTML 모드 버튼이 보이지 않을 경우 본문 영역 직접 주입
                    print("⚠️ 기본 WYSIWYG 본문 영역 직접 삽입")
                    content_area = page.locator("#editor-root, #mceu_0, div[contenteditable='true'], .mce-content-body").first
                    if content_area.is_visible(timeout=5000):
                        content_area.click()
                        page.evaluate("""
                            (content) => {
                                const el = document.querySelector("div[contenteditable='true'], #editor-root");
                                if (el) {
                                    el.innerHTML = content;
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            }
                        """, content_html)

                time.sleep(2)

                # 6. 태그 입력
                if tags:
                    print(f"🏷️ 태그 입력 중 ({len(tags)}개)...")
                    try:
                        tag_input = page.locator("#tagText, input#tag-editor, input[placeholder*='태그'], input.inp_tag").first
                        if tag_input.is_visible(timeout=4000):
                            tag_input.click()
                            for t in tags[:10]:
                                clean_t = t.replace("#", "").strip()
                                if clean_t:
                                    tag_input.fill(clean_t)
                                    page.keyboard.press("Enter")
                                    time.sleep(0.3)
                            print("✅ 태그 입력 완료")
                    except Exception as tag_err:
                        print(f"⚠️ 태그 입력 스킵: {tag_err}")

                time.sleep(2)

                # 7. 정책에 따른 발행/임시저장 실행
                if action == "TEMP_SAVE":
                    print("💾 [정책: 임시저장] 안전 모드로 임시저장을 수행합니다...")
                    temp_btn = page.locator("a.action:has-text('임시저장'), #temp-save-btn, button:has-text('임시저장'), button.btn_temp").first
                    if temp_btn.is_visible(timeout=4000):
                        # 저장 요청(POST /manage/drafts)의 성공 응답을 확인한 뒤에만 종료
                        save_ok = {"done": False}

                        def _on_response(resp):
                            try:
                                if resp.request.method == "POST" and resp.url.rstrip("/").endswith("/manage/drafts") and resp.status == 200:
                                    save_ok["done"] = True
                            except Exception:
                                pass

                        def _draft_count() -> int:
                            try:
                                return int(page.locator("a.count").first.inner_text(timeout=2000).strip() or 0)
                            except Exception:
                                return -1

                        count_before = _draft_count()
                        page.on("response", _on_response)
                        try:
                            page.evaluate("() => { if (window.tinymce && tinymce.activeEditor) tinymce.activeEditor.save(); }")
                        except Exception:
                            pass
                        temp_btn.click()
                        waited = 0
                        retried = False
                        while waited < 40 and not save_ok["done"]:
                            # time.sleep은 Playwright 이벤트를 처리하지 못하므로 wait_for_timeout 사용
                            page.wait_for_timeout(1000)
                            waited += 1
                            count_now = _draft_count()
                            if count_before >= 0 and count_now > count_before:
                                save_ok["done"] = True
                                break
                            if waited == 12 and not retried:
                                print("⏳ 저장 응답이 없어 [임시저장]을 한 번 더 누릅니다...")
                                temp_btn.click()
                                retried = True
                        page.remove_listener("response", _on_response)
                        if not save_ok["done"]:
                            raise Exception("임시저장 완료 응답을 확인하지 못했습니다. 티스토리 임시저장함을 직접 확인해 주세요.")
                        time.sleep(2)
                        print(f"🎉 임시저장이 성공적으로 완료되었습니다! ({waited}초)")
                        result["success"] = True
                        result["message"] = "티스토리 편집기에 제목, 본문, 사진, 태그가 입력되고 [임시저장] 완료되었습니다."
                    else:
                        raise Exception("임시저장 버튼을 찾을 수 없습니다.")

                elif action == "CONFIRM_BEFORE_PUBLISH":
                    print("👀 [정책: 최종 확인 대기] 브라우저 창에 글이 모두 입력되었습니다.")
                    print("사용자가 직접 브라우저에서 최종 확인 후 [완료/발행]을 누를 수 있도록 창을 유지합니다.")
                    result["success"] = True
                    result["message"] = "에디터 입력 완료. 브라우저에서 직접 최종 검토 후 발행하세요."
                    # 사용자가 검토할 수 있도록 브라우저를 닫지 않고 대기
                    input("\n👉 브라우저에서 확인을 마치셨다면 엔터(Enter) 키를 눌러 세션을 종료하세요...")

                elif action == "PUBLISH":
                    print("🚀 [정책: 공개 발행] 발행 레이어 호출 및 공개 발행 실행...")
                    publish_layer_btn = page.locator("button.btn_complete, button:has-text('완료'), #publish-layer-btn").first
                    if publish_layer_btn.is_visible(timeout=5000):
                        publish_layer_btn.click()
                        time.sleep(2)
                        
                        # 공개 라디오 선택
                        public_radio = page.locator("label:has-text('공개'), input[value='public']").first
                        if public_radio.is_visible(timeout=3000):
                            public_radio.click()
                            time.sleep(1)

                        # 최종 발행 버튼 클릭
                        final_pub_btn = page.locator("button:has-text('발행'), button#publish-btn, button.btn_publish").first
                        if final_pub_btn.is_visible(timeout=4000):
                            final_pub_btn.click()
                            time.sleep(4)
                            result["success"] = True
                            result["post_url"] = page.url
                            result["message"] = "공개 발행이 완료되었습니다."
                            print(f"🎉 티스토리 글 공개 발행 성공! URL: {page.url}")
                        else:
                            raise Exception("최종 발행 버튼을 찾을 수 없습니다.")
                    else:
                        raise Exception("완료/발행 버튼을 찾을 수 없습니다.")

            except Exception as e:
                import traceback
                traceback.print_exc()
                try:
                    shot = os.path.join(BASE_DIR, "tistory_last_error.png")
                    page.screenshot(path=shot)
                    layers = page.evaluate("""() => Array.from(document.querySelectorAll('[class*=layer],[class*=modal],[class*=toast],[class*=alert],[class*=popup],[role=dialog]')).filter(e => e.offsetParent !== null).map(e => e.className.slice(0,40) + '|' + e.innerText.trim().slice(0,80))""")
                    log(f"[DEBUG] 실패 시점 화면 저장: {shot} / 열린 레이어: {layers}")
                except Exception:
                    pass
                result["success"] = False
                result["error"] = str(e)
                result["message"] = f"자동 등록 실패: {str(e)}"
                print(f"❌ 오류 발생: {e}")
            finally:
                result["end_time"] = datetime.now().isoformat()
                # 로그인 상태라면 쿠키를 저장 (다음 실행에서 재로그인 방지)
                try:
                    if "login" not in page.url and "accounts.kakao.com" not in page.url:
                        with open(COOKIE_FILE, "w", encoding="utf-8") as f:
                            json.dump(context.cookies(), f, ensure_ascii=False)
                except Exception:
                    pass
                if action != "CONFIRM_BEFORE_PUBLISH":
                    try:
                        if browser:
                            browser.close()
                        elif context:
                            context.close()
                    except Exception:
                        pass
                    log("[OK] 브라우저 세션이 안전하게 종료되었습니다.")

        return result

# 로그인 진행 상태 추적 변수
_LOGIN_STATE: Dict[str, Any] = {
    "status": "idle",  # "idle" | "in_progress" | "success" | "timeout" | "error"
    "message": "",
    "updated_at": 0
}

def get_login_state() -> Dict[str, Any]:
    """현재 티스토리 로그인 상태 반환"""
    has_cookie = os.path.exists(COOKIE_FILE)
    cookie_mtime = os.path.getmtime(COOKIE_FILE) if has_cookie else 0
    # 최근 5분 이내에 쿠키 파일이 새로 저장되었다면 자동으로 success 전환
    if has_cookie and (time.time() - cookie_mtime < 300) and _LOGIN_STATE.get("status") == "in_progress":
        _LOGIN_STATE["status"] = "success"
        _LOGIN_STATE["message"] = "카카오 로그인이 완료되어 세션이 저장되었습니다!"

    return {
        **_LOGIN_STATE,
        "has_cookie": has_cookie,
        "cookie_mtime": cookie_mtime
    }

def launch_login_browser_background(blog_name: str = DEFAULT_BLOG) -> Dict[str, Any]:
    """웹 대시보드 버튼 클릭 시 BAT 파일 없이 모니터 화면에 크롬 로그인 창을 즉시 팝업 실행"""
    global _LOGIN_STATE
    _LOGIN_STATE["status"] = "in_progress"
    _LOGIN_STATE["message"] = "모니터 화면에 크롬 로그인 창을 열었습니다. 카카오 로그인을 진행해 주세요..."
    _LOGIN_STATE["updated_at"] = time.time()

    # 1. 이전 잔여 락 정리
    try:
        from login_helper import cleanup_profile_locks
        cleanup_profile_locks()
    except Exception:
        pass

    # 2. Windows 대화형 셸을 통해 모니터 화면에 즉시 팝업 실행
    helper_script = os.path.join(BASE_DIR, "login_helper.py")
    subprocess.Popen(["cmd.exe", "/c", "start", "python", helper_script], shell=False)

    return {
        "success": True,
        "status": "in_progress",
        "message": "카카오 로그인 브라우저를 모니터 화면에 실행했습니다. 열린 창에서 로그인해 주세요."
    }

# CLI 테스트용 실행 함수
def launch_login_browser(blog_name: str = DEFAULT_BLOG) -> Dict[str, Any]:
    """사용자가 사전에 카카오 로그인을 진행할 수 있도록 정식 크롬을 화면에 띄우고 로그인 완료 시 세션 쿠키 저장"""
    # 1. 정식 크롬을 화면 전면에 띄움 (CDP 9223)
    ensure_tistory_chrome(blog_name)
    
    logged_in = False
    try:
        with sync_playwright() as p:
            log(f"[CONNECT] [Tistory Bot] Chrome DevTools Protocol로 연결합니다 ({TISTORY_CDP_URL})...")
            browser = p.chromium.connect_over_cdp(TISTORY_CDP_URL)
            context = browser.contexts[0] if browser.contexts else browser.new_context()

            # 이전에 저장해 둔 로그인 쿠키 복원
            if os.path.exists(COOKIE_FILE):
                try:
                    with open(COOKIE_FILE, "r", encoding="utf-8") as f:
                        context.add_cookies(json.load(f))
                except Exception:
                    pass

            force_foreground_window()

            # 5분 동안 사용자 로그인 완료 대기
            start_time = time.time()
            last_fg_time = time.time()
            while time.time() - start_time < 300:
                if time.time() - last_fg_time > 4:
                    force_foreground_window()
                    last_fg_time = time.time()

                time.sleep(2)
                for pg in context.pages:
                    try:
                        curr_url = pg.url
                    except Exception:
                        continue
                    if f"{blog_name}.tistory.com/manage" in curr_url:
                        logged_in = True
                        try:
                            with open(COOKIE_FILE, "w", encoding="utf-8") as f:
                                json.dump(context.cookies(), f, ensure_ascii=False)
                            log("[OK] 티스토리 사전 로그인 세션 쿠키가 저장되었습니다.")
                        except Exception:
                            pass
                        break
                if logged_in:
                    break

            try:
                browser.close()
            except Exception:
                pass
    except Exception as err:
        log(f"[WARN] 로그인 모니터링 중 예외(무시): {err}")

    return {
        "success": logged_in,
        "message": "카카오 로그인이 완료되어 세션이 저장되었습니다." if logged_in else "로그인 대기 시간이 초과되었습니다."
    }

def post_content(
    blog_name: str = DEFAULT_BLOG,
    title: str = "",
    content_html: str = "",
    tags: Optional[List[str]] = None,
    category: Optional[str] = None,
    action: str = "TEMP_SAVE",
    meta_description: str = "",
    headless: bool = False
) -> Dict[str, Any]:
    """모듈 레벨 편의 함수: TistoryAutomator 인스턴스를 생성하여 post_content 호출"""
    automator = TistoryAutomator(blog_name=blog_name, headless=headless)
    return automator.post_content(
        title=title,
        content_html=content_html,
        tags=tags,
        category=category,
        action=action,
        meta_description=meta_description
    )

if __name__ == "__main__":
    print("=" * 60)
    print("🤖 티스토리 브라우저 자동 등록 봇 테스트 러너")
    print("=" * 60)

    # 테스트 샘플 데이터
    sample_title = "[테스트] AI SEO Manager 자동 등록 테스트 원고"
    sample_html = """
    <h2>AI SEO Manager 브라우저 자동화 테스트</h2>
    <p>안녕하세요! 이 글은 AI SEO Manager 브라우저 자동화 봇에 의해 생성 및 등록된 테스트 글입니다.</p>
    <figure style="margin: 20px 0; text-align: center;">
      <img src="https://via.placeholder.com/600x350.png?text=AI+SEO+Manager+Tistory+Bot" style="border-radius: 12px; max-width: 100%;" />
      <figcaption style="font-size: 13px; color: #888; margin-top: 8px;">📷 자동 등록 테스트 이미지</figcaption>
    </figure>
    <p>Playwright를 활용하여 로그인 세션을 보존하고, 에디터에 제목과 본문, 태그를 안전하게 주입합니다.</p>
    """
    sample_tags = ["AISEO", "티스토리자동화", "블로그운영"]

    automator = TistoryAutomator(blog_name="s-elegant", headless=False)
    
    # 1단계 안전 정책: 임시저장(TEMP_SAVE) 모드로 동작
    res = automator.post_content(
        title=sample_title,
        content_html=sample_html,
        tags=sample_tags,
        category="맛집/카페",
        action="TEMP_SAVE"
    )

    print("\n[실행 결과 리포트]")
    print(json.dumps(res, ensure_ascii=False, indent=2))
