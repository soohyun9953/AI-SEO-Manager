"""
IT 글 SEO 수정 + 다이어그램 이미지 파이프라인 (로컬 전용)

흐름: 클로드 답변(글 + SVG 다이어그램) 파싱 → SVG 안전 정제 → 크롬으로 PNG 변환 → 티스토리용 HTML 조립
- 클로드와의 대화는 claude_bot.ClaudeWebAutomator.generate_it_post 가 담당한다.
- 이 모듈은 답변 해석(parse_it_response), SVG 정제(sanitize_svg), PNG 변환(render_svgs_to_png),
  본문 조립(build_tistory_html)만 맡는다.
"""

import base64
import concurrent.futures
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

LABEL_PATTERN = re.compile(r"^\[(제목|메타설명|본문|태그|다이어그램\s*(\d+))\][ \t]*(.*)$", re.MULTILINE)
MAX_SVG_CHARS = 60000
PNG_WIDTH = 1600


# ---------------------------------------------------------------- 답변 해석
def parse_it_response(raw: str) -> Dict[str, Any]:
    """클로드 답변을 제목·메타설명·본문·태그·다이어그램으로 나눈다"""
    text = (raw or "").strip()
    # 바깥을 감싼 코드 펜스(백틱 3개 이상) 제거
    text = re.sub(r"^`{3,}[^\n]*\n", "", text)
    text = re.sub(r"\n`{3,}\s*$", "", text)

    matches = list(LABEL_PATTERN.finditer(text))
    if not matches:
        raise ValueError("답변에서 [제목], [본문] 같은 구분 표시를 찾지 못했습니다.")

    sections: Dict[str, str] = {}
    diagrams: Dict[int, str] = {}
    for idx, m in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        body = (m.group(3) + "\n" if m.group(3) else "") + text[m.end():end]
        label = m.group(1)
        if label.startswith("다이어그램"):
            diagrams[int(m.group(2))] = body.strip()
        else:
            sections[label] = body.strip()

    title = re.sub(r"^[#\s\"'“”]+|[\"'“”\s]+$", "", (sections.get("제목", "").splitlines() or [""])[0]).strip()
    article_md = sections.get("본문", "").strip()
    if not title or not article_md:
        raise ValueError("답변에 제목 또는 본문이 비어 있습니다.")

    tags = [t.strip().lstrip("#") for t in re.split(r"[,\n]", sections.get("태그", "")) if t.strip().lstrip("#")]

    parsed_diagrams: List[Dict[str, Any]] = []
    for number in sorted(diagrams):
        block = diagrams[number]
        caption_match = re.search(r"^\s*캡션\s*[:：]\s*(.+)$", block, re.MULTILINE)
        svg_match = re.search(r"<svg[\s\S]*?</svg>", block, re.IGNORECASE)
        parsed_diagrams.append({
            "number": number,
            "caption": caption_match.group(1).strip() if caption_match else f"그림 {number}",
            "svg": svg_match.group(0) if svg_match else "",
        })

    return {
        "title": title,
        "meta_description": " ".join(sections.get("메타설명", "").split()),
        "article_md": article_md,
        "tags": tags[:20],
        "diagrams": parsed_diagrams,
    }


# ---------------------------------------------------------------- SVG 안전 정제
def sanitize_svg(svg: str) -> Optional[str]:
    """스크립트·외부 참조·이벤트 속성을 제거하고, 형식이 올바른 SVG만 돌려준다 (부적합하면 None)"""
    if not svg or len(svg) > MAX_SVG_CHARS:
        return None
    s = svg
    s = re.sub(r"<script[\s\S]*?</script>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"<foreignObject[\s\S]*?</foreignObject>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"<(iframe|object|embed)[\s\S]*?(</\1>|/>)", "", s, flags=re.IGNORECASE)
    s = re.sub(r"<(image|use|animate\w*|set)\b[^>]*?/?>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*')", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s(xlink:)?href\s*=\s*(\"[^\"]*\"|'[^']*')", "", s, flags=re.IGNORECASE)
    s = re.sub(r"url\(\s*['\"]?\s*(https?:|//|data:|javascript:)[^)]*\)", "none", s, flags=re.IGNORECASE)
    s = re.sub(r"@import[^;]*;", "", s, flags=re.IGNORECASE)
    s = s.strip()

    if "xmlns=" not in s.split(">", 1)[0]:
        s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    try:
        root = ET.fromstring(s)
    except ET.ParseError:
        return None
    if not root.tag.lower().endswith("svg") or not root.get("viewBox"):
        return None
    return s


def _viewbox_ratio(svg: str) -> float:
    m = re.search(r'viewBox\s*=\s*"([\d.\-\s,]+)"', svg)
    try:
        _, _, w, h = [float(v) for v in re.split(r"[\s,]+", m.group(1).strip())]
        return h / w if w else 0.5
    except Exception:
        return 0.5


# ---------------------------------------------------------------- PNG 변환 (Claude 봇과 같은 크롬 사용)
def _render_worker(svgs: List[str]) -> List[Optional[str]]:
    from playwright.sync_api import sync_playwright
    from claude_bot import ensure_debug_chrome, CHROME_CDP_URL, log

    ensure_debug_chrome()
    results: List[Optional[str]] = []
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CHROME_CDP_URL)
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page = context.new_page()
        try:
            for idx, svg in enumerate(svgs, start=1):
                try:
                    html = (
                        "<!doctype html><html><head><meta charset='utf-8'><style>"
                        "html,body{margin:0;padding:0;background:#fff}"
                        f"#wrap{{width:{PNG_WIDTH}px;background:#fff}}"
                        "#wrap svg{display:block;width:100%;height:auto}"
                        "</style></head><body><div id='wrap'>" + svg + "</div></body></html>"
                    )
                    page.set_content(html, wait_until="load")
                    page.wait_for_timeout(300)
                    png = page.locator("#wrap").screenshot(type="png")
                    results.append("data:image/png;base64," + base64.b64encode(png).decode("ascii"))
                    log(f"[OK] [IT Post] 다이어그램 {idx} 이미지 변환 완료 ({len(png) // 1024}KB)")
                except Exception as e:
                    log(f"[WARN] [IT Post] 다이어그램 {idx} 변환 실패: {e}")
                    results.append(None)
        finally:
            try:
                page.close(run_before_unload=False)
            except Exception:
                pass
    return results


def render_svgs_to_png(svgs: List[str]) -> List[Optional[str]]:
    """정제된 SVG 목록을 PNG(data URL) 목록으로 바꾼다. 변환에 실패한 항목은 None"""
    if not svgs:
        return []
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(_render_worker, svgs).result()


# ---------------------------------------------------------------- 본문 조립
def build_tistory_html(automator, article_md: str, title: str, images: List[Optional[Dict[str, str]]]) -> str:
    """마크다운 본문의 PHOTO 슬롯 위치에 다이어그램 이미지를 넣어 티스토리용 HTML을 만든다.
    images[i]: {"data_url", "caption"} 또는 None(변환 실패 → 해당 슬롯은 제거)"""
    photos = [img if img else {"data_url": "", "caption": ""} for img in images]
    return automator._markdown_to_tistory_html(article_md, title, photos=photos)
