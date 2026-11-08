// 티스토리 에디터(기본/HTML 모드)·모바일 스킨(/m/...)은 외부 CSS 클래스를 무시하므로
// Export 시 모든 요소를 반응형 인라인 스타일로 변환한다. 여러 번 적용해도 결과가 같다(멱등).

export const H2_STYLE =
  "font-size: 1.35rem; font-weight: 700; color: #1e293b; border-left: 5px solid #2563eb; padding-left: 12px; margin: 36px 0 16px 0; line-height: 1.4;";
export const H3_STYLE = "font-size: 1.15rem; font-weight: 600; color: #334155; margin: 24px 0 12px 0;";
export const CALLOUT_STYLE =
  "background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0f172a; border-radius: 6px; padding: 18px 20px; margin: 24px 0; line-height: 1.7;";
export const TABLE_WRAP_STYLE = "overflow-x: auto; margin: 24px 0;";
export const TABLE_STYLE = "width: 100%; border-collapse: collapse; font-size: 0.95rem;";
export const TH_STYLE =
  "background-color: #f1f5f9; font-weight: 700; color: #0f172a; text-align: left; border: 1px solid #e2e8f0; padding: 10px 12px;";
export const TD_STYLE = "border: 1px solid #e2e8f0; padding: 10px 12px;";

/** 여는 태그의 기존 style 속성은 지우고 지정한 style을 넣는다(다른 속성은 보존) */
function setStyle(tagName: string, attrs: string, style: string): string {
  const rest = attrs.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/\s+$/, "");
  return `<${tagName}${rest} style="${style}">`;
}

function styleAll(html: string, tagName: string, style: string): string {
  const re = new RegExp(`<${tagName}((?:\\s[^>]*)?)>`, "gi");
  return html.replace(re, (_m, attrs: string) => setStyle(tagName, attrs || "", style));
}

function styleTable(block: string): string {
  let out = block.replace(/^<table((?:\s[^>]*)?)>/i, (_m, attrs: string) => setStyle("table", attrs || "", TABLE_STYLE));
  out = styleAll(out, "th", TH_STYLE);
  out = styleAll(out, "td", TD_STYLE);
  return `<div data-table-wrap="1" style="${TABLE_WRAP_STYLE}">${out}</div>`;
}

export function applyInlineStyles(html: string): string {
  if (!html) return html;
  let out = html;

  out = styleAll(out, "h2", H2_STYLE);
  out = styleAll(out, "h3", H3_STYLE);

  // 요약 콜아웃(blockquote): 박스 스타일 + 내부 문단/목록 여백
  out = out.replace(/<blockquote((?:\s[^>]*)?)>([\s\S]*?)<\/blockquote>/gi, (_m, attrs: string, inner: string) => {
    let body = styleAll(inner, "p", "margin: 0 0 8px 0;");
    body = styleAll(body, "ul", "margin: 8px 0 0 0; padding-left: 20px;");
    body = styleAll(body, "ol", "margin: 8px 0 0 0; padding-left: 20px;");
    return `${setStyle("blockquote", attrs || "", CALLOUT_STYLE)}${body}</blockquote>`;
  });

  // 표: 이미 스크롤 래퍼로 감싼 표는 건너뛰어 중복 래핑을 막는다
  out = out.replace(/(<div data-table-wrap="1"[^>]*>)?(<table\b[\s\S]*?<\/table>)/gi, (m, wrap: string | undefined, table: string) => {
    if (wrap) return m; // 이미 변환됨
    return styleTable(table);
  });

  return out;
}
