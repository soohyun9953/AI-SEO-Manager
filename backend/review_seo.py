"""
체험·방문 후기(티스토리) 공통 SEO 헬퍼
- 카테고리별 페르소나 / 금지어(Negative Prompt)
- 도입부 리드 문단 → 단일 요약 박스 구조 지침 (메타 디스크립션 보호)
- 이미지 Alt·캡션(롱테일 키워드형) 지침 및 <figure> 렌더러
- 영문 슬러그 / 제목 후보 정리, AI 상투어 후처리

backend/ 와 frontend/api/ 에 동일한 파일을 둔다 (배포 단위가 분리되어 있음).
"""
import re
import html as html_lib
from typing import Any, Dict, List, Optional

# ───────────────────────── 금지어 / 페르소나 ─────────────────────────

BANNED_PHRASES = [
    "안녕하세요!",
    "안녕하세요",
    "여러분의 미식·여행 인플루언서입니다",
    "인플루언서입니다",
    "오늘은 ~에 대해 알아보겠습니다",
    "오늘은 ○○에 대해 알아보겠습니다",
    "알아보도록 하겠습니다",
    "도움이 되셨다면 공감과 댓글 부탁드립니다",
    "공감과 댓글 부탁드립니다",
    "구독과 좋아요",
    "포스팅을 시작하겠습니다",
    "시작하겠습니다",
]

# 본문에 남아 있으면 제거할 AI 상투어 패턴
_CLICHE_RE = re.compile(
    r"안녕하세요|인플루언서입니다|에\s*대해\s*알아(보겠|보도록)|공감과?\s*댓글|구독과?\s*좋아요|도움이\s*되셨다면|포스팅을?\s*시작"
)

_PRO_HINTS = ("IT", "기술", "재테크", "절세", "금융", "행정", "커리어", "취업", "세금", "투자")


def is_pro_category(category: Optional[str]) -> bool:
    """IT / 재테크 / 행정 계열 카테고리인지 판별 (그 외는 방문·체험 후기 톤)"""
    cat = (category or "")
    return any(h.lower() in cat.lower() for h in _PRO_HINTS)


def negative_prompt() -> str:
    banned = "\n".join(f'   - "{p}"' for p in BANNED_PHRASES)
    return (
        "[절대 금지 (AI 티가 나는 인사말·맺음말 전면 금지)]\n"
        "- 아래 문구와 그 변형을 글 어디에도 쓰지 마세요. 첫 문장은 곧바로 본론(장소·결론)으로 시작합니다.\n"
        f"{banned}\n"
        "- 자기소개('~입니다')로 글을 시작하지 말 것. '공감·댓글·구독 부탁' 같은 호소형 맺음말 금지.\n"
        "- '#1', '#2' 같은 일련번호나 '현장 컷' 같은 기계적 표현 금지."
    )


def persona_prompt(category: Optional[str]) -> str:
    """카테고리에 따라 페르소나·톤앤매너를 자동 전환"""
    if is_pro_category(category):
        return (
            "당신은 30년 경력의 IT 컨설팅·ISP 총괄 PM이자 실전 자산관리 전문가입니다.\n"
            "[톤앤매너] 정중하고 명확한 비즈니스 어조('~습니다/합니다' 또는 깔끔한 해요체)를 쓰고, "
            "수치·비교표·법령/가이드라인 근거를 중심으로 서술합니다. 과장·감탄사·홍보성 수식어는 쓰지 않습니다."
        )
    return (
        "당신은 직접 돈 내고 다녀온 사람의 시선으로 쓰는 담백한 어른의 내돈내산 후기 작성자입니다.\n"
        "[톤앤매너] 과장된 홍보성 수식어('인생맛집', '미쳤다', '강추' 등)를 배제하고, 솔직하고 담백한 어조"
        "(~했어요, ~더라고요)로 씁니다. 구체적인 맛·가격·콜키지/주차/웨이팅 등 실용 정보를 중심으로, "
        "아쉬운 점도 숨기지 않습니다."
    )


# ───────────────────────── 공통 지침 조각 ─────────────────────────

