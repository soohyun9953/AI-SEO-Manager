"use client";

import { useState, useRef, useMemo } from "react";
import {
  Compass,
  MapPin,
  ExternalLink,
  Camera,
  Upload,
  Trash2,
  Copy,
  Sparkles,
  Loader2,
  Eye,
  FileText,
  Tag,
  Star,
  RefreshCw,
  Check,
  PenLine,
  AlertCircle,
} from "lucide-react";
import StepProgressIndicator, { 단계_정보 } from "@/components/StepProgressIndicator";
import { compress_image_file } from "@/utils/imageCompressor";
import { 기본_상호명, 기본_위치, 기본_지도링크, 기본_카테고리, 기본_샘플_사진 } from "@/utils/sampleData";

const 네이버_단계_목록: 단계_정보[] = [
  {
    id: 1,
    title: "방문 정보 및 사진 설명 정리",
    description: "입력한 장소 정보와 사진 설명을 네이버 블로그 작성용 프롬프트로 구성",
  },
  {
    id: 2,
    title: "네이버 검색 노출 구조 설계",
    description: "핵심 키워드 배치, 소제목 구성, 사진 배치 위치를 네이버 블로그 기준으로 설계",
  },
  {
    id: 3,
    title: "Gemini 2.5 Flash 후기 원고 집필",
    description: "입력된 정보만 사용해 사실 기반의 생생한 내돈내산 후기 작성 (지어낸 정보 금지)",
  },
  {
    id: 4,
    title: "사진 삽입 및 서식 완성",
    description: "사진 위치 마커를 실제 사진으로 치환하고 복사용 서식 완성",
  },
];

const NAVER_WRITE_URL = "https://blog.naver.com/GoBlogWrite.naver";
const MAX_PHOTOS = 10;

const CATEGORIES = [
  { id: "맛집/카페", label: "🍽️ 맛집 / 카페" },
  { id: "여행/나들이", label: "✈️ 여행 / 명소" },
  { id: "숙소/호텔", label: "🏨 숙소 / 호캉스" },
  { id: "문화/전시", label: "🎨 문화 / 팝업" },
  { id: "생활/체험", label: "✨ 일상 / 체험" },
];

interface PhotoItem {
  id: string;
  dataUrl: string;
  caption: string;
  fileName: string;
  fileSize?: string;
}

