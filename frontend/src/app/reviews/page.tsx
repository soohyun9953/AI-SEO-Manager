"use client";

import { useState, useEffect, useRef } from "react";
import { 
  UtensilsCrossed, 
  MapPin, 
  ExternalLink, 
  Camera, 
  Upload, 
  Trash2, 
  Download, 
  Copy, 
  CheckCircle, 
  Sparkles, 
  Loader2, 
  Send, 
  Save, 
  FileText, 
  Eye, 
  Code, 
  Tag, 
  Star, 
  RefreshCw, 
  AlertCircle,
  Share2,
  FolderKanban,
  Bot
} from "lucide-react";
import Link from "next/link";
import ExportModal, { ContentItem } from "@/components/ExportModal";
import { compress_image_file } from "@/utils/imageCompressor";
import AutoRegisterModal from "@/components/AutoRegisterModal";

interface PhotoItem {

  id: string;
  dataUrl: string;
  caption: string;
  fileName: string;
  fileSize?: string;
}

export default function ReviewWriterPage() {
  // 1. 입력 폼 상태
  const [restaurantName, setRestaurantName] = useState("");
  const [location, setLocation] = useState("");
  const [placeUrl, setPlaceUrl] = useState("");
  const [menuInfo, setMenuInfo] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [rating, setRating] = useState("5.0");

  // 2. 사진 상태 (최대 2장)
  const [photo1, setPhoto1] = useState<PhotoItem | null>(null);
  const [photo2, setPhoto2] = useState<PhotoItem | null>(null);
  const [isDragging1, setIsDragging1] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // 3. 생성 결과 상태
  const [loading, setLoading] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [article, setArticle] = useState("");
  const [htmlArticle, setHtmlArticle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsString, setTagsString] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [jsonLd, setJsonLd] = useState<any>(null);

  // 광고 플레이스홀더 클린업 헬퍼 함수
  const removeAdCode = (html: string) => {
    if (!html) return "";
    return html
      .replace(/<!--\s*\[구글 애드센스.*?\]\s*-->/g, "")
      .replace(/<div class="adsense-placeholder"[^>]*>[\s\S]*?<\/div>/g, "")
      .trim();
  };

  // 4. UI 탭 및 복사 알림 상태
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "editor" | "seo">("preview");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [savingToDB, setSavingToDB] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [savedContentId, setSavedContentId] = useState<string | null>(null);
  const [isAutoRegisterOpen, setIsAutoRegisterOpen] = useState(false);
  const [autoRegisterLoading, setAutoRegisterLoading] = useState(false);


  // 로컬 스토리지 복원
  useEffect(() => {
    const savedName = localStorage.getItem("review_writer_name");
    if (savedName) setRestaurantName(savedName);

    const savedLoc = localStorage.getItem("review_writer_location");
    if (savedLoc) setLocation(savedLoc);

    const savedUrl = localStorage.getItem("review_writer_url");
    if (savedUrl) setPlaceUrl(savedUrl);

    const savedMenu = localStorage.getItem("review_writer_menu");
    if (savedMenu) setMenuInfo(savedMenu);

    const savedNotes = localStorage.getItem("review_writer_notes");
    if (savedNotes) setSpecialNotes(savedNotes);

    const savedTitle = localStorage.getItem("review_writer_result_title");
    if (savedTitle) setGeneratedTitle(savedTitle);

    const savedArticle = localStorage.getItem("review_writer_result_article");
    if (savedArticle) setArticle(savedArticle);

    const savedHtml = localStorage.getItem("review_writer_result_html");
    if (savedHtml) {
      // 기존 저장된 HTML에서도 광고 코드를 깔끔히 제거
      const cleaned = removeAdCode(savedHtml);
      setHtmlArticle(cleaned);
      localStorage.setItem("review_writer_result_html", cleaned);
    }

    const savedTags = localStorage.getItem("review_writer_result_tags");
    if (savedTags) {
      try {
        const parsed = JSON.parse(savedTags);
        setTags(parsed);
        setTagsString(parsed.join(", "));
      } catch (e) {}
    }
  }, []);

  // 단일 사진 파일 처리 (Vercel 413 방지를 위한 스마트 자동 압축 적용)
  const processSingleFile = async (file: File, slot: 1 | 2) => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.");
      return;
    }

    try {
      // 1280px, 품질 0.8로 자동 리사이징 & 압축 (수 MB -> 100~200KB)
      const { data_url, file_size_str } = await compress_image_file(file, 1280, 0.8);
      const newPhoto: PhotoItem = {
        id: `photo_${Date.now()}_${slot}`,
        dataUrl: data_url,
        caption: slot === 1 ? `${restaurantName || '매장'} 외관 및 첫인상` : `대표 메뉴 및 시식`,
        fileName: file.name,
        fileSize: file_size_str,
      };

      if (slot === 1) {
        setPhoto1(newPhoto);
      } else {
        setPhoto2(newPhoto);
      }
    } catch (err: any) {
      console.error("Image compression error:", err);
      alert("이미지 최적화 중 오류가 발생했습니다: " + (err.message || ""));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) processSingleFile(file, slot);
    if (slot === 1 && fileInputRef1.current) fileInputRef1.current.value = "";
    if (slot === 2 && fileInputRef2.current) fileInputRef2.current.value = "";
  };

  const handleSlotDrop = (e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault();
    e.stopPropagation();
    if (slot === 1) setIsDragging1(false);
    else setIsDragging2(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) processSingleFile(file, slot);
  };

  // 사진 삭제
  const removePhoto = (slot: 1 | 2) => {
    if (slot === 1) {
      setPhoto1(null);
      if (fileInputRef1.current) fileInputRef1.current.value = "";
    } else {
      setPhoto2(null);
      if (fileInputRef2.current) fileInputRef2.current.value = "";
    }
  };

  // 사진 다운로드
  const downloadPhoto = (photo: PhotoItem) => {
    const link = document.createElement("a");
    link.href = photo.dataUrl;
    link.download = photo.fileName || "restaurant_photo.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 폼 초기화
  const resetForm = () => {
    if (confirm("입력한 내용과 생성 결과를 모두 초기화하시겠습니까?")) {
      setRestaurantName("");
      setLocation("");
      setPlaceUrl("");
      setMenuInfo("");
      setSpecialNotes("");
      setPhoto1(null);
      setPhoto2(null);
      setGeneratedTitle("");
      setArticle("");
      setHtmlArticle("");
      setTags([]);
      setTagsString("");
      setMetaDesc("");
      setJsonLd(null);

      localStorage.removeItem("review_writer_name");
      localStorage.removeItem("review_writer_location");
      localStorage.removeItem("review_writer_url");
      localStorage.removeItem("review_writer_menu");
      localStorage.removeItem("review_writer_notes");
      localStorage.removeItem("review_writer_result_title");
      localStorage.removeItem("review_writer_result_article");
      localStorage.removeItem("review_writer_result_html");
      localStorage.removeItem("review_writer_result_tags");
    }
  };

  // AI 맛집 후기 생성
  const handleGenerateReview = async () => {
    if (!restaurantName.trim()) {
      alert("식당 또는 매장 이름을 반드시 입력해주세요.");
      return;
    }

    setLoading(true);
    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";

    // 사진 배열 구성
    const photosPayload = [];
    if (photo1) {
      photosPayload.push({
        data_url: photo1.dataUrl,
        caption: photo1.caption || "매장 전경 및 분위기",
        name: photo1.fileName,
      });
    }
    if (photo2) {
      photosPayload.push({
        data_url: photo2.dataUrl,
        caption: photo2.caption || "대표 메뉴 비주얼",
        name: photo2.fileName,
      });
    }

    try {
      const res = await fetch("/api/generate-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-Key": geminiKey,
        },
        body: JSON.stringify({
          restaurant_name: restaurantName,
          location: location,
          place_url: placeUrl,
          menu_info: menuInfo,
          special_notes: specialNotes,
          rating: rating,
          photos: photosPayload,
          adsense_optimize: false,
          category: "맛집/카페",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "맛집 후기 생성에 실패했습니다.");
      }

      const data = await res.json();
      const cleanedHtml = removeAdCode(data.html_article || "");
      setGeneratedTitle(data.title || `${restaurantName} 방문 후기`);
      setArticle(data.article || "");
      setHtmlArticle(cleanedHtml);
      setTags(data.tags || []);
      setTagsString(data.tags_string || (data.tags || []).join(", "));
      setMetaDesc(data.meta_description || "");
      setJsonLd(data.json_ld || null);


      // 로컬 스토리지 보존
      localStorage.setItem("review_writer_name", restaurantName);
      localStorage.setItem("review_writer_location", location);
      localStorage.setItem("review_writer_url", placeUrl);
      localStorage.setItem("review_writer_menu", menuInfo);
      localStorage.setItem("review_writer_notes", specialNotes);
      localStorage.setItem("review_writer_result_title", data.title || "");
      localStorage.setItem("review_writer_result_article", data.article || "");
      localStorage.setItem("review_writer_result_html", data.html_article || "");
      localStorage.setItem("review_writer_result_tags", JSON.stringify(data.tags || []));

      setActiveTab("preview");
    } catch (err: any) {
      console.error(err);
      alert(`오류: ${err.message || "원고 생성 중 문제가 발생했습니다."}`);
    } finally {
      setLoading(false);
    }
  };

  // 복사 피드백 헬퍼
  const showCopiedToast = (type: string) => {
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 3000);
  };

  // 1. 티스토리 HTML 복사 (광고 코드 완전 배제)
  const copyTistoryHTML = async () => {
    if (!htmlArticle) {
      alert("생성된 원고가 없습니다.");
      return;
    }
    try {
      const cleanHtml = removeAdCode(htmlArticle);
      await navigator.clipboard.writeText(cleanHtml);
      showCopiedToast("html");
    } catch (e) {
      alert("클립보드 복사 권한이 거부되었습니다.");
    }
  };


  // 2. 본문 마크다운 복사
  const copyMarkdown = async () => {
    if (!article) return;
    try {
      await navigator.clipboard.writeText(article);
      showCopiedToast("markdown");
    } catch (e) {
      alert("복사 실패");
    }
  };

  // 3. 태그 복사 (티스토리 태그창용)
  const copyTags = async () => {
    if (!tagsString) return;
    try {
      await navigator.clipboard.writeText(tagsString);
      showCopiedToast("tags");
    } catch (e) {
      alert("복사 실패");
    }
  };

  // 4. 제목 복사
  const copyTitle = async () => {
    if (!generatedTitle) return;
    try {
      await navigator.clipboard.writeText(generatedTitle);
      showCopiedToast("title");
    } catch (e) {
      alert("복사 실패");
    }
  };

  // 5. 티스토리 글쓰기 새 탭 열기
  const openTistoryEditor = () => {
    const tistoryBlog = localStorage.getItem("tistory_blog") || "s-elegant";
    const writeUrl = `https://${tistoryBlog}.tistory.com/manage/post`;
    window.open(writeUrl, "_blank");
  };

  // 6. 콘텐츠 보관함(DB)에 영구 저장
  const saveToContentDB = async (): Promise<string | null> => {
    if (!generatedTitle || !article) {
      alert("저장할 콘텐츠가 없습니다. 먼저 원고를 생성해주세요.");
      return null;
    }

    setSavingToDB(true);
    setSaveSuccessMsg(null);

    const photosList = [];
    if (photo1?.dataUrl) photosList.push(photo1.dataUrl);
    if (photo2?.dataUrl) photosList.push(photo2.dataUrl);

    try {
      const res = await fetch("/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generatedTitle,
          keyword: restaurantName,
          related_keywords: location ? `${location} ${restaurantName}` : "",
          category: "맛집/카페",
          content: article,
          content_html: htmlArticle,
          meta_description: metaDesc || `${restaurantName} 솔직 방문 후기`,
          tags: tagsString,
          thumbnail_url: photo1?.dataUrl || "",
          body_images: photosList,
          reference_urls: placeUrl ? [placeUrl] : [],
          ai_model: "gemini-2.5-flash",
          status: "DRAFT",
          check_duplicate: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "콘텐츠 보관함 저장에 실패했습니다.");
      }

      const data = await res.json();
      setSavedContentId(data.id);
      setSaveSuccessMsg("✅ 콘텐츠 보관함에 성공적으로 저장되었습니다!");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      return data.id;
    } catch (err: any) {
      console.error(err);
      alert(`저장 실패: ${err.message}`);
      return null;
    } finally {
      setSavingToDB(false);
    }
  };

  // 7. 티스토리 브라우저 자동 등록 봇 트리거
  const handleAutoRegisterClick = async () => {
    if (!generatedTitle || !article) {
      alert("먼저 AI 맛집 후기 원고를 생성해주세요.");
      return;
    }

    let targetId = savedContentId;
    if (!targetId) {
      setAutoRegisterLoading(true);
      targetId = await saveToContentDB();
      setAutoRegisterLoading(false);
    }

    if (targetId) {
      setIsAutoRegisterOpen(true);
    }
  };


  // 내보내기 모달용 아이템 객체 생성
  const exportItem: ContentItem = {
    id: "temp_review",
    title: generatedTitle || `${restaurantName} 방문 후기`,
    keyword: restaurantName,
    category: "맛집/카페",
    content: article,
    content_html: htmlArticle,
    tags: tagsString,
    meta_description: metaDesc,
    status: "DRAFT",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };


  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                맛집·방문 후기 라이터
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold">
                  E-E-A-T & Tistory
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                식당 정보와 중요 사진 1~2장을 입력하면 검색 상위노출용 후기 원고와 티스토리 원클릭 발행 패키지를 생성합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={resetForm}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white text-xs font-medium border border-white/[0.06] transition-all"
            title="모든 입력 초기화"
          >
            <RefreshCw size={14} />
            초기화
          </button>
          <Link
            href="/contents"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white text-xs font-medium border border-white/[0.06] transition-all"
          >
            <FolderKanban size={14} />
            보관함 목록
          </Link>
        </div>
      </div>

      {/* 2단 그리드: 좌측(입력 & 사진), 우측(결과 & 티스토리 액션) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ===================== 좌측: 입력 폼 & 사진 슬롯 (5열) ===================== */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 기본 정보 카드 */}
          <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <MapPin size={18} className="text-orange-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                1. 방문 식당 & 장소 정보
              </h2>
            </div>

            {/* 식당 이름 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>식당 / 매장 이름 <span className="text-orange-400">*</span></span>
                <span className="text-[10px] text-gray-500 font-normal">필수 입력</span>
              </label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="예: 성수 난포, 을지로 산수갑산, 제주 숙성도"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {/* 위치 / 주소 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">
                지역 / 위치 (키워드 매칭용)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 서울 성동구 성수동 서울숲길, 제주 서귀포 중문"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {/* 지도 / 사이트 링크 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <ExternalLink size={13} className="text-gray-400" />
                식당 사이트 / 지도 URL
              </label>
              <input
                type="url"
                value={placeUrl}
                onChange={(e) => setPlaceUrl(e.target.value)}
                placeholder="https://naver.me/... 또는 카카오맵/인스타그램"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {/* 대표 메뉴 및 가격 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">
                주문 대표 메뉴 & 가격
              </label>
              <input
                type="text"
                value={menuInfo}
                onChange={(e) => setMenuInfo(e.target.value)}
                placeholder="예: 강된장 쌈밥 12,000원, 제철회 묵은지말이 13,000원"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {/* 별점 선택 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                <Star size={13} className="text-amber-400 fill-amber-400" />
                만족도 별점
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["5.0", "4.5", "4.0", "3.5"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 border ${
                      rating === r
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/10"
                        : "bg-white/[0.02] text-gray-400 border-white/[0.06] hover:bg-white/[0.05]"
                    }`}
                  >
                    ★ {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 특이사항 / 방문 메모 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>특이사항 & 생생한 방문 팁</span>
                <span className="text-[10px] text-gray-500 font-normal">웨이팅, 주차, 분위기 등</span>
              </label>
              <textarea
                rows={3}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="예: 주말 점심 웨이팅 1시간, 캐치테이블 원격 줄서기 필수, 주차 불가 근처 성수공영주차장 이용, 분위기가 감성적이라 데이트 코스로 강추"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-xs leading-relaxed placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all resize-none"
              />
            </div>
          </div>

          {/* 사진 첨부 슬롯 카드 (1~2장) */}
          <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-orange-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. 중요 사진 첨부 (1~2장)
                </h2>
              </div>
              <span className="text-[11px] text-gray-400">
                본문 적재적소 자동 배치
              </span>
            </div>

            {/* 사진 1 슬롯 */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[11px] font-bold">1</span>
                  외관 / 매장 분위기 사진
                </span>
                {photo1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => downloadPhoto(photo1)}
                      className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white text-[11px] flex items-center gap-1 transition-all"
                      title="티스토리 직접 업로드용 다운로드"
                    >
                      <Download size={11} /> 다운로드
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(1)}
                      className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                      title="사진 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {photo1 ? (
                <div className="flex gap-3 items-center">
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/[0.1] flex-shrink-0 relative group">
                    <img
                      src={photo1.dataUrl}
                      alt={photo1.caption}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                      {photo1.fileName} ({photo1.fileSize})
                    </span>
                    <input
                      type="text"
                      value={photo1.caption}
                      onChange={(e) => setPhoto1({ ...photo1, caption: e.target.value })}
                      placeholder="사진 캡션 (예: 매장 외관 및 웨이팅)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef1}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 1)}
                    className="hidden"
                    id="photo_upload_1"
                  />
                  <label
                    htmlFor="photo_upload_1"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging1(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging1(false); }}
                    onDrop={(e) => handleSlotDrop(e, 1)}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center gap-2 group ${
                      isDragging1
                        ? "border-orange-500 bg-orange-500/10 scale-[1.01]"
                        : "border-white/[0.15] hover:border-orange-500/50 hover:bg-white/[0.02]"
                    }`}
                  >
                    <Upload size={20} className={`transition-colors ${isDragging1 ? "text-orange-400 animate-bounce" : "text-gray-500 group-hover:text-orange-400"}`} />
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white">
                      {isDragging1 ? "여기에 사진을 놓으세요!" : "사진 1을 드래그하여 놓거나 클릭하여 업로드"}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      JPG, PNG, WEBP (외관, 인테리어 또는 메인 요리)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* 사진 2 슬롯 */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[11px] font-bold">2</span>
                  대표 음식 / 디테일 컷 (선택)
                </span>
                {photo2 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => downloadPhoto(photo2)}
                      className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 hover:text-white text-[11px] flex items-center gap-1 transition-all"
                      title="티스토리 직접 업로드용 다운로드"
                    >
                      <Download size={11} /> 다운로드
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(2)}
                      className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                      title="사진 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {photo2 ? (
                <div className="flex gap-3 items-center">
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/[0.1] flex-shrink-0 relative group">
                    <img
                      src={photo2.dataUrl}
                      alt={photo2.caption}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                      {photo2.fileName} ({photo2.fileSize})
                    </span>
                    <input
                      type="text"
                      value={photo2.caption}
                      onChange={(e) => setPhoto2({ ...photo2, caption: e.target.value })}
                      placeholder="사진 캡션 (예: 강된장 쌈밥의 먹음직스런 비주얼)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 2)}
                    className="hidden"
                    id="photo_upload_2"
                  />
                  <label
                    htmlFor="photo_upload_2"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging2(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging2(false); }}
                    onDrop={(e) => handleSlotDrop(e, 2)}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center gap-2 group ${
                      isDragging2
                        ? "border-orange-500 bg-orange-500/10 scale-[1.01]"
                        : "border-white/[0.15] hover:border-orange-500/50 hover:bg-white/[0.02]"
                    }`}
                  >
                    <Upload size={20} className={`transition-colors ${isDragging2 ? "text-orange-400 animate-bounce" : "text-gray-500 group-hover:text-orange-400"}`} />
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white">
                      {isDragging2 ? "여기에 사진을 놓으세요!" : "사진 2를 드래그하여 놓거나 클릭하여 업로드 (선택)"}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      음식 단면, 사이드 메뉴, 영수증 등
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* AI 생성 실행 버튼 */}
            <button
              type="button"
              onClick={handleGenerateReview}
              disabled={loading || !restaurantName.trim()}
              className="mt-2 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>AI 맛집 후기 포스팅 작성 중...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>AI 맛집 후기 포스팅 생성하기</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ===================== 우측: 결과 워크스페이스 & 티스토리 액션 (7열) ===================== */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 티스토리 원스톱 발행 액션 바 */}
          <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Send size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  티스토리 원클릭 발행 액션
                </h3>
              </div>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle size={12} />
                준비 완료
              </span>
            </div>

            {/* 액션 버튼 그룹 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* 1. 티스토리 HTML 복사 (강력 추천) */}
              <button
                type="button"
                onClick={copyTistoryHTML}
                disabled={!htmlArticle}
                className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg ${
                  copiedType === "html"
                    ? "bg-emerald-600 text-white shadow-emerald-600/30"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20 active:scale-[0.98]"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {copiedType === "html" ? (
                  <>
                    <CheckCircle size={14} />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Code size={14} />
                    <span>HTML 복사</span>
                  </>
                )}
              </button>

              {/* 2. 티스토리 브라우저 자동 등록 (신규 봇) */}
              <button
                type="button"
                onClick={handleAutoRegisterClick}
                disabled={!article || autoRegisterLoading}
                className="py-3 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Playwright 브라우저 자동 등록 실행"
              >
                {autoRegisterLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Bot size={14} />
                )}
                <span>🤖 자동 등록 (봇)</span>
              </button>

              {/* 3. 태그 복사 */}
              <button
                type="button"
                onClick={copyTags}
                disabled={!tagsString}
                className={`py-3 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                  copiedType === "tags"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 border-white/[0.08]"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {copiedType === "tags" ? <CheckCircle size={13} /> : <Tag size={13} />}
                <span>태그 복사</span>
              </button>

              {/* 4. 티스토리 열기 */}
              <button
                type="button"
                onClick={openTistoryEditor}
                className="py-3 px-3 rounded-xl font-semibold text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.08] flex items-center justify-center gap-1.5 transition-all"
                title="티스토리 글쓰기 새 창으로 열기"
              >
                <ExternalLink size={13} />
                <span>티스토리 열기</span>
              </button>
            </div>


            {/* 2차 액션: 본문 마크다운 복사, 보관함 저장, 내보내기 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.04] text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyMarkdown}
                  disabled={!article}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 hover:text-white border border-white/[0.06] flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Copy size={12} />
                  <span>마크다운 복사</span>
                </button>
                <button
                  type="button"
                  onClick={copyTitle}
                  disabled={!generatedTitle}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 hover:text-white border border-white/[0.06] flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <FileText size={12} />
                  <span>제목 복사</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveToContentDB}
                  disabled={savingToDB || !article}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  {savingToDB ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  <span>보관함에 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(true)}
                  disabled={!article}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 hover:text-white border border-white/[0.06] flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Share2 size={12} />
                  <span>내보내기</span>
                </button>
              </div>
            </div>

            {/* 성공 안내 토스트 */}
            {copiedType === "html" && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={14} className="flex-shrink-0 text-blue-400" />
                <span>
                  💡 <strong>사진과 스타일이 내장된 HTML이 복사되었습니다!</strong> 티스토리 글쓰기 화면 우측 상단에서 <strong>[기본모드 → HTML]</strong>로 전환 후 바로 <strong>Ctrl+V</strong> 하세요!
                </span>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2 animate-fadeIn">
                <CheckCircle size={13} className="flex-shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* 결과 화면 메인 카드 (제목 + 탭 + 뷰어) */}
          <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 min-h-[500px]">
            {/* 제목 인풋 (수정 가능) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>추천 블로그 제목 (클릭률 최적화)</span>
                <span className="text-[10px] text-blue-400 font-normal">직접 수정 가능</span>
              </label>
              <input
                type="text"
                value={generatedTitle}
                onChange={(e) => setGeneratedTitle(e.target.value)}
                placeholder="AI가 생성한 최적화 제목이 여기에 표시됩니다."
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-sm font-semibold focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* 태그 칩스 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 py-1">
                <Tag size={13} className="text-gray-500 mr-1" />
                {tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] text-gray-300 border border-white/[0.06]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* 탭 네비게이션 */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pt-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all ${
                    activeTab === "preview"
                      ? "border-orange-500 text-orange-400"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <Eye size={14} />
                  미리보기 (사진 포함)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("html")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all ${
                    activeTab === "html"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <Code size={14} />
                  티스토리 HTML
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("editor")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all ${
                    activeTab === "editor"
                      ? "border-purple-500 text-purple-400"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <FileText size={14} />
                  마크다운 편집기
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("seo")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all ${
                    activeTab === "seo"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <Tag size={14} />
                  SEO 분석 & 태그
                </button>
              </div>
            </div>

            {/* 탭 본문 영역 */}
            <div className="flex-1 mt-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
                  <Loader2 size={36} className="animate-spin text-orange-500" />
                  <p className="text-sm font-medium text-gray-300">
                    방문 정보와 사진을 결합하여 SEO 최적화 후기를 작성하고 있습니다...
                  </p>
                  <p className="text-xs text-gray-500">
                    약 5~10초 소요됩니다 (Gemini 2.5 Flash 고속 엔진)
                  </p>
                </div>
              ) : !article ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center border-2 border-dashed border-white/[0.05] rounded-2xl p-8">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-gray-500">
                    <UtensilsCrossed size={24} />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-300">
                    아직 생성된 맛집 후기가 없습니다.
                  </h4>
                  <p className="text-xs text-gray-500 max-w-sm">
                    좌측에서 식당 이름, 방문 메모, 사진 1~2장을 입력한 후 <strong>[AI 맛집 후기 포스팅 생성하기]</strong> 버튼을 눌러주세요.
                  </p>
                </div>
              ) : (
                <>
                  {/* 1. 미리보기 탭 */}
                  {activeTab === "preview" && (
                    <div className="p-5 rounded-2xl bg-[#0d0d14] border border-white/[0.06] text-gray-200 text-sm leading-relaxed max-h-[600px] overflow-y-auto space-y-4">
                      <div className="pb-3 border-b border-white/[0.08]">
                        <h2 className="text-xl font-bold text-white mb-2">{generatedTitle}</h2>
                        {metaDesc && (
                          <p className="text-xs text-gray-400 italic bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                            💬 <strong>요약:</strong> {metaDesc}
                          </p>
                        )}
                      </div>

                      {/* 렌더링된 HTML 뷰 (사진 1, 2가 완벽하게 표시됨) */}
                      <div 
                        className="tistory-preview-content prose prose-invert max-w-none prose-headings:text-white prose-p:text-gray-300 prose-strong:text-orange-300 prose-table:border prose-table:border-white/10"
                        dangerouslySetInnerHTML={{ __html: htmlArticle }}
                      />
                    </div>
                  )}

                  {/* 2. 티스토리 HTML 소스 탭 */}
                  {activeTab === "html" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>티스토리 [HTML 모드] 전용 인라인 코드</span>
                        <button
                          type="button"
                          onClick={copyTistoryHTML}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                        >
                          <Copy size={12} /> 코드 전체 복사
                        </button>
                      </div>
                      <textarea
                        rows={18}
                        value={htmlArticle}
                        onChange={(e) => setHtmlArticle(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-black/60 border border-white/[0.08] text-blue-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-blue-500/50 resize-none"
                      />
                    </div>
                  )}

                  {/* 3. 마크다운 편집기 탭 */}
                  {activeTab === "editor" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>마크다운 원본 (직접 수정 가능)</span>
                        <button
                          type="button"
                          onClick={copyMarkdown}
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
                        >
                          <Copy size={12} /> 마크다운 복사
                        </button>
                      </div>
                      <textarea
                        rows={18}
                        value={article}
                        onChange={(e) => {
                          setArticle(e.target.value);
                          localStorage.setItem("review_writer_result_article", e.target.value);
                        }}
                        className="w-full p-4 rounded-2xl bg-[#050508] border border-white/[0.08] text-gray-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-purple-500/50 resize-none"
                      />
                    </div>
                  )}

                  {/* 4. SEO 분석 & 태그 탭 */}
                  {activeTab === "seo" && (
                    <div className="p-5 rounded-2xl bg-[#0d0d14] border border-white/[0.06] flex flex-col gap-5">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          티스토리 등록용 태그 (쉼표 구분)
                        </h4>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={tagsString}
                            className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={copyTags}
                            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1"
                          >
                            <Copy size={12} /> 복사
                          </button>
                        </div>
                      </div>

                      {jsonLd && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Google 검색 구조화 데이터 (Schema.org Restaurant & Review)
                          </h4>
                          <pre className="p-3 rounded-xl bg-black/40 border border-white/[0.05] text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-48">
                            {JSON.stringify(jsonLd, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-gray-400 space-y-1">
                        <p className="font-semibold text-white">💡 티스토리 발행 가이드</p>
                        <p>1. [🔥 티스토리 HTML 복사] 버튼을 누릅니다.</p>
                        <p>2. [티스토리 열기] 버튼을 눌러 글쓰기 창으로 이동합니다.</p>
                        <p>3. 에디터 우측 상단 모드를 <strong>[기본모드 → HTML]</strong>로 변경합니다.</p>
                        <p>4. 본문에 <strong>Ctrl+V</strong>로 붙여넣고 다시 <strong>[기본모드]</strong>로 돌아오면 사진과 서식이 완벽하게 반영됩니다!</p>
                        <p>5. 하단 태그 입력창에 [태그 복사]한 내용을 붙여넣고 <strong>[발행]</strong>을 누르시면 완료됩니다.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 내보내기 모달 */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        content={exportItem}
      />

      {/* 티스토리 브라우저 자동 등록 모달 */}
      <AutoRegisterModal
        isOpen={isAutoRegisterOpen}
        onClose={() => setIsAutoRegisterOpen(false)}
        contentId={savedContentId || ""}
        title={generatedTitle || `${restaurantName} 방문 후기`}
        category="맛집/카페"
        onSuccess={(res) => {
          setSaveSuccessMsg(`🎉 티스토리 자동 등록 완료! (${res.action})`);
          setTimeout(() => setSaveSuccessMsg(null), 5000);
        }}
      />
    </div>
  );
}

