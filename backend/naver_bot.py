"""
네이버 블로그 임시저장 봇 (베타)
- Claude 봇과 같은 정식 Chrome(디버깅 포트 9222, 로그인 세션 영구 보존)을 재사용한다.
- 글쓰기 화면(SmartEditor ONE)에 제목, 본문(소제목·문단), 사진을 입력하고 [저장]까지 실행한다.
- 발행은 하지 않는다. 임시저장된 글을 네이버에서 확인한 뒤 직접 발행한다.
- 태그는 임시저장 단계에서는 입력할 수 없어(발행 설정에서 입력), 화면의 '태그 복사'를 사용한다.

주의: 네이버 에디터 화면 구조는 예고 없이 바뀔 수 있다. 실패하면 backend/data/naver_debug.png 에
화면이 저장되고 로그에 단계별 상태가 남는다.
"""

import os
import re
import time
import concurrent.futures
from typing import Any, Dict, List, Optional, Tuple

from playwright.sync_api import sync_playwright, Page, Frame

from claude_bot import ensure_debug_chrome, CHROME_CDP_URL, log

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEBUG_SHOT = os.path.join(BASE_DIR, "data", "naver_debug.png")

NAVER_WRITE_URL = "https://blog.naver.com/{blog_id}?Redirect=Write"
LOGIN_TIMEOUT_SECONDS = 300
EDITOR_TIMEOUT_SECONDS = 60
PHOTO_MARKER = re.compile(r"<!--\s*\[PHOTO_(\d+)_SLOT\]\s*-->")


def split_by_photo_markers(md: str) -> List[Tuple[str, Any]]:
    """마크다운을 ('text', 본문조각) / ('photo', 사진번호) 순서 목록으로 나눈다"""
    parts = PHOTO_MARKER.split(md or "")
    segments: List[Tuple[str, Any]] = []
    for idx, part in enumerate(parts):
        if idx % 2 == 0:
            if part.strip():
                segments.append(("text", part.strip()))
        else:
            segments.append(("photo", int(part)))
    return segments


def markdown_to_paste_html(md: str) -> str:
    """에디터에 붙여넣을 HTML (소제목·굵게·목록·인용문 유지)"""
    import markdown
    return markdown.markdown(md, extensions=["nl2br"])


def markdown_to_plain(md: str) -> str:
    """HTML 붙여넣기가 통하지 않을 때 쓰는 일반 텍스트"""
    text = re.sub(r"^#{1,6}\s*", "", md, flags=re.MULTILINE)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)
    return text.strip()