def lead_and_summary_rules() -> str:
    return (
        "[도입부·요약 박스 구조 — 검색 스니펫(메타 디스크립션) 보호, 매우 중요]\n"
        "1) 글의 맨 첫 줄은 박스·라벨·인용문·이모지 없이 자연스러운 평서문 한 문단(공백 포함 140~160자)으로 씁니다. "
        "장소명과 지역, 독자가 가장 궁금해할 핵심 결론(가격대·웨이팅·추천 여부 중 핵심)을 이 문단에 담으세요. "
        "이 문단이 검색 결과 설명문으로 그대로 노출됩니다.\n"
        "2) 그 문단 바로 아래에 요약 박스를 '단 1개만' 둡니다. 아래 형식 그대로 쓰세요 "
        "('핵심 요약'과 '먼저 보고 가세요'를 따로 만들지 말고 하나로 통합):\n"
        "> **핵심 요약**\n"
        ">\n"
        "> - 위치·이용 정보: ...\n"
        "> - 가격대: ...\n"
        "> - 한 줄 평: ...\n"
        "3) 요약 박스 외에 인용문('>')은 본문에서 쓰지 마세요."
    )


def table_rule() -> str:
    return (
        "[비교표(Table) 필수]\n"
        "- 본문 중간에 핵심 스펙·가격·세금·장단점 등을 비교하는 마크다운 표(Table)를 최소 1개 반드시 포함하세요. "
        "표는 헤더행과 구분선(|---|)을 갖춘 정식 마크다운 표여야 합니다."
    )


def photo_seo_rules(photo_count: int) -> str:
    if photo_count <= 0:
        return "[이미지 슬롯] 첨부된 사진이 없으므로 이미지 슬롯을 넣지 마세요."
    return (
        f"[이미지 슬롯 — 구글 이미지 검색 유입용, 사진 {photo_count}장]\n"
        f"- 사진이 들어갈 자리마다 아래 형식의 슬롯을 단독 줄로 정확히 {photo_count}개, 사진 번호 순서대로 넣으세요:\n"
        '[IMAGE_SLOT: alt="구체적인 검색 키워드 포함 설명" | caption="독자에게 유용한 상세 캡션"]\n'
        "- alt: 25~60자의 롱테일 검색 키워드형 명사구(지역 + 상호명 + 메뉴/대상 + 특징). "
        "예) 도봉구 창동 송추가마골 인어반 수제칼집 돼지갈비 숯불구이 상차림\n"
        "- caption: 사진이 알려주는 정보를 한 문장(20~60자)으로, 이모지 금지. "
        "예) 송추가마골 인어반 창동점의 대표 메뉴인 수제칼집 돼지갈비와 기본 상차림 (콜키지 프리 가능)\n"
        "- '📷', '현장 컷', '사진 1', '#1' 같은 일련번호·기계적 표현은 전면 금지. 슬롯마다 내용이 달라야 합니다.\n"
        "- alt·caption 값 안에는 큰따옴표와 '|' 문자를 쓰지 마세요.\n"
        "- 사용자가 준 사진 설명(힌트)과 방문 정보에 있는 사실만 사용하고 없는 메뉴·가격을 지어내지 마세요."
    )


_SLOT_RE = re.compile(
    r'\[IMAGE_SLOT:\s*alt\s*=\s*["“”](.*?)["“”]\s*\|\s*caption\s*=\s*["“”](.*?)["“”]\s*\]',
    re.S,
)


def extract_image_slots(md: str, photo_count: int):
    """[IMAGE_SLOT: alt=... | caption=...] 를 순서대로 읽어 alt/캡션을 뽑고, 본문에는 내부 사진 마커로 치환한다.
    반환: (치환된 마크다운, [{alt, caption}...]) — 사진 수를 넘는 슬롯은 제거"""
    seo: List[Dict[str, str]] = []
    counter = {"n": 0}

    def repl(m):
        counter["n"] += 1
        n = counter["n"]
        if n > photo_count:
            return ""
        seo.append({"alt": m.group(1).strip(), "caption": m.group(2).strip()})
        return f"<!-- [PHOTO_{n}_SLOT] -->"

    out = _SLOT_RE.sub(repl, md or "")
    return out, seo


