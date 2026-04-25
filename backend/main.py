import os
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
    return {"message": "AI SEO Manager (Gemini 2.5) is running on port 8002"}

def safe_generate_content(client, prompt, config=None, is_json=False):
    """
    503/429 에러 발생 시 재시도 및 모델 폴백을 수행하는 함수.
    [2026-04-25 업그레이드]
    - 1순위: gemini-2.5-flash (최고 성능/안정성, 고품질 SEO 콘텐츠 생성)
    - 2순위: gemini-2.5-flash-lite (초고속/저비용 폴백)
    - 지원 중단 예정 모델 제거: gemini-2.0-flash (2026-06-01 지원 종료)
    """
    models_to_try = [
        'gemini-2.5-flash',      # 2026년 1순위: 최고 품질 + 안정성
        'gemini-2.5-flash-lite', # 2026년 2순위: 고속 폴백 (무료 할당량 소진 시)
    ]
    
    last_exception = None
    
    for model_name in models_to_try:
        backoff_times = [2, 4, 8]
        for attempt, sleep_time in enumerate(backoff_times):
            try:
                print(f"Attempting {model_name} (Attempt {attempt + 1})...")
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
                # 503(UNAVAILABLE) 또는 429(RESOURCE_EXHAUSTED)인 경우에만 재시도
                if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                    print(f"Quota exhausted on {model_name}. Switching model immediately...")
                    break
                elif "503" in err_msg or "UNAVAILABLE" in err_msg:
                    print(f"Error {err_msg} on {model_name}. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                    continue
                else:
                    print(f"Error {err_msg} on {model_name}. Switching model...")
                    break
        print(f"Model {model_name} failed completely.")
    
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
        
        response = safe_generate_content(client, prompt, is_json=True)
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
            {{"angle": "글쓰기 각도명", "title_example": "클릭을 유도하는 제목 예시", "ctr_boost": "높음"}}
          ],
          "monetization_tips": "광고 배치, 제휴 링크 활용 등 수익화 전략 설명",
          "synergy_keywords": [
            {{"keyword": "연관 키워드", "reason": "시너지 효과 이유"}}
          ]
        }}
        """

        response = safe_generate_content(client, prompt, is_json=True)
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
        client = genai.Client(api_key=api_key)
        prompt = f"""
        [현재 시점: 2026년 4월]
        당신은 상업적 가치가 높은 블로그 주제를 선정하는 전문가입니다. 
        분야: '{req.category}' 
        
        요구사항:
        1. 해당 분야에서 정보성 가치가 높으면서도 클릭 시 수익(CPC/CPA)이 높을 것으로 예상되는 주제 3개를 생성하세요.
        2. 2026년 최신 트렌드를 반영하고 사용자의 호기심을 자극하는 제목이어야 합니다.
        3. 결과는 반드시 아래 JSON 형식을 따르는 리스트여야 합니다. (마크다운 없이 순수 JSON만)
        
        응답 형식:
        [
          {{"topic": "주제명", "reason": "추천 사유 및 수익성 분석", "expected_cpc": "High/Medium"}}
        ]
        """
        
        response = safe_generate_content(client, prompt, is_json=True)
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
        self.client = genai.Client(api_key=api_key)

    def 주제_생성(self, category: str) -> List[dict]:
        json_format = '[{"topic": "...", "reason": "..."}]'
        prompt = f"'{category}' 분야에서 최신 트렌드 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. {json_format}"
        response = safe_generate_content(self.client, prompt, is_json=True)
        return json.loads(response.text)

    def 키워드_추출(self, topic: str) -> str:
        prompt = f"'{topic}' 주제에 대해 최신 트렌드 기준 CPC가 높은 핵심 키워드 1개만 알려줘. 키워드만 텍스트로 응답해."
        response = safe_generate_content(self.client, prompt)
        return response.text.strip()

    def 원고_생성(self, topic: str, keyword: str) -> str:
        prompt = f"""
'{keyword}' 키워드를 중심으로 '{topic}' 관련 블로그 원고를 마크다운으로 작성해줘.

