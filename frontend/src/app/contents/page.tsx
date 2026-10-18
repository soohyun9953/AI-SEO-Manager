"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  FolderKanban, 
  Search, 
  Filter, 
  Plus, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  SendHorizontal, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Layers, 
  ArrowUpDown, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Sparkles,
  PenTool,
  Bot
} from "lucide-react";
import Link from "next/link";
import ExportModal, { ContentItem } from "@/components/ExportModal";
import ContentEditModal from "@/components/ContentEditModal";
import AutoRegisterModal from "@/components/AutoRegisterModal";

export default function ContentsManagementPage() {
  const [stats, setStats] = useState({
    total: 0,
    DRAFT: 0,
    REVIEW: 0,
    APPROVED: 0,
    SCHEDULED: 0,
    PUBLISHING: 0,
    PUBLISHED: 0,
    FAILED: 0,
    queue_ready: 0
  });

  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 모달 상태
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [autoRegisterContent, setAutoRegisterContent] = useState<ContentItem | null>(null);


  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/contents/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("통계 조회 실패", e);
    }
  }, []);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        keyword: searchQuery,
        sort_by: sortBy,
        page: page.toString(),
        limit: "10"
      });
      const res = await fetch(`/api/contents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setContents(items);
        setTotalPages(data.total_pages || 1);
        const count = data.total || items.length;
        setTotalCount(count);

        // 통계 보정: 서버 stats가 0이더라도 가져온 목록 기반으로 통계 즉시 갱신
        if (items.length > 0) {
          setStats(prev => {
            const draftCnt = items.filter((i: any) => i.status === "DRAFT").length;
            const reviewCnt = items.filter((i: any) => i.status === "REVIEW").length;
            const approvedCnt = items.filter((i: any) => i.status === "APPROVED").length;
            const scheduledCnt = items.filter((i: any) => i.status === "SCHEDULED").length;
            const publishedCnt = items.filter((i: any) => i.status === "PUBLISHED").length;
            const failedCnt = items.filter((i: any) => i.status === "FAILED").length;
            return {
              total: Math.max(prev.total, count, items.length),
              DRAFT: Math.max(prev.DRAFT, draftCnt),
              REVIEW: Math.max(prev.REVIEW, reviewCnt),
              APPROVED: Math.max(prev.APPROVED, approvedCnt),
              SCHEDULED: Math.max(prev.SCHEDULED, scheduledCnt),
              PUBLISHING: prev.PUBLISHING,
              PUBLISHED: Math.max(prev.PUBLISHED, publishedCnt),
              FAILED: Math.max(prev.FAILED, failedCnt),
              queue_ready: Math.max(prev.queue_ready, approvedCnt + scheduledCnt)
            };
          });
        }
      }
    } catch (e) {
      console.error("콘텐츠 목록 조회 실패", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, sortBy, page]);

  useEffect(() => {
    fetchStats();
    fetchContents();
  }, [fetchStats, fetchContents]);

  const handleStatusChange = async (contentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/contents/${contentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchStats();
        fetchContents();
      } else {
        const err = await res.json();
        alert(err.detail || "상태 변경 실패");
      }
    } catch (e) {
      console.error(e);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (contentId: string, title: string) => {
    if (!confirm(`정말 '${title}' 콘텐츠를 삭제하시겠습니까? (이력도 함께 삭제됩니다)`)) {
      return;
    }
    try {
      const res = await fetch(`/api/contents/${contentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchStats();
        fetchContents();
      } else {
        const err = await res.json();
        alert(err.detail || "삭제 실패");
      }
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">DRAFT (작성중)</span>;
      case "REVIEW":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">REVIEW (검수대기)</span>;
      case "APPROVED":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">APPROVED (발행승인)</span>;
      case "SCHEDULED":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">SCHEDULED (발행예약)</span>;
      case "PUBLISHING":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">PUBLISHING (진행중)</span>;
      case "PUBLISHED":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PUBLISHED (발행완료)</span>;
      case "FAILED":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">FAILED (발행실패)</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1500px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Header Section */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 w-fit mb-3">
            <FolderKanban size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-outfit">Content Operations Center</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">콘텐츠 관리 대시보드</h1>
          <p className="text-gray-400 text-sm mt-1">생성된 원고의 검수, 상태 관리, 발행 준비 및 히스토리를 영속적으로 관리합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="px-4 py-2.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-2 transition-all"
          >
            <PenTool size={14} /> 새 원고 쓰기
          </Link>
          <Link
            href="/queue"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
          >
            <SendHorizontal size={14} /> 발행 대기열 열기
          </Link>
        </div>
      </div>

      {/* 6개 통계 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* 1. 전체 콘텐츠 수 */}
        <div 
          onClick={() => { setStatusFilter("ALL"); setPage(1); }}
          className={`glass-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:border-white/[0.15] ${statusFilter === 'ALL' ? 'border-blue-500/40 bg-blue-500/5' : ''}`}
        >
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">전체 콘텐츠</span>
            <Layers size={16} className="text-blue-400" />
          </div>
          <span className="text-2xl font-bold font-outfit text-white">{stats.total}</span>
          <span className="text-[10px] text-gray-500">등록된 모든 원고</span>
        </div>

        {/* 2. 작성 중인 콘텐츠 수 */}
        <div 
          onClick={() => { setStatusFilter("DRAFT"); setPage(1); }}
          className={`glass-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:border-white/[0.15] ${statusFilter === 'DRAFT' ? 'border-gray-500/40 bg-gray-500/5' : ''}`}
        >
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">작성 중</span>
            <Clock size={16} className="text-gray-400" />
          </div>
          <span className="text-2xl font-bold font-outfit text-gray-300">{stats.DRAFT}</span>
          <span className="text-[10px] text-gray-500">DRAFT 상태</span>
        </div>

        {/* 3. 검수 대기 콘텐츠 수 */}
        <div 
          onClick={() => { setStatusFilter("REVIEW"); setPage(1); }}
          className={`glass-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:border-white/[0.15] ${statusFilter === 'REVIEW' ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
        >
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-bold uppercase tracking-wider">검수 대기</span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-outfit text-amber-400">{stats.REVIEW}</span>
          <span className="text-[10px] text-gray-500">검토 및 최종 확인 필요</span>
        </div>

        {/* 4. 발행 대기 (승인+예약) */}
        <div 
          onClick={() => { setStatusFilter("QUEUE"); setPage(1); }}
          className={`glass-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:border-white/[0.15] ${statusFilter === 'QUEUE' ? 'border-purple-500/40 bg-purple-500/5' : ''}`}
        >
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-xs font-bold uppercase tracking-wider">발행 대기</span>
            <SendHorizontal size={16} className="text-purple-400" />
          </div>
          <span className="text-2xl font-bold font-outfit text-purple-300">{stats.queue_ready}</span>
          <span className="text-[10px] text-gray-500">승인({stats.APPROVED}) + 예약({stats.SCHEDULED})</span>
        </div>

        {/* 5. 발행 완료 콘텐츠 수 */}
        <div 
          onClick={() => { setStatusFilter("PUBLISHED"); setPage(1); }}
          className={`glass-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:border-white/[0.15] ${statusFilter === 'PUBLISHED' ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}
        >
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">발행 완료</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-outfit text-emerald-400">{stats.PUBLISHED}</span>
          <span className="text-[10px] text-gray-500">티스토리 게재 확정</span>
        </div>

        {/* 6. 발행 실패 콘텐츠 수 */}
        <div 
          onClick={() => { setStatusFilter("FAILED"); setPage(1); }}
          className={`glass-card p-4 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:border-white/[0.15] ${statusFilter === 'FAILED' ? 'border-red-500/40 bg-red-500/5' : ''}`}
        >
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-bold uppercase tracking-wider">발행 실패</span>
            <XCircle size={16} className="text-red-400" />
          </div>
          <span className="text-2xl font-bold font-outfit text-red-400">{stats.FAILED}</span>
          <span className="text-[10px] text-gray-500">발행 오류 건</span>
        </div>

      </div>

      {/* 필터 및 검색 컨트롤 바 */}
      <div className="glass-card p-4 rounded-2xl flex items-center justify-between flex-wrap gap-4">
        
        {/* 상태 필터 탭 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "ALL", label: "전체" },
            { id: "DRAFT", label: "작성중" },
            { id: "REVIEW", label: "검수대기" },
            { id: "QUEUE", label: "발행대기" },
            { id: "PUBLISHED", label: "발행완료" },
            { id: "FAILED", label: "발행실패" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${statusFilter === tab.id ? 'bg-blue-600 text-white shadow' : 'bg-white/[0.02] text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 검색 및 정렬 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="제목, 키워드, 태그 검색..."
              className="bg-[#0a0a0f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-all w-60"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-gray-400">
            <ArrowUpDown size={12} className="text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="created_at_desc" className="bg-[#0a0a0f]">최신 작성일순</option>
              <option value="updated_at_desc" className="bg-[#0a0a0f]">최종 수정일순</option>
              <option value="title_asc" className="bg-[#0a0a0f]">제목 가나다순</option>
            </select>
          </div>

          <button
            onClick={() => { fetchStats(); fetchContents(); }}
            className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-all"
            title="새로고침"
          >
            <RefreshCw size={14} />
          </button>
        </div>

      </div>

      {/* 콘텐츠 목록 테이블 */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.05]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.01] text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5 whitespace-nowrap min-w-[220px]">콘텐츠 제목</th>
                <th className="py-4 px-4 whitespace-nowrap min-w-[140px] max-w-[220px]">핵심 키워드</th>
                <th className="py-4 px-4 whitespace-nowrap">카테고리</th>
                <th className="py-4 px-4 whitespace-nowrap">상태</th>
                <th className="py-4 px-4 whitespace-nowrap">작성일 / 수정일</th>
                <th className="py-4 px-4 whitespace-nowrap">발행 정보</th>
                <th className="py-4 px-5 text-right whitespace-nowrap">관리 작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : contents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <p className="text-sm font-medium mb-2">등록된 콘텐츠가 없습니다.</p>
                    <p className="text-xs text-gray-600">SEO 라이터 또는 자동 글작성에서 새 글을 작성한 후 저장해보세요.</p>
                  </td>
                </tr>
              ) : (
                contents.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    
                    {/* 제목 */}
                    <td className="py-4 px-5 min-w-[220px] max-w-sm">
                      <div className="flex flex-col gap-1">
                        <span 
                          onClick={() => { setSelectedContent(item); setIsEditOpen(true); }}
                          className="font-bold text-white hover:text-purple-400 cursor-pointer line-clamp-1 transition-colors"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {item.content.length.toLocaleString()}자 | SEO 점수: {item.seo_score || 0}점
                        </span>
                      </div>
                    </td>

                    {/* 키워드 (긴 키워드 truncate 처리) */}
                    <td className="py-4 px-4 max-w-[220px]">
                      <span 
                        title={item.keyword}
                        className="inline-block max-w-full truncate px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 font-medium text-[11px] border border-purple-500/20"
                      >
                        {item.keyword}
                      </span>
                    </td>

                    {/* 카테고리 */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="text-gray-300 font-medium">
                        {item.category || "일반"}
                      </span>
                    </td>

                    {/* 상태 */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* 작성일 / 수정일 */}
                    <td className="py-4 px-4 whitespace-nowrap text-gray-400 text-[11px]">
                      <div>{new Date(item.created_at).toLocaleDateString("ko-KR")}</div>
                      <div className="text-[10px] text-gray-600">{new Date(item.updated_at).toLocaleDateString("ko-KR")} 수정</div>
                    </td>

                    {/* 발행 정보 */}
                    <td className="py-4 px-4 max-w-[200px] text-[11px]">
                      {item.tistory_url ? (
                        <a
                          href={item.tistory_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium truncate"
                        >
                          <ExternalLink size={12} className="shrink-0" />
                          {item.tistory_url.replace("https://", "")}
                        </a>
                      ) : item.scheduled_at ? (
                        <span className="text-purple-300 flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(item.scheduled_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>

                    {/* 관리 작업 액션 버튼들 */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        
                        {/* 상세/편집 */}
                        <button
                          onClick={() => { setSelectedContent(item); setIsEditOpen(true); }}
                          className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-all"
                          title="상세 보기 및 편집"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* 복사/내보내기 */}
                        <button
                          onClick={() => { setSelectedContent(item); setIsExportOpen(true); }}
                          className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all"
                          title="복사 및 파일 내보내기"
                        >
                          <Download size={14} />
                        </button>

                        {/* 티스토리 브라우저 자동 등록 (Playwright 봇) */}
                        <button
                          onClick={() => setAutoRegisterContent(item)}
                          className="p-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-all"
                          title="티스토리 브라우저 자동 등록 (Playwright 봇)"
                        >
                          <Bot size={14} />
                        </button>

                        {/* 발행 승인 (대기열 추가) */}
                        {item.status !== "APPROVED" && item.status !== "PUBLISHED" && (
                          <button
                            onClick={() => handleStatusChange(item.id, "APPROVED")}
                            className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all"
                            title="발행 승인 (대기열로 전송)"
                          >
                            <SendHorizontal size={14} />
                          </button>
                        )}


                        {/* 삭제 */}
                        <button
                          onClick={() => handleDelete(item.id, item.title)}
                          className="p-2 rounded-xl bg-white/[0.02] hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                          title="콘텐츠 삭제"
                        >
                          <Trash2 size={14} />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="p-4 border-t border-white/[0.05] flex items-center justify-between text-xs text-gray-400 flex-wrap gap-3">
          <span>총 <strong>{totalCount}</strong>개의 콘텐츠</span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] disabled:opacity-20 text-gray-300 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-white px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] disabled:opacity-20 text-gray-300 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* 모달 연동 */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        content={selectedContent}
      />

      <ContentEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        content={selectedContent}
        onSaved={() => {
          fetchStats();
          fetchContents();
        }}
      />

      <AutoRegisterModal
        isOpen={!!autoRegisterContent}
        onClose={() => setAutoRegisterContent(null)}
        contentId={autoRegisterContent?.id || ""}
        title={autoRegisterContent?.title || ""}
        category={autoRegisterContent?.category || "맛집/카페"}
        onSuccess={() => {
          fetchStats();
          fetchContents();
        }}
      />
    </div>

  );
}