def build_faq_schema(md: str) -> str:
    """본문의 Q./A. 항목을 FAQPage JSON-LD 문자열로 변환 (없으면 빈 문자열)"""
    import json as _json
    items = []
    pat = re.compile(r"\*{0,2}Q\.\s*([^\n*]+?)\*{0,2}\s*(?:\n|/)\s*A\.\s*(.+?)(?=\n\s*\n|\n\s*\*{0,2}Q\.|$)", re.S)
    for m in pat.finditer((md or "").replace("\r", "")):
        q = re.sub(r"\*+", "", m.group(1)).strip()
        a = re.sub(r"\s*\n\s*", " ", re.sub(r"\*+", "", m.group(2))).strip()
        if q and a:
            items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})
    if not items:
        return ""
    return _json.dumps(
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": items}, ensure_ascii=False, indent=2
    )


def closing_rules() -> str:
    return (
        "[마무리 구간]\n"
        "- 마무리 총평(추천 대상·비추천 대상·한 줄 평) 소제목 바로 위에 아래 마커를 단독 줄로 한 번만 넣으세요. "
        "시스템이 '직접 경험 추가' 안내 박스로 바꿔 줍니다:\n"
        "<!-- [EXPERIENCE_BOX] -->\n"
        "- 맺음말에 인사·공감·댓글 부탁 문구를 쓰지 말고, 결론과 한 줄 평으로 깔끔히 끝내세요."
    )


def faq_rules() -> str:
    return (
        "[자주 묻는 질문 형식]\n"
        "- 독자가 실제로 검색할 질문 3개. 각 항목은 다음 두 줄 형식을 정확히 지키고, 항목 사이에는 빈 줄을 둡니다:\n"
        "**Q. 질문 문장**\n"
        "A. 답변 문장 (정보가 없으면 '방문 전 확인을 추천해요'처럼 안내)"
    )


def slug_rules() -> str:
    return (
        "[영문 URL 슬러그]\n"
        "- 소문자 영문·숫자·하이픈(-)만 사용, 3~7단어, 60자 이내. 지역/상호/메뉴를 로마자·영어로 옮기고 한글·공백·특수문자 금지. "
        "예) changdong-songchu-gamagol-pork-ribs-review"
    )


# ───────────────────────── Gemini용 전체 프롬프트 ─────────────────────────

def build_gemini_review_prompt(
    place_name: str,
    category: str,
    location: str,
    place_url: str,
    key_info: str,
    special_notes: str,
    rating: str,
    photo_lines: List[str],
) -> str:
    photos_desc = "\n".join(photo_lines) if photo_lines else "첨부된 사진 없음"
    photo_count = len(photo_lines)
    slots = ""
    if photo_count >= 1:
        slots += "- 이미지 슬롯은 사진이 어울리는 단락(분위기·대표 메뉴 등) 중간에 배치.\n"
    place_label = place_name
    return f"""
{persona_prompt(category)}
실제 직접 방문하여 경험한 '내돈내산 방문 후기'를 티스토리용 전문 블로그 포스팅으로 작성해주세요.

{negative_prompt()}

[방문 정보]
- 장소/상호명: {place_name}
- 카테고리: {category}
- 위치/지역: {location or '해당 지역 중심가'}
- 지도/사이트 링크: {place_url or '제공되지 않음'}
- 대표 메뉴·가격·주요 정보: {key_info or '대표 시그니처 메뉴'}
- 방문 특이사항 및 솔직 메모: {special_notes or '제공되지 않음 (없는 사실은 지어내지 말 것)'}
- 만족도/별점: {rating or '5.0'} / 5.0
- 등록된 사진 정보 (사용자가 적은 설명 힌트):
{photos_desc}

{lead_and_summary_rules()}

[본문 구성]
- 소제목은 마크다운 "## 제목" 형식, 4~7개. "소제목 1:" 같은 번호·라벨 없이 매력적인 제목 문장만 쓰세요. 괄호 안 '주제'는 방향일 뿐 그대로 복사하지 마세요.
- 구성 순서: (리드 문단 → 요약 박스) → 위치·분위기·주차/웨이팅 → 대표 메뉴/체험 솔직 평가 → 한눈에 보는 정보 표(Table: 장소명·위치·주요 가격/메뉴·편의시설·총점) → 솔직히 아쉬웠던 점(1~2가지) → 자주 묻는 질문 → (경험 마커) → 마무리 총평
{slots}- 모바일 가독성: 한 문단 2~3줄, 문단 사이 빈 줄.

{faq_rules()}

{closing_rules()}

{table_rule()}

[사실성 원칙 — 매우 중요]
- [방문 정보]에 없는 가격·영업시간·메뉴명·주차 여부는 지어내지 말고 '방문 전 확인을 추천해요'로 처리하세요.
- 입력된 메모에 없는 구체적 경험(대화, 직원 이름 등)을 만들어내지 마세요.

{photo_seo_rules(photo_count)}

[제목 후보 3개]
- 각각 공백 포함 35자 이내(40자 초과 금지). 핵심 키워드(지역+상호명+대표 메뉴)를 앞쪽에 두고 숫자·비교·핵심 혜택 중 하나 이상을 포함.
- "내돈내산 솔직 후기! ... 총정리" 같은 반복 틀 금지, 3개를 서로 다른 각도로 작성.

{slug_rules()}

[메타 디스크립션]
- 150자 내외(140~160자). 리드 문단의 핵심을 압축한 한 문단.

[검색 태그] 8~10개: 지역, 상호명, 메뉴, 추천 대상 등 유입 키워드.

반드시 아래 JSON 포맷으로만 응답하세요:
{{
  "titles": ["제목 후보1", "제목 후보2", "제목 후보3"],
  "englishSlug": "english-seo-slug",
  "metaDescription": "150자 내외 메타 설명",
  "tags": ["키워드1", "키워드2", "...(8~10개)"],
  "faqSchema": "본문 FAQ를 FAQPage JSON-LD로 직렬화한 문자열 (JSON 규칙대로 이스케이프)",
  "contentMarkdown": "리드 문단부터 마무리까지 전체 마크다운 본문 ([IMAGE_SLOT: ...] 슬롯, 표, <!-- [EXPERIENCE_BOX] --> 마커 포함). 시스템이 이것을 htmlContent(본문 HTML)로 변환합니다",
  "primary_keyword": "{place_label}",
  "related_keywords": "{location or ''} {place_label}, {place_label} 후기"
}}
""".strip()


