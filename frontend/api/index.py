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

load_dotenv()

app = FastAPI(title="AI SEO Manager Beta (Gemini 2.5 Fresh)")

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

@app.get("/")
async def root():
    return {"message": "AI SEO Manager (Gemini 2.5 Flash) is running on port 8002"}

@app.post("/api/keywords")
async def get_keywords(
    req: KeywordRequest, 
    x_gemini_key: Optional[str] = Header(None)
):
    api_key = x_gemini_key or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        당신은 SEO 및 키워드 분석 전문가입니다. 
        주제: '{req.topic}' 
        
        요구사항:
        1. 해당 주제와 밀접한 고단가(High CPC) 키워드 5개를 추출하세요.
        2. 각 키워드는 검색량이 준수하고 경쟁이 상대적으로 낮은 것을 타겟팅합니다.
        3. 결과는 반드시 아래 JSON 형식을 따르는 리스트여야 합니다. (마크다운 없이 순수 JSON만)
        
        응답 형식:
        [
          {{"keyword": "키워드명", "reason": "추천 사유", "vol": "예상 월간 검색량"}}
        ]
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return {"keywords": response.text}
    except Exception as e:
        traceback.print_exc()
        # API 키 오류 등 상세 정보를 detail에 담아 반환
        error_msg = str(e)
        if "API key not valid" in error_msg:
            error_msg = "Gemini API 키가 유효하지 않습니다. 상단 키 관리바에서 확인해주세요."
        raise HTTPException(status_code=400, detail=error_msg)

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
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
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
    if api_key:
        try:
            client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
            response = client.models.generate_images(
                model='imagen-3.0-generate-001',
                prompt=req.prompt_base,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type='image/png'
                )
            )
            
            if response.generated_images:
                img_bytes = response.generated_images[0].image.image_bytes
                img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                return {"image_url": f"data:image/png;base64,{img_base64}"}
        except Exception as e:
            msg = str(e)
            print(f"Google Imagen 3 failed: {msg}")
            
            # 만약 OpenAI 키가 없다면 친절하게 안내 메시지를 에러로 던짐
            if not x_openai_key and not OPENAI_API_KEY:
                if "404" in msg or "NOT_FOUND" in msg:
                    raise HTTPException(status_code=500, detail="Google 계정(무료/지역제한)에서 Imagen 3 API 접근이 아직 허용되지 않았습니다. 상단에 OpenAI API 키를 추가로 입력하시면 DALL-E 3로 즉시 대체 생성할 수 있습니다.")
                else:
                    raise HTTPException(status_code=500, detail=f"Imagen 3 에러: {msg}")

    openai_api_key = x_openai_key or OPENAI_API_KEY
    if openai_api_key:
        try:
            client = OpenAI(api_key=openai_api_key)
            response = client.images.generate(
                model="dall-e-3",
                prompt=req.prompt_base,
                n=1,
            )
            return {"image_url": response.data[0].url}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
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
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
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
