// /editor 전용 도구: 마크다운→HTML, 애드센스 자동 배치(미리보기 배지 / 실제 코드),
// CTA 내부 링크 카드, 실시간 SEO·수익성 진단(100점 만점)
import { marked } from "marked";

export interface EditorAdConfig {
  clientId: string; // ca-pub-xxxxxxxx
  slot: string; // 두 번째 H2 위 광고 data-ad-slot
  endSlot: string; // 마지막 H2 위 광고 Slot (비우면 slot 재사용)
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 마크다운 → HTML (에디터 수정 내용이 항상 최종 HTML에 반영되도록 클라이언트에서 변환) */
export function markdownToHtml(md: string): string {
  if (!md) return "";
  // 예전 버전이 본문에 끼워 넣던 광고 자리표시자는 제거 (새 자동 배치와 중복 방지)
  const cleaned = md
    .replace(/<!--\s*\[구글 애드센스[^\]]*\]\s*-->\s*/g, "")
    .replace(/<div class="adsense-placeholder"[\s\S]*?<\/div>\s*/g, "");
  return marked.parse(cleaned, { async: false, gfm: true, breaks: true }) as string;
}

const AD_BADGE =
  '<div data-ad-badge="1" style="margin: 28px 0; padding: 26px 12px; text-align: center; min-height: 120px; border: 2px dashed #a855f7; border-radius: 12px; background: rgba(168,85,247,0.08); color: #a855f7; font-size: 13px; font-weight: 700;">[AdSense 인아티클 광고 영역]</div>';

function inArticleAd(cfg: EditorAdConfig, slot: string): string {
  return (
    `\n<div style="margin: 28px 0; text-align: center; min-height: 120px;">\n` +
    `<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" ` +
    `data-ad-client="${esc(cfg.clientId.trim())}" data-ad-slot="${esc(slot.trim())}"></ins>\n` +
    `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>\n</div>\n`
  );
}

export const adConfigReady = (cfg: EditorAdConfig) => !!cfg.clientId.trim() && !!cfg.slot.trim();

/** 두 번째 <h2> 위와 마지막 <h2> 위에 광고 배치. badge=미리보기 배지, code=실제 <ins> 코드 */
export function insertEditorAds(html: string, cfg: EditorAdConfig, mode: "badge" | "code"): string {
  if (!html) return html;
  if (mode === "code" && !adConfigReady(cfg)) return html;
  const h2s = [...html.matchAll(/<h2[\s>]/g)].map(m => m.index as number);
  if (h2s.length < 2) return html;
  const lastPos = h2s[h2s.length - 1];
  const positions = Array.from(new Set([h2s[1], lastPos])).sort((a, b) => b - a); // 뒤에서부터 삽입
  let out = html;
  for (const pos of positions) {
    const slot = pos === lastPos && cfg.endSlot.trim() ? cfg.endSlot : cfg.slot;
    out = out.slice(0, pos) + (mode === "badge" ? `\n${AD_BADGE}\n` : inArticleAd(cfg, slot)) + out.slice(pos);
  }
  return out;
}

/** CTA 내부 링크 카드 (좌측 컬러 보더 + 굵은 제목 + 화살표). 마크다운에 넣을 수 있게 한 줄 HTML */
export function buildCtaCard(title: string, url: string): string {
  return (
    `<div data-cta-card="1" style="margin: 28px 0; padding: 18px 22px; border-left: 5px solid #2563eb; border-radius: 10px; background: #f1f5ff;">` +
    `<a href="${esc(url.trim())}" style="display: block; text-decoration: none; color: #1e3a8a; font-size: 17px; font-weight: 800; line-height: 1.5;">` +
    `${esc(title.trim())} <span style="color: #2563eb; font-weight: 900;">→</span></a>` +
    `<span style="display: block; margin-top: 4px; color: #64748b; font-size: 13px;">함께 읽으면 도움이 되는 글 · 지금 바로 확인하기</span></div>`
  );
}

const CTA_LINE_RE = /^<div data-cta-card="1".*<\/div>\s*$/;

export function countCtaCards(md: string): number {
  return md.split("\n").filter(l => CTA_LINE_RE.test(l.trim())).length;
}

