import os
import re
import sys

# Windows 콘솔 cp949 인코딩 문제 방지
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import base64
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from openai import OpenAI
import traceback
from dotenv import load_dotenv
import requests
import markdown
import time
import json
from datetime import datetime
import database
import auth_guard
import review_seo

load_dotenv()

app = FastAPI(title="AI SEO Manager Pro (Gemini 2.5 Flash Stable)")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 사이트 비밀번호 보호 (APP_PASSWORD 환경변수)
auth_guard.install(app)

# API 키 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# 데이터 스키마








class ContentCreateRequest(BaseModel):
    title: str
    keyword: str
    related_keywords: Optional[str] = ""
    category: Optional[str] = "일반"
    content: str
    content_html: Optional[str] = ""
    meta_description: Optional[str] = ""
    tags: Optional[str] = ""
    thumbnail_url: Optional[str] = ""
    body_images: Optional[List[str]] = []
    reference_urls: Optional[List[str]] = []
    internal_links: Optional[List[str]] = []
    ai_model: Optional[str] = "gemini-2.5-flash"
    status: Optional[str] = "DRAFT"
    scheduled_at: Optional[str] = ""
    tistory_url: Optional[str] = ""
    check_duplicate: Optional[bool] = False

class ContentUpdateRequest(BaseModel):
    title: Optional[str] = None
    keyword: Optional[str] = None
    related_keywords: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    content_html: Optional[str] = None
    meta_description: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_url: Optional[str] = None
    body_images: Optional[List[str]] = None
    reference_urls: Optional[List[str]] = None
    internal_links: Optional[List[str]] = None
    status: Optional[str] = None
    scheduled_at: Optional[str] = None
    published_at: Optional[str] = None
    tistory_url: Optional[str] = None
    queue_order: Optional[int] = None
    change_summary: Optional[str] = "내용 수정"

class StatusUpdateRequest(BaseModel):
    status: str

class BatchStatusUpdateRequest(BaseModel):
    content_ids: List[str]
    status: str

class PublishRecordRequest(BaseModel):
    publish_type: str = "TISTORY_MANUAL"
    status: str = "SUCCESS"
    post_url: Optional[str] = ""
    message: Optional[str] = ""

class ReviewPhotoItem(BaseModel):
    data_url: Optional[str] = ""
    caption: Optional[str] = ""
    name: Optional[str] = ""

class ReviewArticleRequest(BaseModel):
    restaurant_name: str
    location: Optional[str] = ""
    place_url: Optional[str] = ""
    menu_info: Optional[str] = ""
    special_notes: Optional[str] = ""
    rating: Optional[str] = "5.0"
    photos: Optional[List[ReviewPhotoItem]] = []
    adsense_optimize: Optional[bool] = True
    category: Optional[str] = "맛집/카페"
    model_name: Optional[str] = None

class AutoRegisterRequest(BaseModel):
    content_id: str
    publish_action: Optional[str] = "TEMP_SAVE"  # TEMP_SAVE, CONFIRM_BEFORE_PUBLISH, PUBLISH
    blog_name: Optional[str] = "s-elegant"
    force: Optional[bool] = False

class TistoryDirectRegisterRequest(BaseModel):
    title: str
    content_html: str
    tags: List[str] = []
    category: Optional[str] = "맛집/카페"
    blog_name: Optional[str] = "s-elegant"
    action: Optional[str] = "TEMP_SAVE"
    meta_description: Optional[str] = ""

class AnalyticsSettingsRequest(BaseModel):
    site_url: Optional[str] = "https://s-elegant.tistory.com/"
    gsc_connected: Optional[bool] = False
    adsense_connected: Optional[bool] = False
    adsense_account_id: Optional[str] = ""
    gsc_auth_type: Optional[str] = "SERVICE_ACCOUNT"
    service_account_email: Optional[str] = ""

class AnalyticsRecommendRequest(BaseModel):
    page: dict

class WeeklyReportRequest(BaseModel):
    days: Optional[int] = 28

class GoogleAuthExchangeRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = "http://localhost:8765/"

class AutoOptimizeRequest(BaseModel):
    url: str
    title: Optional[str] = ""
    scenario: Optional[str] = "HIGH_IMP_LOW_CTR"
    scenario_label: Optional[str] = "노출 대비 클릭률 저조"
    diagnosis: Optional[str] = ""
    content_text: Optional[str] = None
    queries: Optional[List[dict]] = None

class AutoOptimizeSaveRequest(BaseModel):
    title: str
    html_content: str
    tags: Optional[List[str]] = []
    blog_name: Optional[str] = "s-elegant"





@app.get("/")
async def root():
    return {"message": "AI SEO Manager (Gemini 2.5) is running on port 8002"}

def safe_generate_content(api_key_str, prompt, config=None, is_json=False, target_model=None):
    if not api_key_str:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
        
    api_keys = [k.strip() for k in api_key_str.split(",") if k.strip()]
    
    if target_model:
        models_to_try = [target_model]
    else:
        models_to_try = [
            'gemini-2.5-flash',      # 1순위
            'gemini-2.5-flash-lite', # 2순위
            'gemini-2.5-pro',        # 3순위
        ]
    
    last_exception = None
    
    for api_key in api_keys:
        try:
            client = genai.Client(api_key=api_key)
            
            for i, model_name in enumerate(models_to_try):
                backoff_times = [2, 4, 8]
                for attempt, sleep_time in enumerate(backoff_times):
                    try:
                        print(f"Attempting {model_name} with key {api_key[:10]}... (Attempt {attempt + 1})")
                        if is_json:
                            if not config:
                                config = types.GenerateContentConfig(response_mime_type="application/json")
                            else:
                                config.response_mime_type = "application/json"
                        
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                            config=config
                        )
                        return response
                    except Exception as e:
                        last_exception = e
                        err_msg = str(e).upper()
                        
                        # 실패 알림 출력
                        next_model = models_to_try[i+1] if i+1 < len(models_to_try) else "없음 (최종 실패)"
                        print(f"[{model_name}] 모델 작동 실패! (사유: {err_msg})")
                        
                        if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                            print(f"Quota exhausted for {model_name} with key {api_key[:10]}...")
                            break # 다음 모델로 점프 (혹은 다음 키?)
                        elif "503" in err_msg or "UNAVAILABLE" in err_msg:
                            time.sleep(sleep_time)
                            continue
                        else:
                            break
        except Exception as e:
            print(f"Error with key {api_key[:10]}...: {e}")
            last_exception = e
            continue # 다음 키로 이동
            
    raise last_exception

@app.get("/api/contents/check-duplicate")
def check_duplicate_contents(keyword: str):
    """같은 장소(키워드)로 이미 만든 글이 있는지 확인 (중복 콘텐츠/키워드 잠식 경고용)"""
    items = database.find_similar_contents(keyword)
    return {"count": len(items), "items": items}