[작성 규칙]
- 최신 정보를 바탕으로 작성하되, 특정 연도·날짜 표현은 사용하지 마세요.
- 글 내용에서 'SEO', '검색엔진 최적화' 등의 단어는 절대 언급하지 마세요. 자연스럽고 유익한 정보성 글로 작성하세요.
- H1~H3 태그 구조를 갖추세요.
- 글 마지막에 관련 키워드를 아래 형식으로 정확히 한 줄로 작성하세요 (# 기호 없이 단어만):
  키워드1, 키워드2, 키워드3, 키워드4, 키워드5
"""
        response = safe_generate_content(self.client, prompt)
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
            추천_결과 = 관리자.주제_생성(req.category)
            주제 = 추천_결과[0]['topic']
            
        # 2. 키워드 추출
        키워드 = 관리자.키워드_추출(주제)
        
        # 3. 원고 생성
        원고 = 관리자.원고_생성(주제, 키워드)
        
        # 4. 티스토리 발행 (토큰이 있는 경우, 티스토리는 HTML만 받으므로 변환 필요)
        발행_결과 = None
        if req.tistory_token and req.tistory_blog:
            try:
                article_html = markdown.markdown(원고, extensions=['fenced_code', 'tables'])
                tistory_url = "https://www.tistory.com/apis/post/write"
                data = {
                    "access_token": req.tistory_token,
                    "output": "json",
                    "blogName": req.tistory_blog,
                    "title": f"[{키워드}] {주제}",
                    "content": article_html,
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
            "article": 원고,
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
'{req.keyword}' 키워드를 중심으로 '{req.topic}' 관련 블로그 원고를 마크다운으로 작성해줘.

[작성 규칙]
- 최신 정보를 바탕으로 작성하되, 특정 연도·날짜 표현은 사용하지 마세요.
- 글 내용에서 'SEO', '검색엔진 최적화' 등의 단어는 절대 언급하지 마세요. 자연스럽고 유익한 정보성 글로 작성하세요.
- H1~H3 태그 구조를 갖추고 메타 설명도 포함하세요.
- 글 마지막에 관련 키워드를 아래 형식으로 정확히 한 줄로 작성하세요 (# 기호 없이 단어만):
  키워드1, 키워드2, 키워드3, 키워드4, 키워드5, 키워드6, 키워드7
"""
        
        response = safe_generate_content(client, prompt)
        return {"article": response.text}
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
        client = genai.Client(api_key=api_key)
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
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=translation_prompt
        )
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



