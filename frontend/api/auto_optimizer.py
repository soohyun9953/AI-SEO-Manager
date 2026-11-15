"""
AI SEO Manager - 글 원문 자동 수집 및 AI SEO 자동 최적화 리라이팅 엔진
- 티스토리 공개 글 URL 자동 크롤링 (제목, 본문 텍스트, HTML 추출)
- Search Console 유입 키워드 및 성과 진단 기반 Gemini AI 리라이팅
  (클릭률 2배 제목, 메타설명 150자, 서두 3줄 요약 박스, 체류시간 소제목 구조화, FAQ JSON-LD)
- 티스토리 에디터 자동 임시저장 원클릭 연동
"""

import os
import re
import json
import time
import requests
from typing import Dict, Any, List, Optional
from urllib.parse import unquote
import bs4

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def scrape_tistory_article(url: str) -> Dict[str, Any]:
    """
    티스토리 블로그 글 URL에서 제목과 본문(텍스트 및 HTML)을 자동으로 수집
    """
    if not url or not url.startswith("http"):
        raise ValueError("올바른 URL 형식이 아닙니다.")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()
    except Exception as e:
        raise ValueError(f"글을 가져오는 데 실패했습니다 (HTTP 오류): {str(e)}")
    
    # 인코딩 처리
    res.encoding = res.apparent_encoding or "utf-8"
    soup = bs4.BeautifulSoup(res.text, "html.parser")
    
    # 1. 제목 추출
    title = ""
    title_selectors = [
        "h1.title", "h1.entry-title", "h1.post-title", "h1",
        ".titleWrap h2", ".article-header h1", ".article-title",
        "meta[property='og:title']"
    ]
    for sel in title_selectors:
        if sel.startswith("meta"):
            tag = soup.select_one(sel)
            if tag and tag.get("content"):
                title = tag["content"].strip()
                break
        else:
            tag = soup.select_one(sel)
            if tag and tag.get_text().strip():
                title = tag.get_text().strip()
                break
    
    if not title:
        # URL에서 유추
        title = unquote(url.rstrip("/").split("/")[-1]).replace("-", " ").strip()
    
    # 2. 본문 영역 탐색
    content_container = None
    content_selectors = [
        ".article_skin",
        ".entry-content",
        ".tt_article_useless_p_margin",
        ".article-view",
        ".post-content",
        "article",
        "#article"
    ]
    for sel in content_selectors:
        found = soup.select_one(sel)
        if found:
            content_container = found
            break
    
    if not content_container:
        # fallback: body
        content_container = soup.find("body")
    
    # 불필요한 태그 제거 (스크립트, 스타일, 댓글, 광고, 사이드바 등)
    if content_container:
        for unwanted in content_container.select("script, style, iframe, noscript, .another_category, .container_postbtn, .comment, #comment, .revenue_unit_wrap"):
            unwanted.decompose()
        
        content_text = content_container.get_text(separator="\n", strip=True)
        content_html = str(content_container)
    else:
        content_text = ""
        content_html = ""
    
    # 본문이 너무 길면 안전하게 15,000자 이내로 컷
    if len(content_text) > 15000:
        content_text = content_text[:15000] + "\n...(이하 생략)"
        
    return {
        "url": url,
        "title": title,
        "content_text": content_text,
        "content_length": len(content_text),
        "success": bool(content_text)
    }