@app.get("/api/contents/stats")
async def get_contents_stats():
    """콘텐츠 관리 대시보드 통계 조회"""
    try:
        stats = database.get_contents_stats()
        return stats
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contents")
async def get_contents(
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    sort_by: str = "created_at_desc",
    page: int = 1,
    limit: int = 20
):
    """콘텐츠 목록 조회 (검색, 필터, 정렬, 페이지네이션)"""
    try:
        result = database.list_contents(
            status=status,
            keyword_query=keyword,
            sort_by=sort_by,
            page=page,
            limit=limit
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/contents")
async def create_new_content(req: ContentCreateRequest):
    """신규 콘텐츠 저장 (SEO 라이터 / 자동 글작성에서 직접 저장)"""
    try:
        created = database.create_content(req.dict(), check_duplicate=req.check_duplicate)
        return created
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"콘텐츠 저장 실패: {str(e)}")

@app.get("/api/contents/{content_id}")
async def get_content(content_id: str):
    """콘텐츠 상세 조회"""
    try:
        content = database.get_content_by_id(content_id)
        if not content:
            raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
        return content
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/contents/{content_id}")
async def update_content(content_id: str, req: ContentUpdateRequest):
    """콘텐츠 수정 및 이력 기록"""
    try:
        update_data = {k: v for k, v in req.dict().items() if v is not None}
        change_summary = req.change_summary or "내용 수정"
        updated = database.update_content(content_id, update_data, change_summary)
        return updated
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/contents/{content_id}")
async def delete_content(content_id: str):
    """콘텐츠 삭제"""
    try:
        success = database.delete_content(content_id)
        if not success:
            raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
        return {"success": True, "message": "삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/contents/{content_id}/status")
async def update_status(content_id: str, req: StatusUpdateRequest):
    """단일 콘텐츠 상태 변경"""
    try:
        updated = database.update_content_status(content_id, req.status)
        return updated
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/contents/batch-status")
async def batch_update_status(req: BatchStatusUpdateRequest):
    """다중 콘텐츠 상태 일괄 변경 (예: 발행 승인 일괄 처리)"""
    try:
        count = database.batch_update_status(req.content_ids, req.status)
        return {"success": True, "updated_count": count}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/contents/{content_id}/publish-record")
async def record_publish(content_id: str, req: PublishRecordRequest):
    """발행 결과 기록 (수동 복사 발행 또는 API 발행 후 결과 확정)"""
    try:
        updated = database.record_publish_result(
            content_id=content_id,
            publish_type=req.publish_type,
            status=req.status,
            post_url=req.post_url or "",
            message=req.message or ""
        )
        return updated
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contents/{content_id}/history")
async def get_history(content_id: str):
    """콘텐츠 수정 이력 목록 조회"""
    try:
        return database.get_content_history(content_id)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/publish-history")
async def get_publish_records(content_id: Optional[str] = None):
    """발행 이력 목록 조회"""
    try:
        return database.get_publish_history(content_id)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-review")
async def generate_review(
    req: ReviewArticleRequest,
    x_gemini_key: Optional[str] = Header(None)
):
    """
    맛집/방문 후기 전용 고수익 및 SEO 최적화 블로그 원고 자동 생성
    - E-E-A-T 기반의 생생한 내돈내산 방문 후기
    - 업로드된 1~2장 사진의 적재적소 슬롯 배치
    - 티스토리 HTML 모드 완벽 호환 카드/캡션 스타일 및 Schema.org 구조화 태그 포함
    - 태그 자동 추출
    """
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
        
    if not req.restaurant_name or not req.restaurant_name.strip():
        raise HTTPException(status_code=400, detail="식당 또는 매장 이름을 입력해주세요.")

    try:
        photo_lines = []
        photos_for_seo = []
        for idx, p in enumerate((req.photos or [])[:2]):
            hint = (p.caption or "").strip()
            photo_lines.append(f"- 사진 {idx+1}: {hint or '(설명 없음)'}")
            photos_for_seo.append({"caption": hint})

        category_label = req.category or "맛집/카페"
        prompt = review_seo.build_gemini_review_prompt(
            place_name=req.restaurant_name,
            category=category_label,
            location=req.location or "",
            place_url=req.place_url or "",
            key_info=req.menu_info or "",
            special_notes=req.special_notes or "",
            rating=req.rating or "5.0",
            photo_lines=photo_lines,
        )

        response = safe_generate_content(api_key, prompt, is_json=True, target_model=req.model_name)
        result_json = json.loads(response.text)

        # 확장 스키마(titles / englishSlug / metaDescription / tags / faqSchema / contentMarkdown) + 구버전 키 호환
        raw_titles = result_json.get("titles") or result_json.get("title_candidates")
        raw_title = (raw_titles[0] if isinstance(raw_titles, list) and raw_titles else None) \
            or result_json.get("title") or f"{req.restaurant_name} 방문 솔직 후기"
        title_candidates = review_seo.clean_title_candidates(raw_titles, raw_title)
        title = title_candidates[0] if title_candidates else raw_title
        raw_markdown = review_seo.strip_cliches(
            result_json.get("contentMarkdown") or result_json.get("content_markdown", ""))
        meta_desc = result_json.get("metaDescription") or result_json.get("meta_description", "")
        tags_list = result_json.get("tags") or [req.restaurant_name, "방문후기", "내돈내산"]
        primary_kw = result_json.get("primary_keyword", req.restaurant_name)
        related_kws = result_json.get("related_keywords", "")
        slug = review_seo.normalize_slug(result_json.get("englishSlug") or result_json.get("slug"))

        # [IMAGE_SLOT: alt=... | caption=...] → 내부 사진 마커 + 슬롯별 Alt·캡션 추출
        raw_markdown, slot_seo = review_seo.extract_image_slots(raw_markdown, len(photos_for_seo))
        photo_seo = review_seo.resolve_photo_seo(
            slot_seo or result_json.get("photo_seo"), photos_for_seo, req.restaurant_name, req.location or ""
        )

        # FAQ JSON-LD: 모델이 준 문자열이 유효하면 사용, 아니면 본문 Q&A에서 생성
        faq_schema = ""
        try:
            cand = result_json.get("faqSchema")
            if isinstance(cand, dict):
                cand = json.dumps(cand, ensure_ascii=False, indent=2)
            if isinstance(cand, str) and cand.strip() and json.loads(cand).get("@type") == "FAQPage":
                faq_schema = cand
        except Exception:
            faq_schema = ""
        if not faq_schema:
            faq_schema = review_seo.build_faq_schema(raw_markdown)

        # 1. 에디터(마크다운)용 텍스트: 사진/경험 마커를 읽기 쉬운 문구로 치환
        markdown_for_editor = raw_markdown
        for idx in range(2):
            slot = f"<!-- [PHOTO_{idx+1}_SLOT] -->"
            if idx < len(photo_seo):
                markdown_for_editor = markdown_for_editor.replace(
                    slot, f"\n\n(사진 {idx+1}) {photo_seo[idx]['caption']}\n")
            else:
                markdown_for_editor = markdown_for_editor.replace(slot, "")
        markdown_for_editor = review_seo.EXPERIENCE_MARKER_RE.sub(
            "\n\n[💡 실무/현장 경험 한 줄 추가 구간]\n\n", markdown_for_editor)

        # 2. 티스토리 완벽 지원 HTML 렌더링
        html_body = markdown.markdown(raw_markdown, extensions=['tables', 'fenced_code', 'nl2br'])
        html_body = review_seo.style_summary_callout(html_body)

        for idx in range(2):
            slot = f"<!-- [PHOTO_{idx+1}_SLOT] -->"
            if idx < len(photo_seo):
                photo = req.photos[idx]
                img_src = photo.data_url if photo.data_url else "https://via.placeholder.com/800x500?text=Review+Photo"
                figure_html = review_seo.render_figure(idx + 1, img_src, photo_seo[idx]["alt"], photo_seo[idx]["caption"])
                if slot in html_body:
                    html_body = html_body.replace(slot, figure_html)
                else:
                    # AI가 사진 자리 마커를 빠뜨린 경우: 해당 순번 소제목 앞(없으면 본문 끝)에 사진 삽입
                    h2_positions = [m.start() for m in re.finditer(r"<h2", html_body)]
                    if len(h2_positions) > idx + 1:
                        pos = h2_positions[idx + 1]
                        html_body = html_body[:pos] + figure_html + html_body[pos:]
                    else:
                        html_body += figure_html
            else:
                html_body = html_body.replace(slot, "")

        # 결론 앞 '직접 경험 추가' 가이드 박스
        html_body = review_seo.render_experience_box(html_body)

        if req.place_url:
            link_box = f"""
<div style="margin: 30px 0; padding: 18px 22px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; line-height: 1.6; color: #334155;">
  <strong style="color: #0284c7; font-size: 15px;">📍 {req.restaurant_name} 매장 정보 바로가기</strong><br/>
  <span style="color: #64748b;">자세한 위치 및 예약 정보는 아래 링크에서 확인하실 수 있습니다:</span><br/>
  <a href="{req.place_url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600; word-break: break-all;">👉 {req.place_url}</a>
</div>
"""
            html_body += link_box

        json_ld_schema = {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": req.restaurant_name,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": req.location or "대한민국",
                "addressCountry": "KR"
            },
            "url": req.place_url or "",
            "review": {
                "@type": "Review",
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": req.rating or "5.0",
                    "bestRating": "5"
                },
                "author": {
                    "@type": "Person",
                    "name": "블로그 운영자"
                },
                "reviewBody": meta_desc or f"{req.restaurant_name} 방문 솔직 후기 및 꿀팁 정리"
            }
        }

        # 티스토리 에디터 상단에 거추장스러운 회색 SCRIPT 박스가 뜨지 않도록 구조화 데이터는 글 최하단에 배치
        json_ld_str = f'\n\n<!-- [구글 SEO 검색 최적화 구조화 데이터 - 방문자 화면에는 보이지 않음] -->\n<script type="application/ld+json">\n{json.dumps(json_ld_schema, ensure_ascii=False, indent=2)}\n</script>'
        full_html_package = html_body + json_ld_str

        return {
            "title": title,
            "title_candidates": title_candidates,
            "slug": slug,
            # 확장 스키마 (camelCase)
            "titles": title_candidates,
            "englishSlug": slug,
            "metaDescription": meta_desc,
            "faqSchema": faq_schema,
            "htmlContent": full_html_package,
            "article": markdown_for_editor,
            "html_article": full_html_package,
            "tags": tags_list,
            "tags_string": ", ".join(tags_list),
            "tags_hash_string": " ".join([f"#{t}" for t in tags_list]),
            "meta_description": meta_desc,
            "primary_keyword": primary_kw,
            "related_keywords": related_kws,
            "json_ld": json_ld_schema,
            "photo_seo": photo_seo,
            "restaurant_name": req.restaurant_name,
            "location": req.location,
            "category": category_label,
            "photos_count": len(req.photos or [])
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"맛집 후기 생성 실패: {str(e)}")

