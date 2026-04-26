"use client";

import { useState } from "react";
import { ImageIcon, Send, Download, Copy, Loader2, Zap, Layout, Sparkles, RefreshCw, Layers, Palette } from "lucide-react";

const IMAGE_STYLES = [
  { id: "default", label: "✨ 자동 최적화", promptSuffix: "" },
  { id: "photo", label: "📸 실사 사진", promptSuffix: "photorealistic, 8K resolution, professional photography style" },
  { id: "3d", label: "🧊 3D 렌더링", promptSuffix: "high quality 3D render, cinematic lighting, Unreal Engine style" },
  { id: "illustration", label: "🎨 일러스트", promptSuffix: "sophisticated digital illustration, vibrant colors, trendy art style" },
  { id: "watercolor", label: "🖌️ 수채화", promptSuffix: "beautiful watercolor style, soft pastel tones, artistic feel" },
  { id: "cyberpunk", label: "🌃 사이버펑크", promptSuffix: "cyberpunk style, neon lighting, futuristic atmosphere" },
  { id: "lineart", label: "✒️ 라인 아트", promptSuffix: "minimalist line art, clean strokes, white background, elegant" },
  { id: "oilpainting", label: "🖼️ 클래식 유화", promptSuffix: "oil painting, thick texture, masterpiece, rich colors, canvas texture" },
  { id: "anime", label: "🌸 애니메이션", promptSuffix: "anime style, vibrant colors, expressive characters, high quality anime art" },
  { id: "pixelart", label: "👾 픽셀 아트", promptSuffix: "retro pixel art, 16-bit, game asset style" },
  { id: "popart", label: "💥 팝아트", promptSuffix: "pop art style, bold outlines, vibrant solid colors, Andy Warhol feel" }
];

