"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Copy, Check, Lightbulb, FileText, ArrowRight, ExternalLink } from "lucide-react";

interface AiImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageItem: any | null;
}

export default function AiImprovementModal({ isOpen, onClose, pageItem }: AiImprovementModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedTitleIndex, setCopiedTitleIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && pageItem) {
      fetchRecommendation();
    } else {
      setResult(null);
      setError(null);
    }
  }, [isOpen, pageItem]);

  const fetchRecommendation = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = localStorage.getItem("GEMINI_API_KEY") || localStorage.getItem("gemini_api_key") || "";
      const res = await fetch("/api/analytics/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": apiKey
        },
        body: JSON.stringify({ page: pageItem })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "처방전 생성 실패");
      }

      const data = await res.json();
      setFallbackReason(data.ai_used === false ? (data.fallback_reason || "AI 호출 없이 기본 템플릿으로 생성되었습니다.") : null);
      if (data.recommendation) {
        setResult(data.recommendation);
      } else if (data.fallback) {
        setResult(data.fallback);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTitle = (title: string, index: number) => {
    navigator.clipboard.writeText(title);
    setCopiedTitleIndex(index);
    setTimeout(() => setCopiedTitleIndex(null), 2000);
  };

  if (!isOpen || !pageItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0d0d14] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {pageItem.scenario_label || "AI 성과 진단"}
              </span>
              <span className="text-xs text-amber-400 font-bold">
                우선순위 {pageItem.priority_score}점
              </span>
            </div>
            <h2 className="text-base font-bold text-white line-clamp-1">
              {pageItem.title}
            </h2>
            <a
              href={pageItem.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-400 font-mono transition-colors"
            >
              <span>{pageItem.url}</span>
              <ExternalLink size={11} />
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 현재 상태 핵심 수치 바 */}
        <div className="grid grid-cols-4 gap-2.5 my-4 p-3 bg-[#151520] border border-white/5 rounded-xl text-center">
          <div>
            <p className="text-[10px] text-gray-400">최근 노출수</p>
            <p className="text-sm font-bold text-white mt-0.5">{pageItem.impressions?.toLocaleString()}회</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">클릭수</p>
            <p className="text-sm font-bold text-blue-400 mt-0.5">{pageItem.clicks?.toLocaleString()}회</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">CTR (클릭률)</p>
            <p className="text-sm font-bold text-purple-400 mt-0.5">{pageItem.ctr}%</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">평균 검색 순위</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">{pageItem.position}위</p>
          </div>
        </div>

        {/* 콘텐츠 분석 진단 원문 */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-5">
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-semibold text-white">진단 결과:</span> {pageItem.diagnosis}
          </p>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="py-14 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
            <p className="text-sm text-gray-300 font-medium">Gemini AI가 포스팅 맞춤 최적화 처방전을 분석 중입니다...</p>
            <p className="text-xs text-gray-500">클릭률 개선 제목안 · 본문 체류시간 보완 가이드라인 도출 중</p>
          </div>
        )}

        {/* 에러 상태 */}
        {error && !loading && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
            처방전 생성 실패: {error}
          </div>
        )}

        {/* 결과 표시 */}
        {result && !loading && (
          <div className="space-y-6">
            {fallbackReason && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 leading-relaxed">
                ⚠️ AI가 만든 제안이 아니라 기본 템플릿입니다. {fallbackReason}
              </div>
            )}
            {/* 1. 총평 */}
            {result.summary_verdict && (
              <div className="p-3 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-200 font-medium leading-relaxed">
                  💡 <span className="font-bold text-white">수석 컨설턴트 한줄 총평:</span> {result.summary_verdict}
                </p>
              </div>
            )}

            {/* 2. 제목 개선안 3종 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles size={14} className="text-blue-400" />
                  클릭률(CTR) 2배 상승 제목 개선안 (원클릭 복사)
                </h3>
              </div>
              <div className="space-y-2">
                {result.title_suggestions?.map((title: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#161622] hover:bg-[#1c1c2b] border border-white/5 rounded-xl group transition-all"
                  >
                    <div className="flex items-center gap-2.5 flex-1 pr-3">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs text-gray-200 font-medium leading-snug">{title}</span>
                    </div>
                    <button
                      onClick={() => handleCopyTitle(title, idx)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 bg-white/5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors flex-shrink-0"
                    >
                      {copiedTitleIndex === idx ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span>복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>복사</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 본문 보완 가이드라인 */}
            <div>
              <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                <FileText size={14} className="text-purple-400" />
                체류시간 극대화 및 검색엔진 재평가 체크리스트
              </h3>
              <div className="p-3.5 bg-[#14141e] border border-white/5 rounded-xl space-y-2">
                {result.content_checklist?.map((chk: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                    <span className="text-emerald-400 mt-0.5">✔</span>
                    <span className="leading-relaxed">{chk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 연계 후속 콘텐츠 추천 */}
            {result.follow_up_topics && result.follow_up_topics.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                  <ArrowRight size={14} className="text-emerald-400" />
                  트래픽 순환을 위한 후속 롱테일 시리즈 추천
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {result.follow_up_topics.map((f: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#161622] border border-white/5 rounded-xl space-y-1">
                      <p className="text-xs font-semibold text-white">{f.topic}</p>
                      <p className="text-[11px] text-blue-400">타깃 키워드: {f.target_keyword}</p>
                      <p className="text-[10px] text-gray-400">{f.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 닫기 버튼 */}
        <div className="flex justify-end pt-5 mt-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