@app.post("/api/tistory/auto-register")
def run_tistory_direct_register(req: TistoryDirectRegisterRequest):
    """생성된 원고(제목/HTML/태그)를 DB 조회 없이 바로 티스토리 에디터에 임시저장 (Gemini 고속 모드용)"""
    import tistory_bot
    blog_name = req.blog_name or os.getenv("TISTORY_BLOG_NAME", "s-elegant")
    try:
        automator = tistory_bot.TistoryAutomator(blog_name=blog_name, headless=False)
        bot_result = automator.post_content(
            title=req.title,
            content_html=req.content_html,
            tags=req.tags,
            category=req.category,
            action="TEMP_SAVE",
            meta_description=req.meta_description or ""
        )
        return {
            "success": bot_result.get("success", False),
            "message": bot_result.get("message", ""),
            "error": bot_result.get("error", "")
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"티스토리 임시저장 실패: {str(e)}")

class NaverReviewRequest(BaseModel):
    place_name: str
    category: Optional[str] = "맛집/카페"
    location: Optional[str] = ""
    place_url: Optional[str] = ""
    key_info: Optional[str] = ""
    special_notes: Optional[str] = ""
    rating: Optional[str] = "5.0"
    photo_captions: Optional[List[str]] = []
    model_name: Optional[str] = None


def _ensure_naver_photo_slots(md: str, count: int) -> str:
    """AI가 사진 자리 마커를 빠뜨리면 소제목 사이에 보충 삽입"""
    for i in range(1, count + 1):
        marker = f"<!-- [PHOTO_{i}_SLOT] -->"
        if marker in md:
            continue
        heads = [m.start() for m in re.finditer(r"\n## ", md)]
        pos = heads[i] if i < len(heads) else len(md)
        md = md[:pos] + f"\n\n{marker}\n\n" + md[pos:]
    return md


