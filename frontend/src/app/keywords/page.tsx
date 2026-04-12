"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, DollarSign, LayoutList, Loader2, Zap,
  Trash2, Star, BarChart2, Sparkles,
  AlertCircle, X, ArrowUpDown, PenLine
} from "lucide-react";

// 황금 키워드 데이터 스키마
interface 황금_키워드 {
  keyword: string;
  golden_score: number;
  cpc_estimate: string;
  monthly_vol: string;
  competition: "낮음" | "중간" | "높음";
  intent: "구매형" | "비교형" | "정보형";
  reason: string;
}

// 심층 분석 데이터 스키마
interface 심층_분석_결과 {
  longtail_keywords: { keyword: string; monthly_vol: string; cpc_estimate: string; competition: string }[];
  content_angles: { angle: string; title_example: string; ctr_boost: string }[];
  monetization_tips: string;
  synergy_keywords: { keyword: string; reason: string }[];
}

// 황금 점수에 따른 배지 등급 반환
function get_golden_badge(score: number) {
  if (score >= 80) return { label: "🥇 황금", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" };
  if (score >= 60) return { label: "🥈 실버", color: "text-gray-300", bg: "bg-gray-400/10 border-gray-400/20" };
  return { label: "🥉 브론즈", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
}

// 경쟁도 색상 반환
function get_competition_color(competition: string) {
  if (competition === "낮음") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (competition === "중간") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  return "text-red-400 bg-red-500/10 border-red-500/20";
}

// 검색 의도 색상 반환
function get_intent_color(intent: string) {
  if (intent === "구매형") return "text-emerald-400 bg-emerald-500/10";
  if (intent === "비교형") return "text-blue-400 bg-blue-500/10";
  return "text-gray-400 bg-gray-500/10";
}

// 정렬 옵션 타입
type 정렬_기준 = "golden_score" | "cpc" | "competition";

export default function KeywordsPage() {
  const router = useRouter();
  const [topic, set_topic] = useState("");
  const [keywords, set_keywords] = useState<황금_키워드[]>([]);
  const [loading, set_loading] = useState(false);
  const [error_msg, set_error_msg] = useState("");
  const [sort_by, set_sort_by] = useState<정렬_기준>("golden_score");

  // 심층 분석 모달 상태
  const [analyzing_keyword, set_analyzing_keyword] = useState<string | null>(null);
  const [analysis_result, set_analysis_result] = useState<심층_분석_결과 | null>(null);
  const [analysis_loading, set_analysis_loading] = useState(false);

  // 로컬스토리지 복원
  useEffect(() => {
    const saved_topic = localStorage.getItem("seo_keyword_topic");
    const saved_keywords = localStorage.getItem("seo_golden_keywords");
    if (saved_topic) set_topic(saved_topic);
    if (saved_keywords) {
      try { set_keywords(JSON.parse(saved_keywords)); } catch (e) {}
    }
  }, []);

  const clear_results = () => {
    set_topic("");
    set_keywords([]);
    set_error_msg("");
    localStorage.removeItem("seo_keyword_topic");
    localStorage.removeItem("seo_golden_keywords");
  };

  // 황금 키워드 발굴
  const fetch_keywords = async () => {
    if (!topic) return;
    set_loading(true);
    set_error_msg("");
    set_keywords([]);
    const gemini_key = localStorage.getItem("GEMINI_API_KEY") || "";
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gemini-Key": gemini_key },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `서버 오류: ${res.status}`);
      }
      const data = await res.json();
      const raw = data.keywords;
      if (!raw) throw new Error("키워드 데이터가 없습니다.");
      const parsed: 황금_키워드[] = typeof raw === "string"
        ? JSON.parse(raw.replace(/```json|```/g, ""))
        : raw;
      if (!Array.isArray(parsed)) throw new Error("응답 형식 오류");
      set_keywords(parsed);
      localStorage.setItem("seo_keyword_topic", topic);
      localStorage.setItem("seo_golden_keywords", JSON.stringify(parsed));
    } catch (err: any) {
      set_error_msg(err.message);
    } finally {
      set_loading(false);
    }
  };

  // 심층 분석 요청
  const run_deep_analyze = async (keyword: string) => {
    set_analyzing_keyword(keyword);
    set_analysis_loading(true);
    set_analysis_result(null);
    const gemini_key = localStorage.getItem("GEMINI_API_KEY") || "";
    try {
      const res = await fetch("/api/keywords/deep-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gemini-Key": gemini_key },
        body: JSON.stringify({ keyword, topic }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "심층 분석 실패");
      }
      const data = await res.json();
      const raw = data.analysis;
      // JSON 파싱 실패 시에도 모달을 유지하고 에러만 표시
      let parsed: 심층_분석_결과 | null = null;
      try {
        parsed = typeof raw === "string"
          ? JSON.parse(raw.replace(/```json|```/g, "").trim())
          : raw;
      } catch (parseErr) {
        throw new Error("분석 결과 파싱 실패. AI가 올바른 JSON을 반환하지 않았습니다.");
      }
      set_analysis_result(parsed);
    } catch (err: any) {
      // 모달은 유지하고 에러메시지만 모달 내부에 표시
      set_analysis_result({ longtail_keywords: [], content_angles: [], monetization_tips: `오류: ${err.message}`, synergy_keywords: [] });
    } finally {
      set_analysis_loading(false);
    }
  };

  // 정렬된 키워드 목록
  const sorted_keywords = [...keywords].sort((a, b) => {
    if (sort_by === "golden_score") return (b.golden_score || 0) - (a.golden_score || 0);
    if (sort_by === "cpc") {
      const parse_cpc = (s: string | undefined) => parseInt((s || "0").replace(/[^0-9]/g, "") || "0");
      return parse_cpc(b.cpc_estimate) - parse_cpc(a.cpc_estimate);
    }
    if (sort_by === "competition") {
      const order: Record<string, number> = { "낮음": 0, "중간": 1, "높음": 2 };
      return (order[a.competition] ?? 1) - (order[b.competition] ?? 1);
    }
    return 0;
  });

  return (
    <div className="flex flex-col gap-12 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">

      {/* 헤더 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 w-fit mb-2">
          <Star size={14} className="text-yellow-400" fill="currentColor" />
          <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest font-outfit">Golden Keyword Engine</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">
          황금 키워드 엔진 <span className="text-yellow-400 font-light italic">Revenue.</span>
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
          수익화 최우선 전략으로 황금 키워드를 발굴합니다. <br />
          높은 CPC × 적정 검색량 × 낮은 경쟁 = 💰 황금 키워드
        </p>
      </div>

      {/* 검색 섹션 */}
      <div className="glass-card p-10 relative overflow-hidden group shine-effect" style={{ boxShadow: "0 0 40px rgba(234,179,8,0.05)" }}>
        <div className="flex flex-col gap-6 relative z-10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              수익화 키워드 분석 주제
            </label>
            <div className="text-[10px] text-gray-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse inline-block" />
              Golden Score AI Active
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-400 transition-colors duration-300" size={24} />
              <input
                type="text"
                value={topic}
                onChange={(e) => set_topic(e.target.value)}
                placeholder="예: 미국 배당주, 실비보험, 당뇨 관리, AI SaaS 추천..."
                className="w-full bg-white/[0.03] border border-white/[0.05] rounded-3xl pl-16 pr-6 py-6 text-white text-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/30 transition-all placeholder:text-gray-600 font-medium shadow-inner"
                onKeyDown={(e) => e.key === "Enter" && fetch_keywords()}
              />
            </div>
            <button
              onClick={fetch_keywords}
              disabled={loading || !topic}
              className="bg-gradient-to-tr from-yellow-600 to-yellow-400 hover:scale-105 active:scale-95 text-black px-10 py-6 rounded-3xl font-bold transition-all shadow-xl shadow-yellow-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 min-w-[200px]"
            >
              {loading
                ? <Loader2 className="animate-spin" size={24} />
                : <><Star size={22} fill="currentColor" /> 황금 키워드 발굴</>}
            </button>
          </div>
        </div>
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-yellow-600/5 blur-[120px] pointer-events-none group-hover:scale-150 transition-all duration-700" />
      </div>

      {/* 에러 메시지 */}
      {error_msg && (
        <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-500/10 border border-red-500/20 animate-in fade-in">
          <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm leading-relaxed">{error_msg}</p>
          <button onClick={() => set_error_msg("")} className="ml-auto text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="glass-card p-8 animate-pulse border-yellow-500/5">
              <div className="w-20 h-5 bg-white/[0.04] rounded-full mb-4" />
              <div className="w-full h-8 bg-white/[0.04] rounded-xl mb-3" />
              <div className="w-3/4 h-3 bg-white/[0.03] rounded-full mb-6" />
              <div className="flex gap-2">
                <div className="w-16 h-6 bg-white/[0.03] rounded-full" />
                <div className="w-16 h-6 bg-white/[0.03] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 결과 섹션 */}
      {keywords.length > 0 && !loading && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* 정렬 & 초기화 툴바 */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowUpDown size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">정렬 기준</span>
              {(["golden_score", "cpc", "competition"] as 정렬_기준[]).map((key) => {
                const labels: Record<정렬_기준, string> = {
                  golden_score: "🥇 황금점수",
                  cpc: "💰 CPC 높은순",
                  competition: "📊 경쟁 낮은순"
                };
                return (
                  <button
                    key={key}
                    onClick={() => set_sort_by(key)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${sort_by === key
                      ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
                      : "bg-white/[0.03] border-white/[0.05] text-gray-500 hover:text-gray-300"
                      }`}
                  >
                    {labels[key]}
                  </button>
                );
              })}
            </div>
            <button
              onClick={clear_results}
              className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 active:scale-95"
            >
              <Trash2 size={14} /> 결과 초기화
            </button>
          </div>

          {/* 키워드 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted_keywords.map((k, idx) => {
              const badge = get_golden_badge(k.golden_score || 0);
              const competition_cls = get_competition_color(k.competition);
              const intent_cls = get_intent_color(k.intent);
              return (
                <div
                  key={idx}
                  className="glass-card p-7 group interactive-hover relative overflow-hidden shine-effect flex flex-col gap-5"
                >

                  {/* 상단: 배지 + 황금점수 원형 게이지 */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${badge.bg} ${badge.color}`}>
                      {badge.label}
                    </span>
                    <div className="relative w-10 h-10">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15" fill="none"
                          stroke={k.golden_score >= 80 ? "#eab308" : k.golden_score >= 60 ? "#94a3b8" : "#f97316"}
                          strokeWidth="3"
                          strokeDasharray={`${(k.golden_score || 0) * 0.942} 94.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                        {k.golden_score}
                      </span>
                    </div>
                  </div>

                  {/* 키워드명 */}
                  <h3 className="text-xl font-bold text-white group-hover:text-yellow-300 transition-colors font-outfit leading-snug">
                    {k.keyword}
                  </h3>

                  {/* 추천 사유 */}
                  <p className="text-gray-400 text-sm leading-relaxed opacity-80 line-clamp-3">{k.reason}</p>

                  {/* 태그: 의도 + 경쟁도 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${intent_cls}`}>{k.intent}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${competition_cls}`}>경쟁 {k.competition}</span>
                  </div>

                  {/* 하단: CPC + 검색량 + 버튼들 */}
                  <div className="mt-auto pt-4 border-t border-white/[0.05] flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-yellow-400">
                        <DollarSign size={14} />
                        <span className="text-sm font-bold font-outfit">{k.cpc_estimate}</span>
                        <span className="text-[10px] text-gray-600">/ click</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <LayoutList size={12} />
                        <span className="text-[11px]">{k.monthly_vol}<span className="text-gray-700">/월</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 심층 분석: 카드 클릭과 분리 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); run_deep_analyze(k.keyword); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] font-bold hover:bg-yellow-500/20 transition-all active:scale-95 shrink-0"
                      >
                        <Sparkles size={12} /> 심층 분석
                      </button>
                      {/* 글쓰기 시작 버튼 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/editor?topic=${encodeURIComponent(topic)}&keyword=${encodeURIComponent(k.keyword)}`); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-bold hover:bg-blue-500/25 transition-all active:scale-95 shrink-0"
                      >
                        <PenLine size={12} /> 글쓰기
                      </button>
                    </div>
                  </div>

                  <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-yellow-600/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && keywords.length === 0 && !error_msg && (
        <div className="flex flex-col items-center justify-center p-24 glass-card border-dashed border-white/[0.05] opacity-60">
          <Star size={64} strokeWidth={1} className="text-gray-700 mb-6" />
          <p className="text-gray-500 text-lg font-medium">분석할 주제를 입력하면 황금 키워드를 발굴해 드립니다.</p>
          <p className="text-gray-600 text-sm mt-2">예: 미국 배당주, 실비보험 비교, 당뇨 식단 추천</p>
        </div>
      )}

      {/* 심층 분석 모달 */}
      {analyzing_keyword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { set_analyzing_keyword(null); set_analysis_result(null); } }}
        >
          <div className="bg-[#0d0d12] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-6 p-8 animate-in zoom-in-95 fade-in duration-300">

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-1">Deep Analysis</div>
                <h2 className="text-2xl font-bold text-white font-outfit">{analyzing_keyword}</h2>
              </div>
              <button
                onClick={() => { set_analyzing_keyword(null); set_analysis_result(null); }}
                className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 로딩 */}
            {analysis_loading && (
              <div className="flex flex-col items-center gap-4 py-16">
                <Loader2 size={40} className="animate-spin text-yellow-400" />
                <p className="text-gray-400 text-sm">AI가 심층 분석 중입니다...</p>
              </div>
            )}

            {/* 분석 결과 */}
            {analysis_result && !analysis_loading && (
              <div className="flex flex-col gap-8">

                {/* 파생 롱테일 키워드 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart2 size={14} className="text-yellow-400" /> 파생 롱테일 키워드
                  </h3>
                  <div className="flex flex-col gap-2">
                    {analysis_result.longtail_keywords?.map((lk, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 hover:border-yellow-500/20 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/editor?topic=${encodeURIComponent(topic)}&keyword=${encodeURIComponent(lk.keyword)}`)}
                      >
                        <span className="text-white font-medium text-sm group-hover:text-yellow-300 transition-colors">{lk.keyword}</span>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="text-yellow-400 font-bold">{lk.cpc_estimate}</span>
                          <span>{lk.monthly_vol}/월</span>
                          <span className={`px-2 py-0.5 rounded-md border ${get_competition_color(lk.competition)}`}>{lk.competition}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 글쓰기 각도 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles size={14} className="text-yellow-400" /> 추천 글쓰기 각도
                  </h3>
                  <div className="flex flex-col gap-3">
                    {analysis_result.content_angles?.map((ca, i) => (
                      <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider">{ca.angle}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md ${ca.ctr_boost === "높음" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"}`}>CTR {ca.ctr_boost}</span>
                        </div>
                        <p className="text-white text-sm font-medium">"{ca.title_example}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 수익화 전략 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <DollarSign size={14} className="text-yellow-400" /> 수익화 전략
                  </h3>
                  <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4">
                    <p className="text-gray-300 text-sm leading-relaxed">{analysis_result.monetization_tips}</p>
                  </div>
                </div>

                {/* 시너지 키워드 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-yellow-400" /> 시너지 연관 키워드
                  </h3>
                  <div className="flex flex-col gap-2">
                    {analysis_result.synergy_keywords?.map((sk, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                        <span className="text-yellow-400 font-bold text-sm shrink-0 mt-0.5">{sk.keyword}</span>
                        <span className="text-gray-500 text-xs leading-relaxed">{sk.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
