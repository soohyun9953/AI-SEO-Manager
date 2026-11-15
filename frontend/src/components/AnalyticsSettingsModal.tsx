"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Globe,
  DollarSign,
  RefreshCw,
  ExternalLink,
  KeyRound,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface AnalyticsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface ConnectionStatus {
  site_url?: string;
  gsc_connected?: boolean;
  adsense_connected?: boolean;
  adsense_account_id?: string;
  mode?: string;
  error?: string;
  missing_env?: string[];
}

function StatusBadge({ ok, mode }: { ok: boolean; mode?: string }) {
  if (ok && mode === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={13} /> 연동 정상 (LIVE)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
      <AlertTriangle size={13} /> 미연동 (DEMO 모드)
    </span>
  );
}

export default function AnalyticsSettingsModal({ isOpen, onClose, onSaved }: AnalyticsSettingsModalProps) {
  const [status, setStatus] = useState<ConnectionStatus>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // 연동 작업 상태
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [showManualCode, setShowManualCode] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [exchangingCode, setExchangingCode] = useState(false);
  const [testingLive, setTestingLive] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const getApiUrl = (endpoint: string) => {
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return `http://localhost:8002${endpoint}`;
    }
    return endpoint;
  };

  const loadStatus = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(getApiUrl("/api/analytics/settings"));
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      setStatus(data.config || {});
    } catch (err) {
      console.error("연동 상태 조회 실패:", err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setTestResult(null);
      setAuthMessage(null);
    }
  }, [isOpen]);

  // 원클릭 자동 로컬 인증 플로우 실행
  const handleStartLocalAuth = async () => {
    setIsAuthorizing(true);
    setAuthMessage("브라우저에서 Google 로그인 창이 열립니다. 계정 선택 및 권한을 승인해주세요...");
    try {
      // 1. 브라우저에서 직접 새 창으로 인증 페이지 열기
      try {
        const urlRes = await fetch(getApiUrl("/api/analytics/auth/google/url?redirect_uri=http://localhost:8765/"));
        const urlData = await urlRes.json();
        if (urlData.auth_url) {
          window.open(urlData.auth_url, "_blank");
        }
      } catch (e) {
        console.error("인증 URL 열기 실패:", e);
      }

      // 2. 백엔드 로컬 서버에서 승인 코드 수신 대기
      const res = await fetch(getApiUrl("/api/analytics/auth/google/start-local-flow"), {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "인증 처리 실패");
      }
      setAuthMessage("✅ Google 연동이 성공적으로 완료되었습니다! 이제 LIVE 실데이터로 동작합니다.");
      await loadStatus();
      onSaved();
    } catch (err: any) {
      setAuthMessage(`❌ 인증 실패: ${err.message}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // 수동 인증 URL 열기
  const handleOpenAuthUrl = async () => {
    try {
      const res = await fetch(getApiUrl("/api/analytics/auth/google/url?redirect_uri=http://localhost:8765/"));
      const data = await res.json();
      if (data.auth_url) {
        window.open(data.auth_url, "_blank");
      }
    } catch (err: any) {
      alert(`인증 URL 생성 실패: ${err.message}`);
    }
  };

  // 수동 인증 코드 교환
  const handleExchangeCode = async () => {
    if (!authCodeInput.trim()) {
      alert("Google 인증 코드를 입력해주세요.");
      return;
    }
    setExchangingCode(true);
    try {
      const res = await fetch(getApiUrl("/api/analytics/auth/google/exchange"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: authCodeInput.trim(),
          redirect_uri: "http://localhost:8765/"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "토큰 교환 실패");
      }
      alert("✅ 토큰이 성공적으로 저장되었습니다!");
      setAuthCodeInput("");
      setShowManualCode(false);
      await loadStatus();
      onSaved();
    } catch (err: any) {
      alert(`토큰 교환 실패: ${err.message}`);
    } finally {
      setExchangingCode(false);
    }
  };

  // 라이브 실데이터 연결 검증 테스트
  const handleTestLive = async () => {
    setTestingLive(true);
    setTestResult(null);
    try {
      const res = await fetch(getApiUrl("/api/analytics/auth/google/test-live"));
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingLive(false);
    }
  };

  if (!isOpen) return null;

  const isLive = status.mode === "LIVE" && !status.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0f0f16] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[92vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 border border-blue-500/25 rounded-xl text-blue-400">
              <Globe size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Google Search Console & AdSense 연동 설정</h2>
              <p className="text-xs text-gray-400 mt-0.5">실제 Google API를 연결하여 라이브 성과 데이터를 조회합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span>연동 상태 및 토큰 유효성을 확인하고 있습니다...</span>
          </div>
        ) : failed ? (
          <div className="py-16 text-center text-red-300 text-sm">
            연동 상태를 불러오지 못했습니다. 백엔드 서버(포트 8002) 가동 여부를 확인해 주세요.
          </div>
        ) : (
          <div className="space-y-6 pt-5">
            {/* 1. 현재 연동 상태 배너 */}
            <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
              isLive
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/20 text-amber-200"
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {isLive ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertTriangle size={18} className="text-amber-400" />}
                  <span>{isLive ? "Google 라이브 실데이터 연동 정상 작동 중" : "현재 DEMO(샘플) 모드로 동작 중입니다"}</span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  {isLive
                    ? "Search Console 및 AdSense 공식 API를 통해 실제 티스토리 블로그 트래픽과 수익 지표를 가져오고 있습니다."
                    : status.error
                      ? `Google 실데이터 조회 오류: ${status.error}`
                      : "Google OAuth 토큰이 만료되었거나 미연동 상태입니다. 아래 버튼을 눌러 Google 계정을 연동해 주세요."}
                </p>
              </div>
              <button
                onClick={handleTestLive}
                disabled={testingLive}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
              >
                <RefreshCw size={12} className={testingLive ? "animate-spin" : ""} />
                연동 검증
              </button>
            </div>

            {/* 검증 테스트 결과 알림 */}
            {testResult && (
              <div className={`p-3 rounded-lg text-xs border ${
                testResult.is_live
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}>
                {testResult.is_live
                  ? `[연동 성공] ${testResult.mode} 정상 확인 완료`
                  : `[검증 실패] ${testResult.error || "라이브 데이터를 가져오지 못했습니다."}`}
              </div>
            )}

            {/* 2. 핵심 원클릭 연동 액션 카드 */}
            <div className="p-5 bg-gradient-to-br from-blue-950/40 via-[#141420] to-purple-950/40 border border-blue-500/20 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="text-blue-400 w-4 h-4" />
                    Google 계정 라이브 연동 (원클릭 자동 인증)
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    버튼을 클릭하면 브라우저에서 Google 로그인 창이 열리며, 승인 완료 시 새 리프레시 토큰이 자동 저장됩니다.
                  </p>
                </div>
              </div>

              {authMessage && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-blue-200">
                  {authMessage}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleStartLocalAuth}
                  disabled={isAuthorizing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-xl text-xs transition-all shadow-lg shadow-blue-600/30"
                >
                  {isAuthorizing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Google 인증 대기 중...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={14} />
                      <span>Google 계정 로그인하여 라이브 연결하기</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualCode(!showManualCode)}
                  className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors px-2 py-1"
                >
                  <span>수동 코드 입력</span>
                  {showManualCode ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* 수동 코드 입력 드롭다운 */}
              {showManualCode && (
                <div className="p-4 bg-[#0d0d14] border border-white/10 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>1단계: 새 탭에서 인증 링크 열기</span>
                    <button
                      onClick={handleOpenAuthUrl}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                    >
                      <ExternalLink size={12} />
                      인증 페이지 열기
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">2단계: 승인 후 리디렉션된 URL의 code 값 입력</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="4/0A..."
                        value={authCodeInput}
                        onChange={(e) => setAuthCodeInput(e.target.value)}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <button
                        onClick={handleExchangeCode}
                        disabled={exchangingCode}
                        className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg text-white transition-colors"
                      >
                        {exchangingCode ? "교환 중..." : "토큰 저장"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. 속성 및 계정 상태 상세 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-4 bg-[#14141e] border border-white/5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-blue-400" />
                    <span className="text-sm font-semibold">Search Console 속성</span>
                  </div>
                  <StatusBadge ok={Boolean(status.gsc_connected)} mode={status.mode} />
                </div>
                <p className="text-xs text-gray-300 font-mono break-all">{status.site_url || "미설정"}</p>
                <p className="text-[11px] text-gray-500">Google Search Console에 등록된 블로그 URL 속성</p>
              </div>

              <div className="p-4 bg-[#14141e] border border-white/5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-amber-400" />
                    <span className="text-sm font-semibold">Google AdSense 계정</span>
                  </div>
                  <StatusBadge ok={Boolean(status.adsense_connected)} mode={status.mode} />
                </div>
                <p className="text-xs text-gray-300 font-mono break-all">{status.adsense_account_id || "미설정"}</p>
                <p className="text-[11px] text-gray-500">애드센스 게시자 ID (pub-XXXX...)</p>
              </div>
            </div>

            {/* 4. 중요: 7일 만료 방지 (영구 유지 가이드) */}
            <div className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-purple-400" />
                  💡 토큰 7일 만료 방지 (영구 유지 팁)
                </span>
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 underline underline-offset-2"
                >
                  <span>Google Cloud Console 열기</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <p className="text-[12px] text-gray-300 leading-relaxed">
                Google Cloud Console &gt; <strong>OAuth 동의 화면</strong>에서 앱의 게시 상태가 <strong>'테스트(Testing)'</strong>로 되어 있으면 보안 정책상 7일 후 토큰이 만료됩니다.
                <br />
                해당 페이지에서 <strong>[앱 게시(PUBLISH APP)]</strong> 버튼을 눌러 상태를 '프로덕션'으로 변경해 두시면 7일 만료 제한 없이 <strong>토큰이 영구적으로 유지</strong>됩니다.
              </p>
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-between pt-5 mt-6 border-t border-white/10">
          <button
            onClick={loadStatus}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <RefreshCw size={13} />
            상태 새로고침
          </button>
          <button
            onClick={() => {
              onSaved();
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-600/30"
          >
            완료 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
