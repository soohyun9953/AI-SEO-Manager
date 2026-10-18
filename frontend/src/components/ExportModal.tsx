"use client";

import { useState } from "react";
import { 
  X, 
  Copy, 
  Download, 
  CheckCircle2, 
  ExternalLink, 
  FileCode, 
  FileText, 
  Hash, 
  Image as ImageIcon,
  AlertCircle
} from "lucide-react";

export interface ContentItem {
  id: string;
  title: string;
  keyword: string;
  related_keywords?: string;
  category?: string;
  content: string;
  content_html?: string;
  meta_description?: string;
  tags?: string;
  thumbnail_url?: string;
  body_images?: string[];
  reference_urls?: string[];
  internal_links?: string[];
  ai_model?: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  tistory_url?: string;
  created_at: string;
  updated_at: string;
  seo_score?: number;
}

interface ExportModalProps {
  content: ContentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ content, isOpen, onClose }: ExportModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen || !content) return null;

  const copyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadFile = (filename: string, text: string, mimeType: string) => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFullHtml = () => {
    const rawHtml = content.content_html || content.content;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": content.title,
      "description": content.meta_description || content.title,
      "keywords": content.keyword ? [content.keyword] : [],
      "datePublished": content.created_at,
      "dateModified": content.updated_at,
      "author": { "@type": "Person", "name": "AI SEO Writer" }
    };

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${content.title}</title>
  <meta name="description" content="${content.meta_description || ''}">
  <meta name="keywords" content="${content.tags || content.keyword}">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
${rawHtml}
</body>
</html>`;
  };

  const getFullPackageText = () => {
    return `[제목]
${content.title}

[핵심 키워드]
${content.keyword}

[태그]
${content.tags || content.keyword}

[본문]
${content.content}`;
  };

  const tistoryBlog = typeof window !== "undefined" ? localStorage.getItem("tistory_blog") || "s-elegant" : "s-elegant";
  const tistoryWriteUrl = `https://${tistoryBlog}.tistory.com/manage/post`;

  // 이미지 상태 판별
  const hasThumbnail = Boolean(content.thumbnail_url);
  const isBase64 = content.thumbnail_url?.startsWith("data:image");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl glass-card border border-white/[0.08] rounded-3xl p-7 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
              <Download className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight font-outfit">콘텐츠 복사 및 내보내기</h2>
              <p className="text-xs text-gray-400">티스토리 수동 붙여넣기 및 파일 다운로드를 지원합니다.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Target Content Overview */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">대상 콘텐츠</span>
          <p className="text-sm font-bold text-white leading-snug">{content.title}</p>
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1 flex-wrap">
            <span>키워드: <strong className="text-purple-300">{content.keyword}</strong></span>
            <span>카테고리: <strong className="text-emerald-300">{content.category || "일반"}</strong></span>
            <span>본문 길이: <strong>{content.content.length.toLocaleString()}자</strong></span>
          </div>
        </div>

        {/* 원클릭 클립보드 복사 섹션 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Copy size={14} className="text-blue-400" />
            원클릭 클립보드 복사
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            
            {/* 제목 복사 */}
            <button
              onClick={() => copyText(content.title, "title")}
              className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex flex-col gap-1.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">제목 복사</span>
                {copiedType === "title" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={14} className="text-gray-500 group-hover:text-blue-400" />}
              </div>
              <span className="text-[10px] text-gray-500">글 제목만 클립보드에 복사</span>
            </button>

            {/* 본문 복사 (Markdown) */}
            <button
              onClick={() => copyText(content.content, "content")}
              className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex flex-col gap-1.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">본문 복사 (MD)</span>
                {copiedType === "content" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={14} className="text-gray-500 group-hover:text-purple-400" />}
              </div>
              <span className="text-[10px] text-gray-500">마크다운 포맷 본문 텍스트</span>
            </button>

            {/* HTML 복사 */}
            <button
              onClick={() => copyText(getFullHtml(), "html")}
              className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex flex-col gap-1.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">HTML 원고 복사</span>
                {copiedType === "html" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={14} className="text-gray-500 group-hover:text-emerald-400" />}
              </div>
              <span className="text-[10px] text-gray-500">JSON-LD + 광고코드 내장</span>
            </button>

            {/* 태그 복사 */}
            <button
              onClick={() => copyText(content.tags || content.keyword, "tags")}
              className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex flex-col gap-1.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">태그 목록 복사</span>
                {copiedType === "tags" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Hash size={14} className="text-gray-500 group-hover:text-amber-400" />}
              </div>
              <span className="text-[10px] text-gray-500">쉼표 구분 키워드 태그</span>
            </button>

            {/* 전체 패키지 복사 */}
            <button
              onClick={() => copyText(getFullPackageText(), "all")}
              className="col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 border border-blue-500/20 flex flex-col gap-1.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-200">전체 원고 패키지 복사</span>
                {copiedType === "all" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={14} className="text-blue-400" />}
              </div>
              <span className="text-[10px] text-gray-400">제목 + 키워드 + 태그 + 본문 전체를 순서대로 한 번에 복사</span>
            </button>

          </div>
        </div>

        {/* 파일 다운로드 섹션 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Download size={14} className="text-emerald-400" />
            파일 내보내기 (다운로드)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => downloadFile(`${content.title.replace(/[\\/:*?"<>|]/g, "_")}.html`, getFullHtml(), "text/html")}
              className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex items-center justify-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition-all"
            >
              <FileCode size={16} className="text-emerald-400" />
              .HTML 다운로드
            </button>
            <button
              onClick={() => downloadFile(`${content.title.replace(/[\\/:*?"<>|]/g, "_")}.md`, content.content, "text/markdown")}
              className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex items-center justify-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition-all"
            >
              <FileText size={16} className="text-purple-400" />
              .MD 다운로드
            </button>
            <button
              onClick={() => downloadFile(`${content.title.replace(/[\\/:*?"<>|]/g, "_")}.txt`, getFullPackageText(), "text/plain")}
              className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex items-center justify-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition-all"
            >
              <FileText size={16} className="text-blue-400" />
              .TXT 다운로드
            </button>
          </div>
        </div>

        {/* 이미지 상태 및 티스토리 업로드 유의사항 */}
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-300">이미지 첨부 및 티스토리 업로드 상태</span>
          </div>
          {hasThumbnail ? (
            <div className="flex items-center gap-4">
              <img 
                src={content.thumbnail_url} 
                alt="썸네일" 
                className="w-16 h-16 rounded-xl object-cover border border-white/[0.1]" 
              />
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-white font-medium">대표 썸네일 준비됨</span>
                <span className="text-[11px] text-amber-400/90 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {isBase64 
                    ? "생성된 AI 이미지 파일입니다. 티스토리 에디터의 [사진 첨부] 기능으로 직접 등록해주세요."
                    : "외부 URL 이미지입니다. 티스토리 서버에 직접 업로드되지 않았습니다."}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              대표 이미지가 설정되지 않았습니다. [이미지 생성기] 메뉴에서 썸네일을 생성하여 추가할 수 있습니다.
            </p>
          )}
        </div>

        {/* 티스토리 글쓰기 새 탭 바로가기 */}
        <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-gray-500">
            티스토리 블로그: <strong className="text-orange-400">{tistoryBlog}</strong>
          </div>
          <a
            href={tistoryWriteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all hover:scale-105 active:scale-95"
          >
            <ExternalLink size={14} />
            티스토리 글쓰기 새 창 열기
          </a>
        </div>

      </div>
    </div>
  );
}