@app.post("/api/naver/generate-review")
async def generate_naver_review(
    req: NaverReviewRequest,
    x_gemini_key: Optional[str] = Header(None)
):
    """네이버 블로그용 방문/체험 후기 생성 (복사해서 붙여넣는 반자동 방식, 브라우저 자동화 없음)"""
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
    if not req.place_name or not req.place_name.strip():
        raise HTTPException(status_code=400, detail="장소 또는 상호명을 입력해주세요.")

    captions = [c.strip() for c in (req.photo_captions or []) if c is not None][:10]
    photo_count = len(captions)
    if photo_count:
        photo_lines = "\n".join(f"- 사진 {i + 1}: {c or '현장 사진'}" for i, c in enumerate(captions))
        slot_guide = (
            f"본문 흐름에 맞게 사진 {photo_count}장의 위치를 정하고, 각 위치에 아래 마커를 단독 줄로 삽입하세요 "
            f"(번호 순서대로, 모든 번호를 한 번씩만 사용):\n"
            + "\n".join(f"   <!-- [PHOTO_{i + 1}_SLOT] -->" for i in range(photo_count))
        )
    else:
        photo_lines = "첨부된 사진 없음"
        slot_guide = "사진이 없으므로 사진 마커는 넣지 마세요."

    prompt = f"""
당신은 네이버 블로그 검색(스마트블록, C-Rank, D.I.A.)에 강한 '{req.category or '맛집/카페'}' 전문 블로거입니다.
직접 다녀온 사람의 시선으로 쓴 '내돈내산 방문 후기'를 네이버 블로그용으로 작성해주세요.

[방문 정보]
- 장소/상호명: {req.place_name}
- 카테고리: {req.category or '맛집/카페'}
- 위치/지역: {req.location or '정보 없음'}
- 지도/플레이스 링크: {req.place_url or '정보 없음'}
- 주요 정보(메뉴/가격/시설 등): {req.key_info or '정보 없음'}
- 방문 메모/특이사항: {req.special_notes or '정보 없음'}
- 만족도: {req.rating or '5.0'} / 5.0
- 등록된 사진:
{photo_lines}

[네이버 블로그 작성 지침]
1. 제목
   - 공백 포함 25~40자. 핵심 키워드(지역 + 상호명 + 대표 메뉴/특징)를 앞쪽에 배치하고, 자연스럽게 클릭하고 싶은 표현을 쓰세요.
   - "내돈내산 솔직 후기! ... 총정리" 같은 반복 틀은 피하세요.
2. 본문 (공백 제외 1,800~2,500자)
   - 첫 문단 3~4줄 안에 장소명과 핵심 키워드를 자연스럽게 포함하고, 방문 계기와 한 줄 요약을 쓰세요.
   - 모바일에서 읽기 편하도록 한 문단은 2~3줄, 문단 사이에 빈 줄을 넣으세요.
   - 소제목은 마크다운 "## 소제목 문장" 형식으로 3~5개, 번호나 "소제목 1:" 같은 라벨은 쓰지 마세요.
   - 구성: 도입 → 위치·주차·웨이팅 → 분위기·공간 → 메뉴/체험 상세 평가 → 아쉬운 점 → 한눈에 보기(글머리표 목록) → 이런 분께 추천 + 마무리.
   - 표는 쓰지 말고 글머리표(-) 목록으로 정리하세요. (네이버 에디터에 붙여넣기 좋게)
   - 장점만 늘어놓지 말고 아쉬운 점도 솔직하게 1~2가지 쓰세요.
   - 사진 배치: {slot_guide}
3. 사실 관계 (매우 중요)
   - 위 [방문 정보]에 없는 구체적 사실(영업시간, 가격, 주소, 전화번호, 개업 연도, 웨이팅 시간 등)은 절대 지어내지 마세요.
   - 모르는 정보는 "방문 전 네이버 지도에서 영업시간을 꼭 확인하세요"처럼 확인을 안내하는 문장으로 처리하세요.
   - 입력된 메모와 사진 설명에서 알 수 있는 내용만 경험처럼 풀어 쓰세요.
4. 어조: 친근하고 담백한 블로그 말투(~했어요, ~더라고요). 과장된 표현과 광고 같은 문구, 기계적인 문장은 피하세요.
5. 태그: 지역 + 업종 + 메뉴 + 추천 대상 조합으로 20~25개 (# 없이 단어만).

반드시 아래 JSON 형식으로만 응답하세요:
{{
  "title": "네이버용 제목",
  "content_markdown": "작성된 전체 마크다운 본문 (사진 마커 포함)",
  "summary": "글 요약 한 줄 (60자 내외)",
  "tags": ["태그1", "태그2"]
}}
"""

    try:
        response = safe_generate_content(api_key, prompt, is_json=True, target_model=req.model_name)
        result = json.loads(response.text)

        title = (result.get("title") or f"{req.place_name} 방문 후기").strip()
        raw_md = (result.get("content_markdown") or "").strip()
        if not raw_md:
            raise ValueError("생성된 본문이 비어 있습니다.")
        tags_list = [str(t).replace("#", "").strip() for t in (result.get("tags") or []) if str(t).strip()][:30]
        summary = result.get("summary", "")

        raw_md = _ensure_naver_photo_slots(raw_md, photo_count)

        # 편집용 텍스트: 사진 마커를 안내 문구로 치환
        article_text = raw_md
        for i in range(photo_count):
            article_text = article_text.replace(
                f"<!-- [PHOTO_{i + 1}_SLOT] -->", f"📷 [사진 {i + 1}: {captions[i] or '현장 사진'}]")

        html_body = markdown.markdown(raw_md, extensions=["nl2br"])
        html_body = html_body.replace(
            "<h2>", '<h2 style="font-size: 20px; font-weight: bold; margin: 32px 0 14px;">')
        html_body = html_body.replace("<p>", '<p style="line-height: 1.9; margin: 0 0 14px; font-size: 15px;">')

        plain = re.sub(r"<!--.*?-->|[#*>\-`]", "", raw_md)
        char_count = len(re.sub(r"\s", "", plain))

        content_id = None
        try:
            import uuid
            content_id = f"cont_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
            database.create_content({
                "id": content_id,
                "title": title,
                "keyword": req.place_name,
                "related_keywords": ", ".join(tags_list),
                "category": req.category or "맛집/카페",
                "content": article_text,
                "content_html": html_body,
                "meta_description": summary,
                "tags": ", ".join(tags_list),
                "thumbnail_url": "",
                "body_images": [],
                "reference_urls": [req.place_url] if req.place_url else [],
                "internal_links": [],
                "ai_model": "Gemini-Naver",
                "status": "DRAFT",
                "scheduled_at": "",
                "tistory_url": "",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }, check_duplicate=False)
        except Exception as db_err:
            print(f"[WARN] 네이버 후기 DB 저장 실패(무시): {db_err}")
            content_id = None

        return {
            "title": title,
            "article": article_text,
            "html_article": html_body,
            "tags": tags_list,
            "tags_hash_string": " ".join(f"#{t}" for t in tags_list),
            "summary": summary,
            "char_count": char_count,
            "photo_count": photo_count,
            "content_id": content_id
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"네이버 후기 생성 실패: {str(e)}")


