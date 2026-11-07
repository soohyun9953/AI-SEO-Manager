"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Eye,
  FileText,
  Tag,
  Code2,
  Globe,
  AlertCircle,
  Trash2,
} from "lucide-react";
import StepProgressIndicator, { 단계_정보 } from "@/components/StepProgressIndicator";

const LOCAL_BACKEND = "http://localhost:8002";
const MAX_CHARS = 30000;

const 단계_목록: 단계_정보[] = [
  { id: 1, title: "원문 준비 및 Claude 연결", description: "내 PC의 크롬으로 Claude.ai에 접속 (최초 1회 로그인 필요)" },
  { id: 2, title: "Claude가 SEO에 맞게 수정", description: "사실은 유지하고 제목·구조·키워드·FAQ를 개선, 설명용 다이어그램을 직접 작성" },
  { id: 3, title: "다이어그램을 이미지로 변환", description: "안전하게 정제한 뒤 선명한 PNG 이미지로 변환해 본문에 삽입" },
  { id: 4, title: "티스토리 임시저장", description: "제목·본문·이미지·태그를 티스토리 에디터에 입력하고 임시저장 (발행은 직접)" },
];

interface ItPostResult {
  title: string;
  article: string;
  html_article: string;
  tags: string[];
  tags_string: string;
  meta_description: string;
  diagram_total: number;
  diagram_ok: number;
  tistory_saved: boolean;
  tistory_message: string;
}

