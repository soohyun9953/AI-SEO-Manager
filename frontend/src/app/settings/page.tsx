"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Globe, Users, FileText, LayoutTemplate, Key } from "lucide-react";

export default function SettingsPage() {
  const [domain, setDomain] = useState("");
  const [target, setTarget] = useState("");
  const [lang, setLang] = useState("ko");
  const [tistoryToken, setTistoryToken] = useState("");
  const [tistoryBlog, setTistoryBlog] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDomain(localStorage.getItem("seo_domain") || "");
    setTarget(localStorage.getItem("seo_target") || "");
    setLang(localStorage.getItem("seo_lang") || "ko");
    setTistoryToken(localStorage.getItem("tistory_token") || "");
    setTistoryBlog(localStorage.getItem("tistory_blog") || "");
  }, []);

  const saveSettings = () => {
    localStorage.setItem("seo_domain", domain);
    localStorage.setItem("seo_target", target);
    localStorage.setItem("seo_lang", lang);
    localStorage.setItem("tistory_token", tistoryToken);
    localStorage.setItem("tistory_blog", tistoryBlog);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
          <Settings className="text-yellow-500" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white tracking-tight">환경 설정</h1>
          <p className="text-sm text-gray-400 mt-1">기본 SEO 도메인 설정 및 티스토리 원스톱 발행용 계정을 연동합니다.</p>
        </div>
      </div>

      <div className="glass-card p-8 flex flex-col gap-8 relative overflow-hidden">
        
        {/* 일반 설정 */}
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-bold text-white mb-2 border-b border-white/[0.05] pb-2">기본 SEO 설정</h2>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <Globe size={16} className="text-blue-400" />
              기본 도메인
            </label>
            <input 
              type="text" 
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-[#0a0a0f] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
            />
          </div>

          <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <Users size={16} className="text-purple-400" />
              기본 타겟 고객
            </label>
            <input 
              type="text" 
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="예: 20-30대 직장인, IT 전문가..."
              className="w-full bg-[#0a0a0f] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <FileText size={16} className="text-emerald-400" />
              기본 출력 언어
            </label>
            <select 
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            >
              <option value="ko">한국어 (Korean)</option>
              <option value="en">영어 (English)</option>
              <option value="ja">일본어 (Japanese)</option>
            </select>
          </div>
        </div>

        {/* 티스토리 연동 설정 */}
        <div className="flex flex-col gap-6 mt-4 pt-4 border-t border-white/[0.05]">
          <h2 className="text-lg font-bold text-white mb-2 border-b border-white/[0.05] pb-2 flex items-center gap-2">
            <LayoutTemplate size={20} className="text-orange-500" />
            티스토리 다이렉트 포스팅 (반자동)
          </h2>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-1">
            <p className="text-sm font-bold text-red-400">⚠️ 티스토리 Open API 지원 종료 안내</p>
            <p className="text-xs text-gray-400">
              카카오 정책 변경으로 신규 API 토큰 발급이 중단되었습니다. 대신 <strong>블로그 이름</strong>만 입력하시면 [새 창 자동 열기 + 클립보드 복사] 기능을 통해 1초 만에 반자동으로 포스팅할 수 있도록 우회 지원합니다.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <Globe size={16} className="text-orange-400" />
              블로그 이름 (Blog Name)
            </label>
            <input 
              type="text" 
              value={tistoryBlog}
              onChange={(e) => setTistoryBlog(e.target.value)}
              placeholder="블로그 URL의 이름 부분 (예: myblog)"
              className="w-full bg-[#0a0a0f] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">예: https://<span className="text-orange-400 font-bold">myblog</span>.tistory.com 인 경우 myblog 만 입력</p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-white/[0.05] mt-2">
          <button 
            onClick={saveSettings}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/25"
          >
            <Save size={18} />
            {saved ? "저장 완료!" : "설정 저장하기"}
          </button>
        </div>
        
        {/* Abstract Glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-yellow-500/10 blur-[100px] pointer-events-none" />
      </div>
    </div>
  );
}
