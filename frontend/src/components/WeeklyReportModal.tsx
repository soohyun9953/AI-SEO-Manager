"use client";

import React, { useState, useEffect } from "react";
import { X, Copy, Check, FileDown, RefreshCw, BarChart3 } from "lucide-react";

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  days?: number;
}

export default function WeeklyReportModal({ isOpen, onClose, days = 28 }: WeeklyReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      generateReport();
    }
  }, [isOpen, days]);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = localStorage.getItem("gemini_api_key") || "";
      const res = await fetch("/api/analytics/weekly-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": apiKey
        },
        body: JSON.stringify({ days })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "보고서 생성 실패");
      }

      const data = await res.json();
      setReportMarkdown(data.report_markdown || "");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SEO_AdSense_Weekly_Report_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0d0d14] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">주간 성과 및 수익 최적화 종합 리포트</h2>
              <p className="text-xs text-gray-400">Google Search Console & AdSense 성과 분석 브리프</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateReport}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 보고서 본문 영역 */}
        <div className="flex-1 overflow-y-auto my-4 pr-1">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <BarChart3 className="w-8 h-8 text-purple-400 animate-bounce mx-auto" />
              <p className="text-sm font-medium text-gray-300">주간 성과 지표 종합 리포트를 컴파일 중입니다...</p>
              <p className="text-xs text-gray-500">지표 증감율 · 급상승 포스팅 · 개선 우선순위 요약 중</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              보고서 생성 오류: {error}
            </div>
          ) : (
            <div className="bg-[#12121c] p-6 rounded-xl border border-white/5 font-mono text-xs leading-relaxed text-gray-300 whitespace-pre-wrap selection:bg-purple-500/30">
              {reportMarkdown}
            </div>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 flex-shrink-0">
          <span className="text-xs text-gray-400">
            * 리포트를 마크다운(.md) 파일로 저장하거나 Notion/슬랙에 바로 붙여넣을 수 있습니다.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownload}
              disabled={loading || !reportMarkdown}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40"
            >
              <FileDown size={14} />
              <span>.md 파일 다운로드</span>
            </button>
            <button
              onClick={handleCopy}
              disabled={loading || !reportMarkdown}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg shadow-purple-600/30 disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-300" />
                  <span>복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>마크다운 전체 복사</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
