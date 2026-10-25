import os
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

# API 키 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# 데이터 스키마
class KeywordRequest(BaseModel):
    topic: str

class ArticleRequest(BaseModel):
    keyword: str
    topic: str
    adsense_optimize: Optional[bool] = False
    affiliate_optimize: Optional[bool] = False

class ImageRequest(BaseModel):
    prompt_base: str
    resolution: Optional[str] = "1024x1024"


class PublishRequest(BaseModel):
    topic: str
    keyword: str
    tistory_token: str
    tistory_blog: str
    adsense_optimize: Optional[bool] = False
    affiliate_optimize: Optional[bool] = False

class 분야_추천_요청(BaseModel):
    category: str
    model_name: Optional[str] = None

class 자동_작성_요청(BaseModel):
    category: str
    topic: Optional[str] = None
    tistory_token: Optional[str] = None
    tistory_blog: Optional[str] = None
    model_name: Optional[str] = None
    adsense_optimize: Optional[bool] = False
    affiliate_optimize: Optional[bool] = False

class 심층_분석_요청(BaseModel):
    keyword: str
    topic: str

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





class 수익성_극대화_관리자:
    """블로그 수익 및 SEO를 극대화하는 보조 유틸리티 클래스 (글로벌 룰 준수)"""
    
    @staticmethod
    def 애드센스_광고_삽입(원고: str, 활성화: bool = False) -> str:
        """
        원고의 적절한 위치(H2, H3 태그 전후 또는 긴 단락 사이)에 구글 애드센스 광고 플레이스홀더를 삽입합니다.
        """
        if not 활성화:
            return 원고
            
        lines = 원고.split("\n")
        new_lines = []
        h2_count = 0
        
        for line in lines:
            trimmed = line.strip()
            # H2, H3 소제목 태그 매칭
            if trimmed.startswith("## ") or trimmed.startswith("### "):
                h2_count += 1
                # 첫 번째와 세 번째 소제목 상단에 광고 삽입
                if h2_count in [1, 3]:
                    new_lines.append("\n<!-- [구글 애드센스 본문 광고 영역 - 수익 극대화] -->")
                    new_lines.append('<div class="adsense-placeholder" style="margin: 20px 0; text-align: center; background: rgba(255,255,255,0.02); border: 1px dashed rgba(168,85,247,0.3); padding: 30px; border-radius: 12px; color: #a855f7; font-size: 13px; font-weight: bold;">💰 여기에 구글 애드센스 광고 코드를 삽입하세요 (수익형 본문 광고)</div>\n')
            new_lines.append(line)
            
        # 마지막 문단 아래에 하단 광고 추가
        new_lines.append("\n<!-- [구글 애드센스 본문 하단 광고 영역] -->")
        new_lines.append('<div class="adsense-placeholder" style="margin: 20px 0; text-align: center; background: rgba(255,255,255,0.02); border: 1px dashed rgba(168,85,247,0.3); padding: 30px; border-radius: 12px; color: #a855f7; font-size: 13px; font-weight: bold;">💰 여기에 구글 애드센스 광고 코드를 삽입하세요 (수익형 하단 광고)</div>\n')
        
        return "\n".join(new_lines)
        
    @staticmethod
    def 구조화_데이터_생성(주제: str, 키워드: str, 요약: str = "") -> dict:
        """
        구글 검색 노출율(SEO)을 비약적으로 끌어올리는 Schema.org JSON-LD 구조화 데이터를 자동 빌드합니다.
        """
        현재_시간 = datetime.now().isoformat()
        키워드_목록 = [kw.strip() for kw in 키워드.split(",") if kw.strip()]
        
        구조화_객체 = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": 주제,
            "description": 요약 or 주제,
            "keywords": 키워드_목록,
            "datePublished": 현재_시간,
            "dateModified": 현재_시간,
            "author": {
                "@type": "Person",
                "name": "AI SEO Writer"
            },
            "publisher": {
                "@type": "Organization",
                "name": "AI SEO Manager Pro",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://example.com/logo.png"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": "https://example.com/blog"
            }
        }
        return 구조화_객체
        
    @staticmethod
    def 제휴_링크_앵커_추천(원고: str, 활성화: bool = False) -> str:
        """
        구매 전환 및 가입 유도(Affiliate)를 위한 고전환율 앵커 텍스트 구절을 삽입합니다.
        """
        if not 활성화:
            return 원고
            
        추가_텍스트 = """

---

### 💡 실전 추천 및 추가 정보
> **[이 주제와 관련된 추천 상품 및 리얼한 사용자 리뷰 정보 최저가 확인하기](제휴마케팅_링크_입력_자리)**
*이 포스팅은 제휴 마케팅 활동의 일환으로, 일정액의 수수료를 제공받을 수 있으며 블로그 운영에 큰 힘이 됩니다.*
"""
        return 원고 + 추가_텍스트

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

