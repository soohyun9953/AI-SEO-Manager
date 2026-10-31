"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle, ShieldAlert, Globe, DollarSign, RefreshCw } from "lucide-react";

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
}

const ENV_GUIDE = `GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GSC_SITE_URL=https://s-elegant.tistory.com/
ADSENSE_ACCOUNT_ID=pub-XXXXXXXXXXXXXXXX`;

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
      <CheckCircle2 size={14} /> 연동됨 (LIVE)
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
      <XCircle size={14} /> 미연동 (DEMO)
    </span>
  );
}

export default function AnalyticsSettingsModal({ isOpen, onClose, onSaved }: AnalyticsSettingsModalProps) {
  const [status, setStatus] = useState<ConnectionStatus>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/analytics/settings");
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
    if (isOpen) loadStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  const anyConnected = Boolean(status.gsc_connected || status.adsense_connected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0f0f15] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Google Search Console & AdSense 연동 상태</h2>
              <p className="text-xs text-gray-400">서버 환경변수 기준의 실제 연동 여부입니다</p>
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
          <div className="py-12 text-center text-gray-400 text-sm">연동 상태 확인 중...</div>
        ) : failed ? (
          <div className="py-12 text-center text-red-300 text-sm">연동 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
        ) : (
          <div className="space-y-5 pt-5">
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200/90 leading-relaxed">
                인증 정보(토큰·시크릿)는 화면에서 입력하지 않고 서버 환경변수로만 관리합니다. 환경변수가 없거나 조회에 실패하면{" "}
                <span className="font-bold text-amber-300">DEMO(샘플) 모드</span>로 표시됩니다.
              </div>
            </div>

            <div className="p-4 bg-[#14141e] border border-white/5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold">Google Search Console</span>
                </div>
                <StatusBadge ok={Boolean(status.gsc_connected)} />
              </div>
              <p className="text-xs text-gray-400 font-mono break-all">속성: {status.site_url || "미설정"}</p>
            </div>

            <div className="p-4 bg-[#14141e] border border-white/5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-amber-400" />
                  <span className="text-sm font-semibold">Google AdSense</span>
                </div>
                <StatusBadge ok={Boolean(status.adsense_connected)} />
              </div>
              <p className="text-xs text-gray-400 font-mono break-all">게시자 ID: {status.adsense_account_id || "미설정"}</p>
            </div>

            {!anyConnected && (
              <div className="space-y-2">
                <p className="text-xs text-gray-300 font-semibold">연동 방법</p>
                <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1 leading-relaxed">
                  <li>backend 폴더에서 <span className="font-mono text-gray-300">python google_auth_setup.py 클라이언트ID 클라이언트시크릿</span> 실행</li>
                  <li>출력된 값을 <span className="font-mono text-gray-300">backend/.env</span>에 저장</li>
                  <li>배포 환경(Vercel)은 같은 값을 환경변수에 등록하고 재배포</li>
                </ol>
                <pre className="p-3 bg-[#0a0a10] border border-white/5 rounded-lg text-[11px] text-gray-400 overflow-x-auto">{ENV_GUIDE}</pre>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-6 mt-6 border-t border-white/10">
          <button
            onClick={loadStatus}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
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
            닫고 데이터 새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