def build_seo_rewrite_prompt(
    title: str,
    content_text: str,
    scenario: str = "HIGH_IMP_LOW_CTR",
    scenario_label: str = "노출 대비 클릭률 저조",
    diagnosis: str = "",
    queries: Optional[List[Dict[str, Any]]] = None
) -> str:
    """Gemini 2.5 Flash용 SEO 리라이팅 프롬프트 조립"""
    query_str = ""
    if queries:
        lines = [f"- {q.get('query')} (클릭 {q.get('clicks', 0)}회, 노출 {q.get('impressions', 0)}회)" for q in queries[:6]]
        query_str = "실제 유입 검색어 (Search Console TOP):\n" + "\n".join(lines)
    
    prompt = f"""
당신은 대한민국 최고의 블로그 검색엔진 최적화(SEO) 및 애드센스 수익화 전문 수석 에디터입니다.
아래 분석 데이터와 블로그 기존 원문을 바탕으로, 검색 유입 클릭률과 체류시간, 광고 수익을 극대화할 수 있도록 글을 전면 업그레이드하여 재작성(SEO 리라이팅)해주세요.

[포스팅 진단 데이터]
- 기존 제목: {title}
- 진단 유형: {scenario_label}
- 진단 내용: {diagnosis or "노출 대비 클릭률이 낮아 제목과 메타 설명, 서두 요약 박스 보강이 필요합니다."}
{query_str}

[기존 본문 원문]
{content_text[:7000]}

---

[리라이팅 핵심 지침]
1. **제목 (Title)**:
   - 검색 사용자의 클릭을 즉각 유도할 수 있는 매력적이고 구체적인 제목 3가지 대안을 제시하고, 그중 가장 추천하는 1순위 제목을 지정하세요.
   - 35자 내외, 핵심 검색어 앞부분 배치, 구체적 숫자/이득/실수 방지/해결책 포함. 과장된 낚시성 금지.
2. **메타 설명 (Meta Description)**:
   - 네이버/구글 검색결과 스니펫에 노출될 140~160자 분량의 완벽한 요약문.
3. **서두 3줄 핵심 요약 박스 (Lead Summary Box)**:
   - 모바일 독자의 이탈을 막고 체류시간을 확보하기 위해, 본문 최상단에 들어갈 [3줄 핵심 요약] 문구를 작성하세요.
4. **본문 재구성 (Rewritten Article - HTML)**:
   - 원문의 핵심 사실, 수치, 사용법 정보는 왜곡 없이 100% 보존하세요.
   - 소제목(H2, H3)을 명확하게 나누고, 가독성을 위한 인라인 스타일(배경색, 패딩, 테두리, 강조 폰트)을 적절히 포함한 완성형 HTML로 작성하세요.
   - 독자가 지루하지 않게 불릿 포인트(ul, li)와 팁 박스(blockquote 또는 styled div)를 배치하세요.
   - 단락 중간에 애드센스 광고가 들어갈 수 있도록 자연스러운 전환점을 만드세요.
5. **FAQ 구조화 데이터 (JSON-LD)**:
   - 독자들이 가장 궁금해할 질문 2~3개와 답변으로 FAQ 마크다운 및 schema.org FAQPage JSON-LD 스크립트를 생성하세요.
6. **추천 태그**:
   - 검색 유입에 최적화된 8~10개의 태그 목록.

반드시 아래 JSON 포맷으로만 응답하세요:
{{
  "recommended_title": "최우선 추천 제목",
  "title_options": ["추천 제목 1", "추천 제목 2", "추천 제목 3"],
  "meta_description": "140~160자 메타 설명",
  "summary_points": ["서두 요약 1", "서두 요약 2", "서두 요약 3"],
  "rewritten_html": "<div style='...'>...본문 전체 HTML...</div>",
  "faq_items": [
    {{"question": "질문 1", "answer": "답변 1"}},
    {{"question": "질문 2", "answer": "답변 2"}}
  ],
  "faq_json_ld": "<script type=\\"application/ld+json\\">...</script>",
  "tags": ["태그1", "태그2", "태그3"],
  "key_improvements": ["개선점 1", "개선점 2", "개선점 3"]
}}
"""
    return prompt.strip()


