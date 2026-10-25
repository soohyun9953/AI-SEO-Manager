"""
Claude.ai 웹 브라우저 자동화 봇 (Claude Web Automation Bot)
- 엔진: Playwright (Chromium Persistent Context)
- 브라우저 프로필 영속화: ./claude_browser_profile (로그인 1회 시 세션 영구 보존)
- 주요 기능:
  1. Claude.ai 웹 접속 및 로그인 감지 (최초 1회 로그인 대기)
  2. 다녀온 곳 정보 및 프롬프트 주입
  3. 사진 파일(이미지) 자동 첨부
  4. 답변 스트리밍 완료 감지 및 원고 텍스트/마크다운 추출
  5. 제목, 본문(HTML/마크다운), 태그 파싱
"""

import os
import sys
import time
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional, List
from playwright.sync_api import sync_playwright, BrowserContext, Page

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLAUDE_PROFILE_DIR = os.path.join(BASE_DIR, "claude_browser_profile")
CLAUDE_NEW_URL = "https://claude.ai/new"

class ClaudeWebAutomator:
    def __init__(self, headless: bool = False, timeout_login: int = 180):
        self.headless = headless
        self.profile_dir = CLAUDE_PROFILE_DIR
        self.timeout_login = timeout_login
        os.makedirs(self.profile_dir, exist_ok=True)

    def _wait_for_user_login(self, page: Page) -> bool:
        """사용자가 Claude.ai 로그인을 완료할 때까지 대기"""
        print("\n🔑 [Claude Bot] Claude.ai 로그인이 필요합니다. 브라우저 창에서 로그인을 진행해주세요...")
        start_time = time.time()
        while time.time() - start_time < self.timeout_login:
            curr_url = page.url
            # 로그인 완료 후 new 채팅 페이지나 대화방 페이지로 진입했는지 확인
            if "claude.ai" in curr_url and "login" not in curr_url and "signup" not in curr_url:
                # 입력창 또는 환영 문구가 있는지 확인
                try:
                    input_box = page.locator("div[contenteditable='true'], div.ProseMirror, textarea").first
                    if input_box.is_visible(timeout=2000):
                        print("✅ [Claude Bot] 로그인 확인 완료! Claude 채팅 화면에 진입했습니다.")
                        time.sleep(2)
                        return True
                except Exception:
                    pass
            time.sleep(2)
        print("❌ [Claude Bot] 로그인 대기 시간(3분)이 초과되었습니다.")
        return False

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
        photos_data: Optional[List[Dict[str, str]]] = None
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
                photos_data
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
        photos_data: Optional[List[Dict[str, str]]] = None
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

        # 프롬프트 조립
        prompt = self._build_prompt(
            place_name=place_name,
            category=category,
            location=location,
            place_url=place_url,
            key_info=key_info,
            special_notes=special_notes,
            rating=rating,
            photo_count=len(photo_paths) if photo_paths else 0,
            photo_captions=photo_captions
        )

        with sync_playwright() as p:
            print(f"\n🚀 [Claude Bot] 크롬 브라우저를 시작합니다... (프로필: {self.profile_dir})")
            context: BrowserContext = p.chromium.launch_persistent_context(
                user_data_dir=self.profile_dir,
                headless=self.headless,
                viewport={"width": 1366, "height": 920},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized"
                ],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )

            page = context.pages[0] if context.pages else context.new_page()
            page.on("dialog", lambda dialog: dialog.accept())

            try:
                print(f"🌐 [Claude Bot] Claude 새 대화 페이지로 이동: {CLAUDE_NEW_URL}")
                page.goto(CLAUDE_NEW_URL, wait_until="domcontentloaded", timeout=60000)
                time.sleep(3)

                # 1. 로그인 여부 확인
                current_url = page.url
                if "login" in current_url or "signup" in current_url:
                    logged_in = self._wait_for_user_login(page)
                    if not logged_in:
                        raise Exception("Claude.ai 로그인이 완료되지 않아 작업을 중단합니다.")
                
                # 새 대화 화면이 아닐 경우 이동
                if "/new" not in page.url and "/chat/" not in page.url:
                    page.goto(CLAUDE_NEW_URL, wait_until="domcontentloaded", timeout=60000)
                    time.sleep(3)

                # 안내 팝업이나 모달(Acknowledge, Got it, 닫기 등)이 떠있을 경우 닫기 처리
                try:
                    dismiss_buttons = page.locator("button:has-text('Got it'), button:has-text('확인'), button:has-text('Dismiss'), button:has-text('Continue'), button[aria-label='Close']").all()
                    for d_btn in dismiss_buttons:
                        if d_btn.is_visible(timeout=1000):
                            d_btn.click()
                            time.sleep(0.5)
                except Exception:
                    pass

                # 2. 사진 파일 첨부 (있는 경우)
                if photo_paths and len(photo_paths) > 0:
                    valid_files = [f for f in photo_paths if os.path.exists(f)]
                    if valid_files:
                        print(f"📷 [Claude Bot] 이미지 파일 {len(valid_files)}장 첨부 중...")
                        file_input = page.locator("input[type='file']").first
                        try:
                            # 숨겨진 파일 인풋에 직접 전달
                            file_input.set_input_files(valid_files, timeout=10000)
                            print(f"✅ [Claude Bot] 이미지 파일 첨부 완료, 업로드 대기 중...")
                            time.sleep(3 + len(valid_files) * 2) # 파일 업로드 썸네일 대기
                        except Exception as file_e:
                            print(f"⚠️ [Claude Bot] 파일 첨부 중 에러 (계속 진행): {file_e}")

                # 3. 텍스트 입력창 찾기
                print("✍️ [Claude Bot] 메시지 입력창 탐색 중...")
                input_selector = None
                for sel in [
                    "div[contenteditable='true'].ProseMirror",
                    "div[contenteditable='true']",
                    "div.ProseMirror",
                    "textarea[placeholder*='Reply']",
                    "textarea[placeholder*='How can Claude help']",
                    "textarea"
                ]:
                    if page.locator(sel).first.is_visible(timeout=3000):
                        input_selector = sel
                        break

                if not input_selector:
                    raise Exception("Claude 입력창을 찾을 수 없습니다. UI가 변경되었거나 로딩 중입니다.")

                input_element = page.locator(input_selector).first
                input_element.click()
                time.sleep(0.5)

                # 텍스트 주입 (클립보드 방식 및 DOM 조작을 통한 안전한 대량 텍스트 삽입)
                print("📝 [Claude Bot] 프롬프트 텍스트 주입 중...")
                page.evaluate("""
                    ([selector, text]) => {
                        const el = document.querySelector(selector);
                        if (!el) return;
                        if (el.tagName.toLowerCase() === 'textarea') {
                            el.value = text;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            el.focus();
                            // ProseMirror 및 ContentEditable 환경을 위한 처리
                            document.execCommand('selectAll', false, null);
                            document.execCommand('insertText', false, text);
                        }
                    }
                """, [input_selector, prompt])
                time.sleep(1.5)

                # 내용이 제대로 채워졌는지 검증, 누락 시 keyboard 방식 보완
                inserted_text = input_element.inner_text()
                if not inserted_text or len(inserted_text.strip()) < 10:
                    print("⚠️ 텍스트 직접 입력 보완 실행...")
                    input_element.click()
                    page.keyboard.insert_text(prompt)
                    time.sleep(1)

                # 4. 전송 버튼 클릭
                print("🚀 [Claude Bot] 전송 버튼 클릭...")
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
                            print(f"✅ 전송 버튼 클릭 완료 ({s_sel})")
                            break
                    except Exception:
                        continue

                if not send_clicked:
                    # 대체: Enter 키 전송
                    print("⚠️ 전송 버튼 클릭 실패, Enter 키 전송 시도...")
                    input_element.press("Enter")

                # 5. 답변 생성 대기 (스트리밍 완료 감지)
                print("⏳ [Claude Bot] 답변 생성 중... 생성이 완료될 때까지 대기합니다...")
                time.sleep(5)

                max_wait_seconds = 180
                poll_interval = 2
                elapsed = 0
                last_content_len = 0
                unchanged_count = 0

                while elapsed < max_wait_seconds:
                    time.sleep(poll_interval)
                    elapsed += poll_interval

                    # 중지 버튼(Stop) 확인
                    stop_btn = page.locator("button[aria-label*='Stop'], button:has-text('Stop')").first
                    is_streaming = False
                    try:
                        is_streaming = stop_btn.is_visible(timeout=1000)
                    except Exception:
                        is_streaming = False

                    # 마지막 어시스턴트 메시지 길이 체크
                    msg_text = self._get_latest_assistant_message(page)
                    curr_len = len(msg_text.strip())

                    if curr_len > 100:
                        if curr_len == last_content_len:
                            unchanged_count += 1
                        else:
                            unchanged_count = 0
                            last_content_len = curr_len

                    # 중지 버튼이 없고, 텍스트 길이가 200자 이상이며 2회(4초) 이상 변경이 없으면 완료로 판정
                    if not is_streaming and curr_len > 200 and unchanged_count >= 2:
                        print("🎉 [Claude Bot] 답변 생성 완료 감지!")
                        break

                    if elapsed % 10 == 0:
                        print(f"   생성 진행 중... ({elapsed}초 경과, 현재 글자 수: {curr_len}자)")

                # 6. 최종 텍스트 추출 및 파싱
                full_raw_text = self._get_latest_assistant_message(page)
                if not full_raw_text or len(full_raw_text.strip()) < 100:
                    raise Exception("Claude로부터 생성된 원고 텍스트를 추출하지 못했습니다.")

                parsed = self._parse_claude_response(full_raw_text, place_name, category, photos=photos_data)
                result.update(parsed)
                result["success"] = True
                result["end_time"] = datetime.now().isoformat()
                print("✅ [Claude Bot] 원고 추출 및 구조화 성공!")

            except Exception as e:
                print(f"❌ [Claude Bot] 에러 발생: {e}")
                result["error"] = str(e)
            finally:
                context.close()

        return result

    def _get_latest_assistant_message(self, page: Page) -> str:
        """가장 마지막 어시스턴트(Claude) 메시지 텍스트 추출"""
        try:
            # 다양한 Claude DOM 버전에 대응
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
            
            # fallback: 마지막 markdown 컨테이너
            all_prose = page.locator("div.prose, div[class*='font-user-message'] ~ div").all()
            if all_prose:
                return all_prose[-1].inner_text()
        except Exception as e:
            print(f"텍스트 추출 중 경미한 에러: {e}")
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
        photo_captions: Optional[List[str]] = None
    ) -> str:
        """Claude에게 전달할 고수익/SEO 최적화 블로그 원고 작성 프롬프트"""
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
클릭률(CTR)과 검색 노출을 극대화하는 매력적인 제목 (예: [{location}] {place_name} 솔직 방문 후기! 주요 특징과 꿀팁 총정리)

