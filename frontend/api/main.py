import os
import base64
import json
import traceback
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from openai import OpenAI
from dotenv import load_dotenv
import requests
import markdown

load_dotenv()

# Vercel 배포 시에는 제목에 배포 환경임을 명시
app = FastAPI(title="AI SEO Manager Beta (Vercel Stable Engine)")

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

class ImageRequest(BaseModel):
    prompt_base: str

class PublishRequest(BaseModel):
    topic: str
    keyword: str
    tistory_token: str
    tistory_blog: str

class 분야_추천_요청(BaseModel):
    category: str

class 자동_작성_요청(BaseModel):
    category: str
    topic: Optional[str] = None
    tistory_token: Optional[str] = None
    tistory_blog: Optional[str] = None

class 심층_분석_요청(BaseModel):
    keyword: str
    topic: str

@app.get("/")
async def root():
    return {"message": "AI SEO Manager (Vercel Engine) is running"}

async def safe_generate_content_async(client, prompt, config=None, is_json=False):
    """Vercel 10초 타임아웃을 고려한 최적화된 재시도 및 폴백 함수 (2026년형)"""
    models_to_try = [
        'gemini-2.5-flash-lite', 
        'gemini-2.0-flash',
        'gemini-1.5-flash-8b'
    ]
    
    last_exception = None
    
    for model_name in models_to_try:
        # Vercel 타임아웃(10s)을 고려하여 재시도 간격을 짧게 설정 (총 대기 3초)
        backoff_times = [1, 2] 
        for attempt, sleep_time in enumerate(backoff_times):
            try:
                if is_json:
                    if not config:
                        config = types.GenerateContentConfig(response_mime_type="application/json")
                    else:
                        config.response_mime_type = "application/json"
                
                # API 호출 (동기 함수를 비동기로 실행하거나 그대로 호출 - google-genai는 기본 동기)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config
                )
                return response
            except Exception as e:
                last_exception = e
                err_msg = str(e).upper()
                if "503" in err_msg or "UNAVAILABLE" in err_msg or "429" in err_msg:
                    print(f"Retrying {model_name} in {sleep_time}s due to load...")
                    await asyncio.sleep(sleep_time)
                    continue
                else:
                    break
    
    raise last_exception

@app.post("/api/keywords")
async def get_keywords(req: KeywordRequest, x_gemini_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key: raise HTTPException(status_code=500, detail="API Key missing")
    
    client = genai.Client(api_key=api_key)
    prompt = f"""
        [현재 시점: 2026년 4월]
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
    try:
        response = await safe_generate_content_async(client, prompt, is_json=True)
        return {"keywords": response.text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/keywords/deep-analyze")
async def deep_analyze_keyword(
    req: 심층_분석_요청,
    x_gemini_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key: raise HTTPException(status_code=500, detail="Gemini API Key not configured")

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        [현재 시점: 2026년 4월]
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
            {{"angle": "글쓰기 각도명", "title_example": "클릭 유도 제목 예시", "ctr_boost": "높음"}}
          ],
          "monetization_tips": "광고 배치, 제휴 링크 활용 등 수익화 전략 설명",
          "synergy_keywords": [
            {{"keyword": "연관 키워드", "reason": "시너지 효과 이유"}}
          ]
        }}
        """

        response = await safe_generate_content_async(client, prompt, is_json=True)
        return {"analysis": response.text}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-recommendations")
async def get_topic_recommendations(req: 분야_추천_요청, x_gemini_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key: raise HTTPException(status_code=500, detail="API Key missing")
    
    client = genai.Client(api_key=api_key)
    prompt = f"[현재 시점: 2026년 4월] '{req.category}' 분야에서 2026년 트렌드를 반영한 수익성 높은 주제 3개를 JSON으로 추천해줘. [{{'topic': '...', 'reason': '...', 'expected_cpc': '...'}}]"
    
    try:
        response = await safe_generate_content_async(client, prompt, is_json=True)
        return {"topics": response.text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class 자동_작성_관리자:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def 주제_생성(self, category: str):
        prompt = f"[현재 시점: 2026년 4월] '{category}' 주제 3개 추천 (JSON)"
        res = await safe_generate_content_async(self.client, prompt, is_json=True)
        return json.loads(res.text)

    async def 키워드_추출(self, topic: str):
        prompt = f"[현재 시점: 2026년 4월] '{topic}' 주제 고단가 키워드 1개 전송"
        res = await safe_generate_content_async(self.client, prompt)
        return res.text.strip()

    async def 원고_생성(self, topic: str, keyword: str):
        prompt = f"[현재 시점: 2026년 4월] '{keyword}' 중심 '{topic}' 관련 2026년 SEO 원고 작성 (마크다운)"
        res = await safe_generate_content_async(self.client, prompt)
        return res.text

@app.post("/api/auto-write")
async def auto_write(req: 자동_작성_요청, x_gemini_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    관리자 = 자동_작성_관리자(api_key=api_key)
    try:
        주제 = req.topic
        if not 주제:
            추천 = await 관리자.주제_생성(req.category)
            주제 = 추천[0]['topic']
        키워드 = await 관리자.키워드_추출(주제)
        원고 = await 관리자.원고_생성(주제, 키워드)
        return {"success": True, "topic": 주제, "keyword": 키워드, "article": 원고}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-article")
async def generate_article(req: ArticleRequest, x_gemini_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    client = genai.Client(api_key=api_key)
    prompt = f"[현재 시점: 2026년 4월] '{req.keyword}' 중심 '{req.topic}' 2026년 SEO 원고 작성"
    try:
        response = await safe_generate_content_async(client, prompt)
        return {"article": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def generate_image(req: ImageRequest, x_gemini_key: Optional[str] = Header(None), x_openai_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    if api_key:
        try:
            client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
            response = client.models.generate_images(model='imagen-3.0-generate-001', prompt=req.prompt_base)
            if response.generated_images:
                img_bytes = response.generated_images[0].image.image_bytes
                return {"image_url": f"data:image/png;base64,{base64.b64encode(img_bytes).decode('utf-8')}"}
        except: pass

    openai_key = x_openai_key or OPENAI_API_KEY
    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            response = client.images.generate(model="dall-e-3", prompt=req.prompt_base)
            return {"image_url": response.data[0].url}
        except: pass
    return {"image_url": "https://via.placeholder.com/1024x1024.png?text=Error"}

@app.post("/api/publish-tistory")
async def publish_tistory(req: PublishRequest, x_gemini_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    client = genai.Client(api_key=api_key)
    prompt = f"[현재 시점: 2026년 4월] '{req.keyword}' 중심 '{req.topic}' SEO 원고"
    try:
        response = await safe_generate_content_async(client, prompt)
        html = markdown.markdown(response.text, extensions=['fenced_code', 'tables'])
        res = requests.post("https://www.tistory.com/apis/post/write", data={
            "access_token": req.tistory_token, "blogName": req.tistory_blog,
            "title": f"[{req.keyword}] {req.topic}", "content": html, "visibility": 0
        })
        return {"success": True, "result": res.json()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