export default function NaverReviewWriterPage() {
  // 입력 폼
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("맛집/카페");
  const [location, setLocation] = useState("");
  const [placeUrl, setPlaceUrl] = useState("");
  const [keyInfo, setKeyInfo] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [rating, setRating] = useState("5.0");

  // 사진
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 생성 상태 및 결과
  const [loading, setLoading] = useState(false);
  const [current_step, set_current_step] = useState(1);
  const [elapsed_seconds, set_elapsed_seconds] = useState(0);
  const [is_step_completed, set_is_step_completed] = useState(false);
  const [title, setTitle] = useState("");
  const [article, setArticle] = useState("");
  const [htmlArticle, setHtmlArticle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [resultPhotos, setResultPhotos] = useState<PhotoItem[]>([]);

  // UI
  const [activeTab, setActiveTab] = useState<"preview" | "text" | "seo">("preview");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const loadSampleData = () => {
    setPlaceName(기본_상호명);
    setCategory(기본_카테고리);
    setLocation(기본_위치);
    setPlaceUrl(기본_지도링크);
    setKeyInfo("");
    setSpecialNotes("매장에서 직접 로스팅하는 스페셜티 커피 전문점. 광교 호수공원 인근 여유로운 분위기.");
    setPhotos([기본_샘플_사진]);
  };

  const resetForm = () => {
    if (!confirm("작성 중인 정보와 생성 결과를 모두 초기화하시겠습니까?")) return;
    setPlaceName("");
    setLocation("");
    setPlaceUrl("");
    setKeyInfo("");
    setSpecialNotes("");
    setPhotos([]);
    setTitle("");
    setArticle("");
    setHtmlArticle("");
    setTags([]);
    setSummary("");
    setCharCount(0);
    setResultPhotos([]);
  };

  // 사진 처리 (클라이언트에서 압축, 서버에는 사진 설명만 전송)
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있습니다. (현재 ${photos.length}장 / 추가 선택 ${files.length}장)`);
      return;
    }
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (!file.type.startsWith("image/")) {
        alert(`${file.name}은(는) 이미지 파일이 아닙니다.`);
        continue;
      }
      try {
        const { data_url, file_size_str } = await compress_image_file(file, 1280, 0.8);
        const newPhoto: PhotoItem = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${index}`,
          dataUrl: data_url,
          caption: `${placeName || "방문 장소"} 현장 컷 #${photos.length + index + 1}`,
          fileName: file.name,
          fileSize: file_size_str,
        };
        setPhotos(prev => [...prev, newPhoto]);
      } catch (err) {
        console.error("Image compression error:", err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const removePhoto = (id: string) => setPhotos(prev => prev.filter(p => p.id !== id));
  const updateCaption = (id: string, caption: string) =>
    setPhotos(prev => prev.map(p => (p.id === id ? { ...p, caption } : p)));

  // 로컬 백엔드에서만 동작하는 중복 확인 (실패 시 무시)
  const confirmIfDuplicate = async (): Promise<boolean> => {
    try {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const base = host === "localhost" || host === "127.0.0.1" ? "http://localhost:8002" : "";
      const res = await fetch(`${base}/api/contents/check-duplicate?keyword=${encodeURIComponent(placeName.trim())}`);
      if (!res.ok) return true;
      const dup = await res.json();
      if (!dup.count) return true;
      const list = (dup.items as { title: string; created_at: string }[])
        .slice(0, 3)
        .map(it => `· ${it.title} (${(it.created_at || "").slice(0, 10)})`)
        .join("\n");
      return confirm(
        `'${placeName}'(으)로 이미 만든 글이 ${dup.count}건 있습니다.\n\n${list}\n\n같은 장소의 비슷한 글을 여러 개 발행하면 네이버에서 유사 문서로 판단될 수 있습니다.\n그래도 새로 생성할까요?`
      );
    } catch {
      return true;
    }
  };

  const handleGenerate = async () => {
    if (!placeName.trim()) {
      alert("다녀온 곳의 장소명 또는 상호명을 입력해주세요.");
      return;
    }
    const geminiKey = typeof window !== "undefined" ? localStorage.getItem("GEMINI_API_KEY") || "" : "";
    if (!geminiKey) {
      alert("상단의 API 키 입력란에 Gemini API 키를 먼저 등록해주세요.");
      return;
    }
    if (!(await confirmIfDuplicate())) return;

    setLoading(true);
    set_current_step(1);
    set_elapsed_seconds(0);
    set_is_step_completed(false);

    let seconds = 0;
    const timer = setInterval(() => {
      seconds += 1;
      set_elapsed_seconds(seconds);
      if (seconds === 2) set_current_step(2);
      else if (seconds === 4) set_current_step(3);
    }, 1000);

    try {
      const res = await fetch("/api/naver/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gemini-Key": geminiKey },
        body: JSON.stringify({
          place_name: placeName,
          category,
          location,
          place_url: placeUrl,
          key_info: keyInfo,
          special_notes: specialNotes,
          rating,
          photo_captions: photos.map(p => p.caption),
        }),
      });

      const rawText = await res.text();
      let data: {
        detail?: string;
        title?: string;
        article?: string;
        html_article?: string;
        tags?: string[];
        summary?: string;
        char_count?: number;
      } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        if (!res.ok) throw new Error(`서버 처리 오류 (${res.status}): ${rawText.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.detail || `후기 생성 실패 (${res.status})`);

      set_current_step(4);
      setTitle(data.title || `${placeName} 방문 후기`);
      setArticle(data.article || "");
      setHtmlArticle(data.html_article || "");
      setTags(data.tags || []);
      setSummary(data.summary || "");
      setCharCount(data.char_count || 0);
      setResultPhotos(photos);
      setActiveTab("preview");

      clearInterval(timer);
      set_is_step_completed(true);
    } catch (err) {
      console.error(err);
      alert(`오류: ${err instanceof Error ? err.message : "원고 생성 중 문제가 발생했습니다."}`);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  // 사진 마커를 실제 사진으로 치환한 미리보기 HTML
  const previewHtml = useMemo(() => {
    let html = htmlArticle;
    resultPhotos.forEach((p, idx) => {
      const figure = `<p style="text-align:center; margin: 22px 0;"><img src="${p.dataUrl}" alt="${p.caption.replace(/"/g, "&quot;")}" style="max-width:100%; height:auto;" /></p>`;
      html = html.replace(`<!-- [PHOTO_${idx + 1}_SLOT] -->`, figure);
    });
    return html.replace(/<!--\s*\[PHOTO_\d+_SLOT\]\s*-->/g, "");
  }, [htmlArticle, resultPhotos]);

  const flashCopied = (type: string) => {
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const copyText = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(type);
    } catch {
      alert("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해주세요.");
    }
  };

  // 서식(소제목·사진 포함) 그대로 복사: 미리보기 영역을 선택해 복사
  const copyRichBody = () => {
    const node = previewRef.current;
    if (!node) {
      alert("[미리보기] 탭에서 복사할 수 있습니다.");
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    if (ok) flashCopied("rich");
    else alert("복사에 실패했습니다. 미리보기 영역을 직접 선택(Ctrl+A) 후 복사해주세요.");
  };

  const hasResult = !!title;
  const titleLen = title.length;
  const checklist = [
    { ok: titleLen >= 20 && titleLen <= 45, text: `제목 길이 ${titleLen}자 (권장 25~40자)` },
    { ok: charCount >= 1800, text: `본문 ${charCount.toLocaleString()}자 (공백 제외, 권장 1,800자 이상)` },
    { ok: resultPhotos.length >= 8, text: `사진 ${resultPhotos.length}장 (권장 8~10장)` },
    { ok: tags.length >= 10, text: `태그 ${tags.length}개 (네이버 최대 30개)` },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* 상단 타이틀 배너 */}
      <div className="relative rounded-3xl overflow-hidden p-8 border border-white/[0.08] bg-gradient-to-r from-emerald-950/40 via-green-950/30 to-teal-950/40 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 mb-3">
              <PenLine size={14} className="text-emerald-400" />
              <span>Naver Blog · Gemini 2.5 Flash</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">체험·방문 후기 (네이버)</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              방문 정보와 사진 설명을 입력하면 <strong>네이버 블로그 검색 노출 기준</strong>으로 후기를 작성합니다.
              생성 후 <strong>[서식 복사]</strong>로 복사해 네이버 글쓰기 화면에 붙여넣으세요. (로그인·브라우저 자동화 불필요)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={NAVER_WRITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md"
            >
              <ExternalLink size={15} />
              네이버 글쓰기 열기
            </a>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-white/[0.1] text-xs font-semibold transition-all"
            >
              <RefreshCw size={15} />
              새로 작성
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 좌측: 입력 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass size={18} className="text-emerald-400" />
                1. 방문 장소 정보 입력
              </h2>
              <button
                type="button"
                onClick={loadSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all"
              >
                <Sparkles size={13} />
                테스트 데이터 입력
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">체험 카테고리</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-xs text-left font-medium transition-all ${
                      category === cat.id
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.15] hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                장소 / 상호명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={placeName}
                onChange={e => setPlaceName(e.target.value)}
                placeholder="예: 순희네 빈대떡, 닭진미강원집"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <MapPin size={12} className="text-emerald-400" /> 위치 / 지역
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="예: 서울 종로구 광장시장"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <ExternalLink size={12} className="text-emerald-400" /> 지도 링크
                </label>
                <input
                  type="text"
                  value={placeUrl}
                  onChange={e => setPlaceUrl(e.target.value)}
                  placeholder="네이버 지도 URL"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                주요 정보 (메뉴/가격/영업시간/주소 등) — 입력한 정보만 글에 사용됩니다
              </label>
              <textarea
                value={keyInfo}
                onChange={e => setKeyInfo(e.target.value)}
                rows={3}
                placeholder="예: 녹두빈대떡 12,000원, 고기완자 10,000원 / 매일 10:00~22:00 / 서울 종로구 창경궁로 88"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                방문 특이사항 및 솔직 메모 (선택)
              </label>
              <textarea
                value={specialNotes}
                onChange={e => setSpecialNotes(e.target.value)}
                rows={4}
                placeholder="예: 평일 저녁 대기 20분, 2층 창가 자리가 좋음, 막걸리는 지평 추천, 좌석 간격이 좁아 조금 시끄러움"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                만족도 / 별점
              </span>
              <div className="flex items-center gap-2">
                {["4.0", "4.5", "5.0"].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRating(val)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      rating === val
                        ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                        : "bg-white/[0.03] text-slate-400 border border-white/[0.05]"
                    }`}
                  >
                    ★ {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 사진 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-[#0b0c14] border rounded-3xl p-6 shadow-xl space-y-4 transition-all ${
              isDragging ? "border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/40" : "border-white/[0.08]"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Camera size={18} className="text-emerald-400" />
                2. 현장 사진 등록 ({photos.length}/{MAX_PHOTOS})
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={e => e.target.files && processFiles(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all disabled:opacity-40"
              >
                <Upload size={13} />
                사진 추가
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              사진은 AI에 전송되지 않고 <strong>사진 설명(캡션)만</strong> 글 작성에 사용됩니다. 설명을 구체적으로 적을수록 글이 정확해집니다.
              네이버는 사진 8~10장을 권장합니다.
            </p>

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/[0.1] hover:border-emerald-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white/[0.01]"
              >
                <Camera size={32} className="mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-200 font-semibold">
                  {isDragging ? "여기에 놓으세요!" : `사진을 드래그하거나 클릭하여 업로드 (최대 ${MAX_PHOTOS}장)`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.dataUrl}
                      alt={photo.caption}
                      className="w-14 h-14 object-cover rounded-xl border border-white/[0.1] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-200">사진 {index + 1}</span>
                        <span>{photo.fileSize}</span>
                      </div>
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={e => updateCaption(photo.id, e.target.value)}
                        placeholder="사진 설명 (예: 녹두빈대떡 접시, 매장 외관)"
                        className="w-full px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="사진 삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>네이버용 후기 작성 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>⚡ 네이버 블로그용 후기 작성하기</span>
              </>
            )}
          </button>
        </div>

        {/* 우측: 결과 */}
        <div className="lg:col-span-7">
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl flex flex-col h-full min-h-[700px]">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                {(
                  [
                    { id: "preview", label: "미리보기", icon: <Eye size={14} /> },
                    { id: "text", label: "텍스트", icon: <FileText size={14} /> },
                    { id: "seo", label: "태그 & 점검", icon: <Tag size={14} /> },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {hasResult && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => copyText(title, "title")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] text-xs font-semibold transition-all"
                  >
                    {copiedType === "title" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copiedType === "title" ? "복사완료" : "제목 복사"}
                  </button>
                  <button
                    onClick={copyRichBody}
                    disabled={activeTab !== "preview"}
                    title={activeTab !== "preview" ? "[미리보기] 탭에서 복사할 수 있습니다" : "소제목·사진 서식 그대로 복사"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    {copiedType === "rich" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copiedType === "rich" ? "복사완료" : "서식 복사 (본문+사진)"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 py-5 overflow-y-auto max-h-[800px]">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center py-6 px-4">
                  <StepProgressIndicator
                    steps={네이버_단계_목록}
                    current_step={current_step}
                    is_completed={is_step_completed}
                    elapsed_seconds={elapsed_seconds}
                    sub_message="네이버 블로그용 후기를 작성하고 있습니다"
                    tip_message="입력하지 않은 영업시간·가격·주소는 지어내지 않고, 방문 전 확인하도록 안내합니다."
                  />
                </div>
              ) : !hasResult ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-4 text-slate-400">
                    <PenLine size={32} />
                  </div>
                  <h3 className="text-base font-bold text-slate-300 mb-1">네이버용 후기가 아직 생성되지 않았습니다</h3>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    좌측에서 방문 정보와 사진 설명을 입력하고 <strong>[네이버 블로그용 후기 작성하기]</strong>를 클릭하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">포스팅 제목</div>
                    <h2 className="text-lg font-bold text-white leading-snug">{title}</h2>
                  </div>

                  {activeTab === "preview" && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-amber-400" />
                        <span>
                          [서식 복사] 후 네이버 글쓰기 화면 본문에 붙여넣으세요. 사진이 붙지 않으면 사진을 직접 업로드하고,
                          발행 전에 영업시간·가격·주소가 맞는지 꼭 확인하세요.
                        </span>
                      </div>
                      <div className="p-6 rounded-2xl bg-white text-slate-900">
                        <div ref={previewRef} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      </div>
                    </div>
                  )}

                  {activeTab === "text" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                        <span>본문 텍스트 (수정 후 복사할 수 있습니다)</span>
                        <button
                          onClick={() => copyText(article, "text")}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] font-semibold"
                        >
                          {copiedType === "text" ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                          {copiedType === "text" ? "복사완료" : "텍스트 복사"}
                        </button>
                      </div>
                      <textarea
                        value={article}
                        onChange={e => setArticle(e.target.value)}
                        rows={24}
                        className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-sm text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  {activeTab === "seo" && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                        <span className="text-xs font-bold text-slate-400">발행 전 점검</span>
                        <ul className="space-y-1.5 pt-1">
                          {checklist.map(item => (
                            <li key={item.text} className="flex items-center gap-2 text-xs">
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                  item.ok ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {item.ok ? "✓" : "!"}
                              </span>
                              <span className={item.ok ? "text-slate-300" : "text-amber-200"}>{item.text}</span>
                            </li>
                          ))}
                          <li className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-amber-500/20 text-amber-400">!</span>
                            영업시간·가격·주소 등 사실 정보를 발행 전에 직접 확인
                          </li>
                        </ul>
                      </div>

                      {summary && (
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                          <span className="text-xs font-bold text-slate-400">글 요약</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
                        </div>
                      )}

                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400">추천 태그 ({tags.length}개)</span>
                          <button
                            onClick={() => copyText(tags.map(t => `#${t}`).join(" "), "tags")}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] text-xs font-semibold"
                          >
                            {copiedType === "tags" ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                            {copiedType === "tags" ? "복사완료" : "태그 복사 (#포함)"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
