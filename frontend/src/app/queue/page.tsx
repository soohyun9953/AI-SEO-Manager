"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  SendHorizontal, 
  CheckSquare, 
  Square, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ExternalLink, 
  Copy, 
  Eye, 
  Edit3, 
  ArrowUp, 
  ArrowDown, 
  AlertCircle, 
  Check, 
  Info, 
  FileText, 
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  Hash,
  Download,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import ExportModal, { ContentItem } from "@/components/ExportModal";
import ContentEditModal from "@/components/ContentEditModal";

export default function PublishQueuePage() {
  const [queueItems, setQueueItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 모달 제어
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // 실제 발행 완료 기록 모달
  const [recordModalItem, setRecordModalItem] = useState<ContentItem | null>(null);
  const [publishedUrlInput, setPublishedUrlInput] = useState("");
  const [recordSaving, setRecordSaving] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      // APPROVED 또는 SCHEDULED 상태의 글들을 대기열 순서 및 최신순으로 가져옴
      const res = await fetch("/api/contents?status=QUEUE&sort_by=queue_order&limit=50");
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // 전체 선택/해제 토글
  const toggleSelectAll = () => {
    if (selectedIds.length === queueItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(queueItems.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 일괄 승인 또는 상태 변경
  const handleBatchStatus = async (status: string) => {
    if (selectedIds.length === 0) {
      alert("선택된 콘텐츠가 없습니다.");
      return;
    }
    try {
      const res = await fetch("/api/contents/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_ids: selectedIds, status }),
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchQueue();
      } else {
        const err = await res.json();
        alert(err.detail || "일괄 처리 실패");
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    }
  };

  // 실제 발행 결과 기록 및 완료 처리
  const submitPublishRecord = async () => {
    if (!recordModalItem) return;
    if (!publishedUrlInput.trim()) {
      alert("실제 발행된 티스토리 글 URL을 입력해주세요. (예: https://s-elegant.tistory.com/12)");
      return;
    }
    
    setRecordSaving(true);
    try {
      const res = await fetch(`/api/contents/${recordModalItem.id}/publish-record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publish_type: "TISTORY_MANUAL",
          status: "SUCCESS",
          post_url: publishedUrlInput.trim(),
          message: "티스토리 수동 붙여넣기 발행 완료 확정"
        })
      });

      if (res.ok) {
        alert("✅ 실제 발행 완료가 정상 기록되었습니다! (PUBLISHED 상태 전환)");
        setRecordModalItem(null);
        setPublishedUrlInput("");
        fetchQueue();
      } else {
        const err = await res.json();
        alert(err.detail || "발행 결과 기록 실패");
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setRecordSaving(false);
    }
  };

  // SEO 검수 체크리스트 검증 함수
  const getSeoChecklist = (item: ContentItem) => {
    const text = item.content || "";
    const title = item.title || "";
    const kw = item.keyword || "";

    return [
      {
        name: "본문 길이 (1,000자 이상)",
        passed: text.length >= 1000,
        detail: `${text.length.toLocaleString()}자`
      },
      {
        name: "제목 내 핵심 키워드 포함",
        passed: Boolean(kw && title.toLowerCase().includes(kw.toLowerCase())),
        detail: kw
      },
      {
        name: "본문 내 소제목(H2, H3) 구조",
        passed: text.includes("## ") || text.includes("### "),
        detail: "소제목 구조 확보"
      },
      {
        name: "모바일 글머리 기호(-, *) 활용",
        passed: text.includes("\n- ") || text.includes("\n* "),
        detail: "가독성 리스트 구조"
      },
      {
        name: "카테고리 및 태그 지정",
        passed: Boolean(item.category && (item.tags || item.keyword)),
        detail: `${item.category} / ${item.tags || item.keyword}`
      }
    ];
  };

  const tistoryBlog = typeof window !== "undefined" ? localStorage.getItem("tistory_blog") || "s-elegant" : "s-elegant";

  return (
    <div className="flex flex-col gap-8 max-w-[1500px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 w-fit mb-3">
            <SendHorizontal size={14} className="text-purple-400" />
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-outfit">Publishing Queue & Verification</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">티스토리 발행 대기열</h1>
          <p className="text-gray-400 text-sm mt-1">
            발행 승인된 콘텐츠의 SEO 검수 체크리스트를 확인하고, 티스토리로 최종 발행한 결과를 기록합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contents"
            className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 text-xs font-bold border border-white/[0.05] transition-all"
          >
            ← 콘텐츠 관리로 돌아가기
          </Link>
          <a
            href={`https://${tistoryBlog}.tistory.com/manage/post`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all hover:scale-105 active:scale-95"
          >
            <ExternalLink size={14} />
            티스토리 글쓰기 새 창 열기
          </a>
        </div>
      </div>

      {/* 중요 고지 안내 배너 (원칙 5, 6 준수) */}
      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
        <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-bold text-blue-200">티스토리 발행 프로세스 및 예약 발행 안내</span>
          <p className="text-gray-400 leading-relaxed">
            • <strong>승인(APPROVED)과 실제 발행(PUBLISHED)은 명확히 구분</strong>됩니다. 실제 티스토리에 게재하신 후 생성된 URL을 기록하셔야 발행 완료로 전환됩니다.<br />
            • 현재 백엔드 자동 예약 스케줄러는 준비 중이며, 설정된 발행 예정일은 <strong>&apos;수동 발행 알림 예정일&apos;</strong>로 관리됩니다.
          </p>
        </div>
      </div>

      {/* 액션 컨트롤 바 */}
      <div className="glass-card p-4 rounded-2xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition-all"
          >
            {selectedIds.length === queueItems.length && queueItems.length > 0 ? (
              <CheckSquare size={16} className="text-purple-400" />
            ) : (
              <Square size={16} className="text-gray-500" />
            )}
            전체 선택 ({selectedIds.length}/{queueItems.length})
          </button>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchStatus("DRAFT")}
                className="px-3 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] text-xs font-bold text-gray-400 hover:text-white border border-white/[0.05] transition-all"
              >
                작성중(DRAFT)으로 되돌리기
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueue}
            className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-all"
            title="대기열 새로고침"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 대기열 목록 */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="glass-card p-16 text-center text-gray-500 text-xs">
            대기열 목록을 불러오는 중입니다...
          </div>
        ) : queueItems.length === 0 ? (
          <div className="glass-card p-16 text-center text-gray-500 flex flex-col items-center gap-3">
            <SendHorizontal size={36} className="opacity-20 text-purple-400" />
            <p className="text-sm font-medium text-gray-400">발행 대기열이 비어 있습니다.</p>
            <p className="text-xs text-gray-600 max-w-md">
              [콘텐츠 관리] 목록에서 승인할 콘텐츠를 선택해 &apos;발행 승인&apos; 상태로 변경하시면 이곳 대기열에 등록됩니다.
            </p>
            <Link
              href="/contents"
              className="mt-2 px-4 py-2 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold hover:bg-purple-600/30 transition-all"
            >
              콘텐츠 관리로 이동
            </Link>
          </div>
        ) : (
          queueItems.map((item, index) => {
            const checklist = getSeoChecklist(item);
            const passedCount = checklist.filter(c => c.passed).length;
            const isSelected = selectedIds.includes(item.id);

            return (
              <div 
                key={item.id} 
                className={`glass-card p-6 rounded-3xl border transition-all flex flex-col gap-6 relative overflow-hidden ${isSelected ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/[0.05]'}`}
              >
                
                {/* 상단 순서 및 제목 영역 */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className="mt-1 text-gray-500 hover:text-purple-400 transition-colors"
                    >
                      {isSelected ? <CheckSquare size={18} className="text-purple-400" /> : <Square size={18} />}
                    </button>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-mono text-[10px] font-bold border border-purple-500/20">
                          대기 #{index + 1}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 text-[10px] font-bold border border-blue-500/20">
                          {item.status}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          카테고리: <strong className="text-gray-300">{item.category || "일반"}</strong>
                        </span>
                        {item.scheduled_at && (
                          <span className="text-xs text-purple-300 flex items-center gap-1 font-mono">
                            <Calendar size={12} /> {new Date(item.scheduled_at).toLocaleString("ko-KR")} 예정
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
                        {item.title}
                      </h2>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                        <span>핵심 키워드: <strong className="text-purple-300">{item.keyword}</strong></span>
                        <span>태그: <strong className="text-gray-300">{item.tags || item.keyword}</strong></span>
                        <span>글자수: <strong className="text-white">{item.content.length.toLocaleString()}자</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* 우측 조작 액션 */}
                  <div className="flex items-center gap-2 ml-auto">
                    
                    {/* 미리보기 및 편집 */}
                    <button
                      onClick={() => { setActiveItem(item); setIsEditOpen(true); }}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Edit3 size={13} />
                      수정
                    </button>

                    {/* 복사 및 내보내기 */}
                    <button
                      onClick={() => { setActiveItem(item); setIsExportOpen(true); }}
                      className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Download size={13} />
                      복사/내보내기
                    </button>

                    {/* 실제 발행 완료 기록 버튼 */}
                    <button
                      onClick={() => {
                        setRecordModalItem(item);
                        setPublishedUrlInput(item.tistory_url || "");
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <CheckCircle2 size={14} />
                      발행 결과 기록
                    </button>

                  </div>
                </div>

                {/* 하단: SEO 검수 체크리스트 */}
                <div className="p-4 rounded-2xl bg-white/[0.015] border border-white/[0.04] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      SEO 사전 검수 체크리스트 ({passedCount}/{checklist.length} 충족)
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      SEO 품질점수: {item.seo_score || 0}점
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {checklist.map((check, cIdx) => (
                      <div 
                        key={cIdx} 
                        className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs transition-all ${check.passed ? 'bg-emerald-500/5 border-emerald-500/20 text-gray-300' : 'bg-red-500/5 border-red-500/20 text-gray-400'}`}
                      >
                        {check.passed ? (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                        )}
                        <span className="truncate text-[11px] font-medium">{check.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* 실제 발행 결과 기록 모달 */}
      {recordModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg glass-card border border-white/[0.08] rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-orange-400" size={18} />
                티스토리 실제 발행 결과 확정
              </h3>
              <button 
                onClick={() => setRecordModalItem(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              티스토리 블로그에 글을 등록하셨나요? 생성된 게시물의 최종 URL을 입력하시면 대기열에서 완료 처리되며 영속적 발행 이력에 저장됩니다.
            </p>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
              <span className="text-[10px] text-gray-500 font-bold block mb-1">발행 대상 글:</span>
              <span className="text-white font-semibold">{recordModalItem.title}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-gray-300 uppercase">티스토리 게시물 URL (필수)</label>
              <input
                type="text"
                value={publishedUrlInput}
                onChange={(e) => setPublishedUrlInput(e.target.value)}
                placeholder={`https://${tistoryBlog}.tistory.com/123`}
                className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRecordModalItem(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.03] text-gray-400 text-xs font-bold hover:text-white"
              >
                취소
              </button>
              <button
                onClick={submitPublishRecord}
                disabled={recordSaving}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-30"
              >
                {recordSaving ? "저장 중..." : "발행 완료 확정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 연동 */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        content={activeItem}
      />

      <ContentEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        content={activeItem}
        onSaved={fetchQueue}
      />

    </div>
  );
}
