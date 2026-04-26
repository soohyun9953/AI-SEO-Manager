"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, 
  DollarSign, 
  Cpu, 
  Zap, 
  TrendingUp, 
  Activity, 
  Plane, 
  Loader2, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  ChevronRight,
  Trash2,
  Calendar,
  Eye
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Topic {
  topic: string;
  reason: string;
  expected_cpc: string;
}

interface SavedArticle {
  id: string;
  category: string;
  topic: string;
  keyword: string;
  article: string;
  date: string;
}

const CATEGORIES = [
  { id: "금융/재테크", name: "금융/재테크", icon: <DollarSign size={20} />, color: "from-emerald-500 to-teal-600" },
  { id: "IT", name: "IT", icon: <Cpu size={20} />, color: "from-blue-500 to-indigo-600" },
  { id: "AI", name: "AI", icon: <Zap size={20} />, color: "from-purple-500 to-pink-600" },
  { id: "경제", name: "경제", icon: <TrendingUp size={20} />, color: "from-amber-500 to-orange-600" },
  { id: "건강", name: "건강", icon: <Activity size={20} />, color: "from-rose-500 to-red-600" },
  { id: "여행", name: "여행", icon: <Plane size={20} />, color: "from-sky-500 to-blue-600" },
];

export default function AutoWritePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Category, 2: Topics, 3: Generation
  const [generatedResult, setGeneratedResult] = useState<SavedArticle | null>(null);
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [viewingArticle, setViewingArticle] = useState<SavedArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackStatus, setFallbackStatus] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("seo_saved_articles");
    if (saved) {
      try {
        setSavedArticles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved articles", e);
      }
    }
  }, []);

  const saveToStorage = (articles: SavedArticle[]) => {
    setSavedArticles(articles);
    try {
      localStorage.setItem("seo_saved_articles", JSON.stringify(articles));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
      alert("⚠️ 브라우저의 저장 용량이 가득 찼습니다. 기존에 작성된 원고 중 불필요한 것을 삭제해 주셔야 계속 보관이 가능합니다.");
    }
  };

  const fetchTopics = async (category: string) => {
    setSelectedCategory(category);

    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    if (!geminiKey) {
      alert("⚠️ Gemini API 키가 설정되지 않았습니다. 상단 [API 키 관리] 바에서 키를 입력해주세요.");
      return;
    }

    setLoadingTopics(true);
    setTopics([]);
    setCurrentStep(2);

    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
    const modelLabels = ['Gemini 2.5 Flash', 'Gemini 2.5 Flash Lite', 'Gemini 3 Fresh'];

    try {
      let success = false;
      for (let i = 0; i < models.length; i++) {
        try {
          setFallbackStatus(null);
          const res = await fetch("/api/topic-recommendations", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Gemini-Key": geminiKey
            },
            body: JSON.stringify({ category, model_name: models[i] }),
          });

          if (!res.ok) {
            let err_msg = `서버 오류: ${res.status}`;
            try { const err = await res.json(); err_msg = err.detail || err_msg; } catch {}
            throw new Error(err_msg);
          }
          const data = await res.json();
          const parsedTopics = typeof data.topics === 'string' 
            ? JSON.parse(data.topics.replace(/```json\s*|```/g, "").trim()) 
            : data.topics;
          setTopics(parsedTopics);
          success = true;
          break;
        } catch (err: any) {
          console.error(err);
          if (i < models.length - 1) {
            setFallbackStatus(`⚠️ [${modelLabels[i]}] 모델 작동 실패! 5초 후 다음 순위 모델 [${modelLabels[i+1]}]에 접속을 시도합니다.`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            throw new Error(`모든 AI 모델 접근 실패: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      setError(`주제 추천 실패: ${err.message}`);
    } finally {
      setLoadingTopics(false);
      setFallbackStatus(null);
    }
  };

  const startAutoWrite = async (topic: string) => {
    setGeneratingArticle(true);
    setCurrentStep(3);
    
    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
    const modelLabels = ['Gemini 2.5 Flash', 'Gemini 2.5 Flash Lite', 'Gemini 3 Fresh'];

    try {
      let success = false;
      for (let i = 0; i < models.length; i++) {
        try {
          setFallbackStatus(null);
          const res = await fetch("/api/auto-write", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Gemini-Key": geminiKey
            },
            body: JSON.stringify({ category: selectedCategory, topic, model_name: models[i] }),
          });

          if (!res.ok) {
            let err_msg = `서버 오류: ${res.status}`;
            try { const err = await res.json(); err_msg = err.detail || err_msg; } catch {}
            throw new Error(err_msg);
          }
          const data = await res.json();
          
          const newArticle: SavedArticle = {
            id: Date.now().toString(),
            category: selectedCategory,
            topic: data.topic,
            keyword: data.keyword,
            article: data.article,
            date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          };

          setGeneratedResult(newArticle);
          saveToStorage([newArticle, ...savedArticles]);
          success = true;
          break;
        } catch (err: any) {
          console.error(err);
          if (i < models.length - 1) {
            setFallbackStatus(`⚠️ [${modelLabels[i]}] 모델 작동 실패! 5초 후 다음 순위 모델 [${modelLabels[i+1]}]에 접속을 시도합니다.`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            throw new Error(`모든 AI 모델 접근 실패: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      setError(`글 생성 실패: ${err.message}`);
    } finally {
      setGeneratingArticle(false);
      setFallbackStatus(null);
    }
  };

  const deleteArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("정말로 이 원고를 삭제하시겠습니까?")) {
      const filtered = savedArticles.filter(a => a.id !== id);
      saveToStorage(filtered);
      if (viewingArticle?.id === id) setViewingArticle(null);
      if (generatedResult?.id === id) setGeneratedResult(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("원고가 클립보드에 복사되었습니다.");
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-700 pb-32">
      
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 w-fit mb-4">
           <Sparkles size={14} className="text-blue-400" />
           <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-outfit">Enterprise AI Automation</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 font-outfit">자동 글작성 <span className="text-blue-500 font-light italic">Engine.</span></h1>
        <p className="text-gray-400 text-lg">주제 추천부터 원고 생성 및 보관까지, 당신의 SEO 파트너가 모든 과정을 수행합니다.</p>
      </div>

      {/* Steps Nav */}
      <div className="flex items-center gap-4 mb-12 overflow-x-auto pb-4 no-scrollbar">
        <StepIndicator step={1} currentStep={currentStep} label="분야 선택" />
        <ChevronRight size={16} className="text-gray-600" />
        <StepIndicator step={2} currentStep={currentStep} label="주제 선정" />
        <ChevronRight size={16} className="text-gray-600" />
        <StepIndicator step={3} currentStep={currentStep} label="원고 생성" />
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        {/* Step 1: Category Selection */}
        {currentStep === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => fetchTopics(cat.id)}
                className="glass-card p-10 group interactive-hover text-left relative overflow-hidden h-48 border-white/[0.03]"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${cat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-white/5`}>
                  <div className="text-white">
                    {cat.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-outfit">{cat.name}</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider opacity-60">Insight Generation</p>
                <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/[0.02] blur-2xl group-hover:bg-white/[0.05] transition-all" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Topic Selection */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={() => setCurrentStep(1)}
                className="text-sm font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-2 group"
              >
                <ArrowRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                다른 분야로 변경
              </button>
              <div className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                Analytics Core: {selectedCategory}
              </div>
            </div>

            {loadingTopics ? (
              <div className="flex flex-col items-center justify-center py-24 glass-card border-dashed border-white/5">
                <div className="relative w-16 h-16 mb-6">
                   <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full" />
                   <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-gray-400 font-medium tracking-tight animate-pulse">수익성 높은 주제들을 시뮬레이션 중입니다...</p>
                {fallbackStatus && (
                  <p className="mt-4 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl animate-bounce">
                    {fallbackStatus}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {topics.map((t, idx) => (
                  <div key={idx} className="glass-card p-8 group flex flex-col md:flex-row justify-between items-center gap-6 shine-effect border-white/5">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                         <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded uppercase tracking-tighter">Gold Mine #{idx+1}</span>
                         <span className={`text-[9px] font-black ${t.expected_cpc === 'High' ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'} px-2 py-1 rounded uppercase tracking-tighter`}>Yield: {t.expected_cpc} CPC</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors font-outfit">{t.topic}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed opacity-80">{t.reason}</p>
                    </div>
                    <button 
                      onClick={() => startAutoWrite(t.topic)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/30 flex items-center gap-3 whitespace-nowrap group/btn active:scale-95"
                    >
                      AI 자동 완성 시작 <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Generation & Result */}
        {currentStep === 3 && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            {generatingArticle ? (
              <div className="flex flex-col items-center justify-center py-32 glass-card relative overflow-hidden border-white/5">
                <div className="w-24 h-24 relative mb-12">
                   <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                   <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin duration-1000" />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="text-blue-500 animate-pulse" size={32} />
                   </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 font-outfit">고품질 원고 생성 중...</h2>
                <p className="text-gray-500 font-medium tracking-tight">AI가 전문적인 SEO 글을 작성하고 있습니다. 약 10~20초 정도 소요됩니다.</p>
                {fallbackStatus && (
                  <p className="mt-6 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl animate-bounce">
                    {fallbackStatus}
                  </p>
                )}
              </div>
            ) : (
              generatedResult && (
                <div className="space-y-8 animate-in zoom-in-95 duration-700">
                  <div className="glass-card p-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-white/5">
                    <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                      <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-lg shadow-emerald-500/5">
                        <CheckCircle2 className="text-emerald-500" size={40} />
                      </div>
                      <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2 font-outfit">Perfectly Generated!</h2>
                        <p className="text-gray-400 font-medium">주제: <span className="text-white font-bold">{generatedResult.topic}</span></p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                           <div className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/10">{generatedResult.category}</div>
                           <div className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/10">KW: {generatedResult.keyword}</div>
                        </div>
                      </div>
                      <div className="md:ml-auto flex gap-3">
                         <button 
                          onClick={() => copyToClipboard(generatedResult.article)}
                          className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl transition-all border border-white/5"
                         >
                            <Copy size={20} />
                         </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <button 
                      onClick={() => copyToClipboard(generatedResult.article)}
                      className="flex-1 flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-8 py-6 rounded-3xl font-bold transition-all border border-white/10 group active:scale-95 shadow-xl"
                    >
                      <Copy size={20} className="group-hover:scale-110 transition-transform" />
                      원고 복사 (수동)
                    </button>
                    <button 
                      onClick={() => router.push(`/editor?topic=${encodeURIComponent(generatedResult.topic)}&keyword=${encodeURIComponent(generatedResult.keyword)}`)}
                      className="flex-1 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-6 rounded-3xl font-bold transition-all shadow-2xl shadow-blue-600/40 group active:scale-95"
                    >
                      상세 편집기 열기
                      <ExternalLink size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="glass-card overflow-hidden border-white/5">
                     <div className="px-8 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Article Preview & Storage</span>
                        <span className="text-[9px] text-emerald-500 font-bold">Successfully Saved to Library</span>
                     </div>
                     <div className="p-10 text-gray-400 leading-relaxed font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto custom-scrollbar bg-black/20">
                        {generatedResult.article}
                     </div>
                  </div>

                  <div className="flex justify-center">
                    <button 
                      onClick={() => setCurrentStep(1)}
                      className="text-gray-500 hover:text-white transition-colors text-sm font-bold flex items-center gap-2"
                    >
                       처음으로 돌아가기 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Saved Articles Library Section */}
      <div className="mt-32 pt-16 border-t border-white/5">
        <div className="flex items-center justify-between mb-8 px-4">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                 <Calendar className="text-orange-500" size={20} />
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-white font-outfit">저장된 원고 라이브러리</h2>
                 <p className="text-xs text-gray-500 font-medium">직접 삭제하기 전까지 안전하게 보관됩니다.</p>
              </div>
           </div>
           <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-gray-400">
              Total: {savedArticles.length} items
           </div>
        </div>

        {savedArticles.length === 0 ? (
          <div className="glass-card py-20 flex flex-col items-center justify-center opacity-40 border-dashed border-white/5">
             <Calendar size={48} strokeWidth={1} className="mb-4 text-gray-600" />
             <p className="text-gray-500 font-medium">아직 저장된 원고가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
             {savedArticles.map((item) => (
               <div 
                key={item.id} 
                onClick={() => setViewingArticle(item)}
                className="glass-card p-6 flex items-center gap-6 group hover:bg-white/[0.03] transition-all cursor-pointer border-white/[0.03] animate-in fade-in slide-in-from-right-4 duration-500"
               >
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
                     <Eye size={20} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-bold text-blue-500 uppercase">{item.category}</span>
                        <span className="text-[10px] text-gray-600 font-medium">• {item.date}</span>
                     </div>
                     <h4 className="text-lg font-bold text-white truncate group-hover:text-blue-400 transition-colors">{item.topic}</h4>
                  </div>
                  <div className="flex gap-2">
                     <button 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(item.article); }}
                      className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                     >
                        <Copy size={16} />
                     </button>
                     <button 
                      onClick={(e) => deleteArticle(item.id, e)}
                      className="p-3 rounded-xl bg-red-500/5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/5"
                     >
                        <Trash2 size={16} />
                     </button>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* Viewing Modal (Simple overlay) */}
      {viewingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-white/10">
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                 <div>
                    <h3 className="text-2xl font-bold text-white mb-1 font-outfit">{viewingArticle.topic}</h3>
                    <p className="text-xs text-gray-500 font-medium">분야: <span className="text-blue-500">{viewingArticle.category}</span> | 생성일: {viewingArticle.date}</p>
                 </div>
                 <button 
                  onClick={() => setViewingArticle(null)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                 >
                    ✕
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 text-gray-300 custom-scrollbar bg-black/10">
                 <div className="whitespace-pre-wrap leading-relaxed">
                    {viewingArticle.article}
                 </div>
              </div>
              <div className="p-8 border-t border-white/10 flex gap-4 bg-white/[0.02]">
                 <button 
                  onClick={() => copyToClipboard(viewingArticle.article)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                 >
                    <Copy size={18} /> 원고 전체 복사
                 </button>
                 <button 
                  onClick={() => {
                    router.push(`/editor?topic=${encodeURIComponent(viewingArticle.topic)}&keyword=${encodeURIComponent(viewingArticle.keyword)}`);
                    setViewingArticle(null);
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-bold transition-all border border-white/5"
                 >
                    에디터에서 수정
                 </button>
              </div>
           </div>
        </div>
      )}
      {/* Error Modal */}
      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-md p-8 flex flex-col items-center border border-red-500/20 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
              <span className="text-red-500 text-2xl font-bold">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-outfit">오류가 발생했습니다</h3>
            <p className="text-gray-400 text-sm text-center mb-8 max-w-sm whitespace-pre-wrap leading-relaxed">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                if (currentStep === 3) setCurrentStep(2);
                else if (currentStep === 2) setCurrentStep(1);
              }}
              className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-red-600/30 active:scale-95"
            >
              내용을 확인했습니다
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, currentStep, label }: { step: number, currentStep: number, label: string }) {
  const isActive = currentStep === step;
  const isCompleted = currentStep > step;

  return (
    <div className={`flex items-center gap-3 shrink-0 transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-8 h-8 rounded-2xl flex items-center justify-center text-sm font-black border transition-all duration-500 ${
        isActive ? 'bg-blue-600 border-blue-400 text-white scale-110 shadow-lg shadow-blue-600/40' : 
        isCompleted ? 'bg-emerald-500 border-emerald-400 text-white' : 
        'bg-white/5 border-white/10 text-gray-500'
      }`}>
        {isCompleted ? <CheckCircle2 size={16} /> : step}
      </div>
      <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-500 font-outfit uppercase text-[10px] tracking-widest'}`}>{label}</span>
    </div>
  );
}