def rewrite_article_with_ai(
    title: str,
    content_text: str,
    scenario: str = "HIGH_IMP_LOW_CTR",
    scenario_label: str = "노출 대비 클릭률 저조",
    diagnosis: str = "",
    queries: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Gemini 2.5 Flash를 사용하여 글을 전면 SEO 리라이팅 (키 미설정/실패 시 전문가 스마트 템플릿 폴백)"""
    from dotenv import load_dotenv
    load_dotenv()
    
    key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        print("[AutoOptimizer] GEMINI_API_KEY 미설정 -> 전문가 스마트 템플릿 폴백 적용")
        return build_smart_fallback_article(
            title=title,
            content_text=content_text,
            scenario=scenario,
            scenario_label=scenario_label,
            diagnosis=diagnosis,
            queries=queries
        )
    
    prompt = build_seo_rewrite_prompt(
        title=title,
        content_text=content_text,
        scenario=scenario,
        scenario_label=scenario_label,
        diagnosis=diagnosis,
        queries=queries
    )
    
    from google import genai
    from google.genai import types
    
    try:
        client = genai.Client(api_key=key.split(",")[0].strip())
        config = types.GenerateContentConfig(response_mime_type="application/json")
        
        last_err = None
        for model_name in ("gemini-2.5-flash", "gemini-2.5-flash-lite"):
            for attempt in range(2):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=config
                    )
                    parsed = json.loads(response.text)
                    return {
                        "success": True,
                        "model_used": model_name,
                        "data": parsed
                    }
                except Exception as e:
                    last_err = e
                    print(f"[AutoOptimizer] {model_name} attempt {attempt+1} error: {e}")
                    time.sleep(1.0)
    except Exception as outer_err:
        print(f"[AutoOptimizer] Gemini 클라이언트 초기화 실패: {outer_err}")

    # 실패 시 폴백
    return build_smart_fallback_article(
        title=title,
        content_text=content_text,
        scenario=scenario,
        scenario_label=scenario_label,
        diagnosis=diagnosis,
        queries=queries
    )


def build_smart_fallback_article(
    title: str,
    content_text: str,
    scenario: str = "HIGH_IMP_LOW_CTR",
    scenario_label: str = "노출 대비 클릭률 저조",
    diagnosis: str = "",
    queries: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Gemini API 키 미설정 또는 호출 실패 시 동작하는 5대 시나리오별 전문가 스마트 템플릿"""
    clean_title = title.replace("[", "").replace("]", "").strip()
    kw = queries[0]["query"] if queries and len(queries) > 0 else (clean_title.split()[0] if clean_title else "블로그")
    
    title_options = [
        f"[2026 최신] {clean_title} 사용법 및 핵심 가입 가이드",
        f"{clean_title} - 놓치기 쉬운 3가지 실수와 해결책",
        f"{kw} 제대로 알고 시작하기 (실전 요약)"
    ]
    if scenario == "HIGH_IMP_LOW_CTR":
        title_options = [
            f"[2026 최신] {clean_title} 사용법·가입 방법 핵심 총정리",
            f"{clean_title} - 3가지 실수 피하고 2배 효과 보는 법",
            f"{kw} 초보자를 위한 단계별 실전 가이드"
        ]
    elif scenario == "TRENDING_DOWN":
        title_options = [
            f"[2026 최신 개정판] {clean_title} 달라진 점 완벽 정리",
            f"{clean_title} 최신 현황 및 변경사항 총정리",
            f"{kw} 순위 방어 실전 가이드"
        ]

    lines = [l.strip() for l in content_text.splitlines() if l.strip()]
    first_few = lines[:3] if len(lines) >= 3 else [f"{clean_title}에 대한 핵심 요약입니다."]
    summary_points = [
        f"핵심 정보: {first_few[0][:60]}...",
        f"주요 장점 및 특징: 실전 적용 시 놓치기 쉬운 주의사항 점검 필수",
        f"추천 대상: 빠르고 정확하게 {kw} 정보를 찾으시는 분께 추천"
    ]
    
    meta_desc = f"{clean_title} 완벽 가이드! {kw}의 핵심 특징과 사용법, 놓치기 쉬운 주의사항 3가지를 알기 쉽게 정리해 드립니다. 지금 바로 확인해보세요."
    
    html_paragraphs = "".join(f"<p style='margin-bottom: 14px; line-height: 1.7; color: #334155;'>{p}</p>" for p in lines[:10])
    rewritten_html = f"""
<div class="article-optimized" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.8;">
  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #166534;">📌 3줄 핵심 요약</p>
    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.6;">
      {"".join(f"<li>{p}</li>" for p in summary_points)}
    </ul>
  </div>

  <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px;">
    1. {kw} 핵심 개요 및 주요 특징
  </h2>
  {html_paragraphs}

  <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px;">
    2. 이용 시 꼭 알아두어야 할 실전 체크포인트
  </h2>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0; font-size: 13px; color: #475569;">💡 <strong>전문가 팁:</strong> 사전에 관련 규정이나 수수료, 연동 설정을 꼼꼼히 확인하시면 시행착오를 크게 줄일 수 있습니다.</p>
  </div>

  <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px;">
    3. 자주 묻는 질문 (FAQ)
  </h2>
  <div style="margin-top: 12px; font-size: 14px;">
    <p style="font-weight: bold; color: #1e293b; margin-bottom: 4px;">Q. {kw} 초보자도 쉽게 따라할 수 있나요?</p>
    <p style="color: #475569; margin-bottom: 16px;">A. 네, 본문의 단계별 가이드를 차례대로 진행하시면 누구나 5분 내에 완료할 수 있습니다.</p>
    <p style="font-weight: bold; color: #1e293b; margin-bottom: 4px;">Q. 이용 시 추가 비용이 발생하나요?</p>
    <p style="color: #475569; margin-bottom: 16px;">A. 기본 서비스는 무료로 제공되며, 필요에 따라 유료 옵션을 선택하실 수 있습니다.</p>
  </div>
</div>
"""
    faq_json_ld = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "{kw} 초보자도 쉽게 따라할 수 있나요?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "네, 본문의 단계별 가이드를 차례대로 진행하시면 누구나 5분 내에 완료할 수 있습니다."
      }}
    }},
    {{
      "@type": "Question",
      "name": "이용 시 추가 비용이 발생하나요?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "기본 서비스는 무료로 제공되며, 필요에 따라 유료 옵션을 선택하실 수 있습니다."
      }}
    }}
  ]
}}
</script>"""

    tags = [kw, clean_title, f"{kw} 사용법", f"{kw} 가이드", "블로그SEO", "실전팁"]
    return {
        "success": True,
        "model_used": "expert-smart-fallback",
        "data": {
            "recommended_title": title_options[0],
            "title_options": title_options,
            "meta_description": meta_desc,
            "summary_points": summary_points,
            "rewritten_html": rewritten_html.strip(),
            "faq_items": [
                {"question": f"{kw} 초보자도 쉽게 따라할 수 있나요?", "answer": "네, 단계별 가이드로 5분 내에 완료할 수 있습니다."},
                {"question": "이용 시 추가 비용이 발생하나요?", "answer": "기본 기능은 무료로 제공됩니다."}
            ],
            "faq_json_ld": faq_json_ld.strip(),
            "tags": tags,
            "key_improvements": [
                "핵심 키워드 전면 배치로 클릭률(CTR) 2배 향상 제목 채택",
                "모바일 이탈 방지용 3줄 요약 박스 본문 서두 삽입",
                "검색엔진 리치 스니펫 대응 FAQ 구조화 데이터(JSON-LD) 생성"
            ]
        }
    }
