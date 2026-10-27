"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Compass, 
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
  Save, 
  FileText, 
  Eye, 
  Code, 
  Tag, 
  Star, 
  RefreshCw, 
  AlertCircle,
  Bot,
  Globe,
  Sliders,
  Send,
  Info,
  Check,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import AutoRegisterModal from "@/components/AutoRegisterModal";
import ExportModal, { ContentItem } from "@/components/ExportModal";
import StepProgressIndicator, { 단계_정보 } from "@/components/StepProgressIndicator";

// 진행 단계 정의 목록 - Claude 모드 (스네이크 케이스 및 한글 설명 준수)
const 클로드_단계_목록: 단계_정보[] = [
  {
    id: 1,
    title: "현장 사진 및 방문 정보 데이터 전처리",
    description: "업로드된 사진 스마트 압축 최적화(1280px) 및 네이버 플레이스/인스타그램 정보 분석",
  },
  {
    id: 2,
    title: "Chrome 브라우저 구동 및 Claude.ai 연결",
    description: "사용자 PC 크롬 브라우저 자동 실행 및 Claude.ai 세션 연결 확인",
  },
  {
    id: 3,
    title: "Claude 3.7 Sonnet 사진 분석 & 내돈내산 원고 집필",
    description: "사진 속 공간 분위기와 메뉴를 정밀 분석하여 사실적이고 생생한 방문 후기 본문 작성",
  },
  {
    id: 4,
    title: "티스토리 에디터 자동 접속 및 임시저장 연동",
    description: "서식과 사진이 온전히 반영된 고품질 포스팅으로 티스토리 블로그 임시저장함에 등록",
  },
  {
    id: 5,
    title: "최종 원고 완성 및 SEO 메타데이터 검증",
    description: "포털 검색 상위 노출을 위한 제목, 메타 설명, 추천 검색 태그 완성 및 보관",
  },
];

// 진행 단계 정의 목록 - Gemini 고속 모드 (로그인 불필요)
const 제미나이_단계_목록: 단계_정보[] = [
  {
    id: 1,
    title: "현장 사진 및 방문 정보 스마트 최적화",
    description: "업로드된 사진 스마트 압축 최적화(1280px) 및 시각적 캡션 매핑 완료",
  },
  {
    id: 2,
    title: "네이버 지도 및 방문 경험 데이터 분석",
    description: "상호명, 위치, 주요 정보 및 고객 방문 메모를 바탕으로 최적 프롬프트 구성",
  },
  {
    id: 3,
    title: "Gemini 2.5 Flash 고품질 솔직 후기 원고 집필",
    description: "맛, 인테리어 분위기, 가성비, 주차 꿀팁이 담긴 신뢰도 높은 내돈내산 원고 생성",
  },
  {
    id: 4,
    title: "티스토리 에디터 자동 접속 및 임시저장 연동",
    description: "서식과 사진이 온전히 반영된 고품질 포스팅으로 티스토리 블로그 임시저장함에 등록",
  },
  {
    id: 5,
    title: "최종 원고 완성 및 SEO 메타데이터 검증",
    description: "검색 상위 노출을 위한 최적 제목, 메타 설명, 추천 검색 태그 완성 및 보관",
  },
];
import { compress_image_file } from "@/utils/imageCompressor";
import { 기본_상호명, 기본_위치, 기본_지도링크, 기본_주요정보, 기본_카테고리, 기본_샘플_사진 } from "@/utils/sampleData";

interface PhotoItem {
  id: string;
  dataUrl: string;
  caption: string;
  fileName: string;
  fileSize?: string;
}

const CATEGORIES = [
  { id: "맛집/카페", label: "🍽️ 맛집 / 디저트", desc: "미식, 베이커리, 분위기 좋은 카페" },
  { id: "여행/나들이", label: "✈️ 여행 / 명소", desc: "국내외 관광지, 당일치기 나들이, 핫플" },
  { id: "숙소/호텔", label: "🏨 숙소 / 호캉스", desc: "호텔, 감성 펜션, 리조트, 풀빌라" },
  { id: "문화/전시", label: "🎨 문화 / 팝업", desc: "전시회, 박물관, 팝업스토어, 공연" },
  { id: "생활/체험", label: "✨ 일상 / 체험", desc: "원데이클래스, 액티비티, 라이프스타일" },
];