@app.post("/api/keywords")
async def get_keywords(
    req: KeywordRequest, 
    x_gemini_key: Optional[str] = Header(None)
):
    """황금 키워드 발굴 API: 수익화 최우선 기준으로 황금점수 포함 키워드 분석"""
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        [현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}]
        당신은 구글 애드센스·제휴마케팅 수익화 전문 SEO 컨설턴트입니다.
        분석 주제: '{req.topic}'

        ## 황금 키워드 발굴 기준 (수익화 최우선)
        황금 키워드 = 높은 CPC × 적정 검색량(1,000~50,000/월) × 낮은 경쟁도

        ## 분석 지시사항
        1. **구매/상업적 의도**가 높은 키워드를 최우선 선정 (비교, 추천, 가격, 후기, 방법)
        2. **롱테일 키워드** (2~4단어 조합) 위주로 발굴하여 경쟁 최소화
        3. **고수익 분야** 우선 탐색: 금융/보험/건강/법률/IT·SaaS/부동산
        4. 시즌성 없이 **연중 안정적 검색량** 유지하는 키워드 선택
        5. 황금 점수(golden_score)는 아래 가중치로 100점 만점 산정:
           - CPC 높을수록 +40점 (₩2,000 이상=40, ₩500~2,000=20~39, 미만=0~19)
           - 검색량 적정할수록 +30점 (1,000~10,000/월이 최적)
           - 경쟁도 낮을수록 +30점 (낮음=30, 중간=15, 높음=5)
        6. 키워드 5개를 황금 점수 내림차순으로 정렬

        ## 응답 형식 (마크다운 없이 순수 JSON 리스트만)
        [
          {{
            "keyword": "키워드명 (2~4단어 롱테일)",
            "golden_score": 88,
            "cpc_estimate": "₩1,500",
            "monthly_vol": "3,000~5,000",
            "competition": "낮음",
            "intent": "구매형",
            "reason": "수익화 관점의 핵심 추천 사유 (광고주 경쟁, 전환율, 클릭 가치 중심으로 설명)"
          }}
        ]
        """
        
        response = safe_generate_content(api_key, prompt, is_json=True)
        return {"keywords": response.text}
    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        if "API key not valid" in error_msg:
            error_msg = "Gemini API 키가 유효하지 않습니다. 상단 키 관리바에서 확인해주세요."
        raise HTTPException(status_code=400, detail=error_msg)


@app.post("/api/keywords/deep-analyze")
async def deep_analyze_keyword(
    req: 심층_분석_요청,
    x_gemini_key: Optional[str] = Header(None)
):
    """황금 키워드 심층 분석 API: 하나의 키워드에서 파생 롱테일 + 글쓰기 각도 추천"""
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        [현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}]
        당신은 수익형 블로그 SEO 전문가입니다.
        핵심 키워드: '{req.keyword}' (주제: {req.topic})

        ## 심층 분석 지시사항
        이 키워드를 중심으로 수익화 극대화를 위한 다음 분석을 수행하세요:

        1. **파생 롱테일 키워드 10개**: 월간 500~10,000 검색량 + CPC 높은 순
        2. **추천 글쓰기 각도 5가지**: 각 각도별 예상 클릭률(CTR) 높이는 제목 포함
        3. **수익화 전략**: 이 키워드로 수익을 극대화하는 방법 (애드센스, 제휴 링크 배치 등)
        4. **연관 고CPC 키워드 3개**: 함께 타겟팅하면 시너지 효과가 있는 키워드

        ## 응답 형식 (마크다운 없이 순수 JSON만)
        {{
          "longtail_keywords": [
            {{"keyword": "파생 롱테일 키워드", "monthly_vol": "1,000~3,000", "cpc_estimate": "₩800", "competition": "낮음"}}
          ],
          "content_angles": [
            {{"angle": "글쓰기 각도명", "title_example": "클릭을 유도하는 제목 예시", "ctr_boost": "높음"}}
          ],
          "monetization_tips": "광고 배치, 제휴 링크 활용 등 수익화 전략 설명",
          "synergy_keywords": [
            {{"keyword": "연관 키워드", "reason": "시너지 효과 이유"}}
          ]
        }}
        """

        response = safe_generate_content(api_key, prompt, is_json=True)
        return {"analysis": response.text}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-recommendations")