# ───────────────────────── 후처리 ─────────────────────────

def strip_cliches(markdown_text: str) -> str:
    """AI 상투어 인사말·맺음말 문단을 안전망으로 제거 (프롬프트를 어긴 경우 대비)"""
    if not markdown_text:
        return markdown_text
    paragraphs = re.split(r"\n\s*\n", markdown_text)
    kept = []
    for para in paragraphs:
        plain = re.sub(r"[*_>#`-]", "", para).strip()
        if plain and _CLICHE_RE.search(plain):
            # 짧은 인사·맺음말 문단은 통째로 제거, 긴 문단은 해당 문장만 제거
            if len(plain) <= 120:
                continue
            sentences = re.split(r"(?<=[.!?。])\s+", para)
            para = " ".join(s for s in sentences if not _CLICHE_RE.search(s))
            if not para.strip():
                continue
        kept.append(para)
    return "\n\n".join(kept).strip()


_SERIAL_RE = re.compile(r"현장\s*컷|#\s*\d+|^\s*📷\s*")


def _clean_seo_text(s: Any) -> str:
    s = str(s or "").strip()
    s = _SERIAL_RE.sub("", s).strip()
    return re.sub(r"\s+", " ", s)


def resolve_photo_seo(
    raw: Any,
    photos: List[Dict[str, Any]],
    place_name: str,
    location: str,
) -> List[Dict[str, str]]:
    """AI가 준 photo_seo를 사진 수에 맞춰 정리. 비었거나 기계적 표현이면 사용자 힌트로 롱테일형 폴백 생성"""
    raw_list = raw if isinstance(raw, list) else []
    result: List[Dict[str, str]] = []
    for i, p in enumerate(photos):
        item = raw_list[i] if i < len(raw_list) and isinstance(raw_list[i], dict) else {}
        hint = _clean_seo_text(p.get("caption"))
        alt = _clean_seo_text(item.get("alt"))
        cap = _clean_seo_text(item.get("caption"))
        base = " ".join(x for x in [location, place_name, hint] if x).strip()
        if not alt:
            alt = base or place_name
        if not cap:
            cap = f"{place_name}{(' ' + hint) if hint else ''}".strip()
        result.append({"alt": alt, "caption": cap})
    return result


