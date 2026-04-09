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
    prompt = f"[현재 시점: 2026년 4월] 주제: '{req.topic}' 관련 고단가 키워드 5개를 JSON 리스트로 추천해줘. [{{'keyword': '...', 'reason': '...', 'vol': '...'}}]"
    
    try:
        response = await safe_generate_content_async(client, prompt, is_json=True)
        return {"keywords": response.text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