[메타설명]
검색엔진 스니펫용 1~2줄 요약 (80~120자 내외)

[본문]
1. 톤 앤 매너:
   - 생생한 E-E-A-T 기반의 친근하고 다정한 어조(~했어요, ~더라고요, ~추천해요).
   - 기계적인 AI 느낌 없이 손님/여행자의 입장에서 느낀 솔직한 장단점과 팁 기술.
   - 모바일 가독성을 위해 2~3줄마다 빈 줄(줄바꿈) 적용.
2. 구성:
   - 도입부: 방문 동기와 첫인상
   - 소제목 1 (위치, 인테리어/분위기, 주차 및 웨이팅 꿀팁)
   - 소제목 2 (핵심 특징, 대표 메뉴/체험 솔직 평가)
   - 소제목 3 (한눈에 보는 핵심 요약 - 마크다운 표 Table로 정리: 장소명, 위치, 주요 가격/메뉴, 편의시설, 총점)
   - 마무리 (이런 분께 추천, 재방문 의사, 최종 한 줄 평)
3. 사진 슬롯 마커 배치:
{photo_slots_guide}

[태그]
#지역명, #장소명, #카테고리, #내돈내산 등 검색 유입용 태그 10~15개를 쉼표로 구분하여 작성 (예: #성수동맛집, #성수핫플, #내돈내산)

