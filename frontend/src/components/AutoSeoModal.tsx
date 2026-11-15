"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Send,
  Eye,
  Code2,
  ChevronRight,
  Layers,
  HelpCircle
} from "lucide-react";

interface AutoSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageItem: any | null;
  onSavedSuccess?: () => void;
}

export default function AutoSeoModal({ isOpen, onClose, pageItem, onSavedSuccess }: AutoSeoModalProps) {
  const [step, setStep] = useState<"READY" | "GENERATING" | "COMPLETED">("READY");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 결과 데이터
  const [optimizedData, setOptimizedData] = useState<any | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [metaDesc, setMetaDesc] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "faq">("preview");

  // 티스토리 임시저장 상태
  const [isSavingTistory, setIsSavingTistory] = useState(false);
  const [tistoryResultMsg, setTistoryResultMsg] = useState<string | null>(null);
  const [isLaunchingTistory, setIsLaunchingTistory] = useState(false);
  const [isPollingLogin, setIsPollingLogin] = useState(false);

  const handleLaunchTistoryBrowser = async () => {
    setIsLaunchingTistory(true);
    setIsPollingLogin(true);
    setTistoryResultMsg("🌐 카카오 로그인 브라우저가 화면에 열립니다. 화면에 나타난 크롬 창에서 카카오 계정으로 1회 로그인해 주세요! (로그인 완료 시 자동 감지)");

    try {
      await fetch(getApiUrl("/api/tistory/launch-browser?blog_name=s-elegant"), { method: "POST" });
      
      // 2초마다 로그인 완료 여부 폴링
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts += 1;
        if (attempts > 90) { // 3분 대기
          clearInterval(pollTimer);
          setIsPollingLogin(false);
          setIsLaunchingTistory(false);
          return;
        }

        try {
          const res = await fetch(getApiUrl("/api/tistory/login-status"));
          const statusData = await res.json();
          if (statusData.status === "success") {
            clearInterval(pollTimer);
            setIsPollingLogin(false);
            setIsLaunchingTistory(false);
            setTistoryResultMsg("✅ 카카오 로그인 세션 저장 완료! 이제 아래 [티스토리 에디터에 임시저장하기] 버튼을 누르시면 자동으로 저장됩니다.");
          } else if (statusData.status === "timeout" || statusData.status === "error") {
            clearInterval(pollTimer);
            setIsPollingLogin(false);
            setIsLaunchingTistory(false);
            setTistoryResultMsg(`❌ 카카오 로그인 실패: ${statusData.message}`);
          }
        } catch (e) {
          // ignore
        }
      }, 2000);
    } catch (e: any) {
      setTistoryResultMsg(`❌ 브라우저 열기 실패: ${e.message}`);
      setIsPollingLogin(false);
      setIsLaunchingTistory(false);
    }
  };

  const getApiUrl = (endpoint: string) => {
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return `http://localhost:8002${endpoint}`;
    }
    return endpoint;
  };

  useEffect(() => {
    if (isOpen && pageItem) {
      setStep("READY");
      setError(null);
      setOptimizedData(null);
      setTistoryResultMsg(null);
    }
  }, [isOpen, pageItem]);

  // 원클릭 자동 최적화 실행
  const handleStartAutoOptimize = async () => {
    if (!pageItem) return;
    setStep("GENERATING");
    setError(null);
    setLoadingMsg("1단계: 티스토리 블로그에서 원문 글과 구조를 자동으로 수집하고 있습니다...");

    try {
      const apiKey = localStorage.getItem("GEMINI_API_KEY") || localStorage.getItem("gemini_api_key") || "";

      // 1초 뒤 메시지 전환
      setTimeout(() => {
        setLoadingMsg("2단계: Search Console 유입 키워드를 분석하여 제목·메타설명·서두 요약 박스를 AI 리라이팅 중입니다...");
      }, 1500);

      const res = await fetch(getApiUrl("/api/analytics/auto-optimize/fetch-and-rewrite"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": apiKey
        },
        body: JSON.stringify({
          url: pageItem.url,
          title: pageItem.title,
          scenario: pageItem.scenario || "HIGH_IMP_LOW_CTR",
          scenario_label: pageItem.scenario_label || "노출 대비 클릭률 저조",
          diagnosis: pageItem.diagnosis || "",
          queries: pageItem.queries || []
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "자동 최적화 처리에 실패했습니다.");
      }

      const opt = data.optimized || {};
      setOptimizedData(opt);
      setSelectedTitle(opt.recommended_title || pageItem.title);
      setMetaDesc(opt.meta_description || "");
      setStep("COMPLETED");
    } catch (err: any) {
      setError(err.message);
      setStep("READY");
    }
  };

  // 티스토리 임시저장 실행
  const handleSaveToTistory = async () => {
    if (!optimizedData) return;
    setIsSavingTistory(true);
    setTistoryResultMsg("Playwright 브라우저를 구동하여 티스토리 에디터에 자동 입력 중입니다...");

    try {
      // 본문 상단에 3줄 요약 박스 및 FAQ 스키마 결합
      let finalHtml = optimizedData.rewritten_html || "";
      if (optimizedData.summary_points && optimizedData.summary_points.length > 0) {
        const summaryBox = `
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1e293b;">📌 3줄 핵심 요약</p>
  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
    ${optimizedData.summary_points.map((p: string) => `<li>${p}</li>`).join("")}
  </ul>
</div>`;
        if (!finalHtml.includes("3줄 핵심 요약")) {
          finalHtml = summaryBox + finalHtml;
        }
      }

      if (optimizedData.faq_json_ld) {
        finalHtml += `\n${optimizedData.faq_json_ld}`;
      }

      const res = await fetch(getApiUrl("/api/analytics/auto-optimize/save-tistory"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedTitle,
          html_content: finalHtml,
          tags: optimizedData.tags || [],
          blog_name: "s-elegant"
        })
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || data.detail || "티스토리 임시저장에 실패했습니다.");
      }

      setTistoryResultMsg(`✅ ${data.message || "티스토리 에디터에 성공적으로 임시저장되었습니다!"} (티스토리 관리자 > 글 관리 > 임시저장 목록에서 확인 가능)`);
      if (onSavedSuccess) onSavedSuccess();
    } catch (err: any) {
      setTistoryResultMsg(`❌ 티스토리 임시저장 실패: ${err.message}`);
    } finally {
      setIsSavingTistory(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen || !pageItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0e0e17] border border-white/10 rounded-2xl shadow-2xl text-white max-h-[92vh] flex flex-col overflow-hidden">
        {/* 모달 상단 헤더 */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#131320]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  {pageItem.scenario_label || "AI SEO 최적화"}
                </span>
                <span className="text-xs text-amber-400 font-bold">
                  우선순위 {pageItem.priority_score}점
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-1 line-clamp-1">
                ⚡ 원클릭 AI SEO 자동 수정 & 티스토리 저장
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 타깃 글 기본 정보 바 */}
          <div className="p-4 bg-[#141422] border border-white/5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-gray-400 font-medium">대상 글 원본:</span>
              <p className="text-sm font-semibold text-gray-200">{pageItem.title}</p>
              <a
                href={pageItem.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-mono break-all"
              >
                <span>{decodeURI(pageItem.url)}</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <div className="flex items-center gap-3 bg-black/40 px-3 py-2 rounded-lg border border-white/5 flex-shrink-0">
              <div>
                <span className="text-[10px] text-gray-400">노출수</span>
                <p className="font-bold text-white">{pageItem.impressions?.toLocaleString()}회</p>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div>
                <span className="text-[10px] text-gray-400">클릭수</span>
                <p className="font-bold text-blue-400">{pageItem.clicks?.toLocaleString()}회</p>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div>
                <span className="text-[10px] text-gray-400">CTR</span>
                <p className="font-bold text-purple-400">{pageItem.ctr}%</p>
              </div>
            </div>
          </div>

          {/* 에러 알림 */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              ❌ 오류 발생: {error}
            </div>
          )}

          {/* 상태 1: 준비 상태 (READY) */}
          {step === "READY" && (
            <div className="py-8 text-center space-y-6 max-w-xl mx-auto">
              <div className="p-6 bg-gradient-to-b from-blue-950/30 to-purple-950/30 border border-blue-500/20 rounded-2xl space-y-4">
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Sparkles size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    원클릭으로 글 분석부터 티스토리 수정본 작성까지
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    수동으로 30분씩 들여 수정할 필요 없이, AI가 기존 본문을 자동으로 가져와<br />
                    <strong>클릭률 2배 제목 · 150자 메타 설명 · 3줄 요약 박스 · 소제목 체계화</strong>를 10초 만에 완성합니다.
                  </p>
                </div>

                <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-left text-xs text-gray-300 space-y-1.5">
                  <p className="font-semibold text-blue-300">🔍 진단 분석 사항:</p>
                  <p className="text-gray-400 leading-relaxed">{pageItem.diagnosis}</p>
                </div>

                <button
                  onClick={handleStartAutoOptimize}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>AI 자동 리라이팅 및 최적화 시작하기 (10초)</span>
                </button>
              </div>
            </div>
          )}

          {/* 상태 2: 생성 진행 중 (GENERATING) */}
          {step === "GENERATING" && (
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">AI 자동 SEO 리라이팅 진행 중...</h3>
                <p className="text-xs text-blue-300 font-medium">{loadingMsg}</p>
                <p className="text-[11px] text-gray-500">본문 수집 → 팩트 보존 → 키워드 재배치 → 서두 요약 박스 생성 중</p>
              </div>
            </div>
          )}

          {/* 상태 3: 완료 및 결과 비교 (COMPLETED) */}
          {step === "COMPLETED" && optimizedData && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* 1. 최적화 제목 선택 영역 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-400" />
                    클릭률(CTR) 극대화 제목 선택 (추천안 3종 중 1개 선택)
                  </label>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    선택된 제목: {selectedTitle.length}자
                  </span>
                </div>
                <div className="space-y-2">
                  {(optimizedData.title_options || [optimizedData.recommended_title]).map((t: string, idx: number) => {
                    const isSelected = selectedTitle === t;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTitle(t)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-600/15 border-blue-500 text-white font-semibold shadow-md shadow-blue-500/10"
                            : "bg-[#141420] border-white/5 text-gray-300 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? "bg-blue-500 text-white" : "bg-white/10 text-gray-400"
                          }`}>
                            {idx + 1}
                          </span>
                          <span>{t}</span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              최우선 추천
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(t, `title_${idx}`);
                          }}
                          className="text-gray-400 hover:text-white p-1"
                          title="제목 복사"
                        >
                          {copiedKey === `title_${idx}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. 메타 설명 150자 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-purple-400" />
                    검색엔진 스니펫용 150자 메타 설명
                  </label>
                  <button
                    onClick={() => copyToClipboard(metaDesc, "meta")}
                    className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === "meta" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>복사</span>
                  </button>
                </div>
                <textarea
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#141420] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                />
              </div>

              {/* 3. 서두 3줄 요약 박스 미리보기 */}
              {optimizedData.summary_points && optimizedData.summary_points.length > 0 && (
                <div className="p-3.5 bg-blue-950/20 border border-blue-500/20 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                    <span>📌 본문 최상단에 자동 삽입되는 '3줄 핵심 요약 박스'</span>
                    <span className="text-[10px] text-blue-400 font-normal">독자 체류시간 증가 및 이탈 방지</span>
                  </div>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    {optimizedData.summary_points.map((p: string, i: number) => (
                      <li key={i} className="leading-relaxed">{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 4. 본문 미리보기 및 탭 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("preview")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        activeTab === "preview" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Eye size={13} />
                      <span>개선 본문 미리보기</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("html")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        activeTab === "html" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Code2 size={13} />
                      <span>HTML 코드</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("faq")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        activeTab === "faq" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      <HelpCircle size={13} />
                      <span>FAQ 구조화 데이터</span>
                    </button>
                  </div>
                  <button
                    onClick={() => copyToClipboard(optimizedData.rewritten_html || "", "html_content")}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === "html_content" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>전체 본문 복사</span>
                  </button>
                </div>

                <div className="p-4 bg-[#12121d] border border-white/10 rounded-xl max-h-72 overflow-y-auto">
                  {activeTab === "preview" && (
                    <div
                      className="text-xs text-gray-300 space-y-3 leading-relaxed font-sans prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: optimizedData.rewritten_html || "<p>본문이 없습니다.</p>" }}
                    />
                  )}
                  {activeTab === "html" && (
                    <pre className="text-[11px] text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap">
                      {optimizedData.rewritten_html}
                    </pre>
                  )}
                  {activeTab === "faq" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {(optimizedData.faq_items || []).map((faq: any, i: number) => (
                          <div key={i} className="p-2.5 bg-black/40 rounded-lg text-xs">
                            <p className="font-bold text-white">Q. {faq.question}</p>
                            <p className="text-gray-400 mt-1">A. {faq.answer}</p>
                          </div>
                        ))}
                      </div>
                      {optimizedData.faq_json_ld && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">검색엔진 리치 스니펫용 JSON-LD 스크립트:</p>
                          <pre className="text-[10px] text-emerald-400 bg-black/60 p-2.5 rounded font-mono overflow-x-auto">
                            {optimizedData.faq_json_ld}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. 태그 목록 */}
              {optimizedData.tags && optimizedData.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-gray-400 font-medium">추천 태그:</span>
                  {optimizedData.tags.map((tg: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/5 text-[11px]">
                      #{tg}
                    </span>
                  ))}
                </div>
              )}

              {/* 티스토리 저장 안내 메시지 및 로그인 가이드 */}
              {tistoryResultMsg && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                  tistoryResultMsg.includes("✅")
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : tistoryResultMsg.includes("❌")
                      ? "bg-red-500/10 border-red-500/25 text-red-300"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-200"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {tistoryResultMsg.includes("✅") ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : tistoryResultMsg.includes("❌") ? (
                        <AlertTriangle size={16} className="text-red-400 shrink-0" />
                      ) : (
                        <RefreshCw size={16} className="text-blue-400 animate-spin shrink-0" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[13px]">{tistoryResultMsg}</p>

                      {/* 로그인이 필요하거나 실패한 경우 원클릭 버튼 안내 */}
                      {(tistoryResultMsg.includes("로그인") || tistoryResultMsg.includes("❌")) && (
                        <div className="mt-3 pt-3 border-t border-white/10 bg-black/50 -mx-1 -mb-1 p-3.5 rounded-lg space-y-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                                <span>🔑</span> 원클릭 카카오 1회 로그인 (최초 1회만 필요)
                              </p>
                              <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                                우측 버튼을 누르면 <strong className="text-amber-200">모니터 화면에 카카오 로그인 창이 바로 열립니다.</strong> 1회 로그인 완료 즉시 세션이 영구 저장되어, 이후에는 로그인 버튼 없이 바로 임시저장됩니다.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleLaunchTistoryBrowser}
                              disabled={isLaunchingTistory || isPollingLogin}
                              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold rounded-lg text-xs transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                            >
                              {isPollingLogin ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" />
                                  <span>로그인 대기/감지 중...</span>
                                </>
                              ) : (
                                <>
                                  <span>🔑 브라우저 로그인 창 열기</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-blue-300 text-xs flex items-center gap-1.5">
                                <span>🚀</span> 또는 지금 바로 새 탭으로 열어 복사/붙여넣기
                              </p>
                              <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                                지금 즉시 글을 발행하시려면, 아래 버튼으로 티스토리 새 탭을 열고 [전체 본문 복사]를 붙여넣으셔도 10초 만에 등록 가능합니다.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => window.open("https://s-elegant.tistory.com/manage/post", "_blank")}
                              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <ExternalLink size={13} />
                              <span>티스토리 글쓰기 새 창 열기</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모달 하단 푸터 버튼 바 */}
        <div className="p-4 border-t border-white/10 bg-[#131320] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleLaunchTistoryBrowser}
              disabled={isLaunchingTistory || isPollingLogin}
              className="px-3 py-1.5 text-[11px] font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>🔑</span>
              <span>티스토리 브라우저 로그인</span>
            </button>
          </div>

          {step === "COMPLETED" && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleStartAutoOptimize}
                className="px-3.5 py-2 text-xs font-semibold text-gray-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                다시 리라이팅
              </button>

              <button
                onClick={handleSaveToTistory}
                disabled={isSavingTistory}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                {isSavingTistory ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>티스토리 임시저장 진행 중...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>티스토리 에디터에 임시저장하기</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
