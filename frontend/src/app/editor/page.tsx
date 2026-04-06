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
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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
      setShowPreview(true);
    }
  }, [urlTopic, urlKeyword]);

  const clearEditor = () => {
    setTopic("");
    setKeyword("");
    setArticle("");
    setShowPreview(false);
    localStorage.removeItem("seo_editor_topic");
    localStorage.removeItem("seo_editor_keyword");
    localStorage.removeItem("seo_editor_article");
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
        body: JSON.stringify({ topic, keyword }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Article generation failed");
      }

      const data = await res.json();
      setArticle(data.article || "");
      localStorage.setItem("seo_editor_topic", topic);
      localStorage.setItem("seo_editor_keyword", keyword);
      
      if (data.article) {
        localStorage.setItem("seo_editor_article", data.article);
        setShowPreview(true);
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
          body: JSON.stringify({ topic, keyword }),
        });
        if (!res.ok) throw new Error("Article generation failed");
        const data = await res.json();
        finalArticle = data.article || "";
        setArticle(finalArticle);
        setShowPreview(true);
      } catch (error) {
        console.error(error);
        alert("원고 생성에 실패했습니다. Gemini API 키를 확인해주세요.");
        setPublishing(false);
        return;
      }
    }

    try {
      // 1. 원고 클립보드 복사
      await navigator.clipboard.writeText(finalArticle);
      
      // 2. 사용자의 티스토리 글쓰기 URL 새 탭으로 열기
      const writeUrl = `https://${tistoryBlog}.tistory.com/manage/post`;
      window.open(writeUrl, '_blank');
      
      alert("✅ 원고가 생성되고 클립보드에 복사되었습니다!\n새 탭으로 열린 티스토리에서 [기본모드 -> 마크다운]으로 변경 후 바로 'Ctrl+V' 하세요.");
    } catch (e: any) {
      console.error(e);
      alert("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(article);
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
        <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">SEO 라이터 <span className="text-purple-400 font-light italic">Composition.</span></h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
           구조화된 시맨틱 태그와 최적의 키워드 밀도를 갖춘 전문적인 포스팅을 즉시 생성하세요. <br />
           Gemini 1.5 Pro의 강력한 문장력을 통해 검색 상위 노출을 지원합니다.
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
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">포함될 SEO 요소</h3>
             <ul className="text-[11px] text-gray-500 space-y-2">
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ H1 ~ H3 시맨틱 태그 구조화</li>
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 메타 설명 (Description) 포함</li>
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 주요 키워드 자연스러운 반복</li>
                <li className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.03]">✓ 티스토리 등록 최적화 HTML 호환</li>
             </ul>
          </div>
        </div>

        {/* Right: Premium Premium Editor/Preview Workspace */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex justify-between items-center bg-[#0a0a0f]/40 backdrop-blur-xl p-2 rounded-2xl border border-white/[0.05]">
            <div className="flex p-1 gap-1">
              <button 
                onClick={() => setShowPreview(false)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${!showPreview ? 'bg-white/[0.05] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                에디터 모드
              </button>
              <button 
                onClick={() => setShowPreview(true)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${showPreview ? 'bg-white/[0.05] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                미리보기 <Eye size={14} />
              </button>
              <div className="w-[1px] h-6 bg-white/[0.1] my-auto mx-2" />
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
              티스토리로 최적화 복사
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
                   <p className="text-sm font-medium text-purple-400 animate-pulse uppercase tracking-widest">SEO 최적화 문장 구성 중...</p>
                </div>
              </div>
            )}
            
            <div className="h-full overflow-y-auto custom-scrollbar relative">
              {showPreview ? (
                <div className="p-12 prose prose-invert max-w-none prose-headings:text-white prose-p:text-gray-300 prose-headings:font-outfit animate-in fade-in duration-700">
                  <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-base">
                    {article}
                  </pre>
                </div>
              ) : (
                <textarea 
                  value={article}
                  onChange={handleArticleChange}
                  className="w-full h-full bg-transparent p-12 text-gray-300 font-mono text-sm focus:outline-none resize-none leading-relaxed selection:bg-purple-500/20"
                  placeholder="AI가 생성한 원고가 이곳에 표시됩니다..."
                />
              )}
            </div>
          </div>
        </div>
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
