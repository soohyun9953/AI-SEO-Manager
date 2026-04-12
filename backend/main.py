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

app = FastAPI(title="AI SEO Manager Beta (Gemini 2.5 Flash-Lite Stable)")

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
    """503/429 에러 발생 시 재시도 및 모델 폴백을 수행하는 함수 (2026년 최적화)"""
    models_to_try = [
        'gemini-2.5-flash-lite', 
        'gemini-2.0-flash',
        'gemini-1.5-flash-8b' # 2026년에도 하위 호환성을 위해 유지될 수 있는 경량 모델
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
                if "503" in err_msg or "UNAVAILABLE" in err_msg or "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                    print(f"Error {err_msg} on {model_name}. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                    continue
                else:
                    # 그 외 에러(404 등)는 다음 모델로 즉시 전환
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
        prompt = f"[현재 시점: 2026년 4월] '{category}' 분야에서 2026년 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. [{{\"topic\": \"...\", \"reason\": \"...\"}}]"
        response = safe_generate_content(self.client, prompt, is_json=True)
        return json.loads(response.text)

    def 키워드_추출(self, topic: str) -> str:
        prompt = f"[현재 시점: 2026년 4월] '{topic}' 주제에 대해 2026년 기준 가장 CPC가 높은 핵심 키워드 1개만 알려줘. 키워드만 텍스트로 응답해."
        response = safe_generate_content(self.client, prompt)
        return response.text.strip()

    def 원고_생성(self, topic: str, keyword: str) -> str:
        prompt = f"[현재 시점: 2026년 4월] '{keyword}' 키워드를 중심으로 '{topic}' 관련 2026년 SEO 최적화 블로그 원고를 마크다운으로 작성해줘. 2024년 등 과거 정보를 현재인 것처럼 작성하지 말고 반드시 2026년 시점임을 명심해."
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
        
        # 4. 티스토리 발행 (토큰이 있는 경우)
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
        prompt = f"[현재 시점: 2026년 4월] '{req.keyword}' 키워드를 중심으로 '{req.topic}' 관련 2026년 SEO 상위 노출을 위한 블로그 원고를 작성해줘. H1~H3 태그 구조를 갖추고 메타 설명도 포함해줘. 2024년 정보가 아닌 2026년 최신 정보를 바탕으로 작성해줘. 글의 맨 마지막에는 본문과 잘 어울리는 추천 해시태그 5~7개를 추가해줘. 전체 결과는 마크다운 형식으로 작성해줘."
        
        response = safe_generate_content(client, prompt)
        return {"article": response.text}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def generate_image(
    req: ImageRequest, 
    x_gemini_key: Optional[str] = Header(None),
    x_openai_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY

    # 1순위: Gemini 네이티브 이미지 생성 (Nano Banana 방식)
    if api_key:
        # 시도할 모델 목록
        # gemini-3.1-flash-image-preview는 무료 플랜 Quota가 0이므로 제외
        native_image_models = [
            'gemini-2.5-flash-image',
        ]
        last_gemini_error = None

        for model_name in native_image_models:
            try:
                print(f"Trying native image model: {model_name}")
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=[req.prompt_base],
                    config=types.GenerateContentConfig(
                        response_modalities=['TEXT', 'IMAGE']
                    )
                )

                # 응답에서 이미지 파트 추출
                for part in response.parts:
                    if part.inline_data is not None:
                        img_bytes = part.inline_data.data
                        img_mime = part.inline_data.mime_type or 'image/png'
                        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                        print(f"Image generated successfully with {model_name}")
                        return {"image_url": f"data:{img_mime};base64,{img_base64}"}

                # 응답에 이미지 파트가 없는 경우
                print(f"{model_name}: 응답에 이미지 데이터 없음. 다음 모델 시도.")
                last_gemini_error = "응답에 이미지 데이터가 포함되지 않았습니다."

            except Exception as e:
                msg = str(e)
                last_gemini_error = msg
                # Quota 초과(RESOURCE_EXHAUSTED)인 경우 즉시 OpenAI로 폴백 (재시도 불필요)
                if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
                    print(f"Quota exhausted for {model_name}. Falling back to OpenAI.")
                    break
                print(f"Native image generation failed ({model_name}): {msg}")
                continue

        # Gemini 이미지 생성 모두 실패한 경우
        print(f"All Gemini native image models failed. Last error: {last_gemini_error}")
        if not x_openai_key and not OPENAI_API_KEY:
            # Quota 초과인 경우 별도 안내
            if last_gemini_error and ("RESOURCE_EXHAUSTED" in last_gemini_error or "429" in last_gemini_error):
                raise HTTPException(
                    status_code=429,
                    detail="Gemini 이미지 생성 무료 한도를 초과했습니다. 내일 다시 시도하거나, 상단 설정에서 OpenAI API 키를 입력하시면 DALL-E 3로 즉시 대체 생성할 수 있습니다."
                )
            raise HTTPException(
                status_code=500,
                detail=f"Gemini 이미지 생성에 실패했습니다: {last_gemini_error}\n\nOpenAI API 키를 상단 설정에 입력하시면 DALL-E 3로 즉시 대체 생성할 수 있습니다."
            )

    # 2순위: OpenAI DALL-E 3 (폴백)
    openai_api_key = x_openai_key or OPENAI_API_KEY
    if openai_api_key:
        try:
            print("Falling back to OpenAI DALL-E 3")
            openai_client = OpenAI(api_key=openai_api_key)
            response = openai_client.images.generate(
                model="dall-e-3",
                prompt=req.prompt_base,
                n=1,
            )
            return {"image_url": response.data[0].url}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DALL-E 3 에러: {str(e)}")

    return {"image_url": "https://via.placeholder.com/1024x1024.png?text=No+API+Key"}

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
        prompt = f"[현재 시점: 2026년 4월] '{req.keyword}' 키워드를 중심으로 '{req.topic}' 관련 2026년 SEO 상위 노출을 위한 블로그 원고를 작성해줘. H1~H3 태그 구조를 갖추고 메타 설명도 포함해줘. 마크다운 형식으로 작성해주고, 마지막에 해시태그 5개를 추가해줘. 과거(2024년 등) 시점의 내용이 포함되지 않도록 주의해."
        
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
