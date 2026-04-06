"use client";

import { useState, useEffect } from "react";
import { Key, Save, CheckCircle, ShieldCheck, Zap, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function ApiKeyHeader() {
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const g = localStorage.getItem("GEMINI_API_KEY") || "";
    const o = localStorage.getItem("OPENAI_API_KEY") || "";
    setGeminiKey(g);
    setOpenaiKey(o);
  }, []);

  const saveKeys = () => {
    localStorage.setItem("GEMINI_API_KEY", geminiKey);
    localStorage.setItem("OPENAI_API_KEY", openaiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <header className="h-20 border-b border-white/[0.05] bg-[#050508]/60 backdrop-blur-3xl px-10 flex items-center justify-between sticky top-0 z-50 transition-all duration-500">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
             <ShieldCheck size={16} className="text-blue-500" />
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">System Health</span>
             <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
               Core Engine Operational
             </span>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-white/[0.1] hidden md:block" />

        <Link href="/help" className="hidden md:flex group items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/20 transition-all cursor-pointer">
           <HelpCircle size={14} className="text-blue-400 group-hover:rotate-12 transition-transform" />
           <span className="text-xs font-bold text-blue-100 group-hover:text-white transition-colors">사용법 안내 바로가기</span>
        </Link>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
            <div className="relative group">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-blue-500" size={14} />
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Google Gemini API Key"
                className="bg-white/[0.03] border border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 w-64 transition-all hover:bg-white/[0.05]"
              />
            </div>

            <div className="relative group">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-purple-500" size={14} />
              <input 
                type="password" 
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="OpenAI API Key (Optional)"
                className="bg-white/[0.03] border border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 w-48 transition-all hover:bg-white/[0.05]"
              />
            </div>
        </div>

        <div className="flex items-center gap-4 border-l border-white/[0.05] pl-6">
           <div className="flex flex-col items-end mr-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Unified Engine</span>
              <span className="text-[10px] text-blue-400 font-medium">Auto-Sync Enabled</span>
           </div>
           <button 
              onClick={saveKeys}
              className="group relative bg-gradient-to-tr from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95 active:shadow-none"
            >
              {saved ? <CheckCircle size={14} className="animate-in zoom-in" /> : <Zap size={14} className="group-hover:rotate-12 transition-transform" />}
              <span>{saved ? "연동 완료" : "시스템 동기화"}</span>
            </button>
        </div>
      </div>
    </header>
  );
}