const RESOLUTIONS = [
  { id: "512x512", label: "1:1 소형 (512x512)" },
  { id: "1024x1024", label: "1:1 정사각형 (1024x1024)" },
  { id: "1792x1024", label: "16:9 가로형 (1792x1024)" },
  { id: "1024x1792", label: "9:16 세로형 (1024x1792)" }
];

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [imageSource, setImageSource] = useState<"gemini" | "openai" | "pollinations" | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(IMAGE_STYLES[0]);
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTIONS[0].id);
  const [progressMessage, setProgressMessage] = useState("");

  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setErrorMsg("");
    setImageUrl(""); 
    setImageSource(null);
    setProgressMessage("0단계: 프롬프트 분석 및 최적화 중...");

    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    const openaiKey = localStorage.getItem("OPENAI_API_KEY") || "";
    try {
      const finalPrompt = selectedStyle.promptSuffix 
        ? `${prompt}, ${selectedStyle.promptSuffix}` 
        : prompt;

      const res = await fetch("http://127.0.0.1:8002/api/generate-image", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Gemini-Key": geminiKey,
          "X-OpenAI-Key": openaiKey
        },
        body: JSON.stringify({ 
          prompt_base: finalPrompt,
          resolution: selectedResolution
        }),
      });

      if (!res.ok) {
        throw new Error("서버 통신 오류가 발생했습니다.");
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("데이터 스트림을 읽을 수 없습니다.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const jsonStr = trimmed.substring(6).trim();
              const data = JSON.parse(jsonStr);
              
              if (data.status === "progress") {
                setProgressMessage(data.message);
              } else if (data.status === "success") {
                setImageUrl(data.image_url);
                setImageSource(data.source);
              } else if (data.status === "error") {
                throw new Error(data.message);
              }
            } catch (e: any) {
              if (e.message.includes("5단계 오류") || e.message.includes("시간 초과")) {
                throw e;
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Generation failed", error);
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
      setProgressMessage("");
    }
  };

  return (
    <div className="flex flex-col gap-10 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
           <ImageIcon size={14} className="text-emerald-500" />
           <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-outfit">Visual Content Engine</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">이미지 생성기 <span className="text-emerald-400 font-light italic">Visualization.</span></h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
           Gemini 이미지 모델로 블로그 썸네일을 생성하세요. 무료 한도 초과 시 <span className="text-emerald-400 font-medium">Pollinations AI</span>로 자동 전환됩니다. <br />
           텍스트 프롬프트만으로 클릭을 유도하는 전문적인 시각적 콘텐츠를 완성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left: Enhanced Prompt Panel */}
        <div className="lg:col-span-5 flex flex-col gap-8">
           <div className="glass-card p-8 flex flex-col gap-10 neon-glow-emerald relative overflow-hidden group shine-effect">
              <div className="flex items-center justify-between relative z-10">
                 <h2 className="text-lg font-bold text-white flex items-center gap-3 font-outfit">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Sparkles size={20} className="text-emerald-500" />
                    </div>
                    비주얼 프롬프트 설계
                 </h2>
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Imagen 3.0 Pro</span>
              </div>

              <div className="flex flex-col gap-4 relative z-10">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Layout size={12} className="text-emerald-500/60" />
                  이미지 핵심 컨셉 및 상세 묘사
                </label>
                <div className="relative">
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="예: 현대적이고 세련된 사무실에서 노트북으로 작업하는 모습, 블루/옐로우 강조 컬러, 고품질 디지털 아트 스타일"
                    className="w-full bg-white/[0.03] border border-white/[0.05] rounded-3xl p-6 text-white text-base focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-gray-700 min-h-[160px] resize-none leading-relaxed shadow-inner"
                  />
                  <div className="absolute right-4 bottom-4 text-[10px] text-gray-600 font-medium tracking-tight">AI Optimizer Active</div>
                </div>
              </div>

              {/* Image Style Selection */}
              <div className="flex flex-col gap-4 relative z-10">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Palette size={12} className="text-emerald-500/60" />
                  아트 스타일 선택
                </label>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                        selectedStyle.id === style.id
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "bg-white/[0.02] border-white/[0.05] text-gray-400 hover:bg-white/[0.05] hover:text-gray-300"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Selection */}
              <div className="flex flex-col gap-4 relative z-10">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Layout size={12} className="text-emerald-500/60" />
                  해상도 선택
                </label>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTIONS.map((resOpt) => (
                    <button
                      key={resOpt.id}
                      onClick={() => setSelectedResolution(resOpt.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
                        selectedResolution === resOpt.id
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "bg-white/[0.02] border-white/[0.05] text-gray-400 hover:bg-white/[0.05] hover:text-gray-300"
                      }`}
                    >
                      {resOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={generateImage}
                disabled={loading || !prompt}
                className="w-full relative group bg-gradient-to-tr from-emerald-700 to-emerald-500 hover:from-emerald-600 hover:to-emerald-400 text-white py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 mt-2 shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <><Layers size={20} className="group-hover:rotate-12 transition-transform" /> 프리미엄 이미지 생성</>}
              </button>
              
              <div className="absolute -left-20 -top-20 w-80 h-80 bg-emerald-600/5 blur-[120px] pointer-events-none group-hover:scale-150 transition-all duration-700" />
           </div>

           <div className="glass-card p-6 border-dashed border-white/[0.05] flex flex-col gap-4 opacity-70">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">포함된 스마트 옵션</h3>
             <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03] text-[11px] text-gray-500">✓ 고해상도 1024x1024</div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03] text-[11px] text-gray-500">✓ 자동 리페인팅 지원</div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03] text-[11px] text-gray-500">✓ 블로그 최적화 비율</div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03] text-[11px] text-gray-500">✓ 다채로운 예술적 스타일</div>
             </div>
          </div>
        </div>

        {/* Right: High-End Image Output Display */}
        <div className="lg:col-span-7 flex flex-col gap-6">
           <div className="glass-card flex-1 min-h-[600px] flex items-center justify-center relative overflow-hidden shadow-inner shine-effect bg-[#050508]/40">
              
              {!imageUrl && !loading && (
                <div className="flex flex-col items-center gap-6 opacity-30 group cursor-default">
                   <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-800 flex items-center justify-center group-hover:border-emerald-500/20 transition-colors">
                      <ImageIcon size={64} strokeWidth={1} />
                   </div>
                   <p className="text-xl font-medium tracking-tight">비주얼 엔진 대기 중</p>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050508]/60 backdrop-blur-3xl z-20 gap-8 animate-in fade-in transition-all">
                  <div className="relative">
                     <div className="relative z-10 w-28 h-28 rounded-[2rem] bg-emerald-600/10 flex items-center justify-center border border-emerald-500/30 overflow-hidden">
                        <Loader2 className="text-emerald-500 animate-spin" size={48} strokeWidth={1.5} />
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/10 to-transparent animate-pulse" />
                     </div>
                     <div className="absolute -inset-10 bg-emerald-600/10 blur-[80px] rounded-full animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                     <p className="text-2xl font-bold text-white tracking-tight font-outfit">Dreaming up your vision</p>
                     <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        {progressMessage || "생성 중..."}
                     </div>
                  </div>
                </div>
              )}

              {errorMsg && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050508]/80 backdrop-blur-md z-20 gap-6 p-10 text-center animate-in fade-in transition-all">
                  <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                     <span className="text-red-500 font-bold text-3xl">!</span>
                  </div>
                  <h3 className="text-xl font-bold text-white font-outfit">생성 오류 발생</h3>
                  <p className="text-sm text-red-400 break-words max-w-[80%] bg-red-500/10 p-4 rounded-xl border border-red-500/20 leading-relaxed">
                     {errorMsg}
                  </p>
                  <button 
                    onClick={() => setErrorMsg("")}
                    className="mt-4 px-6 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-xl text-xs font-bold transition-all border border-white/[0.1]"
                  >
                    닫기
                  </button>
                </div>
              )}

              {imageUrl && !errorMsg && (
                <div className="w-full h-full p-4 relative group animate-in zoom-in-95 fade-in duration-1000">
                  {/* 이미지 생성 엔진 배지 */}
                  {imageSource && (
                    <div className="absolute top-8 left-8 z-10">
                      {imageSource === "pollinations" && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          Pollinations AI (무료 폴백)
                        </span>
                      )}
                      {imageSource === "gemini" && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                          Gemini AI
                        </span>
                      )}
                      {imageSource === "openai" && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                          DALL-E 3
                        </span>
                      )}
                    </div>
                  )}
                  <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-emerald-950/20">
                    <img 
                      src={imageUrl} 
                      alt="Generated Visual" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    
                    {/* Floating Overlay Controls */}
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                       <button className="bg-white/10 backdrop-blur-xl border border-white/10 p-4 rounded-2xl hover:bg-white/20 transition-all text-white shadow-xl hover:scale-110 active:scale-95 group/btn">
                          <Download size={20} />
                          <span className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 text-[9px] bg-black px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Download Image</span>
                       </button>
                       <button className="bg-white/10 backdrop-blur-xl border border-white/10 p-4 rounded-2xl hover:bg-white/20 transition-all text-white shadow-xl hover:scale-110 active:scale-95 group/btn">
                          <Copy size={20} />
                          <span className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 text-[9px] bg-black px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Copy URL</span>
                       </button>
                       <button 
                          onClick={generateImage}
                          className="bg-emerald-600/60 backdrop-blur-xl border border-emerald-500/50 p-4 rounded-2xl hover:bg-emerald-500 transition-all text-white shadow-xl hover:scale-110 active:scale-95 group/btn"
                        >
                          <RefreshCw size={20} />
                          <span className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 text-[9px] bg-black px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Regenerate</span>
                       </button>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                       <p className="text-white font-medium text-sm leading-relaxed max-w-[80%] line-clamp-2">
                          <Sparkles className="inline-block mr-2 text-emerald-400" size={14} /> 
                          {prompt}
                       </p>
                    </div>
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
