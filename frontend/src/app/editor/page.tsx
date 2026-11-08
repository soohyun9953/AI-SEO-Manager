"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PenTool, Send, Copy, Eye, FileText, Loader2, CheckCircle, Zap, Layout, Hash, Trash2, Save, Download, Wallet, Link2, Gauge } from "lucide-react";
import Link from "next/link";
import ExportModal from "@/components/ExportModal";
import { applyInlineStyles } from "@/utils/tistoryInline";
import { APP_VERSION, APP_RELEASE_DATE } from "@/utils/appVersion";
import {
  EditorAdConfig,
  adConfigReady,
  buildCtaCard,
  computeEditorScore,
  countCtaCards,
  insertCtaCardIntoMarkdown,
  insertEditorAds,
  markdownToHtml,
  removeCtaCards,
} from "@/utils/editorTools";

const AD_CFG_KEY = "exp_adsense_cfg"; // 체험후기 페이지와 동일한 키를 공유 (ID/Slot은 한 번만 입력)

// 본문 첫 문단(제목·박스 제외)을 메타 디스크립션 후보로 사용
function firstParagraph(md: string): string {
  for (const block of md.replace(/\r/g, "").split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || /^(#|>|\||!|<|-|\*|\d+\.)/.test(t)) continue;
    return t.replace(/\*+/g, "").replace(/\s+/g, " ");
  }
  return "";
}

function EditorContent() {
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get("topic");
  const urlKeyword = searchParams.get("keyword");
  const fromAnalytics = searchParams.get("from") === "analytics";

  const [topic, setTopic] = useState(urlTopic || "");
  const [keyword, setKeyword] = useState(urlKeyword || "");
  const [article, setArticle] = useState("");
  const [htmlArticle, setHtmlArticle] = useState("");
  const [jsonLd, setJsonLd] = useState<any>(null);
  // 예전 '황금 광고 배치' 자리표시자는 새 자동 배치(우측 사이드바)로 대체되어 서버에는 항상 끈 상태로 요청한다
  const adsenseOptimize = false;
  const [affiliateOptimize, setAffiliateOptimize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "seo" | "html">("editor");
  const [publishing, setPublishing] = useState(false);
  
  const [savingToDB, setSavingToDB] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // SEO 메타 바 (영문 슬러그 / 메타 디스크립션 / 추천 태그)
  const [slug, setSlug] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 수익화(AdSense) & 내부 링크 삽입기
  const [adCfg, setAdCfg] = useState<EditorAdConfig>({ clientId: "", slot: "", endSlot: "" });
  const [adsOn, setAdsOn] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [ctaTitle, setCtaTitle] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AD_CFG_KEY) || "null");
      if (saved && typeof saved === "object") {
        setAdCfg({ clientId: saved.clientId || "", slot: saved.midSlot || "", endSlot: saved.endSlot || "" });
      }
    } catch {}
    setAdsOn(localStorage.getItem("editor_ads_on") === "1");
    setSlug(localStorage.getItem("seo_editor_slug") || "");
    setMetaDesc(localStorage.getItem("seo_editor_meta") || "");
    setTagsText(localStorage.getItem("seo_editor_tags") || "");
    setSettingsLoaded(true);
  }, []);

  // 광고 설정은 변경 즉시 LocalStorage에 저장 (체험후기 페이지의 설정 객체를 덮어쓰지 않고 해당 필드만 갱신)
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      const prev = JSON.parse(localStorage.getItem(AD_CFG_KEY) || "{}") || {};
      localStorage.setItem(
        AD_CFG_KEY,
        JSON.stringify({ ...prev, clientId: adCfg.clientId, midSlot: adCfg.slot, endSlot: adCfg.endSlot })
      );
    } catch {}
  }, [adCfg, settingsLoaded]);
  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem("editor_ads_on", adsOn ? "1" : "0");
  }, [adsOn, settingsLoaded]);

  useEffect(() => {
    const prevTopic = localStorage.getItem("seo_editor_topic");
    if (!urlTopic) {
      const savedTopic = localStorage.getItem("seo_editor_topic");
      if (savedTopic) setTopic(savedTopic);
    } else {
      localStorage.setItem("seo_editor_topic", urlTopic);
    }
    
    if (!urlKeyword) {
      const savedKeyword = localStorage.getItem("seo_editor_keyword");
      if (savedKeyword) setKeyword(savedKeyword);
    } else {
      localStorage.setItem("seo_editor_keyword", urlKeyword);
    }

    // 새로고침해도 방금 쓴 원고가 지워지지 않도록, 저장된 주제와 다른 새 주제로 들어왔을 때만 비운다
    if (fromAnalytics && urlTopic && prevTopic !== urlTopic) {
      // 분석 화면의 후속 주제로 새 글을 시작하므로 이전 원고는 비운다 (이전 원고가 새 주제 아래 보이는 혼선 방지)
      localStorage.removeItem("seo_editor_article");
      localStorage.removeItem("seo_editor_html_article");
      localStorage.removeItem("seo_editor_json_ld");
      ["slug", "meta", "tags"].forEach(k => localStorage.removeItem(`seo_editor_${k}`));
      setSlug("");
      setMetaDesc("");
      setTagsText("");
      setArticle("");
      setHtmlArticle("");
      setJsonLd(null);
      setActiveTab("editor");
      return;
    }

    const savedArticle = localStorage.getItem("seo_editor_article");
    if (savedArticle) {
      setArticle(savedArticle);
      setActiveTab("preview");
    }

    const savedHtml = localStorage.getItem("seo_editor_html_article");
    if (savedHtml) setHtmlArticle(savedHtml);

    const savedJsonLd = localStorage.getItem("seo_editor_json_ld");
    if (savedJsonLd) {
      try { setJsonLd(JSON.parse(savedJsonLd)); } catch (e) {}
    }
  }, [urlTopic, urlKeyword, fromAnalytics]);

  const clearEditor = () => {
    setTopic("");
    setKeyword("");
    setArticle("");
    setHtmlArticle("");
    setJsonLd(null);
    setActiveTab("editor");
    localStorage.removeItem("seo_editor_topic");
    localStorage.removeItem("seo_editor_keyword");
    localStorage.removeItem("seo_editor_article");
    localStorage.removeItem("seo_editor_html_article");
    localStorage.removeItem("seo_editor_json_ld");
    ["slug", "meta", "tags"].forEach(k => localStorage.removeItem(`seo_editor_${k}`));
    setSlug("");
    setMetaDesc("");
    setTagsText("");
  };

  // 생성 응답의 슬러그/메타/태그를 SEO 메타 바에 반영 (없으면 본문 첫 문단·키워드로 대체)
  const applySeoMeta = (data: { slug?: string; meta_description?: string; tags?: string[] }, articleText: string) => {
    const nextSlug = data.slug || "";
    const nextMeta = (data.meta_description || firstParagraph(articleText)).slice(0, 160);
    const nextTags = (data.tags && data.tags.length > 0 ? data.tags : keyword.split(",").map(k => k.trim()).filter(Boolean)).join(", ");
    setSlug(nextSlug);
    setMetaDesc(nextMeta);
    setTagsText(nextTags);
    localStorage.setItem("seo_editor_slug", nextSlug);
    localStorage.setItem("seo_editor_meta", nextMeta);
    localStorage.setItem("seo_editor_tags", nextTags);
  };

  const copyField = async (key: string, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // 마크다운 → HTML (+ 광고 자동 배치). badge=미리보기용 배지, code=실제 <ins> 코드
  const buildHtmlFor = (md: string, mode: "badge" | "code") => {
    // 복사용(code)은 티스토리에서 외부 CSS가 무시되므로 인라인 스타일로 변환, 화면 미리보기(badge)는 에디터 CSS 사용
    const base = mode === "code" ? applyInlineStyles(markdownToHtml(md)) : markdownToHtml(md);
    return adsOn ? insertEditorAds(base, adCfg, mode) : base;
  };
  const previewHtml = useMemo(() => buildHtmlFor(article, "badge"), [article, adsOn, adCfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportHtml = useMemo(() => buildHtmlFor(article, "code"), [article, adsOn, adCfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const jsonLdPrefix = jsonLd ? `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n\n` : "";
  const adReady = adConfigReady(adCfg);
  const score = useMemo(() => computeEditorScore({ article, adsOn, adReady }), [article, adsOn, adReady]);
  const ctaCount = countCtaCards(article);

  const insertCta = () => {
    if (!ctaTitle.trim() || !/^https?:\/\//i.test(ctaUrl.trim())) {
      alert("제목과 http(s):// 로 시작하는 URL을 입력해 주세요.");
      return;
    }
    const next = insertCtaCardIntoMarkdown(article, buildCtaCard(ctaTitle, ctaUrl));
    setArticle(next);
    localStorage.setItem("seo_editor_article", next);
    setCtaTitle("");
    setCtaUrl("");
  };

  const clearCtas = () => {
    const next = removeCtaCards(article);
    setArticle(next);
    localStorage.setItem("seo_editor_article", next);
  };

  const handleArticleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setArticle(val);
    localStorage.setItem("seo_editor_article", val);
  };

  const generateArticle = async () => {
    if (!topic || !keyword) return;
    setLoading(true);
    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Gemini-Key": geminiKey
        },
        body: JSON.stringify({ 
          topic, 
          keyword,
          adsense_optimize: adsenseOptimize,
          affiliate_optimize: affiliateOptimize
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Article generation failed");
      }

      const data = await res.json();
      setArticle(data.article || "");
      setHtmlArticle(data.html_article || "");
      setJsonLd(data.json_ld || null);
      applySeoMeta(data, data.article || "");
      localStorage.setItem("seo_editor_topic", topic);
      localStorage.setItem("seo_editor_keyword", keyword);
      
      if (data.article) {
        localStorage.setItem("seo_editor_article", data.article);
        localStorage.setItem("seo_editor_html_article", data.html_article || "");
        localStorage.setItem("seo_editor_json_ld", JSON.stringify(data.json_ld) || "");
        setActiveTab("preview");
      }
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setLoading(false);
    }
  };

  const publishToTistory = async () => {
    if (!topic || !keyword) return;
    const tistoryBlog = localStorage.getItem("tistory_blog") || "";
    if (!tistoryBlog) {
      alert("환경 설정에서 [블로그 이름 (Blog Name)]을 먼저 설정해 주세요.");
      return;
    }

    setPublishing(true);
    let finalArticle = article;
    let finalHtml = htmlArticle;
    let finalJsonLd = jsonLd;
    
    // 원고가 없으면 백엔드에서 원고 생성부터 처리
    if (!finalArticle) {
      const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
      try {
        const res = await fetch("/api/generate-article", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Gemini-Key": geminiKey
          },
          body: JSON.stringify({ 
            topic, 
            keyword,
            adsense_optimize: adsenseOptimize,
            affiliate_optimize: affiliateOptimize
          }),
        });
        if (!res.ok) throw new Error("Article generation failed");
        const data = await res.json();
        finalArticle = data.article || "";
        finalHtml = data.html_article || "";
        finalJsonLd = data.json_ld || null;
        setArticle(finalArticle);
        setHtmlArticle(finalHtml);
        setJsonLd(finalJsonLd);
        applySeoMeta(data, finalArticle);
        localStorage.setItem("seo_editor_article", finalArticle);
        setActiveTab("preview");
      } catch (error) {
        console.error(error);
        alert("원고 생성에 실패했습니다. Gemini API 키를 확인해주세요.");
        setPublishing(false);
        return;
      }
    }

    try {
      // 1. 고수익 원고+JSON-LD 결합 클립보드 복사
      const jsonLdStr = finalJsonLd ? `<script type="application/ld+json">\n${JSON.stringify(finalJsonLd, null, 2)}\n</script>\n\n` : "";
      // 에디터에서 수정한 마크다운을 그대로 HTML로 변환하고, 광고 자동 배치가 켜져 있으면 실제 <ins> 코드로 치환
      const exportNow = finalArticle ? buildHtmlFor(finalArticle, "code") : "";
      const copyText = exportNow ? (jsonLdStr + exportNow) : finalArticle;

      await navigator.clipboard.writeText(copyText);
      
      // 2. 사용자의 티스토리 글쓰기 URL 새 탭으로 열기
      const writeUrl = `https://${tistoryBlog}.tistory.com/manage/post`;
      window.open(writeUrl, '_blank');
      
      if (finalHtml) {
        alert("✅ 구글 SEO 구조화 데이터(JSON-LD) 및 애드센스 광고 영역이 내장된 '고수익 최적화 HTML' 패키지가 클립보드에 복사되었습니다!\n\n새 탭으로 열린 티스토리에서 우측 상단 [기본모드 -> HTML]로 변경하신 후 바로 'Ctrl+V'를 눌러 붙여넣기 하세요.");
      } else {
        alert("✅ 원고가 생성되고 클립보드에 복사되었습니다!\n새 탭으로 열린 티스토리에서 [기본모드 -> 마크다운]으로 변경 후 바로 'Ctrl+V' 하세요.");
      }
    } catch (e: any) {
      console.error(e);
      alert("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = () => {
    let copyText = article;
    if (activeTab === "seo" && jsonLd) {
      copyText = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
    } else if (activeTab === "html" && exportHtml) {
      if (adsOn && !adReady) {
        alert("광고 자동 배치가 켜져 있지만 AdSense ID 또는 Slot ID가 비어 있어 광고 코드는 삽입되지 않았습니다.");
      }
      copyText = jsonLdPrefix + exportHtml;
    }

    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveToContents = async () => {
    if (!article || !topic || !keyword) {
      alert("저장할 원고와 주제, 키워드가 필요합니다. 먼저 원고를 생성해주세요.");
      return;
    }
    setSavingToDB(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch("/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic,
          keyword: keyword,
          category: "일반",
          content: article,
          content_html: exportHtml,
          meta_description: metaDesc || article.slice(0, 150).replace(/\n/g, " ").trim() + "...",
          tags: tagsText || keyword,
          status: "DRAFT",
          check_duplicate: false
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "저장에 실패했습니다.");
      }

      setSaveSuccessMsg("✅ 콘텐츠 보관함에 안전하게 저장되었습니다!");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`저장 실패: ${err.message || "오류가 발생했습니다."}`);
    } finally {
      setSavingToDB(false);
    }
  };

  return (
    <div className="flex flex-col gap-10 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 w-fit">
             <PenTool size={14} className="text-purple-500" />
             <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest font-outfit">Content Generation Engine</span>
          </div>
          <span className="text-xs font-medium text-gray-500 font-outfit">최종 배포일: {APP_RELEASE_DATE} ({APP_VERSION})</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">친근한 지식 메이트 <span className="text-purple-400 font-light italic">Story.</span></h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
           어려운 전문 지식도 누구나 단 3초 만에 이해할 수 있게 쉽게 풀어 쓰는 매력적인 블로그 원고를 즉시 생성해 보세요. <br />
           최신 Gemini 2.5 Flash 엔진이 독자에게 친근하게 다가가는 고수익 생활 밀착형 원고 작성을 지원합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: Enhanced Configuration Panel */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
          <div className="glass-card p-8 flex flex-col gap-8 neon-glow-purple relative overflow-hidden">
            <h2 className="text-lg font-bold text-white flex items-center gap-3 font-outfit">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <FileText size={20} className="text-purple-500" />
              </div>
              콘텐츠 엔진 설정
            </h2>
            
            <div className="space-y-6 relative z-10">
              <div className="flex flex-col gap-3 group">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Layout size={12} className="text-purple-500/60" />
                  주요 주제 및 도메인
                </label>
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 미국 인플레이션 전망과 투자 가이드"
                  className="bg-white/[0.03] border border-white/[0.05] rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-700"
                />
              </div>

              <div className="flex flex-col gap-3 group">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Hash size={12} className="text-purple-500/60" />
                  타겟 최적화 키워드
                </label>
                <input 
                  type="text" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="예: 미국주식, 금리인하, 경기침체"
                  className="bg-white/[0.03] border border-white/[0.05] rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-700"
                />
              </div>

              {/* 수익 극대화 솔루션 토글 그룹 */}
              <div className="border-t border-white/[0.05] pt-5 flex flex-col gap-4">
                <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                  <Zap size={12} className="text-purple-400 animate-pulse" />
                  수익 극대화 솔루션
                </label>
                
                <p className="text-[10px] text-gray-500 leading-normal px-1">
                  💰 애드센스 광고 배치는 이제 우측 사이드바의 <strong className="text-purple-300">수익화 설정</strong>에서 본인의 ID/Slot으로 자동 배치됩니다.
                </p>

                <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.03] p-3.5 rounded-2xl hover:border-purple-500/20 transition-all cursor-pointer select-none" onClick={() => setAffiliateOptimize(!affiliateOptimize)}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-white">🔗 제휴 마케팅 CTA 자동 삽입</span>
                    <span className="text-[9px] text-gray-500 leading-normal">고전환율 앵커 텍스트 영역을 하단에 자동 탑재</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={affiliateOptimize}
                    onChange={(e) => setAffiliateOptimize(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 accent-purple-500 cursor-pointer shrink-0"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={generateArticle}
              disabled={loading || publishing || savingToDB || !topic || !keyword}
              className="w-full relative group bg-gradient-to-tr from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 mt-4 shadow-xl shadow-purple-600/20 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Zap size={18} className="group-hover:animate-bounce" /> 마스터 원고 쓰기</>}
            </button>

            <button 
              onClick={saveToContents}
              disabled={loading || publishing || savingToDB || !article}
              className="w-full relative group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {savingToDB ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              콘텐츠 관리 보관함에 저장하기
            </button>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between">
                <span>{saveSuccessMsg}</span>
                <Link href="/contents" className="text-white underline font-bold hover:text-emerald-300">
                  목록 보기
                </Link>
              </div>
            )}

            <button 
              onClick={publishToTistory}
              disabled={loading || publishing || savingToDB || !topic || !keyword}
              className="w-full relative group bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 mt-1 shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {publishing ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 티스토리 원스톱 자동 보관</>}
            </button>
            <div className="absolute -left-20 -top-20 w-80 h-80 bg-purple-600/5 blur-[100px] pointer-events-none" />
          </div>

          <div className="glass-card p-6 border-dashed border-white/[0.05] flex flex-col gap-4 opacity-70">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">원고 작성 주요 특징</h3>
             <ul className="text-[11px] text-gray-500 space-y-2">
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 누구나 3초 만에 이해하는 쉬운 설명</li>
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 친근하고 정중한 생활 밀착형 구어체</li>
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 가독성을 극대화한 모바일 최적화 레이아웃</li>
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 구글 SEO 구조화 데이터 & 애드센스 슬롯 자동 탑재</li>
             </ul>
          </div>
        </div>

        {/* Right: Premium Premium Editor/Preview Workspace */}
        <div className="lg:col-span-8 xl:col-span-6 flex flex-col gap-6">
          {/* 상단 SEO 메타 바: 영문 슬러그 / 메타 디스크립션 / 추천 태그 원클릭 복사 */}
          <div className="glass-card p-5 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">SEO 메타 바</div>
            {[
              { key: "slug", label: "영문 URL 슬러그", value: slug, set: (v: string) => { setSlug(v); localStorage.setItem("seo_editor_slug", v); }, ph: "예: overseas-stock-capital-gains-tax-2026", extra: "" },
              { key: "meta", label: "메타 디스크립션", value: metaDesc, set: (v: string) => { setMetaDesc(v); localStorage.setItem("seo_editor_meta", v); }, ph: "140~155자 권장", extra: `${metaDesc.length}자` },
              { key: "tags", label: "추천 태그 (쉼표 구분)", value: tagsText, set: (v: string) => { setTagsText(v); localStorage.setItem("seo_editor_tags", v); }, ph: "태그1, 태그2, 태그3", extra: "" },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-[11px] font-semibold text-gray-400">{f.label}</span>
                <input
                  type="text"
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.ph}
                  className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-gray-700"
                />
                {f.extra && (
                  <span className={`text-[10px] font-bold shrink-0 ${metaDesc.length >= 140 && metaDesc.length <= 160 ? "text-emerald-400" : "text-amber-400"}`}>{f.extra}</span>
                )}
                <button
                  type="button"
                  onClick={() => copyField(f.key, f.value)}
                  disabled={!f.value}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-[11px] font-bold text-gray-300 border border-white/[0.06] disabled:opacity-30 shrink-0"
                >
                  {copiedKey === f.key ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copiedKey === f.key ? "복사됨" : "복사"}
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center bg-[#0a0a0f]/40 backdrop-blur-xl p-2 rounded-2xl border border-white/[0.05]">
            <div className="flex p-1 gap-1 flex-wrap">
              <button 
                onClick={() => setActiveTab("editor")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'editor' ? 'bg-white/[0.05] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                에디터 모드
              </button>
              <button 
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-white/[0.05] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                미리보기 <Eye size={14} />
              </button>
              <button 
                onClick={() => setActiveTab("seo")}
                disabled={!jsonLd}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-20 disabled:pointer-events-none ${activeTab === 'seo' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}
              >
                구글 SEO (JSON-LD)
              </button>
              <button 
                onClick={() => setActiveTab("html")}
                disabled={!article}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-20 disabled:pointer-events-none ${activeTab === 'html' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300'}`}
              >
                HTML 최종 원고
              </button>
              <div className="w-[1px] h-6 bg-white/[0.1] my-auto mx-2 hidden sm:block" />
              <button 
                onClick={clearEditor}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} /> 초기화
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsExportOpen(true)}
                disabled={!article}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 rounded-xl text-xs font-bold transition-all border border-blue-500/30 active:scale-95 disabled:opacity-20"
              >
                <Download size={14} /> 내보내기/복사 패키지
              </button>

              <button 
                onClick={copyToClipboard}
                disabled={!article}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 rounded-xl text-xs font-bold transition-all border border-white/[0.05] active:scale-95 disabled:opacity-20 translate-x-[-4px]"
              >
                {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                {activeTab === "seo" ? "구조화 데이터 복사" : activeTab === "html" ? "HTML 최종본 복사" : "티스토리로 최적화 복사"}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[700px] glass-card overflow-hidden relative shadow-inner">
            {!article && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 gap-6">
                <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-dashed border-white/[0.05] flex items-center justify-center">
                  <PenTool size={40} className="opacity-10" />
                </div>
                <p className="text-lg font-medium opacity-20">입력 정보를 바탕으로 원고가 이곳에 생성됩니다.</p>
              </div>
            )}

            {(loading || publishing) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050508]/80 backdrop-blur-3xl z-20 gap-8 animate-in fade-in transition-all">
                <div className="relative">
                   <div className="relative z-10 w-24 h-24 rounded-3xl bg-purple-600/20 flex items-center justify-center border border-purple-500/30 overflow-hidden group">
                      <Zap className="text-purple-500 animate-bounce" size={40} />
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600/50 animate-pulse" />
                   </div>
                   <div className="absolute -inset-10 bg-purple-600/10 blur-[60px] rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-2">
                   <p className="text-xl font-bold text-white tracking-tight">AI Drafting in Progress</p>
                   <p className="text-sm font-medium text-purple-400 animate-pulse uppercase tracking-widest">누구나 이해하기 쉬운 친근한 문장 구성 중...</p>
                </div>
              </div>
            )}
            
            <div className="h-full overflow-y-auto custom-scrollbar relative">
              {activeTab === "preview" && (
                <div className="p-12 animate-in fade-in duration-700">
                  <div className="editor-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              )}
              {activeTab === "editor" && (
                <textarea 
                  value={article}
                  onChange={handleArticleChange}
                  className="w-full h-full bg-transparent p-12 text-gray-300 font-mono text-sm focus:outline-none resize-none leading-relaxed selection:bg-purple-500/20"
                  placeholder="AI가 생성한 원고가 이곳에 표시됩니다..."
                />
              )}
              {activeTab === "seo" && jsonLd && (
                <div className="p-12 animate-in fade-in duration-700">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-4">Google Search Schema.org JSON-LD (Rich Snippet)</p>
                  <pre className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-purple-300 font-mono text-xs overflow-x-auto leading-relaxed max-w-full">
                    {`<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`}
                  </pre>
                </div>
              )}
              {activeTab === "html" && article && (
                <div className="p-12 animate-in fade-in duration-700">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">
                    최종 HTML (에디터 수정 내용 반영{adsOn ? " · AdSense <ins> 코드 포함" : ""})
                  </p>
                  <pre className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed max-w-full whitespace-pre-wrap">
                    {`${jsonLdPrefix}${exportHtml}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: 수익화 & 내부 링크 삽입기 + 실시간 진단 스코어보드 */}
        <div className="lg:col-span-12 xl:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 content-start">
          {/* 실시간 SEO & 수익성 진단 */}
          <div className="glass-card p-6 flex flex-col gap-4 md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Gauge size={16} className="text-purple-400" /> SEO·수익성 진단</h3>
              <span className={`text-2xl font-extrabold font-outfit ${score.total >= 80 ? "text-emerald-400" : score.total >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {article ? score.total : 0}<span className="text-xs text-gray-500 font-medium"> / 100</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full transition-all ${score.total >= 80 ? "bg-emerald-500" : score.total >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${article ? score.total : 0}%` }}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              {score.items.map(it => (
                <div key={it.label} className="text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className={it.warn ? "text-amber-300 font-semibold" : "text-gray-300 font-semibold"}>{it.warn ? "⚠️" : "✅"} {it.label}</span>
                    <span className="text-gray-500">{article ? it.score : 0}/{it.max}</span>
                  </div>
                  <div className="text-gray-500 mt-0.5 pl-5">{article ? it.detail : "원고를 생성하면 실시간으로 진단합니다"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 수익화(AdSense) 설정 */}
          <div className="glass-card p-6 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Wallet size={16} className="text-emerald-400" /> 수익화 (AdSense)</h3>
            <input
              type="text"
              value={adCfg.clientId}
              onChange={e => setAdCfg({ ...adCfg, clientId: e.target.value })}
              placeholder="ca-pub-xxxxxxxxxxxxxxxx"
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-gray-700"
            />
            <input
              type="text"
              value={adCfg.slot}
              onChange={e => setAdCfg({ ...adCfg, slot: e.target.value })}
              placeholder="data-ad-slot 번호 (본문 중간)"
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-gray-700"
            />
            <input
              type="text"
              value={adCfg.endSlot}
              onChange={e => setAdCfg({ ...adCfg, endSlot: e.target.value })}
              placeholder="마지막 H2 위 Slot (비우면 위와 동일)"
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-gray-700"
            />
            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-300">
              <input type="checkbox" checked={adsOn} onChange={e => setAdsOn(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500" />
              <span>
                본문 중간 광고 자동 배치
                <span className="block text-[10px] text-gray-500 mt-0.5">두 번째 H2 위와 마지막 H2 위. 미리보기엔 배지로 표시되고 HTML 복사 시 실제 &lt;ins&gt; 코드로 치환됩니다. 입력값은 이 브라우저에 저장됩니다.</span>
              </span>
            </label>
            {adsOn && !adReady && <p className="text-[10px] text-amber-300">ID와 Slot을 입력해야 복사본에 광고 코드가 들어갑니다.</p>}
          </div>

          {/* 내부 링크 카드 삽입기 */}
          <div className="glass-card p-6 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Link2 size={16} className="text-blue-400" /> 내부 링크 카드 삽입</h3>
            <input
              type="text"
              value={ctaTitle}
              onChange={e => setCtaTitle(e.target.value)}
              placeholder="카드 제목 (예: 조기재취업수당 후기)"
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-700"
            />
            <input
              type="text"
              value={ctaUrl}
              onChange={e => setCtaUrl(e.target.value)}
              placeholder="https://s-elegant.tistory.com/..."
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-700"
            />
            <button
              type="button"
              onClick={insertCta}
              disabled={!article}
              className="py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-bold text-blue-300 disabled:opacity-30"
            >
              본문 중간에 CTA 카드 삽입
            </button>
            {ctaCount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>삽입된 카드 {ctaCount}개</span>
                <button type="button" onClick={clearCtas} className="text-red-400 hover:text-red-300 underline">모두 제거</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        content={article ? {
          id: "temp-editor-content",
          title: topic || "제목 없음",
          keyword: keyword || "",
          category: "일반",
          content: article,
          content_html: exportHtml,
          meta_description: metaDesc || article.slice(0, 150).replace(/\n/g, " ").trim(),
          tags: tagsText || keyword,
          status: "DRAFT",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } : null}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-500 font-bold tracking-widest uppercase">Loading Core Engine...</div>}>
      <EditorContent />
    </Suspense>
  );
}
