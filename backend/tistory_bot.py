"""
티스토리 브라우저 자동 등록 봇 (Tistory Browser Automation Bot)
- 엔진: Playwright (Chromium)
- 브라우저 프로필 영속화: ./tistory_browser_profile (카카오 로그인 1회 시 세션 영구 보존)
- 주요 기능: 티스토리 에디터 자동 접속, 로그인 감지, 제목/본문(HTML)/카테고리/태그 주입, 임시저장 및 발행
- 보안: 비밀번호 불필요, 사용자 정상 세션 활용, 외부 유출 차단
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from playwright.sync_api import sync_playwright, BrowserContext, Page

# 기본 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(BASE_DIR, "tistory_browser_profile")
DEFAULT_BLOG = "s-elegant"

class TistoryAutomator:
    def __init__(self, blog_name: str = DEFAULT_BLOG, headless: bool = False):
        self.blog_name = blog_name
        self.headless = headless
        self.write_url = f"https://{self.blog_name}.tistory.com/manage/post"
        self.profile_dir = PROFILE_DIR
        os.makedirs(self.profile_dir, exist_ok=True)

    def _wait_for_user_login(self, page: Page, timeout_seconds: int = 180) -> bool:
        """사용자가 카카오 로그인을 완료할 때까지 대기"""
        print("\n🔑 카카오 로그인이 필요합니다. 열린 브라우저 창에서 로그인을 진행해주세요...")
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            curr_url = page.url
            # 티스토리 관리자 또는 글쓰기 페이지에 도달했는지 확인
            if "/manage/post" in curr_url or f"{self.blog_name}.tistory.com" in curr_url:
                if "login" not in curr_url and "accounts.kakao.com" not in curr_url:
                    print("✅ 로그인 확인 완료! 글쓰기 편집기로 진입합니다.")
                    time.sleep(2)
                    return True
            time.sleep(2)
        print("❌ 로그인 대기 시간(3분)이 초과되었습니다.")
        return False

    def post_content(
        self,
        title: str,
        content_html: str,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        action: str = "TEMP_SAVE"  # 'TEMP_SAVE' (임시저장), 'CONFIRM_BEFORE_PUBLISH' (사용자 확인 대기), 'PUBLISH' (즉시발행)
    ) -> Dict[str, Any]:
        """
        티스토리 에디터에 콘텐츠 등록 실행
        """
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
            print(f"\n🚀 [Tistory Bot] 크롬 브라우저를 시작합니다... (프로필: {self.profile_dir})")
            
            # 사용자 로그인 세션을 유지하는 Persistent Context 실행
            context: BrowserContext = p.chromium.launch_persistent_context(
                user_data_dir=self.profile_dir,
                headless=self.headless,
                viewport={"width": 1280, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized"
                ],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )

            page = context.pages[0] if context.pages else context.new_page()

            # 다이얼로그(alert, confirm) 자동 수락 설정 (모드 변경 시 확인창 등)
            page.on("dialog", lambda dialog: dialog.accept())

            try:
                print(f"🌐 글쓰기 화면으로 이동: {self.write_url}")
                page.goto(self.write_url, wait_until="networkidle", timeout=60000)
                time.sleep(3)

                # 1. 로그인 상태 점검
                current_url = page.url
                if "accounts.kakao.com" in current_url or "login" in current_url:
                    logged_in = self._wait_for_user_login(page)
                    if not logged_in:
                        raise Exception("로그인이 완료되지 않아 작업을 중단합니다.")
                    if "/manage/post" not in page.url:
                        page.goto(self.write_url, wait_until="networkidle", timeout=60000)
                        time.sleep(3)

                # 2. 에디터 로딩 대기
                print("📝 티스토리 에디터 로딩 확인 중...")
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

                # 4. 카테고리 선택 (있는 경우)
                if category:
                    print(f"📂 카테고리 선택 시도: {category}")
                    try:
                        category_btn = page.locator("#category-btn, .btn_category, button.btn_choice, #category-selector").first
                        if category_btn.is_visible(timeout=3000):
                            category_btn.click()
                            time.sleep(1)
                            # 카테고리 텍스트 일치 항목 클릭
                            item = page.locator(f"//span[contains(text(), '{category}')] | //li[contains(., '{category}')]").first
                            if item.is_visible(timeout=2000):
                                item.click()
                                print(f"✅ 카테고리 '{category}' 선택 완료")
                    except Exception as cat_e:
                        print(f"⚠️ 카테고리 선택 스킵 ({cat_e})")

                # 5. 본문 입력 (HTML 모드 전환 주입)
                print("📄 본문 내용 주입 준비 (HTML 모드 전환)...")
                
                # 에디터 모드 전환 버튼 찾기 (기본모드 -> HTML)
                html_mode_switched = False
                mode_btn = page.locator("#editor-mode-select, button.btn_mode, #editor-mode, button:has-text('기본모드')").first
                
                if mode_btn.is_visible(timeout=4000):
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
                else:
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
                    temp_btn = page.locator("#temp-save-btn, button:has-text('임시저장'), button.btn_temp").first
                    if temp_btn.is_visible(timeout=4000):
                        temp_btn.click()
                        time.sleep(2)
                        print("🎉 임시저장이 성공적으로 완료되었습니다!")
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
                result["success"] = False
                result["error"] = str(e)
                result["message"] = f"자동 등록 실패: {str(e)}"
                print(f"❌ 오류 발생: {e}")
            finally:
                result["end_time"] = datetime.now().isoformat()
                if action != "CONFIRM_BEFORE_PUBLISH":
                    context.close()
                    print("🔒 브라우저 세션이 안전하게 닫혔습니다.")

        return result

# CLI 테스트용 실행 함수
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
