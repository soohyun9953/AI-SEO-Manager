import os
import base64
import json
import traceback
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import StreamingResponse

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
    resolution: Optional[str] = "1024x1024"

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
    prompt = f"[현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}] '{req.category}' 분야에서 2026년 트렌드를 반영한 수익성 높은 주제 3개를 JSON으로 추천해줘. [{{'topic': '...', 'reason': '...', 'expected_cpc': '...'}}]"
    
    try:
        response = await safe_generate_content_async(client, prompt, is_json=True)
        return {"topics": response.text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class 자동_작성_관리자:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def 주제_생성(self, category: str):
        prompt = f"[현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}] '{category}' 주제 3개 추천 (JSON)"
        res = await safe_generate_content_async(self.client, prompt, is_json=True)
        return json.loads(res.text)

    async def 키워드_추출(self, topic: str):
        prompt = f"[현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}] '{topic}' 주제 고단가 키워드 1개 전송"
        res = await safe_generate_content_async(self.client, prompt)
        return res.text.strip()

    async def 원고_생성(self, topic: str, keyword: str):
        prompt = f"[현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}] '{keyword}' 중심 '{topic}' 블로그 원고 작성. [규칙] 30년차 IT컨설턴트가 재테크/IT/라이프 주제를 단순하고 고상하게 경험 위주 작성. 'SEO' 단어 절대 금지. 원고가 끝난 후 마지막 줄에 '주요 키워드: ' 다음에 핵심 키워드 5개를 쉼표(,)로 구분하여 반드시 추가해줘. (마크다운)"
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
    prompt = f"[현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}] '{req.keyword}' 중심 '{req.topic}' 블로그 원고 작성. 30년차 IT컨설턴트가 단순하고 고상하게 경험 위주 작성. 'SEO' 단어 절대 금지. 원고 마지막에는 '주요 키워드: ' 문구와 함께 관련 키워드 5개를 쉼표(,)로 구분하여 추가해줘."
    try:
        response = await safe_generate_content_async(client, prompt)
        return {"article": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def translate_prompt_to_english(prompt: str, api_key: Optional[str] = None) -> str:
    """
    한국어 주제어를 블로그 썸네일 전용 영어 이미지 프롬프트로 변환.
    단순 번역이 아닌, 주제에 최적화된 장면·구도·스타일을 Gemini가 직접 설계.
    """
    has_korean = any('\uAC00' <= c <= '\uD7A3' for c in prompt)
    if not has_korean:
        return prompt

    if not api_key:
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
4. 반드시 영어 텍스트만 출력하고, 설명·번역·따옴표는 절대 포함하지 말 것

[한국어 주제어]
{prompt}

[영어 이미지 프롬프트 출력]"""
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=translation_prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini 번역 실패 ({e}). MyMemory 무료 번역 API로 2차 시도...")
        try:
            import urllib.parse
            encoded_query = urllib.parse.quote(prompt)
            res = requests.get(f"https://api.mymemory.translated.net/get?q={encoded_query}&langpair=ko|en", timeout=10)
            if res.status_code == 200:
                return res.json().get('responseData', {}).get('translatedText', prompt)
        except Exception as e2:
            print(f"2차 번역 실패 ({e2}). 원본 프롬프트 사용.")
            
        return prompt


async def generate_pollinations_image(prompt: str, api_key: Optional[str] = None, resolution: str = "1024x1024") -> dict:
    import urllib.parse
    import asyncio

    loop = asyncio.get_event_loop()
    english_prompt = await loop.run_in_executor(
        None, translate_prompt_to_english, prompt, api_key
    )

    def _fetch_image(url: str) -> requests.Response:
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

        response = await loop.run_in_executor(None, _fetch_image, image_url)

        if response.status_code == 200 and "image" in response.headers.get("content-type", ""):
            img_base64 = base64.b64encode(response.content).decode("utf-8")
            img_mime = response.headers.get("content-type", "image/jpeg").split(";")[0]
            return {"image_url": f"data:{img_mime};base64,{img_base64}", "source": "pollinations"}
        else:
            raise Exception(f"Pollinations.ai 응답 오류: HTTP {response.status_code}")
    except HTTPException:
        raise
    except Exception as e:
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
    import json

    async def event_generator():
        api_key = x_gemini_key or GEMINI_API_KEY
        cache_key = f"{req.prompt_base}"
        
        if cache_key in IMAGE_CACHE:
            yield f"data: {json.dumps({'status': 'progress', 'message': '이미지 캐시 히트! 이전 생성 결과 반환 중...'})}\n\n"
            yield f"data: {json.dumps({'status': 'success', 'image_url': IMAGE_CACHE[cache_key]['image_url'], 'source': IMAGE_CACHE[cache_key]['source']})}\n\n"
            return

        yield f"data: {json.dumps({'status': 'progress', 'message': '0단계: 프롬프트 분석 및 최적화 중...'})}\n\n"

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
async def publish_tistory(req: PublishRequest, x_gemini_key: Optional[str] = Header(None)):
    api_key = x_gemini_key or GEMINI_API_KEY
    client = genai.Client(api_key=api_key)
    prompt = f"[현재 시점: {datetime.now().strftime('%Y년 %m월 %d일')}] '{req.keyword}' 중심 '{req.topic}' 원고. 30년차 IT컨설턴트가 단순/고상하게 경험 위주 작성. 'SEO' 단어 금지. 마지막에 '주요 키워드: '와 함께 키워드 5개를 쉼표(,)로 구분하여 추가할 것."
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
