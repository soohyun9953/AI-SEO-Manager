"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

// 로그인 후 이동할 주소: 같은 사이트 안의 경로만 허용 (외부 주소로 보내는 우회 방지)
function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign(safeNextPath());
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "로그인에 실패했습니다.");
      setPassword("");
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 rounded-3xl bg-[#0a0a0f]/80 backdrop-blur-3xl border border-white/[0.08] shadow-2xl space-y-6"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Lock size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SEO Manager</h1>
          <p className="text-xs text-gray-400">접속하려면 비밀번호를 입력하세요</p>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            autoComplete="current-password"
            className="w-full px-4 py-3 bg-[#171722] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          로그인
        </button>
      </form>
    </div>
  );
}