@app.post("/api/publish/auto-register")
def run_auto_register(req: AutoRegisterRequest):
    """
    티스토리 브라우저 자동 등록 실행 (Playwright 기반 로컬 봇 연동)
    - 승인된 콘텐츠를 티스토리 에디터에 자동 입력
    - 임시저장(TEMP_SAVE), 최종검토(CONFIRM_BEFORE_PUBLISH), 공개발행(PUBLISH) 지원
    - 결과 및 이력 DB 자동 기록
    """
    content = database.get_content(req.content_id)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    # 중복 발행 검사
    if content.get("status") == "PUBLISHED" and not req.force:
        raise HTTPException(
            status_code=400,
            detail=f"이미 발행 완료된 콘텐츠입니다. (티스토리 URL: {content.get('tistory_url', '')}) 재발행하려면 '강제 재시도'를 선택하세요."
        )

    title = content.get("title", "")
    content_html = content.get("content_html") or content.get("content", "")
    tags_raw = content.get("tags", "")
    tags = [t.strip() for t in tags_raw.replace("#", "").split(",") if t.strip()] if tags_raw else []
    category = content.get("category", "맛집/카페")
    blog_name = req.blog_name or os.getenv("TISTORY_BLOG_NAME", "s-elegant")

    try:
        # 상태를 PUBLISHING으로 업데이트
        database.update_content_status(req.content_id, "PUBLISHING")

        # 티스토리 봇 실행
        import tistory_bot
        automator = tistory_bot.TistoryAutomator(blog_name=blog_name, headless=False)
        bot_result = automator.post_content(
            title=title,
            content_html=content_html,
            tags=tags,
            category=category,
            action=req.publish_action or "TEMP_SAVE",
            meta_description=content.get("meta_description") or ""
        )

        success = bot_result.get("success", False)
        post_url = bot_result.get("post_url", "")
        message = bot_result.get("message", "")
        error_msg = bot_result.get("error", "")

        final_status = "PUBLISHED" if (success and req.publish_action == "PUBLISH") else ("APPROVED" if success else "FAILED")

        # DB 발행 결과 기록
        database.record_publish_result(
            content_id=req.content_id,
            publish_type=f"PLAYWRIGHT_{req.publish_action}",
            status="SUCCESS" if success else "FAILED",
            post_url=post_url or "",
            message=message or error_msg
        )

        # 콘텐츠 최종 상태 업데이트
        database.update_content(
            req.content_id,
            {
                "status": final_status,
                "tistory_url": post_url or content.get("tistory_url", ""),
                "published_at": datetime.now().isoformat() if final_status == "PUBLISHED" else content.get("published_at")
            },
            change_summary=f"티스토리 자동 등록 ({req.publish_action}): {'성공' if success else '실패'}"
        )

        if not success:
            raise HTTPException(status_code=500, detail=f"자동 등록 실패: {error_msg or message}")

        return {
            "success": True,
            "content_id": req.content_id,
            "action": req.publish_action,
            "status": final_status,
            "post_url": post_url,
            "message": message
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        database.record_publish_result(
            content_id=req.content_id,
            publish_type=f"PLAYWRIGHT_{req.publish_action}",
            status="FAILED",
            post_url="",
            message=str(e)
        )
        database.update_content_status(req.content_id, "FAILED")
        raise HTTPException(status_code=500, detail=f"자동 등록 실행 오류: {str(e)}")

# -------------------------------------------------------------------------
# Google Search Console & AdSense 수익/성과 분석 엔드포인트
# -------------------------------------------------------------------------
@app.get("/api/analytics/overview")
async def get_analytics_overview(days: int = 28):
    try:
        import analytics
        engine = analytics.AnalyticsEngine()
        metrics = engine.fetch_metrics(days=days)
        connection = engine.get_connection_status()
        if connection.get("error"):
            connection["mode"] = "DEMO"  # 실데이터 조회 실패 시 샘플임을 명확히 표시
        return {
            "success": True,
            "connection": connection,
            "data": metrics
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"분석 데이터 로드 실패: {str(e)}")

@app.get("/api/analytics/settings")
async def get_analytics_settings():
    try:
        import analytics
        # 저장된 체크박스 값이 아니라 환경변수 기준의 실제 연동 상태를 반환
        status = analytics.AnalyticsEngine().get_connection_status()
        return {"success": True, "config": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 조회 실패: {str(e)}")

@app.post("/api/analytics/settings")
async def update_analytics_settings(req: AnalyticsSettingsRequest):
    try:
        import analytics
        config = analytics.load_analytics_config()
        config["site_url"] = req.site_url or "https://s-elegant.tistory.com/"
        config["gsc_connected"] = bool(req.gsc_connected)
        config["adsense_connected"] = bool(req.adsense_connected)
        config["adsense_account_id"] = req.adsense_account_id or ""
        config["gsc_auth_type"] = req.gsc_auth_type or "SERVICE_ACCOUNT"
        if req.service_account_email:
            config["service_account_email"] = req.service_account_email
        config["last_sync"] = datetime.now().isoformat()
        analytics.save_analytics_config(config)
        return {"success": True, "message": "설정이 성공적으로 저장되었습니다.", "config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")

@app.get("/api/analytics/auth/google/url")
async def get_google_auth_url_endpoint(redirect_uri: Optional[str] = "http://localhost:8765/"):
    try:
        import analytics
        url = analytics.get_google_auth_url(redirect_uri=redirect_uri or "http://localhost:8765/")
        return {"success": True, "auth_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/auth/google/exchange")
async def exchange_google_code_endpoint(req: GoogleAuthExchangeRequest):
    try:
        import analytics
        res = analytics.exchange_code_for_token(req.code, redirect_uri=req.redirect_uri or "http://localhost:8765/")
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/auth/google/start-local-flow")
async def start_google_local_flow_endpoint():
    try:
        import analytics
        import asyncio
        loop = asyncio.get_event_loop()
        res = await loop.run_in_executor(None, analytics.run_local_oauth_flow)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/auth/google/test-live")
async def test_google_live_endpoint():
    try:
        import analytics
        engine = analytics.AnalyticsEngine()
        status = engine.get_connection_status()
        metrics = engine.fetch_metrics(days=7)
        error = getattr(engine, "last_error", None)
        mode = metrics.get("period", {}).get("data_source_mode", "UNKNOWN")
        is_live = "LIVE" in mode
        return {
            "success": is_live,
            "mode": mode,
            "is_live": is_live,
            "connection": status,
            "error": error
        }
    except Exception as e:
        return {"success": False, "is_live": False, "error": str(e)}

@app.post("/api/analytics/recommend")
async def get_ai_recommendation(req: AnalyticsRecommendRequest, x_gemini_api_key: Optional[str] = Header(None)):
    api_key = x_gemini_api_key or GEMINI_API_KEY or ""
    try:
        import analytics
        engine = analytics.AnalyticsEngine()
        result = engine.generate_ai_recommendation(req.page, api_key)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI 최적화 처방전 생성 실패: {str(e)}")

@app.post("/api/analytics/auto-optimize/fetch-and-rewrite")
async def auto_optimize_fetch_and_rewrite(req: AutoOptimizeRequest, x_gemini_api_key: Optional[str] = Header(None)):
    api_key = x_gemini_api_key or GEMINI_API_KEY or ""
    try:
        import auto_optimizer
        # 1. 본문이 없으면 URL 크롤링으로 자동 수집
        content_text = req.content_text
        original_title = req.title
        
        if not content_text and req.url:
            scraped = auto_optimizer.scrape_tistory_article(req.url)
            content_text = scraped.get("content_text", "")
            if not original_title:
                original_title = scraped.get("title", "")
            
        if not content_text:
            # 본문을 크롤링하지 못한 경우(404 또는 비공개 글), 제목과 검색어, 진단 정보를 바탕으로 시드 텍스트 자동 구성
            query_hints = ", ".join([q.get("query", "") for q in (req.queries or []) if q.get("query")])
            content_text = f"주제: {original_title or req.title}\n핵심 검색어: {query_hints}\n진단 분석: {req.diagnosis}\n이 포스팅은 {original_title or req.title}에 관한 핵심 정보, 실전 활용법 및 가이드라인을 다룹니다."
            
        # 2. AI SEO 리라이팅 수행
        rewrite_res = auto_optimizer.rewrite_article_with_ai(
            title=original_title or req.title or "블로그 포스팅",
            content_text=content_text,
            scenario=req.scenario or "HIGH_IMP_LOW_CTR",
            scenario_label=req.scenario_label or "노출 대비 클릭률 저조",
            diagnosis=req.diagnosis or "",
            queries=req.queries,
            api_key=api_key
        )
        
        return {
            "success": True,
            "original_title": original_title,
            "original_url": req.url,
            "original_length": len(content_text),
            "optimized": rewrite_res.get("data", {}),
            "model_used": rewrite_res.get("model_used", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"자동 최적화 리라이팅 실패: {str(e)}")

@app.post("/api/analytics/auto-optimize/save-tistory")
async def auto_optimize_save_tistory(req: AutoOptimizeSaveRequest):
    try:
        import tistory_bot
        blog = req.blog_name or "s-elegant"
        tags = req.tags or []
        
        # 티스토리 임시저장 실행
        automator = tistory_bot.TistoryAutomator(blog_name=blog, headless=False)
        result = automator.post_content(
            title=req.title,
            content_html=req.html_content,
            tags=tags,
            action="TEMP_SAVE"
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"티스토리 임시저장 실패: {str(e)}")

class ClaudePhotoItem(BaseModel):
    data_url: Optional[str] = None
    caption: Optional[str] = ""
    name: Optional[str] = ""

class ClaudeReviewRequest(BaseModel):
    place_name: str
    category: Optional[str] = "맛집/카페"
    location: Optional[str] = ""
    place_url: Optional[str] = ""
    key_info: Optional[str] = ""
    special_notes: Optional[str] = ""
    rating: Optional[str] = "5.0"
    photos: Optional[List[ClaudePhotoItem]] = []
    auto_tistory_save: Optional[bool] = False
    tistory_blog: Optional[str] = "s-elegant"

@app.post("/api/claude/launch-browser")
def launch_claude_browser():
    """
    Claude.ai 웹 브라우저 창을 띄워 사용자가 미리 로그인할 수 있도록 지원 (CDP 모드)
    """
    try:
        import claude_bot
        claude_bot.ensure_debug_chrome()
        return {"success": True, "message": "Google Chrome 브라우저가 실행되었습니다. 열린 창에서 Claude.ai 로그인을 완료해주세요."}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"브라우저 실행 실패: {str(e)}")

@app.post("/api/tistory/launch-browser")
def launch_tistory_browser_endpoint(blog_name: Optional[str] = "s-elegant"):
    """
    티스토리 로그인용 브라우저 창을 백그라운드로 띄워 사용자가 미리 로그인할 수 있도록 지원 (즉시 리턴)
    """
    try:
        import tistory_bot
        return tistory_bot.launch_login_browser_background(blog_name or "s-elegant")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"티스토리 브라우저 실행 실패: {str(e)}")

@app.get("/api/tistory/login-status")
def get_tistory_login_status():
    """
    현재 티스토리 카카오 로그인 진행 상태 및 세션 쿠키 보유 여부 반환
    """
    try:
        import tistory_bot
        return tistory_bot.get_login_state()
    except Exception as e:
        return {"status": "error", "message": str(e), "has_cookie": False}

class NaverClaudeReviewRequest(BaseModel):
    place_name: str
    category: Optional[str] = "맛집/카페"
    location: Optional[str] = ""
    place_url: Optional[str] = ""
    key_info: Optional[str] = ""
    special_notes: Optional[str] = ""
    rating: Optional[str] = "5.0"
    photos: Optional[List[ClaudePhotoItem]] = []

@app.post("/api/claude/naver-review")
def generate_claude_naver_review(req: NaverClaudeReviewRequest):
    """Claude.ai 웹(Playwright)으로 네이버 블로그용 후기 원고 생성 (사진 첨부, 복사 붙여넣기 방식)"""
    if not req.place_name or not req.place_name.strip():
        raise HTTPException(status_code=400, detail="방문 장소 또는 상호명을 입력해주세요.")

    import shutil
    import tempfile
    import uuid
    import claude_bot

    temp_dir = os.path.join(tempfile.gettempdir(), f"claude_naver_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_dir, exist_ok=True)
    temp_photo_paths = []
    photos_data_list = []

    try:
        for idx, p in enumerate((req.photos or [])[:10]):
            caption = p.caption.strip() if p.caption else f"{req.place_name} 사진 {idx+1}"
            photos_data_list.append({"caption": caption, "name": p.name or f"photo_{idx+1}.jpg"})
            if p.data_url and "base64," in p.data_url:
                try:
                    header, b64_data = p.data_url.split("base64,", 1)
                    ext = "png" if "image/png" in header else ("webp" if "image/webp" in header else "jpg")
                    file_path = os.path.join(temp_dir, f"photo_{idx+1}.{ext}")
                    with open(file_path, "wb") as f_img:
                        f_img.write(base64.b64decode(b64_data))
                    temp_photo_paths.append(file_path)
                except Exception as b64_err:
                    print(f"사진 파일 변환 실패 ({idx}): {b64_err}")

        print(f"\n[API] Claude 네이버 후기 생성 시작: {req.place_name} (사진 {len(temp_photo_paths)}장)")
        claude_automator = claude_bot.ClaudeWebAutomator(headless=False)
        result = claude_automator.generate_review_article(
            place_name=req.place_name,
            category=req.category or "맛집/카페",
            location=req.location or "",
            place_url=req.place_url or "",
            key_info=req.key_info or "",
            special_notes=req.special_notes or "",
            rating=req.rating or "5.0",
            photo_paths=temp_photo_paths,
            photo_captions=[d["caption"] for d in photos_data_list],
            photos_data=photos_data_list,
            platform="naver"
        )
        if not result.get("success"):
            raise Exception(result.get("error") or "Claude 웹에서 원고 생성에 실패했습니다.")

        title = result.get("title") or f"{req.place_name} 방문 후기"
        tags = result.get("tags", [])
        content_id = f"cont_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        try:
            database.create_content({
                "id": content_id,
                "title": title,
                "keyword": req.place_name,
                "related_keywords": ", ".join(tags),
                "category": req.category or "맛집/카페",
                "content": result.get("article", ""),
                "content_html": result.get("html_article", ""),
                "meta_description": result.get("meta_description", ""),
                "tags": ", ".join(tags),
                "thumbnail_url": "",
                "body_images": [],
                "reference_urls": [req.place_url] if req.place_url else [],
                "internal_links": [],
                "ai_model": "Claude-Naver",
                "status": "DRAFT",
                "scheduled_at": "",
                "tistory_url": "",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }, check_duplicate=False)
        except Exception as db_err:
            print(f"[WARN] 네이버 후기 DB 저장 실패(무시): {db_err}")
            content_id = None

        return {
            "title": title,
            "article": result.get("article", ""),
            "html_article": result.get("html_article", ""),
            "tags": tags,
            "tags_hash_string": " ".join(f"#{t}" for t in tags),
            "summary": result.get("meta_description", ""),
            "char_count": result.get("char_count", 0),
            "article_md": result.get("article_md", ""),
            "photo_count": len(photos_data_list),
            "content_id": content_id
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Claude 네이버 후기 생성 실패: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

class NaverAutoRegisterRequest(BaseModel):
    title: str
    article_md: str
    blog_id: str
    photos: Optional[List[ClaudePhotoItem]] = []

@app.post("/api/naver/auto-register")
def run_naver_auto_register(req: NaverAutoRegisterRequest):
    """생성된 원고(제목·마크다운 본문·사진)를 네이버 블로그 글쓰기 화면에 입력하고 임시저장 (내 PC 로컬 전용, 베타)"""
    blog_id = (req.blog_id or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-]{2,30}", blog_id):
        raise HTTPException(status_code=400, detail="네이버 블로그 아이디를 영문·숫자로 정확히 입력해 주세요. (예: myblog123)")
    if not req.title.strip() or not req.article_md.strip():
        raise HTTPException(status_code=400, detail="제목과 본문이 비어 있습니다.")

    import shutil
    import tempfile
    import uuid
    import naver_bot

    temp_dir = os.path.join(tempfile.gettempdir(), f"naver_save_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_dir, exist_ok=True)
    photo_paths = []
    try:
        for idx, p in enumerate((req.photos or [])[:10]):
            if p.data_url and "base64," in p.data_url:
                try:
                    header, b64_data = p.data_url.split("base64,", 1)
                    ext = "png" if "image/png" in header else ("webp" if "image/webp" in header else "jpg")
                    file_path = os.path.join(temp_dir, f"photo_{idx+1}.{ext}")
                    with open(file_path, "wb") as f_img:
                        f_img.write(base64.b64decode(b64_data))
                    photo_paths.append(file_path)
                except Exception as b64_err:
                    print(f"사진 파일 변환 실패 ({idx}): {b64_err}")
                    photo_paths.append("")
            else:
                photo_paths.append("")

        print(f"\n[API] 네이버 임시저장 시작: {blog_id} / 제목: {req.title[:30]} / 사진 {len([p for p in photo_paths if p])}장")
        return naver_bot.NaverAutomator(blog_id).save_draft(req.title, req.article_md, photo_paths)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"네이버 임시저장 실패: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

class ITPostRequest(BaseModel):
    original_text: str
    keyword: Optional[str] = ""
    category: Optional[str] = "IT"
    topic_type: Optional[str] = "it"   # "it" | "finance"
    blog_name: Optional[str] = ""
    auto_tistory_save: Optional[bool] = True

FINANCE_DISCLAIMER_MD = (
    "---\n\n"
    "> ※ 이 글은 정보 제공을 위한 것이며 특정 금융상품의 가입·매수·매도를 권유하지 않습니다. "
    "금리·세율·한도·수수료는 시점과 조건에 따라 달라질 수 있으니 최신 기준은 공식 안내에서 확인하시고, "
    "투자 판단과 그 결과에 대한 책임은 본인에게 있습니다."
)

@app.post("/api/claude/it-post")
def generate_claude_it_post(req: ITPostRequest):
    """IT·재테크 원문을 Claude(웹)가 SEO에 맞게 다듬고 설명용 다이어그램을 그리면, 이미지로 바꿔 넣어 티스토리에 임시저장 (내 PC 로컬 전용)"""
    text = (req.original_text or "").strip()
    if len(text) < 100:
        raise HTTPException(status_code=400, detail="원문을 100자 이상 입력해 주세요.")
    if len(text) > 30000:
        raise HTTPException(status_code=400, detail="원문이 너무 깁니다. 30,000자 이내로 나누어 입력해 주세요.")

    import claude_bot
    import it_post

    try:
        automator = claude_bot.ClaudeWebAutomator(headless=False)
        print(f"\n[API] IT 글 SEO 수정 시작 (원문 {len(text):,}자, 키워드: {req.keyword or '자동'})")
        topic_type = "finance" if (req.topic_type or "").lower() == "finance" else "it"
        chat = automator.generate_it_post(text, req.keyword or "", req.category or ("재테크" if topic_type == "finance" else "IT"), topic_type)
        if not chat.get("success"):
            raise Exception(chat.get("error") or "Claude 웹에서 답변을 받지 못했습니다.")

        try:
            parsed = it_post.parse_it_response(chat["raw"])
        except ValueError as parse_err:
            raise Exception(f"클로드 답변을 해석하지 못했습니다: {parse_err}")

        # 다이어그램: 안전 정제 → 크롬으로 PNG 변환 → 슬롯 번호에 맞춰 배치
        slot_count = max([d["number"] for d in parsed["diagrams"]] or [0])
        valid, svgs = [], []
        for d in parsed["diagrams"]:
            clean = it_post.sanitize_svg(d["svg"])
            if clean:
                valid.append(d)
                svgs.append(clean)
            else:
                print(f"[WARN] 다이어그램 {d['number']}은(는) SVG가 올바르지 않아 제외합니다.")
        pngs = it_post.render_svgs_to_png(svgs) if svgs else []
        images = [None] * slot_count
        for d, png in zip(valid, pngs):
            if png:
                images[d["number"] - 1] = {"data_url": png, "caption": d["caption"]}
        diagram_ok = sum(1 for img in images if img)

        title = parsed["title"]
        tags = parsed["tags"] or ["재테크" if topic_type == "finance" else "IT", req.category or "IT"]
        if topic_type == "finance":
            # 금융 글에는 면책 안내를 서버에서 항상 붙인다 (클로드의 답변에 의존하지 않음)
            parsed["article_md"] = parsed["article_md"].rstrip() + "\n\n" + FINANCE_DISCLAIMER_MD + "\n"
        html_article = it_post.build_tistory_html(automator, parsed["article_md"], title, images)

        # 편집용 텍스트: 그림 자리는 설명 문구로 표시
        article_text = parsed["article_md"]
        for n, img in enumerate(images, start=1):
            marker = f"<!-- [PHOTO_{n}_SLOT] -->"
            article_text = article_text.replace(marker, f"📷 [그림 {n}: {img['caption']}]" if img else "")
        article_text = re.sub(r"<!--\s*\[PHOTO_\d+_SLOT\]\s*-->", "", article_text)

        import uuid
        content_id = f"cont_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        try:
            database.create_content({
                "id": content_id,
                "title": title,
                "keyword": (req.keyword or title)[:100],
                "related_keywords": ", ".join(tags),
                "category": req.category or ("재테크" if topic_type == "finance" else "IT"),
                "content": article_text,
                "content_html": html_article,
                "meta_description": parsed["meta_description"],
                "tags": ", ".join(tags),
                "thumbnail_url": "",
                "body_images": [],
                "reference_urls": [],
                "internal_links": [],
                "ai_model": "Claude-IT",
                "status": "DRAFT",
                "scheduled_at": "",
                "tistory_url": "",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }, check_duplicate=False)
        except Exception as db_err:
            print(f"[WARN] IT 글 DB 저장 실패(무시): {db_err}")
            content_id = None

        tistory_saved, tistory_msg = False, ""
        if req.auto_tistory_save:
            import tistory_bot
            blog_name = req.blog_name or os.getenv("TISTORY_BLOG_NAME", "s-elegant")
            print(f"\n[START] [API] 티스토리 자동 임시저장 실행 ({blog_name})...")
            bot_res = tistory_bot.TistoryAutomator(blog_name=blog_name, headless=False).post_content(
                title=title,
                content_html=html_article,
                tags=tags,
                category=req.category,
                action="TEMP_SAVE",
                meta_description=parsed["meta_description"]
            )
            tistory_saved = bot_res.get("success", False)
            tistory_msg = bot_res.get("message", "") if tistory_saved else (bot_res.get("error") or "티스토리 임시저장 중 문제가 발생했습니다.")

        return {
            "title": title,
            "article": article_text,
            "html_article": html_article,
            "tags": tags,
            "tags_string": ", ".join(tags),
            "meta_description": parsed["meta_description"],
            "slug": parsed.get("slug", ""),
            "faq_schema": parsed.get("faq_schema", ""),
            "diagram_total": len(parsed["diagrams"]),
            "diagram_ok": diagram_ok,
            "content_id": content_id,
            "tistory_saved": tistory_saved,
            "tistory_message": tistory_msg
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"IT 글 SEO 수정 실패: {str(e)}")

@app.post("/api/claude/generate-review")
def generate_claude_review(req: ClaudeReviewRequest):
    """
    Claude.ai 웹(Playwright)을 통해 고품질 방문/체험 후기 원고 자동 생성
    - 옵션 활성화 시 티스토리(Playwright)에 원스톱 자동 임시저장까지 연계
    """
    if not req.place_name or not req.place_name.strip():
        raise HTTPException(status_code=400, detail="방문 장소 또는 상호명을 입력해주세요.")

    import tempfile
    import uuid
    import claude_bot
    import tistory_bot

    temp_dir = os.path.join(tempfile.gettempdir(), f"claude_review_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_dir, exist_ok=True)
    temp_photo_paths = []
    photo_captions = []
    photos_data_list = []

    try:
        # 1. Base64 사진 데이터를 임시 파일로 저장 (Playwright 파일 업로드용)
        if req.photos:
            for idx, p in enumerate(req.photos):
                caption = p.caption.strip() if p.caption else f"{req.place_name} 사진 {idx+1}"
                photo_captions.append(caption)
                photos_data_list.append({
                    "data_url": p.data_url,
                    "caption": caption,
                    "name": p.name or f"photo_{idx+1}.jpg"
                })

                if p.data_url and "base64," in p.data_url:
                    try:
                        header, b64_data = p.data_url.split("base64,", 1)
                        ext = "jpg"
                        if "image/png" in header:
                            ext = "png"
                        elif "image/webp" in header:
                            ext = "webp"

                        file_path = os.path.join(temp_dir, f"photo_{idx+1}.{ext}")
                        with open(file_path, "wb") as f_img:
                            f_img.write(base64.b64decode(b64_data))
                        temp_photo_paths.append(file_path)
                    except Exception as b64_err:
                        print(f"사진 파일 변환 실패 ({idx}): {b64_err}")

        # 2. Claude 웹 자동화 봇 실행
        print(f"\n[API] Claude 웹 후기 생성 시작: {req.place_name} ({req.category})")
        claude_automator = claude_bot.ClaudeWebAutomator(headless=False)
        claude_result = claude_automator.generate_review_article(
            place_name=req.place_name,
            category=req.category or "맛집/카페",
            location=req.location or "",
            place_url=req.place_url or "",
            key_info=req.key_info or "",
            special_notes=req.special_notes or "",
            rating=req.rating or "5.0",
            photo_paths=temp_photo_paths,
            photo_captions=photo_captions,
            photos_data=photos_data_list
        )

        if not claude_result.get("success"):
            err_msg = claude_result.get("error") or "Claude 웹에서 원고 생성에 실패했습니다."
            raise Exception(err_msg)

        title = claude_result.get("title") or f"{req.place_name} 방문 솔직 후기"
        article = claude_result.get("article", "")
        html_article = claude_result.get("html_article", "")
        tags = claude_result.get("tags", [])
        tags_string = claude_result.get("tags_string", ", ".join(tags))
        meta_description = claude_result.get("meta_description", "")

        # 3. 데이터베이스에 자동 기록 (DRAFT)
        content_id = f"cont_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        content_dict = {
            "id": content_id,
            "title": title,
            "keyword": req.place_name,
            "related_keywords": tags_string,
            "category": req.category or "맛집/카페",
            "content": article,
            "content_html": html_article,
            "meta_description": meta_description,
            "tags": tags_string,
            "thumbnail_url": req.photos[0].data_url if req.photos else "",
            "body_images": [p.data_url for p in req.photos if p.data_url],
            "reference_urls": [req.place_url] if req.place_url else [],
            "internal_links": [],
            "ai_model": "Claude-Web-Browser (Playwright)",
            "status": "DRAFT",
            "scheduled_at": "",
            "tistory_url": "",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        database.create_content(content_dict)
        print(f"[OK] [API] 데이터베이스 콘텐츠 저장 완료 (ID: {content_id})")

        # 4. (옵션) 원스톱 티스토리 임시저장 실행
        tistory_saved = False
        tistory_msg = ""
        if req.auto_tistory_save:
            print("\n[START] [API] 옵션 활성화: 티스토리 자동 임시저장 실행...")
            blog_name = req.tistory_blog or os.getenv("TISTORY_BLOG_NAME", "s-elegant")
            tistory_auto = tistory_bot.TistoryAutomator(blog_name=blog_name, headless=False)
            bot_res = tistory_auto.post_content(
                title=title,
                content_html=html_article,
                tags=tags,
                category=req.category,
                action="TEMP_SAVE",
                meta_description=meta_description
            )
            tistory_saved = bot_res.get("success", False)
            tistory_msg = bot_res.get("message", "")
            if not tistory_saved:
                tistory_msg = bot_res.get("error") or "티스토리 임시저장 중 문제가 발생했습니다."
            else:
                try:
                    database.record_publish_result(
                        content_id=content_id,
                        publish_type="PLAYWRIGHT_TEMP_SAVE",
                        status="SUCCESS",
                        post_url="",
                        message=tistory_msg
                    )
                except Exception as hist_err:
                    print(f"[WARN] 발행 이력 기록 실패(무시): {hist_err}")

        return {
            "success": True,
            "content_id": content_id,
            "title": title,
            "article": article,
            "html_article": html_article,
            "tags": tags,
            "tags_string": tags_string,
            "meta_description": meta_description,
            "title_candidates": claude_result.get("title_candidates", []),
            "slug": claude_result.get("slug", ""),
            "photo_seo": claude_result.get("photo_seo", []),
            "tistory_saved": tistory_saved,
            "tistory_message": tistory_msg
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Claude 방문 후기 처리 실패: {str(e)}")
    finally:
        # 임시 이미지 파일 정리
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

@app.post("/api/analytics/weekly-report")
async def get_weekly_report(req: WeeklyReportRequest, x_gemini_api_key: Optional[str] = Header(None)):
    api_key = x_gemini_api_key or GEMINI_API_KEY
    try:
        import analytics
        engine = analytics.AnalyticsEngine()
        days_data = engine.fetch_metrics(days=req.days or 28)
        report = engine.generate_weekly_report(days_data, api_key or "")
        return {
            "success": True,
            "report_markdown": report,
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"주간 보고서 생성 실패: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)