export function removeCtaCards(md: string): string {
  return md
    .split("\n")
    .filter(l => !CTA_LINE_RE.test(l.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** 본문 중간(세 번째 ## 소제목 앞, 없으면 중간 소제목 앞, 소제목이 없으면 끝)에 카드 삽입 */
export function insertCtaCardIntoMarkdown(md: string, card: string): string {
  const lines = md.split("\n");
  const heads = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);
  if (heads.length === 0) return md.replace(/\s*$/, "") + "\n\n" + card + "\n";
  const target = heads.length >= 3 ? heads[2] : heads[Math.floor(heads.length / 2)];
  lines.splice(target, 0, "", card, "");
  return lines.join("\n");
}

// ───────── 실시간 SEO·수익성 진단 (100점 만점) ─────────
export interface EditorScoreItem {
  label: string;
  score: number;
  max: number;
  detail: string;
  warn?: boolean;
}

export function computeEditorScore(p: {
  article: string;
  adsOn: boolean;
  adReady: boolean;
}): { total: number; items: EditorScoreItem[] } {
  const md = p.article || "";
  const lines = md.replace(/\r/g, "").split("\n");

  // ① 첫 문단 150자 스니펫: 제목(#)을 건너뛰고 처음 나오는 블록이 평문 문단이어야 한다
  let i = 0;
  while (i < lines.length && (!lines[i].trim() || /^#\s/.test(lines[i]))) i++;
  const first = (lines[i] || "").trim();
  let leadItem: EditorScoreItem;
  if (!first) {
    leadItem = { label: "① 첫 문단 150자 스니펫", score: 0, max: 20, detail: "본문 없음", warn: true };
  } else if (/^(>|\||!|<|-|\*|\d+\.|#{2,})/.test(first)) {
    leadItem = {
      label: "① 첫 문단 150자 스니펫",
      score: 0,
      max: 20,
      detail: "박스/목록/소제목이 첫 문단보다 먼저 나옵니다",
      warn: true,
    };
  } else {
    const paraLines: string[] = [];
    for (let j = i; j < lines.length && lines[j].trim(); j++) paraLines.push(lines[j].trim());
    const len = paraLines.join(" ").replace(/\*+/g, "").length;
    const cliche = /안녕하세요|인플루언서입니다|알아(보겠|보도록)|포스팅을?\s*시작/.test(first);
    const base = len >= 130 && len <= 170 ? 20 : len >= 100 && len <= 220 ? 10 : 0;
    leadItem = {
      label: "① 첫 문단 150자 스니펫",
      score: cliche ? Math.min(base, 5) : base,
      max: 20,
      detail: `${len}자${cliche ? " · AI 인사말 감지" : base === 20 ? " · 적합" : " · 140~160자 권장"}`,
      warn: cliche || base < 20,
    };
  }

  // ② H2/H3 소제목
  const headingCount = lines.filter(l => /^#{2,3}\s/.test(l)).length;
  const headItem: EditorScoreItem = {
    label: "② H2/H3 소제목 개수",
    score: headingCount >= 4 ? 20 : headingCount >= 2 ? 10 : 0,
    max: 20,
    detail: `${headingCount}개 (4개 이상 권장)`,
    warn: headingCount < 4,
  };

  // ③ 비교표
  const hasTable = /^\s*\|.+\|\s*\n\s*\|[\s:|-]+\|/m.test(md) || /<table[\s>]/i.test(md);
  const tableItem: EditorScoreItem = {
    label: "③ 비교표(Table) 포함",
    score: hasTable ? 20 : 0,
    max: 20,
    detail: hasTable ? "포함" : "표 없음 — 스펙·가격·장단점 비교표 추가 권장",
    warn: !hasTable,
  };

  // ④ 이미지 Alt
  const alts: string[] = [];
  for (const m of md.matchAll(/!\[([^\]]*)\]\([^)]*\)/g)) alts.push(m[1]);
  for (const m of md.matchAll(/<img[^>]*?\salt="([^"]*)"/g)) alts.push(m[1]);
  for (const m of md.matchAll(/\[IMAGE_SLOT:\s*alt\s*=\s*"([^"]*)"/g)) alts.push(m[1]);
  let altItem: EditorScoreItem;
  if (alts.length === 0) {
    altItem = { label: "④ 이미지 Alt 키워드", score: 10, max: 20, detail: "이미지 없음 (넣는다면 Alt 입력 필수)" };
  } else if (alts.some(a => /#\s*\d+|현장\s*컷/.test(a))) {
    altItem = {
      label: "④ 이미지 Alt 키워드",
      score: 5,
      max: 20,
      detail: "⚠ 일련번호(#1)/'현장 컷' 포함 Alt가 있습니다",
      warn: true,
    };
  } else if (alts.some(a => a.trim().length < 10)) {
    const bad = alts.filter(a => a.trim().length < 10).length;
    altItem = { label: "④ 이미지 Alt 키워드", score: 0, max: 20, detail: `Alt가 비었거나 너무 짧음 (${bad}/${alts.length})`, warn: true };
  } else {
    altItem = { label: "④ 이미지 Alt 키워드", score: 20, max: 20, detail: `${alts.length}개 모두 입력됨` };
  }

  // ⑤ 본문 중간 광고
  const h2Count = lines.filter(l => /^##\s/.test(l)).length;
  const hasAdCode = /adsbygoogle/.test(md);
  let adItem: EditorScoreItem;
  if (hasAdCode) adItem = { label: "⑤ 본문 중간 광고", score: 20, max: 20, detail: "본문에 광고 코드 포함" };
  else if (p.adsOn && p.adReady && h2Count >= 2)
    adItem = { label: "⑤ 본문 중간 광고", score: 20, max: 20, detail: "자동 배치 켜짐 (2번째·마지막 H2 위)" };
  else if (p.adsOn && !p.adReady)
    adItem = { label: "⑤ 본문 중간 광고", score: 10, max: 20, detail: "자동 배치는 켜졌지만 ID/Slot 미입력", warn: true };
  else if (p.adsOn) adItem = { label: "⑤ 본문 중간 광고", score: 10, max: 20, detail: "H2가 2개 이상 필요", warn: true };
  else adItem = { label: "⑤ 본문 중간 광고", score: 0, max: 20, detail: "자동 배치 꺼짐", warn: true };

  const items = [leadItem, headItem, tableItem, altItem, adItem];
  return { total: items.reduce((a, b) => a + b.score, 0), items };
}