이제 위 지침에 맞추어 전문 블로그 원고를 정성껏 작성해주세요!
""".strip()

    def _parse_claude_response(self, text: str, place_name: str, category: str, photos: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """Claude의 응답 텍스트를 제목, 본문, 태그 등으로 분리"""
        title = f"{place_name} 솔직 방문 후기"
        meta_desc = ""
        tags = []
        article = text

        # 1. 제목 추출
        title_match = re.search(r'\[제목\]\s*(.*?)(?=\n\n|\[메타설명\]|\[본문\]|$)', text, re.DOTALL)
        if title_match:
            title = title_match.group(1).strip().replace("#", "").strip()

        # 2. 메타설명 추출
        meta_match = re.search(r'\[메타설명\]\s*(.*?)(?=\n\n|\[본문\]|$)', text, re.DOTALL)
        if meta_match:
            meta_desc = meta_match.group(1).strip()

        # 3. 태그 추출
        tags_match = re.search(r'\[태그\]\s*(.*?)$', text, re.DOTALL)
        if tags_match:
            raw_tags = tags_match.group(1).strip()
            # 쉼표나 공백, # 기준으로 태그 분리
            t_list = re.findall(r'#?([가-힣a-zA-Z0-9_\-]+)', raw_tags)
            tags = [t for t in t_list if t and t.lower() not in ["태그", "tag"]]

        if not tags:
            tags = [place_name, category, "방문후기", "내돈내산", "솔직후기"]

        # 4. 본문 분리
        body_match = re.search(r'\[본문\]\s*(.*?)(?=\n\n\[태그\]|\[태그\]|$)', text, re.DOTALL)
        if body_match:
            article = body_match.group(1).strip()
        else:
            # 라벨이 없는 경우 제목 부분 등을 제거한 전체 텍스트
            cleaned = text
            if title_match:
                cleaned = cleaned.replace(title_match.group(0), "")
            if tags_match:
                cleaned = cleaned.replace(tags_match.group(0), "")
            article = cleaned.strip()

        # 5. HTML 변환
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

        # 카드 뷰 및 스타일 입히기
        html = html.replace('<h2>', '<h2 style="font-size: 20px; font-weight: bold; border-left: 4px solid #3b82f6; padding-left: 12px; margin-top: 35px; margin-bottom: 15px; color: #1e293b;">')
        html = html.replace('<h3>', '<h3 style="font-size: 17px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #334155;">')
        html = html.replace('<table>', '<table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px; text-align: left; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">')
        html = html.replace('<th>', '<th style="background-color: #f1f5f9; padding: 12px; font-weight: 600; border-bottom: 1px solid #cbd5e1; color: #334155;">')
        html = html.replace('<td>', '<td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">')
        html = html.replace('<p>', '<p style="line-height: 1.85; margin-bottom: 16px; color: #334155; font-size: 15px;">')

        # 사진 슬롯 치환
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
                        # 슬롯 마커가 없으면 적절한 위치(소제목 뒤)에 보완 삽입
                        html += img_card
                else:
                    html = html.replace(slot_marker, "")
        
        # 잔여 마커 제거
        html = re.sub(r'<!--\s*\[PHOTO_\d+_SLOT\]\s*-->', '', html)

        return html