async def generate_pollinations_image(prompt: str, api_key: Optional[str] = None) -> dict:
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
                return requests.get(url, headers=headers, timeout=45)
            except Exception as e:
                last_error = e
                print(f"Pollinations.ai 요청 실패 (시도 {attempt+1}/3) - 1초 후 재시도: {e}")
                time.sleep(1)
        raise last_error

    try:
        encoded_prompt = urllib.parse.quote(english_prompt)
        image_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width=1024&height=1024&nologo=true&enhance=true&model=flux"
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
    api_key = x_gemini_key or GEMINI_API_KEY
    cache_key = f"{req.prompt_base}"
    
    # 동일 프롬프트 연속 요청 시 캐시 활용 (429 방지)
    if cache_key in IMAGE_CACHE:
        print(f"이미지 캐시 히트! 이전 생성 결과 반환: {req.prompt_base}")
        return IMAGE_CACHE[cache_key]

    try:
        # 1순위: Gemini 네이티브 이미지 생성 (Nano Banana 방식)
        if api_key:
            native_image_models = ['gemini-2.5-flash-image']
            last_gemini_error = None

            for model_name in native_image_models:
                try:
                    print(f"Trying native image model: {model_name}")
                    
                    def _call_gemini():
                        client = genai.Client(api_key=api_key)
                        return client.models.generate_content(
                            model=model_name,
                            contents=[req.prompt_base],
                            config=types.GenerateContentConfig(
                                response_modalities=['TEXT', 'IMAGE']
                            )
                        )
                        
                    import asyncio
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(None, _call_gemini)

                    # 응답에서 이미지 파트 추출
                    for part in response.parts:
                        if part.inline_data is not None:
                            img_bytes = part.inline_data.data
                            img_mime = part.inline_data.mime_type or 'image/png'
                            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                            print(f"Image generated successfully with {model_name}")
                            IMAGE_CACHE[cache_key] = {"image_url": f"data:{img_mime};base64,{img_base64}", "source": "gemini"}
                            return IMAGE_CACHE[cache_key]

                    print(f"{model_name}: 응답에 이미지 데이터 없음. 다음 모델 시도.")
                    last_gemini_error = "응답에 이미지 데이터가 포함되지 않았습니다."

                except Exception as e:
                    msg = str(e)
                    last_gemini_error = msg
                    if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
                        print(f"Quota exhausted for {model_name}. Falling back to OpenAI.")
                        break
                    print(f"Native image generation failed ({model_name}): {msg}")
                    continue

            print(f"All Gemini native image models failed. Last error: {last_gemini_error}")
            
            # OpenAI 키가 없으면 → Pollinations.ai 무료 폴백으로 바로 이동
            if not x_openai_key and not OPENAI_API_KEY:
                print("OpenAI 키 없음. Pollinations.ai 무료 폴백으로 이동합니다.")
                IMAGE_CACHE[cache_key] = await generate_pollinations_image(req.prompt_base, api_key)
                return IMAGE_CACHE[cache_key]

        # 2순위: OpenAI DALL-E 3 (폴백)
        openai_api_key = x_openai_key or OPENAI_API_KEY
        if openai_api_key:
            try:
                print("Falling back to OpenAI DALL-E 3")
                openai_client = OpenAI(api_key=openai_api_key)
                
                def _call_openai():
                    return openai_client.images.generate(
                        model="dall-e-3",
                        prompt=req.prompt_base,
                        n=1,
                    )
                
                import asyncio
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, _call_openai)
                IMAGE_CACHE[cache_key] = {"image_url": response.data[0].url, "source": "openai"}
                return IMAGE_CACHE[cache_key]
            except Exception as e:
                print(f"DALL-E 3 실패: {e}. Pollinations.ai로 폴백.")
                IMAGE_CACHE[cache_key] = await generate_pollinations_image(req.prompt_base, api_key)
                return IMAGE_CACHE[cache_key]

        # 3순위: Pollinations.ai (완전 무료, API 키 불필요)
        IMAGE_CACHE[cache_key] = await generate_pollinations_image(req.prompt_base, api_key)
        return IMAGE_CACHE[cache_key]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Top-level error in generate_image: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"이미지 생성 중 내부 오류가 발생했습니다. (오류: {str(e)})"
        )

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
'{req.keyword}' 키워드를 중심으로 '{req.topic}' 관련 블로그 원고를 마크다운으로 작성해줘.

[작성 규칙]
- 최신 정보를 바탕으로 작성하되, 특정 연도·날짜 표현은 사용하지 마세요.
- 글 내용에서 'SEO', '검색엔진 최적화' 등의 단어는 절대 언급하지 마세요. 자연스럽고 유익한 정보성 글로 작성하세요.
- H1~H3 태그 구조를 갖추고 메타 설명도 포함하세요.
- 글 마지막에 관련 키워드를 아래 형식으로 정확히 한 줄로 작성하세요 (# 기호 없이 단어만):
  키워드1, 키워드2, 키워드3, 키워드4, 키워드5
"""
        
        response = safe_generate_content(client, prompt)
        article_md = response.text
        
        # Markdown을 HTML로 변환
        article_html = markdown.markdown(article_md, extensions=['fenced_code', 'tables'])
        
        # 3. 티스토리에 발행 (임시저장)
        tistory_url = "https://www.tistory.com/apis/post/write"
        data = {
            "access_token": req.tistory_token,
            "output": "json",
            "blogName": req.tistory_blog,
            "title": f"[{req.keyword}] {req.topic} 핵심 정리",
            "content": article_html,
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
                    "article": article_html
                }
            else:
                raise Exception(str(result))
        else:
            raise Exception(f"Tistory API error: {res.text}")
            
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
