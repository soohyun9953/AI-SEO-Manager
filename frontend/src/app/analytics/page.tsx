"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Eye,
  Percent,
  Search,
  Settings,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Globe
} from "lucide-react";
import AnalyticsSettingsModal from "@/components/AnalyticsSettingsModal";
import WeeklyReportModal from "@/components/WeeklyReportModal";
import AiImprovementModal from "@/components/AiImprovementModal";

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(28);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>({
    site_url: "https://s-elegant.tistory.com/",
    mode: "DEMO",
    gsc_connected: false,
    adsense_connected: false
  });
  const [data, setData] = useState<any>(null);
  const [filterScenario, setFilterScenario] = useState<string>("ALL");

  // 모달 제어
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedPageForAi, setSelectedPageForAi] = useState<any | null>(null);

  useEffect(() => {
    fetchAnalyticsData(days);
  }, [days]);

  const fetchAnalyticsData = async (targetDays: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/overview?days=${targetDays}`);
      if (res.ok) {
        const json = await res.json();
        setConnection(json.connection || {});
        setData(json.data || null);
      }
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary || {};
  const pages = data?.pages || [];
  const dailyTrends = data?.daily_trends || [];

  const filteredPages = pages.filter((p: any) => {
    if (filterScenario === "ALL") return true;
    return p.scenario === filterScenario;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. 상단 헤더 및 액션 바 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <TrendingUp className="text-blue-500" />
              수익·성과 분석 (GSC & AdSense)
            </h1>
            {connection.mode === "LIVE" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE (Google 실시간 연동)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                DEMO (검증용 샘플 데이터)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <span>대상 블로그: <strong className="text-gray-200">{connection.site_url || "https://s-elegant.tistory.com/"}</strong></span>
            <span>·</span>
            <span>데이터 기준: 최근 {days}일간</span>
          </p>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 기간 필터 */}
          <div className="flex bg-[#12121b] p-1 rounded-xl border border-white/5 text-xs">
            {[7, 28, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  days === d
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                최근 {d}일
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-purple-600/80 hover:bg-purple-600 rounded-xl transition-all border border-purple-500/30 shadow-lg shadow-purple-600/20"
          >
            <FileText size={14} />
            <span>주간 보고서</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
          >
            <Settings size={14} />
            <span>Google 연동 설정</span>
          </button>

          <button
            onClick={() => fetchAnalyticsData(days)}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            title="새로고침"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 2. 데이터 무결성 및 안내 배너 */}
      <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-[#12121c] to-purple-950/40 border border-white/10 rounded-2xl flex items-center justify-between text-xs text-gray-300">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>
            {connection.mode === "LIVE"
              ? "Google Search Console 및 AdSense 공식 API를 통해 실제 운영 데이터가 안전하게 동기화되었습니다."
              : "현재 Google 연동 전 단계로, 실제 API 규격과 100% 동일한 필드 구조의 검증용 샘플 데이터로 동작 중입니다."}
          </span>
        </div>
        {connection.mode === "DEMO" && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4 flex-shrink-0 ml-4"
          >
            Google 계정 연동 가이드 &rarr;
          </button>
        )}
      </div>

      {/* 3. 6대 핵심 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. 예상 광고 수익 */}
        <div className="p-4 bg-[#0d0d15] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>예상 광고 수익</span>
            <DollarSign size={16} className="text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            ₩{summary.total_estimated_earnings ? summary.total_estimated_earnings.toLocaleString() : "0"}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-medium">
            <ArrowUpRight size={12} />
            <span>+{summary.diff_earnings_pct || 0}% (전주 대비)</span>
          </div>
        </div>

        {/* 2. 페이지 RPM */}
        <div className="p-4 bg-[#0d0d15] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>페이지 RPM</span>
            <BarChart3 size={16} className="text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            ₩{summary.avg_page_rpm ? summary.avg_page_rpm.toLocaleString() : "0"}
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
            1,000회 조회당 수익
          </div>
        </div>

        {/* 3. 페이지 조회수 */}
        <div className="p-4 bg-[#0d0d15] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>페이지 조회수 (PV)</span>
            <Eye size={16} className="text-blue-400" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            {summary.total_pageviews ? summary.total_pageviews.toLocaleString() : "0"}회
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
            AdSense 감지 트래픽
          </div>
        </div>

        {/* 4. Google 검색 클릭수 */}
        <div className="p-4 bg-[#0d0d15] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Google 검색 클릭</span>
            <MousePointerClick size={16} className="text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            {summary.total_search_clicks ? summary.total_search_clicks.toLocaleString() : "0"}회
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-medium">
            <ArrowUpRight size={12} />
            <span>+{summary.diff_clicks_pct || 0}% (전주 대비)</span>
          </div>
        </div>

        {/* 5. Google 검색 노출수 */}
        <div className="p-4 bg-[#0d0d15] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>Google 검색 노출</span>
            <Search size={16} className="text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            {summary.total_search_impressions ? summary.total_search_impressions.toLocaleString() : "0"}회
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-medium">
            <ArrowUpRight size={12} />
            <span>+{summary.diff_impressions_pct || 0}% (전주 대비)</span>
          </div>
        </div>

        {/* 6. 평균 검색 CTR */}
        <div className="p-4 bg-[#0d0d15] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
            <span>평균 검색 CTR</span>
            <Percent size={16} className="text-rose-400" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            {summary.avg_search_ctr || 0}%
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
            평균 순위 {summary.avg_search_position || 0}위
          </div>
        </div>
      </div>

      {/* 4. 일별 시계열 트렌드 시각화 */}
      <div className="p-6 bg-[#0d0d15] border border-white/5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-400" />
              일별 검색 유입 및 수익 추이
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">최근 기간 동안의 Google 검색 클릭 및 광고 수익 상관관계</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /> 검색 클릭수
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /> 예상 수익(원)
            </span>
          </div>
        </div>

        {/* 미니 시계열 바 그래프 */}
        <div className="h-32 flex items-end gap-1.5 pt-6 pb-2 px-2 overflow-x-auto border-b border-white/5">
          {dailyTrends.map((d: any, i: number) => {
            const maxClick = Math.max(...dailyTrends.map((t: any) => t.search_clicks || 1));
            const heightPct = Math.round((d.search_clicks / maxClick) * 100);
            return (
              <div key={i} className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative">
                {/* 툴팁 */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-[#1a1a28] border border-white/10 rounded-lg p-2 text-[10px] text-white z-20 pointer-events-none whitespace-nowrap shadow-xl">
                  <span className="font-bold text-blue-300">{d.date}</span>
                  <span>클릭: {d.search_clicks}회 (노출 {d.search_impressions}회)</span>
                  <span>수익: ₩{d.estimated_earnings?.toLocaleString()} (RPM ₩{d.page_rpm})</span>
                </div>
                {/* 바 */}
                <div
                  style={{ height: `${Math.max(heightPct, 8)}%` }}
                  className="w-full bg-gradient-to-t from-blue-600/40 to-blue-500 rounded-t group-hover:from-blue-500 group-hover:to-cyan-400 transition-all"
                />
                <span className="text-[9px] text-gray-500 truncate w-full text-center">
                  {d.date.slice(8)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. 콘텐츠 우선순위 및 5대 시나리오 최적화 테이블 */}
      <div className="p-6 bg-[#0d0d15] border border-white/5 rounded-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-blue-400" />
              콘텐츠 개선 우선순위 및 AI 진단 매트릭스
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              검색 노출, 클릭률(CTR), 순위 변화를 기반으로 산출된 설명 가능한 우선순위 점수(0~100점)
            </p>
          </div>

          {/* 시나리오 필터 탭 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "ALL", label: "전체 보기" },
              { id: "HIGH_IMP_LOW_CTR", label: "⚠️ 클릭률 저조" },
              { id: "TRENDING_UP", label: "🚀 유입 급상승" },
              { id: "TRENDING_DOWN", label: "📉 유입 급감소" },
              { id: "HIGH_REVENUE_TOPIC", label: "💰 고단가 주제" },
              { id: "HIGH_TRAFFIC_LOW_RPM", label: "📊 단가 보완" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterScenario(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterScenario === tab.id
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-gray-400 hover:text-white bg-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#12121c] text-gray-400 font-semibold border-y border-white/5">
              <tr>
                <th className="py-3 px-4">우선순위</th>
                <th className="py-3 px-4 min-w-[280px]">포스팅 제목 및 진단</th>
                <th className="py-3 px-3 text-right">노출수</th>
                <th className="py-3 px-3 text-right">클릭수</th>
                <th className="py-3 px-3 text-right">CTR</th>
                <th className="py-3 px-3 text-right">순위</th>
                <th className="py-3 px-4 text-center">AI 최적화 처방</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPages.map((page: any, idx: number) => {
                const isHighPriority = page.priority_score >= 85;
                return (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    {/* 우선순위 스코어 */}
                    <td className="py-4 px-4 align-top">
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-sm font-bold ${
                            isHighPriority ? "text-amber-400" : "text-blue-400"
                          }`}
                        >
                          {page.priority_score}점
                        </span>
                        <div className="w-10 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isHighPriority ? "bg-amber-400" : "bg-blue-500"
                            }`}
                            style={{ width: `${page.priority_score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 제목 및 진단 요약 */}
                    <td className="py-4 px-4 align-top space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-gray-300 border border-white/10">
                          {page.scenario_label}
                        </span>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1 flex items-center gap-1"
                        >
                          <span>{page.title}</span>
                          <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        {page.diagnosis}
                      </p>
                    </td>

                    {/* 노출수 */}
                    <td className="py-4 px-3 text-right align-top font-mono text-gray-300">
                      {page.impressions?.toLocaleString()}회
                    </td>

                    {/* 클릭수 및 증감 */}
                    <td className="py-4 px-3 text-right align-top font-mono">
                      <span className="text-white font-bold">{page.clicks?.toLocaleString()}회</span>
                      {page.diff_pct !== undefined && (
                        <div
                          className={`text-[10px] flex items-center justify-end gap-0.5 ${
                            page.diff_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {page.diff_pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          <span>{page.diff_pct > 0 ? `+${page.diff_pct}` : page.diff_pct}%</span>
                        </div>
                      )}
                    </td>

                    {/* CTR */}
                    <td className="py-4 px-3 text-right align-top font-mono">
                      <span
                        className={
                          page.ctr < 1.0
                            ? "text-rose-400 font-bold"
                            : "text-purple-300 font-semibold"
                        }
                      >
                        {page.ctr}%
                      </span>
                    </td>

                    {/* 순위 */}
                    <td className="py-4 px-3 text-right align-top font-mono text-gray-300">
                      {page.position}위
                    </td>

                    {/* AI 최적화 처방 버튼 */}
                    <td className="py-4 px-4 text-center align-top">
                      <button
                        onClick={() => setSelectedPageForAi(page)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-md shadow-blue-600/20 active:scale-95"
                      >
                        <Sparkles size={12} />
                        <span>AI 개선안 보기</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모달 연동 */}
      <AnalyticsSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => fetchAnalyticsData(days)}
      />

      <WeeklyReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        days={days}
      />

      <AiImprovementModal
        isOpen={Boolean(selectedPageForAi)}
        onClose={() => setSelectedPageForAi(null)}
        pageItem={selectedPageForAi}
      />
    </div>
  );
}