async def get_topic_recommendations(
    req: 분야_추천_요청, 
    x_gemini_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    
    try:
        json_format = '[{"topic": "...", "reason": "...", "expected_cpc": "..."}]'
        prompt = f"'{req.category}' 분야에서 최신 트렌드 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. 반드시 JSON 리스트 포맷으로만 응답해야 해. {json_format}"
        response = safe_generate_content(api_key, prompt, is_json=True, target_model=req.model_name)
        return {"topics": response.text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        error_detail = str(e)
        print(f"Topic recommendation error: {error_detail}")
        raise HTTPException(status_code=400, detail=f"주제 추천 생성 실패: {error_detail}")

class 자동_작성_관리자:
    """블로그 글 작성의 전 과정을 자동화하는 클래스"""
    def __init__(self, api_key: str):
        self.api_key = api_key

    def 주제_생성(self, category: str, target_model: str = None) -> List[dict]:
        json_format = '[{"topic": "...", "reason": "..."}]'
        prompt = f"'{category}' 분야에서 최신 트렌드 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. {json_format}"
        response = safe_generate_content(self.api_key, prompt, is_json=True, target_model=target_model)
        return json.loads(response.text)

    def 키워드_추출(self, topic: str, target_model: str = None) -> str:
        import re
        prompt = f"당신은 SEO 키워드 전문가입니다. '{topic}' 주제에 대해 최신 트렌드 기준 CPC가 높은 핵심 롱테일 키워드 딱 1개만 단답형 단어로 알려주세요. 설명이나 마크다운(#, *) 기호, 문장 일절 없이 오직 '키워드 명칭'만 텍스트로 출력하세요. (예: 클라우드 비용 최적화)"
        response = safe_generate_content(self.api_key, prompt, target_model=target_model)
        raw_text = response.text.strip()

        bold_match = re.findall(r'\*\*(.*?)\*\*', raw_text)
        if bold_match:
            for b in bold_match:
                b_clean = b.strip()
                if 0 < len(b_clean) <= 30 and "설명" not in b_clean and "키워드" not in b_clean:
                    return b_clean

        lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
        for line in lines:
            if ":" in line:
                candidate = line.split(":")[-1].replace("*", "").strip()
                if 0 < len(candidate) <= 30 and "설명" not in candidate:
                    return candidate

        clean_first = re.sub(r'[#*`"\'\[\]]', '', lines[0]).strip() if lines else topic
        if ":" in clean_first:
            clean_first = clean_first.split(":")[-1].strip()
        return clean_first[:30] if clean_first else topic[:20]

    def 원고_생성(self, topic: str, keyword: str, target_model: str = None) -> str:
        prompt = f"""
당신은 어려운 전문 정보도 초보자 눈높이에 맞춰 단 3초 만에 이해하기 쉽게 풀어내는 '친절하고 유능한 생활 밀착형 지식 가이드'입니다.
핵심 키워드인 '{keyword}'의 유용한 정보를 바탕으로 '{topic}' 관련 매력적인 블로그 원고를 마크다운으로 작성해줘.

아래 조건에 맞게 블로그 글을 작성해주세요:

■ 톤 앤 매너:
   - 너무 딱딱한 전문가스러운 훈계나 불필요한 개인적 경력 자랑을 완전히 배제하고, 독자에게 바로 옆에서 이야기해 주는 듯한 '친절하고 명쾌한 구어체 어조(~해요/합니다)'를 사용합니다.
   - 모바일 가독성을 고려하여 불필요한 미사여구를 버리고 문장과 단락을 최대한 간결하게 쳐내어 흡입력을 높입니다.
   - 신뢰감을 주는 핵심 수치와 실용적인 해결책을 직관적이고 빠르게 제시합니다.
   - 지나친 권위 의식을 버리고, 일상에서 즉시 활용할 수 있는 풍부한 생활 밀착형 실용 팁 위주로 구성합니다.

■ 구조:
   1. 도입부 (독자의 관심을 유도하며 빠르게 공감대를 형성하는 가볍고 흡입력 있는 도입)
   2. 핵심 요약 (독자가 가장 궁금해할 내용 3줄 요약)
   3. 본론 (핵심 정보와 개념을 일상적인 비유와 구체적인 예시로 풀어 누구나 쉽게 이해하도록 구성)
   4. 실전 팁 & 주의사항 (일상에서 바로 써먹을 수 있는 진짜 유용한 꿀팁과 꼭 챙겨야 할 주의점)
   5. 마무리 (부드럽고 따뜻한 마무리 인사 및 상세 정보를 확인해볼 수 있는 신뢰도 높은 안내)

■ 길이: 1,000~1,500자 내외 (문단을 짧고 간결하게 유지하여 모바일 환경 가독성을 극대화합니다)
■ 금지: 기계적이고 영혼 없는 'AI스러운' 문체, 오버하는 감성팔이, 지루하게 늘어지는 서론, 가상의 헛소리(할루시네이션) 지어내기 절대 금지.

[추가 필수 규칙]
- 글 내용에 본인이 "30년 차 IT 전문가", "60대 아저씨", "IT 전문가", "IT 아저씨", "베테랑 IT 컨설턴트", "60대 지식 탐구자" 등 자신의 나이, 성별, 경력을 직접 언급하거나 암시하는 단어, 문구, 인사를 **절대 사용하지 마세요.**
- 제시된 키워드 정보 외에 확실치 않은 혜택이나 수치를 임의로 지어내지 마세요.
- 글 내용에서 "SEO", "SEO 최적화" 등의 단어는 절대 언급하지 마세요.
- H1~H3 태그 구조를 갖추고, 본문 중간에 가독성을 위해 글머리 기호(-, *)를 적극 활용하세요.
- 원고가 끝난 후 마지막 줄에 '주요 키워드: ' 다음에 해당 글과 관련된 핵심 키워드 10개를 쉼표(,)로 구분하여 추가해줘.

"""
        response = safe_generate_content(self.api_key, prompt, target_model=target_model)
        return response.text

@app.post("/api/auto-write")
async def auto_write(
    req: 자동_작성_요청,
    x_gemini_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
    
    try:
        관리자 = 자동_작성_관리자(api_key=api_key)
        
        # 1. 주제 결정 (제공되지 않은 경우 추천)
        주제 = req.topic
        if not 주제:
            추천_결과 = 관리자.주제_생성(req.category, target_model=req.model_name)
            주제 = 추천_결과[0]['topic']
            
        # 2. 키워드 추출
        키워드 = 관리자.키워드_추출(주제, target_model=req.model_name)
        
        # 3. 원고 생성
        원고 = 관리자.원고_생성(주제, 키워드, target_model=req.model_name)
        
        # 수익 극대화 로직 적용 (글로벌 룰 준수하여 스네이크 케이스 및 한글 클래스 호출)
        최종_원고 = 수익성_극대화_관리자.애드센스_광고_삽입(원고, req.adsense_optimize)
        최종_원고 = 수익성_극대화_관리자.제휴_링크_앵커_추천(최종_원고, req.affiliate_optimize)
        
        # 요약 및 구조화 데이터 빌드
        요약_텍스트 = 원고[:150].replace("\n", " ").strip() + "..."
        구조화_데이터 = 수익성_극대화_관리자.구조화_데이터_생성(주제, 키워드, 요약_텍스트)
        json_ld_string = json.dumps(구조화_데이터, ensure_ascii=False, indent=2)
        
        # 4. 티스토리 발행 (토큰이 있는 경우, 티스토리는 HTML만 받으므로 변환 필요)
        발행_결과 = None
        if req.tistory_token and req.tistory_blog:
            try:
                article_html = markdown.markdown(최종_원고, extensions=['fenced_code', 'tables'])
                seo_optimized_html = f"<script type=\"application/ld+json\">\n{json_ld_string}\n</script>\n\n{article_html}"
                
                tistory_url = "https://www.tistory.com/apis/post/write"
                data = {
                    "access_token": req.tistory_token,
                    "output": "json",
                    "blogName": req.tistory_blog,
                    "title": f"[{키워드}] {주제}",
                    "content": seo_optimized_html,
                    "visibility": 0
                }
                res = requests.post(tistory_url, data=data)
                발행_결과 = res.json()
            except Exception as publish_error:
                print(f"Publish failed: {publish_error}")

        return {
            "success": True,
            "topic": 주제,
            "keyword": 키워드,
            "article": 최종_원고,
            "json_ld": 구조화_데이터,
            "publish_result": 발행_결과
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-article")
async def generate_article(
    req: ArticleRequest, 
    x_gemini_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
당신은 어려운 전문 정보도 초보자 눈높이에 맞춰 단 3초 만에 이해하기 쉽게 풀어내는 '친절하고 유능한 생활 밀착형 지식 가이드'입니다.
핵심 키워드인 '{req.keyword}'의 유용한 정보를 바탕으로 '{req.topic}' 관련 매력적인 블로그 원고를 마크다운으로 작성해줘.

아래 조건에 맞게 블로그 글을 작성해주세요:

■ 톤 앤 매너:
   - 너무 딱딱한 전문가스러운 훈계나 불필요한 개인적 경력 자랑을 완전히 배제하고, 독자에게 바로 옆에서 이야기해 주는 듯한 '친절하고 명쾌한 구어체 어조(~해요/합니다)'를 사용합니다.
   - 모바일 가독성을 고려하여 불필요한 미사여구를 버리고 문장과 단락을 최대한 간결하게 쳐내어 흡입력을 높입니다.
   - 신뢰감을 주는 핵심 수치와 실용적인 해결책을 직관적이고 빠르게 제시합니다.
   - 지나친 권위 의식을 버리고, 일상에서 즉시 활용할 수 있는 풍부한 생활 밀착형 실용 팁 위주로 구성합니다.

■ 구조:
   1. 도입부 (독자의 관심을 유도하며 빠르게 공감대를 형성하는 가볍고 흡입력 있는 도입)
   2. 핵심 요약 (독자가 가장 궁금해할 내용 3줄 요약)
   3. 본론 (핵심 정보와 개념을 일상적인 비유와 구체적인 예시로 풀어 누구나 쉽게 이해하도록 구성)
   4. 실전 팁 & 주의사항 (일상에서 바로 써먹을 수 있는 진짜 유용한 꿀팁과 꼭 챙겨야 할 주의점)
   5. 마무리 (부드럽고 따뜻한 마무리 인사 및 상세 정보를 확인해볼 수 있는 신뢰도 높은 안내)

■ 길이: 1,000~1,500자 내외 (문단을 짧고 간결하게 유지하여 모바일 환경 가독성을 극대화합니다)
■ 금지: 기계적이고 영혼 없는 'AI스러운' 문체, 오버하는 감성팔이, 지루하게 늘어지는 서론, 가상의 헛소리(할루시네이션) 지어내기 절대 금지.

[추가 필수 규칙]
- 글 내용에 본인이 "30년 차 IT 전문가", "60대 아저씨", "IT 전문가", "IT 아저씨", "베테랑 IT 컨설턴트", "60대 지식 탐구자" 등 자신의 나이, 성별, 경력을 직접 언급하거나 암시하는 단어, 문구, 인사를 **절대 사용하지 마세요.**
- 제시된 키워드 정보 외에 확실치 않은 혜택이나 수치를 임의로 지어내지 마세요.
- 글 내용에서 "SEO", "SEO 최적화" 등의 단어는 절대 언급하지 마세요.
- H1~H3 태그 구조를 갖추고 메타 설명도 포함하세요. 가독성을 위해 글머리 기호(-, *)를 적극 활용하세요.
- 원고가 끝난 후 마지막 줄에 '주요 키워드: ' 다음에 해당 글과 관련된 핵심 키워드 10개를 쉼표(,)로 구분하여 추가해줘.

"""
        
        response = safe_generate_content(api_key, prompt)
        원고 = response.text
        
        # 수익 극대화 로직 적용 (글로벌 룰 준수하여 스네이크 케이스 및 한글 클래스 호출)
        최종_원고 = 수익성_극대화_관리자.애드센스_광고_삽입(원고, req.adsense_optimize)
        최종_원고 = 수익성_극대화_관리자.제휴_링크_앵커_추천(최종_원고, req.affiliate_optimize)
        
        # 요약본을 간단하게 생성 (첫 도입부 150글자 활용)
        요약_텍스트 = 원고[:150].replace("\n", " ").strip() + "..."
        구조화_데이터 = 수익성_극대화_관리자.구조화_데이터_생성(req.topic, req.keyword, 요약_텍스트)
        
        # HTML로 변환된 최종 원고 생성
        html_원고 = markdown.markdown(최종_원고, extensions=['fenced_code', 'tables'])
        
        return {
            "article": 최종_원고,
            "html_article": html_원고,
            "json_ld": 구조화_데이터
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def translate_prompt_to_english(prompt: str, api_key: Optional[str] = None) -> str:
    """
    한국어 주제어를 블로그 썸네일 전용 영어 이미지 프롬프트로 변환.
    단순 번역이 아닌, 주제에 최적화된 장면·구도·스타일을 Gemini가 직접 설계.
    """
    # 이미 영어인지 간단히 판별 (한글 유니코드 범위: AC00~D7A3)
    has_korean = any('\uAC00' <= c <= '\uD7A3' for c in prompt)
    if not has_korean:
        print("프롬프트가 이미 영어입니다. 번역 생략.")
        return prompt

    if not api_key:
        print("Gemini API 키 없음. 원본 프롬프트 사용.")
        return prompt

    try:
        translation_prompt = f"""당신은 AI 이미지 생성 전문 프롬프트 엔지니어입니다.
아래 한국어 블로그 주제어를 보고, 그 주제를 가장 잘 표현하는 블로그 썸네일 이미지를 위한 영어 프롬프트를 작성하세요.

[핵심 규칙]
1. 주제와 직접적으로 관련된 구체적인 장면과 피사체를 묘사할 것
   예) "미국 배당주 장기투자" → Wall Street building, stock dividend chart, American dollar bills, long-term growth graph
2. 사용자가 요청한 이미지 스타일이 있다면 그 스타일(예: 일러스트, 수채화, 3D 등)을 완벽하게 반영하는 영어 태그를 넣고, 지정된 스타일이 없다면 기본적으로 사실적이고 전문적인 사진(photorealistic, 8K) 스타일로 지시할 것
3. 구도와 분위기도 포함할 것
   예) wide shot, cinematic composition, dramatic lighting, high contrast
4. 블로그 썸네일로서의 클릭률(CTR)과 가독성을 극대화하기 위해, 시선을 사로잡는 선명한 대조(vibrant contrast)를 이루게 할 것. 또한 나중에 이미지 위에 중앙 정렬 텍스트가 얹어지기 적당한 세련되고 깔끔한 레이아웃 여백 배치(clean, negative space in the center, or a simple neat backdrop for text overlay)를 보장하도록 프롬프트를 보강할 것.
5. 반드시 영어 텍스트만 출력하고, 설명·번역·따옴표는 절대 포함하지 말 것

[한국어 주제어]
{prompt}

[영어 이미지 프롬프트 출력]"""
        response = safe_generate_content(api_key, translation_prompt)
        translated = response.text.strip()
        print(f"프롬프트 번역 완료:\n  원본: {prompt}\n  번역: {translated}")
        return translated
    except Exception as e:
        print(f"Gemini 번역 실패 ({e}). MyMemory 무료 번역 API로 2차 시도...")
        try:
            import urllib.parse
            encoded_query = urllib.parse.quote(prompt)
            res = requests.get(f"https://api.mymemory.translated.net/get?q={encoded_query}&langpair=ko|en", timeout=10)
            if res.status_code == 200:
                translated = res.json().get('responseData', {}).get('translatedText', prompt)
                print(f"무료 API 번역 완료: {translated}")
                return translated
        except Exception as e2:
            print(f"2차 번역 실패 ({e2}). 원본 프롬프트 사용.")
            
        return prompt



async def generate_pollinations_image(prompt: str, api_key: Optional[str] = None, resolution: str = "1024x1024") -> dict:
    """
    Pollinations.ai를 이용한 무료 이미지 생성 (API 키 불필요)
    Gemini/OpenAI 실패 시 자동 폴백으로 사용.
    한국어 프롬프트는 Gemini로 영어 번역 후 전달.
    blocking requests.get은 executor로 비동기 처리.
    """
    import urllib.parse
    import asyncio

    # 한국어 → 영어 번역 (동기 함수를 executor로 비동기 실행)
    loop = asyncio.get_event_loop()
    english_prompt = await loop.run_in_executor(
        None, translate_prompt_to_english, prompt, api_key
    )

    def _fetch_image(url: str) -> requests.Response:
        """blocking HTTP GET을 별도 스레드에서 실행 (DNS/네트워크 오류 대비 재시도 로직)"""
        import time
        last_error = None
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        for attempt in range(3):
            try:
                return requests.get(url, headers=headers, timeout=20)
            except Exception as e:
                last_error = e
                print(f"Pollinations.ai 요청 실패 (시도 {attempt+1}/3) - 1초 후 재시도: {e}")
                time.sleep(1)
        raise last_error

    try:
        width, height = 1024, 1024
        if "x" in resolution:
            try:
                width = int(resolution.split("x")[0])
                height = int(resolution.split("x")[1])
            except:
                pass

        encoded_prompt = urllib.parse.quote(english_prompt)
        image_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width={width}&height={height}&nologo=true&enhance=false"
        )
        print(f"Pollinations.ai 요청 URL: {image_url[:120]}...")

        # blocking HTTP 요청을 executor로 비동기 실행
        response = await loop.run_in_executor(None, _fetch_image, image_url)

        if response.status_code == 200 and "image" in response.headers.get("content-type", ""):
            img_base64 = base64.b64encode(response.content).decode("utf-8")
            img_mime = response.headers.get("content-type", "image/jpeg").split(";")[0]
            print(f"Pollinations.ai 성공 ({len(response.content):,} bytes)")
            return {"image_url": f"data:{img_mime};base64,{img_base64}", "source": "pollinations"}
        else:
            raise Exception(f"Pollinations.ai 응답 오류: HTTP {response.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Pollinations.ai 실패: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요. (오류: {str(e)})"
        )


IMAGE_CACHE = {}

@app.post("/api/generate-image")
async def generate_image(
    req: ImageRequest, 
    x_gemini_key: Optional[str] = Header(None),
    x_openai_key: Optional[str] = Header(None)
):
    from fastapi.responses import StreamingResponse
    import json

    async def event_generator():
        api_key = x_gemini_key or GEMINI_API_KEY
        cache_key = f"{req.prompt_base}"
        
        if cache_key in IMAGE_CACHE:
            yield f"data: {json.dumps({'status': 'progress', 'message': '이미지 캐시 히트! 이전 생성 결과 반환 중...'})}\n\n"
            yield f"data: {json.dumps({'status': 'success', 'image_url': IMAGE_CACHE[cache_key]['image_url'], 'source': IMAGE_CACHE[cache_key]['source']})}\n\n"
            return

        yield f"data: {json.dumps({'status': 'progress', 'message': '0단계: 프롬프트 분석 및 최적화 중...'})}\n\n"

        # 1순위: Gemini 네이티브 이미지 생성
        if api_key:
            api_keys = [k.strip() for k in api_key.split(",") if k.strip()]
            for index, api_key_single in enumerate(api_keys):
                yield f"data: {json.dumps({'status': 'progress', 'message': f'1단계: Gemini {index+1}번 API 키로 고화질 이미지 생성 시도 중...'})}\n\n"
                try:
                    def _call_gemini():
                        client = genai.Client(api_key=api_key_single)
                        return client.models.generate_content(
                            model='gemini-2.5-flash-image',
                            contents=[f"{req.prompt_base} (Resolution/Aspect Ratio: {req.resolution})"],
                            config=types.GenerateContentConfig(
                                response_modalities=['TEXT', 'IMAGE']
                            )
                        )
                    import asyncio
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(None, _call_gemini)

                    for part in response.parts:
                        if part.inline_data is not None:
                            img_bytes = part.inline_data.data
                            img_mime = part.inline_data.mime_type or 'image/png'
                            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                            IMAGE_CACHE[cache_key] = {"image_url": f"data:{img_mime};base64,{img_base64}", "source": "gemini"}
                            yield f"data: {json.dumps({'status': 'success', 'image_url': f'data:{img_mime};base64,{img_base64}', 'source': 'gemini'})}\n\n"
                            return
                except Exception as e:
                    print(f"Gemini {index+1}번 키 실패: {e}")
                    yield f"data: {json.dumps({'status': 'progress', 'message': f'Gemini {index+1}번 키 실패 (할당량 초과/오류). 다음 옵션 탐색 중...'})}\n\n"

        # 2순위: OpenAI DALL-E 3 (폴백)
        openai_api_key = x_openai_key or OPENAI_API_KEY
        if openai_api_key:
            openai_keys = [k.strip() for k in openai_api_key.split(",") if k.strip()]
            for index, o_key in enumerate(openai_keys):
                yield f"data: {json.dumps({'status': 'progress', 'message': f'2단계 (폴백): OpenAI {index+1}번 API 키로 이미지 생성 시도 중...'})}\n\n"
                try:
                    openai_client = OpenAI(api_key=o_key)
                    def _call_openai():
                        return openai_client.images.generate(
                            model="dall-e-3",
                            prompt=req.prompt_base,
                            size=req.resolution,
                            n=1,
                        )
                    import asyncio
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(None, _call_openai)
                    IMAGE_CACHE[cache_key] = {"image_url": response.data[0].url, "source": "openai"}
                    yield f"data: {json.dumps({'status': 'success', 'image_url': response.data[0].url, 'source': 'openai'})}\n\n"
                    return
                except Exception as e:
                    print(f"OpenAI {index+1}번 키 실패: {e}")
                    yield f"data: {json.dumps({'status': 'progress', 'message': f'OpenAI {index+1}번 키 실패. 다음 옵션 탐색 중...'})}\n\n"

        # 3순위: Pollinations.ai (완전 무료)
        yield f"data: {json.dumps({'status': 'progress', 'message': '3단계 (폴백): Pollinations AI 활용을 위한 프롬프트 영문 번역 중...'})}\n\n"
        yield f"data: {json.dumps({'status': 'progress', 'message': '4단계: Pollinations AI 무료 엔진을 통한 최종 이미지 렌더링 중...'})}\n\n"
        try:
            pollinations_result = await generate_pollinations_image(req.prompt_base, api_key, req.resolution)
            IMAGE_CACHE[cache_key] = pollinations_result
            yield f"data: {json.dumps({'status': 'success', 'image_url': pollinations_result['image_url'], 'source': pollinations_result['source']})}\n\n"
        except Exception as e:
            print(f"Pollinations AI 생성 실패: {e}")
            yield f"data: {json.dumps({'status': 'error', 'message': '5단계 오류: 무료 생성 엔진(Pollinations AI)이 응답하지 않거나 시간 초과가 발생했습니다. 유효한 Gemini API 키를 등록하시거나 잠시 후 다시 시도해 주세요.'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")



@app.post("/api/publish-tistory")
async def publish_tistory(
    req: PublishRequest,
    x_gemini_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
        
    try:
        # 1. 텍스트 원고(Markdown) 생성
        client = genai.Client(api_key=api_key)
        prompt = f"""
당신은 어려운 전문 정보도 초보자 눈높이에 맞춰 단 3초 만에 이해하기 쉽게 풀어내는 '친절하고 유능한 생활 밀착형 지식 가이드'입니다.
핵심 키워드인 '{req.keyword}'의 유용한 정보를 바탕으로 '{req.topic}' 관련 매력적인 블로그 원고를 마크다운으로 작성해줘.

아래 조건에 맞게 블로그 글을 작성해주세요:

■ 톤 앤 매너:
   - 너무 딱딱한 전문가스러운 훈계나 불필요한 개인적 경력 자랑을 완전히 배제하고, 독자에게 바로 옆에서 이야기해 주는 듯한 '친절하고 명쾌한 구어체 어조(~해요/합니다)'를 사용합니다.
   - 모바일 가독성을 고려하여 불필요한 미사여구를 버리고 문장과 단락을 최대한 간결하게 쳐내어 흡입력을 높입니다.
   - 신뢰감을 주는 핵심 수치와 실용적인 해결책을 직관적이고 빠르게 제시합니다.
   - 지나친 권위 의식을 버리고, 일상에서 즉시 활용할 수 있는 풍부한 생활 밀착형 실용 팁 위주로 구성합니다.

■ 구조:
   1. 도입부 (독자의 관심을 유도하며 빠르게 공감대를 형성하는 가볍고 흡입력 있는 도입)
   2. 핵심 요약 (독자가 가장 궁금해할 내용 3줄 요약)
   3. 본론 (핵심 정보와 개념을 일상적인 비유와 구체적인 예시로 풀어 누구나 쉽게 이해하도록 구성)
   4. 실전 팁 & 주의사항 (일상에서 바로 써먹을 수 있는 진짜 유용한 꿀팁과 꼭 챙겨야 할 주의점)
   5. 마무리 (부드럽고 따뜻한 마무리 인사 및 상세 정보를 확인해볼 수 있는 신뢰도 높은 안내)

■ 길이: 1,000~1,500자 내외 (문단을 짧고 간결하게 유지하여 모바일 환경 가독성을 극대화합니다)
■ 금지: 기계적이고 영혼 없는 'AI스러운' 문체, 오버하는 감성팔이, 지루하게 늘어지는 서론, 가상의 헛소리(할루시네이션) 지어내기 절대 금지.

[추가 필수 규칙]
- 글 내용에 본인이 "30년 차 IT 전문가", "60대 아저씨", "IT 전문가", "IT 아저씨", "베테랑 IT 컨설턴트", "60대 지식 탐구자" 등 자신의 나이, 성별, 경력을 직접 언급하거나 암시하는 단어, 문구, 인사를 **절대 사용하지 마세요.**
- 제시된 키워드 정보 외에 확실치 않은 혜택이나 수치를 임의로 지어내지 마세요.
- 글 내용에서 "SEO", "SEO 최적화" 등의 단어는 절대 언급하지 마세요.
- H1~H3 태그 구조를 갖추고 메타 설명도 포함하세요. 가독성을 위해 글머리 기호(-, *)를 적극 활용하세요.
- 원고가 끝난 후 마지막 줄에 '주요 키워드: ' 다음에 해당 글과 관련된 핵심 키워드 10개를 쉼표(,)로 구분하여 추가해줘.

"""
        
        response = safe_generate_content(api_key, prompt)
        article_md = response.text
        
        # 수익 극대화 로직 적용 (글로벌 룰 준수하여 스네이크 케이스 및 한글 클래스 호출)
        최종_원고 = 수익성_극대화_관리자.애드센스_광고_삽입(article_md, req.adsense_optimize)
        최종_원고 = 수익성_극대화_관리자.제휴_링크_앵커_추천(최종_원고, req.affiliate_optimize)
        
        # 요약 및 구조화 데이터 생성
        요약_텍스트 = article_md[:150].replace("\n", " ").strip() + "..."
        구조화_데이터 = 수익성_극대화_관리자.구조화_데이터_생성(req.topic, req.keyword, 요약_텍스트)
        json_ld_string = json.dumps(구조화_데이터, ensure_ascii=False, indent=2)
        
        # HTML 변환 및 머리에 JSON-LD 스크립트 추가
        article_html = markdown.markdown(최종_원고, extensions=['fenced_code', 'tables'])
        seo_optimized_html = f"<script type=\"application/ld+json\">\n{json_ld_string}\n</script>\n\n{article_html}"
        
        # 3. 티스토리에 발행 (임시저장)
        tistory_url = "https://www.tistory.com/apis/post/write"
        data = {
            "access_token": req.tistory_token,
            "output": "json",
            "blogName": req.tistory_blog,
            "title": f"[{req.keyword}] {req.topic} 핵심 정리",
            "content": seo_optimized_html,
            "visibility": 0  # 0: 비공개(임시저장), 3: 발행
        }
        res = requests.post(tistory_url, data=data)
        if res.status_code == 200:
            result = res.json()
            if result.get('tistory', {}).get('status') == '200':
                post_url = result['tistory'].get('url', '')
                return {
                    "success": True, 
                    "url": post_url,
                    "article": seo_optimized_html,
                    "json_ld": 구조화_데이터
                }
            else:
                raise Exception(str(result))
        else:
            raise Exception(f"Tistory API error: {res.text}")
            
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# 콘텐츠 관리 및 발행 대기열 API (고도화 시스템)
# ==============================================================================

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
        photos_info = []
        for idx, p in enumerate(req.photos[:2]):
            caption = p.caption.strip() if p.caption else f"방문 사진 {idx+1}"
            photos_info.append(f"- 사진 {idx+1}: {caption}")
        photos_desc = "\n".join(photos_info) if photos_info else "첨부된 사진 없음"

        prompt = f"""
당신은 네이버 블로그 스마트블록 및 다음/구글 검색 상위 노출 전문 '미식·여행 인플루언서'입니다.
실제 직접 방문하여 맛보고 경험한 생생한 '내돈내산 솔직 방문 후기'를 전문 블로그 포스팅으로 작성해주세요.

[방문 매장 정보]
- 식당/장소명: {req.restaurant_name}
- 위치/지역: {req.location or '해당 지역 중심가'}
- 지도/사이트 링크: {req.place_url or '제공되지 않음'}
- 대표 메뉴 및 가격: {req.menu_info or '대표 시그니처 메뉴'}
- 방문 특이사항 및 솔직 메모: {req.special_notes or '친절하고 분위기 좋음, 재방문 의사 있음'}
- 만족도/별점: {req.rating or '5.0'} / 5.0
- 등록된 사진 정보:
{photos_desc}

[필수 작성 지침 및 포맷]
1. 제목:
   - 검색 사용자의 클릭률(CTR)을 극대화하는 매력적인 SEO 최적화 제목을 지어주세요.
   - 예시: [{req.location or '핫플'} 맛집] {req.restaurant_name} 솔직 후기! 대표메뉴 3가지와 웨이팅·주차 꿀팁 총정리
2. 톤 앤 매너:
   - 직접 다녀온 경험을 풀어내는 생생한 E-E-A-T 기반의 친근하고 다정한 블로그 어조(~했어요, ~있더라고요, ~추천해요)를 유지하세요.
   - 뻔하고 기계적인 AI 말투나 과도한 미사여구를 배제하고, 실제 손님의 입장에서 느낀 장단점과 팁을 솔직하게 기술하세요.
   - 모바일에서 읽기 편하게 2~3줄 단위로 줄바꿈을 적용하세요.
3. 본문 구성 및 사진 슬롯 마커 배치:
   - [도입부]: 방문하게 된 계기와 첫인상, 매장 외관
   - [소제목 1: 위치 & 매장 분위기, 웨이팅/주차 꿀팁]:
     - 인테리어 분위기, 테이블 간격, 예약/웨이팅 방법, 주차장 정보 등 현실적인 팁.
     - 본문 중간 적절한 위치에 반드시 다음 마커를 단독 라인으로 삽입하세요:
       <!-- [PHOTO_1_SLOT] -->
   - [소제목 2: 대표 메뉴 솔직 맛 평가]:
     - 주문한 메뉴들의 비주얼, 향, 식감, 양, 가격 대비 만족도(가성비)를 상세히 묘사.
     - 사진이 2장 등록되어 있다면, 이 단락 중간 적절한 위치에 다음 마커를 단독 라인으로 삽입하세요:
       <!-- [PHOTO_2_SLOT] -->
   - [소제목 3: 방문 전 필독! 핵심 요약표]:
     - 상호명, 위치, 주요 메뉴/가격, 웨이팅 팁, 주차 여부, 총점 등을 깔끔한 마크다운 표(Table)로 정리.
   - [소제목 4: 위치 안내 및 지도 정보]:
     - 식당 위치와 지도 링크 안내
   - [마무리 총평]:
     - 이런 분들께 추천합니다 (데이트, 가족모임, 친구 모임 등), 최종 한 줄 평.
4. 검색 태그 (10~15개):
   - 해당 지역, 식당명, 메뉴명, 추천 대상, 내돈내산 등 유입 키워드를 다각도로 선정.

반드시 아래 JSON 포맷으로만 응답해야 합니다:
{{
  "title": "클릭률 높은 블로그 제목",
  "content_markdown": "작성된 전체 마크다운 본문 (<!-- [PHOTO_1_SLOT] --> 등 포함)",
  "meta_description": "검색엔진 노출용 120자 내외의 흥미로운 메타 설명",
  "tags": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5", "키워드6", "키워드7", "키워드8", "키워드9", "키워드10"],
  "primary_keyword": "{req.restaurant_name}",
  "related_keywords": "{req.location or ''} {req.restaurant_name}, {req.restaurant_name} 후기"
}}
"""

        response = safe_generate_content(api_key, prompt, is_json=True, target_model=req.model_name)
        result_json = json.loads(response.text)

        title = result_json.get("title", f"{req.restaurant_name} 방문 솔직 후기")
        raw_markdown = result_json.get("content_markdown", "")
        meta_desc = result_json.get("meta_description", "")
        tags_list = result_json.get("tags", [req.restaurant_name, "맛집후기", "내돈내산"])
        primary_kw = result_json.get("primary_keyword", req.restaurant_name)
        related_kws = result_json.get("related_keywords", "")

        # 1. 마크다운 내 사진 슬롯 처리
        markdown_for_editor = raw_markdown
        for idx in range(2):
            slot = f"<!-- [PHOTO_{idx+1}_SLOT] -->"
            if idx < len(req.photos) and req.photos[idx]:
                cap = req.photos[idx].caption or f"사진 {idx+1}"
                img_md = f"\n\n> 📸 **[사진 {idx+1}: {cap}]**\n"
                markdown_for_editor = markdown_for_editor.replace(slot, img_md)
            else:
                markdown_for_editor = markdown_for_editor.replace(slot, "")

        # 2. 티스토리 완벽 지원 HTML 렌더링
        html_body = markdown.markdown(raw_markdown, extensions=['tables', 'fenced_code'])

        for idx in range(2):
            slot = f"<!-- [PHOTO_{idx+1}_SLOT] -->"
            if idx < len(req.photos) and req.photos[idx]:
                photo = req.photos[idx]
                cap = photo.caption or f"{req.restaurant_name} 방문 사진 {idx+1}"
                img_src = photo.data_url if photo.data_url else "https://via.placeholder.com/800x500?text=Food+Review+Photo"
                
                figure_html = f"""
<figure class="tistory-review-image" style="margin: 28px 0; text-align: center; display: block;">
  <img src="{img_src}" alt="{cap}" style="max-width: 100%; height: auto; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.12); margin: 0 auto; display: inline-block;" />
  <figcaption style="font-size: 13px; color: #71717a; margin-top: 10px; font-weight: 500; text-align: center;">📷 {cap}</figcaption>
</figure>
"""
                html_body = html_body.replace(slot, figure_html)
            else:
                html_body = html_body.replace(slot, "")

        if req.place_url:
            link_box = f"""
<div style="margin: 30px 0; padding: 18px 22px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; line-height: 1.6; color: #334155;">
  <strong style="color: #0284c7; font-size: 15px;">📍 {req.restaurant_name} 매장 정보 바로가기</strong><br/>
  <span style="color: #64748b;">자세한 위치 및 예약 정보는 아래 링크에서 확인하실 수 있습니다:</span><br/>
  <a href="{req.place_url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600; word-break: break-all;">👉 {req.place_url}</a>
</div>
"""
            html_body += link_box

        # 사용자의 요청에 따라 본문 내 광고 플레이스홀더 영역은 완전히 제거 (삽입하지 않음)

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
                    "name": "내돈내산 솔직 리뷰어"
                },
                "reviewBody": meta_desc or f"{req.restaurant_name} 방문 솔직 후기 및 꿀팁 정리"
            }
        }

        # 티스토리 에디터 상단에 거추장스러운 회색 SCRIPT 박스가 뜨지 않도록 구조화 데이터는 글 최하단에 배치
        json_ld_str = f'\n\n<!-- [구글 SEO 검색 최적화 구조화 데이터 - 방문자 화면에는 보이지 않음] -->\n<script type="application/ld+json">\n{json.dumps(json_ld_schema, ensure_ascii=False, indent=2)}\n</script>'
        full_html_package = html_body + json_ld_str


        return {
            "title": title,
            "article": markdown_for_editor,
            "html_article": full_html_package,
            "tags": tags_list,
            "tags_string": ", ".join(tags_list),
            "tags_hash_string": " ".join([f"#{t}" for t in tags_list]),
            "meta_description": meta_desc,
            "primary_keyword": primary_kw,
            "related_keywords": related_kws,
            "json_ld": json_ld_schema,
            "restaurant_name": req.restaurant_name,
            "location": req.location,
            "category": req.category or "맛집/카페",
            "photos_count": len(req.photos)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"맛집 후기 생성 실패: {str(e)}")

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
            action=req.publish_action or "TEMP_SAVE"
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
        connection = engine.get_connection_status()
        metrics = engine.fetch_metrics(days=days)
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
        config = analytics.load_analytics_config()
        return {
            "success": True,
            "config": {
                "site_url": config.get("site_url", "https://s-elegant.tistory.com/"),
                "gsc_connected": config.get("gsc_connected", False),
                "adsense_connected": config.get("adsense_connected", False),
                "adsense_account_id": config.get("adsense_account_id", ""),
                "gsc_auth_type": config.get("gsc_auth_type", "SERVICE_ACCOUNT"),
                "service_account_email": config.get("service_account_email", ""),
                "last_sync": config.get("last_sync")
            }
        }
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
    Claude.ai 웹 브라우저 창을 띄워 사용자가 미리 로그인할 수 있도록 지원
    """
    def _open():
        import claude_bot
        claude_bot._cleanup_stale_chrome(claude_bot.CLAUDE_PROFILE_DIR)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=claude_bot.CLAUDE_PROFILE_DIR,
                headless=False,
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(claude_bot.CLAUDE_NEW_URL)
            
            # 사용자가 로그인할 수 있도록 최대 180초 동안 대기 (입력창이 나타나면 조기 완료)
            start_t = time.time()
            while time.time() - start_t < 180:
                try:
                    for sel in ["div[contenteditable='true']", "textarea"]:
                        if page.locator(sel).first.is_visible(timeout=1000):
                            time.sleep(2)
                            return
                except Exception:
                    pass
                time.sleep(2)

    try:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            executor.submit(_open).result()
        return {"success": True, "message": "Claude 브라우저가 실행되었습니다. 로그인을 완료해주세요."}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"브라우저 실행 실패: {str(e)}")

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
                action="TEMP_SAVE"
            )
            tistory_saved = bot_res.get("success", False)
            tistory_msg = bot_res.get("message", "")
            if not tistory_saved:
                tistory_msg = bot_res.get("error") or "티스토리 임시저장 중 문제가 발생했습니다."
            else:
                database.log_publish_history(
                    content_id=content_id,
                    blog_name=blog_name,
                    action="TEMP_SAVE",
                    status="SUCCESS",
                    post_url="",
                    error_message=""
                )

        return {
            "success": True,
            "content_id": content_id,
            "title": title,
            "article": article,
            "html_article": html_article,
            "tags": tags,
            "tags_string": tags_string,
            "meta_description": meta_description,
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