def render_figure(idx: int, src: str, alt: str, caption: str) -> str:
    """티스토리용 <figure> (일련번호·이모지 없는 alt/figcaption). data-photo-idx 는 프론트 편집 반영용"""
    return f"""
<figure class="tistory-review-image" data-photo-idx="{idx}" style="margin: 28px 0; text-align: center; display: block;">
  <img src="{src}" alt="{html_lib.escape(alt, quote=True)}" loading="lazy" style="max-width: 100%; height: auto; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.12); margin: 0 auto; display: inline-block;" />
  <figcaption style="font-size: 13px; color: #71717a; margin-top: 10px; font-weight: 500; text-align: center;">{html_lib.escape(caption)}</figcaption>
</figure>
"""


EXPERIENCE_BOX_HTML = (
    '<div class="experience-placeholder" style="margin: 28px 0; padding: 18px 22px; border: 2px dashed #f59e0b; '
    'border-radius: 12px; background: #fffbeb; color: #92400e; font-size: 14px; line-height: 1.7;">'
    "<strong>[💡 실무/현장 경험 한 줄 추가 구간]</strong><br/>"
    "발행 전에 이 박스를 지우고, 직접 겪은 경험 1~2문단(실제 대기 시간·계산서·아쉬웠던 순간 등)을 적어 주세요. "
    "본인 경험이 들어간 글이 검색에서 더 오래 살아남습니다."
    "</div>"
)

EXPERIENCE_MARKER_RE = re.compile(r"<!--\s*\[EXPERIENCE_BOX\]\s*-->")


def render_experience_box(html_text: str) -> str:
    """경험 마커를 안내 박스로 치환. AI가 마커를 빠뜨리면 마지막 <h2> 앞에 삽입"""
    if EXPERIENCE_MARKER_RE.search(html_text):
        return EXPERIENCE_MARKER_RE.sub(EXPERIENCE_BOX_HTML, html_text, count=1)
    h2s = [m.start() for m in re.finditer(r"<h2", html_text)]
    if h2s:
        pos = h2s[-1]
        return html_text[:pos] + EXPERIENCE_BOX_HTML + html_text[pos:]
    return html_text + EXPERIENCE_BOX_HTML


def style_summary_callout(html_text: str) -> str:
    """단일 요약 박스(<blockquote>) 스타일 적용"""
    return html_text.replace(
        "<blockquote>",
        '<blockquote style="margin: 20px 0; padding: 16px 20px; background: #f8fafc; border-left: 4px solid #3b82f6; '
        'border-radius: 8px; color: #334155; font-size: 15px; line-height: 1.8;">',
    )


_TRAILER_RE = re.compile(r"^(메타\s*설명|영문\s*슬러그|주요\s*키워드)\s*\**\s*[:：]\s*\**\s*(.*?)\**\s*$")


def extract_trailer(text: str):
    """원고 끝에 붙은 '메타 설명: / 영문 슬러그: / 주요 키워드:' 줄을 떼어 내고 값을 돌려준다.
    반환: (본문, {"meta": str, "slug": str, "keywords": [str]})"""
    lines = (text or "").rstrip().split("\n")
    info: Dict[str, Any] = {"meta": "", "slug": "", "keywords": []}
    keep = list(lines)
    start = max(0, len(lines) - 8)
    for i in range(len(lines) - 1, start - 1, -1):
        stripped = lines[i].strip().lstrip("*->•# ").strip()
        m = _TRAILER_RE.match(stripped)
        if not m:
            continue
        label, value = m.group(1), m.group(2).strip()
        if label.startswith("메타"):
            info["meta"] = value
        elif label.startswith("영문"):
            info["slug"] = normalize_slug(value)
        else:
            info["keywords"] = [k.strip().lstrip("#") for k in re.split(r"[,，]", value) if k.strip()]
        keep[i] = None
    body = "\n".join(l for l in keep if l is not None).rstrip()
    return body, info


def normalize_slug(slug: Any, fallback: str = "") -> str:
    s = str(slug or "").lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s[:60].strip("-") or fallback


def clean_title_candidates(raw: Any, title: str) -> List[str]:
    out: List[str] = []
    for t in (raw if isinstance(raw, list) else []):
        t = str(t or "").strip()
        if t and t not in out:
            out.append(t)
    if title and title not in out:
        out.insert(0, title)
    return out[:3]
