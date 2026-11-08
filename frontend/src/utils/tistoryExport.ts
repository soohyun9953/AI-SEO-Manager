// 티스토리 복사용 HTML 조립 유틸: 이미지 Alt·캡션 반영, 애드센스 인아티클 자동 삽입,
// FAQ JSON-LD, 내부 링크 카드, 실시간 SEO 점수판

import { applyInlineStyles } from "./tistoryInline";

export interface PhotoSeo {
  alt: string;
  caption: string;
}

export interface AdSenseConfig {
  enabled: boolean;
  clientId: string; // ca-pub-xxxxxxxx
  midSlot: string; // 본문 중간 광고 Slot ID
  endSlot: string; // 결론 상단 광고 Slot ID
  includeLoader: boolean; // adsbygoogle.js 로더 스크립트 포함 여부
}

export interface InternalLink {
  id: string;
  title: string;
  url: string;
  desc: string;
}

export const DEFAULT_ADSENSE: AdSenseConfig = {
  enabled: false,
  clientId: "",
  midSlot: "",
  endSlot: "",
  includeLoader: false,
};

// 블로그 대표 고성과/고단가 포스트 프리셋 (URL은 직접 채워 넣으면 저장됨. URL이 비어 있으면 삽입에서 제외)
export const DEFAULT_INTERNAL_LINKS: InternalLink[] = [
  { id: "preset-1", title: "조기재취업수당 후기", url: "", desc: "신청 조건부터 수령까지 실제 과정 정리" },
  { id: "preset-2", title: "정보시스템 감리원 취업", url: "", desc: "자격 요건과 준비 순서, 현업 팁" },
  { id: "preset-3", title: "공공 AI 도입 가이드 정리", url: "", desc: "공공기관 AI 도입 시 확인할 가이드라인" },
  { id: "preset-4", title: "재테크 절세 총정리", url: "", desc: "놓치기 쉬운 세금·공제 항목 체크" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stripTags = (s: string) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// ───────── 이미지 Alt·캡션 반영 ─────────
export function applyPhotoSeo(html: string, photoSeo: PhotoSeo[]): string {
  if (!html || photoSeo.length === 0) return html;
  return html.replace(/<figure[^>]*data-photo-idx="(\d+)"[^>]*>[\s\S]*?<\/figure>/g, (block, idxStr: string) => {
    const seo = photoSeo[Number(idxStr) - 1];
    if (!seo) return block;
    let out = block;
    if (seo.alt.trim()) {
      out = out.replace(/(<img[^>]*?\salt=")[^"]*(")/, (_m, a: string, b: string) => `${a}${esc(seo.alt.trim())}${b}`);
    }
    if (seo.caption.trim()) {
      out = out.replace(/(<figcaption[^>]*>)[\s\S]*?(<\/figcaption>)/, (_m, a: string, b: string) => `${a}${esc(seo.caption.trim())}${b}`);
    }
    return out;
  });
}

// ───────── 애드센스 인아티클 자동 삽입 ─────────
function adBlock(cfg: AdSenseConfig, slot: string): string {
  const loader = cfg.includeLoader
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.clientId)}" crossorigin="anonymous"></script>\n`
    : "";
  return (
    `\n<div style="margin: 28px 0; text-align: center; min-height: 120px;">\n${loader}` +
    `<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" ` +
    `data-ad-client="${esc(cfg.clientId)}" data-ad-slot="${esc(slot)}"></ins>\n` +
    `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>\n</div>\n`
  );
}

export function insertAdSense(html: string, cfg: AdSenseConfig): string {
  if (!cfg.enabled || !cfg.clientId.trim() || !html) return html;
  const h2s = [...html.matchAll(/<h2[\s>]/g)].map(m => m.index as number);

  // 위치 1: 첫 번째 표(Table) 직하단 → 없으면 두 번째 <h2> 바로 위
  let pos1 = -1;
  const tableEnd = html.indexOf("</table>");
  if (tableEnd >= 0) {
    pos1 = tableEnd + "</table>".length;
    // 표가 가로 스크롤 래퍼(<div>)로 감싸져 있으면 래퍼 밖(바로 아래)에 광고를 둔다
    if (html.slice(pos1, pos1 + 6) === "</div>") pos1 += 6;
  }
  else if (h2s.length >= 2) pos1 = h2s[1];

  // 위치 2: 자주 묻는 질문(FAQ) <h2> 바로 위 → 없으면 마지막 <h2>(결론) 위
  let pos2 = -1;
  const faqMatch = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].find(m => /자주\s*묻는|FAQ|Q&amp;A|Q&A/i.test(stripTags(m[1])));
  if (faqMatch && faqMatch.index !== undefined) pos2 = faqMatch.index;
  else if (h2s.length >= 2) pos2 = h2s[h2s.length - 1];

  const inserts: { pos: number; code: string }[] = [];
  if (pos1 >= 0 && cfg.midSlot.trim()) inserts.push({ pos: pos1, code: adBlock(cfg, cfg.midSlot.trim()) });
  if (pos2 >= 0 && cfg.endSlot.trim() && (pos1 < 0 || pos2 > pos1 + 1)) {
    inserts.push({ pos: pos2, code: adBlock(cfg, cfg.endSlot.trim()) });
  }
  // 뒤에서부터 삽입해야 앞쪽 인덱스가 밀리지 않는다
  inserts.sort((a, b) => b.pos - a.pos);
  let out = html;
  for (const ins of inserts) out = out.slice(0, ins.pos) + ins.code + out.slice(ins.pos);
  return out;
}

// ───────── FAQ JSON-LD ─────────
export function parseFaq(article: string): { q: string; a: string }[] {
  const items: { q: string; a: string }[] = [];
  const text = (article || "").replace(/\r/g, "");
  const re = /\*{0,2}Q\.\s*([^\n*]+?)\*{0,2}\s*(?:\n|\/)\s*A\.\s*([\s\S]+?)(?=\n\s*\n|\n\s*\*{0,2}Q\.|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const q = m[1].replace(/\*+/g, "").trim();
    const a = m[2].replace(/\*+/g, "").replace(/\s*\n\s*/g, " ").trim();
    if (q && a) items.push({ q, a });
  }
  return items;
}

export function buildFaqJsonLd(article: string): string {
  const faq = parseFaq(article);
  if (faq.length === 0) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return `\n<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

// ───────── 내부 링크 카드 ─────────
export function buildInternalLinkCard(links: InternalLink[]): string {
  const valid = links.filter(l => l.url.trim());
  if (valid.length === 0) return "";
  const rows = valid
    .map(
      l =>
        `<li style="margin: 0 0 10px;"><a href="${esc(l.url.trim())}" style="color: #1d4ed8; font-weight: 700; text-decoration: none;">${esc(l.title)}</a>` +
        (l.desc.trim() ? `<br/><span style="color: #64748b; font-size: 13px;">${esc(l.desc.trim())}</span>` : "") +
        `</li>`
    )
    .join("");
  return (
    `\n<div data-internal-links="1" style="margin: 30px 0; padding: 20px 22px; border: 1px solid #dbeafe; border-left: 4px solid #2563eb; border-radius: 12px; background: #f8fbff;">` +
    `<p style="margin: 0 0 12px; font-weight: 800; font-size: 16px; color: #1e3a8a;">함께 읽으면 돈이 되는 글</p>` +
    `<ul style="margin: 0; padding-left: 18px; line-height: 1.7; font-size: 15px;">${rows}</ul></div>\n`
  );
}

/** 본문 중간(세 번째 <h2> 앞, 없으면 중간 <h2> 앞)에 삽입. 이미 카드가 있으면 교체 */
export function insertInternalLinkCard(html: string, card: string): string {
  if (!card) return html;
  let base = html.replace(/\n?<div data-internal-links="1"[\s\S]*?<\/ul><\/div>\n?/, "\n");
  const h2s = [...base.matchAll(/<h2[\s>]/g)].map(m => m.index as number);
  if (h2s.length === 0) return base + card;
  const target = h2s.length >= 3 ? h2s[2] : h2s[Math.floor(h2s.length / 2)];
  base = base.slice(0, target) + card + base.slice(target);
  return base;
}

// ───────── 최종 조립 ─────────
export function buildFinalHtml(opts: {
  html: string;
  article: string;
  photoSeo: PhotoSeo[];
  adsense: AdSenseConfig;
  includeFaqJsonLd: boolean;
}): string {
  let out = applyPhotoSeo(opts.html, opts.photoSeo);
  out = applyInlineStyles(out); // 티스토리 기본/HTML 모드·모바일에서 깨지지 않도록 모든 요소를 인라인 스타일로
  out = insertAdSense(out, opts.adsense);
  if (opts.includeFaqJsonLd) out += buildFaqJsonLd(opts.article);
  return out;
}

export const hasExperiencePlaceholder = (html: string) => html.includes("experience-placeholder");

// ───────── 실시간 SEO 점수판 ─────────
export interface SeoCheck {
  label: string;
  ok: boolean;
  detail: string;
}

const CLICHE = /안녕하세요|인플루언서입니다|알아(보겠|보도록)|공감과?\s*댓글|구독과?\s*좋아요|도움이\s*되셨다면/;
const SERIAL = /현장\s*컷|#\s*\d+/;

export function computeSeoChecks(p: {
  title: string;
  metaDesc: string;
  slug: string;
  html: string;
  article: string;
  photoSeo: PhotoSeo[];
  hasInternalLink: boolean;
}): SeoCheck[] {
  const body = p.html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const firstP = (body.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
  const lead = stripTags(firstP);
  const firstBlock = body.trimStart().slice(0, 12);
  const blockquotes = (body.match(/<blockquote/g) || []).length;
  const h2Count = (body.match(/<h2[\s>]/g) || []).length;
  const faqCount = parseFaq(p.article).length;
  const plain = stripTags(body);
  const alts = p.photoSeo;
  const photoOk = alts.every(
    s => s.alt.trim().length >= 15 && s.caption.trim().length >= 10 && !SERIAL.test(s.alt) && !SERIAL.test(s.caption)
  );

  return [
    { label: "도입 리드 문단 140~160자", ok: lead.length >= 130 && lead.length <= 170, detail: `${lead.length}자` },
    { label: "리드 문단이 박스보다 먼저 배치", ok: firstBlock.startsWith("<p"), detail: firstBlock.startsWith("<p") ? "첫 블록 = 본문 문단" : "첫 블록이 박스/제목" },
    { label: "요약 박스 1개", ok: blockquotes === 1, detail: `${blockquotes}개` },
    { label: "제목 35자 이내", ok: p.title.length > 0 && p.title.length <= 35, detail: `${p.title.length}자` },
    { label: "메타 디스크립션 140~155자", ok: p.metaDesc.length >= 140 && p.metaDesc.length <= 155, detail: `${p.metaDesc.length}자` },
    { label: "영문 URL 슬러그", ok: /^[a-z0-9]+(-[a-z0-9]+){1,}$/.test(p.slug), detail: p.slug || "없음" },
    { label: "이미지 Alt·캡션(일련번호 없음)", ok: alts.length === 0 || photoOk, detail: alts.length === 0 ? "사진 없음" : photoOk ? "양호" : "짧거나 '#1/현장 컷' 포함" },
    { label: "소제목(H2) 4개 이상", ok: h2Count >= 4, detail: `${h2Count}개` },
    { label: "FAQ 2개 이상 (리치 스니펫)", ok: faqCount >= 2, detail: `${faqCount}개` },
    { label: "AI 상투어 없음", ok: !CLICHE.test(plain), detail: CLICHE.test(plain) ? "인사말/맺음말 감지" : "양호" },
    { label: "직접 경험 박스 작성 완료", ok: !hasExperiencePlaceholder(p.html), detail: hasExperiencePlaceholder(p.html) ? "안내 박스가 남아 있음" : "완료" },
    { label: "내부 링크 카드 삽입", ok: p.hasInternalLink, detail: p.hasInternalLink ? "삽입됨" : "미삽입" },
  ];
}