export default function ItPostPage() {
  const [originalText, setOriginalText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [topicType, setTopicType] = useState<"it" | "finance">("it");
  const [category, setCategory] = useState("IT");
  const [tistoryBlog, setTistoryBlog] = useState("s-elegant");
  const [autoSave, setAutoSave] = useState(true);

  const [isLocal, setIsLocal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);

  const [result, setResult] = useState<ItPostResult | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "text" | "seo">("preview");
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocal(host === "localhost" || host === "127.0.0.1");
    const savedBlog = localStorage.getItem("tistory_blog");
    if (savedBlog) setTistoryBlog(savedBlog);
    const savedText = localStorage.getItem("it_post_original");
    if (savedText) setOriginalText(savedText);
    const savedKeyword = localStorage.getItem("it_post_keyword");
    if (savedKeyword) setKeyword(savedKeyword);
    if (localStorage.getItem("it_post_topic") === "finance") {
      setTopicType("finance");
      setCategory(localStorage.getItem("it_post_category") || "재테크");
    } else {
      setCategory(localStorage.getItem("it_post_category") || "IT");
    }
  }, []);

  const changeTopic = (type: "it" | "finance") => {
    setTopicType(type);
    // 카테고리가 기본값(IT/재테크)일 때만 자동으로 바꾼다 (직접 입력한 카테고리는 유지)
    if (category === "IT" || category === "재테크" || !category) setCategory(type === "finance" ? "재테크" : "IT");
    localStorage.setItem("it_post_topic", type);
  };

  const charCount = originalText.length;
  const tooShort = charCount > 0 && charCount < 100;
  const tooLong = charCount > MAX_CHARS;

  const handleGenerate = async () => {
    if (!isLocal) {
      alert("이 기능은 내 PC의 크롬으로 Claude와 티스토리를 조작하므로 로컬 서버(localhost:3000)에서만 사용할 수 있습니다.");
      return;
    }
    if (charCount < 100 || tooLong) {
      alert(`원문은 100자 이상 ${MAX_CHARS.toLocaleString()}자 이하로 입력해 주세요.`);
      return;
    }

    localStorage.setItem("it_post_original", originalText);
    localStorage.setItem("it_post_keyword", keyword);
    localStorage.setItem("tistory_blog", tistoryBlog);
    localStorage.setItem("it_post_category", category);

    setLoading(true);
    setCompleted(false);
    setResult(null);
    setStatusMsg("");
    setCurrentStep(1);
    setElapsed(0);

    let seconds = 0;
    const timer = setInterval(() => {
      seconds += 1;
      setElapsed(seconds);
      if (seconds === 8) setCurrentStep(2);
    }, 1000);

    try {
      // 로컬 백엔드를 직접 호출 (Next 개발 서버 프록시는 약 30초가 넘으면 응답 없이 끊긴다)
      const res = await fetch(`${LOCAL_BACKEND}/api/claude/it-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_text: originalText,
          keyword,
          category: category || (topicType === "finance" ? "재테크" : "IT"),
          topic_type: topicType,
          blog_name: tistoryBlog,
          auto_tistory_save: autoSave,
        }),
      });
      const raw = await res.text();
      let data: Partial<ItPostResult> & { detail?: string } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        if (!res.ok) throw new Error(`서버 처리 오류 (${res.status}): ${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.detail || `생성 실패 (${res.status})`);

      const done = data as ItPostResult;
      setResult(done);
      setActiveTab("preview");
      setCurrentStep(4);
      clearInterval(timer);
      setCompleted(true);
      setStatusMsg(
        autoSave
          ? done.tistory_saved
            ? `✅ 티스토리 임시저장 완료. 티스토리 관리 > 글 관리 > 임시저장에서 확인하고 발행하세요. (${done.tistory_message || ""})`
            : `⚠️ 글 수정은 완료됐지만 티스토리 임시저장에 실패했습니다: ${done.tistory_message}`
          : "글 수정이 완료됐습니다. 아래 결과를 확인하세요."
      );
    } catch (err) {
      setStatusMsg(`⚠️ ${err instanceof Error ? err.message : "처리 중 문제가 발생했습니다."}`);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  // 결과만 티스토리에 다시 임시저장 (이미 만든 글을 Claude 재호출 없이 저장)
  const saveToTistory = async () => {
    if (!result) return;
    setSaving(true);
    setStatusMsg("📝 티스토리 임시저장 진행 중... 크롬 창이 열립니다.");
    try {
      const res = await fetch(`${LOCAL_BACKEND}/api/tistory/auto-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          content_html: result.html_article,
          tags: result.tags,
          category: category || "IT",
          blog_name: tistoryBlog,
          meta_description: result.meta_description,
          action: "TEMP_SAVE",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatusMsg(`✅ 티스토리 임시저장 완료. 글 관리 > 임시저장에서 확인하고 발행하세요.`);
      } else {
        setStatusMsg(`⚠️ 티스토리 임시저장 실패: ${data.error || data.detail || data.message || `HTTP ${res.status}`}`);
      }
    } catch {
      setStatusMsg("⚠️ 로컬 백엔드(8002)에 연결할 수 없습니다. start.bat으로 서버를 켜 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  };

  const clearAll = () => {
    if (!confirm("입력한 원문과 생성 결과를 모두 지울까요?")) return;
    setOriginalText("");
    setKeyword("");
    setResult(null);
    setStatusMsg("");
    localStorage.removeItem("it_post_original");
    localStorage.removeItem("it_post_keyword");
  };

  const titleLen = result?.title.length ?? 0;
  const checklist = result
    ? [
        { ok: titleLen >= 15 && titleLen <= 38, text: `제목 길이 ${titleLen}자 (권장 35자 이내)` },
        { ok: result.diagram_ok >= 2, text: `다이어그램 ${result.diagram_ok}/${result.diagram_total}개 삽입` },
        { ok: result.tags.length >= 8, text: `태그 ${result.tags.length}개 (권장 10~15개)` },
        { ok: result.meta_description.length >= 60, text: `메타설명 ${result.meta_description.length}자 (권장 80~120자)` },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* 헤더 */}
      <div className="relative rounded-3xl overflow-hidden p-8 border border-white/[0.08] bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30 mb-3">
          <Cpu size={14} />
          <span>IT·재테크 글 · Claude · Tistory</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">IT·재테크 글 SEO 수정 + 다이어그램 (티스토리)</h1>
        <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
          IT·재테크 글 원문을 붙여넣으면 Claude가 <strong>사실은 그대로 두고</strong> 제목·소제목 구조·키워드·FAQ를 SEO에 맞게 다듬고,
          설명용 <strong>다이어그램을 직접 그려 이미지로 삽입</strong>한 뒤 티스토리에 <strong>임시저장</strong>까지 합니다. 발행은 직접 하세요.
        </p>
      </div>

      {!isLocal && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            현재 웹(클라우드)으로 접속 중입니다. 이 기능은 <strong>내 PC의 크롬</strong>으로 Claude와 티스토리를 조작하므로{" "}
            <strong>localhost:3000</strong>에서만 사용할 수 있습니다. (start.bat 실행 후 접속)
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 좌측: 입력 */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                1. 글 원문
              </h2>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={13} /> 비우기
              </button>
            </div>
            <textarea
              value={originalText}
              onChange={e => setOriginalText(e.target.value)}
              placeholder="수정할 글을 붙여넣으세요. 마크다운, 코드 블록, 표가 있으면 그대로 유지됩니다."
              rows={16}
              className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className={tooLong || tooShort ? "text-red-300" : "text-slate-400"}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}자 {tooShort && "· 100자 이상 필요"}
              </span>
              <span className="text-slate-500">원문에 없는 사실·수치는 추가하지 않습니다</span>
            </div>
          </div>

          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Tag size={18} className="text-purple-400" />
              2. 옵션
            </h2>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">글 주제</label>
              <div className="grid grid-cols-2 gap-2">
                {([{ id: "it", label: "💻 IT" }, { id: "finance", label: "💰 재테크·금융" }] as const).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => changeTopic(t.id)}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      topicType === t.id
                        ? "bg-blue-600/20 border-blue-500/60 text-white ring-1 ring-blue-500/40"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {topicType === "finance" && (
                <p className="text-[11px] text-amber-300/90 mt-1.5 leading-relaxed">
                  금리·수익률·세율 등 수치는 원문 그대로 유지하고, 매수·가입 권유와 수익 보장 표현은 만들지 않습니다. 글 끝에 면책 안내가 자동으로 붙습니다.
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">핵심 키워드 (선택, 비우면 Claude가 선택)</label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="예: REST API 설계"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">티스토리 카테고리</label>
                <input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="IT"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">블로그명 (서브도메인)</label>
                <input
                  value={tistoryBlog}
                  onChange={e => setTistoryBlog(e.target.value)}
                  placeholder="s-elegant"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={e => setAutoSave(e.target.checked)}
                className="mt-1 rounded bg-black/40 border-white/20 text-blue-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 leading-relaxed">
                수정이 끝나면 <strong>티스토리 임시저장</strong>까지 자동 실행 (발행은 하지 않음)
              </span>
            </label>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !isLocal || charCount < 100 || tooLong}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Claude가 작업 중... ({elapsed}초)</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>🧠 Claude로 SEO 수정 + 다이어그램 만들기</span>
              </>
            )}
          </button>
        </div>

        {/* 우측: 결과 */}
        <div className="lg:col-span-7">
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl flex flex-col min-h-[700px]">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                {(
                  [
                    { id: "preview", label: "미리보기", icon: <Eye size={14} /> },
                    { id: "html", label: "HTML", icon: <Code2 size={14} /> },
                    { id: "text", label: "텍스트", icon: <FileText size={14} /> },
                    { id: "seo", label: "태그 & 점검", icon: <Tag size={14} /> },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === tab.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              {result && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => copy(result.title, "title")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] text-xs font-semibold transition-all"
                  >
                    {copied === "title" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied === "title" ? "복사완료" : "제목 복사"}
                  </button>
                  <button
                    onClick={saveToTistory}
                    disabled={saving || !isLocal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/30 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                    {saving ? "임시저장 중..." : "티스토리 임시저장"}
                  </button>
                </div>
              )}
            </div>

            {statusMsg && (
              <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[12px] text-slate-200 leading-relaxed">
                {statusMsg}
              </div>
            )}

            <div className="flex-1 py-5 overflow-y-auto max-h-[800px]">
              {loading ? (
                <StepProgressIndicator
                  steps={단계_목록}
                  current_step={currentStep}
                  is_completed={completed}
                  elapsed_seconds={elapsed}
                  sub_message="Claude가 글을 수정하고 다이어그램을 그리고 있습니다 (보통 1~3분)"
                  tip_message={
                    currentStep === 1
                      ? "새로 열린 크롬 창에서 Claude.ai 로그인이 필요하면 로그인을 완료해 주세요. 완료되면 자동으로 이어서 진행합니다."
                      : "작업 중에는 열린 크롬 창을 조작하지 마세요."
                  }
                />
              ) : !result ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-20 gap-2">
                  <Cpu size={36} className="text-slate-600" />
                  <p className="text-sm">원문을 입력하고 시작하면 결과가 이곳에 표시됩니다.</p>
                </div>
              ) : (
                <>
                  {activeTab === "preview" && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 leading-relaxed">
                        <strong>{result.title}</strong>
                        <p className="text-blue-200/70 mt-1">{result.meta_description}</p>
                      </div>
                      <div className="p-6 rounded-2xl bg-white text-slate-900">
                        <div dangerouslySetInnerHTML={{ __html: result.html_article }} />
                      </div>
                    </div>
                  )}
                  {activeTab === "html" && (
                    <div className="space-y-2">
                      <button
                        onClick={() => copy(result.html_article, "html")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] text-xs font-semibold"
                      >
                        {copied === "html" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copied === "html" ? "복사완료" : "HTML 복사"}
                      </button>
                      <pre className="p-4 rounded-2xl bg-black/50 border border-white/[0.06] text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap break-all max-h-[560px]">
                        {result.html_article.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, "data:image/png;base64,…(이미지)")}
                      </pre>
                    </div>
                  )}
                  {activeTab === "text" && (
                    <div className="space-y-2">
                      <button
                        onClick={() => copy(result.article, "text")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] text-xs font-semibold"
                      >
                        {copied === "text" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copied === "text" ? "복사완료" : "텍스트 복사"}
                      </button>
                      <textarea
                        readOnly
                        value={result.article}
                        rows={22}
                        className="w-full p-4 rounded-2xl bg-black/50 border border-white/[0.06] text-xs text-slate-200 leading-relaxed"
                      />
                    </div>
                  )}
                  {activeTab === "seo" && (
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-slate-300">태그 ({result.tags.length}개)</h3>
                          <button
                            onClick={() => copy(result.tags.join(", "), "tags")}
                            className="flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200"
                          >
                            {copied === "tags" ? <Check size={13} /> : <Copy size={13} />} 태그 복사
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.tags.map(t => (
                            <span key={t} className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] text-slate-300">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-300 mb-2">발행 전 점검</h3>
                        <ul className="space-y-1.5">
                          {checklist.map(item => (
                            <li key={item.text} className="flex items-center gap-2 text-xs">
                              <span className={item.ok ? "text-green-400" : "text-amber-400"}>{item.ok ? "✔" : "△"}</span>
                              <span className="text-slate-300">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                          발행 전에 수치(금리·수익률·세율·버전 등)와 코드가 원문과 같은지, 다이어그램 내용이 맞는지 꼭 확인하세요.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
