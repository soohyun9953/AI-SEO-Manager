"use client";

import { useState } from "react";
import { 
  X, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  ShieldCheck, 
  Eye, 
  Send,
  HelpCircle
} from "lucide-react";

interface AutoRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  title: string;
  category?: string;
  onSuccess?: (result: any) => void;
}

export default function AutoRegisterModal({
  isOpen,
  onClose,
  contentId,
  title,
  category = "맛집/카페",
  onSuccess
}: AutoRegisterModalProps) {
  const [publishAction, setPublishAction] = useState<"TEMP_SAVE" | "CONFIRM_BEFORE_PUBLISH" | "PUBLISH">("TEMP_SAVE");
  const [blogName, setBlogName] = useState(
    typeof window !== "undefined" ? localStorage.getItem("tistory_blog") || "s-elegant" : "s-elegant"
  );
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStart = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch("/api/publish/auto-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          publish_action: publishAction,
          blog_name: blogName,
          force: force
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "자동 등록 실행 실패");
      }

      setResult(data);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "자동 등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-[#0d0d14] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                티스토리 브라우저 자동 등록
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                  Playwright Engine
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                실제 크롬 브라우저를 띄워 에디터에 원고를 자동 주입합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 콘텐츠 */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* 등록 대상 콘텐츠 정보 */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>대상 블로그: <strong className="text-white">{blogName}.tistory.com</strong></span>
              <span className="text-orange-400">카테고리: {category}</span>
            </div>
            <p className="text-sm font-semibold text-white truncate mt-0.5">
              {title}
            </p>
          </div>

          {/* 실행 완료 상태 뷰 */}
          {result && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 size={18} />
                <span>티스토리 자동 등록 완료!</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {result.message || "티스토리 편집기에 성공적으로 등록되었습니다."}
              </p>
              {result.post_url && (
                <a
                  href={result.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all w-full mt-1"
                >
                  <ExternalLink size={13} />
                  <span>발행된 글 확인하러 가기</span>
                </a>
              )}
              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-emerald-500/20">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* 오류 상태 뷰 */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertCircle size={18} />
                <span>자동 등록 중 문제가 발생했습니다</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-mono">
                {errorMsg}
              </p>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-gray-300"
                >
                  다시 설정
                </button>
              </div>
            </div>
          )}

          {/* 실행 폼 (결과가 없을 때) */}
          {!result && !errorMsg && (
            <>
              {/* 등록 정책 선택 */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-orange-400" />
                  <span>자동화 등록 정책 선택</span>
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* 옵션 1: 임시저장 (안전 기본값) */}
                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      publishAction === "TEMP_SAVE"
                        ? "bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/5"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="publishAction"
                      value="TEMP_SAVE"
                      checked={publishAction === "TEMP_SAVE"}
                      onChange={() => setPublishAction("TEMP_SAVE")}
                      className="mt-1 text-orange-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          🛡️ 안전 모드: [임시저장] 완료 (강력 추천)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 font-semibold">
                          기본값
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        티스토리 에디터에 제목, 본문, 사진, 태그를 입력하고 <strong>[임시저장]</strong>까지만 안전하게 수행합니다.
                      </p>
                    </div>
                  </label>

                  {/* 옵션 2: 최종 검토 대기 */}
                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      publishAction === "CONFIRM_BEFORE_PUBLISH"
                        ? "bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/5"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="publishAction"
                      value="CONFIRM_BEFORE_PUBLISH"
                      checked={publishAction === "CONFIRM_BEFORE_PUBLISH"}
                      onChange={() => setPublishAction("CONFIRM_BEFORE_PUBLISH")}
                      className="mt-1 text-blue-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Eye size={13} className="text-blue-400" />
                        👁️ 검토 모드: [브라우저 확인 후 발행]
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        모든 내용을 에디터에 입력해 두고 브라우저를 유지합니다. 사용자가 직접 최종 확인 후 [발행]을 누릅니다.
                      </p>
                    </div>
                  </label>

                  {/* 옵션 3: 즉시 공개 발행 */}
                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      publishAction === "PUBLISH"
                        ? "bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="publishAction"
                      value="PUBLISH"
                      checked={publishAction === "PUBLISH"}
                      onChange={() => setPublishAction("PUBLISH")}
                      className="mt-1 text-emerald-500 focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Send size={13} className="text-emerald-400" />
                        🚀 직접 발행 모드: [공개 발행까지 완전 자동]
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        완료 레이어를 열어 [공개 발행] 버튼까지 완전히 자동으로 클릭합니다. (사전 승인된 글만 권장)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 중복 발행 강제 재시도 옵션 */}
              <div className="flex items-center gap-2 pt-1 text-xs text-gray-400">
                <input
                  type="checkbox"
                  id="force_retry"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 bg-white/[0.05] border-white/[0.2]"
                />
                <label htmlFor="force_retry" className="cursor-pointer">
                  이미 발행된 이력이 있더라도 강제 재등록
                </label>
              </div>

              {/* 보안 및 로그인 안내 */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-gray-400 flex items-start gap-2.5">
                <HelpCircle size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-gray-200">안내 사항</p>
                  <p>• 실행 시 실제 크롬 창이 뜨며 글이 작성되는 과정을 실시간으로 보실 수 있습니다.</p>
                  <p>• 최초 1회 실행 시 카카오 로그인을 요구할 수 있습니다. 브라우저에서 로그인하시면 이후 세션이 영구 보존됩니다.</p>
                  <p>• 비밀번호나 개인정보는 서버에 전혀 저장되지 않습니다.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        {!result && (
          <div className="p-5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white text-xs font-semibold border border-white/[0.06] transition-all disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>크롬 브라우저 실행 및 글 등록 중...</span>
                </>
              ) : (
                <>
                  <Bot size={14} />
                  <span>티스토리 자동 등록 시작</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
