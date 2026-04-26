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
    resolution: Optional[str] = "1024x1024"


class PublishRequest(BaseModel):
    topic: str
    keyword: str
    tistory_token: str
    tistory_blog: str

class 분야_추천_요청(BaseModel):
    category: str
    model_name: Optional[str] = None

class 자동_작성_요청(BaseModel):
    category: str
    topic: Optional[str] = None
    tistory_token: Optional[str] = None
    tistory_blog: Optional[str] = None
    model_name: Optional[str] = None

class 심층_분석_요청(BaseModel):
    keyword: str
    topic: str

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
        prompt = f"'{topic}' 주제에 대해 최신 트렌드 기준 CPC가 높은 핵심 키워드 1개만 알려줘. 키워드만 텍스트로 응답해."
        response = safe_generate_content(self.api_key, prompt, target_model=target_model)
        return response.text.strip()

    def 원고_생성(self, topic: str, keyword: str, target_model: str = None) -> str:
        prompt = f"""
'{keyword}' 키워드를 중심으로 '{topic}' 관련 블로그 원고를 마크다운으로 작성해줘.

[작성 규칙]
- 최신 정보를 바탕으로 작성하되, 특정 연도·날짜 표현은 사용하지 마세요.
- 글 내용에서 'SEO', '검색엔진 최적화' 등의 단어는 절대 언급하지 마세요. 자연스럽고 유익한 정보성 글로 작성하세요.
- H1~H3 태그 구조를 갖추세요.
- 글 마지막에 관련 키워드를 아래 형식으로 정확히 한 줄로 작성하세요 (# 기호 없이 단어만):
  키워드1, 키워드2, 키워드3, 키워드4, 키워드5
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
        
        response = safe_generate_content(api_key, prompt)
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
'{req.keyword}' 키워드를 중심으로 '{req.topic}' 관련 블로그 원고를 마크다운으로 작성해줘.

[작성 규칙]
- 최신 정보를 바탕으로 작성하되, 특정 연도·날짜 표현은 사용하지 마세요.
- 글 내용에서 'SEO', '검색엔진 최적화' 등의 단어는 절대 언급하지 마세요. 자연스럽고 유익한 정보성 글로 작성하세요.
- H1~H3 태그 구조를 갖추고 메타 설명도 포함하세요.
- 글 마지막에 관련 키워드를 아래 형식으로 정확히 한 줄로 작성하세요 (# 기호 없이 단어만):
  키워드1, 키워드2, 키워드3, 키워드4, 키워드5
"""
        
        response = safe_generate_content(api_key, prompt)
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