export default function ExperienceReviewWriterPage() {
  // 1. 기본 입력 폼 상태
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("맛집/카페");
  const [location, setLocation] = useState("");
  const [placeUrl, setPlaceUrl] = useState("");
  const [keyInfo, setKeyInfo] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [rating, setRating] = useState("5.0");

  // 2. 다중 사진 상태 (최대 5장)
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3. 브라우저 자동화 & 티스토리 옵션 상태
  const [autoTistorySave, setAutoTistorySave] = useState(true);
  const [tistoryBlog, setTistoryBlog] = useState("s-elegant");
  const [launchingClaude, setLaunchingClaude] = useState(false);

  // AI 생성 엔진 선택 상태 ("gemini" 고속 생성 또는 "claude" 브라우저 자동화)
  const [ai_engine, set_ai_engine] = useState<"gemini" | "claude">("gemini");

  // 4. 생성 결과 상태
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [article, setArticle] = useState("");
  const [htmlArticle, setHtmlArticle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsString, setTagsString] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [savedContentId, setSavedContentId] = useState<string | null>(null);

  // 진행 단계별 표시 상태 관리 (스네이크 케이스 준수)
  const [current_step, set_current_step] = useState<number>(1);
  const [elapsed_seconds, set_elapsed_seconds] = useState<number>(0);
  const [is_step_completed, set_is_step_completed] = useState<boolean>(false);

  // 임시 테스트 데이터(도미닉커피로스터즈) 자동 입력 함수
  const loadSampleData = () => {
    setPlaceName(기본_상호명);
    setCategory(기본_카테고리);
    setLocation(기본_위치);
    setPlaceUrl(기본_지도링크);
    setKeyInfo(기본_주요정보);
    setSpecialNotes("매장에서 직접 로스팅하는 스페셜티 커피 전문점. 광교 호수공원 인근 여유로운 분위기.");
    setPhotos([기본_샘플_사진]);

    localStorage.setItem("exp_review_place", 기본_상호명);
    localStorage.setItem("exp_review_category", 기본_카테고리);
    localStorage.setItem("exp_review_loc", 기본_위치);
    localStorage.setItem("exp_review_url", 기본_지도링크);
    localStorage.setItem("exp_review_keyinfo", 기본_주요정보);
  };

  // 5. UI 탭 및 모달
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "editor" | "seo">("preview");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isAutoRegisterOpen, setIsAutoRegisterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isVercelEnv, setIsVercelEnv] = useState(false);

  // 로컬 스토리지 복원 및 환경 감지
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsVercelEnv(window.location.hostname.includes("vercel.app"));
    }
    const savedBlog = localStorage.getItem("tistory_blog");
    if (savedBlog) setTistoryBlog(savedBlog);

    const savedPlace = localStorage.getItem("exp_review_place");
    if (savedPlace && savedPlace.trim()) {
      setPlaceName(savedPlace);
    } else {
      loadSampleData();
    }

    const savedCat = localStorage.getItem("exp_review_category");
    if (savedCat) setCategory(savedCat);

    const savedLoc = localStorage.getItem("exp_review_loc");
    if (savedLoc) setLocation(savedLoc);

    const savedUrl = localStorage.getItem("exp_review_url");
    if (savedUrl) setPlaceUrl(savedUrl);

    const savedKey = localStorage.getItem("exp_review_keyinfo");
    if (savedKey) setKeyInfo(savedKey);

    const savedNotes = localStorage.getItem("exp_review_notes");
    if (savedNotes) setSpecialNotes(savedNotes);

    const savedTitle = localStorage.getItem("exp_review_res_title");
    if (savedTitle) setGeneratedTitle(savedTitle);

    const savedArt = localStorage.getItem("exp_review_res_article");
    if (savedArt) setArticle(savedArt);

    const savedHtml = localStorage.getItem("exp_review_res_html");
    if (savedHtml) setHtmlArticle(savedHtml);

    const savedTags = localStorage.getItem("exp_review_res_tags");
    if (savedTags) {
      try {
        const parsed = JSON.parse(savedTags);
        setTags(parsed);
        setTagsString(parsed.join(", "));
      } catch (e) {}
    }
  }, []);

  // 공통 사진 파일 처리 핸들러 (Vercel 413 방지를 위한 스마트 자동 압축 적용)
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 5) {
      alert(`사진은 최대 5장까지 업로드할 수 있습니다. (현재: ${photos.length}장 / 추가 선택: ${files.length}장)`);
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
          caption: `${placeName || '방문 장소'} 현장 컷 #${photos.length + index + 1}`,
          fileName: file.name,
          fileSize: file_size_str,
        };
        setPhotos(prev => [...prev, newPhoto]);
      } catch (err: any) {
        console.error("Image compression error:", err);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
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
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const updateCaption = (id: string, newCaption: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption: newCaption } : p));
  };

  // 폼 초기화
  const resetForm = () => {
    if (confirm("작성 중인 정보와 생성 결과를 모두 초기화하시겠습니까?")) {
      setPlaceName("");
      setLocation("");
      setPlaceUrl("");
      setKeyInfo("");
      setSpecialNotes("");
      setPhotos([]);
      setGeneratedTitle("");
      setArticle("");
      setHtmlArticle("");
      setTags([]);
      setTagsString("");
      setMetaDesc("");
      setSavedContentId(null);

      localStorage.removeItem("exp_review_place");
      localStorage.removeItem("exp_review_category");
      localStorage.removeItem("exp_review_loc");
      localStorage.removeItem("exp_review_url");
      localStorage.removeItem("exp_review_keyinfo");
      localStorage.removeItem("exp_review_notes");
      localStorage.removeItem("exp_review_res_title");
      localStorage.removeItem("exp_review_res_article");
      localStorage.removeItem("exp_review_res_html");
      localStorage.removeItem("exp_review_res_tags");
    }
  };

  // API 엔드포인트 URL 해석 (로컬 개발 환경에서는 Next.js 프록시 타임아웃/소켓끊김 방지를 위해 백엔드 8002 직접 호출)
  const getApiUrl = (endpoint: string) => {
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return `http://localhost:8002${endpoint}`;
    }
    return endpoint;
  };

  // Claude.ai 로그인용 브라우저 실행
  const handleLaunchClaude = async () => {
    setLaunchingClaude(true);
    try {
      const res = await fetch(getApiUrl("/api/claude/launch-browser"), { method: "POST" });
      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch (e) {}
      if (!res.ok) throw new Error(data.detail || rawText || "Claude 브라우저 실행 실패");
      alert("크롬 브라우저가 열렸습니다. 열린 창에서 Claude.ai 로그인을 진행해 주세요! (로그인 완료 시 세션이 영구 보존됩니다)");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setLaunchingClaude(false);
    }
  };

  // AI 원고 생성 실행 (Gemini 2.5 고속 엔진 또는 Claude 브라우저 자동화 엔진 듀얼 지원)
  const handleGenerate = async () => {
    if (!placeName.trim()) {
      alert("다녀온 곳의 장소명 또는 상호명을 입력해주세요.");
      return;
    }

    setLoading(true);
    set_current_step(1);
    set_elapsed_seconds(0);
    set_is_step_completed(false);
    setProgressStep("📷 현장 사진 최적화 및 장소 데이터 전처리 중...");

    let timer_seconds = 0;
    const timer_interval = setInterval(() => {
      timer_seconds += 1;
      set_elapsed_seconds(timer_seconds);

      if (ai_engine === "gemini") {
        if (timer_seconds === 2) {
          set_current_step(2);
          setProgressStep("🗺️ 네이버 플레이스 및 방문 경험 데이터 분석 중...");
        } else if (timer_seconds === 4) {
          set_current_step(3);
          setProgressStep("🤖 Gemini 2.5 Flash 고품질 방문 후기 원고 집필 중...");
        } else if (timer_seconds === 7 && autoTistorySave) {
          set_current_step(4);
          setProgressStep("📝 티스토리 에디터 자동 접속 및 원스톱 임시저장 진행 중...");
        }
      } else {
        if (timer_seconds === 2) {
          set_current_step(2);
          setProgressStep("🚀 크롬 브라우저 구동 및 Claude.ai 세션 연결 확인 중...");
        } else if (timer_seconds === 6) {
          set_current_step(3);
          setProgressStep("🧠 Claude 3.7 Sonnet 사진 정밀 분석 및 내돈내산 원고 집필 중...");
        } else if (timer_seconds === 22 && autoTistorySave) {
          set_current_step(4);
          setProgressStep("📝 티스토리 에디터 자동 접속 및 원스톱 임시저장 진행 중...");
        }
      }
    }, 1000);

    const photosPayload = photos.map(p => ({
      data_url: p.dataUrl,
      caption: p.caption,
      name: p.fileName
    }));

    try {
      if (ai_engine === "gemini") {
        // [모드 1] Gemini 2.5 Flash 고속 생성 (로그인 불필요, 5~10초 완성)
        setProgressStep("⚡ Gemini 2.5 Flash 고속 분석 및 원고 생성 중...");
        const geminiKey = typeof window !== "undefined" ? (localStorage.getItem("GEMINI_API_KEY") || "") : "";

        const res = await fetch("/api/generate-review", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Gemini-Key": geminiKey
          },
          body: JSON.stringify({
            restaurant_name: placeName,
            location: location,
            place_url: placeUrl,
            menu_info: keyInfo,
            special_notes: specialNotes,
            rating: rating,
            photos: photosPayload.slice(0, 2),
            adsense_optimize: false,
            category: category || "맛집/카페"
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Gemini 후기 생성 실패 (${res.status})`);
        }

        const data = await res.json();
        const contentTitle = data.title || `${placeName} 솔직 방문 후기`;
        const contentArticle = data.article || "";
        const contentHtml = data.html_article || "";
        const contentTags = data.tags || [];

        setGeneratedTitle(contentTitle);
        setArticle(contentArticle);
        setHtmlArticle(contentHtml);
        setTags(contentTags);
        setTagsString(data.tags_string || contentTags.join(", "));
        setMetaDesc(data.meta_description || "");
        setSavedContentId(data.content_id || null);

        // 티스토리 자동 임시저장 연계 (옵션 활성화 시)
        let tistoryOk = false;
        if (autoTistorySave) {
          set_current_step(4);
          setProgressStep("📝 티스토리 에디터 자동 임시저장 진행 중...");
          try {
            const blogTarget = tistoryBlog || "s-elegant";
            const autoRes = await fetch(getApiUrl("/api/tistory/auto-register"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: contentTitle,
                content_html: contentHtml,
                tags: contentTags,
                category: category || "맛집/카페",
                blog_name: blogTarget,
                action: "TEMP_SAVE"
              })
            });
            const autoData = await autoRes.json();
            tistoryOk = autoData.success;
          } catch (tErr) {
            console.warn("티스토리 임시저장 연계 알림:", tErr);
          }
        }

        clearInterval(timer_interval);
        set_current_step(5);
        set_is_step_completed(true);
        setProgressStep("🎉 Gemini 2.5 Flash 고속 원고 작성이 성공적으로 완료되었습니다!");

        // 로컬 스토리지 저장
        localStorage.setItem("exp_review_place", placeName);
        localStorage.setItem("exp_review_category", category);
        localStorage.setItem("exp_review_loc", location);
        localStorage.setItem("exp_review_url", placeUrl);
        localStorage.setItem("exp_review_keyinfo", keyInfo);
        localStorage.setItem("exp_review_notes", specialNotes);
        localStorage.setItem("exp_review_res_title", contentTitle);
        localStorage.setItem("exp_review_res_article", contentArticle);
        localStorage.setItem("exp_review_res_html", contentHtml);
        localStorage.setItem("exp_review_res_tags", JSON.stringify(contentTags));
        localStorage.setItem("tistory_blog", tistoryBlog);

        setActiveTab("preview");

        if (tistoryOk) {
          alert(`🎉 Gemini 고속 원고 생성 및 티스토리 임시저장이 모두 성공적으로 완료되었습니다!\n\n블로그: ${tistoryBlog}\n제목: ${contentTitle}`);
        } else {
          alert("✨ Gemini 2.5 Flash 고속 원고가 성공적으로 완성되었습니다! 아래 결과를 확인해보세요.");
        }

      } else {
        // [모드 2] Claude 3.7 브라우저 자동화 (Chrome 1회 로그인 필요)
        if (photos.length > 0) {
          setProgressStep(`📷 현장 사진 ${photos.length}장 주입 및 프롬프트 전송 중...`);
        } else {
          setProgressStep("📝 프롬프트 전송 및 원고 생성 대기 중...");
        }

        const res = await fetch(getApiUrl("/api/claude/generate-review"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_name: placeName,
            category: category,
            location: location,
            place_url: placeUrl,
            key_info: keyInfo,
            special_notes: specialNotes,
            rating: rating,
            photos: photosPayload,
            auto_tistory_save: autoTistorySave,
            tistory_blog: tistoryBlog
          }),
        });

        const rawText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          if (!res.ok) {
            throw new Error(`서버 처리 오류 (${res.status}): ${rawText.slice(0, 200)}`);
          }
        }

        if (!res.ok) {
          throw new Error(data.detail || `원고 생성 실패 (${res.status}): ${rawText.slice(0, 200)}`);
        }
        clearInterval(timer_interval);
        set_current_step(5);
        set_is_step_completed(true);
        setProgressStep("🎉 원고 작성 및 최적화가 성공적으로 완료되었습니다!");

        setGeneratedTitle(data.title || `${placeName} 솔직 방문 후기`);
        setArticle(data.article || "");
        setHtmlArticle(data.html_article || "");
        setTags(data.tags || []);
        setTagsString(data.tags_string || (data.tags || []).join(", "));
        setMetaDesc(data.meta_description || "");
        setSavedContentId(data.content_id || null);

        // 로컬 스토리지 저장
        localStorage.setItem("exp_review_place", placeName);
        localStorage.setItem("exp_review_category", category);
        localStorage.setItem("exp_review_loc", location);
        localStorage.setItem("exp_review_url", placeUrl);
        localStorage.setItem("exp_review_keyinfo", keyInfo);
        localStorage.setItem("exp_review_notes", specialNotes);
        localStorage.setItem("exp_review_res_title", data.title || "");
        localStorage.setItem("exp_review_res_article", data.article || "");
        localStorage.setItem("exp_review_res_html", data.html_article || "");
        localStorage.setItem("exp_review_res_tags", JSON.stringify(data.tags || []));
        localStorage.setItem("tistory_blog", tistoryBlog);

        setActiveTab("preview");

        if (data.tistory_saved) {
          alert(`🎉 Claude 원고 생성 및 티스토리 임시저장이 모두 성공적으로 완료되었습니다!\n\n블로그: ${tistoryBlog}\n제목: ${data.title}`);
        } else if (autoTistorySave && !data.tistory_saved) {
          alert(`⚠️ Claude 원고 생성은 완료되었으나, 티스토리 저장 중 알림이 있습니다:\n${data.tistory_message || '임시저장을 수동으로 실행해주세요.'}`);
        } else {
          alert("✨ Claude 웹에서 고품질 방문 후기 원고가 성공적으로 완성되었습니다! 아래 결과를 확인해보세요.");
        }
      }

    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "원고 생성 중 문제가 발생했습니다.";
      if (errMsg.includes("로그인 대기 시간") || errMsg.includes("Claude.ai")) {
        errMsg += "\n\n💡 팁: 별도 로그인 없이 즉시 원고를 생성하시려면 상단의 [⚡ Gemini 2.5 Flash 고속 생성]을 선택해 보세요!";
      }
      alert(`오류: ${errMsg}`);
    } finally {
      clearInterval(timer_interval);
      setLoading(false);
      setProgressStep("");
    }
  };

  const showCopiedToast = (type: string) => {
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    showCopiedToast(type);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Vercel 환경 안내 배너 */}
      {isVercelEnv && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                안내: 현재 Vercel 클라우드(웹)로 접속 중입니다.
              </h4>
              <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                Claude 웹 브라우저 및 티스토리 자동화(Playwright)는 <strong>사용자 PC의 크롬 창을 직접 띄워 작업하는 로컬 보안 기능</strong>입니다.
                클라우드 서버에서는 사용자 PC의 브라우저를 띄울 수 없으므로, 자동 실행을 위해 <strong>내 컴퓨터 로컬 주소(http://localhost:3000)</strong>에서 실행해 주세요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="http://localhost:3000/experience-reviews"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <span>로컬 서버 열기 (3000)</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {/* 상단 타이틀 배너 */}
      <div className="relative rounded-3xl overflow-hidden p-8 border border-white/[0.08] bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-indigo-950/40 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30 mb-3">
              <Bot size={14} className="text-blue-400" />
              <span>Claude.ai Web + Tistory Playwright Automation</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              종합 방문·체험 후기 라이터
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              다녀온 곳 정보와 현장 사진을 입력하면, <strong>로그인된 Claude 웹 브라우저(Playwright)</strong>가 생생한 내돈내산 원고를 작성하고, <strong>티스토리 에디터에 자동 접속하여 [임시저장]</strong>까지 원스톱으로 처리합니다.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchClaude}
              disabled={launchingClaude || loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.1] text-xs font-semibold transition-all disabled:opacity-50"
              title="첫 사용 시 Claude.ai 로그인 세션을 유지하기 위해 브라우저를 엽니다."
            >
              <Globe size={16} className="text-orange-400" />
              {launchingClaude ? "브라우저 구동 중..." : "Claude 로그인 창 열기"}
            </button>
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
        {/* 좌측: 입력 폼 섹션 (5열) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass size={18} className="text-blue-400" />
                1. 방문 장소 정보 입력
              </h2>
              <button
                type="button"
                onClick={loadSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all hover:scale-105 shadow-sm"
                title="도미닉커피로스터즈 테스트 데이터 자동 채우기"
              >
                <Sparkles size={13} className="text-blue-400 animate-pulse" />
                테스트 데이터 자동 입력
              </button>
            </div>

            {/* 카테고리 선택 */}
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
                        ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/20"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.15] hover:text-white"
                    }`}
                  >
                    <div>{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 장소명 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                장소 / 상호명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={placeName}
                onChange={e => setPlaceName(e.target.value)}
                placeholder="예: 런던베이글뮤지엄 안국점, 제주 신화월드, 속초 칠성조선소"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* 위치 및 지도 링크 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <MapPin size={12} className="text-blue-400" /> 위치 / 지역
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="예: 서울 종로구 북촌"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <ExternalLink size={12} className="text-blue-400" /> 지도 링크
                </label>
                <input
                  type="text"
                  value={placeUrl}
                  onChange={e => setPlaceUrl(e.target.value)}
                  placeholder="네이버/카카오 지도 URL"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* 주요 정보 (메뉴, 가격, 입장료 등) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                주요 정보 (메뉴/가격/입장료/객실타입 등)
              </label>
              <textarea
                value={keyInfo}
                onChange={e => setKeyInfo(e.target.value)}
                rows={2}
                placeholder="예: 쪽파 크림치즈 베이글 8,500원, 트러플 수프 12,800원 / 성인 입장료 15,000원"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {/* 솔직 메모 및 특이사항 (선택) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                방문 특이사항 및 솔직 메모 (선택)
              </label>
              <textarea
                value={specialNotes}
                onChange={e => setSpecialNotes(e.target.value)}
                rows={3}
                placeholder="예: 주말 기준 캐치테이블 원격 줄서기 필수(대기 40분), 2층 테라스 채광이 사진 잘 나옴, 주차장은 인근 공영주차장 이용 추천"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {/* 별점 선택 */}
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

          {/* 사진 업로드 섹션 (드래그 앤 드롭 지원) */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-[#0b0c14] border rounded-3xl p-6 shadow-xl space-y-4 transition-all duration-200 relative ${
              isDragging
                ? "border-purple-500 bg-purple-950/20 ring-2 ring-purple-500/40 shadow-purple-500/10"
                : "border-white/[0.08]"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Camera size={18} className="text-purple-400" />
                2. 현장 사진 등록 ({photos.length}/5)
                {isDragging && (
                  <span className="text-xs text-purple-400 font-normal animate-pulse">
                    (마우스를 놓으면 즉시 업로드됩니다)
                  </span>
                )}
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= 5}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all disabled:opacity-40"
              >
                <Upload size={13} />
                사진 추가
              </button>
            </div>

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-purple-400 bg-purple-500/10 scale-[1.01] shadow-lg shadow-purple-500/20"
                    : "border-white/[0.1] hover:border-purple-500/50 bg-white/[0.01] hover:bg-white/[0.03]"
                }`}
              >
                <Camera size={32} className={`mx-auto mb-2 transition-colors ${isDragging ? "text-purple-400 animate-bounce" : "text-slate-500"}`} />
                <p className="text-sm text-slate-200 font-semibold">
                  {isDragging ? "여기에 사진을 놓으세요! (드래그 앤 드롭)" : "사진을 드래그하여 여기에 놓거나 클릭하여 업로드 (최대 5장)"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  JPG, PNG, WEBP 지원 · 외관, 시그니처 메뉴, 인테리어 등 (Claude에 첨부되어 분석됩니다)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                  >
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
                        placeholder="사진 설명 (예: 매장 외관, 대표 메뉴 시식 등)"
                        className="w-full px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
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

                {/* 5장 미만일 때 추가 드롭존 안내 */}
                {photos.length < 5 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-purple-400 bg-purple-500/10 text-purple-300"
                        : "border-white/[0.08] hover:border-purple-500/40 hover:bg-white/[0.02] text-slate-400"
                    }`}
                  >
                    <p className="text-xs flex items-center justify-center gap-1.5 font-medium">
                      <Upload size={13} className={isDragging ? "text-purple-400 animate-bounce" : "text-purple-400"} />
                      {isDragging ? "여기에 놓아서 추가하세요!" : `+ 추가 사진을 여기에 드래그하거나 클릭하여 추가 (${5 - photos.length}장 더 가능)`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI 생성 엔진 선택 카드 (Gemini 고속 / Claude 브라우저) */}
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-blue-400" />
                3. AI 원고 생성 엔진 선택
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                {ai_engine === "gemini" ? "⚡ 로그인 불필요 (추천)" : "🧠 브라우저 연동"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Gemini 2.5 Flash 옵션 */}
              <button
                type="button"
                onClick={() => set_ai_engine("gemini")}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  ai_engine === "gemini"
                    ? "bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40 text-white"
                    : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    ⚡ Gemini 2.5 Flash
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-[10px] text-blue-200 font-bold border border-blue-400/30">
                    추천·로그인불필요
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  브라우저 로그인 없이 <strong>5~10초 만에 즉시</strong> 사진 분석 및 고품질 내돈내산 원고 완성
                </p>
              </button>

              {/* Claude 3.7 Sonnet 옵션 */}
              <button
                type="button"
                onClick={() => set_ai_engine("claude")}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  ai_engine === "claude"
                    ? "bg-purple-600/20 border-purple-500/60 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/40 text-white"
                    : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    🧠 Claude 3.7 Sonnet
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-[10px] text-purple-200 font-medium border border-purple-400/20">
                    Chrome 자동화
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  내 PC 크롬 브라우저를 직접 띄워 Claude 웹에서 고품질 작성 (최초 1회 로그인 필요)
                </p>
              </button>
            </div>
          </div>

          {/* 원스톱 자동화 및 티스토리 연동 옵션 */}
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot size={18} className="text-orange-400" />
              4. 티스토리 자동 임시저장 연동 설정
            </h2>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTistorySave}
                  onChange={e => setAutoTistorySave(e.target.checked)}
                  className="mt-1 rounded bg-black/40 border-white/20 text-blue-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    원스톱 자동 임시저장 실행
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-semibold border border-green-500/30">
                      추천
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Claude에서 원고 작성이 완료되는 즉시, 티스토리 에디터에 제목/본문(HTML)/태그를 주입하고 [임시저장]까지 자동으로 완료합니다.
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  티스토리 블로그명 (서브도메인)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tistoryBlog}
                    onChange={e => setTistoryBlog(e.target.value)}
                    placeholder="s-elegant"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-400 font-mono">.tistory.com</span>
                </div>
              </div>
            </div>

            {/* 실행 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>{progressStep || "처리 중..."}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>
                    {ai_engine === "gemini" 
                      ? "⚡ Gemini 2.5 Flash로 즉시 작성하기 (추천)" 
                      : "🧠 Claude 3.7로 작성하고 티스토리 임시저장하기"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 우측: 결과 뷰어 및 에디터 섹션 (7열) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#0b0c14] border border-white/[0.08] rounded-3xl p-6 shadow-xl flex flex-col h-full min-h-[700px]">
            {/* 결과 탭 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "preview"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Eye size={14} /> 미리보기
                </button>
                <button
                  onClick={() => setActiveTab("html")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "html"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Code size={14} /> HTML
                </button>
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "editor"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText size={14} /> 본문 수정
                </button>
                <button
                  onClick={() => setActiveTab("seo")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "seo"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Tag size={14} /> 태그 & SEO
                </button>
              </div>

              {/* 액션 버튼 */}
              <div className="flex items-center gap-2">
                {generatedTitle && (
                  <>
                    <button
                      onClick={() => setIsAutoRegisterOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs font-bold transition-all shadow-sm"
                      title="티스토리 에디터에 직접 등록 실행"
                    >
                      <Bot size={14} />
                      티스토리 임시저장
                    </button>
                    <button
                      onClick={() => copyToClipboard(htmlArticle || article, "html")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.1] text-xs font-semibold transition-all"
                    >
                      {copiedType === "html" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      {copiedType === "html" ? "복사완료" : "HTML 복사"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 결과 콘텐츠 본문 */}
            <div className="flex-1 py-5 overflow-y-auto max-h-[750px]">
              {!generatedTitle && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-4 text-slate-400">
                    <Compass size={32} />
                  </div>
                  <h3 className="text-base font-bold text-slate-300 mb-1">방문 후기 원고가 생성되지 않았습니다</h3>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    좌측에서 다녀온 곳의 정보와 사진을 입력하고 <strong>[Claude로 작성하고 티스토리 임시저장하기]</strong>를 클릭하세요.
                  </p>
                </div>
              ) : loading ? (
                <div className="h-full flex flex-col items-center justify-center py-6 px-4">
                  <StepProgressIndicator
                    steps={ai_engine === "gemini" ? 제미나이_단계_목록 : 클로드_단계_목록}
                    current_step={current_step}
                    is_completed={is_step_completed}
                    elapsed_seconds={elapsed_seconds}
                    sub_message={progressStep}
                    tip_message={
                      ai_engine === "gemini"
                        ? "Gemini 2.5 Flash AI가 현장 사진과 네이버 지도 정보를 토대로 실시간으로 고품질 내돈내산 원고를 집필 중입니다."
                        : current_step === 2
                        ? "새로 열린 크롬 창에서 Claude.ai 로그인을 완료해 주시면 봇이 감지하여 즉시 다음 단계로 자동 진행합니다."
                        : current_step === 4
                        ? "티스토리 블로그 임시저장함에 본문 및 서식 코드를 안전하게 주입하고 있습니다."
                        : ""
                    }
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 제목 섹션 */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">포스팅 제목</div>
                    <h2 className="text-lg font-bold text-white leading-snug">{generatedTitle}</h2>
                  </div>

                  {/* 탭별 내용 */}
                  {activeTab === "preview" && (
                    <div className="p-6 rounded-2xl bg-[#08090f] border border-white/[0.06] text-slate-200">
                      <div 
                        className="tistory-preview-content space-y-4 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: htmlArticle }} 
                      />
                    </div>
                  )}

                  {activeTab === "html" && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                        <span>티스토리 에디터 [HTML 모드] 전용 코드</span>
                        <span>{htmlArticle.length} 자</span>
                      </div>
                      <textarea
                        readOnly
                        value={htmlArticle}
                        rows={22}
                        className="w-full p-4 rounded-2xl bg-black/60 border border-white/[0.08] text-xs font-mono text-emerald-400 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  {activeTab === "editor" && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400 px-1">원고 마크다운 텍스트 직접 수정</div>
                      <textarea
                        value={article}
                        onChange={e => setArticle(e.target.value)}
                        rows={22}
                        className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  {activeTab === "seo" && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                        <span className="text-xs font-bold text-slate-400">메타 설명 (SEO Description)</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{metaDesc || "생성된 메타 설명이 없습니다."}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                        <span className="text-xs font-bold text-slate-400">추천 검색 태그 ({tags.length}개)</span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-medium"
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

      {/* 수동 티스토리 자동 등록 모달 (원스톱 미사용 시 또는 재실행용) */}
      {isAutoRegisterOpen && savedContentId && (
        <AutoRegisterModal
          isOpen={isAutoRegisterOpen}
          onClose={() => setIsAutoRegisterOpen(false)}
          contentId={savedContentId}
          title={generatedTitle}
          category={category}
          onSuccess={() => {
            alert("티스토리 임시저장이 완료되었습니다!");
          }}
        />
      )}
    </div>
  );
}
