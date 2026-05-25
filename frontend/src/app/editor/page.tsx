"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PenTool, Send, Copy, Eye, FileText, Loader2, CheckCircle, Zap, Layout, Hash, Trash2 } from "lucide-react";

function EditorContent() {
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get("topic");
  const urlKeyword = searchParams.get("keyword");

  const [topic, setTopic] = useState(urlTopic || "");
  const [keyword, setKeyword] = useState(urlKeyword || "");
  const [article, setArticle] = useState("");
  const [htmlArticle, setHtmlArticle] = useState("");
  const [jsonLd, setJsonLd] = useState<any>(null);
  const [adsenseOptimize, setAdsenseOptimize] = useState(true); // 기본값 true로 애드센스 극대화 장려
  const [affiliateOptimize, setAffiliateOptimize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "seo" | "html">("editor");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
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
  }, [urlTopic, urlKeyword]);

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
      const copyText = finalHtml ? (jsonLdStr + finalHtml) : finalArticle;
      
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
    } else if (activeTab === "html" && htmlArticle) {
      const jsonLdStr = jsonLd ? `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n\n` : "";
      copyText = jsonLdStr + htmlArticle;
    }

    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-10 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 w-fit">
           <PenTool size={14} className="text-purple-500" />
           <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest font-outfit">Content Generation Engine</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">친근한 지식 메이트 <span className="text-purple-400 font-light italic">Story.</span></h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
           어려운 전문 지식도 누구나 단 3초 만에 이해할 수 있게 쉽게 풀어 쓰는 매력적인 블로그 원고를 즉시 생성해 보세요. <br />
           최신 Gemini 2.5 Flash 엔진이 독자에게 친근하게 다가가는 고수익 생활 밀착형 원고 작성을 지원합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Enhanced Configuration Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
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
                
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.03] p-3.5 rounded-2xl hover:border-purple-500/20 transition-all cursor-pointer select-none" onClick={() => setAdsenseOptimize(!adsenseOptimize)}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-white">💰 애드센스 황금 광고 배치</span>
                    <span className="text-[9px] text-gray-500 leading-normal">본문 소제목 아래 광고 삽입용 자동 지표 슬롯</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={adsenseOptimize}
                    onChange={(e) => setAdsenseOptimize(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 accent-purple-500 cursor-pointer shrink-0"
                  />
                </div>

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
              disabled={loading || publishing || !topic || !keyword}
              className="w-full relative group bg-gradient-to-tr from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 mt-4 shadow-xl shadow-purple-600/20 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Zap size={18} className="group-hover:animate-bounce" /> 마스터 원고 쓰기</>}
            </button>

            <button 
              onClick={publishToTistory}
              disabled={loading || publishing || !topic || !keyword}
              className="w-full relative group bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 mt-2 shadow-xl shadow-orange-600/20 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {publishing ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 티스토리 원스톱 자동 보관</>}
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
        <div className="lg:col-span-8 flex flex-col gap-6">
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
                disabled={!htmlArticle}
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

            <button 
              onClick={copyToClipboard}
              disabled={!article}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 rounded-xl text-xs font-bold transition-all border border-white/[0.05] active:scale-95 disabled:opacity-20 translate-x-[-4px]"
            >
              {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
              {activeTab === "seo" ? "구조화 데이터 복사" : activeTab === "html" ? "HTML 최종본 복사" : "티스토리로 최적화 복사"}
            </button>
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
                <div className="p-12 prose prose-invert max-w-none prose-headings:text-white prose-p:text-gray-300 prose-headings:font-outfit animate-in fade-in duration-700">
                  <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-base">
                    {article}
                  </pre>
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
              {activeTab === "html" && htmlArticle && (
                <div className="p-12 animate-in fade-in duration-700">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">SEO Optimized Article HTML Template (Including Ad Placeholder)</p>
                  <pre className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed max-w-full whitespace-pre-wrap">
                    {`${jsonLd ? `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n\n` : ""}${htmlArticle}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="text-center text-[10px] text-gray-600 mt-4">
        최종 배포일: 2026.05.24
      </div>
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
