"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp, DollarSign, LayoutList, Loader2, Zap, ArrowRight, Target, Trash2 } from "lucide-react";

interface Keyword {
  keyword: string;
  reason: string;
  vol: string;
}

export default function KeywordsPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedTopic = localStorage.getItem("seo_keyword_topic");
    const savedKeywords = localStorage.getItem("seo_keyword_results");
    if (savedTopic) setTopic(savedTopic);
    if (savedKeywords) {
      try {
        setKeywords(JSON.parse(savedKeywords));
      } catch (e) {}
    }
  }, []);

  const clearResults = () => {
    setTopic("");
    setKeywords([]);
    localStorage.removeItem("seo_keyword_topic");
    localStorage.removeItem("seo_keyword_results");
  };

  const fetchKeywords = async () => {
    if (!topic) return;
    setLoading(true);
    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Gemini-Key": geminiKey
        },
        body: JSON.stringify({ topic }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();
      
      try {
        const keywordsData = data.keywords;
        if (!keywordsData) throw new Error("No keywords data in response");

        const parsed = typeof keywordsData === 'string' 
          ? JSON.parse(keywordsData.replace(/```json|```/g, "")) 
          : keywordsData;

        const validKeywords = Array.isArray(parsed) ? parsed : [];
        setKeywords(validKeywords);
        localStorage.setItem("seo_keyword_topic", topic);
        localStorage.setItem("seo_keyword_results", JSON.stringify(validKeywords));
      } catch (e) {
        console.error("Parsing failed", e);
        setKeywords([]);
      }
    } catch (error) {
      console.error("Fetch failed", error);
      setKeywords([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-12 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 w-fit mb-2">
           <Target size={14} className="text-blue-500" />
           <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest font-outfit">Marketing Intelligence</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">키워드 엔진 <span className="text-blue-500 font-light italic">Insights.</span></h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
           AI 기반 정밀 분석을 통해 검색량이 풍부하고 CPC 단가가 높은 <br />
           황금 키워드를 발굴하세요. 당신의 SEO 전략을 데이터로 뒷받침합니다.
        </p>
      </div>

      {/* Search Bar Section */}
      <div className="glass-card p-10 neon-glow-blue relative overflow-hidden group shine-effect">
        <div className="flex flex-col gap-6 relative z-10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-blue-500" />
              Target Topic Analysis
            </label>
            <div className="text-[10px] text-gray-600 font-medium">Auto-Detection: Active</div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors duration-300" size={24} />
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="분석할 대주제나 분야를 입력하세요 (예: 미국 배당주, 인공지능 트렌드...)"
                className="w-full bg-white/[0.03] border border-white/[0.05] rounded-3xl pl-16 pr-6 py-6 text-white text-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-600 font-medium shadow-inner"
                onKeyDown={(e) => e.key === 'Enter' && fetchKeywords()}
              />
            </div>
            <button 
              onClick={fetchKeywords}
              disabled={loading}
              className="bg-gradient-to-tr from-blue-600 to-blue-500 hover:scale-105 active:scale-95 text-white px-10 py-6 rounded-3xl font-bold transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 min-w-[200px]"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <><TrendingUp size={24} /> 키워드 발굴</>}
            </button>
          </div>
        </div>
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-blue-600/5 blur-[120px] pointer-events-none group-hover:scale-150 transition-all duration-700" />
      </div>

      {/* Results Section */}
      {keywords.length > 0 && !loading && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <div className="flex justify-end pr-2">
            <button 
              onClick={clearResults}
              className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 active:scale-95"
            >
              <Trash2 size={14} /> 결과 초기화 및 삭제
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keywords.map((k, idx) => (
            <div 
              key={idx} 
              onClick={() => router.push(`/editor?topic=${encodeURIComponent(topic)}&keyword=${encodeURIComponent(k.keyword)}`)}
              className="glass-card p-8 group interactive-hover relative overflow-hidden shine-effect cursor-pointer"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col gap-1">
                   <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded w-fit">Top Tier #{idx+1}</div>
                   <div className="text-[9px] text-gray-500 uppercase font-medium mt-1 tracking-tighter">AI Confidence Score: 98%</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:rotate-12 transition-transform">
                  <TrendingUp size={14} className="text-emerald-500" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-blue-400 transition-colors font-outfit">{k.keyword}</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 opacity-80">{k.reason}</p>
              
              <div className="mt-auto pt-6 border-t border-white/[0.05] flex justify-between items-center text-xs font-bold text-gray-500">
                <div className="flex items-center gap-2">
                  <LayoutList size={16} className="text-blue-500/60" />
                  <span>검색량: <span className="text-white font-outfit text-sm">{k.vol}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-yellow-500/5 px-2 py-1 rounded">
                  <DollarSign size={14} className="text-yellow-500" />
                  <span className="text-yellow-500/80 tracking-tighter">PREMIUM CPA</span>
                </div>
              </div>
              
              <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-600/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </div>
          ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="glass-card p-10 animate-pulse border-blue-500/5">
              <div className="w-24 h-4 bg-white/[0.03] rounded-full mb-6"></div>
              <div className="w-full h-8 bg-white/[0.03] rounded-xl mb-4"></div>
              <div className="w-3/4 h-3 bg-white/[0.03] rounded-full"></div>
            </div>
          ))}
        </div>
      )}

      {!loading && keywords.length === 0 && (
        <div className="flex flex-col items-center justify-center p-24 glass-card border-dashed border-white/[0.05] opacity-60">
           <Search size={64} strokeWidth={1} className="text-gray-700 mb-6" />
           <p className="text-gray-500 text-lg font-medium">분석할 주제를 입력하여 새로운 인사이트를 도출하세요.</p>
        </div>
      )}
    </div>
  );
}
