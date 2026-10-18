"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, ShieldAlert, Key, Globe, DollarSign, HelpCircle, Save } from "lucide-react";

interface AnalyticsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AnalyticsSettingsModal({ isOpen, onClose, onSaved }: AnalyticsSettingsModalProps) {
  const [siteUrl, setSiteUrl] = useState("https://s-elegant.tistory.com/");
  const [adsenseAccountId, setAdsenseAccountId] = useState("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [gscConnected, setGscConnected] = useState(false);
  const [adsenseConnected, setAdsenseConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    // 1. 로컬스토리지 캐시 우선 복원
    try {
      const cached = localStorage.getItem("gsc_analytics_config");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.site_url) setSiteUrl(parsed.site_url);
        if (parsed.adsense_account_id) setAdsenseAccountId(parsed.adsense_account_id);
        if (parsed.service_account_email) setServiceAccountEmail(parsed.service_account_email);
        if (parsed.gsc_connected !== undefined) setGscConnected(Boolean(parsed.gsc_connected));
        if (parsed.adsense_connected !== undefined) setAdsenseConnected(Boolean(parsed.adsense_connected));
      }
    } catch (e) {}

    // 2. 서버 설정 조회
    try {
      const res = await fetch("/api/analytics/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          if (data.config.site_url) setSiteUrl(data.config.site_url);
          if (data.config.adsense_account_id) setAdsenseAccountId(data.config.adsense_account_id);
          if (data.config.service_account_email) setServiceAccountEmail(data.config.service_account_email);
          if (data.config.gsc_connected !== undefined) setGscConnected(Boolean(data.config.gsc_connected));
          if (data.config.adsense_connected !== undefined) setAdsenseConnected(Boolean(data.config.adsense_connected));
        }
      }
    } catch (err) {
      console.error("설정 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const configData = {
      site_url: siteUrl,
      adsense_account_id: adsenseAccountId,
      service_account_email: serviceAccountEmail,
      gsc_connected: gscConnected,
      adsense_connected: adsenseConnected,
      gsc_auth_type: "SERVICE_ACCOUNT"
    };

    // 로컬스토리지에 즉시 안전 저장
    try {
      localStorage.setItem("gsc_analytics_config", JSON.stringify(configData));
    } catch (e) {}

    try {
      const res = await fetch("/api/analytics/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData)
      });
      if (res.ok) {
        alert("Google 연동 설정이 성공적으로 저장되었습니다.");
        onSaved();
        onClose();
      } else {
        const err = await res.json();
        alert(`저장 실패: ${err.detail || "알 수 없는 오류"}`);
      }
    } catch (err: any) {
      alert(`연결 오류: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0f0f15] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Google Search Console & AdSense 연동 설정</h2>
              <p className="text-xs text-gray-400">공식 API 연동 및 보안 키 관리</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">설정 로딩 중...</div>
        ) : (
          <div className="space-y-6 pt-5">
            {/* 보안 원칙 안내 */}
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200/90 leading-relaxed">
                <span className="font-semibold text-white">보안 및 무결성 원칙:</span> 사용자의 Google 인증 정보 및 민감 키는 프론트엔드에 저장되지 않고 서버 격리 환경에서만 안전하게 관리됩니다. 연동 전에는 투명하게 <span className="font-bold text-amber-300">DEMO 모드</span>로 표기됩니다.
              </div>
            </div>

            {/* 1. 대상 사이트 URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">대상 블로그 URL (Search Console 속성)</label>
              <input
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://s-elegant.tistory.com/"
                className="w-full px-3.5 py-2.5 bg-[#171722] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* 2. Google Search Console 연동 */}
            <div className="p-4 bg-[#14141e] border border-white/5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold">Google Search Console API</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={gscConnected}
                    onChange={(e) => setGscConnected(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0"
                  />
                  <span className={gscConnected ? "text-emerald-400 font-bold" : "text-gray-400"}>
                    {gscConnected ? "연동 활성화됨 (LIVE)" : "미연동 (DEMO 모드)"}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">GSC 서비스 계정 이메일</label>
                <input
                  type="text"
                  value={serviceAccountEmail}
                  onChange={(e) => setServiceAccountEmail(e.target.value)}
                  placeholder="seo-bot@project-id.iam.gserviceaccount.com"
                  className="w-full px-3 py-2 bg-[#1a1a27] border border-white/10 rounded-lg text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Google Search Console의 [설정] &gt; [사용자 및 권한]에 위 서비스 계정을 소유자 또는 읽기 권한자로 등록하면 안전하게 데이터가 동기화됩니다.
                </p>
              </div>
            </div>

            {/* 3. Google AdSense 연동 */}
            <div className="p-4 bg-[#14141e] border border-white/5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-amber-400" />
                  <span className="text-sm font-semibold">Google AdSense Management API</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={adsenseConnected}
                    onChange={(e) => setAdsenseConnected(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-0"
                  />
                  <span className={adsenseConnected ? "text-amber-400 font-bold" : "text-gray-400"}>
                    {adsenseConnected ? "연동 활성화됨 (LIVE)" : "미연동 (DEMO 모드)"}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">AdSense 게시자 ID (Publisher ID)</label>
                <input
                  type="text"
                  value={adsenseAccountId}
                  onChange={(e) => setAdsenseAccountId(e.target.value)}
                  placeholder="pub-1234567890123456"
                  className="w-full px-3 py-2 bg-[#1a1a27] border border-white/10 rounded-lg text-xs font-mono text-gray-300 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 AdSense 공식 v2 규격에 따라 전체 계정 및 도메인 단위의 예상 수익, 페이지 RPM, 노출 지표를 안전하게 집계합니다.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-6 mt-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
