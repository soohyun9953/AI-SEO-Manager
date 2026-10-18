"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Layout, 
  Tag, 
  Hash, 
  Globe, 
  FileText, 
  Eye,
  Loader2,
  Calendar,
  Send
} from "lucide-react";
import { ContentItem } from "./ExportModal";

interface ContentEditModalProps {
  content: ContentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ContentEditModal({ content, isOpen, onClose, onSaved }: ContentEditModalProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "history">("edit");
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [relatedKeywords, setRelatedKeywords] = useState("");
  const [category, setCategory] = useState("일반");
  const [articleContent, setArticleContent] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [tags, setTags] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [scheduledAt, setScheduledAt] = useState("");
  const [tistoryUrl, setTistoryUrl] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (content) {
      setTitle(content.title || "");
      setKeyword(content.keyword || "");
      setRelatedKeywords(content.related_keywords || "");
      setCategory(content.category || "일반");
      setArticleContent(content.content || "");
      setMetaDescription(content.meta_description || "");
      setTags(content.tags || "");
      setThumbnailUrl(content.thumbnail_url || "");
      setStatus(content.status || "DRAFT");
      setScheduledAt(content.scheduled_at || "");
      setTistoryUrl(content.tistory_url || "");
      setChangeSummary("");
      setSaveMessage(null);
      setActiveTab("edit");
    }
  }, [content]);

  useEffect(() => {
    if (activeTab === "history" && content) {
      fetchHistory();
    }
  }, [activeTab, content]);

  const fetchHistory = async () => {
    if (!content) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/contents/${content.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen || !content) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveMessage({ type: "error", text: "콘텐츠 제목을 입력해주세요." });
      return;
    }
    if (!articleContent.trim()) {
      setSaveMessage({ type: "error", text: "본문 내용을 입력해주세요." });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/contents/${content.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          keyword: keyword.trim(),
          related_keywords: relatedKeywords,
          category,
          content: articleContent,
          meta_description: metaDescription,
          tags,
          thumbnail_url: thumbnailUrl,
          status,
          scheduled_at: scheduledAt,
          tistory_url: tistoryUrl,
          change_summary: changeSummary.trim() || "내용 및 설정 수정"
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "수정에 실패했습니다.");
      }

      setSaveMessage({ type: "success", text: "성공적으로 저장되었습니다." });
      onSaved();
      setTimeout(() => {
        setSaveMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setSaveMessage({ type: "error", text: err.message || "저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl glass-card border border-white/[0.08] rounded-3xl p-7 shadow-2xl flex flex-col gap-6 max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
              <FileText className="text-purple-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight font-outfit">콘텐츠 상세 편집</h2>
              <p className="text-xs text-gray-400">제목, 본문, SEO 메타태그 및 발행 상태를 관리합니다.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/[0.05]">
              <button
                onClick={() => setActiveTab("edit")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'edit' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                편집
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                미리보기
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                수정 이력
              </button>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-white flex items-center justify-center transition-all ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab 1: Edit Form */}
        {activeTab === "edit" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 8 cols: Main Content */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">콘텐츠 제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-all font-semibold"
                  placeholder="제목을 입력하세요"
                />
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">마크다운 본문</label>
                  <span className="text-[11px] text-gray-500 font-mono">{articleContent.length.toLocaleString()}자</span>
                </div>
                <textarea
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  rows={16}
                  className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-2xl p-4 text-gray-200 text-xs font-mono focus:outline-none focus:border-purple-500 transition-all leading-relaxed resize-y custom-scrollbar"
                  placeholder="마크다운 형식의 본문을 작성하세요..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">수정 사유 (이력 관리용)</label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition-all placeholder:text-gray-600"
                  placeholder="예: 소제목 보강 및 키워드 밀도 개선"
                />
              </div>
            </div>

            {/* Right 4 cols: Metadata & Status Controls */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* 상태 관리 카드 */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">콘텐츠 상태</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                >
                  <option value="DRAFT">DRAFT (작성 중)</option>
                  <option value="REVIEW">REVIEW (검수 대기)</option>
                  <option value="APPROVED">APPROVED (발행 승인)</option>
                  <option value="SCHEDULED">SCHEDULED (발행 예약)</option>
                  <option value="PUBLISHING">PUBLISHING (발행 진행 중)</option>
                  <option value="PUBLISHED">PUBLISHED (발행 완료)</option>
                  <option value="FAILED">FAILED (발행 실패)</option>
                </select>
                <p className="text-[10px] text-gray-500 leading-tight">
                  * 실제 발행하지 않은 글을 임의로 PUBLISHED로 변경하지 마세요.
                </p>
              </div>

              {/* 분류 및 키워드 */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">키워드 및 카테고리</span>
                
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">핵심 키워드</span>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">카테고리</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="일반">일반</option>
                    <option value="금융/재테크">금융/재테크</option>
                    <option value="IT">IT</option>
                    <option value="AI">AI</option>
                    <option value="경제">경제</option>
                    <option value="건강">건강</option>
                    <option value="여행">여행</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">태그 (쉼표 구분)</span>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="태그1, 태그2, 태그3"
                    className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* 발행 정보 */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">티스토리 발행 정보</span>
                
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">발행 예정일</span>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">실제 발행된 게시물 URL</span>
                  <input
                    type="text"
                    value={tistoryUrl}
                    onChange={(e) => setTistoryUrl(e.target.value)}
                    placeholder="https://s-elegant.tistory.com/123"
                    className="w-full bg-[#0a0a0f] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-700"
                  />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Preview */}
        {activeTab === "preview" && (
          <div className="p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.05] min-h-[400px]">
            <h1 className="text-2xl font-bold text-white mb-6 border-b border-white/[0.08] pb-4">{title}</h1>
            <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-sm">
              {articleContent}
            </pre>
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === "history" && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <History size={16} className="text-purple-400" />
              수정 이력 로그 ({historyItems.length}건)
            </h3>
            {loadingHistory ? (
              <div className="p-8 flex items-center justify-center text-gray-500 text-xs">
                <Loader2 className="animate-spin mr-2" size={16} /> 이력 불러오는 중...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                기록된 수정 이력이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto custom-scrollbar">
                {historyItems.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">{item.change_summary || "수정"}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{new Date(item.created_at).toLocaleString("ko-KR")}</span>
                    </div>
                    <p className="text-xs text-gray-300 font-medium">{item.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notification feedback */}
        {saveMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {saveMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{saveMessage.text}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-mono">
            ID: {content.id.slice(0, 8)}... | 작성일: {new Date(content.created_at).toLocaleDateString("ko-KR")}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 text-xs font-bold transition-all"
            >
              닫기
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              변경사항 저장하기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