class NaverAutomator:
    def __init__(self, blog_id: str):
        self.blog_id = blog_id.strip()

    # ------------------------------------------------------------------ 공개 API
    def save_draft(self, title: str, article_md: str, photo_paths: Optional[List[str]] = None) -> Dict[str, Any]:
        """제목·본문·사진을 네이버 글쓰기 화면에 입력하고 임시저장 (독립 스레드에서 실행)"""
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(self._run, title, article_md, photo_paths or []).result()

    # ------------------------------------------------------------------ 내부 구현
    def _run(self, title: str, article_md: str, photo_paths: List[str]) -> Dict[str, Any]:
        ensure_debug_chrome()
        with sync_playwright() as p:
            log(f"[CONNECT] [Naver Bot] Chrome에 연결합니다 ({CHROME_CDP_URL})...")
            browser = p.chromium.connect_over_cdp(CHROME_CDP_URL)
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            try:
                context.grant_permissions(["clipboard-read", "clipboard-write"], origin="https://blog.naver.com")
            except Exception as perm_err:
                log(f"[WARN] [Naver Bot] 클립보드 권한 설정 실패(대체 방식 사용): {perm_err}")

            page = context.new_page()
            page.on("dialog", lambda dialog: dialog.accept())
            try:
                url = NAVER_WRITE_URL.format(blog_id=self.blog_id)
                log(f"[NAVIGATE] [Naver Bot] 글쓰기 화면으로 이동: {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                self._ensure_logged_in(page, url)

                frame = self._find_editor_frame(page)
                self._dismiss_popups(frame)
                self._fill_title(page, frame, title)
                self._fill_body(page, frame, article_md, photo_paths)
                return self._click_save(page, frame)
            except Exception as e:
                log(f"[ERROR] [Naver Bot] {e}")
                try:
                    os.makedirs(os.path.dirname(DEBUG_SHOT), exist_ok=True)
                    page.screenshot(path=DEBUG_SHOT)
                    log(f"[DEBUG] [Naver Bot] 실패 화면 저장: {DEBUG_SHOT}")
                except Exception:
                    pass
                return {"success": False, "error": str(e)}

    def _ensure_logged_in(self, page: Page, write_url: str) -> None:
        """네이버 로그인 화면이면 사용자가 로그인할 때까지 대기"""
        if "nid.naver.com" not in page.url:
            return
        log("[LOGIN] [Naver Bot] 열린 크롬 창에서 네이버 로그인을 진행해 주세요 (5분 대기)...")
        try:
            page.bring_to_front()
        except Exception:
            pass
        deadline = time.time() + LOGIN_TIMEOUT_SECONDS
        while time.time() < deadline:
            if "nid.naver.com" not in page.url:
                break
            time.sleep(2)
        else:
            raise Exception("네이버 로그인 대기 시간(5분)이 초과되었습니다.")
        if "blog.naver.com" not in page.url:
            page.goto(write_url, wait_until="domcontentloaded", timeout=60000)
        log("[OK] [Naver Bot] 로그인 확인 완료")

    def _find_editor_frame(self, page: Page) -> Frame:
        """제목 입력칸(.se-title-text)이 있는 프레임을 찾는다 (iframe 구조와 단일 페이지 구조 모두 대응)"""
        log("[WAIT] [Naver Bot] 에디터 로딩 대기...")
        deadline = time.time() + EDITOR_TIMEOUT_SECONDS
        while time.time() < deadline:
            for frame in page.frames:
                try:
                    if frame.locator(".se-title-text").count() > 0:
                        log(f"[OK] [Naver Bot] 에디터 프레임 발견: {frame.url[:80]}")
                        return frame
                except Exception:
                    continue
            time.sleep(1)
        raise Exception("네이버 글쓰기 에디터를 찾지 못했습니다. 블로그 아이디가 맞는지, 로그인되어 있는지 확인하세요.")

    def _dismiss_popups(self, frame: Frame) -> None:
        """'작성 중인 글이 있습니다' 안내와 도움말 패널을 닫는다"""
        try:
            if frame.get_by_text("작성 중인 글이 있습니다").count() > 0:
                log("[POPUP] [Naver Bot] 이전 작성 글 안내 → 새로 작성")
                frame.locator(".se-popup-button-cancel").first.click(timeout=3000)
                time.sleep(1)
        except Exception as e:
            log(f"[WARN] [Naver Bot] 이전 글 안내 처리 건너뜀: {e}")
        try:
            close = frame.locator(".se-help-panel-close-button")
            if close.count() > 0 and close.first.is_visible():
                close.first.click(timeout=2000)
        except Exception:
            pass

    def _fill_title(self, page: Page, frame: Frame, title: str) -> None:
        log("[EDIT] [Naver Bot] 제목 입력")
        el = frame.locator(".se-title-text").first
        el.click()
        time.sleep(0.3)
        page.keyboard.insert_text(title)
        time.sleep(0.5)

    def _body_length(self, frame: Frame) -> int:
        try:
            return len(frame.locator(".se-main-container").first.inner_text())
        except Exception:
            return 0

    def _focus_body_end(self, page: Page, frame: Frame) -> None:
        """본문의 마지막 문단에 커서를 둔다"""
        try:
            paragraphs = frame.locator(".se-component.se-text .se-text-paragraph")
            if paragraphs.count() > 0:
                paragraphs.last.click()
                page.keyboard.press("Control+End")
                return
        except Exception:
            pass
        page.keyboard.press("Enter")

    def _paste_html(self, page: Page, frame: Frame, md: str) -> None:
        """본문 조각을 서식 그대로 붙여넣는다: 실제 클립보드 → 붙여넣기 이벤트 → 일반 텍스트 순으로 시도"""
        html = markdown_to_paste_html(md)
        plain = markdown_to_plain(md)

        before = self._body_length(frame)
        try:
            frame.evaluate(
                """async ([html, plain]) => {
                    const item = new ClipboardItem({
                        'text/html': new Blob([html], {type: 'text/html'}),
                        'text/plain': new Blob([plain], {type: 'text/plain'})
                    });
                    await navigator.clipboard.write([item]);
                }""",
                [html, plain],
            )
            page.keyboard.press("Control+V")
            time.sleep(1.2)
        except Exception as e:
            log(f"[WARN] [Naver Bot] 클립보드 붙여넣기 실패: {e}")
        if self._body_length(frame) > before:
            return

        log("[WARN] [Naver Bot] 붙여넣기 반영 안 됨 → 붙여넣기 이벤트 방식 시도")
        try:
            frame.evaluate(
                """([html, plain]) => {
                    const target = document.activeElement || document.body;
                    const dt = new DataTransfer();
                    dt.setData('text/html', html);
                    dt.setData('text/plain', plain);
                    target.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
                }""",
                [html, plain],
            )
            time.sleep(1.2)
        except Exception as e:
            log(f"[WARN] [Naver Bot] 이벤트 방식 실패: {e}")
        if self._body_length(frame) > before:
            return

        log("[WARN] [Naver Bot] 서식 붙여넣기 실패 → 일반 텍스트로 입력 (소제목 서식은 직접 지정 필요)")
        page.keyboard.insert_text(plain)
        time.sleep(0.8)

    def _upload_photo(self, page: Page, frame: Frame, path: str) -> bool:
        """사진 버튼으로 파일을 업로드하고, 사진 컴포넌트가 늘어날 때까지 기다린다"""
        if not os.path.exists(path):
            log(f"[WARN] [Naver Bot] 사진 파일 없음: {path}")
            return False
        before = frame.locator(".se-component.se-image").count()
        try:
            button = frame.locator("button.se-image-toolbar-button, button[data-name='image']").first
            with page.expect_file_chooser(timeout=10000) as chooser:
                button.click()
            chooser.value.set_files(path)
        except Exception as e:
            log(f"[WARN] [Naver Bot] 사진 업로드 시작 실패: {e}")
            return False
        deadline = time.time() + 40
        while time.time() < deadline:
            if frame.locator(".se-component.se-image").count() > before:
                time.sleep(1)
                return True
            time.sleep(0.5)
        log("[WARN] [Naver Bot] 사진 업로드 완료를 확인하지 못했습니다.")
        return False

    def _fill_body(self, page: Page, frame: Frame, article_md: str, photo_paths: List[str]) -> None:
        segments = split_by_photo_markers(article_md)
        if not segments:
            raise Exception("입력할 본문이 비어 있습니다.")
        log(f"[EDIT] [Naver Bot] 본문 입력 (구간 {len(segments)}개, 사진 {len(photo_paths)}장)")

        # 제목 입력 후 본문 영역으로 이동
        self._focus_body_end(page, frame)
        failed_photos = 0
        for kind, value in segments:
            if kind == "text":
                self._paste_html(page, frame, value)
                self._focus_body_end(page, frame)
            else:
                idx = int(value) - 1
                if 0 <= idx < len(photo_paths):
                    if not self._upload_photo(page, frame, photo_paths[idx]):
                        failed_photos += 1
                    self._focus_body_end(page, frame)
        if failed_photos:
            log(f"[WARN] [Naver Bot] 사진 {failed_photos}장은 자동 업로드에 실패했습니다. 직접 올려 주세요.")

    def _click_save(self, page: Page, frame: Frame) -> Dict[str, Any]:
        log("[SAVE] [Naver Bot] 저장 버튼 클릭")
        button = frame.locator("button:text-is('저장')").first
        if button.count() == 0:
            button = page.locator("button:text-is('저장')").first
        button.click(timeout=10000)

        confirmed = False
        for _ in range(8):
            time.sleep(1)
            try:
                if frame.get_by_text("저장되었습니다").count() > 0 or frame.get_by_text("임시저장").count() > 0:
                    confirmed = True
                    break
            except Exception:
                pass
        message = (
            "네이버 임시저장을 완료했습니다. 네이버 글쓰기 화면의 '저장' 목록에서 확인하고 발행하세요."
            if confirmed
            else "저장 버튼을 눌렀습니다. 저장 여부는 열려 있는 네이버 글쓰기 화면 우측 상단 '저장' 개수로 확인해 주세요."
        )
        log(f"[OK] [Naver Bot] {message}")
        return {"success": True, "confirmed": confirmed, "message": message}
